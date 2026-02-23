import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/verification";

/**
 * POST /api/auth/resend-verification
 *
 * Resends the verification email for unverified accounts.
 * Body: { email: string }
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail ist erforderlich." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    // Always return success to prevent email enumeration
    if (!user || user.emailVerified) {
      return NextResponse.json({
        message: "Falls ein Konto existiert, wurde eine E-Mail gesendet.",
      });
    }

    await sendVerificationEmail(email);

    return NextResponse.json({
      message: "Bestätigungs-E-Mail wurde erneut gesendet.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "E-Mail konnte nicht gesendet werden." },
      { status: 500 },
    );
  }
}
