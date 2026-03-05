import { log } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════
   Static Map Image Fetcher
   ═══════════════════════════════════════════════════════════════
   Fetches a static map image (PNG) for given GPS coordinates
   using OpenStreetMap-based tile service (no API key required)
   with a Mapbox fallback when MAPBOX_ACCESS_TOKEN is set.
   ═══════════════════════════════════════════════════════════════ */

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? "";

/**
 * Fetch a static map image as a base64-encoded data URI.
 * Returns null if the fetch fails (non-critical for PDF generation).
 *
 * @param lat  Latitude
 * @param lng  Longitude
 * @param zoom Map zoom level (default: 15)
 * @param w    Image width in pixels (default: 300)
 * @param h    Image height in pixels (default: 150)
 */
export async function fetchStaticMapImage(
  lat: number,
  lng: number,
  zoom = 15,
  w = 300,
  h = 150,
): Promise<string | null> {
  try {
    let url: string;

    if (MAPBOX_TOKEN) {
      // Mapbox Static Images API — high quality
      const pin = `pin-l+059669(${lng},${lat})`;
      url =
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
        `${pin}/${lng},${lat},${zoom},0/${w}x${h}@2x` +
        `?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`;
    } else {
      // Free OSM-based static map (staticmap.openstreetmap.de)
      url =
        `https://staticmap.openstreetmap.de/staticmap.php` +
        `?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}` +
        `&markers=${lat},${lng},red-pushpin`;
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      log.warn("[static-map] Failed to fetch map image", {
        status: res.status,
        lat,
        lng,
      });
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    log.warn("[static-map] Map image fetch failed (non-critical)", { error });
    return null;
  }
}
