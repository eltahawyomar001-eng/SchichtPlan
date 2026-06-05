/**
 * GET /api/auth/datev/connect
 *
 * Initiates the DATEV OpenID Connect Authorization Code Flow + PKCE.
 * Only OWNER/ADMIN may connect DATEV to their workspace.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
} from "@/lib/datev-oidc";
import { withRoute } from "@/lib/with-route";

export const dynamic = "force-dynamic";

export const GET = withRoute("/api/auth/datev/connect", "GET", async () => {
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

  // Persist verifier in DB — survives across Vercel function invocations.
  // Cleaned up immediately when the callback consumes it.
  await prisma.datevOAuthState.create({
    data: { state, verifier, workspaceId, userId: user.id },
  });

  const redirectUri =
    process.env.DATEV_REDIRECT_URI ??
    `${process.env.NEXTAUTH_URL}/api/auth/callback/datev`;

  const authUrl = buildAuthorizationUrl({
    state,
    codeChallenge: challenge,
    redirectUri,
  });

  return NextResponse.redirect(authUrl);
});
