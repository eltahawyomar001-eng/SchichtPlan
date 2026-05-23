import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, type EmailCategory } from "./email";
import { sendPushNotification } from "./push";
import { log } from "@/lib/logger";

// Notification types that are triggered by a specific user or system action
// and are expected by the recipient. These map to DSGVO Art. 6(1)(b)/(f)
// (contractual necessity / legitimate interest) and cannot be opted-out of.
// Everything not listed here is treated as marketing and respects user prefs.
const TRANSACTIONAL_TYPES = new Set([
  "TICKET_ASSIGNED",
  "TICKET_STATUS_CHANGED",
  "TICKET_COMMENT",
  "TICKET_CREATED",
  "invitation",
  "password-reset",
  "pin_assigned",
  "email-verification",
  "SOS_SHIFT",
  "AUTOMATION",
  "payment-failed",
  "SYSTEM",
]);

function pseudoEmail(email: string): string {
  return crypto.createHash("sha256").update(email).digest("hex").slice(0, 8);
}

/**
 * Dispatch an email + push notification for a user.
 *
 * Transactional types (see TRANSACTIONAL_TYPES): always sent — user opt-out
 * does not apply. Legal basis: DSGVO Art. 6(1)(b)/(f).
 *
 * Marketing types: respects the user's EMAIL notification preference.
 * Legal basis: DSGVO Art. 6(1)(a) / UWG §7.
 */
export async function dispatchExternalNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}) {
  const { userId, type, title, message, link } = params;

  const isTransactional = TRANSACTIONAL_TYPES.has(type);
  const category: EmailCategory = isTransactional
    ? "transactional"
    : "marketing";

  log.info(`[dispatcher] userId=${userId}, type=${type}, category=${category}`);

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
  // Transactional: always send — recipient cannot opt out of a ticket
  // assignment or password reset they triggered. Marketing: default on,
  // but respect an explicit opt-out (DSGVO Art. 21).
  const emailEnabled = isTransactional ? true : (emailPref?.enabled ?? true);

  if (emailEnabled && user.email) {
    const locale = user.preferredLocale === "en" ? "en" : "de";
    log.info(`[dispatcher] Sending email`, {
      emailHash: pseudoEmail(user.email),
      category,
    });
    try {
      const result = await sendEmail({
        to: user.email,
        type,
        category,
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
  } else if (!emailEnabled) {
    log.info(`[dispatcher] Email skipped — user opted out`, { category });
  }

  // --- Push ---
  const pushEnabled =
    user.notificationPreferences.find((p) => p.channel === "PUSH")?.enabled ??
    true;

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
