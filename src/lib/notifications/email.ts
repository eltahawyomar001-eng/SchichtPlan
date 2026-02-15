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
}): Promise<{ success: boolean; error?: string }> {
  const { to, type, title, message, link, locale = "de" } = params;

  const client = getResend();
  if (!client) {
    console.warn("[notifications/email] RESEND_API_KEY not set — skipping");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    console.log(
      `[notifications/email] Sending to=${to}, from=${FROM_ADDRESS}, subject="${title}"`,
    );
    const html = buildEmailHtml({ type, title, message, link, locale });

    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: title,
      html,
    });

    if (result.error) {
      console.error(
        `[notifications/email] Resend API error: ${JSON.stringify(result.error)}`,
      );
      return {
        success: false,
        error: `Resend error: ${result.error.message || JSON.stringify(result.error)}`,
      };
    }

    console.log(
      `[notifications/email] Sent successfully: id=${result.data?.id}`,
    );
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`[notifications/email] Failed to send: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
