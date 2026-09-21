import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { deletePhotoObject } from "@/lib/work-proof-storage";

/**
 * GET /api/cron/work-proof-retention
 *
 * Delete proof photos older than the retention window, from the database and
 * from storage.
 *
 * Separate from the general weekly data-retention sweep for two reasons. These
 * rows own bytes in a storage bucket, so deleting the row alone would leave the
 * image readable to anyone holding a signed URL and quietly grow the bucket
 * forever. And the window here is short enough that a weekly sweep would miss
 * it: a photo taken the day after a Sunday run survives until the next one,
 * which is thirteen days, not seven.
 *
 * Why the photos go at all: they show customers' sites, building interiors and
 * sometimes people. Keeping them indefinitely is a liability with no purpose --
 * their job is to let a manager review a round shortly after it happened.
 */

/**
 * How long a proof photo is kept.
 *
 * Note this does NOT shorten the working-time record. ArbZG §16 requires the
 * TIME ENTRY to be retained for two years, and that row is untouched: the photo
 * is supplementary evidence attached to it, not the record itself.
 */
export const PROOF_RETENTION_DAYS = 7;

/** One run's ceiling, so a large backlog cannot exhaust the function. */
const BATCH_SIZE = 500;

/** Storage deletes are network calls; this keeps them from running serially. */
const CONCURRENCY = 10;

export const GET = withRoute(
  "/api/cron/work-proof-retention",
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

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - PROOF_RETENTION_DAYS);

    const expired = await prisma.workProofPhoto.findMany({
      where: { capturedAt: { lt: cutoff } },
      select: { id: true, storagePath: true },
      orderBy: { capturedAt: "asc" },
      take: BATCH_SIZE,
    });

    if (expired.length === 0) {
      return NextResponse.json({ examined: 0, deleted: 0, cutoff });
    }

    /**
     * Storage first, database second.
     *
     * If the row goes first and the object delete then fails, nothing remembers
     * the object exists and it stays in the bucket permanently. Failing the
     * other way round is recoverable: the row survives and the next run retries
     * it. Orphaned bytes are the one outcome with no path back.
     */
    let objectsFailed = 0;
    const deletable: string[] = [];

    for (let i = 0; i < expired.length; i += CONCURRENCY) {
      const slice = expired.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (photo) => {
          try {
            await deletePhotoObject(photo.storagePath);
            deletable.push(photo.id);
          } catch (err) {
            objectsFailed += 1;
            log.warn("[work-proof-retention] object delete failed, kept row", {
              id: photo.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
    }

    const { count } = await prisma.workProofPhoto.deleteMany({
      where: { id: { in: deletable } },
    });

    log.info("[work-proof-retention] sweep complete", {
      cutoff: cutoff.toISOString(),
      examined: expired.length,
      deleted: count,
      objectsFailed,
      // A full batch means there is more to do; the next run picks it up.
      moreRemaining: expired.length === BATCH_SIZE,
    });

    return NextResponse.json({
      cutoff,
      examined: expired.length,
      deleted: count,
      objectsFailed,
      moreRemaining: expired.length === BATCH_SIZE,
    });
  },
);
