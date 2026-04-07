import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePagination } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { updateNotificationsSchema, validateBody } from "@/lib/validations";

// ─── GET  /api/notifications ────────────────────────────────────
export const GET = withRoute("/api/notifications", "GET", async (req) => {
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
});

// ─── PATCH  /api/notifications  (mark as read) ─────────────────
export const PATCH = withRoute("/api/notifications", "PATCH", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const body = await req.json();
  const parsed = validateBody(updateNotificationsSchema, body);
  if (!parsed.success) return parsed.response;

  if (parsed.data.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  } else if (parsed.data.notificationId || parsed.data.id) {
    const notifId = parsed.data.notificationId || parsed.data.id;
    await prisma.notification.updateMany({
      where: { id: notifId, userId: user.id },
      data: { read: true },
    });
  }

  return NextResponse.json({ success: true });
});
