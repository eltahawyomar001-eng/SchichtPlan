import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { isDatevSandbox } from "@/lib/datev-oidc";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/datev-status
 * Returns the DATEV connection status for the workspace.
 * Never exposes the access/refresh token to the client.
 */
export const GET = withRoute(
  "/api/compliance/datev-status",
  "GET",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;

    const token = await prisma.dATEVToken.findUnique({
      where: { workspaceId },
      select: {
        expiresAt: true,
        scope: true,
        sandbox: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!token) {
      return NextResponse.json({ connected: false, sandbox: isDatevSandbox() });
    }

    const expired = token.expiresAt.getTime() < Date.now();
    return NextResponse.json({
      connected: true,
      expired,
      expiresAt: token.expiresAt,
      scope: token.scope,
      sandbox: token.sandbox,
      connectedAt: token.createdAt,
      lastRefreshed: token.updatedAt,
    });
  },
);

/**
 * DELETE /api/compliance/datev-status — disconnect DATEV from this workspace.
 */
export const DELETE = withRoute(
  "/api/compliance/datev-status",
  "DELETE",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;

    await prisma.dATEVToken.deleteMany({ where: { workspaceId } });

    createAuditLog({
      action: "DELETE",
      entityType: "DATEVToken",
      entityId: workspaceId,
      userId: user.id,
      workspaceId,
      changes: { action: "DATEV_DISCONNECT" },
    });

    return NextResponse.json({ disconnected: true });
  },
);
