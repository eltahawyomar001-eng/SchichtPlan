import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { sendEmail } from "@/lib/notifications";

/**
 * POST /api/test-email
 * Send a test email to verify Resend is working.
 * Only accessible to authenticated users.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const to = body.to || (session.user as SessionUser).email;

    if (!to) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse angegeben" },
        { status: 400 },
      );
    }

    console.log(`[test-email] Sending test email to ${to}`);

    const result = await sendEmail({
      to,
      type: "TEST",
      title: "SchichtPlan — Test E-Mail",
      message:
        "Diese E-Mail bestätigt, dass Ihre E-Mail-Benachrichtigungen korrekt funktionieren. Sie können diese Nachricht ignorieren.",
      link: "/dashboard",
      locale: "de",
    });

    console.log(`[test-email] Result: ${JSON.stringify(result)}`);

    if (result.success) {
      return NextResponse.json({ success: true, to });
    } else {
      return NextResponse.json(
        { success: false, error: result.error, to },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[test-email] Error:", error);
    return NextResponse.json(
      { error: "Error sending test email" },
      { status: 500 },
    );
  }
}
