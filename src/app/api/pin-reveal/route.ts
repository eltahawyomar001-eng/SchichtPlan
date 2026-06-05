import { NextResponse } from "next/server";
import { consumePinRevealToken } from "@/lib/pin-reveal";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/pin-reveal?token={uuid}
 *
 * Public, one-time endpoint. Returns the raw PIN for a reveal token.
 * The token is deleted after the first successful read (one-time use).
 * Expires automatically after 15 minutes via cache TTL.
 */
export const GET = withRoute("/api/pin-reveal", "GET", async (req) => {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  }

  const pin = await consumePinRevealToken(token);
  if (!pin) {
    return NextResponse.json(
      { error: "TOKEN_EXPIRED_OR_USED" },
      { status: 410 },
    );
  }

  return NextResponse.json({ pin });
});
