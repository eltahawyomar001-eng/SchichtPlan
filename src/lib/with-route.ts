/* ═══════════════════════════════════════════════════════════════
   Route wrapper — standardised error handling for API routes
   ═══════════════════════════════════════════════════════════════
   Wraps a route handler with:
     - try/catch with structured logging + Sentry capture
     - Optional idempotency check/cache on POST

   Usage:
     import { withRoute } from "@/lib/with-route";

     export const GET = withRoute("/api/skills", "GET", async (req) => {
       // ... handler logic, return NextResponse
     });

     // With route params:
     export const PATCH = withRoute("/api/items/[id]", "PATCH", async (req, context) => {
       const params = await context!.params;
       // ...
     });

     // With idempotency:
     export const POST = withRoute("/api/items", "POST", async (req) => {
       // ...
     }, { idempotent: true });
   ═══════════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { checkIdempotency, cacheIdempotentResponse } from "@/lib/idempotency";

/* ── Types ──────────────────────────────────────────────────── */

export interface RouteContext {
  params: Promise<Record<string, string>>;
}

type RouteHandler = (
  req: Request,
  context?: RouteContext,
) => Promise<NextResponse>;

interface WithRouteOptions {
  /** Enable idempotency-key caching for this POST route. */
  idempotent?: boolean;
}

/* ── Wrapper ────────────────────────────────────────────────── */

/**
 * Wrap a Next.js route handler with standardised error handling.
 *
 * @param route   — route path for logging (e.g. "/api/skills")
 * @param method  — HTTP method for logging (e.g. "GET")
 * @param handler — the actual handler function
 * @param options — optional config (idempotency, etc.)
 */
export function withRoute(
  route: string,
  method: string,
  handler: RouteHandler,
  options?: WithRouteOptions,
): (req: Request, context?: RouteContext) => Promise<NextResponse> {
  return async (
    req: Request,
    context?: RouteContext,
  ): Promise<NextResponse> => {
    try {
      // ── Idempotency check (opt-in) ──
      if (options?.idempotent) {
        const cached = await checkIdempotency(req);
        if (cached) return cached;
      }

      const response = await handler(req, context);

      // ── Cache response for idempotent routes ──
      if (options?.idempotent) {
        await cacheIdempotentResponse(req, response);
      }

      return response;
    } catch (error) {
      log.error(`${method} ${route} failed`, { error });
      captureRouteError(error, { route, method });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
