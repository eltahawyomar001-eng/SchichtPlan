import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";
import crypto from "crypto";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/webhooks/[id]/test
 *
 * Sends a signed test ping to the webhook URL so the operator can verify
 * connectivity and signature validation on their end.
 *
 * Returns 200 { ok: true, status: <http-status> } on delivery success,
 * or 200 { ok: false, error: "..." } on delivery failure (target unreachable,
 * non-2xx response, etc.).  The 200 wrapper ensures the frontend always gets
 * a parseable response and can distinguish "test sent, remote rejected" from
 * "Shiftfy-side error".
 */
export const POST = withRoute(
  "/api/webhooks/[id]/test",
  "POST",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "webhooks", "update");
    if (forbidden) return forbidden;

    const { id } = params;

    const hook = await prisma.webhookEndpoint.findFirst({
      where: { id, workspaceId: user.workspaceId },
    });

    if (!hook) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = JSON.stringify({
      event: "test",
      data: {
        message: "This is a test event from Shiftfy.",
        webhookId: hook.id,
      },
      ts: Date.now(),
    });

    const signature = crypto
      .createHmac("sha256", hook.secret)
      .update(payload)
      .digest("hex");

    let deliveryOk = false;
    let remoteStatus: number | null = null;
    let errorMsg: string | null = null;

    try {
      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shiftfy-Signature": `sha256=${signature}`,
          "X-Shiftfy-Event": "test",
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });

      remoteStatus = response.status;
      deliveryOk = response.ok;

      if (!response.ok) {
        errorMsg = `Remote returned HTTP ${response.status}`;
      }
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Webhook delivery failed";
    }

    log.info("Webhook test delivery", {
      webhookId: hook.id,
      url: hook.url,
      ok: deliveryOk,
      status: remoteStatus,
      workspaceId: user.workspaceId,
    });

    return NextResponse.json({
      ok: deliveryOk,
      status: remoteStatus,
      error: errorMsg ?? undefined,
    });
  },
  { idempotent: true },
);
