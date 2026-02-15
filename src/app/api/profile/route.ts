import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { SessionUser } from "@/lib/types";

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const userId = (session.user as SessionUser).id;
    const body = await req.json();

    // Password change
    if (body.currentPassword && body.newPassword) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.hashedPassword) {
        return NextResponse.json({ error: "NO_PASSWORD" }, { status: 400 });
      }

      const isValid = await bcrypt.compare(
        body.currentPassword,
        user.hashedPassword,
      );
      if (!isValid) {
        return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 400 });
      }

      if (body.newPassword.length < 8) {
        return NextResponse.json(
          { error: "PASSWORD_TOO_SHORT" },
          { status: 400 },
        );
      }

      const hashed = await bcrypt.hash(body.newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { hashedPassword: hashed },
      });

      return NextResponse.json({ message: "Password updated" });
    }

    // Profile update (name)
    if (body.name !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: body.name },
      });
      return NextResponse.json({ message: "Profile updated" });
    }

    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}
