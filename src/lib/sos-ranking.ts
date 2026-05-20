import { prisma } from "@/lib/db";
import { sendPushNotification } from "@/lib/notifications/push";
import { sendEmail } from "@/lib/notifications/email";
import { randomUUID } from "crypto";
import type { Shift } from "@prisma/client";

export interface RankedEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  color: string | null;
  userId: string | null;
  reliabilityScore: number;
  pickups: number;
  totalNotified: number;
  tier: number;
}

const TIER_SIZES = [5, 10, 20] as const;

function computeReliability(pickups: number, total: number): number {
  if (total === 0) return 50;
  return Math.round((pickups / total) * 100);
}

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function rankEmployeesForSos(
  shift: Shift,
  workspaceId: string,
  excludeEmployeeId?: string | null,
): Promise<RankedEmployee[]> {
  const employees = await prisma.employee.findMany({
    where: { workspaceId, isActive: true, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      color: true,
      userId: true,
      sosNotifications: {
        where: {
          sosRequest: { status: { in: ["FILLED", "EXPIRED", "CANCELLED"] } },
        },
        select: { response: true },
      },
      shifts: {
        where: {
          date: shift.date,
          deletedAt: null,
          status: { notIn: ["CANCELLED"] },
        },
        select: { startTime: true, endTime: true },
      },
      absenceRequests: {
        where: {
          startDate: { lte: shift.date },
          endDate: { gte: shift.date },
          status: "GENEHMIGT",
        },
        select: { id: true },
      },
    },
  });

  const scored: RankedEmployee[] = [];

  for (const emp of employees) {
    if (emp.id === excludeEmployeeId) continue;
    if (emp.absenceRequests.length > 0) continue;
    const hasConflict = emp.shifts.some((s) =>
      timesOverlap(shift.startTime, shift.endTime, s.startTime, s.endTime),
    );
    if (hasConflict) continue;

    const pickups = emp.sosNotifications.filter(
      (n) => n.response === "ACCEPTED",
    ).length;
    const total = emp.sosNotifications.length;

    scored.push({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      color: emp.color,
      userId: emp.userId,
      reliabilityScore: computeReliability(pickups, total),
      pickups,
      totalNotified: total,
      tier: 0,
    });
  }

  scored.sort((a, b) => {
    if (b.reliabilityScore !== a.reliabilityScore)
      return b.reliabilityScore - a.reliabilityScore;
    return a.firstName.localeCompare(b.firstName);
  });

  let cursor = 0;
  for (let t = 0; t < TIER_SIZES.length; t++) {
    const end = cursor + TIER_SIZES[t];
    for (let i = cursor; i < Math.min(end, scored.length); i++)
      scored[i].tier = t + 1;
    cursor = end;
  }

  return scored;
}

export async function notifyEmployeeTier(
  sosRequestId: string,
  employees: RankedEmployee[],
  tier: number,
  shift: Shift & { location?: { name: string } | null },
  bonusAmount: number | null,
  bonusCurrency: string,
  bonusNote: string | null,
  locale = "de",
): Promise<void> {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://www.shiftfy.de");

  const shiftDate = new Date(shift.date).toLocaleDateString(
    locale === "en" ? "en-GB" : "de-DE",
    { weekday: "short", day: "2-digit", month: "2-digit" },
  );
  const timeRange = `${shift.startTime} – ${shift.endTime}`;
  const locationName = shift.location?.name ?? "";
  const bonusLine =
    bonusAmount && bonusAmount > 0
      ? `${bonusAmount.toFixed(2)} ${bonusCurrency}${bonusNote ? ` (${bonusNote})` : ""}`
      : null;

  const pushTitle =
    locale === "en"
      ? "🚨 Emergency Shift Needed!"
      : "🚨 Notfall-Schicht gesucht!";

  await Promise.allSettled(
    employees.map(async (emp) => {
      const token = randomUUID();
      const respondUrl = `${baseUrl}/sos/respond?token=${token}`;

      await prisma.sosNotification.upsert({
        where: {
          sosRequestId_employeeId: { sosRequestId, employeeId: emp.id },
        },
        create: {
          sosRequestId,
          employeeId: emp.id,
          tier,
          responseToken: token,
        },
        update: {},
      });

      if (emp.userId) {
        const pushBody = `${shiftDate}, ${timeRange}${locationName ? ` · ${locationName}` : ""}${bonusLine ? ` · Bonus: ${bonusLine}` : ""}`;
        await sendPushNotification({
          userId: emp.userId,
          title: pushTitle,
          body: pushBody,
          url: respondUrl,
          tag: `sos-${sosRequestId}`,
        }).catch(() => {});
      }

      if (emp.email) {
        const subject =
          locale === "en"
            ? "🚨 Emergency: Your shift is urgently needed"
            : "🚨 Notfall: Deine Hilfe wird dringend gebraucht";
        const message =
          locale === "en"
            ? `A shift needs to be covered urgently:\n\n📅 ${shiftDate}\n⏰ ${timeRange}${locationName ? `\n📍 ${locationName}` : ""}${bonusLine ? `\n💰 Bonus: ${bonusLine}` : ""}\n\nClick the button below to accept or decline. This offer expires automatically.`
            : `Eine Schicht muss dringend besetzt werden:\n\n📅 ${shiftDate}\n⏰ ${timeRange}${locationName ? `\n📍 ${locationName}` : ""}${bonusLine ? `\n💰 Bonus: ${bonusLine}` : ""}\n\nKlicke unten, um anzunehmen oder abzulehnen. Das Angebot läuft automatisch ab.`;

        await sendEmail({
          to: emp.email,
          type: "SOS_SHIFT",
          title: subject,
          message,
          link: respondUrl,
          locale,
        }).catch(() => {});
      }
    }),
  );
}

export function getTierSlice(
  ranked: RankedEmployee[],
  tier: number,
): RankedEmployee[] {
  let start = 0;
  for (let t = 1; t < tier; t++) start += TIER_SIZES[t - 1] ?? 0;
  const size = TIER_SIZES[tier - 1] ?? 0;
  return ranked.slice(start, start + size);
}
