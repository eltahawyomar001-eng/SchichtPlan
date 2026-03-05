import { describe, it, expect } from "vitest";
import { haversineDistance, checkGeofence } from "@/lib/geofence";

describe("haversineDistance", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistance(52.52, 13.405, 52.52, 13.405)).toBe(0);
  });

  it("calculates distance between Berlin and Munich (~504 km)", () => {
    // Berlin: 52.52, 13.405 — Munich: 48.1351, 11.582
    const dist = haversineDistance(52.52, 13.405, 48.1351, 11.582);
    expect(dist).toBeGreaterThan(500_000);
    expect(dist).toBeLessThan(510_000);
  });

  it("calculates short distances accurately (~100m)", () => {
    // Two points ~100m apart in Berlin
    const dist = haversineDistance(52.52, 13.405, 52.5209, 13.405);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(110);
  });
});

describe("checkGeofence", () => {
  const fenceLat = 52.52;
  const fenceLng = 13.405;
  const radius = 200; // 200 metres

  it("returns withinFence: true when point is inside radius", () => {
    // ~50m away
    const result = checkGeofence(52.5204, 13.405, fenceLat, fenceLng, radius);
    expect(result.withinFence).toBe(true);
    expect(result.distanceMetres).toBeLessThan(radius);
  });

  it("returns withinFence: true when point is exactly at center", () => {
    const result = checkGeofence(
      fenceLat,
      fenceLng,
      fenceLat,
      fenceLng,
      radius,
    );
    expect(result.withinFence).toBe(true);
    expect(result.distanceMetres).toBe(0);
  });

  it("returns withinFence: false when point is outside radius", () => {
    // ~1km away
    const result = checkGeofence(52.53, 13.405, fenceLat, fenceLng, radius);
    expect(result.withinFence).toBe(false);
    expect(result.distanceMetres).toBeGreaterThan(radius);
  });

  it("works with small geofence radius", () => {
    // ~500m away — should be outside a 50m fence
    const result = checkGeofence(52.525, 13.405, fenceLat, fenceLng, 50);
    expect(result.withinFence).toBe(false);
    expect(result.distanceMetres).toBeGreaterThan(50);
  });
});
