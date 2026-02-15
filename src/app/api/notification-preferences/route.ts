import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { NotificationChannel } from "@prisma/client";

const CHANNELS: NotificationChannel[] = ["EMAIL", "WHATSAPP"];

// ─── GET  /api/notification-preferences ─────────────────────────
// Returns the user's channel preferences + phone number.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      phone: true,
      notificationPreferences: {
        select: { channel: true, enabled: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Build a merged object with defaults (all false)
  const prefs: Record<string, boolean> = {};
  for (const ch of CHANNELS) {
    prefs[ch] = false;
  }
  for (const p of user.notificationPreferences) {
    prefs[p.channel] = p.enabled;
  }

  return NextResponse.json({
    phone: user.phone || "",
    preferences: prefs,
  });
}

// ─── PUT  /api/notification-preferences ─────────────────────────
// Update a single channel toggle or the phone number.
// Body: { channel: "EMAIL"|"WHATSAPP", enabled: boolean }
//   or  { phone: "+491701234567" }
export async function PUT(req: Request) {
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

  const body = await req.json();

  // ── Update phone number ──
  if (typeof body.phone === "string") {
    const phone = body.phone.trim() || null;
    await prisma.user.update({
      where: { id: user.id },
      data: { phone },
    });
  }

  // ── Update channel preference ──
  if (body.channel && CHANNELS.includes(body.channel)) {
    const channel = body.channel as NotificationChannel;
    const enabled = Boolean(body.enabled);

    await prisma.notificationPreference.upsert({
      where: {
        userId_channel: { userId: user.id, channel },
      },
      update: { enabled },
      create: { userId: user.id, channel, enabled },
    });
  }

  // Return updated state
  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      phone: true,
      notificationPreferences: {
        select: { channel: true, enabled: true },
      },
    },
  });

  const prefs: Record<string, boolean> = {};
  for (const ch of CHANNELS) {
    prefs[ch] = false;
  }
  for (const p of updated!.notificationPreferences) {
    prefs[p.channel] = p.enabled;
  }

  return NextResponse.json({
    phone: updated!.phone || "",
    preferences: prefs,
  });
}
