import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth, notFound } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * DELETE /api/betriebsrat/members/[id]
 * Remove a works-council member. OWNER/ADMIN only.
 */
export const DELETE = withRoute(
  "/api/betriebsrat/members/[id]",
  "DELETE",
  async (_req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;

    const member = await prisma.betriebsratMember.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!member) return notFound("Mitglied nicht gefunden");

    await prisma.betriebsratMember.delete({ where: { id } });

    createAuditLog({
      action: "DELETE",
      entityType: "BetriebsratMember",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  },
);
