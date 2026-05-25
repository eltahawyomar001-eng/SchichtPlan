import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { passwordResetEmail } from "@/lib/notifications/email-i18n";
import { forgotPasswordSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { getLocaleFromCookie } from "@/i18n/locale";
import { log } from "@/lib/logger";

export const POST = withRoute(
  "/api/auth/forgot-password",
  "POST",
  async (req) => {
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(forgotPasswordSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { email } = parsed.data;

    // Always return success to prevent email enumeration.
    // NOTE: if no User row exists for this email (e.g. employee who never
    // accepted their invitation), the block below is skipped and nothing is
    // sent — this is intentional. Admins should use "Einladung erneut senden"
    // for employees who haven't registered yet.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      log.info(
        "[forgot-password] No User account for email — skipping reset (employee may not have registered yet)",
      );
    }

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
      // NEXTAUTH_URL is localhost in dev; fall back to VERCEL_URL in production
      // to ensure the link in the email always points to the live domain.
      const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
      const safeBase =
        base && !base.startsWith("http://localhost")
          ? base
          : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : base || "http://localhost:3000";
      const resetUrl = `${safeBase}/passwort-zuruecksetzen?token=${token}`;
      const locale = await getLocaleFromCookie();
      const copy = passwordResetEmail(locale);

      await sendEmail({
        to: email,
        type: "password-reset",
        category: "transactional",
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
