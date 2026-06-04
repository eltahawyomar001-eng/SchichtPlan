import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { verifyQrToken } from "@/lib/qr-token";
import { hashPin } from "@/lib/employee-pin";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { capWorkTimeAtLimit, getTodayWorkedMinutes } from "@/lib/automations";
import {
  checkPinLockout,
  recordPinFailure,
  clearPinAttempts,
  consumePunch,
  tokenSignature,
} from "@/lib/qr-lockout";

/**
 * POST /api/qr-clock/punch
 *
 * Public endpoint. Verifies QR token + 4-digit PIN, then clocks the matching
 * employee in or out. No employee list is ever returned — identity is confirmed
 * solely via the PIN, preventing buddy-punching.
 *
 * Body: { token: string; pin: string; action: "in" | "out" }
 */
export const POST = withRoute("/api/qr-clock/punch", "POST", async (req) => {
  let body: { token?: string; pin?: string; action?: string };
  try {
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    body = _json.data as typeof body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { token, pin, action } = body ?? {};

  if (!token || !pin || !action) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (action !== "in" && action !== "out") {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "INVALID_PIN_FORMAT" }, { status: 400 });
  }

  const verified = verifyQrToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      { status: 401 },
    );
  }
  const { workspaceId, exp } = verified;

  // C-1: Reject if too many wrong PINs for this token window
  const tokenSig = tokenSignature(token);
  const lockoutSec = await checkPinLockout(workspaceId, tokenSig);
  if (lockoutSec > 0) {
    return NextResponse.json(
      { error: "PIN_LOCKED", retryAfter: lockoutSec },
      { status: 429 },
    );
  }

  const pinHash = hashPin(workspaceId, pin);
  const employee = await prisma.employee.findFirst({
    where: { workspaceId, pinHash, isActive: true, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!employee) {
    await recordPinFailure(workspaceId, tokenSig);
    return NextResponse.json({ error: "INVALID_PIN" }, { status: 404 });
  }

  // C-2: Each (employee, action) pair may only punch once per token window
  const tokenTtlSec = Math.ceil((exp - Date.now()) / 1000);
  const firstUse = await consumePunch(
    employee.id,
    action,
    tokenSig,
    tokenTtlSec,
  );
  if (!firstUse) {
    return NextResponse.json({ error: "TOKEN_ALREADY_USED" }, { status: 409 });
  }

  const employeeId = employee.id;
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

      await clearPinAttempts(workspaceId, tokenSig);
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
      if (err instanceof Error && err.message === "ALREADY_CLOCKED_IN") {
        return NextResponse.json(
          { error: "ALREADY_CLOCKED_IN" },
          { status: 409 },
        );
      }
      // Partial unique index rejected a concurrent second punch (double-tap on
      // the kiosk). Treat as the canonical already-clocked-in conflict.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
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
      const grossMinutes = Math.floor(diffMs / 60000);

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

  await clearPinAttempts(workspaceId, tokenSig);
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
