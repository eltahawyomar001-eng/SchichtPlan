import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { transferOwnershipSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/team/transfer-ownership
 *
 * Transfers the OWNER role to another workspace member.
 * The current OWNER is demoted to ADMIN.
 *
 * Body: { targetUserId: string }
 */
export const POST = withRoute(
  "/api/team/transfer-ownership",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only the current OWNER can transfer ownership
    if (user.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = validateBody(transferOwnershipSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { targetUserId } = parsed.data;

    // Cannot transfer to yourself
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "CANNOT_TRANSFER_TO_SELF" },
        { status: 400 },
      );
    }

    // Verify target user is in the same workspace
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, workspaceId: true, name: true, email: true },
    });

    if (!targetUser || targetUser.workspaceId !== user.workspaceId) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 },
      );
    }

    // Atomic transaction: promote target → demote current owner
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // Promote target to OWNER
      await tx.user.update({
        where: { id: targetUserId },
        data: { role: "OWNER" },
      });

      // Demote current OWNER to ADMIN
      await tx.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
    });

    log.info(
      `[team/transfer-ownership] Ownership transferred from ${user.email} to ${targetUser.email} in workspace ${user.workspaceId}`,
    );

    createAuditLog({
      action: "UPDATE",
      entityType: "workspace",
      entityId: user.workspaceId,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId: user.workspaceId,
      changes: {
        ownershipTransfer: {
          from: { id: user.id, email: user.email },
          to: { id: targetUser.id, email: targetUser.email },
        },
      },
    });

    dispatchWebhook(user.workspaceId, "workspace.ownership_transferred", {
      from: user.id,
      to: targetUser.id,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      newOwner: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  },
  { idempotent: true },
);
