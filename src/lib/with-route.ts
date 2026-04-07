/* ═══════════════════════════════════════════════════════════════
   Route Handler Wrapper — withRoute()
   ═══════════════════════════════════════════════════════════════
   Higher-order function that wraps every API route handler with
   consistent error handling, Sentry capture, logging, and
   performance monitoring.

   Usage:
     import { withRoute } from "@/lib/with-route";

     export const GET = withRoute("/api/employees", "GET", async (req) => {
       // ... business logic ...
       return apiSuccess(data);
     });

     // With idempotency for POST:
     export const POST = withRoute("/api/employees", "POST", async (req) => {
       // ... business logic ...
     }, { idempotent: true });

   What withRoute handles automatically:
     ✅ try/catch wrapping
     ✅ captureRouteError() on exception
     ✅ log.error() on exception
     ✅ serverError() response on uncaught exception
     ✅ Slow route warnings (>5s)
     ✅ Optional idempotency check/cache for POST routes
   ═══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { captureRouteError } from "@/lib/sentry";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-response";
import { checkIdempotency, cacheIdempotentResponse } from "@/lib/idempotency";

/* ── Types ──────────────────────────────────────────────────── */

/** The shape every API route handler must satisfy */
type RouteHandler = (
  req: NextRequest | Request,
  context?: { params: Promise<Record<string, string>> },
) => Promise<NextResponse | Response>;

interface WithRouteOptions {
  /** Enable idempotency check/cache for POST routes (default: false) */
  idempotent?: boolean;
}

/* ── Thresholds ─────────────────────────────────────────────── */

/** Warn when a route takes longer than this (ms) */
const SLOW_ROUTE_THRESHOLD_MS = 5_000;

/* ── Wrapper ────────────────────────────────────────────────── */

/**
 * Wrap an API route handler with consistent error handling.
 *
 * @param routePath  e.g. "/api/employees" or "/api/shifts/[id]"
 * @param method     HTTP method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
 * @param handler    The actual route handler
 * @param options    Optional flags (idempotency, etc.)
 */
export function withRoute(
  routePath: string,
  method: string,
  handler: RouteHandler,
  options?: WithRouteOptions,
): RouteHandler {
  return async (req: NextRequest | Request, context?) => {
    const start = Date.now();

    try {
      // ── Idempotency check (POST only) ──────────────────────
      if (options?.idempotent && method === "POST") {
        const cached = await checkIdempotency(req);
        if (cached) return cached;
      }

      // ── Run the handler ────────────────────────────────────
      const response = await handler(req, context);

      // ── Slow route warning ─────────────────────────────────
      const duration = Date.now() - start;
      if (duration > SLOW_ROUTE_THRESHOLD_MS) {
        log.warn(`Slow route: ${routePath} ${method} took ${duration}ms`, {
          route: routePath,
          method,
          durationMs: duration,
        });
      }

      // ── Idempotency cache (POST only) ──────────────────────
      if (
        options?.idempotent &&
        method === "POST" &&
        response instanceof NextResponse
      ) {
        await cacheIdempotentResponse(req, response);
      }

      return response;
    } catch (error) {
      log.error(`${routePath} ${method} failed`, { error });
      captureRouteError(error, { route: routePath, method });
      return serverError();
    }
  };
}
