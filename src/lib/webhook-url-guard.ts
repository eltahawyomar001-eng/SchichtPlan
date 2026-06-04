import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * SSRF guard for outbound webhook delivery.
 * ─────────────────────────────────────────
 * Webhook endpoint URLs are attacker-influenced (any workspace OWNER/ADMIN can
 * register one) and the server fetches them on events. Without validation an
 * admin could point a webhook at internal services (cloud metadata, localhost,
 * RFC1918 ranges) and use Shiftfy as an SSRF proxy. This module rejects any URL
 * that targets a private, loopback, link-local, or otherwise reserved address.
 *
 * Used in two places:
 *   - At registration/update (requireHttps: true) — reject early with a clear
 *     message.
 *   - At delivery (re-resolve every time) — defeats DNS-rebinding where a host
 *     resolved to a public IP at registration but flips to a private one later.
 *
 * Residual risk: a tiny TOCTOU window remains between this DNS resolution and
 * fetch()'s own resolution. Closing it fully needs IP-pinned connects; this
 * re-resolve-on-every-delivery check is the proportionate mitigation for an
 * authenticated, blind SSRF (response bodies are never returned to the caller).
 */

export interface UrlGuardResult {
  ok: boolean;
  reason?: string;
}

function ipv4IsPrivateOrReserved(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  ) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 reserved/doc
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

function ipv6IsPrivateOrReserved(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return ipv4IsPrivateOrReserved(mapped[1]); // IPv4-mapped
  const head2 = addr.slice(0, 2);
  if (head2 === "fc" || head2 === "fd") return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
  if (head2 === "ff") return true; // ff00::/8 multicast
  return false;
}

/** True if the literal IP is private, loopback, link-local, or reserved. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4IsPrivateOrReserved(ip);
  if (v === 6) return ipv6IsPrivateOrReserved(ip);
  return true; // not a valid IP → unsafe
}

/**
 * Validate that a webhook URL is safe to fetch.
 * Resolves DNS and rejects if ANY resolved address is private/reserved.
 */
export async function assertPublicWebhookUrl(
  rawUrl: string,
  opts: { requireHttps?: boolean } = {},
): Promise<UrlGuardResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Ungültige URL." };
  }

  if (opts.requireHttps) {
    if (url.protocol !== "https:") {
      return { ok: false, reason: "Webhook-URLs müssen HTTPS verwenden." };
    }
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Nur HTTP(S)-URLs sind erlaubt." };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "URLs mit Zugangsdaten sind nicht erlaubt." };
  }

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return { ok: false, reason: "Interne Hostnamen sind nicht erlaubt." };
  }

  // Literal IP — check directly (no DNS).
  if (isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      return {
        ok: false,
        reason: "Private oder reservierte IP-Adressen sind nicht erlaubt.",
      };
    }
    return { ok: true };
  }

  // Hostname — resolve and reject if ANY address is private/reserved.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "Hostname konnte nicht aufgelöst werden." };
  }
  if (addresses.length === 0) {
    return { ok: false, reason: "Hostname konnte nicht aufgelöst werden." };
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      return {
        ok: false,
        reason: "Der Hostname verweist auf eine interne Adresse.",
      };
    }
  }
  return { ok: true };
}
