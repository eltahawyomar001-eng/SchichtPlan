/**
 * Monitoring helpers for SLA measurement.
 * Integrates with BetterStack Uptime API for programmatic incident management.
 *
 * @see https://betterstack.com/docs/uptime/api/
 */

import { log } from "@/lib/logger";

const BETTERSTACK_API_KEY = process.env.BETTERSTACK_API_KEY;
const BETTERSTACK_BASE = "https://uptime.betterstack.com/api/v2";

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${BETTERSTACK_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ─── Incidents ────────────────────────────────────────────────

/** Report an incident to the BetterStack status page. */
export async function reportIncident(
  title: string,
  body: string,
): Promise<string | null> {
  if (!BETTERSTACK_API_KEY) {
    log.warn(
      "[monitoring] BETTERSTACK_API_KEY not set — skipping incident report",
    );
    return null;
  }

  try {
    const res = await fetch(`${BETTERSTACK_BASE}/incidents`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        requester_email: "system@shiftfy.de",
        name: title,
        summary: body,
        description: body,
        call: false,
        sms: false,
        email: true,
        push: true,
      }),
    });

    if (!res.ok) {
      log.error("[monitoring] Failed to report incident", {
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }

    const data = (await res.json()) as { data?: { id?: string } };
    const incidentId = data?.data?.id ?? null;
    log.info("[monitoring] Incident reported", { incidentId, title });
    return incidentId;
  } catch (error) {
    log.error("[monitoring] reportIncident error", { error });
    return null;
  }
}

/** Resolve an existing incident by ID. */
export async function resolveIncident(incidentId: string): Promise<boolean> {
  if (!BETTERSTACK_API_KEY) {
    log.warn(
      "[monitoring] BETTERSTACK_API_KEY not set — skipping incident resolve",
    );
    return false;
  }

  try {
    const res = await fetch(
      `${BETTERSTACK_BASE}/incidents/${incidentId}/resolve`,
      {
        method: "POST",
        headers: headers(),
      },
    );

    if (!res.ok) {
      log.error("[monitoring] Failed to resolve incident", {
        incidentId,
        status: res.status,
      });
      return false;
    }

    log.info("[monitoring] Incident resolved", { incidentId });
    return true;
  } catch (error) {
    log.error("[monitoring] resolveIncident error", { error });
    return false;
  }
}

// ─── Maintenance Windows ──────────────────────────────────────

/** Create a maintenance window on the status page. */
export async function createMaintenanceWindow(
  startsAt: Date,
  endsAt: Date,
  title: string,
): Promise<string | null> {
  if (!BETTERSTACK_API_KEY) {
    log.warn(
      "[monitoring] BETTERSTACK_API_KEY not set — skipping maintenance window",
    );
    return null;
  }

  try {
    const res = await fetch(`${BETTERSTACK_BASE}/maintenances`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        title,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        strategy: "manual",
      }),
    });

    if (!res.ok) {
      log.error("[monitoring] Failed to create maintenance window", {
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }

    const data = (await res.json()) as { data?: { id?: string } };
    const maintenanceId = data?.data?.id ?? null;
    log.info("[monitoring] Maintenance window created", {
      maintenanceId,
      title,
      startsAt,
      endsAt,
    });
    return maintenanceId;
  } catch (error) {
    log.error("[monitoring] createMaintenanceWindow error", { error });
    return null;
  }
}

// ─── Health Check ─────────────────────────────────────────────

/** Quick health probe data for the /api/health endpoint. */
export function buildHealthPayload(): {
  status: string;
  timestamp: string;
  uptime: number;
} {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}
