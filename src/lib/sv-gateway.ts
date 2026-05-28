/**
 * SV-Meldeverfahren gateway client — eAU & Sofortmeldung.
 *
 * Architecture: we do NOT operate our own certified GKV/DSRV transport server
 * (that would require the full SV system certification audit). Instead we format
 * the payloads and route them through a certified third-party middleware /
 * clearinghouse (e.g. DATEV HR APIs `hr:eau`, or a DEÜV clearinghouse) that
 * already handles the official secure transmission to the Krankenkassen (GKV)
 * and the Rentenversicherung Datenstelle (DSRV).
 *
 * Auth: OAuth2 client-credentials grant (the standard for professional HR APIs).
 * The token is fetched once and cached until shortly before expiry.
 *
 * Sandbox: set PROCESS_SV_SANDBOX=true (default) to exercise the full flow with
 * realistic mock responses (201 Created + tracking IDs, plus typical error
 * cases like privately-insured employees) without touching live pipelines.
 *
 * Required env (production):
 *   PROCESS_SV_SANDBOX=false
 *   SV_GATEWAY_TOKEN_URL   — OAuth2 token endpoint
 *   SV_GATEWAY_BASE_URL    — API base (eAU + Sofortmeldung endpoints)
 *   SV_CLIENT_ID
 *   SV_CLIENT_SECRET
 *   SV_SCOPE               — e.g. "hr:eau hr:sofortmeldung"
 */

import { log } from "@/lib/logger";

export function isSvSandbox(): boolean {
  // Default to sandbox unless explicitly disabled — fail safe, never live by accident.
  return process.env.PROCESS_SV_SANDBOX !== "false";
}

/* ── OAuth2 client-credentials token (cached) ───────────────────── */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (isSvSandbox()) return "sandbox-token";

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const tokenUrl = process.env.SV_GATEWAY_TOKEN_URL;
  const clientId = process.env.SV_CLIENT_ID;
  const clientSecret = process.env.SV_CLIENT_SECRET;
  const scope = process.env.SV_SCOPE ?? "";
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error("SV_GATEWAY_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    ...(scope ? { scope } : {}),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`SV_TOKEN_ERROR: ${res.status}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function gatewayFetch(
  path: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const base = process.env.SV_GATEWAY_BASE_URL;
  if (!base) throw new Error("SV_GATEWAY_NOT_CONFIGURED");
  const token = await getAccessToken();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/* ── eAU (elektronische Arbeitsunfähigkeitsbescheinigung) ───────── */

export interface EauGatewayInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  socialSecurityNumber: string | null; // Versicherungsnummer
  sicknessStartDate: string; // YYYY-MM-DD
  betriebsnummer: string;
}

