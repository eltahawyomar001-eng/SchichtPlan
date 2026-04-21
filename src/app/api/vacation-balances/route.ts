import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createVacationBalanceSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

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
 * Recalculate used + planned days from actual AbsenceRequests for an employee/year.
 * - used = sum of totalDays for GENEHMIGT URLAUB absences in that year
 * - planned = sum of totalDays for AUSSTEHEND URLAUB absences in that year
 */
async function recalculateFromAbsences(
  employeeId: string,
  year: number,
  workspaceId: string,
): Promise<{ used: number; planned: number }> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const absences = await prisma.absenceRequest.findMany({
    where: {
      employeeId,
      workspaceId,
      category: "URLAUB",
      status: { in: ["GENEHMIGT", "AUSSTEHEND"] },
      startDate: { lte: endOfYear },
      endDate: { gte: startOfYear },
      deletedAt: null,
    },
    select: { status: true, totalDays: true },
  });

  let used = 0;
  let planned = 0;
  for (const a of absences) {
    if (a.status === "GENEHMIGT") used += a.totalDays;
    else if (a.status === "AUSSTEHEND") planned += a.totalDays;
  }
  return {
    used: Math.round(used * 10) / 10,
    planned: Math.round(planned * 10) / 10,
  };
}

/**
 * GET /api/vacation-balances?year=2025&employeeId=xxx
 * Returns vacation balances. Managers see all, employees see own.
 * Auto-creates VacationBalance records for employees that don't have one yet,
 * and recalculates used/planned from actual absence data.
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

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  // ── Determine which employees to include ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = { workspaceId, isActive: true, deletedAt: null };
  if (user.role === "EMPLOYEE" && user.employeeId) {
    employeeWhere.id = user.employeeId;
  } else if (employeeIdParam) {
    employeeWhere.id = employeeIdParam;
  }

  // Fetch all relevant employees
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workDaysPerWeek: true,
      contractType: true,
    },
    orderBy: { lastName: "asc" },
  });

  if (employees.length === 0) {
    return NextResponse.json([]);
  }

  const employeeIds = employees.map((e) => e.id);

  // Fetch existing balances for these employees & year
  const existingBalances = await prisma.vacationBalance.findMany({
    where: { workspaceId, year, employeeId: { in: employeeIds } },
  });
  const existingMap = new Map(existingBalances.map((b) => [b.employeeId, b]));

  // ── Auto-provision policy ──
  // We ONLY auto-create VacationBalance rows for the *current* calendar year.
  // For past or future years we return whatever genuinely exists in the DB.
  // This prevents silently polluting historic / future periods with 20-day
  // placeholder records every time a user flips the year selector — which
  // would otherwise (a) make every year look like "this year's data" and
  // (b) leave permanent ghost rows in audit logs & exports.
  const currentYear = new Date().getFullYear();
  const allowAutoCreate = year === currentYear;

  // ── Auto-create missing balances + recalculate all from absences ──
  const results = [];

  for (const emp of employees) {
    let balance = existingMap.get(emp.id);
    const workDays = emp.workDaysPerWeek ?? 5;
    const legalMin = calculateMinEntitlement(workDays);

    // Auto-create if missing — only for the current year
    if (!balance && allowAutoCreate) {
      // Check for carry-over from previous year
      let carryOver = 0;
      const prevBalance = await prisma.vacationBalance.findUnique({
        where: { employeeId_year: { employeeId: emp.id, year: year - 1 } },
      });
      if (prevBalance && prevBalance.remaining > 0) {
        // §7(3) BUrlG: carry-over expires March 31 of next year
        // We still record it — expiry can be enforced separately
        carryOver = Math.round(prevBalance.remaining * 10) / 10;
      }

      const defaultEntitlement = Math.max(legalMin, 20); // at least 20 or legal min
      balance = await prisma.vacationBalance.create({
        data: {
          employeeId: emp.id,
          year,
          totalEntitlement: defaultEntitlement,
          carryOver,
          used: 0,
          planned: 0,
          remaining: defaultEntitlement + carryOver,
          workspaceId,
        },
      });
    }

    // Skip employees with no balance for non-current years (empty state on UI)
    if (!balance) continue;

    // Recalculate used/planned from actual absences
    const { used, planned } = await recalculateFromAbsences(
      emp.id,
      year,
      workspaceId,
    );
    const remaining =
      balance.totalEntitlement + balance.carryOver - used - planned;

    // Update if values differ
    if (
      balance.used !== used ||
      balance.planned !== planned ||
      balance.remaining !== remaining
    ) {
      balance = await prisma.vacationBalance.update({
        where: { id: balance.id },
        data: { used, planned, remaining: Math.round(remaining * 10) / 10 },
      });
    }

    results.push({
      ...balance,
      employee: emp,
      legalMinimum: legalMin,
    });
  }

  return NextResponse.json(results);
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

    // Look up existing balance to preserve used/planned
    const existing = await prisma.vacationBalance.findUnique({
      where: {
        employeeId_year: { employeeId, year },
      },
      select: { id: true, used: true, planned: true },
    });

    const used = existing?.used ?? 0;
    const planned = existing?.planned ?? 0;
    const remaining = entitlement + carry - used - planned;

    const balance = existing
      ? await prisma.vacationBalance.update({
          where: { id: existing.id },
          data: {
            totalEntitlement: entitlement,
            carryOver: carry,
            remaining,
          },
        })
      : await prisma.vacationBalance.create({
          data: {
            employeeId,
            year,
            totalEntitlement: entitlement,
            carryOver: carry,
            used: 0,
            planned: 0,
            remaining,
            workspaceId,
          },
        });

    return NextResponse.json(balance, { status: existing ? 200 : 201 });
  },
  { idempotent: true },
);
