import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireManagement } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { updateManagerAlertSchema, validateBody } from "@/lib/validations";

/**
 * PATCH /api/manager-alerts/[id]
 *
 * Acknowledge a manager alert.
 */
export const PATCH = withRoute(
  "/api/manager-alerts/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requireManagement(user);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(updateManagerAlertSchema, body);
    if (!parsed.success) return parsed.response;

    // Verify alert belongs to workspace
    const alert = await prisma.managerAlert.findFirst({
      where: { id, workspaceId },
    });

    if (!alert) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update acknowledged status
    const updated = await prisma.managerAlert.update({
      where: { id },
      data: {
        acknowledged:
          parsed.data.acknowledged !== undefined
            ? parsed.data.acknowledged
            : true,
        acknowledgedAt: parsed.data.acknowledged !== false ? new Date() : null,
        acknowledgedBy: parsed.data.acknowledged !== false ? user.id : null,
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
  },
);

/**
 * DELETE /api/manager-alerts/[id]
 *
 * Delete a manager alert.
 */
export const DELETE = withRoute(
  "/api/manager-alerts/[id]",
  "DELETE",
  async (req, context) => {
    const params = await context!.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requireManagement(user);
    if (forbidden) return forbidden;

    await prisma.managerAlert.deleteMany({
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
  },
);
