import { withRoute } from "@/lib/with-route";
import { requireAuth, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { resolveAndPersistLocationGeo } from "@/lib/geocode";
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
const FETCH_TIMEOUT = 5000; // 5s per external request

/* ── Geocoding ─────────────────────────────────────────────
   Delegated to @/lib/geocode, which also PERSISTS the resolved coordinates
   onto the Location row. They used to live only in Redis and expire after 7
   days; the geofence needs a durable reference point, so resolving here now
   backfills the database as a side effect. ── */

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
    where: { workspaceId, deletedAt: null },
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
    locations.map((loc) => resolveAndPersistLocationGeo(loc.id)),
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
