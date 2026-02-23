import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import type { SessionUser } from "@/lib/types";
import crypto from "crypto";
import { log } from "@/lib/logger";

/* ── helpers ── */

/** Generate a hex secret for TOTP (20 bytes = 40 hex chars). */
function generateSecret(): string {
  return crypto.randomBytes(20).toString("hex");
}

/** Build a TOTP instance from a hex secret. */
function buildTOTP(hexSecret: string, email: string): OTPAuth.TOTP {
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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;

    // If query param ?status=1, return current 2FA state
    const url = new URL(req.url);
    if (url.searchParams.get("status") === "1") {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabled: true },
      });
      return NextResponse.json({
        enabled: dbUser?.twoFactorEnabled ?? false,
      });
    }

    // Generate new secret and QR code for setup
    const secret = generateSecret();
    const totp = buildTOTP(secret, user.email);
    const otpauthUrl = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (2FA not yet enabled)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    });

    return NextResponse.json({
      secret,
      qrCode: qrDataUrl,
      otpauthUrl,
    });
  } catch (error) {
    log.error("2FA setup error:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    const body = await req.json();
    // Accept both "code" and "token" for backwards compatibility
    const code: string | undefined = body.code || body.token;

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

    // Validate the TOTP code
    const totp = buildTOTP(dbUser.twoFactorSecret, user.email);
    const delta = totp.validate({ token: code, window: 1 });
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
  } catch (error) {
    log.error("2FA verify error:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;

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
  } catch (error) {
    log.error("2FA disable error:", { error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
