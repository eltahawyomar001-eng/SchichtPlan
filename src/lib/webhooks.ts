/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db";
import crypto from "crypto";

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
    const endpoints = await (prisma as any).webhookEndpoint.findMany({
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
      matching.map(async (ep: { url: string; secret: string }) => {
        const body = JSON.stringify({ event, data: payload, ts: Date.now() });
        const signature = crypto
          .createHmac("sha256", ep.secret)
          .update(body)
          .digest("hex");

        try {
          await fetch(ep.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SchichtPlan-Signature": `sha256=${signature}`,
              "X-SchichtPlan-Event": event,
            },
            body,
            signal: AbortSignal.timeout(10000),
          });
        } catch {
          // Webhook delivery failures are silently dropped for now.
          // A production system would log to an ExportJob / webhook-log table.
        }
      }),
    );
  } catch {
    // Non-critical — never let webhook dispatch crash the caller
  }
}
