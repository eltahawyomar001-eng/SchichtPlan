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
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** Build CSP header with per-request nonce */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.resend.com https://*.sentry.io https://*.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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

/* ──────────────────────────────────────────────────────────────
 * Middleware
 * ────────────────────────────────────────────────────────────── */
export default withAuth(
  async function middleware(req) {
    const res = NextResponse.next();

    // Generate per-request nonce for CSP
    const nonce = generateNonce();

    // Apply static security headers
    for (const [header, value] of Object.entries(staticHeaders)) {
      res.headers.set(header, value);
    }
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

    // Auth endpoints — strict limit (10 req / 60s)
    if (pathname.startsWith("/api/auth/") || pathname === "/api/auth") {
      if (authLimiter) {
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
              error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
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
      }
    }

    // API endpoints — moderate limit (60 req / 60s)
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
      if (apiLimiter) {
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
              error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
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
    // Onboarding wizard (protected, outside dashboard group)
    "/onboarding",
    "/api/onboarding/:path*",
  ],
};
