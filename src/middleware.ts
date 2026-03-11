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
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-API-Version": "1",
};

/** Build CSP header with per-request nonce */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline' is ignored by modern browsers when nonce is present (backward compat for older browsers)
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://vercel.live`,
    // Use 'unsafe-inline' only for styles — no nonce, so it is respected by all browsers
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.resend.com https://*.sentry.io https://*.stripe.com https://vercel.live",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "require-trusted-types-for 'script'",
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

/** Maximum JSON request body size (1 MB) */
const MAX_JSON_BODY_BYTES = 1_048_576; // 1 MB
/** Maximum file upload body size (10 MB — import route has its own 5 MB check) */
const MAX_UPLOAD_BODY_BYTES = 10_485_760; // 10 MB

/* ──────────────────────────────────────────────────────────────
 * CORS configuration for API routes
 *
 * Allows the production domain and configurable extra origins
 * (e.g., mobile apps, partner integrations) via CORS_ALLOWED_ORIGINS.
 * Only applied to /api/* paths. Preflight OPTIONS requests are
 * answered directly with a 204 (no body).
 * ────────────────────────────────────────────────────────────── */
const ALLOWED_ORIGINS = new Set(
  [
    process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ??
      []),
  ].filter(Boolean),
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
    const res = NextResponse.next();

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

    // Rate limiting (Upstash Redis — serverless-safe)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { pathname } = req.nextUrl;

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
                error:
                  "Zu viele Import-Anfragen. Bitte versuchen Sie es später erneut.",
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
          // Redis unavailable — degrade gracefully
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
                error:
                  "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
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
          // Redis unavailable — degrade gracefully, allow request through.
          // Rate limiting is a best-effort defense; availability > enforcement.
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
                error:
                  "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
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
          // Redis unavailable — degrade gracefully, allow request through.
          // Rate limiting is a best-effort defense; availability > enforcement.
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
        // Health check is public (uptime monitors, load balancers)
        if (pathname === "/api/health") return true;
        // Password reset pages are public
        if (
          pathname === "/passwort-vergessen" ||
          pathname === "/passwort-zuruecksetzen"
        )
          return true;
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
    "/verfuegbarkeiten/:path*",
    "/zeitkonten/:path*",
    "/lohnexport/:path*",
    "/berichte/:path*",
    "/wohlbefinden/:path*",
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
    "/api/chat/:path*",
    // Onboarding wizard (protected, outside dashboard group)
    "/onboarding",
    "/api/onboarding/:path*",
  ],
};
