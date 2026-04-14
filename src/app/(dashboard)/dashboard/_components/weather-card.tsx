"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPinIcon } from "@/components/icons";

/* ── Types ── */
export interface WeatherLocation {
  id: string;
  name: string;
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
  wind: number;
}

interface WeatherCardProps {
  /** Whether the workspace has any locations at all */
  hasLocations: boolean;
  title: string;
  humidityLabel: string;
  windLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  errorLabel?: string;
  errorHint?: string;
}

export function WeatherCard({
  hasLocations,
  title,
  humidityLabel: _humidityLabel,
  windLabel: _windLabel,
  emptyLabel,
  loadingLabel,
  errorLabel,
  errorHint,
}: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherLocation[]>([]);
  const [loading, setLoading] = useState(hasLocations);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hasLocations) return;

    let cancelled = false;

    async function fetchWeather() {
      try {
        const res = await fetch("/api/weather");
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = await res.json();
        const data: WeatherLocation[] = json.data ?? [];
        if (!cancelled) {
          if (data.length === 0) {
            setError(true);
          } else {
            setWeather(data);
          }
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWeather();
    return () => {
      cancelled = true;
    };
  }, [hasLocations]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasLocations ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 mb-3">
              <MapPinIcon className="h-6 w-6 text-emerald-300 dark:text-emerald-700" />
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
                <span className="text-2xl flex-shrink-0">{loc.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                    {loc.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    {loc.condition}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                    {loc.temp}°C
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-500">
                    <span>💧 {loc.humidity}%</span>
                    <span>💨 {loc.wind} km/h</span>
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
