import { prisma } from "@/lib/db";
import { sendEmail } from "./email";
import { sendWhatsApp } from "./whatsapp";

/**
 * Dispatch a notification to all enabled external channels for a user.
 *
 * Call this AFTER the in-app notification row has been created.
 * It checks the user's NotificationPreference rows and sends
 * via email and/or WhatsApp accordingly.
 *
 * When no preferences exist yet, email is sent by default.
 */
export async function dispatchExternalNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}) {
  const { userId, type, title, message, link } = params;

  // Fetch user + preferences in one query
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      notificationPreferences: {
        select: { channel: true, enabled: true },
      },
    },
  });

  if (!user) return;

  // Build a quick lookup
  const prefs = new Map(
    user.notificationPreferences.map((p) => [p.channel, p.enabled]),
  );

  // If the user hasn't configured any preferences yet, default to email ON
  const hasAnyPrefs = user.notificationPreferences.length > 0;
  const emailEnabled = hasAnyPrefs ? (prefs.get("EMAIL") ?? false) : true;
  const whatsappEnabled = prefs.get("WHATSAPP") ?? false;

  const locale = "de";

  const promises: Promise<void>[] = [];

  // ── Email ──────────────────────────────────────────────────
  if (emailEnabled && user.email) {
    promises.push(
      sendEmail({ to: user.email, type, title, message, link, locale }),
    );
  }

  // ── WhatsApp ───────────────────────────────────────────────
  if (whatsappEnabled && user.phone) {
    promises.push(
      sendWhatsApp({
        to: user.phone,
        title,
        message,
        link,
      }),
    );
  }

  // Fire all channels in parallel — don't let one failure block others
  await Promise.allSettled(promises);
}
