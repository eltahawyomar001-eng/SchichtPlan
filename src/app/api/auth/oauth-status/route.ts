import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { cache } from "@/lib/cache";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/auth/oauth-status
 *
 * Returns whether the current session user was just created via OAuth
 * (i.e. this is a genuine new registration, not an existing-user sign-in).
 * The flag is consumed on first read so repeated calls return isNew: false.
 */
export const GET = withRoute("/api/auth/oauth-status", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const key = `new_oauth_reg:${auth.user.id}`;
  const flagged = (await cache.get<string>(key)) === "1";
  if (flagged) {
    await cache.del(key);
  }

  return NextResponse.json({ isNew: flagged });
});
