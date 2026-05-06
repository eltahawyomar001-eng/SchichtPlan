import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { verifyStationAccessToken } from "@/lib/station-token";
import { generateQrToken } from "@/lib/qr-token";

/**
 * GET /api/station/qr-token?key={stationKey}
 *
 * Public endpoint. Returns a fresh 60-second QR punch token.
 * The station device calls this every ~55 seconds to keep the displayed code valid.
 *
 * Authentication: long-lived station access key (30 days) stored in device localStorage.
 */
export const GET = withRoute("/api/station/qr-token", "GET", async (req) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "MISSING_KEY" }, { status: 400 });
  }

  const workspaceId = verifyStationAccessToken(key);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_KEY" },
      { status: 401 },
    );
  }

  const { token, expiresAt } = generateQrToken(workspaceId);
  return NextResponse.json({ token, expiresAt });
});
