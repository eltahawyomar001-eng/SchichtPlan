import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { getSubscription } from "@/lib/subscription";
import { withRoute } from "@/lib/with-route";

export const GET = withRoute("/api/billing/trial-status", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const sub = await getSubscription(workspaceId);
  if (!sub || sub.status !== "TRIALING" || !sub.trialEnd) {
    return NextResponse.json({ isTrialing: false, daysLeft: 0 });
  }

  const msLeft = sub.trialEnd.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  return NextResponse.json({ isTrialing: true, daysLeft });
});
