import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { sendPushNotification } from "./push";

/**
 * Dispatch an email + push notification for a user.
 *
 * Logic:
 * - If user has an EMAIL preference set to true -> send email
 * - If user has NO preferences at all -> send (default on)
 * - If user explicitly disabled EMAIL -> skip email
 * - Push is always attempted if subscriptions exist
 */
export async function dispatchExternalNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}) {
  const { userId, type, title, message, link } = params;

  console.log(`[dispatcher] userId=${userId}, type=${type}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      notificationPreferences: {
        select: { channel: true, enabled: true },
      },
    },
  });

  if (!user) {
    console.warn(`[dispatcher] User ${userId} not found`);
    return;
  }

  // --- Email ---
  const emailPref = user.notificationPreferences.find(
    (p) => p.channel === "EMAIL",
  );
  const emailEnabled = emailPref ? emailPref.enabled : true;

  if (emailEnabled && user.email) {
    console.log(`[dispatcher] Sending email to ${user.email}`);
    try {
      const result = await sendEmail({
        to: user.email,
        type,
        title,
        message,
        link,
        locale: "de",
      });
      if (result.success) {
        console.log(`[dispatcher] Email sent to ${user.email}`);
      } else {
        console.error(
          `[dispatcher] Email failed for ${user.email}: ${result.error}`,
        );
      }
    } catch (err) {
      console.error(`[dispatcher] Email failed for ${user.email}:`, err);
    }
  }

  // --- Push ---
  const pushPref = user.notificationPreferences.find(
    (p) => p.channel === "PUSH",
  );
  const pushEnabled = pushPref ? pushPref.enabled : true;

  if (pushEnabled) {
    try {
      await sendPushNotification({
        userId,
        title,
        body: message,
        url: link || undefined,
        tag: type,
      });
    } catch (err) {
      console.error(`[dispatcher] Push failed for userId=${userId}:`, err);
    }
  }
}
