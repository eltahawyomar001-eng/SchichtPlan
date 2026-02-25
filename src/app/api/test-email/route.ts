import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { sendEmail } from "@/lib/notifications";
import { log } from "@/lib/logger";

/**
 * POST /api/test-email
 * Send a test email to verify Resend is working.
 * Only accessible to OWNER / ADMIN. Blocked in production.
 */
export async function POST(req: Request) {
  try {
    // Debug tool — block in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 404 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const forbidden = requireAdmin(user);
    if (forbidden) return forbidden;

    const body = await req.json();
    const to = body.to || user.email;

    if (!to) {
      return NextResponse.json(
        { error: "Keine E-Mail-Adresse angegeben" },
        { status: 400 },
      );
    }

    log.info(`[test-email] Sending test email to ${to}`);

    const result = await sendEmail({
      to,
      type: "TEST",
      title: "Shiftfy — Test E-Mail",
      message:
        "Diese E-Mail bestätigt, dass Ihre E-Mail-Benachrichtigungen korrekt funktionieren. Sie können diese Nachricht ignorieren.",
      link: "/dashboard",
      locale: "de",
    });

    log.info(`[test-email] Result: ${JSON.stringify(result)}`);

    if (result.success) {
      return NextResponse.json({ success: true, to });
    } else {
      return NextResponse.json(
        { success: false, error: result.error, to },
        { status: 500 },
      );
    }
  } catch (error) {
    log.error("[test-email] Error:", { error: error });
    return NextResponse.json(
      { error: "Error sending test email" },
      { status: 500 },
    );
  }
}
