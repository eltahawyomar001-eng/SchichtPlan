import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail ist erforderlich." },
        { status: 400 },
      );
    }

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

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "SchichtPlan <noreply@schichtplan.de>",
        to: email,
        subject: "Passwort zurücksetzen — SchichtPlan",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Passwort zurücksetzen</h2>
            <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
            <p>Klicken Sie auf den folgenden Link, um ein neues Passwort zu vergeben:</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Passwort zurücksetzen
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              Dieser Link ist 1 Stunde gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">SchichtPlan — Schichtplanung einfach gemacht</p>
          </div>
        `,
      });
    }

    // Always return success (prevents email enumeration)
    return NextResponse.json({
      message:
        "Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen gesendet.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 },
    );
  }
}
