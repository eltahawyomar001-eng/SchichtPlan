import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { sendEmail } from "@/lib/notifications/email";

const BATCH_SIZE = 50;

/**
 * GET /api/cron/retry-emails
 *
 * Retries PENDING EmailJobs whose nextRetryAt is in the past and whose
 * attempts < maxAttempts. Runs every 15 minutes via Vercel Cron.
 */
export const GET = withRoute("/api/cron/retry-emails", "GET", async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  const now = new Date();

  // Fetch PENDING jobs whose back-off window has elapsed.
  // Filter attempts < maxAttempts in JS because Prisma doesn't support
  // column-to-column comparisons in where clauses.
  const candidates = await prisma.emailJob.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    take: BATCH_SIZE,
    orderBy: { nextRetryAt: "asc" },
  });

  const retryable = candidates.filter((j) => j.attempts < j.maxAttempts);

  let delivered = 0;
  let permanentlyFailed = 0;

  await Promise.allSettled(
    retryable.map(async (job) => {
      const result = await sendEmail({
        to: job.to,
        type: job.type,
        category: job.category as "transactional" | "marketing",
        title: job.title,
        message: job.message,
        link: job.link,
        locale: job.locale,
      });

      const nextAttempts = job.attempts + 1;
      const isFinal = !result.success && nextAttempts >= job.maxAttempts;
      // Exponential back-off: 5min, 10min, 20min, 40min, capped at 4h
      const backoffMs = Math.min(
        5 * 60 * 1000 * Math.pow(2, nextAttempts - 1),
        4 * 60 * 60 * 1000,
      );

      await prisma.emailJob
        .update({
          where: { id: job.id },
          data: {
            status: result.success ? "SENT" : isFinal ? "FAILED" : "PENDING",
            attempts: nextAttempts,
            lastAttempt: now,
            nextRetryAt: result.success
              ? null
              : new Date(Date.now() + backoffMs),
            errorMessage: result.success ? null : (result.error ?? null),
          },
        })
        .catch((e) =>
          log.error("[cron/retry-emails] Failed to update EmailJob", {
            jobId: job.id,
            error: e,
          }),
        );

      if (result.success) delivered++;
      if (isFinal) permanentlyFailed++;
    }),
  );

  log.info("[cron/retry-emails] done", {
    processed: retryable.length,
    delivered,
    permanentlyFailed,
  });

  return NextResponse.json({
    processed: retryable.length,
    delivered,
    permanentlyFailed,
  });
});
