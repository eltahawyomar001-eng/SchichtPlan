import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { createAuditLog } from "@/lib/audit";
import { transferOwnershipSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

/**
 * POST /api/team/transfer-ownership
 *
 * Transfers the OWNER role to another workspace member.
 * The current OWNER is demoted to ADMIN.
 *
 * Body: { targetUserId: string }
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

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

    return NextResponse.json({
      success: true,
      newOwner: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (error) {
    log.error("[team/transfer-ownership] Error:", { error });
    return NextResponse.json(
      { error: "Fehler bei der Übertragung." },
      { status: 500 },
    );
  }
}
