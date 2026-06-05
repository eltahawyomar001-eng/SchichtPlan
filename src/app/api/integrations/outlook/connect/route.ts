/**
 * GET /api/integrations/outlook/connect
 *
 * Initiates the Microsoft Outlook (Microsoft Graph) OAuth2 Authorization Code
 * Flow + PKCE. This is a per-user connection — any authenticated user may link
 * their own Microsoft account to sync their personal calendar into the app.
 * (Contrast with DATEV, which is a workspace-level integration gated to admins.)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  getOutlookRedirectUri,
  isOutlookConfigured,
} from "@/lib/outlook";
import { withRoute } from "@/lib/with-route";

export const dynamic = "force-dynamic";

function settingsRedirect(result: string): NextResponse {
  const base = process.env.NEXTAUTH_URL ?? "https://www.shiftfy.de";
  return NextResponse.redirect(`${base}/einstellungen?outlook=${result}`);
}

export const GET = withRoute(
  "/api/integrations/outlook/connect",
  "GET",
  async () => {
    if (!isOutlookConfigured()) {
      return settingsRedirect("not_configured");
    }

    const auth = await requireAuth();
    if (!auth.ok) {
      return settingsRedirect("auth_required");
    }
    const { user, workspaceId } = auth;

    const { verifier, challenge } = generatePKCE();
    const state = generateState();

    // Persist verifier in DB so it survives across Vercel function invocations.
    // Consumed and deleted by the callback (one-time use → replay-safe).
    await prisma.outlookOAuthState.create({
      data: { state, verifier, workspaceId, userId: user.id },
    });

    const authUrl = buildAuthorizationUrl({
      state,
      codeChallenge: challenge,
      redirectUri: getOutlookRedirectUri(),
    });

    return NextResponse.redirect(authUrl);
  },
);
