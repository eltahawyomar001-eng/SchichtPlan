import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { withRoute } from "@/lib/with-route";
import { verifyStationAccessToken } from "@/lib/station-token";
import { generateQrToken } from "@/lib/qr-token";
import { prisma } from "@/lib/db";

/**
 * GET /api/station/qr-token
 *
 * Public endpoint. Returns a fresh 60-second QR punch token.
 * Authentication: httpOnly `station_key` cookie (set by /api/station/authorize).
 */
export const GET = withRoute("/api/station/qr-token", "GET", async () => {
  const cookieStore = await cookies();
  const key = cookieStore.get("station_key")?.value;

  if (!key) {
    return NextResponse.json({ error: "MISSING_KEY" }, { status: 401 });
  }

  const workspaceId = verifyStationAccessToken(key);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_KEY" },
      { status: 401 },
    );
  }

  // Check if this session has been revoked
  const sessionKeyHash = crypto.createHash("sha256").update(key).digest("hex");
  const session = await prisma.stationSession.findUnique({
    where: { sessionKeyHash },
    select: { revokedAt: true },
  });
  if (session?.revokedAt) {
    return NextResponse.json({ error: "SESSION_REVOKED" }, { status: 401 });
  }
  // Update lastSeenAt (best-effort, non-blocking)
  prisma.stationSession
    .update({
      where: { sessionKeyHash },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});

  const { token, expiresAt } = generateQrToken(workspaceId);
  return NextResponse.json({ token, expiresAt });
});
