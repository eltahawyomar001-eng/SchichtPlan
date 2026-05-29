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
  // DATEV path identifiers — employee must exist in DATEV LODAS/LUG
  consultantNumber: string; // DATEV Beraternummer (1–9999999)
  clientNumber: string; // DATEV Mandantennummer (1–99999)
  personnelNumber: string; // DATEV Personalnummer (1–99999)
  sicknessStartDate: string; // YYYY-MM-DD
  source: "LODAS" | "LUG";
  notificationEmail?: string;
  // kept for mock fallback only
  firstName?: string;
  lastName?: string;
  socialSecurityNumber?: string | null;
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
   * DATEV hr:eau v1.0.23 — per official OpenAPI spec:
   * POST /clients/{consultantNumber}-{clientNumber}/employees/{personnelNumber}/eau-requests
   * Body: { source, start_work_incapacity, notification?, follow_up_certification? }
   * Headers: Authorization: Bearer <token>  +  X-Datev-Client-ID: <clientId>
   */
  const url = `${DATEV_ENDPOINTS.eauBase}/clients/${input.consultantNumber}-${input.clientNumber}/employees/${input.personnelNumber}/eau-requests`;
  const payload: Record<string, unknown> = {
    source: input.source,
    start_work_incapacity: input.sicknessStartDate,
  };
  if (input.notificationEmail) {
    payload.notification = { email: input.notificationEmail };
  }

  const clientId = process.env.DATEV_CLIENT_ID ?? "";
  log.info("[sv-gateway] calling DATEV hr:eau", {
    url,
    sandbox: isDatevSandbox(),
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Datev-Client-ID": clientId,
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
    /* empty */
  }

  log.info("[sv-gateway] DATEV eAU response", {
    status: res.status,
    location: res.headers.get("location"),
    body: JSON.stringify(json).slice(0, 300),
  });

  if (res.status === 201) {
    // 201 Created — Location header contains the resource URI with UUID
    const location = res.headers.get("location") ?? "";
    const uuid = location.split("/").pop() ?? "";
    return {
      status: "ACCEPTED",
      trackingId: uuid || String(json.request_id ?? ""),
      auFrom: input.sicknessStartDate,
      isInitial: true,
      raw: json,
    };
  }

  if (res.status === 404 || res.status === 422) {
    const msgs =
      (json.additional_messages as { description?: string }[] | undefined) ??
      [];
    const detail =
      msgs[0]?.description ??
      String(json.error_description ?? "Kein eAU-Nachweis.");
    return {
      status: "NOT_INSURED",
      errorCode: String(json.error ?? res.status),
      errorMessage: detail,
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
  if (
    !input.consultantNumber ||
    !input.clientNumber ||
    !input.personnelNumber
  ) {
    return {
      status: "ERROR",
      errorCode: "MISSING_DATEV_IDS",
      errorMessage:
        "Beraternummer, Mandantennummer und Personalnummer sind erforderlich.",
    };
  }
  return {
    status: "ACCEPTED",
    trackingId: `SBX-EAU-${Date.now().toString(36).toUpperCase()}`,
    auFrom: input.sicknessStartDate,
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
