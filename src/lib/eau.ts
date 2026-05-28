/**
 * eAU — elektronische Arbeitsunfähigkeitsbescheinigung.
 *
 * Since 2023, German employers must retrieve sick notes electronically from the
 * employee's statutory health insurer (GKV) instead of receiving paper. The
 * exchange runs over the GKV communication server using a certified procedure
 * (ITSG / SV-Meldeverfahren) and requires:
 *   • a Betriebsnummer (employer number) from the Bundesagentur für Arbeit,
 *   • an ITSG-issued organisation certificate (SV-Meldeverfahren / DSAU),
 *   • a certified gateway or the free SV-Meldeportal.
 *
 * Because the actual transmission requires that certified infrastructure, this
 * module defines a provider interface with two implementations:
 *   • HttpEauProvider — posts to a configured gateway/connector that exposes a
 *     JSON facade (set EAU_GATEWAY_URL). Use this once a certified connector is
 *     in place.
 *   • ManualEauProvider — the default. Records eAU data the employer retrieved
 *     through their certified portal, so the absence registry stays compliant
 *     and auditable even without an automated connector.
 *
 * Important: an eAU response never contains a diagnosis — employers are not
 * entitled to it. Only the incapacity period, issue date, initial/follow-up
 * flag and the insurer are returned.
 */

export type EauResultStatus =
  | "RETRIEVED"
  | "NOT_FOUND"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface EauQuery {
  employee: { firstName: string; lastName: string };
  /** Versicherungsnummer (SV-Nummer) of the employee, if known. */
  insuranceNumber?: string | null;
  /** IK number of the Krankenkasse, if known. */
  krankenkasseIk?: string | null;
  /** Date the incapacity began (YYYY-MM-DD). */
  incapacityDate: string;
  /** True for an Erstbescheinigung query, false for a Folgebescheinigung. */
  isInitial?: boolean;
}

export interface EauResult {
  status: EauResultStatus;
  auFrom?: string;
  auTo?: string;
  isInitial?: boolean;
  issuedDate?: string;
  krankenkasse?: string;
  reference?: string;
  message?: string;
}

export interface EauProvider {
  readonly name: string;
  isConfigured(): boolean;
  query(q: EauQuery): Promise<EauResult>;
}

/** Default provider — no automated retrieval; data is entered manually. */
class ManualEauProvider implements EauProvider {
  readonly name = "manual";
  isConfigured(): boolean {
    return false;
  }
  async query(): Promise<EauResult> {
    return {
      status: "NOT_CONFIGURED",
      message:
        "Kein eAU-Gateway konfiguriert. Bitte die über das SV-Meldeportal " +
        "abgerufenen eAU-Daten manuell erfassen.",
    };
  }
}

/**
 * Posts the query to a certified connector exposing a JSON facade.
 * Expected response JSON (normalised):
 *   { status, auFrom, auTo, isInitial, issuedDate, krankenkasse, reference, message }
 */
class HttpEauProvider implements EauProvider {
  readonly name = "http";
  private url = process.env.EAU_GATEWAY_URL ?? "";
  private apiKey = process.env.EAU_API_KEY ?? "";
  private betriebsnummer = process.env.EAU_BETRIEBSNUMMER ?? "";

  isConfigured(): boolean {
    return this.url.length > 0;
  }

  async query(q: EauQuery): Promise<EauResult> {
    if (!this.isConfigured()) {
      return { status: "NOT_CONFIGURED", message: "EAU_GATEWAY_URL fehlt." };
    }
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ ...q, betriebsnummer: this.betriebsnummer }),
        // Connector calls can be slow; cap at 20s.
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        return {
          status: "ERROR",
          message: `eAU-Gateway antwortete mit ${res.status}.`,
        };
      }
      const data = (await res.json()) as Partial<EauResult>;
      return {
        status: data.status ?? "RETRIEVED",
        auFrom: data.auFrom,
        auTo: data.auTo,
        isInitial: data.isInitial,
        issuedDate: data.issuedDate,
        krankenkasse: data.krankenkasse,
        reference: data.reference,
        message: data.message,
      };
    } catch (err) {
      return {
        status: "ERROR",
        message:
          err instanceof Error
            ? `eAU-Abruf fehlgeschlagen: ${err.message}`
            : "eAU-Abruf fehlgeschlagen.",
      };
    }
  }
}

/** Resolve the active provider from environment configuration. */
export function getEauProvider(): EauProvider {
  if (process.env.EAU_GATEWAY_URL) return new HttpEauProvider();
  return new ManualEauProvider();
}

/** Map a provider result status to the persisted EauStatus enum value. */
export function resultToStatus(
  status: EauResultStatus,
): "RETRIEVED" | "NOT_FOUND" | "ERROR" | "PENDING" {
  switch (status) {
    case "RETRIEVED":
      return "RETRIEVED";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "ERROR":
      return "ERROR";
    default:
      return "PENDING";
  }
}
