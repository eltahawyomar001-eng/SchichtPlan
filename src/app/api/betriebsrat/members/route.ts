import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, isManagement } from "@/lib/authorization";
import { addBetriebsratMemberSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import {
  requireAuth,
  parseJsonBody,
  badRequest,
  forbidden,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { isBetriebsratMember } from "@/lib/betriebsrat";

/**
 * GET /api/betriebsrat/members
 * List the works-council members. Visible to management and to members.
 */
export const GET = withRoute("/api/betriebsrat/members", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const allowed =
    isManagement(user) || (await isBetriebsratMember(user.id, workspaceId));
  if (!allowed) return forbidden("Kein Zugriff auf den Betriebsrat-Bereich");

  const members = await prisma.betriebsratMember.findMany({
    where: { workspaceId },
    select: {
      id: true,
      isChair: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
});

/**
 * POST /api/betriebsrat/members
 * Designate a workspace user as a works-council member. OWNER/ADMIN only.
 * Body: { userId, isChair? }
 */
export const POST = withRoute(
  "/api/betriebsrat/members",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(addBetriebsratMemberSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { userId, isChair } = parsed.data;

    // The designated member must belong to this workspace.
    const target = await prisma.user.findFirst({
      where: { id: userId, workspaceId },
      select: { id: true },
    });
    if (!target) return badRequest("Benutzer gehört nicht zu diesem Workspace");

    const existing = await prisma.betriebsratMember.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing)
      return badRequest("Benutzer ist bereits Betriebsratsmitglied");

    const member = await prisma.betriebsratMember.create({
      data: { workspaceId, userId, isChair },
      select: {
        id: true,
        isChair: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "BetriebsratMember",
      entityId: member.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { userId, isChair },
    });

    return NextResponse.json(member, { status: 201 });
  },
  { idempotent: true },
);
