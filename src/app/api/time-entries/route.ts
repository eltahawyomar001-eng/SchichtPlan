import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isEmployee } from "@/lib/authorization";
import {
  validateTimeEntry,
  calcGrossMinutes,
  calcBreakMinutes,
  calcNetMinutes,
} from "@/lib/time-utils";
import { ensureLegalBreak } from "@/lib/automations";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { createTimeEntrySchema, validateBody } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

// ─── GET  /api/time-entries ─────────────────────────────────────
export const GET = withRoute("/api/time-entries", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");
  const employeeId = searchParams.get("employeeId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { workspaceId };

  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;

  // Employees can only see their own entries
  if (user.role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { workspaceId, email: user.email ?? undefined },
    });
    if (employee) where.employeeId = employee.id;
  }

  const { take, skip } = parsePagination(req);

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      include: {
        employee: true,
        location: true,
        auditLog: { orderBy: { performedAt: "desc" }, take: 5 },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take,
      skip,
    }),
    prisma.timeEntry.count({ where }),
  ]);

  return paginatedResponse(entries, total, take, skip);
});

// ─── POST  /api/time-entries ────────────────────────────────────
export const POST = withRoute(
  "/api/time-entries",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const body = await req.json();
    const parsed = validateBody(createTimeEntrySchema, body);
    if (!parsed.success) return parsed.response;

    // EMPLOYEE can only create time entries for themselves
    if (isEmployee(user)) {
      const linkedEmployee = await prisma.employee.findFirst({
        where: { workspaceId, email: user.email ?? undefined },
      });
      if (!linkedEmployee || body.employeeId !== linkedEmployee.id) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Sie können nur eigene Zeiteinträge erstellen.",
          },
          { status: 403 },
        );
      }
    }

    // Validate
    const errors = validateTimeEntry(body);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Overlap check
    const existingEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId: body.employeeId,
        date: new Date(body.date),
        status: { not: "ZURUECKGEWIESEN" },
      },
    });

    const newStart = body.startTime;
    const newEnd = body.endTime;
    for (const entry of existingEntries) {
      if (timesOverlap(entry.startTime, entry.endTime, newStart, newEnd)) {
        return NextResponse.json(
          { error: "Overlap with existing entry" },
          { status: 409 },
        );
      }
    }

    // Calculate durations
    const grossMinutes = calcGrossMinutes(body.startTime, body.endTime);
    const rawBreakMins = calcBreakMinutes(
      body.breakStart,
      body.breakEnd,
      body.breakMinutes,
    );
    // ── Automation: Ensure ArbZG minimum break ──
    const breakMins = ensureLegalBreak(grossMinutes, rawBreakMins);
    const netMinutes = calcNetMinutes(grossMinutes, breakMins);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          date: new Date(body.date),
          startTime: body.startTime,
          endTime: body.endTime,
          breakStart: body.breakStart || null,
          breakEnd: body.breakEnd || null,
          breakMinutes: breakMins,
          grossMinutes,
          netMinutes,
          remarks: body.remarks || null,
          employeeId: body.employeeId,
          locationId: body.locationId || null,
          shiftId: body.shiftId || null,
          workspaceId,
        },
        include: { employee: true, location: true },
      });

      // Create audit log entry (atomic)
      await tx.timeEntryAudit.create({
        data: {
          action: "CREATED",
          performedBy: user.id,
          timeEntryId: created.id,
        },
      });

      return created;
    });

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId, "time-entry.created", {
      id: entry.id,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      employeeId: body.employeeId,
      grossMinutes,
      netMinutes,
    }).catch((err) =>
      log.error("[webhook] time-entry.created dispatch error", { error: err }),
    );

    createAuditLog({
      action: "CREATE",
      entityType: "TimeEntry",
      entityId: entry.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: {
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        employeeId: body.employeeId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  },
  { idempotent: true },
);

// ─── Helpers ────────────────────────────────────────────────────

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const a0 = toMin(aStart);
  let a1 = toMin(aEnd);
  if (a1 <= a0) a1 += 1440;
  const b0 = toMin(bStart);
  let b1 = toMin(bEnd);
  if (b1 <= b0) b1 += 1440;
  return a0 < b1 && b0 < a1;
}
