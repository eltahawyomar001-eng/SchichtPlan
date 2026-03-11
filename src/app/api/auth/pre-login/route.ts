import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
} from "@/lib/login-lockout";
import { preLoginSchema, validateBody } from "@/lib/validations";

/**
 * POST /api/auth/pre-login
 *
 * Validates email + password and returns whether 2FA is required,
 * without actually signing the user in. This avoids the NextAuth v4
 * limitation where custom error messages from authorize() are
 * swallowed and returned as generic "CredentialsSignin".
 *
 * Includes brute-force protection: after 5 failed attempts the
 * account is locked for 15 minutes (DSGVO Art. 32).
 */
export async function POST(req: Request) {
  try {
    const parsed = validateBody(preLoginSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { email, password } = parsed.data;

    // ── Brute-force lockout check ──
    const lockedSeconds = await isLockedOut(email);
    if (lockedSeconds > 0) {
      return NextResponse.json(
        {
          error: "ACCOUNT_LOCKED",
          lockedUntil: new Date(
            Date.now() + lockedSeconds * 1000,
          ).toISOString(),
        },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        hashedPassword: true,
        emailVerified: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.hashedPassword) {
      await recordFailedAttempt(email);
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      const nowLocked = await recordFailedAttempt(email);
      if (nowLocked) {
        return NextResponse.json(
          {
            error: "ACCOUNT_LOCKED",
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "EMAIL_NOT_VERIFIED" },
        { status: 403 },
      );
    }

    // Successful validation → clear any failed attempt counters
    await clearFailedAttempts(email);

    return NextResponse.json({
      requires2FA: user.twoFactorEnabled === true,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
