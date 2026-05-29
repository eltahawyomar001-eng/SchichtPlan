/**
 * GET /api/auth/datev/connect
 *
 * Initiates the DATEV OpenID Connect Authorization Code Flow.
 * DATEV uses standard Authorization Code flow (no PKCE).
 * Only OWNER/ADMIN may connect DATEV to their workspace.
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
  if (!auth.ok) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL ?? "https://www.shiftfy.de"}/einstellungen?datev=auth_required`,
    );
  }
  const { user, workspaceId } = auth;

  const adminErr = requireAdmin(user);
  if (adminErr) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL ?? "https://www.shiftfy.de"}/einstellungen?datev=forbidden`,
    );
  }

  const { verifier, challenge } = generatePKCE();
  const state = generateState();

  // Store verifier + workspaceId + userId keyed by state — 10 min CSRF window.
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
