import { withRoute } from "@/lib/with-route";
import { requireAuth, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   GET /api/weather
   Returns weather data for all workspace locations.
   Geocodes addresses via Nominatim (server-side, no CORS issues)
   and fetches current weather from Open-Meteo.
   Results are cached for 30 minutes per workspace.

   Performance: locations are processed concurrently in batches of 3
   to avoid Vercel function timeouts while still respecting
   Nominatim's 1 req/sec fair-use policy.
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

const CACHE_TTL = 1800; // 30 minutes
const GEOCODE_TIMEOUT = 4000; // 4s per request
const WEATHER_TIMEOUT = 4000; // 4s per request
const NOMINATIM_DELAY = 1100; // 1.1s between Nominatim requests (fair-use)

/** Global Nominatim request queue — serialized to respect 1 req/sec */
let lastNominatimRequest = 0;

async function throttledGeocode(query: string): Promise<GeoResult | null> {
  // Ensure at least NOMINATIM_DELAY between consecutive Nominatim requests
  const now = Date.now();
  const elapsed = now - lastNominatimRequest;
  if (elapsed < NOMINATIM_DELAY) {
    await new Promise((r) => setTimeout(r, NOMINATIM_DELAY - elapsed));
  }
  lastNominatimRequest = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Shiftfy-SaaS/1.0 (schichtplan@example.com)",
      },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT),
    });
    if (!res.ok) {
      log.warn("Nominatim returned non-OK status", {
        status: res.status,
        query,
      });
      return null;
    }
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (err) {
    log.warn("Nominatim geocode failed", { query, error: String(err) });
    return null;
  }
}

/** Geocode with max 2 fallback strategies (down from 4 to save time) */
async function geocodeWithFallbacks(
  address: string | null,
  name: string,
): Promise<GeoResult | null> {
  // Strategy 1: address (most specific)
  if (address) {
    const geo = await throttledGeocode(address);
    if (geo) return geo;
  }

  // Strategy 2: location name + Deutschland
  const geo2 = await throttledGeocode(`${name}, Deutschland`);
  return geo2;
}

/** WMO weather code → condition string + emoji */
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

/** Fetch weather for a single already-geocoded location */
async function fetchWeatherForCoords(
  loc: { id: string; name: string },
  geo: GeoResult,
): Promise<WeatherResult | null> {
  try {
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
      { signal: AbortSignal.timeout(WEATHER_TIMEOUT) },
    );
    if (!wxRes.ok) {
      log.warn("Open-Meteo returned non-OK", {
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

export const GET = withRoute("/api/weather", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  // Check cache first
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

  // Phase 1: Geocode all locations sequentially (Nominatim rate limit)
  const geoResults: (GeoResult | null)[] = [];
  for (const loc of locations) {
    const geo = await geocodeWithFallbacks(loc.address, loc.name);
    geoResults.push(geo);
    if (!geo) {
      log.info("Weather: could not geocode location", {
        locationId: loc.id,
        name: loc.name,
        address: loc.address,
      });
    }
  }

  // Phase 2: Fetch weather for all geocoded locations IN PARALLEL
  const weatherPromises = locations.map((loc, i) => {
    const geo = geoResults[i];
    if (!geo) return Promise.resolve(null);
    return fetchWeatherForCoords(loc, geo);
  });

  const weatherResults = await Promise.all(weatherPromises);
  const results = weatherResults.filter(Boolean) as WeatherResult[];

  // Cache results for 30 minutes (even empty — avoids re-trying failed geocodes)
  await cache.set(cacheKey, results, CACHE_TTL);

  return apiSuccess(results);
});
