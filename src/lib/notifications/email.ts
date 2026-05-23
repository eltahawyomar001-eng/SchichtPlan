import { Resend } from "resend";
import { buildEmailHtml, buildPlainText } from "./templates";
import { log } from "@/lib/logger";

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    resend = new Resend(key);
  }
  return resend;
}

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || "Shiftfy <onboarding@resend.dev>";

/**
 * Email category — controls suppression rules and Resend tagging.
 *
 * transactional: triggered by a specific user action (ticket assigned,
 *   password reset, invitation, payment event, PIN, etc.).
 *   Legal basis under DSGVO Art. 6(1)(b)/(f): contractual necessity or
 *   legitimate interest. Cannot be opted-out of by the recipient.
 *
 * marketing: unsolicited, platform-initiated (upgrade nudges, newsletters).
 *   Requires explicit consent (DSGVO Art. 6(1)(a) / UWG §7).
 *   Respects user opt-out preferences.
 */
export type EmailCategory = "transactional" | "marketing";

/**
 * Send a notification email via Resend.
 */
export async function sendEmail(params: {
  to: string;
  type: string;
  category: EmailCategory;
  title: string;
  message: string;
  link?: string | null;
  locale?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, type, category, title, message, link, locale = "de" } = params;

  const client = getResend();
  if (!client) {
    log.warn("[notifications/email] RESEND_API_KEY not set — skipping");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    log.info(
      `[notifications/email] Sending to=${to}, from=${FROM_ADDRESS}, subject="${title}"`,
    );
    const html = buildEmailHtml({ type, title, message, link, locale });
    const text = buildPlainText({ title, message, link, locale });

    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: title,
      html,
      text,
      tags: [{ name: "category", value: category }],
    });

    if (result.error) {
      log.error(
        `[notifications/email] Resend API error: ${JSON.stringify(result.error)}`,
      );
      return {
        success: false,
        error: `Resend error: ${result.error.message || JSON.stringify(result.error)}`,
      };
    }

    log.info(`[notifications/email] Sent successfully: id=${result.data?.id}`);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    log.error(`[notifications/email] Failed to send: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
