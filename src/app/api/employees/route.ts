import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Only OWNER, ADMIN, MANAGER can create employees
    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

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
        { error: "First and last name are required" },
        { status: 400 },
      );
    }

    if (
      (hourlyRate !== undefined &&
        hourlyRate !== "" &&
        parseFloat(hourlyRate) < 0) ||
      (weeklyHours !== undefined &&
        weeklyHours !== "" &&
        parseFloat(weeklyHours) < 0)
    ) {
      return NextResponse.json(
        { error: "Hourly rate and weekly hours must not be negative" },
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
