/* ─────────────────────────────────────────────────────────────────
   GET /api/timesheet/import/[id]
   ─────────────────────────────────────────────────────────────────
   Refetch a staged (PENDING_REVIEW) import for the Review & Edit screen
   on web or mobile. Tenant-scoped: only returns imports in the caller's
   workspace.
   ───────────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { withWorkspaceContext } from "@/lib/db";
import { requireAuth, notFound } from "@/lib/api-response";
import { requireManagement } from "@/lib/authorization";

export const runtime = "nodejs";

export const GET = withRoute(
  "/api/timesheet/import/[id]",
  "GET",
  async (_req, context) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const gate = requireManagement(user);
    if (gate) return gate;

    const { id } = await context!.params;

    const imp = await withWorkspaceContext(workspaceId, (tx) =>
      tx.timesheetImport.findFirst({
        where: { id, workspaceId },
        include: {
          entries: {
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
          },
        },
      }),
    );

    if (!imp) return notFound("Import not found");

    return NextResponse.json({
      importId: imp.id,
      status: imp.status,
      source: imp.source,
      missingEmployees: JSON.parse(imp.missingEmployees) as string[],
      entries: imp.entries.map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
        date: e.date.toISOString().slice(0, 10),
        shiftStart: e.startTime,
        shiftEnd: e.endTime,
        breakMinutes: e.breakMinutes,
        status: e.status,
        confidence: e.confidence,
        confidenceScores: JSON.parse(e.confidenceScores) as Record<
          string,
          number
        >,
      })),
    });
  },
);
