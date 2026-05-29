/**
 * GET /api/auth/datev/connect
 *
 * Initiates the DATEV OpenID Connect Authorization Code Flow with PKCE.
 * Only OWNER/ADMIN may connect DATEV to their workspace.
 *
 * Flow:
 *  1. Generate PKCE verifier + S256 challenge.
 *  2. Generate a random state token (CSRF protection).
 *  3. Store {verifier, workspaceId} in cache under state key (10 min TTL).
 *  4. Redirect browser to DATEV's authorize endpoint.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import { cache } from "@/lib/cache";
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
} from "@/lib/datev-oidc";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const { verifier, challenge } = generatePKCE();
  const state = generateState();

  // Store PKCE verifier + workspaceId keyed by state — 10 min window.
  await cache.set(
    `datev:oidc:${state}`,
    { verifier, workspaceId, userId: user.id },
    600,
  );

  const redirectUri =
    process.env.DATEV_REDIRECT_URI ??
    `${process.env.NEXTAUTH_URL}/api/auth/callback/datev`;

  const authUrl = buildAuthorizationUrl({
    state,
    codeChallenge: challenge,
    redirectUri,
  });

  return NextResponse.redirect(authUrl);
}
