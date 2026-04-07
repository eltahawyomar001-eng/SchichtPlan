import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createTimeAccountSchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

// ─── GET  /api/time-accounts ────────────────────────────────────
export const GET = withRoute("/api/time-accounts", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const { take, skip } = parsePagination(req);

  const where: Record<string, unknown> = { workspaceId };
  if (employeeId) where.employeeId = employeeId;

  // EMPLOYEE can only see their own time account
  if (isEmployee(user) && user.employeeId) {
    where.employeeId = user.employeeId;
  }

  const [accounts, total] = await Promise.all([
    prisma.timeAccount.findMany({
      where,
      include: { employee: true },
      orderBy: { employee: { lastName: "asc" } },
      take,
      skip,
    }),
    prisma.timeAccount.count({ where }),
  ]);

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

  return paginatedResponse(enriched, total, take, skip);
});

// ─── POST  /api/time-accounts ───────────────────────────────────
// Create or update a time account for an employee
export const POST = withRoute(
  "/api/time-accounts",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Only management can create/update time accounts
    const forbidden = requirePermission(user, "time-accounts", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(createTimeAccountSchema, body);
    if (!parsed.success) return parsed.response;
    const { data: validData } = parsed;

    const account = await prisma.timeAccount.upsert({
      where: { employeeId: validData.employeeId },
      create: {
        employeeId: validData.employeeId,
        workspaceId,
        contractHours: validData.contractHours ?? 40,
        carryoverMinutes: validData.carryoverMinutes ?? 0,
        periodStart: validData.periodStart
          ? new Date(validData.periodStart)
          : new Date(new Date().getFullYear(), 0, 1), // Jan 1st
      },
      update: {
        contractHours: validData.contractHours,
        carryoverMinutes: validData.carryoverMinutes,
        periodStart: validData.periodStart
          ? new Date(validData.periodStart)
          : undefined,
        periodEnd: validData.periodEnd
          ? new Date(validData.periodEnd)
          : undefined,
      },
      include: { employee: true },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "TimeAccount",
      entityId: account.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: {
        employeeId: validData.employeeId,
        contractHours: validData.contractHours,
      },
    });

    dispatchWebhook(workspaceId, "time_account.updated", {
      id: account.id,
      employeeId: validData.employeeId,
    }).catch(() => {});

    return NextResponse.json(account, { status: 201 });
  },
  { idempotent: true },
);
