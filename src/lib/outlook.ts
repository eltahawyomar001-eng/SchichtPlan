/**
 * Microsoft Outlook (Microsoft Graph) calendar integration.
 * ─────────────────────────────────────────────────────────
 * Native OAuth2 Authorization Code Flow + PKCE against Microsoft Entra ID,
 * with no paid intermediary. A user connects their work/school (or personal)
 * Microsoft account once; we store the access + refresh tokens **encrypted at
 * rest** (AES-256-GCM, see src/lib/encryption.ts) on a per-user
 * `OutlookConnection` row and use them to read their calendar via Graph.
 *
 * Multi-tenant: the authority defaults to `common` so any Entra ID tenant (and
 * personal Microsoft accounts) can consent — the B2B SaaS model. Override with
 * OUTLOOK_TENANT_ID for a single-tenant lock-down.
 *
 * Microsoft token lifetimes: access_token ~60–90 min; refresh_token rolls for
 * up to 90 days and a fresh one is returned on each refresh. We refresh
 * proactively when < 5 minutes remain.
 *
 * Required env:
 *   OUTLOOK_CLIENT_ID      — Application (client) ID from the App Registration
 *   OUTLOOK_CLIENT_SECRET  — a client secret value
 *   OUTLOOK_TENANT_ID      — "common" (default) | "organizations" | <tenant-guid>
 *   OUTLOOK_REDIRECT_URI   — optional; defaults to
 *                            `${NEXTAUTH_URL}/api/integrations/outlook/callback`
 *   ENCRYPTION_KEY         — 32-byte hex (already required for 2FA)
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { encrypt, decrypt, isEncrypted } from "@/lib/encryption";
import { log } from "@/lib/logger";

/* ── Typed errors so callers can react precisely ─────────────────── */

/** No OutlookConnection exists for the user. */
export class OutlookNotConnectedError extends Error {
  constructor(userId: string) {
    super(`No Outlook connection for user ${userId}`);
    this.name = "OutlookNotConnectedError";
  }
}

/** The refresh token is invalid/revoked — the user must reconnect. */
export class OutlookReauthRequiredError extends Error {
  constructor(message = "Outlook re-authentication required") {
    super(message);
    this.name = "OutlookReauthRequiredError";
  }
}

/** A Microsoft Graph call failed. */
export class OutlookApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OutlookApiError";
  }
}

/* ── Configuration & endpoints ───────────────────────────────────── */

/** OAuth scopes. `offline_access` is what mints refresh tokens for background
 *  refresh; `User.Read` lets us read the connected account's email; and
 *  `Calendars.Read` is the read-only calendar grant. */
export const OUTLOOK_SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.Read",
] as const;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function tenant(): string {
  return process.env.OUTLOOK_TENANT_ID?.trim() || "common";
}

function authorizeEndpoint(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`;
}

function tokenEndpoint(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`;
}

function getClientId(): string {
  const id = process.env.OUTLOOK_CLIENT_ID;
  if (!id) throw new Error("OUTLOOK_CLIENT_ID is not configured");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.OUTLOOK_CLIENT_SECRET;
  if (!secret) throw new Error("OUTLOOK_CLIENT_SECRET is not configured");
  return secret;
}

export function getOutlookRedirectUri(): string {
  return (
    process.env.OUTLOOK_REDIRECT_URI?.trim() ||
    `${process.env.NEXTAUTH_URL ?? ""}/api/integrations/outlook/callback`
  );
}

/** True when the integration is configured enough to attempt a connect. */
export function isOutlookConfigured(): boolean {
  return (
    !!process.env.OUTLOOK_CLIENT_ID &&
    !!process.env.OUTLOOK_CLIENT_SECRET &&
    !!process.env.ENCRYPTION_KEY
  );
}

/* ── PKCE + state ────────────────────────────────────────────────── */

export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(40).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

/** Build the Microsoft authorization URL the browser is redirected to. */
export function buildAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const q = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: params.redirectUri,
    response_mode: "query",
    scope: OUTLOOK_SCOPES.join(" "),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    // Always show the account picker so a user can connect a different account
    // than the one they may already be signed into in the browser.
    prompt: "select_account",
  });
  return `${authorizeEndpoint()}?${q.toString()}`;
}

/* ── Token exchange & refresh ────────────────────────────────────── */

export interface OutlookTokenSet {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface MicrosoftTokenErrorBody {
  error?: string;
  error_description?: string;
}

async function postToken(
  body: URLSearchParams,
): Promise<
  | { ok: true; tokens: OutlookTokenSet }
  | { ok: false; error: string; status: number }
> {
  let res: Response;
  try {
    res = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "network error",
    };
  }

