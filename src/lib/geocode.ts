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

/**
 * Try both providers against the most specific query first.
 *
 * `allowNameFallback` decides whether a location's NAME may be used as a
 * geocoding query when it has no address, and it defaults to off because doing
 * so is actively dangerous for a geofence.
 *
 * Open-Meteo's endpoint is a place-NAME search, so it answers confidently for
 * anything that looks like a toponym anywhere on earth. A real object called
 * "Mutlu" resolved to a town in Turkey. Even a name that is a genuine German
 * city resolves to the city CENTRE, which against the 50 m default radius is
 * wrong by kilometres for any actual workplace in that city.
 *
 * Both outcomes are worse than having no coordinates at all. With none, a punch
 * or a proof photo is recorded as "cannot be checked", which is honest. With a
 * name-derived point, it is recorded as OUTSIDE — evidence, kept for years
 * under ArbZG §16, that says an employee was not where they said they were. A
 * geofence reference point has to come from a street address or from a person.
 */
export async function geocodeAddress(
  address: string | null,
  name: string,
  opts: { allowNameFallback?: boolean } = {},
): Promise<GeoResult | null> {
  const candidates = opts.allowNameFallback ? [address, name] : [address];
  const queries = candidates.filter(
    (q): q is string => !!q && q.trim().length > 0,
  );
  if (queries.length === 0) return null;

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
 *
 * `budgetMs` bounds the provider phase. Callers on a user's request path use it
 * so a slow or unresponsive provider cannot hold up creating a location: the
 * fast, common case (an Open-Meteo hit) still lands inline, and anything slower
 * falls through to the nightly sweep. Omitted, the providers run to their own
 * per-request timeouts, which is what a background job wants.
 */
export async function resolveAndPersistLocationGeo(
  locationId: string,
  opts: { force?: boolean; budgetMs?: number } = {},
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

  // Strict on purpose: see geocodeAddress. What this function writes becomes
  // the geofence's reference point, so it may only ever come from an address.
  if (!loc.address || !loc.address.trim()) {
    log.info("geocode: location has no address to resolve", {
      locationId,
      name: loc.name,
    });
    return null;
  }

  const work = geocodeAddress(loc.address, loc.name);
  const geo = opts.budgetMs
    ? await withBudget(work, opts.budgetMs)
    : await work;
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

/**
 * Give a lookup a wall-clock ceiling.
 *
 * The losing promise is deliberately not cancelled: if it resolves after the
 * race it still persists the coordinates through geocodeAddress's caller on the
 * next attempt, and an orphaned fetch against a geocoding API costs nothing. A
 * rejection is swallowed for the same reason the providers swallow theirs —
 * failing to geocode is never a reason to fail the operation that asked.
 */
async function withBudget<T>(
  work: Promise<T | null>,
  ms: number,
): Promise<T | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Coordinates good enough for a forecast, for a location that has no address.
 *
 * The weather widget genuinely can work from a place name: a forecast is a
 * city-scale quantity, and being a few kilometres off changes nothing a planner
 * would notice. The geofence cannot, for the reasons in geocodeAddress.
 *
 * So this exists to keep the two apart. It never writes to the Location: a
 * loose, name-derived point must not become the row the geofence later trusts.
 * That coupling is exactly how a wrong reference point would get in — the
 * weather widget resolving an object nobody had geocoded, and quietly
 * persisting a city centre into the field that decides whether an employee gets
 * accused of being off site.
 */
export async function geocodeForWeather(
  address: string | null,
  name: string,
): Promise<GeoResult | null> {
  const cacheKey = `geo:weather:${address ?? ""}|${name}`;
  const cached = await cache.get<GeoResult>(cacheKey);
  if (cached && isValidCoordinate(cached.lat, cached.lon)) return cached;

  const geo = await geocodeAddress(address, name, { allowNameFallback: true });
  if (geo) await cache.set(cacheKey, geo, GEO_CACHE_TTL);
  return geo;
}
