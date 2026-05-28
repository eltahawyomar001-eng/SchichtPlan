/**
 * Betriebsrat (works council) co-determination helpers — BetrVG §87.
 *
 * The works council has co-determination rights over the start/end of working
 * hours, breaks and temporary changes. Employers submit shift schedules to the
 * council, which must respond within a deadline (statutory default: 3 days).
 */

import { prisma } from "@/lib/db";

/** Default response window for the works council, in days. */
export const BETRIEBSRAT_DEADLINE_DAYS = 3;

/** Compute the response deadline from a submission timestamp. */
export function approvalDeadline(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + BETRIEBSRAT_DEADLINE_DAYS);
  return d;
}

/** True when the given user is a works-council member of the workspace. */
export async function isBetriebsratMember(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const member = await prisma.betriebsratMember.findFirst({
    where: { userId, workspaceId },
    select: { id: true },
  });
  return !!member;
}

/** Create an in-app notification for every works-council member. */
export async function notifyBetriebsratMembers(
  workspaceId: string,
  payload: { type: string; title: string; message: string; link?: string },
): Promise<void> {
  const members = await prisma.betriebsratMember.findMany({
    where: { workspaceId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      userId: m.userId,
      workspaceId,
    })),
  });
}

/** Create an in-app notification for a single user. */
export async function notifyUser(
  userId: string,
  workspaceId: string,
  payload: { type: string; title: string; message: string; link?: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      userId,
      workspaceId,
    },
  });
}
