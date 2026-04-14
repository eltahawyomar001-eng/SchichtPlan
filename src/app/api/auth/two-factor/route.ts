import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { twoFactorVerifySchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/* ── helpers ── */

/** Generate a hex secret for TOTP (20 bytes = 40 hex chars). */
function generateSecret(): string {
  return crypto.randomBytes(20).toString("hex");
}

/** Build a TOTP instance from a stored secret (may be encrypted or plain hex). */
function buildTOTP(storedSecret: string, email: string): OTPAuth.TOTP {
  const hexSecret = isEncrypted(storedSecret)
    ? decrypt(storedSecret)
    : storedSecret;
  return new OTPAuth.TOTP({
    issuer: "Shiftfy",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromHex(hexSecret),
  });
}

/** Generate 10 plain-text recovery codes (8 chars, uppercase hex). */
function generatePlainRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

/** Hash all recovery codes with bcrypt so we only store hashes. */
async function hashRecoveryCodes(plainCodes: string[]): Promise<string[]> {
  return Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
}

/**
 * GET  → generate a new TOTP secret + QR code (setup phase)
 *        or return 2FA status when ?status=1
 * POST → verify a TOTP code, enable 2FA, return recovery codes
 * DELETE → disable 2FA and clear secret + recovery codes
 */

export const GET = withRoute("/api/auth/two-factor", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const url = new URL(req.url);

  // If query param ?status=1, return current 2FA state only
  if (url.searchParams.get("status") === "1") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });
    return NextResponse.json({
      enabled: dbUser?.twoFactorEnabled ?? false,
    });
  }

  // Encryption key is required for 2FA — fail early with a clear message
  if (!process.env.ENCRYPTION_KEY) {
    log.error("ENCRYPTION_KEY is not set — cannot setup 2FA");
    return NextResponse.json(
      { error: "2FA is not available. Server configuration missing." },
      { status: 503 },
    );
  }

  // Check if there's already a pending secret (2FA not yet enabled).
  // Reuse it to prevent race conditions where multiple GET calls
  // overwrite the DB secret while the QR code shown has the old one.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  const forceNew = url.searchParams.get("force") === "1";
  const existingSecret =
    dbUser?.twoFactorSecret && !dbUser.twoFactorEnabled && !forceNew
      ? dbUser.twoFactorSecret
      : null;

  // Generate a new plaintext hex secret if needed
  const plainHexSecret = existingSecret
    ? isEncrypted(existingSecret)
      ? decrypt(existingSecret)
      : existingSecret
    : generateSecret();

  const totp = buildTOTP(plainHexSecret, user.email);
  const otpauthUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Extract the base32-encoded secret from the TOTP instance.
  // Authenticator apps expect base32 for manual entry — NOT hex.
  const base32Secret = totp.secret.base32;

  // Only write to DB if we generated a new secret — always store encrypted
  if (!existingSecret) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encrypt(plainHexSecret) },
    });
  }

  return NextResponse.json({
    secret: base32Secret,
    qrCode: qrDataUrl,
    otpauthUrl,
  });
});

export const POST = withRoute("/api/auth/two-factor", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const parsed = validateBody(twoFactorVerifySchema, await req.json());
  if (!parsed.success) return parsed.response;
  // Accept both "code" and "token" for backwards compatibility
  const code: string | undefined = parsed.data.code || parsed.data.token;

  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { twoFactorSecret: true },
  });

  if (!dbUser?.twoFactorSecret) {
    return NextResponse.json({ error: "Setup 2FA first" }, { status: 400 });
  }

  // Validate the TOTP code (window: 2 = ±60 s tolerance)
  const totp = buildTOTP(dbUser.twoFactorSecret, user.email);
  const delta = totp.validate({ token: code, window: 2 });

  if (delta === null) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Generate recovery codes
  const plainCodes = generatePlainRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(plainCodes);

  // Enable 2FA + store hashed recovery codes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.user as any).update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorRecoveryCodes: JSON.stringify(hashedCodes),
    },
  });

  // Return plain codes ONCE — user must save them now
  return NextResponse.json({
    success: true,
    recoveryCodes: plainCodes,
  });
});

export const DELETE = withRoute(
  "/api/auth/two-factor",
  "DELETE",
  async (_req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.user as any).update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: null,
      },
    });

    return NextResponse.json({ success: true });
  },
);
