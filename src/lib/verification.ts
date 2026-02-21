import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications";

const VERIFICATION_EXPIRY_HOURS = 24;

/**
 * Generate a cryptographically secure token, store it in the
 * VerificationToken table, and send a branded verification email.
 */
export async function sendVerificationEmail(
  email: string,
  locale: string = "de",
) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(
    Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  // Remove any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Create new token
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL || "https://schichtplan-wine.vercel.app";
  const verifyUrl = `${baseUrl}/verifizierung?token=${token}&email=${encodeURIComponent(email)}`;

  const isDE = locale === "de";

  await sendEmail({
    to: email,
    type: "email-verification",
    title: isDE
      ? "Bestätigen Sie Ihre E-Mail-Adresse"
      : "Verify your email address",
    message: isDE
      ? `Bitte klicken Sie auf den folgenden Link, um Ihre E-Mail-Adresse zu bestätigen. Der Link ist ${VERIFICATION_EXPIRY_HOURS} Stunden gültig.`
      : `Please click the link below to verify your email address. The link is valid for ${VERIFICATION_EXPIRY_HOURS} hours.`,
    link: verifyUrl,
    locale,
  });

  return { success: true };
}

/**
 * Verify a token. Returns the email if valid, null if expired or not found.
 */
export async function verifyEmailToken(
  token: string,
  email: string,
): Promise<{ valid: boolean; error?: string }> {
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: email, token },
  });

  if (!record) {
    return { valid: false, error: "INVALID_TOKEN" };
  }

  if (new Date() > record.expires) {
    // Clean up expired token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });
    return { valid: false, error: "TOKEN_EXPIRED" };
  }

  // Mark user as verified
  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // Clean up used token
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return { valid: true };
}
