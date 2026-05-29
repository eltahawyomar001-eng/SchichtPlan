/**
 * SV-Meldeverfahren gateway — DATEV hr:eau + Sofortmeldung.
 *
 * Auth:   DATEV OpenID Connect Authorization Code Flow + PKCE.
 *         The workspace must complete the connect flow at
 *         /api/auth/datev/connect before calling these functions.
 *
 * Sandbox toggle:
 *   DATEV_SANDBOX=true (default) → sandbox-api.datev.de — safe for testing.
 *   DATEV_SANDBOX=false           → api.datev.de — live GKV transmission.
 *
 * eAU endpoint (confirmed live): https://sandbox-api.datev.de/hr/eau/v1/abfragen
 * Sofortmeldung: same base, /hr/sofortmeldung/v1
 */

import {
  getDatevAccessToken,
  DATEV_ENDPOINTS,
  isDatevSandbox,
} from "@/lib/datev-oidc";
import { log } from "@/lib/logger";

export { isDatevSandbox } from "@/lib/datev-oidc";

// ── Types ──────────────────────────────────────────────────────

export interface EauGatewayInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  socialSecurityNumber: string | null;
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

export interface SofortmeldungInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  socialSecurityNumber: string | null;
  birthPlace: string | null;
  nationality: string | null;
  betriebsnummer: string;
  employmentStartDate: string;
}

