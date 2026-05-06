import { requireAuth } from "@/lib/api-response";
import { requireManagement } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { generateStationSetupToken } from "@/lib/station-token";
import { NextResponse } from "next/server";

/**
 * GET /api/station/setup-link
 *
 * Generates a 24-hour one-time setup URL for authorizing a station device.
 * The admin visits this endpoint and sends the returned URL to the tablet.
 * The tablet opens the URL once → exchanges it for a 30-day station key.
 *
 * Requires: OWNER | ADMIN | MANAGER
 */
export const GET = withRoute("/api/station/setup-link", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requireManagement(user);
  if (forbidden) return forbidden;

  const { token, expiresAt } = generateStationSetupToken(workspaceId);
  const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return NextResponse.json({
    setupUrl: `${origin}/station?setup=${token}`,
    expiresAt,
  });
});
