import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as SessionUser).workspaceId;

    const employee = await prisma.employee.findFirst({
      where: { id, workspaceId },
      include: { shifts: { orderBy: { date: "desc" }, take: 10 } },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can update employees
    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const body = await req.json();

    const employee = await prisma.employee.updateMany({
      where: { id, workspaceId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email || null,
        phone: body.phone || null,
        position: body.position || null,
        hourlyRate: body.hourlyRate ? parseFloat(body.hourlyRate) : null,
        weeklyHours: body.weeklyHours ? parseFloat(body.weeklyHours) : null,
        color: body.color,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json({ error: "Error updating" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    // Only OWNER, ADMIN, MANAGER can delete employees
    const forbidden = requirePermission(user, "employees", "delete");
    if (forbidden) return forbidden;

    await prisma.employee.deleteMany({
      where: { id, workspaceId },
    });

    return NextResponse.json({ message: "Employee deleted" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
