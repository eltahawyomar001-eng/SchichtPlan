import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  createPushSubscriptionSchema,
  deletePushSubscriptionSchema,
  validateBody,
} from "@/lib/validations";
import { log } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const parsed = validateBody(createPushSubscriptionSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { endpoint, keys } = parsed.data;

    const sub = await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId: user.id, endpoint },
      },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (error) {
    log.error("Error saving push subscription:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const parsed = validateBody(deletePushSubscriptionSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { endpoint } = parsed.data;

    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error removing push subscription:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
