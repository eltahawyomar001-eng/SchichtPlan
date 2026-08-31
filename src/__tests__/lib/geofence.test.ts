/**
 * @vitest-environment node
 *
 * Server-authoritative geofence.
 *
 * The distance maths is checked against known real-world separations, and the
 * decision logic is weighted toward the cases where a punch must be REFUSED:
 * a spoofed fix, a fix too coarse to prove anything, and no fix at all.
 */
import { describe, it, expect } from "vitest";
import {
  haversineDistanceMeters,
  isValidCoordinate,
  evaluateGeofence,
  MAX_ACCEPTABLE_ACCURACY_M,
  DEFAULT_GEOFENCE_RADIUS_M,
} from "@/lib/geofence";

// Brandenburger Tor, Berlin.
const OBJECT = { lat: 52.516275, lon: 13.377704 };

const target = (
  over: Partial<Parameters<typeof evaluateGeofence>[0]> = {},
) => ({
  latitude: OBJECT.lat,
  longitude: OBJECT.lon,
  geofenceRadiusMeters: 50,
  geofenceEnforced: true,
  ...over,
});

describe("haversineDistanceMeters", () => {
  it("is zero for identical points", () => {
    expect(
      haversineDistanceMeters(OBJECT.lat, OBJECT.lon, OBJECT.lat, OBJECT.lon),
    ).toBe(0);
  });

  it("matches a known separation (Brandenburger Tor → Reichstag ≈ 280 m)", () => {
    // 0.002348° lat (~261 m) and 0.001506° lon (~102 m at 52.5°N)
    // → sqrt(261² + 102²) ≈ 280 m.
    const d = haversineDistanceMeters(
      OBJECT.lat,
      OBJECT.lon,
      52.518623,
      13.376198,
    );
    expect(d).toBeGreaterThan(270);
    expect(d).toBeLessThan(290);
  });

  it("is symmetric", () => {
    const a = haversineDistanceMeters(52.5, 13.3, 48.1, 11.5);
    const b = haversineDistanceMeters(48.1, 11.5, 52.5, 13.3);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it("resolves ~111 m for 0.001° of latitude", () => {
    const d = haversineDistanceMeters(52.0, 13.0, 52.001, 13.0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("handles the antimeridian without blowing up", () => {
    const d = haversineDistanceMeters(0, 179.999, 0, -179.999);
    expect(d).toBeLessThan(300);
  });
});

describe("isValidCoordinate", () => {
  it("accepts a real position", () => {
    expect(isValidCoordinate(52.5, 13.4)).toBe(true);
  });

  it("rejects null island (failed-fix sentinel)", () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
  });

  it("rejects out-of-domain and non-finite values", () => {
    expect(isValidCoordinate(91, 13)).toBe(false);
    expect(isValidCoordinate(52, 181)).toBe(false);
    expect(isValidCoordinate(NaN, 13)).toBe(false);
    expect(isValidCoordinate(undefined, 13)).toBe(false);
  });
});

describe("evaluateGeofence", () => {
  it("allows a punch inside the radius", () => {
    const r = evaluateGeofence(target(), {
      latitude: OBJECT.lat,
      longitude: OBJECT.lon,
      accuracyM: 8,
    });
    expect(r.status).toBe("INSIDE");
    expect(r.blocked).toBe(false);
    expect(r.distanceM).toBe(0);
  });

  it("BLOCKS a punch outside the radius when enforced", () => {
    const r = evaluateGeofence(target(), {
      latitude: 52.518623, // ~280 m away, well outside the 50 m radius
      longitude: 13.376198,
      accuracyM: 8,
    });
    expect(r.status).toBe("OUTSIDE");
    expect(r.blocked).toBe(true);
    expect(r.code).toBe("GEOFENCE_OUT_OF_RANGE");
  });

  it("BLOCKS a mocked fix", () => {
    const r = evaluateGeofence(target(), {
      latitude: OBJECT.lat,
      longitude: OBJECT.lon,
      accuracyM: 5,
      mocked: true,
    });
    expect(r.blocked).toBe(true);
    expect(r.code).toBe("GEOFENCE_MOCKED_LOCATION");
  });

  it("BLOCKS a fix too coarse to prove presence, even when centred on the object", () => {
    const r = evaluateGeofence(target(), {
      latitude: OBJECT.lat,
      longitude: OBJECT.lon,
      accuracyM: MAX_ACCEPTABLE_ACCURACY_M + 1,
    });
    expect(r.blocked).toBe(true);
    expect(r.code).toBe("GEOFENCE_ACCURACY_TOO_LOW");
    // Distance is still recorded for the audit trail.
    expect(r.distanceM).toBe(0);
  });

  it("BLOCKS when the device supplies no fix at all", () => {
    const r = evaluateGeofence(target(), {});
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.blocked).toBe(true);
    expect(r.code).toBe("GEOFENCE_NO_FIX");
  });

  it("does NOT block when the object has no coordinates yet", () => {
    // Enforcement cannot be meaningful without a reference point; blocking here
    // would lock out every guard the moment a manager flips the flag.
    const r = evaluateGeofence(target({ latitude: null, longitude: null }), {
      latitude: OBJECT.lat,
      longitude: OBJECT.lon,
      accuracyM: 5,
    });
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.blocked).toBe(false);
  });

  it("records distance but never blocks when enforcement is off", () => {
    const r = evaluateGeofence(target({ geofenceEnforced: false }), {
      latitude: 52.518623,
      longitude: 13.376198,
      accuracyM: 5,
    });
    expect(r.status).toBe("OUTSIDE");
    expect(r.blocked).toBe(false);
    expect(r.code).toBeNull();
    expect(r.distanceM).toBeGreaterThan(200);
  });

  it("falls back to the default radius when the object has none", () => {
    const r = evaluateGeofence(target({ geofenceRadiusMeters: null }), {
      latitude: OBJECT.lat,
      longitude: OBJECT.lon,
      accuracyM: 5,
    });
    expect(r.radiusM).toBe(DEFAULT_GEOFENCE_RADIUS_M);
  });

  it("treats the radius as inclusive at the boundary", () => {
    // ~33 m north — comfortably inside a 50 m radius.
    const r = evaluateGeofence(target(), {
      latitude: OBJECT.lat + 0.0003,
      longitude: OBJECT.lon,
      accuracyM: 5,
    });
    expect(r.status).toBe("INSIDE");
    expect(r.distanceM).toBeLessThanOrEqual(50);
  });
});
