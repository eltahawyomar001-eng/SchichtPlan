/**
 * GET /api/auth/callback/datev?code=...&state=...
 *
 * DATEV OIDC callback — exchanges the authorization code for tokens,
 * stores them in DATEVToken, and redirects to the settings page.
 *
 * Error handling:
 *  - state mismatch / expired → 400 (CSRF protection)
 *  - token exchange failure   → redirect to settings with error param
 */

import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { exchangeCodeForTokens, saveDatevTokens } from "@/lib/datev-oidc";
import { log } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = `${process.env.NEXTAUTH_URL ?? ""}/einstellungen?datev=`;

  // User denied access on DATEV's side.
  if (error) {
    log.warn("[datev-callback] user denied or error from DATEV", { error });
    return NextResponse.redirect(`${settingsUrl}denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}missing_params`);
  }

  // Retrieve and consume the PKCE session stored during /connect.
  const session = await cache.get<{
    verifier: string;
    workspaceId: string;
    userId: string;
  }>(`datev:oidc:${state}`);
  await cache.del(`datev:oidc:${state}`); // one-time use

  if (!session) {
    log.warn("[datev-callback] state not found or expired", { state });
    return NextResponse.redirect(`${settingsUrl}state_mismatch`);
  }

  const redirectUri =
    process.env.DATEV_REDIRECT_URI ??
    `${process.env.NEXTAUTH_URL}/api/auth/callback/datev`;

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: session.verifier,
      redirectUri,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[datev-callback] token exchange failed", { error: msg });
    return NextResponse.redirect(
      `${settingsUrl}token_error&detail=${encodeURIComponent(msg.slice(0, 100))}`,
    );
  }

  await saveDatevTokens(session.workspaceId, tokens, session.userId);

  createAuditLog({
    action: "CREATE",
    entityType: "DATEVToken",
    entityId: session.workspaceId,
    userId: session.userId,
    workspaceId: session.workspaceId,
    changes: {
      scope: tokens.scope,
      sandbox: process.env.DATEV_SANDBOX !== "false",
    },
  });

  log.info("[datev-callback] DATEV connected successfully", {
    workspaceId: session.workspaceId,
  });

  return NextResponse.redirect(`${settingsUrl}connected`);
}
