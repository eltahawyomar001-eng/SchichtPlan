/**
 * DATEV OpenID Connect helpers.
 *
 * DATEV uses the Authorization Code Flow + PKCE (S256).
 * This is a user-delegated flow — an OWNER/ADMIN must authenticate once
 * in their browser via DATEV's login page to grant the workspace access.
 * The resulting access + refresh tokens are stored per workspace in DATEVToken.
 *
 * Sandbox vs Production:
 *   DATEV_SANDBOX=true  → login.datev.de/openidsandbox  + sandbox-api.datev.de
 *   DATEV_SANDBOX=false → login.datev.de/openid         + api.datev.de
 *
 * DATEV token lifetime: access_token ~1h, refresh_token 11h (fixed, public client).
 * We proactively refresh when < 5 minutes remain.
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

// ── OIDC endpoints ──────────────────────────────────────────────
export function isDatevSandbox(): boolean {
  return process.env.DATEV_SANDBOX !== "false";
}

function baseLogin(): string {
  return isDatevSandbox()
    ? "https://login.datev.de/openidsandbox"
    : "https://login.datev.de/openid";
}

function baseApi(): string {
  return isDatevSandbox()
    ? "https://sandbox-api.datev.de"
    : "https://api.datev.de";
}

export const DATEV_ENDPOINTS = {
  get authorize() {
    return `${baseLogin()}/authorize`;
  },
  // Token endpoint is always api.datev.de — same for sandbox and production.
  token: "https://api.datev.de/token",
  get userinfo() {
    return `${baseApi()}/userinfo`;
  },
  get eauBase() {
    return `${baseApi()}/hr/eau/v1`;
  },
};

// ── PKCE helpers ────────────────────────────────────────────────
export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(40).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

// ── Build the authorization URL ─────────────────────────────────
export function buildAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const clientId = process.env.DATEV_CLIENT_ID;
  if (!clientId) throw new Error("DATEV_CLIENT_ID not set");

  const q = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: params.redirectUri,
    scope: "openid profile email datev:hr:eau",
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${DATEV_ENDPOINTS.authorize}?${q.toString()}`;
}

// ── Token exchange ──────────────────────────────────────────────
export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const clientId = process.env.DATEV_CLIENT_ID!;
  const clientSecret = process.env.DATEV_CLIENT_SECRET!;
  if (!clientId || !clientSecret)
    throw new Error("DATEV credentials not configured");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(DATEV_ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error("[datev-oidc] token exchange failed", {
      status: res.status,
      body: text,
    });
    throw new Error(
      `DATEV token exchange failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }

  return res.json() as Promise<TokenSet>;
}

// ── Refresh an expired access token ────────────────────────────
export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenSet> {
  const clientId = process.env.DATEV_CLIENT_ID!;
  const clientSecret = process.env.DATEV_CLIENT_SECRET!;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(DATEV_ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `DATEV token refresh failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
  return res.json() as Promise<TokenSet>;
}

// ── Persist tokens for a workspace ─────────────────────────────
export async function saveDatevTokens(
  workspaceId: string,
  tokens: TokenSet,
  connectedById?: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1_000);
  await prisma.dATEVToken.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      idToken: tokens.id_token ?? null,
      tokenType: tokens.token_type,
      expiresAt,
      scope: tokens.scope ?? null,
      sandbox: isDatevSandbox(),
      connectedById: connectedById ?? null,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      idToken: tokens.id_token ?? null,
      tokenType: tokens.token_type,
      expiresAt,
      scope: tokens.scope ?? null,
      updatedAt: new Date(),
    },
  });
}

// ── Get a valid access token (auto-refresh if near expiry) ──────
export async function getDatevAccessToken(
  workspaceId: string,
): Promise<string | null> {
  const stored = await prisma.dATEVToken.findUnique({
    where: { workspaceId },
  });
  if (!stored) return null;

  const fiveMinutes = 5 * 60 * 1_000;
  const isExpired = stored.expiresAt.getTime() - Date.now() < fiveMinutes;

  if (!isExpired) return stored.accessToken;

  // Try refreshing
  if (!stored.refreshToken) {
    log.warn(
      "[datev-oidc] token expired, no refresh token — re-auth required",
      { workspaceId },
    );
    return null;
  }

  try {
    log.info("[datev-oidc] refreshing token", { workspaceId });
    const fresh = await refreshAccessToken(stored.refreshToken);
    await saveDatevTokens(
      workspaceId,
      fresh,
      stored.connectedById ?? undefined,
    );
    return fresh.access_token;
  } catch (err) {
    log.error("[datev-oidc] token refresh failed", {
      error: err instanceof Error ? err.message : String(err),
      workspaceId,
    });
    return null;
  }
}
