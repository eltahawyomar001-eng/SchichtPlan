import { Resend } from "resend";
import { buildEmailHtml, buildPlainText } from "./templates";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/db";

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

export interface EmailParams {
  to: string;
  type: string;
  category: EmailCategory;
  title: string;
  message: string;
  link?: string | null;
  locale?: string;
}

/** Attempt a single delivery via Resend. Returns null on success, error string on failure. */
async function attemptSend(params: EmailParams): Promise<string | null> {
  const { to, type, category, title, message, link, locale = "de" } = params;
  const client = getResend();
  if (!client) return "RESEND_API_KEY not configured";

  try {
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
      return `Resend error: ${result.error.message || JSON.stringify(result.error)}`;
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Send a notification email via Resend with in-process retry (3 attempts,
 * exponential back-off). On final failure the job is persisted to EmailJob
 * so the /api/cron/retry-emails cron can attempt delivery again later.
 */
export async function sendEmail(
  params: EmailParams,
): Promise<{ success: boolean; error?: string }> {
  const { to, type } = params;
  const MAX_IN_PROCESS = 3;
  let lastError: string | null = null;

  log.info(`[notifications/email] Sending to=${to} type=${type}`);

  for (let attempt = 1; attempt <= MAX_IN_PROCESS; attempt++) {
    const err = await attemptSend(params);
    if (!err) {
      log.info(
        `[notifications/email] Sent to=${to} type=${type} attempt=${attempt}`,
      );
      return { success: true };
    }
    lastError = err;
    log.warn(
      `[notifications/email] Attempt ${attempt}/${MAX_IN_PROCESS} failed to=${to}: ${err}`,
    );
    if (attempt < MAX_IN_PROCESS) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
  }

  // All in-process attempts failed — persist to DB queue for cron retry
  log.error(
    `[notifications/email] All ${MAX_IN_PROCESS} attempts failed to=${to} — queuing for cron retry`,
  );
  try {
    const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // retry in 5 min
    await prisma.emailJob.create({
      data: {
        to: params.to,
        type: params.type,
        category: params.category,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
        locale: params.locale ?? "de",
        status: "PENDING",
        attempts: MAX_IN_PROCESS,
        lastAttempt: new Date(),
        errorMessage: lastError,
        nextRetryAt,
      },
    });
  } catch (dbErr) {
    log.error("[notifications/email] Failed to persist EmailJob", {
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  return { success: false, error: lastError ?? "Unknown error" };
}
