/**
 * GET /api/integrations/outlook/callback?code=...&state=...
 *
 * Microsoft OAuth callback — validates the one-time PKCE state, exchanges the
 * authorization code for tokens, reads the connected account's email, persists
 * the connection (tokens encrypted at rest), and redirects back to settings.
 *
 * Error handling mirrors the DATEV callback: every failure path redirects to
 * /einstellungen?outlook=<reason> so the OutlookConnectCard can surface it.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchMicrosoftEmail,
  saveOutlookConnection,
  getOutlookRedirectUri,
} from "@/lib/outlook";
import { log } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = process.env.NEXTAUTH_URL ?? "";
  const settingsUrl = `${base}/einstellungen?outlook=`;

  // User denied consent or Microsoft returned an error.
  if (error) {
    const desc = searchParams.get("error_description") ?? "";
    log.warn("[outlook-callback] error from Microsoft", { error, desc });
    return NextResponse.redirect(
      `${settingsUrl}denied&detail=${encodeURIComponent(`${error}: ${desc}`.slice(0, 200))}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}missing_params`);
  }

  // Retrieve and delete the PKCE state stored during /connect (one-time use).
  const session = await prisma.outlookOAuthState.findUnique({
    where: { state },
  });
  if (session) {
    // Delete regardless of outcome — prevents replay of the state value.
    await prisma.outlookOAuthState.delete({ where: { state } }).catch(() => {});
  }
  if (!session) {
    log.warn("[outlook-callback] state not found or expired", { state });
    return NextResponse.redirect(`${settingsUrl}state_mismatch`);
  }

  // Reject states older than 10 minutes.
  const ageMs = Date.now() - session.createdAt.getTime();
  if (ageMs > 10 * 60 * 1_000) {
    log.warn("[outlook-callback] state expired", { state, ageMs });
    return NextResponse.redirect(`${settingsUrl}state_mismatch`);
  }

  const redirectUri = getOutlookRedirectUri();

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: session.verifier,
      redirectUri,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[outlook-callback] token exchange failed", { error: msg });
    return NextResponse.redirect(
      `${settingsUrl}token_error&detail=${encodeURIComponent(msg.slice(0, 100))}`,
    );
  }

  // Best-effort read of the account email for display; never block the connect.
  let microsoftEmail: string | undefined;
  try {
    microsoftEmail = await fetchMicrosoftEmail(tokens.access_token);
  } catch (err) {
    log.warn("[outlook-callback] could not read profile email", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await saveOutlookConnection({
      userId: session.userId,
      tokens,
      microsoftEmail,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[outlook-callback] failed to persist connection", {
      error: msg,
    });
    return NextResponse.redirect(`${settingsUrl}save_error`);
  }

  createAuditLog({
    action: "CREATE",
    entityType: "OutlookConnection",
    entityId: session.userId,
    userId: session.userId,
    workspaceId: session.workspaceId,
    changes: { scope: tokens.scope, microsoftEmail },
  });

  log.info("[outlook-callback] Outlook connected successfully", {
    userId: session.userId,
  });

  return NextResponse.redirect(`${settingsUrl}connected`);
}
