import { Resend } from "resend";
import { buildEmailHtml } from "./templates";

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
  process.env.RESEND_FROM_EMAIL || "SchichtPlan <onboarding@resend.dev>";

/**
 * Send a notification email via Resend.
 */
export async function sendEmail(params: {
  to: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  locale?: string;
}) {
  const { to, type, title, message, link, locale = "de" } = params;

  const client = getResend();
  if (!client) {
    console.warn("[notifications/email] RESEND_API_KEY not set — skipping");
    return;
  }

  try {
    const html = buildEmailHtml({ type, title, message, link, locale });

    await client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: title,
      html,
    });
  } catch (err) {
    console.error("[notifications/email] Failed to send:", err);
  }
}
