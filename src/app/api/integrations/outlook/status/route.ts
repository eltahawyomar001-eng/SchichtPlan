/**
 * GET    /api/integrations/outlook/status   → current user's connection state
 * DELETE /api/integrations/outlook/status   → disconnect (remove the link)
 *
 * Per-user: a user can only ever see or remove their own Outlook connection.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { isOutlookConfigured } from "@/lib/outlook";
import { createAuditLog } from "@/lib/audit";

export const GET = withRoute(
  "/api/integrations/outlook/status",
  "GET",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const conn = await prisma.outlookConnection.findUnique({
      where: { userId: user.id },
      select: {
        microsoftEmail: true,
        scope: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!conn) {
      return NextResponse.json({
        connected: false,
        configured: isOutlookConfigured(),
      });
    }

    // "expired" here means the refresh window is unknowable from the access-token
    // expiry alone; we surface the access-token expiry so the UI can hint at it.
    // The access token is auto-refreshed on demand, so this is informational.
    return NextResponse.json({
      connected: true,
      configured: isOutlookConfigured(),
      email: conn.microsoftEmail,
      scope: conn.scope,
      expiresAt: conn.tokenExpiresAt.toISOString(),
      connectedAt: conn.createdAt.toISOString(),
      lastRefreshed: conn.updatedAt.toISOString(),
    });
  },
);

export const DELETE = withRoute(
  "/api/integrations/outlook/status",
  "DELETE",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    await prisma.outlookConnection
      .delete({ where: { userId: user.id } })
      .catch(() => {
        // Already gone — treat disconnect as idempotent.
      });

    createAuditLog({
      action: "DELETE",
      entityType: "OutlookConnection",
      entityId: user.id,
      userId: user.id,
      workspaceId,
    });

    return NextResponse.json({ connected: false });
  },
);
