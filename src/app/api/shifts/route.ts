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
import { withRoute } from "@/lib/with-route";
import { requireSchichtplanungAddon } from "@/lib/schichtplanung-addon";

export const GET = withRoute("/api/shifts", "GET", async (req) => {
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

  // GDPR (DSGVO Art. 5(1)(c) / Art. 25): EMPLOYEE role must not receive PII
  // of colleagues. Strip employee fields for shifts not belonging to the
  // requesting employee and replace with a synthetic `isFilled` flag so the
  // UI can still render an "occupied" state without exposing personal data.
  const sanitised = isEmployee(user)
    ? shifts.map((shift) => {
        const isOwnShift =
          user.employeeId && shift.employeeId === user.employeeId;
        if (!isOwnShift && shift.employee) {
          return {
            ...shift,
            employee: null,
            notes: null, // notes may contain colleague's name
            isFilled: true,
          };
        }
        return { ...shift, isFilled: !!shift.employee };
      })
    : shifts.map((shift) => ({ ...shift, isFilled: !!shift.employee }));

  return paginatedResponse(sanitised, total, take, skip);
});

export const POST = withRoute(
  "/api/shifts",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Only OWNER, ADMIN, MANAGER can create shifts
    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    // Schichtplanung add-on gate (Enterprise always allowed)
    const addonRequired = await requireSchichtplanungAddon(workspaceId);
    if (addonRequired) return addonRequired;

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
      endDate,
      selectedDays,
    } = parsed.data;

    /* ══════════════════════════════════════════════════════════
     * BULK MODE — create shifts across a date range
     * Triggered when endDate is supplied.
     * selectedDays: 1=Mo … 7=Su (ISO weekday). If omitted → Mo–Fr.
     * ══════════════════════════════════════════════════════════ */
    if (endDate) {
      const rangeStart = new Date(date);
      const rangeEnd = new Date(endDate);
      if (rangeEnd < rangeStart) {
        return NextResponse.json(
          { error: "Enddatum darf nicht vor dem Startdatum liegen." },
          { status: 400 },
        );
      }
      // Max 90 days range to prevent abuse
      const rangeDays =
        Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) +
        1;
      if (rangeDays > 90) {
        return NextResponse.json(
          { error: "Maximal 90 Tage auf einmal planbar." },
          { status: 400 },
        );
      }

      // Default to weekdays (Mo–Fr = 1–5) when no days selected
      const days =
        selectedDays && selectedDays.length > 0
          ? selectedDays
          : [1, 2, 3, 4, 5];

      // Map JS getDay() (0=Su) → ISO weekday (1=Mo … 7=Su)
      const toIso = (jsDay: number) => (jsDay === 0 ? 7 : jsDay);

      const ws = await prisma.workspace?.findUnique?.({
        where: { id: workspaceId },
        select: { bundesland: true },
      });
      const bundesland = ws?.bundesland || "HE";

      let created = 0;
      let skipped = 0;
      const conflicts: string[] = [];

      const cursor = new Date(rangeStart);
      while (cursor <= rangeEnd) {
        const isoDay = toIso(cursor.getDay());
        if (days.includes(isoDay)) {
          const dateStr = cursor.toLocaleDateString("en-CA");

          // Conflict check
          if (employeeId) {
            const c = await checkShiftConflicts({
              employeeId,
              date: dateStr,
              startTime,
              endTime,
              workspaceId,
            });
            if (c.length > 0) {
              skipped++;
              conflicts.push(
                `${new Date(dateStr).toLocaleDateString("de-DE")}: ${c[0].message}`,
              );
              cursor.setDate(cursor.getDate() + 1);
              continue;
            }
          }

          // Surcharges
          const sd = new Date(dateStr);
          const hol = isPublicHoliday(sd, bundesland);
          const sun = isSunday(sd);
          const night = isNightShift(startTime, endTime);
          const surch = calculateSurcharge({
            isNight: night,
            isSunday: sun,
            isHoliday: hol.isHoliday,
          });

          await prisma.shift.create({
            data: {
              date: sd,
              startTime,
              endTime,
              notes: notes || null,
              status: employeeId ? "SCHEDULED" : "OPEN",
              employeeId: employeeId || null,
              locationId: locationId || null,
              isNightShift: night,
              isHolidayShift: hol.isHoliday,
              isSundayShift: sun,
              surchargePercent: surch,
              workspaceId,
            },
          });
          created++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // Audit log for bulk operation
      await createAuditLogTx(prisma, {
        action: "CREATE",
        entityType: "shift",
        entityId: "bulk",
        userId: user.id,
        userEmail: user.email ?? undefined,
        workspaceId,
        changes: {
          bulkCreated: created,
          bulkSkipped: skipped,
          dateRange: `${date} → ${endDate}`,
          selectedDays: days,
        },
      });

      return NextResponse.json(
        { created, skipped, conflicts },
        { status: 201 },
      );
    }

    /* ══════════════════════════════════════════════════════════
     * SINGLE MODE — original single-shift creation
     * ══════════════════════════════════════════════════════════ */
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
  },
  { idempotent: true },
);
