import webpush from "web-push";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@shiftfy.de";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Send a push notification to all subscribed devices of a user.
 * Returns an object indicating success or why it was skipped.
 */
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
  if (!ensureVapidConfigured()) {
    log.warn("[push] VAPID keys not configured — push notifications disabled");
    return {
      success: false,
      skipped: true,
      reason: "VAPID_NOT_CONFIGURED",
    };
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: params.userId },
    });

    if (subscriptions.length === 0)
      return { success: true, skipped: true, reason: "NO_SUBSCRIPTIONS" };

    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      url: params.url || "/dashboard",
      tag: params.tag || "shiftfy",
      icon: "/icon-192x192.png",
      badge: "/favicon-32x32.png",
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          // Remove expired/invalid subscriptions
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? (err as { statusCode: number }).statusCode
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }
          throw err;
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    log.info(
      `[push] Sent ${sent}/${subscriptions.length} for user ${params.userId}`,
    );
    return { success: sent > 0 };
  } catch (error) {
    log.error("[push] Error sending push notification:", { error: error });
    return { success: false, reason: "SEND_ERROR" };
  }
}
