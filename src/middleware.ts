import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/* ──────────────────────────────────────────────────────────────
 * Security headers (DSGVO Art. 32 — appropriate technical measures)
 * ────────────────────────────────────────────────────────────── */
const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.resend.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

/* ──────────────────────────────────────────────────────────────
 * In-memory rate limiter (per IP)
 *
 * Limits:
 *   – Auth endpoints (login/register): 10 req / 60 s
 *   – API endpoints:                    60 req / 60 s
 * ────────────────────────────────────────────────────────────── */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (entry.resetAt <= now) rateLimitMap.delete(key);
    }
  },
  5 * 60 * 1000,
);

function rateLimit(
  ip: string,
  bucket: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  entry.count++;
  const allowed = entry.count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Middleware
 * ────────────────────────────────────────────────────────────── */
export default withAuth(
  function middleware(req) {
    const res = NextResponse.next();

    // Apply security headers to every response
    for (const [header, value] of Object.entries(securityHeaders)) {
      res.headers.set(header, value);
    }

    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { pathname } = req.nextUrl;

    // Auth endpoints — strict limit (10 req / 60s)
    if (pathname.startsWith("/api/auth/") || pathname === "/api/auth") {
      const result = rateLimit(ip, "auth", 10, 60_000);
      res.headers.set("X-RateLimit-Limit", "10");
      res.headers.set("X-RateLimit-Remaining", String(result.remaining));
      res.headers.set(
        "X-RateLimit-Reset",
        String(Math.ceil(result.resetAt / 1000)),
      );
      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(
                Math.ceil((result.resetAt - Date.now()) / 1000),
              ),
              ...Object.fromEntries(Object.entries(securityHeaders)),
            },
          },
        );
      }
    }

    // API endpoints — moderate limit (60 req / 60s)
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
      const result = rateLimit(ip, "api", 60, 60_000);
      res.headers.set("X-RateLimit-Limit", "60");
      res.headers.set("X-RateLimit-Remaining", String(result.remaining));
      res.headers.set(
        "X-RateLimit-Reset",
        String(Math.ceil(result.resetAt / 1000)),
      );
      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(
                Math.ceil((result.resetAt - Date.now()) / 1000),
              ),
              ...Object.fromEntries(Object.entries(securityHeaders)),
            },
          },
        );
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
    "/abwesenheiten/:path*",
    "/schichttausch/:path*",
    "/verfuegbarkeiten/:path*",
    "/zeitkonten/:path*",
    "/lohnexport/:path*",
    "/berichte/:path*",
    "/feiertage/:path*",
    "/abteilungen/:path*",
    "/qualifikationen/:path*",
    "/schichtvorlagen/:path*",
    "/urlaubskonto/:path*",
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
  ],
};
