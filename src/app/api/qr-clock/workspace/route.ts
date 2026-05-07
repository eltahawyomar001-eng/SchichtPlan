import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { verifyQrToken } from "@/lib/qr-token";
import { prisma } from "@/lib/db";

/**
 * GET /api/qr-clock/workspace?t={token}
 *
 * Public endpoint — returns only the workspace display name.
 * No employee data is ever returned to the client.
 */
export const GET = withRoute("/api/qr-clock/workspace", "GET", async (req) => {
  const token = new URL(req.url).searchParams.get("t");
  if (!token) {
    return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  }

  const verified = verifyQrToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      { status: 401 },
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: verified.workspaceId },
    select: { name: true },
  });

  return NextResponse.json({
    workspaceName: workspace?.name ?? "",
  });
});
