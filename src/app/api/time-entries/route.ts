import { NextResponse } from "next/server";
import { prisma, withWorkspaceContext } from "@/lib/db";
import { isEmployee } from "@/lib/authorization";
import {
  validateTimeEntry,
  calcGrossMinutes,
  calcBreakMinutes,
  calcNetMinutes,
} from "@/lib/time-utils";
import { ensureLegalBreak } from "@/lib/automations";
import { dispatchWebhook } from "@/lib/webhooks";
import {
  resolveOwnEmployeeScope,
  applyOwnEmployeeScope,
} from "@/lib/ownership";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError, parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import {
  createTimeEntrySchema,
  validateBody,
  parseOptionalDateQueryParam,
} from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

// ─── GET  /api/time-entries ─────────────────────────────────────
export const GET = withRoute("/api/time-entries", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const status = searchParams.get("status");

  const startResult = parseOptionalDateQueryParam(
    searchParams.get("start"),
    "start",
  );
  if (!startResult.ok) return startResult.response;
  const endResult = parseOptionalDateQueryParam(searchParams.get("end"), "end");
  if (!endResult.ok) return endResult.response;

  const where: Record<string, unknown> = { workspaceId, deletedAt: null };

  if (startResult.date && endResult.date) {
    where.date = { gte: startResult.date, lte: endResult.date };
  }
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;

  const { take, skip } = parsePagination(req);

  // Employees can only see their own entries — overrides any employeeId param,
  // and (unlike the previous inline check) returns nothing rather than falling
  // through to all entries when the employee has no linked profile.
  const scope = await resolveOwnEmployeeScope(user, workspaceId);
  if (!applyOwnEmployeeScope(where, scope)) {
    return paginatedResponse([], 0, take, skip);
  }

  const [entries, total] = await withWorkspaceContext(workspaceId, async (tx) =>
    Promise.all([
      tx.timeEntry.findMany({
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
      tx.timeEntry.count({ where }),
    ]),
  );

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

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(createTimeEntrySchema, _json.data);
    if (!parsed.success) return parsed.response;
    const data = parsed.data;

    // EMPLOYEE can only create time entries for themselves
    if (isEmployee(user)) {
      const linkedEmployee = await prisma.employee.findFirst({
        where: { workspaceId, email: user.email ?? undefined },
      });
      if (!linkedEmployee || data.employeeId !== linkedEmployee.id) {
        return NextResponse.json(
          { error: "ONLY_OWN_ENTRIES" },
          { status: 403 },
        );
      }
    }

    // Validate
    const errors = validateTimeEntry(data);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Overlap check
    const existingEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId: data.employeeId,
        date: new Date(data.date),
        status: { not: "ZURUECKGEWIESEN" },
      },
    });

    const newStart = data.startTime;
    const newEnd = data.endTime;
    for (const entry of existingEntries) {
      if (timesOverlap(entry.startTime, entry.endTime, newStart, newEnd)) {
        return NextResponse.json(
          { error: "Overlap with existing entry" },
          { status: 409 },
        );
      }
    }

    // ArbZG § 3: enforce 10-hour daily net cap on manual entries for employees
    // Managers can override via the approval workflow; employees cannot self-report >10h
    if (user.role === "EMPLOYEE") {
      const dayTotal = existingEntries.reduce(
        (sum, e) => sum + (e.netMinutes ?? 0),
        0,
      );
      const newNet = calcNetMinutes(
        calcGrossMinutes(data.startTime, data.endTime),
        calcBreakMinutes(data.breakStart, data.breakEnd, data.breakMinutes),
      );
      if (dayTotal + newNet > 600) {
        return NextResponse.json(
          { error: "DAILY_LIMIT_EXCEEDED", limitMinutes: 600 },
          { status: 422 },
        );
      }
    }

    // Calculate durations
    const grossMinutes = calcGrossMinutes(data.startTime, data.endTime);
    const rawBreakMins = calcBreakMinutes(
      data.breakStart,
      data.breakEnd,
      data.breakMinutes,
    );
    // ── Automation: Ensure ArbZG minimum break ──
    const breakMins = ensureLegalBreak(grossMinutes, rawBreakMins);
    const netMinutes = calcNetMinutes(grossMinutes, breakMins);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          date: new Date(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          breakStart: data.breakStart || null,
          breakEnd: data.breakEnd || null,
          breakMinutes: breakMins,
          grossMinutes,
          netMinutes,
          remarks: data.remarks || null,
          employeeId: data.employeeId,
          locationId: data.locationId || null,
          shiftId: data.shiftId || null,
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
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      employeeId: data.employeeId,
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
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        employeeId: data.employeeId,
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
