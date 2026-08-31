/**
 * Server-authoritative geofencing for the punch clock.
 *
 * The device supplies a position; the SERVER decides. A client-reported
 * distance or in/out verdict is never trusted, because the whole point of the
 * control is that the person being measured cannot influence the measurement.
 * Everything here recomputes from raw coordinates.
 *
 * No geo dependency: a haversine over a spherical earth is accurate to well
 * under a metre at the radii we care about (tens of metres), which is far
 * inside consumer GPS error. A library would add supply-chain surface for
 * nothing.
 */

/** Mirrors the Prisma GeofenceStatus enum. */
export type GeofenceStatus =
  | "INSIDE"
  | "OUTSIDE"
  | "OVERRIDDEN"
  | "UNAVAILABLE";

/** Mean earth radius (IUGG), metres. */
const EARTH_RADIUS_M = 6_371_008.8;

/**
 * Reject a fix whose own reported accuracy is coarser than this.
 *
 * A fix with a 500 m error radius cannot prove presence inside a 50 m circle
 * even when its centre lands on the object: accepting it would mean the
 * geofence attests to something it did not measure.
 */
export const MAX_ACCEPTABLE_ACCURACY_M = 100;

/** Fallback radius when a Location has none set. Matches the schema default. */
export const DEFAULT_GEOFENCE_RADIUS_M = 50;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two WGS84 points, in metres.
 *
 * Uses the haversine form, which stays numerically stable at small distances
 * where the spherical law of cosines loses precision.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Coordinates are only meaningful inside the real WGS84 domain. */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    // (0,0) is in the Gulf of Guinea and is overwhelmingly a null-island
    // sentinel from a failed fix rather than a real position.
    !(lat === 0 && lon === 0)
  );
}

export interface GeofenceTarget {
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number | null;
  geofenceEnforced: boolean;
}

export interface GeofenceFix {
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  mocked?: boolean | null;
}

export interface GeofenceDecision {
  status: GeofenceStatus;
  /** Null when no distance could be computed. */
  distanceM: number | null;
  radiusM: number;
  /** True when the punch must be refused. */
  blocked: boolean;
  /** Machine code for the client; null when not blocked. */
  code:
    | "GEOFENCE_OUT_OF_RANGE"
    | "GEOFENCE_NO_FIX"
    | "GEOFENCE_ACCURACY_TOO_LOW"
    | "GEOFENCE_MOCKED_LOCATION"
    | null;
  message?: string;
  messageEn?: string;
}

/**
 * Decide whether a punch at `fix` is acceptable for `target`.
 *
 * When the object does not enforce a geofence the punch always proceeds, but
 * the distance is still computed and returned so the audit trail records where
 * the punch happened. Evidence is collected even where enforcement is off.
 */
export function evaluateGeofence(
  target: GeofenceTarget | null,
  fix: GeofenceFix,
): GeofenceDecision {
  const radiusM = target?.geofenceRadiusMeters ?? DEFAULT_GEOFENCE_RADIUS_M;
  const enforced = target?.geofenceEnforced === true;

  const hasTarget =
    !!target && isValidCoordinate(target.latitude, target.longitude);
  const hasFix = isValidCoordinate(fix.latitude, fix.longitude);

  // A spoofed fix is refused before anything else: if the position is
  // fabricated, every downstream number is meaningless. Android reports this;
  // iOS does not, so a false value here is not proof of authenticity.
  if (fix.mocked === true) {
    return {
      status: "OUTSIDE",
      distanceM: null,
      radiusM,
      blocked: enforced,
      code: enforced ? "GEOFENCE_MOCKED_LOCATION" : null,
      message:
        "Der Standort wurde als simuliert erkannt. Die Stempelung wurde abgelehnt.",
      messageEn: "The location was reported as mocked. The punch was refused.",
    };
  }

  // No usable position, or no coordinates on the object to compare against.
  if (!hasFix || !hasTarget) {
    return {
      status: "UNAVAILABLE",
      distanceM: null,
      radiusM,
      blocked: enforced && !hasFix,
      code: enforced && !hasFix ? "GEOFENCE_NO_FIX" : null,
      message:
        "Kein GPS-Signal verfügbar. Bitte nutzen Sie die QR-Station am Objekt.",
      messageEn:
        "No GPS signal available. Please use the QR station at the object.",
    };
  }

  const distanceM =
    Math.round(
      haversineDistanceMeters(
        fix.latitude as number,
        fix.longitude as number,
        target!.latitude as number,
        target!.longitude as number,
      ) * 10,
    ) / 10;

  // An imprecise fix cannot establish presence. Checked after the distance so
  // the measured value is still recorded for the audit trail.
  const accuracy = fix.accuracyM;
  if (
    typeof accuracy === "number" &&
    Number.isFinite(accuracy) &&
    accuracy > MAX_ACCEPTABLE_ACCURACY_M
  ) {
    return {
      status: "UNAVAILABLE",
      distanceM,
      radiusM,
      blocked: enforced,
      code: enforced ? "GEOFENCE_ACCURACY_TOO_LOW" : null,
      message:
        `Die Standortgenauigkeit ist mit ±${Math.round(accuracy)} m zu ungenau ` +
        `(erforderlich: ±${MAX_ACCEPTABLE_ACCURACY_M} m). Bitte nutzen Sie die QR-Station.`,
      messageEn:
        `Location accuracy of ±${Math.round(accuracy)} m is too coarse ` +
        `(required: ±${MAX_ACCEPTABLE_ACCURACY_M} m). Please use the QR station.`,
    };
  }

  if (distanceM > radiusM) {
    return {
      status: "OUTSIDE",
      distanceM,
      radiusM,
      blocked: enforced,
      code: enforced ? "GEOFENCE_OUT_OF_RANGE" : null,
      message:
        `Sie befinden sich ${Math.round(distanceM)} m vom Objekt entfernt ` +
        `(zulässig: ${radiusM} m). Die Stempelung ist nur vor Ort möglich.`,
      messageEn:
        `You are ${Math.round(distanceM)} m from the object ` +
        `(permitted: ${radiusM} m). Punching in is only possible on site.`,
    };
  }

  return {
    status: "INSIDE",
    distanceM,
    radiusM,
    blocked: false,
    code: null,
  };
}
