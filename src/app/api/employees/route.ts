import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireUserSlot } from "@/lib/subscription-guard";
import { createEmployeeSchema, validateBody } from "@/lib/validations";
import { executeCustomRules } from "@/lib/automations";
import { createAuditLogTx } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

/** MiLoG minimum wage (€/h) — updated annually */
const MILOG_MIN_WAGE = 12.82;

export const GET = withRoute("/api/employees", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const { take, skip } = parsePagination(req);

  const where: Record<string, unknown> = { workspaceId };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        employeeSkills: {
          include: { skill: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        location: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { lastName: "asc" },
      take,
      skip,
    }),
    prisma.employee.count({ where }),
  ]);

  return paginatedResponse(employees, total, take, skip);
});

export const POST = withRoute(
  "/api/employees",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER, ADMIN, MANAGER can create employees
    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    // Check plan limit (includes pending invitations in slot count)
    const planLimit = await requireUserSlot(workspaceId);
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
      workDaysPerWeek,
      contractType,
      color,
      locationId,
      departmentId,
      clientId,
    } = parsed.data;

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          position: position || null,
          hourlyRate: hourlyRate ?? null,
          weeklyHours: weeklyHours ?? null,
          workDaysPerWeek: workDaysPerWeek ?? 5,
          contractType: contractType ?? "VOLLZEIT",
          color:
            color ||
            `#${Math.floor(Math.random() * 16777215)
              .toString(16)
              .padStart(6, "0")}`,
          locationId: locationId || null,
          departmentId: departmentId || null,
          clientId: clientId || null,
          workspaceId,
        },
      });

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "CREATE",
        entityType: "employee",
        entityId: created.id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId,
        changes: { firstName, lastName, email, position, hourlyRate },
      });

      return created;
    });

    // ── Automation: Execute custom rules ──
    executeCustomRules("employee.created", workspaceId, {
      id: employee.id,
      firstName,
      lastName,
      email: email || "",
      position: position || "",
    });

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId, "employee.created", {
      id: employee.id,
      firstName,
      lastName,
      email: email || null,
      position: position || null,
    }).catch((err) =>
      log.error("[webhook] employee.created dispatch error", { error: err }),
    );

    const warnings: string[] = [];
    if (hourlyRate != null && hourlyRate < MILOG_MIN_WAGE) {
      warnings.push(
        `Stundenlohn (${hourlyRate.toFixed(2)} €) liegt unter dem gesetzlichen Mindestlohn (${MILOG_MIN_WAGE.toFixed(2)} €/h, MiLoG)`,
      );
    }

    const response = NextResponse.json(
      { ...employee, ...(warnings.length ? { warnings } : {}) },
      { status: 201 },
    );
    return response;
  },
  { idempotent: true },
);
