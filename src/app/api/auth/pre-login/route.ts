import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/pre-login
 *
 * Validates email + password and returns whether 2FA is required,
 * without actually signing the user in. This avoids the NextAuth v4
 * limitation where custom error messages from authorize() are
 * swallowed and returned as generic "CredentialsSignin".
 */
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS" },
        { status: 401 },
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
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
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

    return NextResponse.json({
      requires2FA: user.twoFactorEnabled === true,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
