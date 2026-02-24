import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requireEmployeeSlot } from "@/lib/subscription";
import { createEmployeeSchema, validateBody } from "@/lib/validations";
import { executeCustomRules } from "@/lib/automations";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

/** MiLoG minimum wage (€/h) — updated annually */
const MILOG_MIN_WAGE = 12.82;

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
    log.error("Error fetching employees:", { error: error });
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

    // Check plan limit
    const planLimit = await requireEmployeeSlot(workspaceId);
    if (planLimit) return planLimit;

    const body = await req.json();
    const parsed = validateBody(createEmployeeSchema, body);
    if (!parsed.success) return parsed.response;
    const {
      firstName,
      lastName,
      email,
      phone,
      position,
      hourlyRate,
      weeklyHours,
      color,
    } = parsed.data;

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        position: position || null,
        hourlyRate: hourlyRate ?? null,
        weeklyHours: weeklyHours ?? null,
        color:
          color ||
          `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`,
        workspaceId,
      },
    });

    // ── Automation: Execute custom rules ──
    executeCustomRules("employee.created", workspaceId, {
      id: employee.id,
      firstName,
      lastName,
      email: email || "",
      position: position || "",
    });

    // ── Audit log ──
    createAuditLog({
      action: "CREATE",
      entityType: "employee",
      entityId: employee.id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      workspaceId,
      changes: { firstName, lastName, email, position, hourlyRate },
    });

    const warnings: string[] = [];
    if (hourlyRate != null && hourlyRate < MILOG_MIN_WAGE) {
      warnings.push(
        `Stundenlohn (${hourlyRate.toFixed(2)} €) liegt unter dem gesetzlichen Mindestlohn (${MILOG_MIN_WAGE.toFixed(2)} €/h, MiLoG)`,
      );
    }

    return NextResponse.json(
      { ...employee, ...(warnings.length ? { warnings } : {}) },
      { status: 201 },
    );
  } catch (error) {
    log.error("Error creating employee:", { error: error });
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
