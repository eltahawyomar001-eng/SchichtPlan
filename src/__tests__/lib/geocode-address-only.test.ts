/**
 * @vitest-environment node
 *
 * A geofence reference point may only come from a street address.
 *
 * geocodeAddress used to fall back to the location's NAME when it had no
 * address. Open-Meteo's endpoint is a place-name search, so it answers
 * confidently for any toponym on earth: a real object named "Mutlu" resolved to
 * a town in Turkey, and names that happen to be German cities resolved to the
 * city centre, kilometres from the actual workplace.
 *
 * Either point is worse than none. With no coordinates a punch or proof photo
 * is recorded as "cannot be checked", which is true. With a name-derived point
 * it is recorded as OUTSIDE — evidence, retained for years under ArbZG §16,
 * asserting an employee was not where they said they were.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLocationFindUnique, mockLocationUpdate, mockCacheGet } = vi.hoisted(
  () => ({
    mockLocationFindUnique: vi.fn(),
    mockLocationUpdate: vi.fn(),
    mockCacheGet: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    location: {
      findUnique: mockLocationFindUnique,
      update: mockLocationUpdate,
    },
  },
}));
vi.mock("@/lib/cache", () => ({
  cache: { get: mockCacheGet, set: vi.fn(), del: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Answers any query with a point, so a leaked name query cannot hide. */
function respondWithTurkey() {
  // Typed as the global fetch so mock.calls carries its argument tuple; without
  // it the spy infers a zero-arity signature and the URL cannot be inspected.
  return vi.fn<typeof fetch>(async () =>
    Response.json({ results: [{ latitude: 40.21383, longitude: 40.13935 }] }),
  );
}

describe("geocodeAddress", () => {
  let lib: typeof import("@/lib/geocode");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    lib = await import("@/lib/geocode");
  });

  it("never queries a provider when there is no address", async () => {
    const fetchSpy = respondWithTurkey();
    vi.stubGlobal("fetch", fetchSpy);

    const geo = await lib.geocodeAddress(null, "Mutlu");

    expect(geo).toBeNull();
    // Not merely "returned null" — no request may be made at all, or a future
    // refactor could start trusting whatever came back.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores a blank address rather than treating it as present", async () => {
    const fetchSpy = respondWithTurkey();
    vi.stubGlobal("fetch", fetchSpy);

    expect(await lib.geocodeAddress("   ", "Fulda")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("queries only the address, never the name", async () => {
    const fetchSpy = respondWithTurkey();
    vi.stubGlobal("fetch", fetchSpy);

    await lib.geocodeAddress("Alexanderplatz 1, 10178 Berlin", "Mutlu");

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.some((u) => u.includes("Alexanderplatz"))).toBe(true);
    expect(urls.some((u) => u.includes("Mutlu"))).toBe(false);
  });

  it("still allows the name when a caller explicitly opts in", async () => {
    // The weather widget does: a forecast is a city-scale quantity and tolerates
    // being a few kilometres off. It is the PERSISTED path that must not.
    const fetchSpy = respondWithTurkey();
    vi.stubGlobal("fetch", fetchSpy);

    const geo = await lib.geocodeAddress(null, "Fulda", {
      allowNameFallback: true,
    });

    expect(geo).toEqual({ lat: 40.21383, lon: 40.13935 });
  });
});

describe("resolveAndPersistLocationGeo", () => {
  let lib: typeof import("@/lib/geocode");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    lib = await import("@/lib/geocode");
  });

  it("writes nothing for a location with no address", async () => {
    const fetchSpy = respondWithTurkey();
    vi.stubGlobal("fetch", fetchSpy);
    mockLocationFindUnique.mockResolvedValue({
      id: "l1",
      name: "Mutlu",
      address: null,
      latitude: null,
      longitude: null,
    });

    const geo = await lib.resolveAndPersistLocationGeo("l1");

    expect(geo).toBeNull();
    // The whole point: no coordinates reach the row the geofence reads.
    expect(mockLocationUpdate).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("persists coordinates resolved from a real address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ results: [{ latitude: 52.52, longitude: 13.405 }] }),
      ),
    );
    mockLocationFindUnique.mockResolvedValue({
      id: "l1",
      name: "Objekt Alexanderplatz",
      address: "Alexanderplatz 1, 10178 Berlin",
      latitude: null,
      longitude: null,
    });

    const geo = await lib.resolveAndPersistLocationGeo("l1");

    expect(geo).toEqual({ lat: 52.52, lon: 13.405 });
    expect(mockLocationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "l1" },
        data: expect.objectContaining({ latitude: 52.52, longitude: 13.405 }),
      }),
    );
  });

  it("leaves a hand-placed pin alone", async () => {
    // A manager who corrected the coordinates outranks any geocoder.
    const fetchSpy = respondWithTurkey();
    vi.stubGlobal("fetch", fetchSpy);
    mockLocationFindUnique.mockResolvedValue({
      id: "l1",
      name: "Objekt",
      address: "Alexanderplatz 1, 10178 Berlin",
      latitude: 52.52,
      longitude: 13.405,
    });

    const geo = await lib.resolveAndPersistLocationGeo("l1");

    expect(geo).toEqual({ lat: 52.52, lon: 13.405 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockLocationUpdate).not.toHaveBeenCalled();
  });
});
