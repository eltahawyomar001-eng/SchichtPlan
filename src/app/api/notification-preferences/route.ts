import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  updateNotificationPreferencesSchema,
  validateBody,
} from "@/lib/validations";
import { withRoute } from "@/lib/with-route";

// ─── GET  /api/notification-preferences ─────────────────────────
export const GET = withRoute(
  "/api/notification-preferences",
  "GET",
  async (req) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        notificationPreferences: {
          where: { channel: "EMAIL" },
          select: { enabled: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Default to true when no preference row exists
    const emailPref = user.notificationPreferences[0];
    const emailEnabled = emailPref ? emailPref.enabled : true;

    return NextResponse.json({ emailEnabled });
  },
);

// ─── PUT  /api/notification-preferences ─────────────────────────
// Body: { emailEnabled: boolean }
export const PUT = withRoute(
  "/api/notification-preferences",
  "PUT",
  async (req) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const parsed = validateBody(
      updateNotificationPreferencesSchema,
      await req.json(),
    );
    if (!parsed.success) return parsed.response;
    const enabled = parsed.data.emailEnabled;

    await prisma.notificationPreference.upsert({
      where: {
        userId_channel: { userId: user.id, channel: "EMAIL" },
      },
      update: { enabled },
      create: { userId: user.id, channel: "EMAIL", enabled },
    });

    return NextResponse.json({ emailEnabled: enabled });
  },
);