export interface EauGatewayResult {
  status: "ACCEPTED" | "NOT_INSURED" | "NOT_FOUND" | "ERROR";
  trackingId?: string;
  auFrom?: string;
  auTo?: string;
  isInitial?: boolean;
  raw?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export async function requestEau(
  input: EauGatewayInput,
): Promise<EauGatewayResult> {
  // The eAU request body mirrors the DATEV hr:eau request shape.
  const payload = {
    employer: { betriebsnummer: input.betriebsnummer },
    insured: {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      insuranceNumber: input.socialSecurityNumber,
    },
    incapacity: { startDate: input.sicknessStartDate },
  };

  if (isSvSandbox()) return mockEau(input);

  try {
    const { ok, status, json } = await gatewayFetch(
      "/v1/eau/requests",
      payload,
    );
    if (!ok) {
      return {
        status: status === 422 ? "NOT_INSURED" : "ERROR",
        errorCode: String(status),
        errorMessage:
          (json as { message?: string })?.message ??
          `Gateway responded ${status}`,
        raw: json,
      };
    }
    const r = json as {
      trackingId?: string;
      result?: { from?: string; to?: string; initial?: boolean };
    };
    return {
      status: "ACCEPTED",
      trackingId: r.trackingId,
      auFrom: r.result?.from,
      auTo: r.result?.to,
      isInitial: r.result?.initial,
      raw: json,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[sv-gateway] eAU request failed", { error: msg });
    return { status: "ERROR", errorCode: "GATEWAY_ERROR", errorMessage: msg };
  }
}

/** Sandbox simulator — realistic responses without touching live pipelines. */
function mockEau(input: EauGatewayInput): EauGatewayResult {
  // No SV number → simulate a privately-insured employee (no eAU available).
  if (!input.socialSecurityNumber) {
    return {
      status: "NOT_INSURED",
      errorCode: "PRIVATE_INSURANCE",
      errorMessage:
        "Kein gesetzlicher eAU-Abruf möglich (vermutlich privat versichert).",
    };
  }
  const start = new Date(input.sicknessStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  return {
    status: "ACCEPTED",
    trackingId: `SBX-EAU-${Date.now().toString(36).toUpperCase()}`,
    auFrom: input.sicknessStartDate,
    auTo: end.toLocaleDateString("en-CA"),
    isInitial: true,
    raw: { sandbox: true },
  };
}

/* ── Sofortmeldung (Meldegrund 20) ──────────────────────────────── */

export interface SofortmeldungInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  socialSecurityNumber: string | null;
  birthPlace: string | null; // fallback identifier when SV-Nr. missing
  nationality: string | null; // fallback identifier when SV-Nr. missing
  betriebsnummer: string;
  employmentStartDate: string; // YYYY-MM-DD — Eintrittsdatum
}

export interface SofortmeldungResult {
  status: "ACCEPTED" | "REJECTED" | "ERROR";
  trackingId?: string;
  raw?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

/** Build the exact DEÜV Sofortmeldung (Meldegrund 20) payload from DB data. */
export function buildSofortmeldungPayload(input: SofortmeldungInput) {
  return {
    meldegrund: "20", // Sofortmeldung
    employer: { betriebsnummer: input.betriebsnummer },
    employee: {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      // Versicherungsnummer preferred; fall back to birthplace + nationality
      // when it is not yet known (permitted for the Sofortmeldung).
      ...(input.socialSecurityNumber
        ? { insuranceNumber: input.socialSecurityNumber }
        : {
            birthPlace: input.birthPlace,
            nationality: input.nationality,
          }),
    },
    employment: { entryDate: input.employmentStartDate },
  };
}

export async function submitSofortmeldung(
  input: SofortmeldungInput,
): Promise<SofortmeldungResult> {
  const payload = buildSofortmeldungPayload(input);

  if (isSvSandbox()) {
    // Reject when neither SV-Nr. nor (birthplace+nationality) is present —
    // the DSRV cannot identify the person otherwise.
    if (
      !input.socialSecurityNumber &&
      (!input.birthPlace || !input.nationality)
    ) {
      return {
        status: "REJECTED",
        errorCode: "MISSING_IDENTIFIER",
        errorMessage:
          "Versicherungsnummer oder Geburtsort + Staatsangehörigkeit erforderlich.",
      };
    }
    return {
      status: "ACCEPTED",
      trackingId: `SBX-SOFORT-${Date.now().toString(36).toUpperCase()}`,
      raw: { sandbox: true, payload },
    };
  }

  try {
    const { ok, status, json } = await gatewayFetch(
      "/v1/sofortmeldung",
      payload,
    );
    if (!ok) {
      return {
        status: status === 422 ? "REJECTED" : "ERROR",
        errorCode: String(status),
        errorMessage:
          (json as { message?: string })?.message ??
          `Gateway responded ${status}`,
        raw: json,
      };
    }
    return {
      status: "ACCEPTED",
      trackingId: (json as { trackingId?: string })?.trackingId,
      raw: json,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[sv-gateway] Sofortmeldung failed", { error: msg });
    return { status: "ERROR", errorCode: "GATEWAY_ERROR", errorMessage: msg };
  }
}
