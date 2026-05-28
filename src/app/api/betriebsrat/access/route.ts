import { NextResponse } from "next/server";
import { isManagement } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { isBetriebsratMember } from "@/lib/betriebsrat";

/**
 * GET /api/betriebsrat/access
 * Lightweight check used by the sidebar to decide whether to show the
 * Betriebsrat portal link. Returns { isMember, isManager, hasAccess }.
 */
export const GET = withRoute("/api/betriebsrat/access", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const isMember = await isBetriebsratMember(user.id, workspaceId);
  const isManager = isManagement(user);

  return NextResponse.json({
    isMember,
    isManager,
    hasAccess: isMember || isManager,
  });
});
