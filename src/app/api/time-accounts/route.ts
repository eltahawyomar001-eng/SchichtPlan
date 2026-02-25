import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { log } from "@/lib/logger";

// ─── GET  /api/time-accounts ────────────────────────────────────
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
    const employeeId = searchParams.get("employeeId");

    const where: Record<string, unknown> = { workspaceId };
    if (employeeId) where.employeeId = employeeId;

    // EMPLOYEE can only see their own time account
    if (isEmployee(user) && user.employeeId) {
      where.employeeId = user.employeeId;
    }

    const accounts = await prisma.timeAccount.findMany({
      where,
      include: { employee: true },
      orderBy: { employee: { lastName: "asc" } },
    });

    // Enrich with actual worked hours from confirmed time entries
    const enriched = await Promise.all(
      accounts.map(async (account: (typeof accounts)[number]) => {
        const confirmedEntries = await prisma.timeEntry.aggregate({
          where: {
            employeeId: account.employeeId,
            status: "BESTAETIGT",
            date: { gte: account.periodStart },
          },
          _sum: { netMinutes: true },
        });

        const workedMinutes = confirmedEntries._sum.netMinutes || 0;

        // Calculate expected minutes since period start
        const now = new Date();
        const periodStart = new Date(account.periodStart);
        const weeks = Math.max(
          1,
          Math.ceil(
            (now.getTime() - periodStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
          ),
        );
        const expectedMinutes = weeks * account.contractHours * 60;

        return {
          ...account,
          workedMinutes,
          expectedMinutes,
          balanceMinutes:
            account.carryoverMinutes + workedMinutes - expectedMinutes,
        };
      }),
    );

    return NextResponse.json(enriched);
  } catch (error) {
    log.error("Error fetching time accounts:", { error: error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
  }
}

// ─── POST  /api/time-accounts ───────────────────────────────────
// Create or update a time account for an employee
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

    // Only management can create/update time accounts
    const forbidden = requirePermission(user, "time-accounts", "create");
    if (forbidden) return forbidden;

    const body = await req.json();

    if (!body.employeeId) {
      return NextResponse.json(
        { error: "Employee is required" },
        { status: 400 },
      );
    }

    const account = await prisma.timeAccount.upsert({
      where: { employeeId: body.employeeId },
      create: {
        employeeId: body.employeeId,
        workspaceId,
        contractHours: body.contractHours ?? 40,
        carryoverMinutes: body.carryoverMinutes ?? 0,
        periodStart: body.periodStart
          ? new Date(body.periodStart)
          : new Date(new Date().getFullYear(), 0, 1), // Jan 1st
      },
      update: {
        contractHours: body.contractHours,
        carryoverMinutes: body.carryoverMinutes,
        periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
      },
      include: { employee: true },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    log.error("Error saving time account:", { error: error });
    return NextResponse.json({ error: "Error saving" }, { status: 500 });
  }
}
