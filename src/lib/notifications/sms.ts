import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;
    client = twilio(sid, token);
  }
  return client;
}

/**
 * Send a notification via SMS using Twilio.
 */
export async function sendSMS(params: {
  to: string; // E.164 format, e.g. "+491701234567"
  title: string;
  message: string;
  link?: string | null;
}) {
  const { to, title, message, link } = params;
  const tw = getClient();

  if (!tw) {
    console.warn("[notifications/sms] Twilio not configured — skipping");
    return;
  }

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    console.warn("[notifications/sms] TWILIO_PHONE_NUMBER not set — skipping");
    return;
  }

  try {
    const body = link
      ? `${title}\n\n${message}\n\n${process.env.NEXTAUTH_URL || "https://app.schichtplan.de"}${link}`
      : `${title}\n\n${message}`;

    await tw.messages.create({ body, from, to });
  } catch (err) {
    console.error("[notifications/sms] Failed to send:", err);
  }
}
