import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * DELETE /api/invitations/[id] — revoke a pending invitation
 */
export const DELETE = withRoute(
  "/api/invitations/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;

    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation || invitation.workspaceId !== user.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending invitations can be revoked" },
        { status: 400 },
      );
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "Invitation",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { email: invitation.email, status: "REVOKED" },
    });

    dispatchWebhook(workspaceId, "invitation.revoked", {
      id,
      email: invitation.email,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  },
);
