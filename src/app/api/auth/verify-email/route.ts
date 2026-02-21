import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/verification";

/**
 * POST /api/auth/verify-email
 *
 * Verifies a user's email address using the token sent via email.
 * Body: { token: string, email: string }
 */
export async function POST(req: Request) {
  try {
    const { token, email } = await req.json();

    if (!token || !email) {
      return NextResponse.json(
        { error: "Token und E-Mail sind erforderlich." },
        { status: 400 },
      );
    }

    const result = await verifyEmailToken(token, email);

    if (!result.valid) {
      const messages: Record<string, string> = {
        INVALID_TOKEN: "Ungültiger oder bereits verwendeter Link.",
        TOKEN_EXPIRED:
          "Der Bestätigungslink ist abgelaufen. Bitte fordern Sie einen neuen an.",
      };
      return NextResponse.json(
        { error: messages[result.error!] || "Verifizierung fehlgeschlagen." },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "E-Mail erfolgreich bestätigt." });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Verifizierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
