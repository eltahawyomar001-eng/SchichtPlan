import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureLegalBreak, executeCustomRules } from "@/lib/automations";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { clockActionSchema, validateBody } from "@/lib/validations";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { withRetry } from "@/lib/prisma-retry";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

/**
 * POST /api/time-entries/clock
 * Live punch-clock: clock-in, clock-out, break-start, break-end.
 *
 * Body: { action: "in" | "out" | "break-start" | "break-end" }
 */
export const POST = withRoute(
  "/api/time-entries/clock",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const employeeId = user.employeeId;
    const workspaceId = user.workspaceId;

    if (!employeeId || !workspaceId) {
      return NextResponse.json(
        { error: "NO_EMPLOYEE_PROFILE" },
        { status: 400 },
      );
    }

    const parsed = validateBody(clockActionSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { action, timezone } = parsed.data;
    const now = new Date();
    const tz = timezone || "Europe/Berlin";
    const timeStr = now.toLocaleTimeString("de-DE", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Date in the employee's timezone (may differ from UTC date near midnight)
    const localDateStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
    const [ly, lm, ld] = localDateStr.split("-").map(Number);
    const dateOnly = new Date(Date.UTC(ly, lm - 1, ld));

    // ── Clock In ──
    if (action === "in") {
      // Use a serializable transaction to prevent race conditions
      // (two simultaneous clock-ins both passing the findFirst check)
      let entry;
      try {
        entry = await withRetry(
          () =>
            prisma.$transaction(async (tx) => {
              const open = await tx.timeEntry.findFirst({
                where: { employeeId, isLiveClock: true, clockOutAt: null },
              });
              if (open) {
                throw new Error(`ALREADY_CLOCKED_IN:${open.id}`);
              }

              return tx.timeEntry.create({
                data: {
                  date: dateOnly,
                  startTime: timeStr,
                  endTime: timeStr,
                  isLiveClock: true,
                  clockInAt: now,
                  employeeId,
                  workspaceId,
                  status: "ENTWURF",
                },
              });
            }),
          "/api/time-entries/clock POST (clock-in)",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.startsWith("ALREADY_CLOCKED_IN:")) {
          const entryId = msg.split(":")[1];
          return NextResponse.json(
            { error: "ALREADY_CLOCKED_IN", entryId },
            { status: 409 },
          );
        }
        throw err;
      }

      // Fire custom automation rules
      executeCustomRules("time-entry.created", workspaceId, {
        id: entry.id,
        employeeId,
        date: localDateStr,
        startTime: timeStr,
        action: "clock-in",
      }).catch((err) => log.error("Custom rule error:", { error: err }));

      createAuditLog({
        action: "CREATE",
        entityType: "TimeEntry",
        entityId: entry.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        metadata: { action: "clock-in", time: timeStr },
      });

      dispatchWebhook(workspaceId, "time_entry.clock_in", {
        id: entry.id,
        employeeId,
      }).catch(() => {});

      return NextResponse.json(entry, { status: 201 });
    }

    // ── Break Start ──
    if (action === "break-start") {
      const entry = await prisma
        .$transaction(async (tx) => {
          const open = await tx.timeEntry.findFirst({
            where: { employeeId, isLiveClock: true, clockOutAt: null },
            orderBy: { clockInAt: "desc" },
          });
          if (!open) {
            throw new Error("NOT_CLOCKED_IN");
          }
          if (open.breakStart && !open.breakEnd) {
            throw new Error("BREAK_ALREADY_ACTIVE");
          }

          return tx.timeEntry.update({
            where: { id: open.id },
            data: { breakStart: timeStr },
          });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "";
          if (msg === "NOT_CLOCKED_IN") {
            return { error: "NOT_CLOCKED_IN", status: 404 as const };
          }
          if (msg === "BREAK_ALREADY_ACTIVE") {
            return { error: "BREAK_ALREADY_ACTIVE", status: 409 as const };
          }
          throw err;
        });

      if ("error" in entry) {
        return NextResponse.json(
          { error: entry.error },
          { status: entry.status },
        );
      }
      return NextResponse.json(entry);
    }

    // ── Break End ──
    if (action === "break-end") {
      const entry = await prisma
        .$transaction(async (tx) => {
          const open = await tx.timeEntry.findFirst({
            where: { employeeId, isLiveClock: true, clockOutAt: null },
            orderBy: { clockInAt: "desc" },
          });
          if (!open || !open.breakStart) {
            throw new Error("NO_ACTIVE_BREAK");
          }

          // Calculate break duration in minutes
          const bsMin = toMinutes(open.breakStart);
          const beMin = toMinutes(timeStr);
          const breakMinutes = Math.max(0, beMin - bsMin);

          return tx.timeEntry.update({
            where: { id: open.id },
            data: { breakEnd: timeStr, breakMinutes },
          });
        })
        .catch((err) => {
          if (err instanceof Error && err.message === "NO_ACTIVE_BREAK") {
            return { error: "NO_ACTIVE_BREAK", status: 404 as const };
          }
          throw err;
        });

      if ("error" in entry) {
        return NextResponse.json(
          { error: entry.error },
          { status: entry.status },
        );
      }
      return NextResponse.json(entry);
    }

    // ── Clock Out ──
    if (action === "out") {
      const entry = await withRetry(
        () =>
          prisma.$transaction(async (tx) => {
            const open = await tx.timeEntry.findFirst({
              where: { employeeId, isLiveClock: true, clockOutAt: null },
              orderBy: { clockInAt: "desc" },
            });
            if (!open) {
              throw new Error("NOT_CLOCKED_IN");
            }

            // If break is still running, auto-end it now
            let breakMinutes = open.breakMinutes || 0;
            let breakEnd = open.breakEnd;
            if (open.breakStart && !open.breakEnd) {
              const bsMin = toMinutes(open.breakStart);
              const beMin = toMinutes(timeStr);
              breakMinutes = Math.max(0, beMin - bsMin);
              breakEnd = timeStr;
            }

            const clockIn = open.clockInAt!;
            const diffMs = now.getTime() - clockIn.getTime();
            const grossMinutes = Math.round(diffMs / 60000);
            // ArbZG legal break enforcement
            const legalBreak = ensureLegalBreak(grossMinutes, breakMinutes);
            const netMinutes = Math.max(0, grossMinutes - legalBreak);

            return tx.timeEntry.update({
              where: { id: open.id },
              data: {
                endTime: timeStr,
                clockOutAt: now,
                breakEnd,
                breakMinutes: legalBreak,
                grossMinutes,
                netMinutes,
              },
            });
          }),
        "/api/time-entries/clock POST (clock-out)",
      ).catch((err) => {
        if (err instanceof Error && err.message === "NOT_CLOCKED_IN") {
          return { error: "NOT_CLOCKED_IN", status: 404 as const };
        }
        throw err;
      });

      if ("error" in entry) {
        return NextResponse.json(
          { error: entry.error },
          { status: entry.status },
        );
      }

      // Fire custom automation rules for clock-out
      executeCustomRules("time-entry.submitted", workspaceId, {
        id: entry.id,
        employeeId,
        date: localDateStr,
        startTime: entry.startTime,
        endTime: timeStr,
        grossMinutes: entry.grossMinutes,
        netMinutes: entry.netMinutes,
        breakMinutes: entry.breakMinutes,
        action: "clock-out",
      }).catch((err) => log.error("Custom rule error:", { error: err }));

      createAuditLog({
        action: "UPDATE",
        entityType: "TimeEntry",
        entityId: entry.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        metadata: { action: "clock-out", time: timeStr },
      });

      dispatchWebhook(workspaceId, "time_entry.clock_out", {
        id: entry.id,
        employeeId,
      }).catch(() => {});

      return NextResponse.json(entry);
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  },
);

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * GET /api/time-entries/clock
 * Returns current clock-in status + today's completed entries for the employee.
 */
export const GET = withRoute("/api/time-entries/clock", "GET", async (req) => {
  const { searchParams } = new URL(req.url);
  const tz = searchParams.get("timezone") || "Europe/Berlin";

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;
  const employeeId = user.employeeId;
  if (!employeeId) {
    return NextResponse.json({
      active: false,
      entry: null,
      todayEntries: [],
      noProfile: true,
    });
  }

  // Open (active) clock entry
  const open = await prisma.timeEntry.findFirst({
    where: { employeeId, isLiveClock: true, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });

  // Today's completed entries for the log (use client timezone)
  const localNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: tz }),
  );
  const todayStart = new Date(localNow);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(localNow);
  todayEnd.setHours(23, 59, 59, 999);

  const todayEntries = await prisma.timeEntry.findMany({
    where: {
      employeeId,
      isLiveClock: true,
      clockOutAt: { not: null },
      clockInAt: { gte: todayStart, lte: todayEnd },
    },
    orderBy: { clockInAt: "desc" },
  });

  return NextResponse.json({
    active: !!open,
    onBreak: open ? !!(open.breakStart && !open.breakEnd) : false,
    entry: open || null,
    todayEntries,
    noProfile: false,
  });
});
