import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/** MiLoG minimum wage (€/h) — updated annually */
const MILOG_MIN_WAGE = 12.82;

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
      include: {
        shifts: { orderBy: { date: "desc" }, take: 20 },
        timeEntries: { orderBy: { date: "desc" }, take: 20 },
        absenceRequests: { orderBy: { startDate: "desc" }, take: 20 },
        vacationBalances: { orderBy: { year: "desc" }, take: 3 },
        department: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    log.error("Error fetching employee:", { error: error });
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
        workDaysPerWeek: body.workDaysPerWeek
          ? parseFloat(body.workDaysPerWeek)
          : undefined,
        contractType: body.contractType || undefined,
        color: body.color,
        isActive: body.isActive,
      },
    });

    const warnings: string[] = [];
    const parsedRate = body.hourlyRate ? parseFloat(body.hourlyRate) : null;
    if (parsedRate != null && parsedRate < MILOG_MIN_WAGE) {
      warnings.push(
        `Stundenlohn (${parsedRate.toFixed(2)} €) liegt unter dem gesetzlichen Mindestlohn (${MILOG_MIN_WAGE.toFixed(2)} €/h, MiLoG)`,
      );
    }

    // ── Audit log ──
    createAuditLog({
      action: "UPDATE",
      entityType: "employee",
      entityId: id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId: workspaceId!,
      changes: body,
    });

    return NextResponse.json({
      ...employee,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error) {
    log.error("Error updating employee:", { error: error });
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

    // ── Audit log ──
    createAuditLog({
      action: "DELETE",
      entityType: "employee",
      entityId: id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId: workspaceId!,
    });

    return NextResponse.json({ message: "Employee deleted" });
  } catch (error) {
    log.error("Error deleting employee:", { error: error });
    return NextResponse.json({ error: "Error deleting" }, { status: 500 });
  }
}