  if (!res.ok) {
    const parsed = (await res
      .json()
      .catch(() => null)) as MicrosoftTokenErrorBody | null;
    return {
      ok: false,
      status: res.status,
      error: parsed?.error
        ? `${parsed.error}: ${parsed.error_description ?? ""}`.slice(0, 300)
        : `HTTP ${res.status}`,
    };
  }

  return { ok: true, tokens: (await res.json()) as OutlookTokenSet };
}

/** Exchange the authorization code for tokens (with PKCE verifier). */
export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OutlookTokenSet> {
  const result = await postToken(
    new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
      scope: OUTLOOK_SCOPES.join(" "),
    }),
  );

  if (!result.ok) {
    log.error("[outlook] code exchange failed", {
      status: result.status,
      error: result.error,
    });
    throw new OutlookApiError(
      `Outlook token exchange failed: ${result.error}`,
      result.status,
    );
  }
  return result.tokens;
}

/** Exchange a refresh token for a fresh token set. Throws
 *  OutlookReauthRequiredError when Microsoft reports the grant is invalid. */
export async function refreshTokens(
  refreshToken: string,
): Promise<OutlookTokenSet> {
  const result = await postToken(
    new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: OUTLOOK_SCOPES.join(" "),
    }),
  );

  if (!result.ok) {
    // invalid_grant = refresh token revoked/expired → user must reconnect.
    if (/invalid_grant/i.test(result.error)) {
      throw new OutlookReauthRequiredError(result.error);
    }
    throw new OutlookApiError(
      `Outlook token refresh failed: ${result.error}`,
      result.status,
    );
  }
  return result.tokens;
}

/* ── Identity ────────────────────────────────────────────────────── */

/** Read the connected account's primary email via Graph /me (User.Read). */
export async function fetchMicrosoftEmail(
  accessToken: string,
): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new OutlookApiError(
      `Failed to read Microsoft profile: HTTP ${res.status}`,
      res.status,
    );
  }
  const me = (await res.json()) as {
    mail?: string | null;
    userPrincipalName?: string | null;
  };
  return me.mail || me.userPrincipalName || "unknown";
}

/* ── Persistence (encrypted at rest) ─────────────────────────────── */

/**
 * Upsert the user's connection, encrypting both tokens. A refresh response may
 * omit refresh_token (rare); in that case we keep the previous one.
 */
export async function saveOutlookConnection(params: {
  userId: string;
  tokens: OutlookTokenSet;
  microsoftEmail?: string;
}): Promise<void> {
  const { userId, tokens } = params;
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1_000);

  const existing = await prisma.outlookConnection.findUnique({
    where: { userId },
    select: { refreshToken: true, microsoftEmail: true },
  });

  const refreshPlain =
    tokens.refresh_token ??
    (existing ? decryptToken(existing.refreshToken) : undefined);
  if (!refreshPlain) {
    // No refresh token at all → background refresh is impossible. Treat as a
    // hard failure so the caller surfaces a reconnect prompt.
    throw new OutlookReauthRequiredError(
      "Microsoft did not return a refresh token (is offline_access granted?)",
    );
  }

  const email = params.microsoftEmail ?? existing?.microsoftEmail ?? "unknown";

  const data = {
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(refreshPlain),
    tokenExpiresAt,
    microsoftEmail: email,
    scope: tokens.scope ?? null,
  };

  await prisma.outlookConnection.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/** Decrypt a stored token, tolerating any legacy plaintext value. */
function decryptToken(stored: string): string {
  return isEncrypted(stored) ? decrypt(stored) : stored;
}

/* ── Valid-token accessor (auto-refresh) ─────────────────────────── */

/**
 * Return a live Microsoft access token for the user, refreshing transparently
 * when it is within 5 minutes of expiry. Throws OutlookNotConnectedError if the
 * user has never connected, and OutlookReauthRequiredError if the refresh token
 * is no longer valid (in which case the stale connection is removed).
 */
export async function getValidOutlookToken(userId: string): Promise<string> {
  const conn = await prisma.outlookConnection.findUnique({ where: { userId } });
  if (!conn) throw new OutlookNotConnectedError(userId);

  const FIVE_MIN = 5 * 60 * 1_000;
  const stillValid = conn.tokenExpiresAt.getTime() - Date.now() > FIVE_MIN;
  if (stillValid) return decryptToken(conn.accessToken);

  // Expired or near-expiry → refresh.
  let fresh: OutlookTokenSet;
  try {
    fresh = await refreshTokens(decryptToken(conn.refreshToken));
  } catch (err) {
    if (err instanceof OutlookReauthRequiredError) {
      // The grant is dead — drop the connection so the UI shows "reconnect".
      await prisma.outlookConnection
        .delete({ where: { userId } })
        .catch(() => {});
      log.warn("[outlook] refresh token revoked — connection removed", {
        userId,
      });
    }
    throw err;
  }

  await saveOutlookConnection({ userId, tokens: fresh });
  return fresh.access_token;
}

