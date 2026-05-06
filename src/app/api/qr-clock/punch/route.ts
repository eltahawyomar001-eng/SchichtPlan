import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { verifyQrToken } from "@/lib/qr-token";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { capWorkTimeAtLimit, getTodayWorkedMinutes } from "@/lib/automations";

/**
 * POST /api/qr-clock/punch
 *
 * Public endpoint (no session required).
 * Body: { token: string; employeeId: string; action: "in" | "out" }
 *
 * Validates the short-lived QR token, then records a clock-in or clock-out
 * for the given employee. Intentionally simpler than the full punch-clock:
 *   - No break tracking (use the dashboard for that)
 *   - No ArbZG soft-block — just a hard cap at clock-out
 *   - Timezone always "Europe/Berlin" (station is on-premises)
 */
export const POST = withRoute("/api/qr-clock/punch", "POST", async (req) => {
  let body: { token?: string; employeeId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { token, employeeId, action } = body ?? {};

  if (!token || !employeeId || !action) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (action !== "in" && action !== "out") {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }

  const workspaceId = verifyQrToken(token);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      { status: 401 },
    );
  }

  // Verify employee belongs to this workspace
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, workspaceId, isActive: true, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "EMPLOYEE_NOT_FOUND" }, { status: 404 });
  }

  const tz = "Europe/Berlin";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("de-DE", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: tz });
  const [ly, lm, ld] = localDateStr.split("-").map(Number);
  const dateOnly = new Date(Date.UTC(ly, lm - 1, ld));

  // ── Clock In ──
  if (action === "in") {
    try {
      const entry = await prisma.$transaction(async (tx) => {
        const open = await tx.timeEntry.findFirst({
          where: { employeeId, isLiveClock: true, clockOutAt: null },
        });
        if (open) throw new Error("ALREADY_CLOCKED_IN");

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
      });

      return NextResponse.json(
        {
          action: "in",
          employeeName: `${employee.firstName} ${employee.lastName}`,
          time: timeStr,
          entryId: entry.id,
        },
        { status: 201 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "ALREADY_CLOCKED_IN") {
        return NextResponse.json(
          { error: "ALREADY_CLOCKED_IN" },
          { status: 409 },
        );
      }
      log.error("[QR Punch] clock-in failed", { err, employeeId });
      throw err;
    }
  }

  // ── Clock Out ──
  const entry = await prisma
    .$transaction(async (tx) => {
      const open = await tx.timeEntry.findFirst({
        where: { employeeId, isLiveClock: true, clockOutAt: null },
        orderBy: { clockInAt: "desc" },
      });
      if (!open) throw new Error("NOT_CLOCKED_IN");

      let breakMinutes = open.breakMinutes || 0;
      let breakEnd = open.breakEnd;
      if (open.breakStart && !open.breakEnd) {
        const bsMin = toMinutes(open.breakStart);
        const beMin = toMinutes(timeStr);
        breakMinutes = breakMinutes + Math.max(0, beMin - bsMin);
        breakEnd = timeStr;
      }

      const diffMs = now.getTime() - open.clockInAt!.getTime();
      const grossMinutes = Math.round(diffMs / 60000);

      const todayPrevious = await getTodayWorkedMinutes(
        employeeId,
        dateOnly,
        tz,
      );
      const capped = capWorkTimeAtLimit(
        grossMinutes,
        breakMinutes,
        todayPrevious,
      );

      return tx.timeEntry.update({
        where: { id: open.id },
        data: {
          endTime: timeStr,
          clockOutAt: now,
          breakEnd,
          breakMinutes: capped.breakMinutes,
          grossMinutes: capped.cappedGross,
          netMinutes: capped.cappedNet,
          ...(capped.wasCapped
            ? { remarks: "ArbZG §3: Arbeitszeit auf 10h-Tageslimit gekappt" }
            : {}),
        },
      });
    })
    .catch((err) => {
      if (err instanceof Error && err.message === "NOT_CLOCKED_IN") {
        return { error: "NOT_CLOCKED_IN", status: 404 as const };
      }
      throw err;
    });

  if ("error" in entry) {
    return NextResponse.json({ error: entry.error }, { status: entry.status });
  }

  return NextResponse.json({
    action: "out",
    employeeName: `${employee.firstName} ${employee.lastName}`,
    time: timeStr,
    netMinutes: entry.netMinutes,
    entryId: entry.id,
  });
});

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
