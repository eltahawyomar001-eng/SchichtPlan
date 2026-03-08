import { prisma } from "@/lib/db";
import crypto from "crypto";
import { log } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // ms

/**
 * Dispatch a webhook event to all matching endpoints for a workspace.
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

    await Promise.allSettled(
      matching.map(async (ep: { id: string; url: string; secret: string }) => {
        const body = JSON.stringify({ event, data: payload, ts: Date.now() });
        const signature = crypto
          .createHmac("sha256", ep.secret)
          .update(body)
          .digest("hex");

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const res = await fetch(ep.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shiftfy-Signature": `sha256=${signature}`,
                "X-Shiftfy-Event": event,
              },
              body,
              signal: AbortSignal.timeout(10000),
            });

            if (res.ok) {
              log.info("[webhook] Delivered", {
                endpointId: ep.id,
                event,
                attempt,
                status: res.status,
              });
              return; // success — stop retrying
            }

            lastError = new Error(`HTTP ${res.status}`);
            log.warn("[webhook] Non-OK response", {
              endpointId: ep.id,
              url: ep.url,
              event,
              attempt,
              status: res.status,
            });
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            log.warn("[webhook] Delivery failed", {
              endpointId: ep.id,
              url: ep.url,
              event,
              attempt,
              error: lastError.message,
            });
          }

          // Wait before retry (skip wait after last attempt)
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
          }
        }

        // All retries exhausted
        log.error("[webhook] All retries exhausted", {
          endpointId: ep.id,
          url: ep.url,
          event,
          error: lastError?.message,
        });
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
