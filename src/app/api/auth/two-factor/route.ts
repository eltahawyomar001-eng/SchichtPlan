import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import type { SessionUser } from "@/lib/types";
import crypto from "crypto";

/**
 * GET  → generate a new TOTP secret + QR code (setup)
 * POST → verify a TOTP code and enable 2FA
 * DELETE → disable 2FA
 */

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    const secret = crypto.randomBytes(20).toString("hex").slice(0, 20);

    const totp = new OTPAuth.TOTP({
      issuer: "SchichtPlan",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromHex(Buffer.from(secret).toString("hex")),
    });

    const otpauthUrl = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not yet enabled)
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
    console.error("2FA setup error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    const { code } = await req.json();

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

    const totp = new OTPAuth.TOTP({
      issuer: "SchichtPlan",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromHex(
        Buffer.from(dbUser.twoFactorSecret).toString("hex"),
      ),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("2FA verify error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("2FA disable error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
