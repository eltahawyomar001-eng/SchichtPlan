import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePagination } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { requireAuth, serverError } from "@/lib/api-response";

// ─── GET  /api/notifications ────────────────────────────────────
export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const { take, skip } = parsePagination(req);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.notification.count({ where: { userId: user.id } }),
      prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
    ]);

    return NextResponse.json({
      data: notifications,
      unreadCount,
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    log.error("Error fetching notifications:", { error: error });
    return serverError("Error loading");
  }
}

// ─── PATCH  /api/notifications  (mark as read) ─────────────────
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const body = await req.json();

    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    } else if (body.notificationId || body.id) {
      const notifId = body.notificationId || body.id;
      await prisma.notification.updateMany({
        where: { id: notifId, userId: user.id },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error updating notifications:", { error: error });
    return serverError("Error updating");
  }
}
