import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

// ─── GET  /api/notifications ────────────────────────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── PATCH  /api/notifications  (mark as read) ─────────────────
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await req.json();

    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    } else if (body.id) {
      await prisma.notification.updateMany({
        where: { id: body.id, userId: user.id },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}
