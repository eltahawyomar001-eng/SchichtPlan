import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balances = await (prisma as any).vacationBalance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { year: "desc" }],
    });

    return NextResponse.json(balances);
  } catch (error) {
    console.error("Error fetching vacation balances:", error);
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

    const entitlement =
      totalEntitlement !== undefined ? parseFloat(totalEntitlement) : 20; // BUrlG minimum
    const carry = carryOver !== undefined ? parseFloat(carryOver) : 0;
    const remaining = entitlement + carry;

    // Upsert — create or update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balance = await (prisma as any).vacationBalance.upsert({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).vacationBalance.update({
      where: { id: balance.id },
      data: {
        remaining: entitlement + carry - balance.used - balance.planned,
      },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("Error creating vacation balance:", error);
    return NextResponse.json(
      { error: "Error saving vacation balance" },
      { status: 500 },
    );
  }
}
