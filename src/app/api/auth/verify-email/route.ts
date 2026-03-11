import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/verification";
import { verifyEmailSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

/**
 * POST /api/auth/verify-email
 *
 * Verifies a user's email address using the token sent via email.
 * Body: { token: string, email: string }
 */
export async function POST(req: Request) {
  try {
    const parsed = validateBody(verifyEmailSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { token, email } = parsed.data;

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
    log.error("Email verification error:", { error: error });
    return NextResponse.json(
      { error: "Verifizierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