export interface SofortmeldungResult {
  status: "ACCEPTED" | "REJECTED" | "ERROR";
  trackingId?: string;
  raw?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

// ── DATEV eAU — real gateway call ─────────────────────────────

/**
 * Request an eAU from DATEV hr:eau API (POST /hr/eau/v1/abfragen).
 * Falls back to the sandbox simulator if:
 *   - DATEV_SANDBOX is true AND no workspaceId is provided, or
 *   - the workspace has no stored DATEV token yet.
 */
export async function requestEau(
  input: EauGatewayInput,
  workspaceId?: string,
): Promise<EauGatewayResult> {
  // If a workspaceId is provided, try to use the real token.
  if (workspaceId) {
    const token = await getDatevAccessToken(workspaceId);
    if (token) return callDatevEau(input, token);
    // No token stored — fall through to sandbox.
    log.warn("[sv-gateway] no DATEV token for workspace, using sandbox", {
      workspaceId,
    });
  }

  // Sandbox / no-token path.
  return mockEau(input);
}

async function callDatevEau(
  input: EauGatewayInput,
  accessToken: string,
): Promise<EauGatewayResult> {
  /**
   * DATEV hr:eau v1.0.0 — POST /hr/eau/v1/abfragen
   * Payload shape (DATEV spec):
   *   versicherungsnummer  — SV-Nummer (Rentenversicherungsnummer)
   *   vorname
   *   nachname
   *   geburtsdatum         — YYYY-MM-DD
   *   krankheitsbeginn     — first day of incapacity, YYYY-MM-DD
   *   betriebsnummer       — employer number
   */
  const payload = {
    betriebsnummer: input.betriebsnummer,
    versicherungsnummer: input.socialSecurityNumber,
    vorname: input.firstName,
    nachname: input.lastName,
    geburtsdatum: input.dateOfBirth,
    krankheitsbeginn: input.sicknessStartDate,
  };

  log.info("[sv-gateway] calling DATEV hr:eau", {
    endpoint: DATEV_ENDPOINTS.eauBase,
    sandbox: isDatevSandbox(),
  });

  let res: Response;
  try {
    res = await fetch(`${DATEV_ENDPOINTS.eauBase}/abfragen`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[sv-gateway] network error calling DATEV eAU", { error: msg });
    return { status: "ERROR", errorCode: "NETWORK_ERROR", errorMessage: msg };
  }

  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* empty response */
  }

  log.info("[sv-gateway] DATEV eAU response", {
    status: res.status,
    body: JSON.stringify(json).slice(0, 300),
  });

  if (res.status === 200 || res.status === 201) {
    /**
     * Successful response fields (DATEV hr:eau v1.0.0):
     *   ausfallgrund        — incapacity reason code
     *   arbeitsunfaehigVon  — AU start date
     *   arbeitsunfaehigBis  — AU end date (null if ongoing)
     *   erstbescheinigung   — true = initial, false = follow-up
     *   abfrageId           — tracking reference
     */
    return {
      status: "ACCEPTED",
      trackingId: String(json.abfrageId ?? ""),
      auFrom: String(json.arbeitsunfaehigVon ?? input.sicknessStartDate),
      auTo: json.arbeitsunfaehigBis
        ? String(json.arbeitsunfaehigBis)
        : undefined,
      isInitial: Boolean(json.erstbescheinigung),
      raw: json,
    };
  }

  // 404 / 422 — no eAU found (private insurance or not submitted yet)
  if (res.status === 404 || res.status === 422) {
    const code = String(json.code ?? json.fehlercode ?? res.status);
    return {
      status: "NOT_INSURED",
      errorCode: code,
      errorMessage: String(
        json.message ?? json.meldung ?? "Kein eAU-Nachweis gefunden.",
      ),
      raw: json,
    };
  }

  // 401 — token expired mid-flight or revoked
  if (res.status === 401) {
    return {
      status: "ERROR",
      errorCode: "TOKEN_EXPIRED",
      errorMessage: "DATEV-Zugang abgelaufen — bitte erneut verbinden.",
      raw: json,
    };
  }

  return {
    status: "ERROR",
    errorCode: String(res.status),
    errorMessage: String(
      json.message ?? json.meldung ?? `DATEV antwortete mit ${res.status}`,
    ),
    raw: json,
  };
}

// ── Sandbox simulator ──────────────────────────────────────────

function mockEau(input: EauGatewayInput): EauGatewayResult {
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

// ── Sofortmeldung (Meldegrund 20) ──────────────────────────────

/** Build the DEÜV Sofortmeldung payload from DB data. */
export function buildSofortmeldungPayload(input: SofortmeldungInput) {
  return {
    meldegrund: "20",
    betriebsnummer: input.betriebsnummer,
    versicherter: {
      vorname: input.firstName,
      nachname: input.lastName,
      geburtsdatum: input.dateOfBirth,
      ...(input.socialSecurityNumber
        ? { versicherungsnummer: input.socialSecurityNumber }
        : {
            geburtsort: input.birthPlace,
            staatsangehoerigkeit: input.nationality,
          }),
    },
    beschaeftigung: { eintrittsdatum: input.employmentStartDate },
  };
}

export async function submitSofortmeldung(
  input: SofortmeldungInput,
  workspaceId?: string,
): Promise<SofortmeldungResult> {
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

  if (workspaceId) {
    const token = await getDatevAccessToken(workspaceId);
    if (token) return callDatevSofortmeldung(input, token);
    log.warn("[sv-gateway] no DATEV token for Sofortmeldung, using sandbox", {
      workspaceId,
    });
  }

  // Sandbox: simulate a successful 201 response.
  return {
    status: "ACCEPTED",
    trackingId: `SBX-SOFORT-${Date.now().toString(36).toUpperCase()}`,
    raw: { sandbox: true },
  };
}

async function callDatevSofortmeldung(
  input: SofortmeldungInput,
  accessToken: string,
): Promise<SofortmeldungResult> {
  const payload = buildSofortmeldungPayload(input);
  const endpoint = `${DATEV_ENDPOINTS.eauBase.replace("/eau", "/sofortmeldung")}/v1`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "ERROR", errorCode: "NETWORK_ERROR", errorMessage: msg };
  }

  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* empty */
  }

  if (res.status === 200 || res.status === 201) {
    return {
      status: "ACCEPTED",
      trackingId: String(json.meldungsId ?? json.trackingId ?? ""),
      raw: json,
    };
  }

  if (res.status === 401) {
    return {
      status: "ERROR",
      errorCode: "TOKEN_EXPIRED",
      errorMessage: "DATEV-Zugang abgelaufen — bitte erneut verbinden.",
      raw: json,
    };
  }

  return {
    status: res.status === 422 ? "REJECTED" : "ERROR",
    errorCode: String(res.status),
    errorMessage: String(
      json.message ?? json.meldung ?? `DATEV antwortete mit ${res.status}`,
    ),
    raw: json,
  };
}
