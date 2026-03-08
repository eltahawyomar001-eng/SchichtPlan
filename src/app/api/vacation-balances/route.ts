import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";

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
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get("year");
    const employeeIdParam = searchParams.get("employeeId");

    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { workspaceId, year };

    // EMPLOYEE role: can only see own balance
    if (user.role === "EMPLOYEE" && user.employeeId) {
      where.employeeId = user.employeeId;
    } else if (employeeIdParam) {
      where.employeeId = employeeIdParam;
    }

    const balances = await prisma.vacationBalance.findMany({
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
    });

    // Enrich response with legal minimum for each balance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = balances.map((bal: any) => ({
      ...bal,
      legalMinimum: calculateMinEntitlement(bal.employee.workDaysPerWeek ?? 5),
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    log.error("Error fetching vacation balances:", { error: error });
    return NextResponse.json(
      { error: "Error loading vacation balances" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/vacation-balances
 * Create/update vacation balance for an employee.
 * Body: { employeeId, year, totalEntitlement, carryOver }
 *
 * Validates against BUrlG §3: entitlement must not be below legal minimum
 * based on employee's workDaysPerWeek.
 */
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

    const forbidden = requirePermission(user, "employees", "update");
    if (forbidden) return forbidden;

    const { employeeId, year, totalEntitlement, carryOver } = await req.json();

    if (!employeeId || !year) {
      return NextResponse.json(
        {
          error: "Mitarbeiter und Jahr sind erforderlich.",
        },
        { status: 400 },
      );
    }

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
      totalEntitlement !== undefined ? parseFloat(totalEntitlement) : legalMin;
    const carry = carryOver !== undefined ? parseFloat(carryOver) : 0;

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
          year: parseInt(String(year), 10),
        },
      },
      create: {
        employeeId,
        year: parseInt(String(year), 10),
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

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    log.error("Error creating vacation balance:", { error: error });
    return NextResponse.json(
      { error: "Error saving vacation balance" },
      { status: 500 },
    );
  }
}