/* ── Calendar fetch + mapping ────────────────────────────────────── */

/** Standardized shape the frontend renders alongside shifts. */
export interface NormalizedCalendarEvent {
  id: string;
  title: string;
  /** ISO-8601 UTC */
  start: string;
  /** ISO-8601 UTC */
  end: string;
  isAllDay: boolean;
  location: string | null;
  /** free | tentative | busy | oof | workingElsewhere | unknown */
  status: string;
  isCancelled: boolean;
  webLink: string | null;
  source: "outlook";
}

interface GraphDateTimeZone {
  dateTime: string;
  timeZone: string;
}

interface GraphEvent {
  id: string;
  subject?: string | null;
  start?: GraphDateTimeZone;
  end?: GraphDateTimeZone;
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
  webLink?: string | null;
  location?: { displayName?: string | null } | null;
}

/** Convert a Graph {dateTime,timeZone:"UTC"} into an ISO-8601 UTC string. */
function toIsoUtc(dt: GraphDateTimeZone | undefined): string {
  if (!dt?.dateTime) return new Date(0).toISOString();
  // With `Prefer: outlook.timezone="UTC"` Graph returns UTC wall-time without a
  // trailing 'Z'. Append it so Date parses as UTC rather than local.
  const raw = dt.dateTime;
  const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  return isNaN(parsed.getTime())
    ? new Date(0).toISOString()
    : parsed.toISOString();
}

function mapEvent(ev: GraphEvent): NormalizedCalendarEvent {
  return {
    id: ev.id,
    title: ev.subject?.trim() || "(Kein Titel)",
    start: toIsoUtc(ev.start),
    end: toIsoUtc(ev.end),
    isAllDay: !!ev.isAllDay,
    location: ev.location?.displayName?.trim() || null,
    status: ev.showAs ?? "unknown",
    isCancelled: !!ev.isCancelled,
    webLink: ev.webLink ?? null,
    source: "outlook",
  };
}

/**
 * Fetch the user's Outlook calendar events in [startDate, endDate], normalized
 * for the frontend. Uses calendarView (which expands recurring series into
 * instances) and follows pagination, bounded to avoid unbounded fan-out.
 */
export async function fetchOutlookEvents(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<NormalizedCalendarEvent[]> {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new OutlookApiError("Invalid startDate", 400);
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    throw new OutlookApiError("Invalid endDate", 400);
  }
  if (endDate <= startDate) {
    throw new OutlookApiError("endDate must be after startDate", 400);
  }
  // Bound the window so a caller can't request years of data in one shot.
  const MAX_RANGE_DAYS = 186;
  if ((endDate.getTime() - startDate.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new OutlookApiError(
      `Calendar window must be ≤ ${MAX_RANGE_DAYS} days`,
      400,
    );
  }

  const accessToken = await getValidOutlookToken(userId);

  const query = new URLSearchParams({
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    $select:
      "id,subject,start,end,isAllDay,isCancelled,showAs,webLink,location",
    $orderby: "start/dateTime",
    $top: "100",
  });

  let url: string | null = `${GRAPH_BASE}/me/calendarView?${query.toString()}`;
  const events: NormalizedCalendarEvent[] = [];
  const MAX_PAGES = 20; // 20 × 100 = 2000 events hard cap

  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Return all times in UTC for deterministic parsing.
        Prefer: 'outlook.timezone="UTC"',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log.error("[outlook] calendarView failed", {
        userId,
        status: res.status,
        detail: detail.slice(0, 300),
      });
      // 401 here means the token was rejected mid-flight despite refresh logic.
      if (res.status === 401) {
        throw new OutlookReauthRequiredError("Microsoft rejected the token");
      }
      throw new OutlookApiError(
        `Microsoft Graph calendarView failed (HTTP ${res.status})`,
        res.status,
      );
    }

    const body = (await res.json()) as {
      value?: GraphEvent[];
      "@odata.nextLink"?: string;
    };
    for (const ev of body.value ?? []) events.push(mapEvent(ev));
    url = body["@odata.nextLink"] ?? null;
  }

  return events;
}
