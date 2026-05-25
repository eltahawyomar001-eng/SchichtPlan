import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/* ──────────────────────────────────────────────────────────────
 * Security headers (DSGVO Art. 32 — appropriate technical measures)
 * ────────────────────────────────────────────────────────────── */
const isDev = process.env.NODE_ENV === "development";

/** Static security headers (CSP is computed per-request for nonce) */
const staticHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), serial=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-API-Version": "1",
};

/** Build CSP header with per-request nonce */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' propagates trust from nonce to dynamically loaded scripts; 'unsafe-inline' removed
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://vercel.live`,
    // Use 'unsafe-inline' only for styles — no nonce, so it is respected by all browsers
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://apps.rokt.com",
    "connect-src 'self' https://*.supabase.co https://*.resend.com https://*.sentry.io https://*.stripe.com https://vercel.live wss://ws-us3.pusher.com https://vitals.vercel-insights.com",
    // Allow Vercel Live toolbar iframe in non-production
    `frame-src 'self' https://vercel.live`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    // NOTE: "require-trusted-types-for 'script'" removed — React/Next.js
    // runtime uses innerHTML internally (hydration, error boundaries) and
    // does not ship Trusted Types policies, causing Chrome to block rendering.
    // Nonce-based script-src already provides strong XSS protection.
  ].join("; ");
}

/** Generate a cryptographic nonce (Edge-compatible) */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Convert to base64 in Edge runtime (no Buffer)
  return btoa(String.fromCharCode(...bytes));
}

/* ──────────────────────────────────────────────────────────────
 * Upstash Redis rate limiter (serverless-safe)
 *
 * Uses @upstash/ratelimit with sliding-window algorithm.
 * Shared across all serverless instances via Redis.
 * Falls back to allowing requests if UPSTASH env vars are missing
 * (dev mode / early staging) — logs a warning instead of blocking.
 *
 * Limits:
 *   – Auth endpoints (login/register): 10 req / 60 s
 *   – API endpoints:                    60 req / 60 s
 * ────────────────────────────────────────────────────────────── */
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "ratelimit:auth",
    })
  : undefined;

const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "60 s"),
      prefix: "ratelimit:api",
    })
  : undefined;

/** Import/upload endpoint — strict limit (5 req / 60s) */
const importLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "ratelimit:import",
    })
  : undefined;

/**
 * Public token/PIN endpoints — very strict limit (5 req / 60s per IP).
 * Covers external ticket tokens, PIN reveal links, QR clock endpoints.
 * Without this, a 6-digit PIN is brute-forceable in ~17 min at the
 * generic 60 req/60s API limit.
 */
const tokenLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "ratelimit:token",
    })
  : undefined;

function isTokenPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/tickets/external/") ||
    pathname.startsWith("/api/pin-reveal") ||
    pathname.startsWith("/api/qr-clock") ||
    pathname.startsWith("/api/station/authorize") ||
    pathname.startsWith("/api/station/qr-token")
  );
}

/**
 * Expensive endpoints — strict limit (10 req / 60s).
 * Covers GDPR exports, account deletion, feedback submission, and any
 * payroll/full-history reports that hold a DB connection > 1s. Stops a single
 * client from monopolising the connection pool.
 */
const expensiveLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      prefix: "ratelimit:expensive",
    })
  : undefined;

/** Pathname prefixes that go through the expensive-endpoint limiter. */
const EXPENSIVE_PREFIXES = [
  "/api/account/export",
  "/api/account/accept-tos",
  "/api/feedback",
  "/api/payroll",
  "/api/export",
  "/api/time-entries/export",
];

function isExpensivePath(pathname: string): boolean {
  return EXPENSIVE_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Maximum JSON request body size (1 MB) */
const MAX_JSON_BODY_BYTES = 1_048_576; // 1 MB
/** Maximum file upload body size (10 MB — import route has its own 5 MB check) */
const MAX_UPLOAD_BODY_BYTES = 10_485_760; // 10 MB

/** Return 503 when the Redis rate-limiter is temporarily unavailable. */
function rateLimitUnavailable(
  staticHeaders: Record<string, string>,
  nonce: string,
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error:
        "Rate limiting service temporarily unavailable. Please try again shortly.",
      code: "RATE_LIMIT_UNAVAILABLE",
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "30",
        ...staticHeaders,
        "Content-Security-Policy": buildCsp(nonce),
      },
    },
  );
}

