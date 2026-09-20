import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { resolveAndPersistLocationGeo } from "@/lib/geocode";

/**
 * GET /api/cron/geocode-locations
 *
 * Resolve coordinates for objects that still have none.
 *
 * Creating and editing a location both geocode inline, but under a tight
 * budget so a slow provider can never hold up the request. This is where
 * everything that fell through that budget lands, together with every row
 * created before geocoding was wired into those paths at all.
 *
 * Why it matters that this runs: a Location without coordinates gives the
 * geofence nothing to compare against, so every punch and every proof photo
 * at that object is recorded as unverifiable. The failure is invisible from
 * the manager's side, which is exactly why it went unnoticed.
 */

/** One run's ceiling. Well above any realistic backlog, and bounded. */
const BATCH_SIZE = 50;

/**
 * The real limit is the clock, not the row count.
 *
 * A row that reaches this job is by definition one the providers were slow or
 * unable to answer for, and geocodeAddress can spend up to four 5s provider
 * timeouts on a single address. Fifty of those would run for minutes and be
 * killed mid-flight by the platform, losing the rows already resolved in that
 * run. So the loop stops on its own with room to spare and leaves the rest for
 * tomorrow; the backlog only ever shrinks.
 */
const MAX_RUN_MS = 45_000;

/** Kept under the platform ceiling the deadline above is chosen against. */
export const maxDuration = 60;

/**
 * Nominatim's usage policy is one request per second per application, and it
 * is a free community service that will block an application that ignores
 * that. Open-Meteo has no such limit, but a request only reaches Nominatim
 * after Open-Meteo has already failed — which is precisely the unresolvable
 * backlog this job works through. So the whole loop is paced, not just the
 * fallback.
 */
const PACE_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET = withRoute(
  "/api/cron/geocode-locations",
  "GET",
  async (req) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 401 },
      );
    }

    const pending = await prisma.location.findMany({
      where: {
        deletedAt: null,
        OR: [{ latitude: null }, { longitude: null }],
        // Only rows there is something to resolve FROM. A location with no
        // address is not a backlog item this job can clear — the geofence
        // reference point may only come from an address (see geocodeAddress),
        // so these need a human to fill one in. Including them would burn the
        // run's pacing budget on rows that never reach a provider.
        address: { not: null },
      },
      select: { id: true, name: true, workspaceId: true },
      // Newest first: a location someone just created is the one being set up
      // right now, and an address that has failed every night for a month must
      // not keep it waiting.
      orderBy: { createdAt: "desc" },
      take: BATCH_SIZE,
    });

    let resolved = 0;
    let unresolved = 0;

    const deadline = Date.now() + MAX_RUN_MS;
    let ranOut = false;

    for (const loc of pending) {
      if (Date.now() > deadline) {
        ranOut = true;
        break;
      }
      // No budget here on purpose: nobody is waiting on this response, and the
      // rows that reach this job are the ones the inline budget could not
      // finish. Cutting them short again would mean they never resolve at all.
      const geo = await resolveAndPersistLocationGeo(loc.id);
      if (geo) resolved += 1;
      else unresolved += 1;
      await sleep(PACE_MS);
    }

    if (pending.length) {
      log.info("geocode sweep complete", {
        queued: pending.length,
        resolved,
        unresolved,
        ranOut,
      });
    }

    return NextResponse.json({
      queued: pending.length,
      examined: resolved + unresolved,
      resolved,
      unresolved,
      // Says plainly that rows were left over, so a growing backlog is visible
      // in the cron log instead of looking like a clean run every night.
      ranOut,
    });
  },
);
