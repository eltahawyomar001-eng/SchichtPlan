/**
 * The company logo, fetched for rendering onto an invoice.
 *
 * The logo is uploaded once in Einstellungen and stored on the workspace; this
 * only reads it. The invoice side never asks anyone to upload anything again,
 * which is the whole point of the requirement.
 *
 * Everything here is written so that a logo problem cannot cost somebody their
 * invoice. A missing, slow, oversized or unsupported logo yields null and the
 * document is produced without it. An invoice is a legal record that a customer
 * is waiting for; a decorative image is not worth failing it over.
 */
import { log } from "@/lib/logger";
import { isContentAddressedLogo } from "@/lib/workspace-logo";

/** What jsPDF can actually place. SVG is not among them. */
const RENDERABLE = new Set(["image/png", "image/jpeg"]);

/** Generous for a logo, small enough that a wrong URL cannot stall a request. */
const FETCH_TIMEOUT_MS = 4000;
const MAX_BYTES = 2 * 1024 * 1024;

export interface InvoiceLogo {
  /** Base64 payload, as jsPDF's addImage expects. */
  data: string;
  /** "PNG" or "JPEG", the format names jsPDF understands. */
  format: "PNG" | "JPEG";
}

/**
 * Fetch and encode the logo, or return null for any reason at all.
 *
 * The upload accepts SVG, which jsPDF cannot draw. Rather than reject those at
 * upload time -- the logo is used elsewhere in the product, where SVG is the
 * better format -- an unsupported type is simply skipped here.
 */
export async function loadInvoiceLogo(
  url: string | null | undefined,
): Promise<InvoiceLogo | null> {
  if (!url) return null;

  try {
    /**
     * Cache hard, but only when the URL names the bytes it returns.
     *
     * A content-addressed logo URL can be cached forever: different bytes get a
     * different URL, so the cache is never asked a question whose answer has
     * changed. A legacy fixed-path URL (`.../logo.png`) is the opposite -- it
     * keeps its name when the image behind it is replaced -- and caching that
     * for an hour is exactly how a company ended up emailing invoices with its
     * previous logo while the app showed the new one. Those are re-fetched
     * every time: one request is worth less than a wrong logo on an invoice,
     * and they stop existing as soon as the logo is next changed.
     */
    const immutable = isContentAddressedLogo(url);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: immutable ? "force-cache" : "no-store",
    });
    if (!res.ok) {
      log.warn("[invoice-logo] fetch failed", { status: res.status });
      return null;
    }

    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!RENDERABLE.has(contentType)) {
      // Not an error: an SVG logo is perfectly valid, just not placeable here.
      log.info("[invoice-logo] unsupported type for PDF", { contentType });
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      log.warn("[invoice-logo] implausible size", { bytes: buf.byteLength });
      return null;
    }

    return {
      data: buf.toString("base64"),
      format: contentType === "image/png" ? "PNG" : "JPEG",
    };
  } catch (err) {
    // Timeouts, DNS, a storage outage. None of them may block an invoice.
    log.warn("[invoice-logo] unavailable", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
