import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { requireAuth, badRequest, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   GET /api/weather
   Returns weather data for all workspace locations.
   Geocodes addresses via Nominatim (server-side, no CORS issues)
   and fetches current weather from Open-Meteo.
   Results are cached for 30 minutes per workspace.
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

/** Geocode via Nominatim (server-side — no browser restrictions) */
async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Shiftfy-SaaS/1.0 (schichtplan@example.com)",
      },
      signal: AbortSignal.timeout(5000),
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

/** Geocode with fallback strategies */
async function geocodeWithFallbacks(
  address: string | null,
  name: string,
): Promise<GeoResult | null> {
  // Strategy 1: Try the address if available
  if (address) {
    const geo = await geocode(address);
    if (geo) return geo;

    // Small delay to respect Nominatim rate limit (1 req/sec)
    await new Promise((r) => setTimeout(r, 1100));

    // Strategy 2: Address + ", Deutschland"
    const geo2 = await geocode(address + ", Deutschland");
    if (geo2) return geo2;

    await new Promise((r) => setTimeout(r, 1100));
  }

  // Strategy 3: Just the location name
  const geo3 = await geocode(name);
  if (geo3) return geo3;

  await new Promise((r) => setTimeout(r, 1100));

  // Strategy 4: Name + ", Deutschland"
  const geo4 = await geocode(name + ", Deutschland");
  return geo4;
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

  // Fetch locations
  const locations = await prisma.location.findMany({
    where: { workspaceId },
    select: { id: true, name: true, address: true },
    orderBy: { name: "asc" },
  });

  if (locations.length === 0) {
    return apiSuccess([]);
  }

  const results: WeatherResult[] = [];

  for (const loc of locations) {
    try {
      const geo = await geocodeWithFallbacks(loc.address, loc.name);
      if (!geo) {
        log.info("Weather: could not geocode location", {
          locationId: loc.id,
          name: loc.name,
          address: loc.address,
        });
        continue;
      }

      // Fetch weather from Open-Meteo
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (!wxRes.ok) {
        log.warn("Open-Meteo returned non-OK", {
          status: wxRes.status,
          locationId: loc.id,
        });
        continue;
      }

      const wxData = await wxRes.json();
      const current = wxData.current;
      if (!current) continue;

      const { condition, icon } = wmoToCondition(current.weather_code ?? 0);

      results.push({
        id: loc.id,
        name: loc.name,
        temp: Math.round(current.temperature_2m ?? 0),
        condition,
        icon,
        humidity: current.relative_humidity_2m ?? 0,
        wind: Math.round(current.wind_speed_10m ?? 0),
      });
    } catch (err) {
      log.warn("Weather fetch failed for location", {
        locationId: loc.id,
        error: String(err),
      });
    }
  }

  // Cache results for 30 minutes
  await cache.set(cacheKey, results, CACHE_TTL);

  return apiSuccess(results);
});
