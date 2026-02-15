import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const { name, email, password, workspaceName, invitationToken } =
      await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Alle Felder sind erforderlich." },
        { status: 400 },
      );
    }

    // If no invitation token, workspace name is required
    if (!invitationToken && !workspaceName) {
      return NextResponse.json(
        { error: "Alle Felder sind erforderlich." },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ein Konto mit dieser E-Mail existiert bereits." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Invitation-based registration ──
    if (invitationToken) {
      const invitation = await prisma.invitation.findUnique({
        where: { token: invitationToken },
      });

      if (!invitation) {
        return NextResponse.json(
          { error: "Ungültiger Einladungslink." },
          { status: 400 },
        );
      }

      if (invitation.status !== "PENDING") {
        return NextResponse.json(
          { error: "Diese Einladung ist nicht mehr gültig." },
          { status: 410 },
        );
      }

      if (new Date() > invitation.expiresAt) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        return NextResponse.json(
          { error: "Diese Einladung ist abgelaufen." },
          { status: 410 },
        );
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: "E-Mail-Adresse stimmt nicht mit der Einladung überein." },
          { status: 403 },
        );
      }

      // Create user in existing workspace + accept invitation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            hashedPassword,
            role: invitation.role,
            workspaceId: invitation.workspaceId,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        });

        return { user };
      });

      return NextResponse.json(
        {
          message: "Konto erfolgreich erstellt.",
          userId: result.user.id,
        },
        { status: 201 },
      );
    }

    // ── Standard registration (create new workspace) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: slugify(workspaceName) + "-" + Date.now().toString(36),
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          hashedPassword,
          role: "OWNER",
          workspaceId: workspace.id,
        },
      });

      return { user, workspace };
    });

    return NextResponse.json(
      {
        message: "Konto erfolgreich erstellt.",
        userId: result.user.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registrierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
