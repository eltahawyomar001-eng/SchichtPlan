"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkGeofence } from "@/lib/geofence";

// ─── Types ──────────────────────────────────────────────────────

export type GpsStatus =
  | "idle"
  | "acquiring"
  | "verified"
  | "out-of-range"
  | "error";

interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

interface UseServiceGpsOptions {
  /** Geofence centre latitude */
  fenceLat: number | null;
  /** Geofence centre longitude */
  fenceLng: number | null;
  /** Radius in metres (default 200) */
  fenceRadius?: number;
  /** Whether tracking is active */
  enabled?: boolean;
}

interface UseServiceGpsReturn {
  /** Current device position */
  position: GpsPosition | null;
  /** GPS acquisition status */
  status: GpsStatus;
  /** Whether device is within the geofence */
  isWithinGeofence: boolean;
  /** Distance to the geofence centre in metres */
  distanceMetres: number | null;
  /** Human-readable error message */
  errorMessage: string | null;
  /** Manually re-acquire position */
  refresh: () => void;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useServiceGps({
  fenceLat,
  fenceLng,
  fenceRadius = 200,
  enabled = true,
}: UseServiceGpsOptions): UseServiceGpsReturn {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [distanceMetres, setDistanceMetres] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const updateGeofence = useCallback(
    (lat: number, lng: number) => {
      if (fenceLat == null || fenceLng == null) {
        // No fence configured — treat as verified (allow all)
        setIsWithinGeofence(true);
        setDistanceMetres(null);
        setStatus("verified");
        return;
      }

      const result = checkGeofence(lat, lng, fenceLat, fenceLng, fenceRadius);
      setIsWithinGeofence(result.withinFence);
      setDistanceMetres(result.distanceMetres);
      setStatus(result.withinFence ? "verified" : "out-of-range");
    },
    [fenceLat, fenceLng, fenceRadius],
  );

  const startWatching = useCallback(() => {
    if (
      !enabled ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setStatus("error");
      setErrorMessage("GPS nicht verfügbar");
      return;
    }

    // Clear previous watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setStatus("acquiring");
    setErrorMessage(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: GpsPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setPosition(newPos);
        updateGeofence(newPos.lat, newPos.lng);
      },
      (err) => {
        setStatus("error");
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setErrorMessage(
              "GPS-Zugriff verweigert. Bitte Berechtigung erteilen.",
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setErrorMessage("GPS-Position nicht verfügbar");
            break;
          case err.TIMEOUT:
            setErrorMessage("GPS-Zeitüberschreitung");
            break;
          default:
            setErrorMessage("GPS-Fehler");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    );
  }, [enabled, updateGeofence]);

  // Start / stop watching based on enabled
  useEffect(() => {
    if (enabled) {
      startWatching();
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setStatus("idle");
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, startWatching]);

  const refresh = useCallback(() => {
    startWatching();
  }, [startWatching]);

  return {
    position,
    status,
    isWithinGeofence,
    distanceMetres,
    errorMessage,
    refresh,
  };
}
