import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/projects/planner?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Aggregated view of project utilisation in a date range.
 *
 * For each project, returns:
 *   - totalMinutes  — sum of all confirmed time entries in the window
 *   - budgetMinutes — the project's planned budget (if set)
 *   - employees     — per-employee breakdown { id, name, minutes }
 *   - daily         — per-day timeline { date, minutes } for sparkline rendering
 *
 * Only confirmed (BESTAETIGT) time entries count — pending / rejected entries
 * are excluded so the planner reflects billable, audit-ready hours.
 */
export const GET = withRoute("/api/projects/planner", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const startStr = searchParams.get("start");
  const endStr = searchParams.get("end");
  if (!startStr || !endStr) {
    return NextResponse.json(
      { error: "start and end query params required", code: "MISSING_RANGE" },
      { status: 400 },
    );
  }

  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "Invalid date", code: "INVALID_DATE" },
      { status: 400 },
    );
  }

  const [projects, entries] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        budgetMinutes: true,
        startDate: true,
        endDate: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        status: "BESTAETIGT",
        date: { gte: start, lte: end },
        projectId: { not: null },
      },
      select: {
        date: true,
        netMinutes: true,
        projectId: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  type Bucket = {
    totalMinutes: number;
    employees: Map<string, { id: string; name: string; minutes: number }>;
    daily: Map<string, number>;
  };

  const byProject = new Map<string, Bucket>();
  for (const entry of entries) {
    if (!entry.projectId) continue;
    const minutes = entry.netMinutes ?? 0;
    if (!byProject.has(entry.projectId)) {
      byProject.set(entry.projectId, {
        totalMinutes: 0,
        employees: new Map(),
        daily: new Map(),
      });
    }
    const bucket = byProject.get(entry.projectId)!;
    bucket.totalMinutes += minutes;

    const empId = entry.employee?.id;
    if (empId) {
      const existing = bucket.employees.get(empId);
      const name =
        `${entry.employee?.firstName ?? ""} ${entry.employee?.lastName ?? ""}`.trim();
      if (existing) {
        existing.minutes += minutes;
      } else {
        bucket.employees.set(empId, { id: empId, name, minutes });
      }
    }

    const dayKey = entry.date.toISOString().slice(0, 10);
    bucket.daily.set(dayKey, (bucket.daily.get(dayKey) ?? 0) + minutes);
  }

  const data = projects.map((p) => {
    const bucket = byProject.get(p.id);
    const employees = bucket
      ? Array.from(bucket.employees.values()).sort(
          (a, b) => b.minutes - a.minutes,
        )
      : [];
    const daily = bucket
      ? Array.from(bucket.daily.entries())
          .map(([date, minutes]) => ({ date, minutes }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      budgetMinutes: p.budgetMinutes,
      startDate: p.startDate,
      endDate: p.endDate,
      client: p.client,
      totalMinutes: bucket?.totalMinutes ?? 0,
      utilisationPercent:
        p.budgetMinutes && p.budgetMinutes > 0
          ? Math.round(((bucket?.totalMinutes ?? 0) / p.budgetMinutes) * 100)
          : null,
      employees,
      daily,
    };
  });

  return NextResponse.json({ projects: data });
});
