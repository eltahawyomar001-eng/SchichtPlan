import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import ical, { ICalCalendarMethod } from "ical-generator";
import { randomBytes } from "crypto";
import { log } from "@/lib/logger";

/** Token is valid for 90 days before automatic rotation. */
const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Resolve the authenticated user — either via session cookie (browser)
 * or via a long-lived ?token= query parameter (external calendar apps).
 *
 * When a token is older than 90 days it is automatically rotated:
 * - A new cryptographic token replaces the old one
 * - The new feed URL is returned in a `X-ICal-New-Token-URL` header
 * - Calendar apps that don't read the header will fail on the next
 *   sync, prompting the user to re-subscribe with the new URL shown
 *   in the dashboard.
 */
async function resolveUser(req: Request): Promise<{
  userId: string;
  employeeId?: string | null;
  workspaceId: string;
  rotatedFeedUrl?: string; // set when the token was just rotated
} | null> {
  // 1. Try token-based auth first (external calendar apps)
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (token) {
    const icalToken = await prisma.iCalToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            workspaceId: true,
            employee: { select: { id: true } },
          },
        },
      },
    });

    if (!icalToken || !icalToken.user.workspaceId) return null;

    // ── Hard expiry check ──
    if (icalToken.expiresAt && new Date() > icalToken.expiresAt) {
      log.warn(
        `[ical] Expired token used: id=${icalToken.id}, user=${icalToken.userId}`,
      );
      return null;
    }

    // ── Automatic rotation after TOKEN_MAX_AGE_MS ──
    const tokenAge =
      Date.now() - (icalToken.rotatedAt ?? icalToken.createdAt).getTime();
    let rotatedFeedUrl: string | undefined;

    if (tokenAge > TOKEN_MAX_AGE_MS) {
      const newToken = randomBytes(48).toString("hex");
      const baseUrl = process.env.NEXTAUTH_URL || "https://app.shiftfy.de";

      await prisma.iCalToken.update({
        where: { id: icalToken.id },
        data: {
          token: newToken,
          rotatedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });

      rotatedFeedUrl = `${baseUrl}/api/ical?token=${newToken}`;
      log.info(
        `[ical] Token rotated after ${Math.round(tokenAge / 86_400_000)}d: id=${icalToken.id}, user=${icalToken.userId}`,
      );
    } else {
      // Update lastUsedAt (fire & forget)
      prisma.iCalToken
        .update({
          where: { id: icalToken.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});
    }

    return {
      userId: icalToken.user.id,
      employeeId: icalToken.user.employee?.id ?? null,
      workspaceId: icalToken.user.workspaceId,
      rotatedFeedUrl,
    };
  }

  // 2. Fall back to session-based auth (browser)
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = session.user as SessionUser;
  if (!user.workspaceId) return null;

  return {
    userId: user.id,
    employeeId: user.employeeId,
    workspaceId: user.workspaceId,
  };
}

/**
 * GET /api/ical
 * Returns an .ics feed of the user's shifts.
 * Auth: session cookie OR ?token= query parameter.
 * Query params: start, end (optional date filters)
 */
export async function GET(req: Request) {
  try {
    const authedUser = await resolveUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { employeeId, workspaceId, rotatedFeedUrl } = authedUser;

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: Record<string, unknown> = { workspaceId };
    if (employeeId) where.employeeId = employeeId;
    if (start && end) {
      where.date = { gte: new Date(start), lte: new Date(end) };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { employee: true, location: true },
      orderBy: { date: "asc" },
    });

    const cal = ical({
      name: "Shiftfy",
      method: ICalCalendarMethod.PUBLISH,
    });

    for (const shift of shifts) {
      const dateStr = shift.date.toISOString().split("T")[0];
      const startDt = new Date(`${dateStr}T${shift.startTime}:00`);

      // Handle overnight shifts
      let endDt = new Date(`${dateStr}T${shift.endTime}:00`);
      if (endDt <= startDt) {
        endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
      }

      cal.createEvent({
        start: startDt,
        end: endDt,
        summary: shift.employee
          ? `${shift.employee.firstName} ${shift.employee.lastName}`
          : "Offene Schicht",
        location: shift.location?.name || undefined,
        description: shift.notes || undefined,
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=shiftfy-schichtplan.ics",
    };

    // Inform the client about the rotated token URL
    if (rotatedFeedUrl) {
      headers["X-ICal-New-Token-URL"] = rotatedFeedUrl;
    }

    return new Response(cal.toString(), { status: 200, headers });
  } catch (error) {
    log.error("iCal error:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
