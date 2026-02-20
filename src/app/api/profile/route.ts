import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { SessionUser } from "@/lib/types";

// ── DELETE /api/profile — Account deletion (Art. 17 DSGVO) ──
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as SessionUser).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspace: { include: { members: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // If OWNER and sole member → delete entire workspace (cascades everything)
      if (user.role === "OWNER" && user.workspaceId) {
        const otherMembers = user.workspace?.members.filter(
          (m) => m.id !== userId,
        );

        if (!otherMembers || otherMembers.length === 0) {
          // Sole owner — delete entire workspace (all employees, shifts, etc. cascade)
          await tx.workspace.delete({ where: { id: user.workspaceId } });
        } else {
          // Other members exist — cannot delete without transferring ownership
          throw new Error("OWNER_TRANSFER_REQUIRED");
        }
      }

      // Delete user-specific data that won't cascade from workspace
      await tx.notification.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });

      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ message: "Account deleted" });
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_TRANSFER_REQUIRED") {
      return NextResponse.json(
        {
          error: "OWNER_TRANSFER_REQUIRED",
          message:
            "Bitte übertragen Sie die Inhaberrolle an ein anderes Teammitglied, bevor Sie Ihr Konto löschen.",
        },
        { status: 409 },
      );
    }
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Error deleting account" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
