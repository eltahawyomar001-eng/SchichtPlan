import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { CURRENT_TOS_VERSION } from "@/lib/legal-version";

/**
 * POST /api/account/accept-tos
 * Stores the user's acceptance of the current AGB/Datenschutz version.
 * Idempotent — safe to call multiple times.
 */
export const POST = withRoute("/api/account/accept-tos", "POST", async () => {
  const auth = await requireAuth({ requireWorkspace: false });
  if (!auth.ok) return auth.response;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      tosVersion: CURRENT_TOS_VERSION,
      tosAcceptedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    version: CURRENT_TOS_VERSION,
  });
});

/**
 * GET /api/account/accept-tos
 * Returns whether the user has accepted the current version.
 * Used by the blocking modal to decide whether to show.
 */
export const GET = withRoute("/api/account/accept-tos", "GET", async () => {
  const auth = await requireAuth({ requireWorkspace: false });
  if (!auth.ok) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { tosVersion: true, tosAcceptedAt: true },
  });

  const accepted = user?.tosVersion === CURRENT_TOS_VERSION;

  return NextResponse.json({
    accepted,
    currentVersion: CURRENT_TOS_VERSION,
    acceptedVersion: user?.tosVersion ?? null,
    acceptedAt: user?.tosAcceptedAt ?? null,
  });
});
