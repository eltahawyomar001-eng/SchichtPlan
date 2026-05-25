import { NextResponse } from "next/server";

/**
 * GET /api/health/live
 *
 * Kubernetes-style liveness probe — instant 200, no DB or Stripe calls.
 * Used by load balancers to confirm the process is alive.
 * The full health check (with DB/Stripe) is at /api/health.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
