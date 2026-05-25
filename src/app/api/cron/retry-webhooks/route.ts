import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { withTimeout } from "@/lib/request-timeout";
import { WebhookFailureStatus } from "@prisma/client";
import crypto from "crypto";

const MAX_ATTEMPTS = 5;
const DELIVERY_TIMEOUT = 10_000;
const BATCH_SIZE = 50;

/**
 * GET /api/cron/retry-webhooks
 *
 * Retries PENDING/RETRYING webhook failures up to MAX_ATTEMPTS times.
 * Runs every 15 minutes via Vercel Cron.
 */
export const GET = withRoute("/api/cron/retry-webhooks", "GET", async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");

  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  const failures = await prisma.webhookFailure.findMany({
    where: {
      status: {
        in: [WebhookFailureStatus.PENDING, WebhookFailureStatus.RETRYING],
      },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: { endpoint: true },
    take: BATCH_SIZE,
    orderBy: { lastAttempt: "asc" },
  });

  let delivered = 0;
  let permanentlyFailed = 0;

  await Promise.allSettled(
    failures.map(async (failure) => {
      const ep = failure.endpoint;
      const nextAttempts = failure.attempts + 1;

      try {
        const body = failure.payload;
        const signature = crypto
          .createHmac("sha256", ep.secret)
          .update(body)
          .digest("hex");

        const res = await withTimeout(
          fetch(ep.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shiftfy-Signature": `sha256=${signature}`,
              "X-Shiftfy-Event": failure.event,
            },
            body,
          }),
          DELIVERY_TIMEOUT,
          `webhook retry ${ep.url}`,
        );

        if (res.ok) {
          await prisma.webhookFailure.update({
            where: { id: failure.id },
            data: {
              status: WebhookFailureStatus.DELIVERED,
              attempts: nextAttempts,
              lastAttempt: new Date(),
              errorMessage: null,
            },
          });
          delivered++;
          log.info("[cron/retry-webhooks] Delivered", {
            failureId: failure.id,
            endpointId: ep.id,
          });
        } else {
          const errMsg = `HTTP ${res.status}`;
          const isFinal = nextAttempts >= MAX_ATTEMPTS;
          await prisma.webhookFailure.update({
            where: { id: failure.id },
            data: {
              status: isFinal
                ? WebhookFailureStatus.FAILED
                : WebhookFailureStatus.RETRYING,
              attempts: nextAttempts,
              lastAttempt: new Date(),
              errorMessage: errMsg,
            },
          });
          if (isFinal) permanentlyFailed++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isFinal = nextAttempts >= MAX_ATTEMPTS;
        await prisma.webhookFailure
          .update({
            where: { id: failure.id },
            data: {
              status: isFinal
                ? WebhookFailureStatus.FAILED
                : WebhookFailureStatus.RETRYING,
              attempts: nextAttempts,
              lastAttempt: new Date(),
              errorMessage: errMsg,
            },
          })
          .catch((e) =>
            log.error("[cron/retry-webhooks] Failed to update failure record", {
              error: e,
            }),
          );
        if (isFinal) permanentlyFailed++;
      }
    }),
  );

  log.info("[cron/retry-webhooks] done", {
    processed: failures.length,
    delivered,
    permanentlyFailed,
  });
  return NextResponse.json({
    processed: failures.length,
    delivered,
    permanentlyFailed,
  });
});
