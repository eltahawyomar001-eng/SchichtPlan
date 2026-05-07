import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";

export const GET = withRoute("/api/station/sessions", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  const forbidden = requirePermission(user, "settings", "read");
  if (forbidden) return forbidden;

  const sessions = await prisma.stationSession.findMany({
    where: { workspaceId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      deviceName: true,
      issuedAt: true,
      lastSeenAt: true,
      revokedAt: true,
    },
  });

  return NextResponse.json(sessions);
});

export const DELETE = withRoute(
  "/api/station/sessions",
  "DELETE",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    await prisma.stationSession.updateMany({
      where: { id, workspaceId },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  },
);
