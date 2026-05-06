import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { verifyStationAccessToken } from "@/lib/station-token";
import { prisma } from "@/lib/db";

/**
 * GET /api/station/recent-punch?key={stationKey}&since={isoTimestamp}
 *
 * Public endpoint polled by the station tablet every 3 seconds.
 * Returns the most recent clock-in or clock-out event after `since`.
 * The station shows a 5-second success overlay when a new punch is detected.
 */
export const GET = withRoute(
  "/api/station/recent-punch",
  "GET",
  async (req) => {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const since = searchParams.get("since");

    if (!key) {
      return NextResponse.json({ error: "MISSING_KEY" }, { status: 400 });
    }

    const workspaceId = verifyStationAccessToken(key);
    if (!workspaceId) {
      return NextResponse.json({ error: "INVALID_KEY" }, { status: 401 });
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 30_000);
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json({ error: "INVALID_SINCE" }, { status: 400 });
    }

    const recent = await prisma.timeEntry.findFirst({
      where: {
        workspaceId,
        isLiveClock: true,
        OR: [
          { clockInAt: { gte: sinceDate } },
          { clockOutAt: { gte: sinceDate } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clockInAt: true,
        clockOutAt: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    if (!recent) return NextResponse.json({ punch: null });

    const tz = "Europe/Berlin";
    const action: "in" | "out" =
      recent.clockOutAt && recent.clockOutAt >= sinceDate ? "out" : "in";
    const at = action === "out" ? recent.clockOutAt! : recent.clockInAt!;
    const time = at.toLocaleTimeString("de-DE", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    });

    return NextResponse.json({
      punch: {
        id: recent.id,
        action,
        employeeName: `${recent.employee.firstName} ${recent.employee.lastName}`,
        time,
      },
    });
  },
);
