import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireManagement } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * PATCH /api/manager-alerts/[id]
 *
 * Acknowledge a manager alert.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requireManagement(user);
    if (forbidden) return forbidden;

    const body = await req.json();

    // Verify alert belongs to workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alert = await (prisma as any).managerAlert.findFirst({
      where: { id, workspaceId },
    });

    if (!alert) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update acknowledged status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).managerAlert.update({
      where: { id },
      data: {
        acknowledged:
          body.acknowledged !== undefined ? body.acknowledged : true,
        acknowledgedAt: body.acknowledged !== false ? new Date() : null,
        acknowledgedBy: body.acknowledged !== false ? user.id : null,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "manager-alert",
      entityId: id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId,
      changes: { acknowledged: updated.acknowledged },
    });

    log.info("[manager-alerts/PATCH] Alert acknowledged", {
      alertId: id,
      userId: user.id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    log.error("Error updating manager alert:", { error });
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

/**
 * DELETE /api/manager-alerts/[id]
 *
 * Delete a manager alert.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requireManagement(user);
    if (forbidden) return forbidden;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).managerAlert.deleteMany({
      where: { id, workspaceId },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "manager-alert",
      entityId: id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId,
    });

    return NextResponse.json({ message: "Alert deleted" });
  } catch (error) {
    log.error("Error deleting manager alert:", { error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
