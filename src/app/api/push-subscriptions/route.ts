import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createPushSubscriptionSchema,
  deletePushSubscriptionSchema,
  validateBody,
} from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

export const POST = withRoute(
  "/api/push-subscriptions",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

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

    createAuditLog({
      action: "CREATE",
      entityType: "PushSubscription",
      entityId: sub.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json(sub, { status: 201 });
  },
  { idempotent: true },
);

export const DELETE = withRoute(
  "/api/push-subscriptions",
  "DELETE",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const parsed = validateBody(deletePushSubscriptionSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { endpoint } = parsed.data;

    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "PushSubscription",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  },
);
