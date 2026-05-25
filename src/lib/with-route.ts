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
import { Prisma } from "@prisma/client";
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
) => Promise<NextResponse | Response>;

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
): (req: Request, context?: RouteContext) => Promise<NextResponse | Response> {
  return async (
    req: Request,
    context?: RouteContext,
  ): Promise<NextResponse | Response> => {
    // Extract or generate a request ID for end-to-end tracing
    const requestId =
      (req.headers.get("x-request-id") ?? "").trim() || crypto.randomUUID();
    const rlog = log.withRequestId(requestId);

    try {
      // ── Idempotency check (opt-in) ──
      if (options?.idempotent) {
        const cached = await checkIdempotency(req);
        if (cached) return cached;
      }

      const response = await handler(req, context);

      // ── Cache response for idempotent routes ──
      if (options?.idempotent && response instanceof NextResponse) {
        await cacheIdempotentResponse(req, response);
      }

      // Echo request ID back so callers can correlate logs
      if (response instanceof NextResponse || response instanceof Response) {
        response.headers.set("x-request-id", requestId);
      }

      return response;
    } catch (error) {
      // Map Prisma unique-constraint and relation violations to 409 instead of 500
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const fields = (error.meta?.target as string[] | undefined)?.join(
            ", ",
          );
          return NextResponse.json(
            { error: "Conflict", code: "CONFLICT", fields },
            { status: 409, headers: { "x-request-id": requestId } },
          );
        }
        if (error.code === "P2014" || error.code === "P2016") {
          return NextResponse.json(
            { error: "Relation violation", code: "RELATION_ERROR" },
            { status: 409, headers: { "x-request-id": requestId } },
          );
        }
        if (error.code === "P2025") {
          return NextResponse.json(
            { error: "Not found", code: "NOT_FOUND" },
            { status: 404, headers: { "x-request-id": requestId } },
          );
        }
      }
      rlog.error(`${method} ${route} failed`, { error });
      captureRouteError(error, { route, method });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: { "x-request-id": requestId } },
      );
    }
  };
}
