import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { passwordResetEmail } from "@/lib/notifications/email-i18n";
import { forgotPasswordSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { getLocaleFromCookie } from "@/i18n/locale";

export const POST = withRoute(
  "/api/auth/forgot-password",
  "POST",
  async (req) => {
    const parsed = validateBody(forgotPasswordSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { email } = parsed.data;

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Delete any existing reset tokens for this email
      await prisma.passwordResetToken.deleteMany({
        where: { email },
      });

      // Create a new reset token (valid for 1 hour)
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { token, email, expires },
      });

      // Send reset email
      const resetUrl = `${process.env.NEXTAUTH_URL}/passwort-zuruecksetzen?token=${token}`;
      const locale = await getLocaleFromCookie();
      const copy = passwordResetEmail(locale);

      await sendEmail({
        to: email,
        type: "password-reset",
        title: copy.subject,
        message: copy.body,
        link: resetUrl,
        locale,
      });
    }

    // Always return success (prevents email enumeration)
    const locale2 = await getLocaleFromCookie();
    return NextResponse.json({
      message:
        locale2 === "en"
          ? "If an account with this email exists, a reset link has been sent."
          : "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet.",
    });
  },
);
