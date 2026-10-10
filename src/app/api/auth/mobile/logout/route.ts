/**
 * POST /api/auth/mobile/logout
 *
 * Ends every mobile session for the caller.
 *
 * Mobile tokens are stateless JWTs, so "logging out" by deleting them from the
 * device only ever removed the copy on that device. Anything already extracted
 * -- from a backup, a shared phone, or a device somebody no longer controls --
 * kept working for up to thirty days. Bumping the user's token version is what
 * actually invalidates them.
 *
 * This signs out every device, deliberately. Per-device revocation would need
 * per-device token identity, which does not exist yet; signing out everywhere
 * is the honest behaviour for the data we have, and it is what somebody
 * pressing "log out" on a phone they are worried about actually wants.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";

export const POST = withRoute("/api/auth/mobile/logout", "POST", async () => {
  // requireWorkspace: false -- somebody removed from their workspace must
  // still be able to sign out.
  const auth = await requireAuth({ requireWorkspace: false });
  if (!auth.ok) return auth.response;

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { tokenVersion: { increment: 1 } },
  });

  log.info("[auth] mobile sessions revoked", { userId: auth.user.id });

  return NextResponse.json({ success: true, revoked: true });
});
