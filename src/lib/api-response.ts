/* ═══════════════════════════════════════════════════════════════
   Standardized API Response Helpers
   ═══════════════════════════════════════════════════════════════
   Consistent error & success response format for all API routes.

   Error shape:
     { error: string, code?: string, details?: Record<string, unknown> }

   Success shape:
     { data: T } | raw JSON (for backwards compat)

   Usage:
     import { apiError, apiSuccess } from "@/lib/api-response";

     // Simple error
     return apiError("Not found", 404, "NOT_FOUND");

     // Validation error with details
     return apiError("Ungültige Eingabe", 400, "VALIDATION_ERROR", {
       fields: parsed.issues,
     });

     // Success (wraps in { data: ... })
     return apiSuccess({ employee });

   Error codes follow UPPER_SNAKE_CASE convention:
     UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR,
     CONFLICT, RATE_LIMITED, FILE_TOO_LARGE, TOO_MANY_ROWS,
     PLAN_LIMIT, SERVER_ERROR, etc.
   ═══════════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { jwtVerify } from "jose";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/* ── Types ──────────────────────────────────────────────────── */

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccessBody<T = unknown> {
  data: T;
}

/* ── Error helper ───────────────────────────────────────────── */

/**
 * Return a standardized JSON error response.
 *
 * @param message  Human-readable error message (may be German for user-facing)
 * @param status   HTTP status code (400, 401, 403, 404, 409, 413, 429, 500)
 * @param code     Optional machine-readable error code (UPPER_SNAKE_CASE)
 * @param details  Optional structured details (field errors, limits, etc.)
 */
export function apiError(
  message: string,
  status: number,
  code?: string,
  details?: Record<string, unknown>,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { error: message };
  if (code) body.code = code;
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

/* ── Convenience shortcuts ──────────────────────────────────── */

export const unauthorized = (message = "Unauthorized") =>
  apiError(message, 401, "UNAUTHORIZED");

export const noWorkspace = (message = "No workspace") =>
  apiError(message, 400, "NO_WORKSPACE");

export const notFound = (message = "Not found") =>
  apiError(message, 404, "NOT_FOUND");

export const conflict = (message: string) => apiError(message, 409, "CONFLICT");

export const serverError = (message = "Internal server error") =>
  apiError(message, 500, "SERVER_ERROR");

export const forbidden = (message = "Forbidden") =>
  apiError(message, 403, "FORBIDDEN");

export const badRequest = (message: string) =>
  apiError(message, 400, "BAD_REQUEST");

export const tooMany = (message = "Zu viele Anfragen") =>
  apiError(message, 429, "RATE_LIMITED");

export const payloadTooLarge = (message = "Payload too large") =>
  apiError(message, 413, "PAYLOAD_TOO_LARGE");

/* ── Route guard ────────────────────────────────────────────── */

/**
 * Authenticate + extract workspaceId in a single call.
 * Supports BOTH NextAuth sessions (web) and Bearer JWT tokens (mobile).
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (!auth.ok) return auth.response;
 *   const { user, workspaceId } = auth;
 *
 *   // If workspaceId is optional (e.g., onboarding routes):
 *   const auth = await requireAuth({ requireWorkspace: false });
 */
export async function requireAuth(
  options: { requireWorkspace?: boolean } = {},
): Promise<
  | { ok: true; user: SessionUser; workspaceId: string }
  | { ok: false; response: NextResponse }
> {
  const { requireWorkspace = true } = options;

  // 1) Try NextAuth session first (web browser)
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const user = session.user as SessionUser;
    if (requireWorkspace && !user.workspaceId) {
      return { ok: false, response: noWorkspace() };
    }
    return { ok: true, user, workspaceId: user.workspaceId as string };
  }

  // 2) Fall back to Bearer JWT token (mobile app)
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const secret = new TextEncoder().encode(
        process.env.NEXTAUTH_SECRET || "",
      );
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });

      // Reject tokens older than 1 hour
      if (payload.iat && Date.now() / 1000 - payload.iat > 3600) {
        return { ok: false, response: unauthorized() };
      }

      const userId = payload.sub as string;
      if (!userId) {
        return { ok: false, response: unauthorized() };
      }

      // Look up the user + employee link from DB
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          employee: { select: { id: true } },
          workspace: {
            select: { id: true, name: true, onboardingCompleted: true },
          },
        },
      });

      if (!dbUser) {
        return { ok: false, response: unauthorized() };
      }

      const user: SessionUser = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || dbUser.email,
        role: dbUser.role as SessionUser["role"],
        workspaceId: dbUser.workspaceId || "",
        workspaceName: dbUser.workspace?.name || undefined,
        employeeId: dbUser.employee?.id || undefined,
        onboardingCompleted: dbUser.workspace?.onboardingCompleted,
      };

      if (requireWorkspace && !user.workspaceId) {
        return { ok: false, response: noWorkspace() };
      }

      return { ok: true, user, workspaceId: user.workspaceId as string };
    } catch {
      return { ok: false, response: unauthorized() };
    }
  }

  return { ok: false, response: unauthorized() };
}

/* ── Success helper ─────────────────────────────────────────── */

/**
 * Return a standardized JSON success response.
 * Wraps data in `{ data: ... }` for consistent consumption.
 */
export function apiSuccess<T>(
  data: T,
  status = 200,
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data }, { status });
}
