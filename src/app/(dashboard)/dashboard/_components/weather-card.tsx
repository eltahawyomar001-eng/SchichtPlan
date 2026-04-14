"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPinIcon } from "@/components/icons";

/* ── Types ── */
export interface WeatherLocation {
  id: string;
  name: string;
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
}

/* Simple weather condition → emoji mapping */
function conditionEmoji(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("clear") || c.includes("sunny")) return "☀️";
  if (c.includes("partly") || c.includes("cloud")) return "⛅";
  if (c.includes("overcast")) return "☁️";
  if (c.includes("rain") || c.includes("drizzle")) return "🌧️";
  if (c.includes("thunder") || c.includes("storm")) return "⛈️";
  if (c.includes("snow")) return "🌨️";
  if (c.includes("fog") || c.includes("mist")) return "🌫️";
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
}: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherLocation[]>(locations);
  const [loading, setLoading] = useState(
    locations.every((l) => l.temp === undefined),
  );

  useEffect(() => {
    // Fetch weather for locations without data
    const locationsNeedingData = weather.filter((l) => l.temp === undefined);
    if (locationsNeedingData.length === 0) {
      setLoading(false);
      return;
    }

    // Use Open-Meteo free API (no key needed) with geocoding
    async function fetchWeather() {
      try {
        const updated = await Promise.all(
          weather.map(async (loc) => {
            if (loc.temp !== undefined) return loc;
            try {
              // Geocode the location name
              const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc.name)}&count=1&language=de`,
              );
              const geoData = await geoRes.json();
              if (!geoData.results?.[0]) return loc;

              const { latitude, longitude } = geoData.results[0];
              // Fetch current weather
              const wxRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
              );
              const wxData = await wxRes.json();
              const current = wxData.current;
              if (!current) return loc;

              // WMO weather code → description
              const wmoDesc = getWmoDescription(current.weather_code ?? 0);
              return {
                ...loc,
                temp: Math.round(current.temperature_2m ?? 0),
                condition: wmoDesc,
                icon: conditionEmoji(wmoDesc),
                humidity: current.relative_humidity_2m,
                wind: Math.round(current.wind_speed_10m ?? 0),
              };
            } catch {
              return loc;
            }
          }),
        );
        setWeather(updated);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
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
                  {loc.temp !== undefined && (
                    <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                      {loc.temp}°
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-500">
                    {loc.humidity !== undefined && (
                      <span>💧 {loc.humidity}%</span>
                    )}
                    {loc.wind !== undefined && <span>💨 {loc.wind} km/h</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* WMO Weather Code → human description */
function getWmoDescription(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail",
  };
  return map[code] ?? "Unknown";
}
