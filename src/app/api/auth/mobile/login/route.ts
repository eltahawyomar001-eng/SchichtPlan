/**
 * POST /api/auth/mobile/login
 *
 * Mobile-Login-Endpunkt — Gibt JWT + Refresh-Token + Benutzerprofil zurück.
 * Repliziert die CredentialsProvider-Logik aus auth.ts für native iOS/Android-Apps.
 *
 * Sicherheitsmaßnahmen:
 * - Brute-force-Schutz (Lockout nach wiederholten Fehlversuchen)
 * - Optionale 2FA-Validierung (TOTP + Recovery-Codes)
 * - E-Mail-Verifizierung erforderlich
 * - JWT mit HMAC-SHA256 signiert
 */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import * as OTPAuth from "otpauth";
import { prisma } from "@/lib/db";
import { decrypt, isEncrypted } from "@/lib/encryption";
import {
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
} from "@/lib/login-lockout";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { mobileLoginSchema, validateBody } from "@/lib/validations";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-change-me",
);
const ACCESS_TOKEN_TTL = "24h";
const REFRESH_TOKEN_TTL = "30d";

/** Compare a plain-text recovery code against an array of bcrypt hashes. */
async function findMatchingRecoveryCode(
  plainCode: string,
  hashedCodes: string[],
): Promise<number | null> {
  const normalized = plainCode.replace(/[\s-]/g, "").toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) return i;
  }
  return null;
}

export const POST = withRoute("/api/auth/mobile/login", "POST", async (req) => {
  const body = await req.json();
  const parsed = validateBody(mobileLoginSchema, body);
  if (!parsed.success) return parsed.response;
  const { email, password, totpCode } = parsed.data;

  const normalizedEmail = email.toLowerCase().trim();

  // ── Brute-force lockout (DSGVO Art. 32) ──
  const lockedSeconds = await isLockedOut(normalizedEmail);
  if (lockedSeconds > 0) {
    return NextResponse.json(
      {
        error: `Zu viele Fehlversuche. Bitte warte ${Math.ceil(lockedSeconds / 60)} Minute(n).`,
      },
      { status: 429 },
    );
  }

  // ── Benutzer laden ──
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      workspace: true,
      employee: { select: { id: true } },
    },
  });

  if (!user || !user.hashedPassword) {
    await recordFailedAttempt(normalizedEmail);
    return NextResponse.json(
      { error: "E-Mail oder Passwort ungültig." },
      { status: 401 },
    );
  }

  // ── Passwort prüfen ──
  const isValid = await bcrypt.compare(password, user.hashedPassword);
  if (!isValid) {
    await recordFailedAttempt(normalizedEmail);
    return NextResponse.json(
      { error: "E-Mail oder Passwort ungültig." },
      { status: 401 },
    );
  }

  // ── E-Mail-Verifizierung ──
  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error: "E-Mail-Adresse nicht verifiziert. Bitte prüfe dein Postfach.",
      },
      { status: 403 },
    );
  }

  // ── 2FA-Prüfung (falls aktiviert) ──
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpCode) {
      return NextResponse.json(
        { error: "2FA_REQUIRED", requires2FA: true },
        { status: 403 },
      );
    }

    const rawSecret = user.twoFactorSecret;
    const hexSecret = isEncrypted(rawSecret) ? decrypt(rawSecret) : rawSecret;
    const secret = OTPAuth.Secret.fromHex(hexSecret);
    const totp = new OTPAuth.TOTP({
      issuer: "Shiftfy",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const delta = totp.validate({ token: totpCode, window: 2 });

    if (delta === null) {
      // TOTP fehlgeschlagen → Recovery-Code probieren
      const recoveryCodes = user.twoFactorRecoveryCodes;
      if (recoveryCodes) {
        const codes: string[] = JSON.parse(recoveryCodes);
        const matchIdx = await findMatchingRecoveryCode(totpCode, codes);
        if (matchIdx !== null) {
          codes.splice(matchIdx, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorRecoveryCodes: JSON.stringify(codes) },
          });
        } else {
          return NextResponse.json(
            { error: "Ungültiger 2FA-Code." },
            { status: 401 },
          );
        }
      } else {
        return NextResponse.json(
          { error: "Ungültiger 2FA-Code." },
          { status: 401 },
        );
      }
    }
  }

  // ── Erfolg → Lockout zurücksetzen ──
  await clearFailedAttempts(normalizedEmail);

  // ── JWT-Token generieren ──
  const tokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
    workspaceName: user.workspace?.name || null,
    employeeId: user.employee?.id || null,
    type: "access" as const,
  };

  const accessToken = await new jose.SignJWT(tokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET);

  const refreshToken = await new jose.SignJWT({
    sub: user.id,
    type: "refresh" as const,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(JWT_SECRET);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  log.info("Mobile login successful", {
    userId: user.id,
    email: user.email,
  });

  return NextResponse.json({
    token: accessToken,
    refreshToken,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspaceId,
      workspaceName: user.workspace?.name || null,
      employeeId: user.employee?.id || null,
      onboardingCompleted:
        (user.workspace as unknown as { onboardingCompleted?: boolean })
          ?.onboardingCompleted ?? false,
    },
  });
});
