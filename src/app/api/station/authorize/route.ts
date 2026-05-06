import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import {
  verifyStationSetupToken,
  generateStationAccessToken,
} from "@/lib/station-token";
import { prisma } from "@/lib/db";

/**
 * POST /api/station/authorize
 *
 * Public endpoint. Exchanges a short-lived setup token for a 30-day station
 * access key that the device stores in localStorage.
 *
 * Body: { setupToken: string }
 * Response: { stationKey: string; expiresAt: number; workspaceName: string }
 */
export const POST = withRoute("/api/station/authorize", "POST", async (req) => {
  let body: { setupToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { setupToken } = body ?? {};
  if (!setupToken) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }

  const workspaceId = verifyStationSetupToken(setupToken);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      { status: 401 },
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "WORKSPACE_NOT_FOUND" }, { status: 404 });
  }

  const { token: stationKey, expiresAt } =
    generateStationAccessToken(workspaceId);
  return NextResponse.json({
    stationKey,
    expiresAt,
    workspaceName: workspace.name,
  });
});
