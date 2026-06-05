import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { reconcileWorkspaceFromStripe } from "@/lib/billing-reconcile";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";

/**
 * POST /api/billing/sync
 *
 * Manually re-fetches the workspace's Stripe subscription state and syncs it
 * to the database. Call this after a successful Stripe Checkout redirect to
 * immediately unlock features without waiting for the webhook.
 *
 * `allowDowngrade` is intentionally OFF here: a user calling sync on their own
 * session should never have their access revoked mid-flight. The scheduled
 * cron (/api/cron/reconcile-subscriptions) owns the churned-customer downgrade.
 *
 * Rate-limited: max 3 calls per hour per workspace (enforced by withRoute).
 */
export const POST = withRoute("/api/billing/sync", "POST", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  try {
    const result = await reconcileWorkspaceFromStripe(workspaceId, {
      allowDowngrade: false,
    });

    if (result.action === "synced") {
      log.info("[Billing:Sync] manual sync completed", {
        workspaceId,
        status: result.status,
      });
      return NextResponse.json({ synced: true, status: result.status });
    }

    return NextResponse.json({
      synced: false,
      reason: result.reason ?? "NO_ACTIVE_SUB",
    });
  } catch (err) {
    log.error("[Billing:Sync] sync failed", { err, workspaceId });
    return NextResponse.json(
      { synced: false, reason: "STRIPE_ERROR" },
      { status: 502 },
    );
  }
});
