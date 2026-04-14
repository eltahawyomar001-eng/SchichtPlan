"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPinIcon } from "@/components/icons";

/* ── Types ── */
export interface WeatherLocation {
  id: string;
  name: string;
  geocodeQuery?: string; // address or name for geocoding
  temp?: number;
  condition?: string;
  icon?: string; // emoji
  humidity?: number;
  wind?: number;
}

interface WeatherCardProps {
  locations: WeatherLocation[];
  title: string;
  humidityLabel: string;
  windLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  errorLabel?: string;
  errorHint?: string;
}

/* Simple weather condition → emoji mapping */
function conditionEmoji(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("klar") || c.includes("sonnig")) return "☀️";
  if (c.includes("teilweise") || c.includes("wolkig")) return "⛅";
  if (c.includes("bedeckt")) return "☁️";
  if (c.includes("regen") || c.includes("niesel")) return "🌧️";
  if (c.includes("gewitter")) return "⛈️";
  if (c.includes("schnee")) return "🌨️";
  if (c.includes("nebel") || c.includes("dunst")) return "🌫️";
  if (c.includes("wind")) return "💨";
  return "🌤️";
}

export function WeatherCard({
  locations,
  title,
  humidityLabel: _humidityLabel,
  windLabel: _windLabel,
  emptyLabel,
  loadingLabel,
  errorLabel,
  errorHint,
}: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherLocation[]>(locations);
  const [loading, setLoading] = useState(
    locations.length > 0 && locations.every((l) => l.temp === undefined),
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    const locationsNeedingData = weather.filter((l) => l.temp === undefined);
    if (locationsNeedingData.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchWeather() {
      try {
        const updated: WeatherLocation[] = [];
        for (let i = 0; i < weather.length; i++) {
          const loc = weather[i];
          if (loc.temp !== undefined) {
            updated.push(loc);
            continue;
          }
          // Small delay between Nominatim requests (rate limit: 1 req/s)
          if (i > 0) await new Promise((r) => setTimeout(r, 300));
          try {
            const query = loc.geocodeQuery || loc.name;
            let latitude: number | null = null;
            let longitude: number | null = null;

            // Helper: geocode via Nominatim with country hint
            const nominatim = async (q: string) => {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=de`,
                { headers: { "User-Agent": "Shiftfy/1.0" } },
              );
              const data = await res.json();
              if (data?.[0]) {
                return {
                  lat: parseFloat(data[0].lat),
                  lon: parseFloat(data[0].lon),
                };
              }
              return null;
            };

            // Try 1: full geocodeQuery (address)
            let geo = await nominatim(query);

            // Try 2: append ", Deutschland" if no result
            if (!geo) {
              geo = await nominatim(query + ", Deutschland");
            }

            // Try 3: fallback to just the location display name
            if (!geo && loc.geocodeQuery && loc.geocodeQuery !== loc.name) {
              geo = await nominatim(loc.name);
              if (!geo) {
                geo = await nominatim(loc.name + ", Deutschland");
              }
            }

            if (geo) {
              latitude = geo.lat;
              longitude = geo.lon;
            }

            if (!latitude || !longitude) {
              updated.push(loc);
              continue;
            }

            // Fetch current weather
            const wxRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
            );
            const wxData = await wxRes.json();
            const current = wxData.current;
            if (!current) {
              updated.push(loc);
              continue;
            }

            const wmoDesc = getWmoDescription(current.weather_code ?? 0);
            updated.push({
              ...loc,
              temp: Math.round(current.temperature_2m ?? 0),
              condition: wmoDesc,
              icon: conditionEmoji(wmoDesc),
              humidity: current.relative_humidity_2m,
              wind: Math.round(current.wind_speed_10m ?? 0),
            });
          } catch {
            updated.push(loc);
          }
        }
        if (!cancelled) {
          const hasAnyWeather = updated.some((l) => l.temp !== undefined);
          if (!hasAnyWeather) setError(true);
          setWeather(updated);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeather();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {weather.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 mb-3">
              <MapPinIcon className="h-6 w-6 text-blue-300 dark:text-blue-700" />
            </div>
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              {emptyLabel}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
            <span className="ml-2 text-sm text-gray-400">{loadingLabel}</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="text-3xl mb-2">🌤️</span>
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              {errorLabel ?? "Wetterdaten konnten nicht geladen werden"}
            </p>
            <p className="text-xs text-gray-300 dark:text-zinc-600 mt-1">
              {errorHint ?? "Standort-Adressen prüfen"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {weather.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-zinc-700/50 p-3"
              >
                <span className="text-2xl flex-shrink-0">
                  {loc.icon ?? "🌤️"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                    {loc.name}
                  </p>
                  {loc.condition && (
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                      {loc.condition}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  {loc.temp !== undefined ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                        {loc.temp}°C
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-500">
                        {loc.humidity !== undefined && (
                          <span>💧 {loc.humidity}%</span>
                        )}
                        {loc.wind !== undefined && (
                          <span>💨 {loc.wind} km/h</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-300 dark:text-zinc-600">
                      –
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* WMO Weather Code → German description */
function getWmoDescription(code: number): string {
  const map: Record<number, string> = {
    0: "Klarer Himmel",
    1: "Überwiegend klar",
    2: "Teilweise bewölkt",
    3: "Bedeckt",
    45: "Nebel",
    48: "Reifnebel",
    51: "Leichter Nieselregen",
    53: "Mäßiger Nieselregen",
    55: "Starker Nieselregen",
    56: "Gefrierender Nieselregen",
    57: "Starker gefr. Nieselregen",
    61: "Leichter Regen",
    63: "Mäßiger Regen",
    65: "Starker Regen",
    66: "Gefrierender Regen",
    67: "Starker gefr. Regen",
    71: "Leichter Schneefall",
    73: "Mäßiger Schneefall",
    75: "Starker Schneefall",
    77: "Schneegriesel",
    80: "Leichte Regenschauer",
    81: "Mäßige Regenschauer",
    82: "Starke Regenschauer",
    85: "Leichte Schneeschauer",
    86: "Starke Schneeschauer",
    95: "Gewitter",
    96: "Gewitter mit Hagel",
    99: "Gewitter mit starkem Hagel",
  };
  return map[code] ?? "Unbekannt";
}
