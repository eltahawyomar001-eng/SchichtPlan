/**
 * POST /api/auth/mobile/apple
 *
 * Native "Sign in with Apple" for the iOS app. The app posts Apple's identity
 * token (and, only on the FIRST authorization, the user's full name — Apple
 * never sends it again). We verify the token against Apple's JWKS (audience =
 * the app bundle id), find or create the user, and return the mobile session.
 *
 * Body: { identityToken: string, fullName?: string }
 */
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { verifyAppleIdToken } from "@/lib/oauth-verify";
import { buildMobileSession, findOrCreateOAuthUser } from "@/lib/mobile-auth";

export const POST = withRoute("/api/auth/mobile/apple", "POST", async (req) => {
  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const body = _json.data as { identityToken?: string; fullName?: string };
  if (!body.identityToken || typeof body.identityToken !== "string") {
    return NextResponse.json(
      { error: "identityToken erforderlich." },
      { status: 400 },
    );
  }

  let identity;
  try {
    identity = await verifyAppleIdToken(body.identityToken, body.fullName);
  } catch (err) {
    log.warn("Mobile Apple verify failed", { error: String(err) });
    return NextResponse.json(
      { error: "Apple-Anmeldung ungültig." },
      { status: 401 },
    );
  }

  const user = await findOrCreateOAuthUser(identity);
  const session = await buildMobileSession(user);
  log.info("Mobile Apple login", {
    userId: user.id,
    needsWorkspace: session.needsWorkspace,
  });
  return NextResponse.json(session);
});
