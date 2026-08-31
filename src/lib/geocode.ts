/**
 * Address → coordinates, persisted on the Location.
 *
 * This used to live inside the weather route and cached only to Redis, so the
 * coordinates evaporated after 7 days and never reached the database. The
 * geofence needs a durable reference point on the Location itself, so
 * resolution now writes through to Prisma and the cache is only a fast path.
 *
 * Two providers, in order: Open-Meteo (no rate limit, parallelisable) then
 * Nominatim (1 req/s, shared-IP rate limits, last resort).
 */

import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { log } from "@/lib/logger";
import { isValidCoordinate } from "@/lib/geofence";

export interface GeoResult {
  lat: number;
  lon: number;
}

/** 7 days — a street address does not move. */
export const GEO_CACHE_TTL = 604800;
const FETCH_TIMEOUT = 5000;

export async function geocodeOpenMeteo(
  query: string,
): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (isValidCoordinate(hit?.latitude, hit?.longitude)) {
      return { lat: hit.latitude, lon: hit.longitude };
    }
    return null;
  } catch (err) {
    log.warn("Open-Meteo geocode failed", { query, error: String(err) });
    return null;
  }
}

export async function geocodeNominatim(
  query: string,
): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": "Shiftfy/1.0 (https://www.shiftfy.de)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const lat = hit ? Number(hit.lat) : NaN;
    const lon = hit ? Number(hit.lon) : NaN;
    if (isValidCoordinate(lat, lon)) return { lat, lon };
    return null;
  } catch (err) {
    log.warn("Nominatim geocode failed", { query, error: String(err) });
    return null;
  }
}

/** Try both providers against the most specific query first. */
export async function geocodeAddress(
  address: string | null,
  name: string,
): Promise<GeoResult | null> {
  const queries = [address, name].filter(
    (q): q is string => !!q && q.trim().length > 0,
  );

  for (const q of queries) {
    const geo = await geocodeOpenMeteo(q);
    if (geo) return geo;
  }
  for (const q of queries) {
    const geo = await geocodeNominatim(q);
    if (geo) return geo;
  }
  return null;
}

/**
 * Resolve coordinates for a location and PERSIST them.
 *
 * Order of preference:
 *   1. Coordinates already on the row (authoritative — a manager may have
 *      corrected them by hand, and a geocoder must never overwrite that)
 *   2. Redis cache
 *   3. Providers → written back to the row and the cache
 *
 * `force` skips steps 1 and 2 — used by the "Resolve coordinates" button so a
 * manager can re-resolve after fixing a typo in the address.
 */
export async function resolveAndPersistLocationGeo(
  locationId: string,
  opts: { force?: boolean } = {},
): Promise<GeoResult | null> {
  const loc = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!loc) return null;

  if (!opts.force && isValidCoordinate(loc.latitude, loc.longitude)) {
    return { lat: loc.latitude as number, lon: loc.longitude as number };
  }

  const cacheKey = `geo:${locationId}`;
  if (!opts.force) {
    const cached = await cache.get<GeoResult>(cacheKey);
    if (cached && isValidCoordinate(cached.lat, cached.lon)) {
      // Cache hit but the row is empty — backfill it so the geofence has a
      // durable reference point rather than one that expires.
      await persist(locationId, cached);
      return cached;
    }
  }

  const geo = await geocodeAddress(loc.address, loc.name);
  if (!geo) {
    log.info("geocode: could not resolve location", {
      locationId,
      name: loc.name,
      address: loc.address,
    });
    return null;
  }

  await persist(locationId, geo);
  await cache.set(cacheKey, geo, GEO_CACHE_TTL);
  return geo;
}

async function persist(locationId: string, geo: GeoResult): Promise<void> {
  try {
    await prisma.location.update({
      where: { id: locationId },
      data: {
        latitude: geo.lat,
        longitude: geo.lon,
        geocodedAt: new Date(),
      },
    });
  } catch (err) {
    // Never let a persistence failure break the caller (the weather widget
    // still works with in-memory coordinates).
    log.warn("geocode: failed to persist coordinates", {
      locationId,
      error: String(err),
    });
  }
}
