/**
 * ArbZG (Arbeitszeitgesetz) compliance helpers.
 *
 * §3  — max 10h worked per day (enforced at clock-out via auto-clockout cron)
 * §4  — mandatory break after 6h / 9h (enforced via break-reminder cron)
 * §5  — min 11h uninterrupted rest between shifts (enforced HERE at scheduling)
 * §11 — Sunday rest (checked via isSunday / holiday helpers in routes)
 */

import { prisma } from "@/lib/db";

/** ArbZG §5 minimum rest period between shifts (hours). */
export const ARBZG_REST_HOURS = 11;
const REST_MS = ARBZG_REST_HOURS * 60 * 60 * 1000;

function toDateTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}

function resolveShiftEnd(date: Date, startTime: string, endTime: string): Date {
  const start = toDateTime(date, startTime);
  const end = toDateTime(date, endTime);
  // Overnight shift: endTime < startTime means end is on the following day
  if (end <= start) end.setDate(end.getDate() + 1);
  return end;
}

/**
 * Check ArbZG §5 (11h rest) for a new or updated shift.
 *
 * Queries existing shifts ±2 days around the proposed shift window
 * and verifies no gap is shorter than 11h.
 *
 * Returns { violation: false } when compliant.
 * Returns { violation: true, message, messageEn } when §5 would be breached.
 */
export async function checkArbZg5RestPeriod(params: {
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  workspaceId: string;
  excludeShiftId?: string;
}): Promise<{ violation: boolean; message?: string; messageEn?: string }> {
  const { employeeId, date, startTime, endTime, workspaceId, excludeShiftId } =
    params;

  const shiftDate = new Date(date);
  const newStart = toDateTime(shiftDate, startTime);
  const newEnd = resolveShiftEnd(shiftDate, startTime, endTime);

  // Search ±2 days — wide enough to catch any overnight shift
  const windowStart = new Date(newStart.getTime() - 2 * 86_400_000);
  const windowEnd = new Date(newEnd.getTime() + 2 * 86_400_000);

  const adjacent = await prisma.shift.findMany({
    where: {
      employeeId,
      workspaceId,
      date: { gte: windowStart, lte: windowEnd },
      ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
    },
    select: { date: true, startTime: true, endTime: true },
  });

  for (const s of adjacent) {
    const sDate = new Date(s.date);
    const sStart = toDateTime(sDate, s.startTime);
    const sEnd = resolveShiftEnd(sDate, s.startTime, s.endTime);

    // Previous shift ends before new shift starts
    if (sEnd <= newStart) {
      const gapMs = newStart.getTime() - sEnd.getTime();
      if (gapMs < REST_MS) {
        const gapH = Math.floor(gapMs / 3_600_000);
        const gapM = Math.floor((gapMs % 3_600_000) / 60_000);
        return {
          violation: true,
          message:
            `ArbZG §5: Unzureichende Ruhezeit. Zwischen Schichtende (${s.endTime}) und ` +
            `neuem Schichtbeginn (${startTime}) liegen nur ${gapH}h ${gapM}min — ` +
            `gesetzlich erforderlich sind mindestens ${ARBZG_REST_HOURS} Stunden.`,
          messageEn:
            `ArbZG §5: Insufficient rest period. Only ${gapH}h ${gapM}min between ` +
            `shift end (${s.endTime}) and new shift start (${startTime}). ` +
            `Statutory minimum is ${ARBZG_REST_HOURS} hours.`,
        };
      }
    }

    // Next shift starts after new shift ends
    if (sStart >= newEnd) {
      const gapMs = sStart.getTime() - newEnd.getTime();
      if (gapMs < REST_MS) {
        const gapH = Math.floor(gapMs / 3_600_000);
        const gapM = Math.floor((gapMs % 3_600_000) / 60_000);
        return {
          violation: true,
          message:
            `ArbZG §5: Unzureichende Ruhezeit. Zwischen neuem Schichtende (${endTime}) und ` +
            `folgendem Schichtbeginn (${s.startTime}) liegen nur ${gapH}h ${gapM}min — ` +
            `gesetzlich erforderlich sind mindestens ${ARBZG_REST_HOURS} Stunden.`,
          messageEn:
            `ArbZG §5: Insufficient rest period. Only ${gapH}h ${gapM}min between ` +
            `new shift end (${endTime}) and next shift start (${s.startTime}). ` +
            `Statutory minimum is ${ARBZG_REST_HOURS} hours.`,
        };
      }
    }
  }

  return { violation: false };
}

/**
 * ArbZG §4 — mandatory break advisory.
 *
 * §4 requires employers to provide breaks DURING the shift, not necessarily
 * to encode them in the schedule. We therefore return a non-blocking WARNING
 * (not a hard violation) so the UI can inform the manager.
 *
 * Thresholds:
 *  > 6h work → minimum 30 min break
 *  > 9h work → minimum 45 min break
 */
export function checkArbZg4BreakRequirement(
  startTime: string,
  endTime: string,
): {
  required: boolean;
  minBreakMinutes: number;
  message?: string;
  messageEn?: string;
} {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let durationMinutes = eh * 60 + em - (sh * 60 + sm);
  if (durationMinutes <= 0) durationMinutes += 24 * 60; // overnight

  if (durationMinutes > 9 * 60) {
    return {
      required: true,
      minBreakMinutes: 45,
      message: `Schichtdauer über 9 Stunden — ArbZG §4 schreibt mindestens 45 Minuten Pause vor.`,
      messageEn: `Shift duration exceeds 9 hours — ArbZG §4 requires at least 45 minutes of break time.`,
    };
  }
  if (durationMinutes > 6 * 60) {
    return {
      required: true,
      minBreakMinutes: 30,
      message: `Schichtdauer über 6 Stunden — ArbZG §4 schreibt mindestens 30 Minuten Pause vor.`,
      messageEn: `Shift duration exceeds 6 hours — ArbZG §4 requires at least 30 minutes of break time.`,
    };
  }
  return { required: false, minBreakMinutes: 0 };
}
