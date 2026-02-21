/* eslint-disable @typescript-eslint/no-explicit-any */
import webpush from "web-push";
import { prisma } from "@/lib/db";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@schichtplan.de";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Send a push notification to all subscribed devices of a user.
 */
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("[push] VAPID keys not configured, skipping push");
    return;
  }

  try {
    const subscriptions = await (prisma as any).pushSubscription.findMany({
      where: { userId: params.userId },
    });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      url: params.url || "/dashboard",
      tag: params.tag || "schichtplan",
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: any) {
          // Remove expired/invalid subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            await (prisma as any).pushSubscription.delete({
              where: { id: sub.id },
            });
          }
          throw err;
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    console.log(
      `[push] Sent ${sent}/${subscriptions.length} for user ${params.userId}`,
    );
  } catch (error) {
    console.error("[push] Error sending push notification:", error);
  }
}
