import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isManagement, requirePermission } from "@/lib/authorization";
import { createApprovalSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import {
  requireAuth,
  parseJsonBody,
  badRequest,
  forbidden,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import {
  isBetriebsratMember,
  approvalDeadline,
  notifyBetriebsratMembers,
} from "@/lib/betriebsrat";

/**
 * GET /api/betriebsrat/approvals
 * Role-aware list of shift-plan approvals for the works-council portal.
 * Returns { role, canReview, approvals }.
 */
export const GET = withRoute("/api/betriebsrat/approvals", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const member = await isBetriebsratMember(user.id, workspaceId);
  const manager = isManagement(user);
  if (!member && !manager) {
    return forbidden("Kein Zugriff auf den Betriebsrat-Bereich");
  }

  const approvals = await prisma.shiftPlanApproval.findMany({
    where: { workspaceId },
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    select: {
      id: true,
      title: true,
      periodStart: true,
      periodEnd: true,
      locationId: true,
      shiftCount: true,
      status: true,
      deadline: true,
      decisionNote: true,
      reviewedAt: true,
      createdAt: true,
      submittedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    role: member ? "member" : "manager",
    canReview: member,
    approvals,
  });
});

/**
 * POST /api/betriebsrat/approvals
 * Submit a shift schedule (period + optional location) for works-council
 * co-determination. Management only. Sets a 3-day response deadline and
 * notifies all council members.
 */
export const POST = withRoute(
  "/api/betriebsrat/approvals",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbid = requirePermission(user, "shifts", "update");
    if (forbid) return forbid;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(createApprovalSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { title, periodStart, periodEnd, locationId } = parsed.data;

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (end < start) {
      return badRequest("Periodenende darf nicht vor dem Beginn liegen");
    }

    // Snapshot the number of shifts in scope at submission time.
    const shiftCount = await prisma.shift.count({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
        deletedAt: null,
        ...(locationId ? { locationId } : {}),
      },
    });

    const deadline = approvalDeadline();

    const approval = await prisma.shiftPlanApproval.create({
      data: {
        workspaceId,
        title,
        periodStart: start,
        periodEnd: end,
        locationId: locationId || null,
        shiftCount,
        deadline,
        submittedById: user.id,
      },
    });

    await notifyBetriebsratMembers(workspaceId, {
      type: "BETRIEBSRAT_APPROVAL_REQUESTED",
      title: "Dienstplan zur Mitbestimmung vorgelegt",
      message: `„${title}“ wurde dem Betriebsrat zur Zustimmung vorgelegt. Frist: ${deadline.toLocaleDateString("de-DE")}.`,
      link: "/betriebsrat",
    });

    createAuditLog({
      action: "CREATE",
      entityType: "ShiftPlanApproval",
      entityId: approval.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { title, periodStart, periodEnd, locationId, shiftCount },
    });

    return NextResponse.json(approval, { status: 201 });
  },
  { idempotent: true },
);
