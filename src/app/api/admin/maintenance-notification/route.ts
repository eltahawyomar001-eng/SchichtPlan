import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOwner } from "@/lib/authorization";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { withRoute } from "@/lib/with-route";
import { requireAuth, forbidden, badRequest } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

/**
 * POST /api/admin/maintenance-notification
 *
 * OWNER-only endpoint to announce planned maintenance.
 * Creates a notification for every user in the caller's workspace.
 *
 * Body: {
 *   scheduledAt: ISO string,
 *   durationMinutes: number,
 *   description: string
 * }
 */
export const POST = withRoute(
  "/api/admin/maintenance-notification",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    if (!isOwner(user)) return forbidden();

    const body = await req.json();
    const { scheduledAt, durationMinutes, description } = body as {
      scheduledAt?: string;
      durationMinutes?: number;
      description?: string;
    };

    if (!scheduledAt || !durationMinutes || !description) {
      return badRequest(
        "scheduledAt, durationMinutes, and description are required",
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return badRequest("scheduledAt must be a valid ISO date");
    }

    // Get all users in the workspace
    const users = await prisma.user.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    const dateStr = scheduledDate.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create a notification for each user
    const notifications = await prisma.notification.createMany({
      data: users.map((u) => ({
        type: "MAINTENANCE",
        title: `Geplante Wartung am ${dateStr}`,
        message: `${description}\n\nVoraussichtliche Dauer: ${durationMinutes} Minuten.`,
        userId: u.id,
        workspaceId,
      })),
    });

    log.info("[maintenance-notification] Notifications created", {
      workspaceId,
      count: notifications.count,
      scheduledAt,
      durationMinutes,
    });

    createAuditLog({
      action: "CREATE",
      entityType: "MaintenanceNotification",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: {
        scheduledAt,
        durationMinutes,
        description,
        notified: notifications.count,
      },
    });

    return NextResponse.json({
      success: true,
      notified: notifications.count,
      scheduledAt,
      durationMinutes,
    });
  },
  { idempotent: true },
);
