import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { workspaceId },
      orderBy: { lastName: "asc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Kein Workspace" }, { status: 400 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      position,
      hourlyRate,
      weeklyHours,
      color,
    } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Vor- und Nachname sind erforderlich." },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        position: position || null,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        weeklyHours: weeklyHours ? parseFloat(weeklyHours) : null,
        color:
          color ||
          `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`,
        workspaceId,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
