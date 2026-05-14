import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { getSeatDrift, reconcileSeatsFromEmployees } from "@/lib/billing-seats";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/billing/seats/reconcile
 *
 * Read-only drift check. Returns the live Stripe quantity, current active
 * employee count, and whether they match. Used by the billing UI to render
 * a "Force Sync" prompt only when drift is detected.
 */
export const GET = withRoute(
  "/api/billing/seats/reconcile",
  "GET",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const drift = await getSeatDrift(workspaceId);
    return NextResponse.json(drift);
  },
);

/**
 * POST /api/billing/seats/reconcile
 *
 * Force-sync the Stripe subscription quantity to the live active-employee
 * count. Used as a recovery tool when webhook delivery is missed or when a
 * legacy workspace was created before per-seat sync shipped. Invoices the
 * customer immediately (always_invoice) for any back-billed seats.
 *
 * OWNER/ADMIN only. Idempotent — calling repeatedly is safe.
 */
export const POST = withRoute(
  "/api/billing/seats/reconcile",
  "POST",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const result = await reconcileSeatsFromEmployees(workspaceId, "reconcile");

    log.info("[Billing:Seats] Force sync triggered", {
      workspaceId,
      userId: user.id,
      result,
    });

    return NextResponse.json(result);
  },
);
