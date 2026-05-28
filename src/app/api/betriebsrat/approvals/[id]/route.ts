import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isManagement } from "@/lib/authorization";
import { decideApprovalSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import {
  requireAuth,
  parseJsonBody,
  notFound,
  forbidden,
  badRequest,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { isBetriebsratMember, notifyUser } from "@/lib/betriebsrat";

/**
 * GET /api/betriebsrat/approvals/[id]
 * Approval detail plus the (read-only) shifts in its period/location scope,
 * so a council member can review the schedule before deciding.
 */
export const GET = withRoute(
  "/api/betriebsrat/approvals/[id]",
  "GET",
  async (_req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const member = await isBetriebsratMember(user.id, workspaceId);
    if (!member && !isManagement(user)) {
      return forbidden("Kein Zugriff auf den Betriebsrat-Bereich");
    }

    const approval = await prisma.shiftPlanApproval.findFirst({
      where: { id, workspaceId },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    if (!approval) return notFound("Vorlage nicht gefunden");

    const shifts = await prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: approval.periodStart, lte: approval.periodEnd },
        deletedAt: null,
        ...(approval.locationId ? { locationId: approval.locationId } : {}),
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        breakMinutes: true,
        status: true,
        employee: { select: { firstName: true, lastName: true } },
        location: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ approval, shifts, canReview: member });
  },
);

/**
 * PATCH /api/betriebsrat/approvals/[id]
 * Record the works-council decision (Zustimmung / Verweigerung). Members only.
 * Body: { decision: "APPROVED" | "REJECTED", note? }
 */
export const PATCH = withRoute(
  "/api/betriebsrat/approvals/[id]",
  "PATCH",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    if (!(await isBetriebsratMember(user.id, workspaceId))) {
      return forbidden(
        "Nur Betriebsratsmitglieder können über Dienstpläne entscheiden",
      );
    }

    const approval = await prisma.shiftPlanApproval.findFirst({
      where: { id, workspaceId },
      select: { id: true, status: true, title: true, submittedById: true },
    });
    if (!approval) return notFound("Vorlage nicht gefunden");
    if (approval.status !== "PENDING") {
      return badRequest("Über diese Vorlage wurde bereits entschieden");
    }

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(decideApprovalSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { decision, note } = parsed.data;

    if (decision === "REJECTED" && !note) {
      return badRequest(
        "Bei einer Zustimmungsverweigerung ist eine Begründung erforderlich",
      );
    }

    const updated = await prisma.shiftPlanApproval.update({
      where: { id },
      data: {
        status: decision,
        decisionNote: note || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    await notifyUser(approval.submittedById, workspaceId, {
      type: "BETRIEBSRAT_APPROVAL_DECIDED",
      title:
        decision === "APPROVED"
          ? "Betriebsrat: Dienstplan zugestimmt"
          : "Betriebsrat: Zustimmung verweigert",
      message:
        decision === "APPROVED"
          ? `Der Betriebsrat hat „${approval.title}“ zugestimmt.`
          : `Der Betriebsrat hat die Zustimmung zu „${approval.title}“ verweigert.`,
      link: "/betriebsrat",
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "ShiftPlanApproval",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { decision, note },
    });

    return NextResponse.json(updated);
  },
  { idempotent: true },
);

/**
 * DELETE /api/betriebsrat/approvals/[id]
 * Withdraw a pending submission. Submitter or management only.
 */
export const DELETE = withRoute(
  "/api/betriebsrat/approvals/[id]",
  "DELETE",
  async (_req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const approval = await prisma.shiftPlanApproval.findFirst({
      where: { id, workspaceId },
      select: { id: true, status: true, submittedById: true },
    });
    if (!approval) return notFound("Vorlage nicht gefunden");

    if (!isManagement(user) && approval.submittedById !== user.id) {
      return forbidden("Keine Berechtigung, diese Vorlage zurückzuziehen");
    }
    if (approval.status !== "PENDING") {
      return badRequest("Nur ausstehende Vorlagen können zurückgezogen werden");
    }

    const updated = await prisma.shiftPlanApproval.update({
      where: { id },
      data: { status: "WITHDRAWN" },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "ShiftPlanApproval",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { status: "WITHDRAWN" },
    });

    return NextResponse.json(updated);
  },
);
