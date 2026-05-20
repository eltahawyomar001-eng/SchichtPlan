import { log } from "@/lib/logger";

/**
 * DATEV Unternehmen Online — REST API client.
 *
 * DATEVconnect online uses OAuth 2.0. Access requires a registered
 * application in the DATEV Developer Portal (https://developer.datev.de)
 * plus a tax-advisor-side authorisation for the target client (Mandant).
 *
 * Env vars (Vercel, server-side only — never NEXT_PUBLIC_):
 *   DATEV_CLIENT_ID
 *   DATEV_CLIENT_SECRET
 *   DATEV_TOKEN_URL        — defaults to https://api.datev.de/token
 *   DATEV_API_BASE         — defaults to https://api.datev.de/accounting/v1
 *   DATEV_CLIENT_NUMBER    — DATEV Mandantennummer for the workspace
 *   DATEV_CONSULTANT_NUMBER — DATEV Beraternummer
 *
 * The token endpoint accepts client_credentials and returns a short-lived
 * bearer; we cache it in-process for its full TTL minus a 30s safety buffer.
 */

interface DatevConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  apiBase: string;
  clientNumber: string;
  consultantNumber: string;
}

interface DatevTokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: DatevTokenCache | null = null;

function readConfig(): DatevConfig | null {
  const clientId = process.env.DATEV_CLIENT_ID;
  const clientSecret = process.env.DATEV_CLIENT_SECRET;
  const clientNumber = process.env.DATEV_CLIENT_NUMBER;
  const consultantNumber = process.env.DATEV_CONSULTANT_NUMBER;

  if (!clientId || !clientSecret || !clientNumber || !consultantNumber) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    clientNumber,
    consultantNumber,
    tokenUrl: process.env.DATEV_TOKEN_URL || "https://api.datev.de/token",
    apiBase: process.env.DATEV_API_BASE || "https://api.datev.de/accounting/v1",
  };
}

export function isDatevConfigured(): boolean {
  return readConfig() !== null;
}

async function getAccessToken(config: DatevConfig): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 30_000 > now) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "accounting:write",
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DATEV token HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

export interface DatevUploadResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  datevReference?: string | null;
  status?: string;
  httpStatus?: number;
}

export async function uploadPayrollToDatev(payload: {
  format: string;
  period: { start: string; end: string };
  records: Array<Record<string, unknown>>;
  employeeSummary: Array<Record<string, unknown>>;
}): Promise<DatevUploadResult> {
  const config = readConfig();
  if (!config) {
    return {
      success: false,
      skipped: true,
      reason: "DATEV_NOT_CONFIGURED",
    };
  }

  try {
    const token = await getAccessToken(config);

    const res = await fetch(
      `${config.apiBase}/clients/${encodeURIComponent(config.clientNumber)}/wage-records`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-DATEV-Consultant-Number": config.consultantNumber,
        },
        body: JSON.stringify({
          format: payload.format,
          period: payload.period,
          records: payload.records,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.error("[datev-online] upload failed", {
        status: res.status,
        body: text.slice(0, 500),
      });
      return {
        success: false,
        reason: `HTTP_${res.status}`,
        httpStatus: res.status,
      };
    }

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      reference?: string;
      status?: string;
    };

    return {
      success: true,
      datevReference: data.reference ?? data.id ?? null,
      status: data.status ?? "ACCEPTED",
      httpStatus: res.status,
    };
  } catch (error) {
    log.error("[datev-online] unexpected error", { error });
    return { success: false, reason: "EXCEPTION" };
  }
}
