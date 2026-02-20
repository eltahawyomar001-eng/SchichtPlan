import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token und Passwort sind erforderlich." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
        { status: 400 },
      );
    }

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: "Ungültiger oder abgelaufener Link." },
        { status: 400 },
      );
    }

    if (new Date() > resetToken.expires) {
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return NextResponse.json(
        {
          error:
            "Dieser Link ist abgelaufen. Bitte fordern Sie einen neuen an.",
        },
        { status: 410 },
      );
    }

    // Find user and update password
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kein Konto mit dieser E-Mail gefunden." },
        { status: 404 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and delete token in transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: user.id },
        data: { hashedPassword },
      });

      await tx.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
    });

    return NextResponse.json({
      message: "Passwort erfolgreich zurückgesetzt.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 },
    );
  }
}
