import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const { name, email, password, workspaceName } = await req.json();

    if (!name || !email || !password || !workspaceName) {
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

    // Create workspace and user in a transaction
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
