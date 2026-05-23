import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { sendPushNotification } from "./push";
import { log } from "@/lib/logger";

function pseudoEmail(email: string): string {
  return crypto.createHash("sha256").update(email).digest("hex").slice(0, 8);
}

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

  log.info(`[dispatcher] userId=${userId}, type=${type}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preferredLocale: true,
      notificationPreferences: {
        select: { channel: true, enabled: true },
      },
    },
  });

  if (!user) {
    log.warn(`[dispatcher] User ${userId} not found`);
    return;
  }

  // --- Email ---
  const emailPref = user.notificationPreferences.find(
    (p) => p.channel === "EMAIL",
  );
  const emailEnabled = emailPref ? emailPref.enabled : true;

  if (emailEnabled && user.email) {
    const locale = user.preferredLocale === "en" ? "en" : "de";
    log.info(`[dispatcher] Sending email`, {
      emailHash: pseudoEmail(user.email),
    });
    try {
      const result = await sendEmail({
        to: user.email,
        type,
        title,
        message,
        link,
        locale,
      });
      if (result.success) {
        log.info(`[dispatcher] Email sent`, {
          emailHash: pseudoEmail(user.email),
        });
      } else {
        log.error(`[dispatcher] Email failed`, {
          emailHash: pseudoEmail(user.email),
          error: result.error,
        });
      }
    } catch (err) {
      log.error(`[dispatcher] Email failed`, {
        emailHash: pseudoEmail(user.email),
        error: err,
      });
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
      log.error(`[dispatcher] Push failed for userId=${userId}`, {
        error: err,
      });
    }
  }
}
