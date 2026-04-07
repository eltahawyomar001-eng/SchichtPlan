import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createServiceReportSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

// ─── GET  /api/service-reports ──────────────────────────────────
export const GET = withRoute("/api/service-reports", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const forbidden = requirePermission(user, "service-reports", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.status = status;

  const { take, skip } = parsePagination(req);

  const [reports, total] = await Promise.all([
    prisma.serviceReport.findMany({
      where,
      include: {
        _count: { select: { visits: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.serviceReport.count({ where }),
  ]);

  return paginatedResponse(reports, total, take, skip);
});

// ─── POST  /api/service-reports ─────────────────────────────────
export const POST = withRoute(
  "/api/service-reports",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-reports", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(createServiceReportSchema, body);
    if (!parsed.success) return parsed.response;

    const { title, periodStart, periodEnd, locationId } = parsed.data;

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    // Count visits in range
    const visitWhere: Record<string, unknown> = {
      workspaceId,
      scheduledDate: { gte: periodStartDate, lte: periodEndDate },
    };
    if (locationId) visitWhere.locationId = locationId;

    const [totalVisits, completedVisits] = await Promise.all([
      prisma.serviceVisit.count({ where: visitWhere }),
      prisma.serviceVisit.count({
        where: { ...visitWhere, status: "ABGESCHLOSSEN" },
      }),
    ]);

    // Create report and link completed visits
    const report = await prisma.serviceReport.create({
      data: {
        title,
        periodStart: periodStartDate,
        periodEnd: periodEndDate,
        totalVisits,
        completedVisits,
        workspaceId,
      },
    });

    // Link all visits in the period to this report
    await prisma.serviceVisit.updateMany({
      where: { ...visitWhere, reportId: null },
      data: { reportId: report.id },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "service-report",
      entityId: report.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { title, totalVisits, completedVisits },
    });

    log.info("[service-reports] Report created", {
      reportId: report.id,
      totalVisits,
      completedVisits,
    });

    dispatchWebhook(workspaceId, "service_report.created", {
      id: report.id,
      title,
      totalVisits,
    }).catch(() => {});

    return NextResponse.json(report, { status: 201 });
  },
  { idempotent: true },
);
