import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import {
  checkShiftConflicts,
  createRecurringShifts,
  createSystemNotification,
  executeCustomRules,
} from "@/lib/automations";
import {
  isPublicHoliday,
  isSunday,
  isNightShift,
  calculateSurcharge,
} from "@/lib/holidays";
import { createShiftSchema, validateBody } from "@/lib/validations";
import { createAuditLogTx } from "@/lib/audit";
import { captureRouteError } from "@/lib/sentry";
import { dispatchWebhook } from "@/lib/webhooks";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { requireAuth, serverError } from "@/lib/api-response";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const where: {
      workspaceId: string;
      date?: { gte: Date; lte: Date };
      employeeId?: string;
    } = {
      workspaceId,
    };

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // EMPLOYEE can only see their own shifts
    if (isEmployee(user) && user.employeeId) {
      where.employeeId = user.employeeId;
    }

    const { take, skip } = parsePagination(req);

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          employee: true,
          location: true,
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take,
        skip,
      }),
      prisma.shift.count({ where }),
    ]);

    return paginatedResponse(shifts, total, take, skip);
  } catch (error) {
    log.error("Error fetching shifts:", { error: error });
    captureRouteError(error, { route: "/api/shifts", method: "GET" });
    return serverError("Error loading");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER, ADMIN, MANAGER can create shifts
    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(createShiftSchema, body);
    if (!parsed.success) return parsed.response;
    const {
      date,
      startTime,
      endTime,
      employeeId,
      locationId,
      notes,
      repeatWeeks,
    } = parsed.data;

    // ── Automation: Conflict detection (only if assigned) ──
    if (employeeId) {
      const conflicts = await checkShiftConflicts({
        employeeId,
        date,
        startTime,
        endTime,
        workspaceId,
      });

      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: "Conflicts detected",
            conflicts,
          },
          { status: 409 },
        );
      }
    }

    // ── Auto-detect surcharges ──
    const shiftDate = new Date(date);

    // Get workspace Bundesland for holiday check
    const ws = await prisma.workspace?.findUnique?.({
      where: { id: workspaceId },
      select: { bundesland: true },
    });
    const bundesland = ws?.bundesland || "HE";

    const holidayCheck = isPublicHoliday(shiftDate, bundesland);
    const sundayCheck = isSunday(shiftDate);
    const nightCheck = isNightShift(startTime, endTime);
    const surcharge = calculateSurcharge({
      isNight: nightCheck,
      isSunday: sundayCheck,
      isHoliday: holidayCheck.isHoliday,
    });

    // ── Create the shift + audit log atomically ──
    const { shift, recurringResult } = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdShift = await (tx.shift.create as any)({
        data: {
          date: new Date(date),
          startTime,
          endTime,
          notes: notes || null,
          status: employeeId ? "SCHEDULED" : "OPEN",
          employeeId: employeeId || null,
          locationId: locationId || null,
          isNightShift: nightCheck,
          isHolidayShift: holidayCheck.isHoliday,
          isSundayShift: sundayCheck,
          surchargePercent: surcharge,
          workspaceId,
        },
        include: {
          employee: true,
          location: true,
        },
      });

      // ── Audit log (atomic) ──
      await createAuditLogTx(tx, {
        action: "CREATE",
        entityType: "shift",
        entityId: createdShift.id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId,
        changes: { date, startTime, endTime, employeeId, locationId },
      });

      // ── Automation: Recurring shifts ──
      let recurResult = null;
      if (repeatWeeks && repeatWeeks > 0) {
        recurResult = await createRecurringShifts({
          baseShift: {
            date,
            startTime,
            endTime,
            employeeId: employeeId ?? "",
            locationId: locationId || null,
            notes: notes || null,
          },
          repeatWeeks: Math.min(repeatWeeks, 52),
          workspaceId,
        });
      }

      return { shift: createdShift, recurringResult: recurResult };
    });

    // ── Automation: Notify employee about new shift ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shiftAny = shift as any;
    if (shiftAny.employee) {
      const employeeName = `${shiftAny.employee.firstName} ${shiftAny.employee.lastName}`;
      log.info(
        `[shifts/POST] Shift created for ${employeeName}, email=${shiftAny.employee.email ?? "NONE"}, phone=${shiftAny.employee.phone ?? "NONE"}`,
      );
      if (shiftAny.employee.email) {
        await createSystemNotification({
          type: "SHIFT_ASSIGNED",
          title: "Neue Schicht zugewiesen",
          message: `Ihnen wurde eine Schicht am ${new Date(date).toLocaleDateString("de-DE")} (${startTime}–${endTime}) zugewiesen.`,
          link: "/schichtplan",
          workspaceId,
          recipientType: "employee",
          employeeEmail: shiftAny.employee.email,
        });
      } else {
        log.warn(
          `[shifts/POST] Employee ${employeeName} has no email — notification skipped entirely`,
        );
      }
    } else {
      log.info(`[shifts/POST] Open shift created (no employee assigned)`);
    }

    // ── Automation: Execute custom rules ──
    const shiftContext = {
      id: shift.id,
      date,
      startTime,
      endTime,
      employeeId: employeeId || "",
      employeeEmail: shiftAny?.employee?.email || "",
      status: shift.status,
      surchargePercent: surcharge,
      isNightShift: nightCheck,
      isSundayShift: sundayCheck,
      isHolidayShift: holidayCheck.isHoliday,
    };
    executeCustomRules("shift.created", workspaceId, shiftContext).catch(
      (err) => log.error("Custom rule execution error:", { error: err }),
    );

    // ── Webhook dispatch (fire & forget) ──
    dispatchWebhook(workspaceId, "shift.created", {
      id: shift.id,
      date,
      startTime,
      endTime,
      employeeId,
      locationId,
    }).catch((err) =>
      log.error("[webhook] shift.created dispatch error", { error: err }),
    );

    return NextResponse.json(
      { ...shift, recurring: recurringResult },
      { status: 201 },
    );
  } catch (error) {
    log.error("Error creating shift:", { error: error });
    captureRouteError(error, { route: "/api/shifts", method: "POST" });
    return serverError("Error creating resource");
  }
}
