/**
 * One-shot backfill: resolve coordinates for every Location that has none.
 *
 * Run with: npx tsx scripts/backfill-location-geo.ts
 *           npx tsx scripts/backfill-location-geo.ts --dry-run
 *
 * Geocoding was only ever triggered by the manual "Resolve coordinates" button
 * or as a side effect of the weather widget, so objects created through
 * onboarding or the locations page were left without a reference point. The
 * geofence cannot judge anything without one: punches and proof photos at those
 * objects are all recorded as unverifiable, and nothing surfaces why.
 *
 * Creating and editing a location now geocode inline, and a nightly sweep
 * catches what those miss. This clears the rows that predate both.
 *
 * Safe to run repeatedly: rows that already carry coordinates are skipped, and
 * a manually corrected pin is never overwritten.
 *
 * Self-contained: Prisma + fetch directly, no @/ alias dependencies.
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Load .env.local first, then .env, mirroring Next.js precedence.
config({ path: ".env.local" });
config({ path: ".env" });

const DRY_RUN = process.argv.includes("--dry-run");
const FETCH_TIMEOUT = 5000;

/** Nominatim's usage policy is 1 req/s per application. Pace the whole loop. */
const PACE_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GeoResult {
  lat: number;
  lon: number;
}

function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    // 0,0 is in the Gulf of Guinea and is what a failed parse looks like.
    !(lat === 0 && lon === 0)
  );
}

async function geocodeOpenMeteo(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (isValidCoordinate(hit?.latitude, hit?.longitude)) {
      return { lat: hit.latitude, lon: hit.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

async function geocodeNominatim(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=de`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": "Shiftfy/1.0 (https://www.shiftfy.de)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const lat = hit ? Number(hit.lat) : NaN;
    const lon = hit ? Number(hit.lon) : NaN;
    if (isValidCoordinate(lat, lon)) return { lat, lon };
    return null;
  } catch {
    return null;
  }
}

/**
 * Address ONLY. The name is never used as a query.
 *
 * Open-Meteo's endpoint is a place-name search and answers confidently for any
 * toponym on earth: a real object here called "Mutlu" resolved to a town in
 * Turkey, and names that are genuine German cities resolve to the city centre,
 * kilometres from the actual workplace. Either point, written to the row, makes
 * the geofence report honest work as OUTSIDE — a false accusation kept as
 * evidence for years. No coordinates at all is the safe answer: it records
 * "cannot be checked", which is true.
 */
async function geocodeAddress(
  address: string | null,
  name: string,
): Promise<{ geo: GeoResult; via: string } | null> {
  void name;
  const queries = [address].filter(
    (q): q is string => !!q && q.trim().length > 0,
  );
  if (queries.length === 0) return null;
  for (const q of queries) {
    const geo = await geocodeOpenMeteo(q);
    if (geo) return { geo, via: `open-meteo "${q}"` };
  }
  for (const q of queries) {
    const geo = await geocodeNominatim(q);
    if (geo) return { geo, via: `nominatim "${q}"` };
  }
  return null;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const pending = await prisma.location.findMany({
    where: { deletedAt: null, OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, name: true, address: true, workspaceId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `${pending.length} location(s) without coordinates${DRY_RUN ? " (dry run)" : ""}\n`,
  );

  let resolved = 0;
  const noAddress: string[] = [];
  const failures: { name: string; address: string | null }[] = [];

  for (const loc of pending) {
    if (!loc.address || !loc.address.trim()) {
      // Not a failure to report as one: there was nothing to geocode. The fix
      // is a human typing the address, not a better provider.
      noAddress.push(loc.name);
      console.log(`  NO ADDRESS  ${loc.name}`);
      continue;
    }

    const hit = await geocodeAddress(loc.address, loc.name);
    if (!hit) {
      failures.push({ name: loc.name, address: loc.address });
      console.log(`  UNRESOLVED  ${loc.name} — address: ${loc.address}`);
      await sleep(PACE_MS);
      continue;
    }

    if (!DRY_RUN) {
      await prisma.location.update({
        where: { id: loc.id },
        data: {
          latitude: hit.geo.lat,
          longitude: hit.geo.lon,
          geocodedAt: new Date(),
        },
      });
    }
    resolved += 1;
    console.log(
      `  OK          ${loc.name} → ${hit.geo.lat.toFixed(5)}, ${hit.geo.lon.toFixed(5)}  [${hit.via}]`,
    );
    await sleep(PACE_MS);
  }

  console.log(
    `\nresolved ${resolved}, no address ${noAddress.length}, unresolved ${failures.length}${DRY_RUN ? " (nothing written)" : ""}`,
  );

  if (noAddress.length) {
    console.log(
      "\nNo address on file — add one in Standorte, then re-run or wait for the nightly sweep:",
    );
    for (const n of noAddress) console.log(`  - ${n}`);
  }

  if (failures.length) {
    // An address a geocoder cannot place is usually a typo, a site name typed
    // into the address field, or a rural object that needs its pin dragged by
    // hand. Naming them beats leaving them in the backlog.
    console.log(
      "\nAddress could not be placed — check it for typos or set the pin by hand:",
    );
    for (const f of failures) {
      console.log(`  - ${f.name}  (address: ${f.address})`);
    }
  }

  /**
   * Audit, not a repair.
   *
   * Rows geocoded before this script existed could have had their coordinates
   * derived from the NAME, which puts the point at a city centre or, for a name
   * that is not a place at all, in another country. Those are reported rather
   * than cleared: geocodedAt is stamped by a manual correction too, so there is
   * no way from here to tell a bad automatic guess from a pin a manager placed
   * deliberately, and silently wiping the latter would be worse than leaving
   * the former. The decision needs a human who knows the sites.
   */
  const suspect = await prisma.location.findMany({
    where: {
      deletedAt: null,
      address: null,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      name: true,
      latitude: true,
      longitude: true,
      geofenceEnforced: true,
    },
    orderBy: { name: "asc" },
  });

  if (suspect.length) {
    console.log(
      `\n${suspect.length} location(s) have coordinates but NO address. If these were`,
    );
    console.log(
      "resolved from the name they point at a city centre and will mark honest",
    );
    console.log("work as outside. Verify each pin in Standorte:");
    for (const sLoc of suspect) {
      const enforced = sLoc.geofenceEnforced ? "  [GEOFENCE ENFORCED]" : "";
      console.log(
        `  - ${sLoc.name}  →  ${sLoc.latitude?.toFixed(5)}, ${sLoc.longitude?.toFixed(5)}${enforced}`,
      );
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
