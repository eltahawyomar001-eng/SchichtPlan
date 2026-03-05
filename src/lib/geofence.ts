/**
 * Geofencing utilities for Service Visit proof system.
 * Uses the Haversine formula to calculate the distance between
 * two GPS coordinates and determine if a point is within a geofence.
 */

const EARTH_RADIUS_METRES = 6_371_000;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the distance in metres between two lat/lng points
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check whether a GPS point is within the geofence of a location.
 *
 * @param pointLat  - The latitude of the point (e.g. employee device)
 * @param pointLng  - The longitude of the point
 * @param fenceLat  - The latitude of the geofence centre (location)
 * @param fenceLng  - The longitude of the geofence centre
 * @param radiusMetres - The geofence radius in metres (default 200)
 * @returns `{ withinFence, distanceMetres }`
 */
export function checkGeofence(
  pointLat: number,
  pointLng: number,
  fenceLat: number,
  fenceLng: number,
  radiusMetres = 200,
): { withinFence: boolean; distanceMetres: number } {
  const distanceMetres = haversineDistance(
    pointLat,
    pointLng,
    fenceLat,
    fenceLng,
  );
  return {
    withinFence: distanceMetres <= radiusMetres,
    distanceMetres: Math.round(distanceMetres),
  };
}
