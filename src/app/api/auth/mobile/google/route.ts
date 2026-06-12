/**
 * POST /api/auth/mobile/google
 *
 * Native Google sign-in / sign-up for the iOS app. The app signs in with
 * Google natively and posts the resulting ID token here. We verify it against
 * Google's JWKS, find or create the user, and return the same mobile session
 * shape as /login (plus `needsWorkspace` for brand-new accounts).
 *
 * Body: { idToken: string }
 */
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { verifyGoogleIdToken } from "@/lib/oauth-verify";
import { buildMobileSession, findOrCreateOAuthUser } from "@/lib/mobile-auth";

export const POST = withRoute(
  "/api/auth/mobile/google",
  "POST",
  async (req) => {
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const idToken = (_json.data as { idToken?: string }).idToken;
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "idToken erforderlich." },
        { status: 400 },
      );
    }

    let identity;
    try {
      identity = await verifyGoogleIdToken(idToken);
    } catch (err) {
      log.warn("Mobile Google verify failed", { error: String(err) });
      return NextResponse.json(
        { error: "Google-Anmeldung ungültig." },
        { status: 401 },
      );
    }

    if (!identity.emailVerified) {
      return NextResponse.json(
        { error: "Google-E-Mail ist nicht verifiziert." },
        { status: 403 },
      );
    }

    const user = await findOrCreateOAuthUser(identity);
    const session = await buildMobileSession(user);
    log.info("Mobile Google login", {
      userId: user.id,
      needsWorkspace: session.needsWorkspace,
    });
    return NextResponse.json(session);
  },
);