/* ──────────────────────────────────────────────────────────────
 * CORS configuration for API routes
 *
 * Allows the production domain and configurable extra origins
 * (e.g., mobile apps, partner integrations) via CORS_ALLOWED_ORIGINS.
 * Only applied to /api/* paths. Preflight OPTIONS requests are
 * answered directly with a 204 (no body).
 * ────────────────────────────────────────────────────────────── */
// In production the only allowed origin is the deployed app's own URL.
// During local dev we add http://localhost:3000 as a convenience so the
// curl-able test workflow works without setting NEXTAUTH_URL.
const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXTAUTH_URL,
    process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ??
      []),
  ].filter((value): value is string => Boolean(value)),
);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

/* ──────────────────────────────────────────────────────────────
 * Middleware
 * ────────────────────────────────────────────────────────────── */
export default withAuth(
  async function middleware(req) {
    // Forward pathname as a request header so server components / layouts
    // can read it via headers().get("x-pathname"). Used by the dashboard
    // subscription gate to allow-list the billing page.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", req.nextUrl.pathname);

    const res = NextResponse.next({ request: { headers: requestHeaders } });

    // Generate per-request IDs
    const nonce = generateNonce();
    const requestId = crypto.randomUUID();

    // Apply static security headers
    for (const [header, value] of Object.entries(staticHeaders)) {
      res.headers.set(header, value);
    }
    // Request tracing header
    res.headers.set("X-Request-Id", requestId);
    // Apply nonce-based CSP
    res.headers.set("Content-Security-Policy", buildCsp(nonce));
    // Pass nonce to Next.js for inline scripts (server components)
    res.headers.set("x-nonce", nonce);
    // Expose current pathname to server components / layouts (for subscription gate, etc.)
    res.headers.set("x-pathname", req.nextUrl.pathname);

    // Rate limiting (Upstash Redis — serverless-safe)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { pathname } = req.nextUrl;

    // ── Onboarding gate (defense-in-depth) ────────────────────────
    // The dashboard layout already redirects OWNER/ADMIN with
    // onboardingCompleted=false, but this middleware-level gate catches
    // direct API calls and any route that bypasses the layout (e.g. RSC
    // fetches, SWR preflight, or routes added later without the layout check).
    //
    // Allow-list: paths an incomplete workspace legitimately needs to access.
    const ONBOARDING_ALLOWLIST = [
      "/onboarding",
      "/api/onboarding",
      "/api/billing",
      "/api/auth",
      "/api/health",
      "/einstellungen/abonnement",
      "/workspace-inaktiv",
      "/testphase-abgelaufen",
      "/hard-block",
      "/api/profile", // profile update (name, locale)
      "/api/push-subscriptions", // service-worker registration
    ];
    const token = req.nextauth?.token;
    if (
      token &&
      token.onboardingCompleted === false &&
      (token.role === "OWNER" || token.role === "ADMIN") &&
      !ONBOARDING_ALLOWLIST.some((p) => pathname.startsWith(p)) &&
      !pathname.startsWith("/api/auth") &&
      // public/unauthenticated routes (already excluded by authorized())
      !pathname.startsWith("/sos/respond") &&
      !pathname.startsWith("/stempel") &&
      !pathname.startsWith("/station") &&
      !pathname.startsWith("/pin-reveal")
    ) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // ── CORS headers for API routes ──
    if (pathname.startsWith("/api/")) {
      const origin = req.headers.get("origin");
      if (isAllowedOrigin(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin!);
        res.headers.set("Access-Control-Allow-Credentials", "true");
        res.headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        );
        res.headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Request-Id",
        );
        res.headers.set("Access-Control-Max-Age", "86400"); // 24 h preflight cache
      }

      // Handle preflight OPTIONS requests immediately
      if (req.method === "OPTIONS") {
        return new NextResponse(null, {
          status: 204,
          headers: res.headers,
        });
      }

      // ── Fetch Metadata CSRF defense ──
      // Modern browsers always send Sec-Fetch-Site on all requests.
      // "cross-site" means the request originated from a different origin —
      // reject mutations so a malicious third-party page cannot trigger
      // state changes on behalf of a logged-in user.
      // Exempt public endpoints that legitimately receive cross-origin POSTs.
      const secFetchSite = req.headers.get("sec-fetch-site");
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
        req.method,
      );
      const isCsrfExempt =
        pathname.startsWith("/api/auth/mobile/") ||
        pathname.startsWith("/api/qr-clock/") ||
        pathname.startsWith("/api/station/") ||
        pathname.startsWith("/api/tickets/external/") ||
        pathname === "/api/billing/webhook" ||
        pathname.startsWith("/api/sos/respond");

      if (isMutation && secFetchSite === "cross-site" && !isCsrfExempt) {
        return new NextResponse(
          JSON.stringify({ error: "Forbidden", code: "CSRF_BLOCKED" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...staticHeaders,
              "Content-Security-Policy": buildCsp(nonce),
            },
          },
        );
      }
    }

    // ── Request body size limits (M4 — prevent oversized payloads) ──
    const method = req.method;
    if (
      (method === "POST" || method === "PUT" || method === "PATCH") &&
      pathname.startsWith("/api/")
    ) {
      const contentLength = req.headers.get("content-length");
      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        const contentType = req.headers.get("content-type") || "";
        const isUpload =
          contentType.includes("multipart/form-data") ||
          pathname.startsWith("/api/import");
        const limit = isUpload ? MAX_UPLOAD_BODY_BYTES : MAX_JSON_BODY_BYTES;
        if (!isNaN(bytes) && bytes > limit) {
          return new NextResponse(
            JSON.stringify({
              error: "Payload too large",
              code: "PAYLOAD_TOO_LARGE",
              details: {
                maxBytes: limit,
                receivedBytes: bytes,
              },
            }),
            {
              status: 413,
              headers: {
                "Content-Type": "application/json",
                ...staticHeaders,
                "Content-Security-Policy": buildCsp(nonce),
              },
            },
          );
        }
      }
    }

    // ── Public token/PIN endpoints — very strict limit (5 req / 60s) ──
    if (isTokenPath(pathname)) {
      if (tokenLimiter) {
        try {
          const result = await tokenLimiter.limit(ip);
          res.headers.set("X-RateLimit-Limit", "5");
          res.headers.set("X-RateLimit-Remaining", String(result.remaining));
          res.headers.set(
            "X-RateLimit-Reset",
            String(Math.ceil(result.reset / 1000)),
          );
          if (!result.success) {
            return new NextResponse(
              JSON.stringify({
                error: "Too many requests.",
                code: "RATE_LIMITED",
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(
                    Math.ceil((result.reset - Date.now()) / 1000),
                  ),
                  ...staticHeaders,
                  "Content-Security-Policy": buildCsp(nonce),
                },
              },
            );
          }
        } catch {
          return rateLimitUnavailable(staticHeaders, nonce);
        }
      }
    }

    // ── Import endpoint — strict rate limit (5 req / 60s) ──
    if (pathname.startsWith("/api/import")) {
      if (importLimiter) {
        try {
          const result = await importLimiter.limit(ip);
          res.headers.set("X-RateLimit-Limit", "5");
          res.headers.set("X-RateLimit-Remaining", String(result.remaining));
          res.headers.set(
            "X-RateLimit-Reset",
            String(Math.ceil(result.reset / 1000)),
          );
          if (!result.success) {
            return new NextResponse(
              JSON.stringify({
                error: "Too many requests. Please try again later.",
                code: "RATE_LIMITED",
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(
                    Math.ceil((result.reset - Date.now()) / 1000),
                  ),
                  ...staticHeaders,
                  "Content-Security-Policy": buildCsp(nonce),
                },
              },
            );
          }
        } catch {
          return rateLimitUnavailable(staticHeaders, nonce);
        }
      }
    }

    // Auth endpoints — strict limit (10 req / 60s)
    if (pathname.startsWith("/api/auth/") || pathname === "/api/auth") {
      if (authLimiter) {
        try {
          const result = await authLimiter.limit(ip);
          res.headers.set("X-RateLimit-Limit", "10");
          res.headers.set("X-RateLimit-Remaining", String(result.remaining));
          res.headers.set(
            "X-RateLimit-Reset",
            String(Math.ceil(result.reset / 1000)),
          );
          if (!result.success) {
            return new NextResponse(
              JSON.stringify({
                error: "Too many requests. Please try again later.",
                code: "RATE_LIMITED",
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(
                    Math.ceil((result.reset - Date.now()) / 1000),
                  ),
                  ...staticHeaders,
                  "Content-Security-Policy": buildCsp(nonce),
                },
              },
            );
          }
        } catch {
          return rateLimitUnavailable(staticHeaders, nonce);
        }
      }
    }

    // Expensive endpoints — strict limit (10 req / 60s)
    if (isExpensivePath(pathname)) {
      if (expensiveLimiter) {
        try {
          const result = await expensiveLimiter.limit(ip);
          res.headers.set("X-RateLimit-Limit", "10");
          res.headers.set("X-RateLimit-Remaining", String(result.remaining));
          res.headers.set(
            "X-RateLimit-Reset",
            String(Math.ceil(result.reset / 1000)),
          );
          if (!result.success) {
            return new NextResponse(
              JSON.stringify({
                error:
                  "Too many requests for this endpoint. Please try again later.",
                code: "RATE_LIMITED",
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(
                    Math.ceil((result.reset - Date.now()) / 1000),
                  ),
                  ...staticHeaders,
                  "Content-Security-Policy": buildCsp(nonce),
                },
              },
            );
          }
        } catch {
          return rateLimitUnavailable(staticHeaders, nonce);
        }
      }
    }

    // API endpoints — moderate limit (60 req / 60s), excludes auth & import (they have their own limits)
    if (
      pathname.startsWith("/api/") &&
      !pathname.startsWith("/api/auth") &&
      !pathname.startsWith("/api/import")
    ) {
      if (apiLimiter) {
        try {
          const result = await apiLimiter.limit(ip);
          res.headers.set("X-RateLimit-Limit", "60");
          res.headers.set("X-RateLimit-Remaining", String(result.remaining));
          res.headers.set(
            "X-RateLimit-Reset",
            String(Math.ceil(result.reset / 1000)),
          );
          if (!result.success) {
            return new NextResponse(
              JSON.stringify({
                error: "Too many requests. Please try again later.",
                code: "RATE_LIMITED",
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": String(
                    Math.ceil((result.reset - Date.now()) / 1000),
                  ),
                  ...staticHeaders,
                  "Content-Security-Policy": buildCsp(nonce),
                },
              },
            );
          }
        } catch {
          return rateLimitUnavailable(staticHeaders, nonce);
        }
      }
    }

    return res;
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      // Allow unauthenticated access to auth endpoints (login, register)
      // and password reset pages
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Auth routes don't require authentication
        if (pathname.startsWith("/api/auth")) return true;
        // Stripe webhook is called server-to-server (no session)
        if (pathname === "/api/billing/webhook") return true;
        // Vercel Cron jobs — no browser session; auth is the CRON_SECRET header
        // Explicitly list cron routes only; /api/automations/settings is a
        // protected user-facing endpoint and must NOT be in this allowlist.
        if (
          pathname === "/api/automations/break-reminder" ||
          pathname === "/api/automations/break-end-warning" ||
          pathname === "/api/automations/auto-clockout" ||
          pathname === "/api/automations/generate-time-entries" ||
          pathname === "/api/automations/overtime-check" ||
          pathname === "/api/automations/payroll-lock" ||
          pathname === "/api/automations/sos-escalation"
        )
          return true;
        if (pathname === "/api/admin/data-retention") return true;
        // Health check is public (uptime monitors, load balancers)
        if (pathname === "/api/health") return true;
        // Password reset pages are public
        if (
          pathname === "/passwort-vergessen" ||
          pathname === "/passwort-zuruecksetzen"
        )
          return true;
        // External ticket endpoints are public
        if (pathname.startsWith("/api/tickets/external")) return true;
        // One-time PIN reveal link (employee opens from email)
        if (pathname.startsWith("/pin-reveal")) return true;
        if (pathname.startsWith("/api/pin-reveal")) return true;
        // QR attendance station: public token-gated endpoints (no session needed)
        if (pathname.startsWith("/api/qr-clock")) return true;
        // QR fast-punch page: public mobile page (employee scans QR code)
        if (pathname.startsWith("/stempel")) return true;
        // Station display page: public kiosk (auth handled via localStorage station key)
        if (pathname.startsWith("/station")) return true;
        // Station public API: authorize + qr-token + recent-punch (setup-link stays protected)
        if (pathname === "/api/station/authorize") return true;
        if (pathname === "/api/station/qr-token") return true;
        if (pathname === "/api/station/recent-punch") return true;
        // SOS employee response page + API (token-gated, no session required)
        if (pathname.startsWith("/sos/respond")) return true;
        if (pathname.startsWith("/api/sos/respond")) return true;
        // Everything else requires auth
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    // Auth routes (rate limiting only, no auth required)
    "/api/auth/:path*",
    // Password reset pages (public, but security headers apply)
    "/passwort-vergessen",
    "/passwort-zuruecksetzen",
    // Protect all dashboard routes
    "/dashboard/:path*",
    "/schichtplan/:path*",
    "/mitarbeiter/:path*",
    "/standorte/:path*",
    "/einstellungen/:path*",
    "/zeiterfassung/:path*",
    "/stempeluhr/:path*",
    "/abwesenheiten/:path*",
    "/schichttausch/:path*",
    "/zeitkonten/:path*",
    "/lohnexport/:path*",
    "/berichte/:path*",
    "/feiertage/:path*",
    "/abteilungen/:path*",
    "/qualifikationen/:path*",
    "/schichtvorlagen/:path*",
    "/urlaubskonto/:path*",
    "/monatsabschluss/:path*",
    "/automatisierung/:path*",
    "/projekte/:path*",
    "/webhooks/:path*",
    "/teamkalender/:path*",
    // Protect API routes (except auth and public invitation token lookup)
    "/api/employees/:path*",
    "/api/locations/:path*",
    "/api/shifts/:path*",
    "/api/absences/:path*",
    "/api/availability/:path*",
    "/api/shift-swaps/:path*",
    "/api/time-entries/:path*",
    "/api/time-accounts/:path*",
    "/api/notifications/:path*",
    "/api/notification-preferences/:path*",
    "/api/profile/:path*",
    "/api/export/:path*",
    "/api/automations/:path*",
    "/api/test-email/:path*",
    "/api/invitations/:path*",
    "/api/team/:path*",
    "/api/departments/:path*",
    "/api/skills/:path*",
    "/api/shift-templates/:path*",
    "/api/vacation-balances/:path*",
    "/api/holidays/:path*",
    "/api/reports/:path*",
    // Previously missing API routes
    "/api/billing/:path*",
    "/api/import/:path*",
    "/api/ical/:path*",
    "/api/webhooks/:path*",
    "/api/custom-roles/:path*",
    "/api/push-subscriptions/:path*",
    "/api/month-close/:path*",
    "/api/clients/:path*",
    "/api/projects/:path*",
    "/api/shift-change-requests/:path*",
    "/api/automation-rules/:path*",
    "/api/health",
    // Security audit — previously missing routes (no rate-limit, no headers)
    "/api/admin/:path*",
    "/api/docs",
    "/api/audit-logs/:path*",
    "/api/service-visits/:path*",
    "/api/service-reports/:path*",
    "/api/staffing-requirements/:path*",
    "/api/manager-alerts/:path*",
    "/api/e-signatures/:path*",
    "/api/workspace/:path*",
    "/api/annual-planning/:path*",
    "/api/tickets/:path*",
    // Ticket management pages (protected dashboard)
    "/tickets/:path*",
    // Onboarding wizard (protected, outside dashboard group)
    "/onboarding",
    "/api/onboarding/:path*",
    // QR attendance system (public, token-gated — security headers still apply)
    "/api/qr-clock/:path*",
    "/stempel",
    "/stempel/:path*",
    // Decentralized station display (public kiosk page + its API)
    "/station",
    "/station/:path*",
    "/api/station/:path*",
    // One-time PIN reveal (public, employee email link)
    "/pin-reveal",
    "/api/pin-reveal",
    // SOS shift fill — employee response page (public, token-gated)
    // and manager SOS API (protected, handled by authorized())
    "/sos/:path*",
    "/api/sos/:path*",
  ],
};
