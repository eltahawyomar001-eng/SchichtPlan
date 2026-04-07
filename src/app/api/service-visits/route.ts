import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { createServiceVisitSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";
import { createVisitAuditEntry } from "@/lib/visit-audit";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

// ─── GET  /api/service-visits ───────────────────────────────────
export const GET = withRoute("/api/service-visits", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const forbidden = requirePermission(user, "service-visits", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const employeeId = searchParams.get("employeeId");
  const locationId = searchParams.get("locationId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const reportId = searchParams.get("reportId");

  const where: Record<string, unknown> = { workspaceId };
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;
  if (locationId) where.locationId = locationId;
  if (reportId) where.reportId = reportId;

  if (dateFrom || dateTo) {
    where.scheduledDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  // EMPLOYEE can only see their own visits
  if (isEmployee(user) && user.employeeId) {
    where.employeeId = user.employeeId;
  }

  const { take, skip } = parsePagination(req);

  const [visits, total] = await Promise.all([
    prisma.serviceVisit.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        signature: true,
      },
      orderBy: { scheduledDate: "desc" },
      take,
      skip,
    }),
    prisma.serviceVisit.count({ where }),
  ]);

  return paginatedResponse(visits, total, take, skip);
});

// ─── POST  /api/service-visits ──────────────────────────────────
export const POST = withRoute(
  "/api/service-visits",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-visits", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(createServiceVisitSchema, body);
    if (!parsed.success) return parsed.response;

    const {
      scheduledDate,
      employeeId: rawEmployeeId,
      locationId,
      notes,
    } = parsed.data;

    // EMPLOYEE can only create visits for themselves
    let effectiveEmployeeId = rawEmployeeId;
    if (isEmployee(user)) {
      if (!user.employeeId) {
        return NextResponse.json(
          { error: "Kein Mitarbeiterprofil verknüpft" },
          { status: 400 },
        );
      }
      effectiveEmployeeId = user.employeeId;
    }

    // Verify employee and location belong to workspace
    const [employee, location] = await Promise.all([
      prisma.employee.findFirst({
        where: { id: effectiveEmployeeId, workspaceId },
      }),
      prisma.location.findFirst({
        where: { id: locationId, workspaceId },
      }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: "Mitarbeiter nicht gefunden" },
        { status: 404 },
      );
    }
    if (!location) {
      return NextResponse.json(
        { error: "Standort nicht gefunden" },
        { status: 404 },
      );
    }

    const visit = await prisma.serviceVisit.create({
      data: {
        scheduledDate: new Date(scheduledDate),
        notes: notes || null,
        employeeId: effectiveEmployeeId,
        locationId,
        workspaceId,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        location: { select: { id: true, name: true, address: true } },
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "service-visit",
      entityId: visit.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    dispatchWebhook(workspaceId, "service_visit.created", {
      id: visit.id,
      employeeId: effectiveEmployeeId,
      locationId,
    }).catch(() => {});

    // Revisionssicher audit trail entry
    createVisitAuditEntry(req, {
      eventType: "VISIT_CREATED",
      visitId: visit.id,
      userId: user.id,
      workspaceId,
      metadata: { employeeId: effectiveEmployeeId, locationId, scheduledDate },
    });

    log.info("[service-visits] Visit created", {
      visitId: visit.id,
      locationId,
      employeeId: effectiveEmployeeId,
    });

    return NextResponse.json(visit, { status: 201 });
  },
  { idempotent: true },
);
