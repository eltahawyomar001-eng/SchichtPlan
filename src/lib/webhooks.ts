import { prisma } from "@/lib/db";
import crypto from "crypto";
import { log } from "@/lib/logger";
import { withTimeout } from "@/lib/request-timeout";
import { assertPublicWebhookUrl } from "@/lib/webhook-url-guard";
import { WebhookFailureStatus } from "@prisma/client";

/**
 * Webhook delivery timeout (ms).
 * Short timeout prevents blocking serverless function execution time.
 */
const DELIVERY_TIMEOUT = 10_000; // 10 seconds

/**
 * Dispatch a webhook event to all matching endpoints for a workspace.
 *
 * Uses single-attempt delivery with a short timeout to avoid blocking the
 * API response. If delivery fails, the failure is logged and captured in
 * Sentry for manual investigation. This prevents the worst-case scenario
 * of the old retry approach (4 attempts × 10s timeout = 40+ seconds
 * blocking serverless function execution time).
 *
 * @param workspaceId - The workspace that owns the endpoints
 * @param event       - Event name, e.g. "shift.created", "time-entry.updated"
 * @param payload     - JSON-serialisable payload
 */
export async function dispatchWebhook(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        workspaceId,
        isActive: true,
      },
    });

    const matching = endpoints.filter(
      (ep: { events: string[] }) =>
        ep.events.includes(event) || ep.events.includes("*"),
    );

    if (matching.length === 0) return;

    // Fire-and-forget: single attempt per endpoint, no retries
    await Promise.allSettled(
      matching.map(async (ep: { id: string; url: string; secret: string }) => {
        // SSRF guard — re-resolve on every delivery to defeat DNS rebinding.
        const urlCheck = await assertPublicWebhookUrl(ep.url);
        if (!urlCheck.ok) {
          log.warn("[webhook] Delivery blocked — unsafe target URL", {
            endpointId: ep.id,
            event,
            reason: urlCheck.reason,
          });
          return;
        }

        const body = JSON.stringify({ event, data: payload, ts: Date.now() });
        const signature = crypto
          .createHmac("sha256", ep.secret)
          .update(body)
          .digest("hex");

        try {
          const res = await withTimeout(
            fetch(ep.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shiftfy-Signature": `sha256=${signature}`,
                "X-Shiftfy-Event": event,
              },
              body,
            }),
            DELIVERY_TIMEOUT,
            `webhook ${ep.url}`,
          );

          if (res.ok) {
            log.info("[webhook] Delivered", {
              endpointId: ep.id,
              event,
              status: res.status,
            });
          } else {
            const errMsg = `HTTP ${res.status}`;
            log.warn("[webhook] Non-OK response", {
              endpointId: ep.id,
              url: ep.url,
              event,
              status: res.status,
            });
            await prisma.webhookFailure
              .create({
                data: {
                  endpointId: ep.id,
                  workspaceId,
                  event,
                  payload: body,
                  status: WebhookFailureStatus.PENDING,
                  attempts: 1,
                  lastAttempt: new Date(),
                  errorMessage: errMsg,
                },
              })
              .catch((e) =>
                log.error("[webhook] Failed to persist DLQ entry", {
                  error: e,
                }),
              );
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.warn("[webhook] Delivery failed", {
            endpointId: ep.id,
            url: ep.url,
            event,
            error: errMsg,
          });
          await prisma.webhookFailure
            .create({
              data: {
                endpointId: ep.id,
                workspaceId,
                event,
                payload: body,
                status: WebhookFailureStatus.PENDING,
                attempts: 1,
                lastAttempt: new Date(),
                errorMessage: errMsg,
              },
            })
            .catch((e) =>
              log.error("[webhook] Failed to persist DLQ entry", { error: e }),
            );
        }
      }),
    );
  } catch (err) {
    // Non-critical — never let webhook dispatch crash the caller
    log.error("[webhook] Dispatch error", {
      workspaceId,
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
