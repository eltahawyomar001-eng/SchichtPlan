import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createVacationBalanceSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * Calculate the BUrlG (Bundesurlaubsgesetz) legal minimum vacation days.
 * §3 BUrlG: 24 work days per year based on 6-day week.
 * Pro-rata for fewer work days: (workDaysPerWeek / 6) × 24
 * Which equals (workDaysPerWeek / 6) × 24 = workDaysPerWeek × 4
 * Common results: 5-day week → 20 days, 4-day week → 16 days, 3-day week → 12 days
 */
function calculateMinEntitlement(workDaysPerWeek: number): number {
  return Math.round(workDaysPerWeek * 4 * 10) / 10; // round to 1 decimal
}

/**
 * GET /api/vacation-balances?year=2025&employeeId=xxx
 * Returns vacation balances. Managers see all, employees see own.
 */
export const GET = withRoute("/api/vacation-balances", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const employeeIdParam = searchParams.get("employeeId");
  const { take, skip } = parsePagination(req);

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId, year };

  // EMPLOYEE role: can only see own balance
  if (user.role === "EMPLOYEE" && user.employeeId) {
    where.employeeId = user.employeeId;
  } else if (employeeIdParam) {
    where.employeeId = employeeIdParam;
  }

  const [balances, total] = await Promise.all([
    prisma.vacationBalance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            workDaysPerWeek: true,
            contractType: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { year: "desc" }],
      take,
      skip,
    }),
    prisma.vacationBalance.count({ where }),
  ]);

  // Enrich response with legal minimum for each balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = balances.map((bal: any) => ({
    ...bal,
    legalMinimum: calculateMinEntitlement(bal.employee.workDaysPerWeek ?? 5),
  }));

  return paginatedResponse(enriched, total, take, skip);
});

/**
 * POST /api/vacation-balances
 * Create/update vacation balance for an employee.
 * Body: { employeeId, year, totalEntitlement, carryOver }
 *
 * Validates against BUrlG §3: entitlement must not be below legal minimum
 * based on employee's workDaysPerWeek.
 */
export const POST = withRoute(
  "/api/vacation-balances",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const parsed = validateBody(createVacationBalanceSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { employeeId, year, totalEntitlement, carryOver } = parsed.data;

    // Fetch employee to get workDaysPerWeek for BUrlG validation
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, workspaceId },
      select: { id: true, workDaysPerWeek: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Mitarbeiter nicht gefunden." },
        { status: 404 },
      );
    }

    const workDays = employee.workDaysPerWeek ?? 5;
    const legalMin = calculateMinEntitlement(workDays);

    const entitlement =
      totalEntitlement !== undefined ? totalEntitlement : legalMin;
    const carry = carryOver !== undefined ? carryOver : 0;

    // BUrlG §3: Entitlement must not be below legal minimum
    if (entitlement < legalMin) {
      return NextResponse.json(
        {
          error: `Urlaubsanspruch darf nicht unter dem gesetzlichen Minimum liegen (${legalMin} Tage bei ${workDays}-Tage-Woche gem. §3 BUrlG).`,
        },
        { status: 400 },
      );
    }

    if (carry < 0) {
      return NextResponse.json(
        { error: "Übertrag darf nicht negativ sein." },
        { status: 400 },
      );
    }

    const remaining = entitlement + carry;

    // Upsert — create or update
    const balance = await prisma.vacationBalance.upsert({
      where: {
        employeeId_year: {
          employeeId,
          year,
        },
      },
      create: {
        employeeId,
        year,
        totalEntitlement: entitlement,
        carryOver: carry,
        used: 0,
        planned: 0,
        remaining,
        workspaceId,
      },
      update: {
        totalEntitlement: entitlement,
        carryOver: carry,
        remaining: {
          // recalculate: entitlement + carryOver - used - planned
          // We'll do a raw update for accuracy
          set: undefined,
        },
      },
    });

    // Recalculate remaining after update
    const updated = await prisma.vacationBalance.update({
      where: { id: balance.id },
      data: {
        remaining: entitlement + carry - balance.used - balance.planned,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "VacationBalance",
      entityId: updated.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: {
        employeeId,
        year,
        totalEntitlement: entitlement,
        carryOver: carry,
      },
    });

    dispatchWebhook(workspaceId, "vacation_balance.created", {
      id: updated.id,
      employeeId,
      year,
    }).catch(() => {});

    return NextResponse.json(updated, { status: 201 });
  },
  { idempotent: true },
);
