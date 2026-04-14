import { withRoute } from "@/lib/with-route";
import { requireAuth, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   GET /api/weather
   Returns weather data for all workspace locations.

   Geocoding strategy (fast → slow):
   1. Per-location geocode cache (7 days — coords never change)
   2. Open-Meteo Geocoding API (no rate limit, parallelizable)
   3. Nominatim fallback (1 req/sec, sequential — last resort)

   Weather data cached 30 min per workspace.
   All external fetches have 5s timeouts.
   ═══════════════════════════════════════════════════════════════ */

interface GeoResult {
  lat: number;
  lon: number;
}

interface WeatherResult {
  id: string;
  name: string;
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
  wind: number;
}

const WEATHER_CACHE_TTL = 1800; // 30 min — weather results per workspace
const GEO_CACHE_TTL = 604800; // 7 days — geocode results per location
const FETCH_TIMEOUT = 5000; // 5s per external request

/* ── Geocoding: Open-Meteo (primary) ───────────────────────── */

/**
 * Open-Meteo geocoding — same provider as the weather API.
 * No rate limit, no IP blocking, can be called in parallel.
 * https://open-meteo.com/en/docs/geocoding-api
 */
async function geocodeOpenMeteo(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (hit?.latitude && hit?.longitude) {
      return { lat: hit.latitude, lon: hit.longitude };
    }
    return null;
  } catch (err) {
    log.warn("Open-Meteo geocode failed", { query, error: String(err) });
    return null;
  }
}

/* ── Geocoding: Nominatim (fallback) ──────────────────────── */

async function geocodeNominatim(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Shiftfy-SaaS/1.0 (kontakt@shiftfy.de)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (err) {
    log.warn("Nominatim geocode failed", { query, error: String(err) });
    return null;
  }
}

/* ── Geocode a single location (cached) ───────────────────── */

async function geocodeLocation(
  locationId: string,
  address: string | null,
  name: string,
): Promise<GeoResult | null> {
  // Check per-location geocode cache first
  const geoCacheKey = `geo:${locationId}`;
  const cached = await cache.get<GeoResult>(geoCacheKey);
  if (cached) return cached;

  // Build search terms — most specific first
  const queries: string[] = [];
  if (address) queries.push(address);
  queries.push(name);

  // Try Open-Meteo geocoding (primary — no rate limit)
  for (const q of queries) {
    const geo = await geocodeOpenMeteo(q);
    if (geo) {
      await cache.set(geoCacheKey, geo, GEO_CACHE_TTL);
      return geo;
    }
  }

  // Fallback: Nominatim (may be rate-limited on shared IPs)
  for (const q of queries) {
    const geo = await geocodeNominatim(q);
    if (geo) {
      await cache.set(geoCacheKey, geo, GEO_CACHE_TTL);
      return geo;
    }
  }

  log.info("Weather: could not geocode location", {
    locationId,
    name,
    address,
  });
  return null;
}

/* ── WMO weather code → condition + emoji ─────────────────── */

function wmoToCondition(code: number): { condition: string; icon: string } {
  const map: Record<number, [string, string]> = {
    0: ["Klarer Himmel", "☀️"],
    1: ["Überwiegend klar", "🌤️"],
    2: ["Teilweise bewölkt", "⛅"],
    3: ["Bedeckt", "☁️"],
    45: ["Nebel", "🌫️"],
    48: ["Reifnebel", "🌫️"],
    51: ["Leichter Nieselregen", "🌧️"],
    53: ["Mäßiger Nieselregen", "🌧️"],
    55: ["Starker Nieselregen", "🌧️"],
    56: ["Gefrierender Nieselregen", "🌧️"],
    57: ["Starker gefr. Nieselregen", "🌧️"],
    61: ["Leichter Regen", "🌧️"],
    63: ["Mäßiger Regen", "🌧️"],
    65: ["Starker Regen", "🌧️"],
    66: ["Gefrierender Regen", "🌧️"],
    67: ["Starker gefr. Regen", "🌧️"],
    71: ["Leichter Schneefall", "🌨️"],
    73: ["Mäßiger Schneefall", "🌨️"],
    75: ["Starker Schneefall", "🌨️"],
    77: ["Schneegriesel", "🌨️"],
    80: ["Leichte Regenschauer", "🌧️"],
    81: ["Mäßige Regenschauer", "🌧️"],
    82: ["Starke Regenschauer", "🌧️"],
    85: ["Leichte Schneeschauer", "🌨️"],
    86: ["Starke Schneeschauer", "🌨️"],
    95: ["Gewitter", "⛈️"],
    96: ["Gewitter mit Hagel", "⛈️"],
    99: ["Gewitter mit starkem Hagel", "⛈️"],
  };
  const entry = map[code];
  return entry
    ? { condition: entry[0], icon: entry[1] }
    : { condition: "Unbekannt", icon: "🌤️" };
}

/* ── Fetch weather for one geocoded location ──────────────── */

async function fetchWeatherForCoords(
  loc: { id: string; name: string },
  geo: GeoResult,
): Promise<WeatherResult | null> {
  try {
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT) },
    );
    if (!wxRes.ok) {
      log.warn("Open-Meteo weather returned non-OK", {
        status: wxRes.status,
        locationId: loc.id,
      });
      return null;
    }
    const wxData = await wxRes.json();
    const current = wxData.current;
    if (!current) return null;

    const { condition, icon } = wmoToCondition(current.weather_code ?? 0);
    return {
      id: loc.id,
      name: loc.name,
      temp: Math.round(current.temperature_2m ?? 0),
      condition,
      icon,
      humidity: current.relative_humidity_2m ?? 0,
      wind: Math.round(current.wind_speed_10m ?? 0),
    };
  } catch (err) {
    log.warn("Weather fetch failed for location", {
      locationId: loc.id,
      error: String(err),
    });
    return null;
  }
}

/* ── Route handler ────────────────────────────────────────── */

export const GET = withRoute("/api/weather", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  // Check weather cache first (30 min)
  const cacheKey = `weather:${workspaceId}`;
  const cached = await cache.get<WeatherResult[]>(cacheKey);
  if (cached) {
    return apiSuccess(cached);
  }

  // Fetch locations (cap at 5 to keep response time reasonable)
  const locations = await prisma.location.findMany({
    where: { workspaceId },
    select: { id: true, name: true, address: true },
    orderBy: { name: "asc" },
    take: 5,
  });

  if (locations.length === 0) {
    return apiSuccess([]);
  }

  // Phase 1: Geocode all locations IN PARALLEL
  // (Open-Meteo geocoding has no rate limit; per-location cache avoids repeat calls)
  const geoResults = await Promise.all(
    locations.map((loc) => geocodeLocation(loc.id, loc.address, loc.name)),
  );

  // Phase 2: Fetch weather for all geocoded locations IN PARALLEL
  const weatherResults = await Promise.all(
    locations.map((loc, i) => {
      const geo = geoResults[i];
      if (!geo) return Promise.resolve(null);
      return fetchWeatherForCoords(loc, geo);
    }),
  );

  const results = weatherResults.filter(Boolean) as WeatherResult[];

  // Only cache non-empty results — if all geocodes failed we want to retry
  // next request instead of serving stale empty data for 30 min
  if (results.length > 0) {
    await cache.set(cacheKey, results, WEATHER_CACHE_TTL);
  }

  return apiSuccess(results);
});
