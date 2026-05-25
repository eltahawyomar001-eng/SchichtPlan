import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/verification";
import { resendVerificationSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

/**
 * POST /api/auth/resend-verification
 *
 * Resends the verification email for unverified accounts.
 * Body: { email: string }
 */
export const POST = withRoute(
  "/api/auth/resend-verification",
  "POST",
  async (req) => {
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(resendVerificationSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const { email } = parsed.data;

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
  },
);
