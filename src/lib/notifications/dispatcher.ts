import { prisma } from "@/lib/db";
import { sendEmail } from "./email";

/**
 * Dispatch an email notification for a user.
 *
 * Logic:
 * - If user has an EMAIL preference set to true -> send
 * - If user has NO preferences at all -> send (default on)
 * - If user explicitly disabled EMAIL -> skip
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
        where: { channel: "EMAIL" },
        select: { enabled: true },
      },
    },
  });

  if (!user) {
    console.warn(`[dispatcher] User ${userId} not found`);
    return;
  }

  // Default to ON when no preference row exists
  const emailPref = user.notificationPreferences[0];
  const emailEnabled = emailPref ? emailPref.enabled : true;

  if (!emailEnabled) {
    console.log(`[dispatcher] Email disabled for ${user.email}`);
    return;
  }

  if (!user.email) {
    console.warn(`[dispatcher] User ${userId} has no email`);
    return;
  }

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
