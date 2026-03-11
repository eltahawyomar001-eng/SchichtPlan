/* ═══════════════════════════════════════════════════════════════
   Sentry helpers for API routes
   ═══════════════════════════════════════════════════════════════
   Centralised wrapper around @sentry/nextjs so every API route
   captures errors with consistent, structured context (route,
   method, user, workspace).

   Usage in a catch block:
     import { captureRouteError } from "@/lib/sentry";

     } catch (error) {
       log.error("Shift creation failed", { error });
       captureRouteError(error, {
         route: "/api/shifts",
         method: "POST",
         userId: user.id,
         workspaceId: user.workspaceId,
       });
       return NextResponse.json({ error: "…" }, { status: 500 });
     }

   Sentry Crons — checkpoint monitoring:
     import { cronMonitor } from "@/lib/sentry";
     const monitor = cronMonitor("generate-time-entries", "0 2 * * *");
     monitor.start();
     // … do work …
     monitor.finish("ok");     // or monitor.finish("error");

   Both helpers are safe to call when Sentry DSN is not configured
   (dev / early staging) — they silently no-op.
   ═══════════════════════════════════════════════════════════════ */

import * as Sentry from "@sentry/nextjs";

/* ── Error capture ──────────────────────────────────────────── */

interface RouteErrorContext {
  /** e.g. "/api/shifts" or "/api/time-entries/[id]/status" */
  route: string;
  /** HTTP method: GET | POST | PATCH | DELETE */
  method: string;
  /** Authenticated user ID (if available) */
  userId?: string | null;
  /** Workspace ID (tenant scope) */
  workspaceId?: string | null;
  /** Extra key-value pairs for the Sentry event */
  extra?: Record<string, unknown>;
}

/**
 * Capture an API route error in Sentry with structured context.
 *
 * Safe to call without Sentry DSN — silently no-ops.
 */
export function captureRouteError(
  error: unknown,
  ctx: RouteErrorContext,
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    scope.setTag("route", ctx.route);
    scope.setTag("http.method", ctx.method);
    scope.setTag("component", "api");

    if (ctx.workspaceId) {
      scope.setTag("workspace.id", ctx.workspaceId);
    }
    if (ctx.userId) {
      scope.setUser({ id: ctx.userId });
    }

    scope.setContext("request", {
      route: ctx.route,
      method: ctx.method,
      workspaceId: ctx.workspaceId ?? undefined,
      userId: ctx.userId ?? undefined,
      ...ctx.extra,
    });

    Sentry.captureException(error);
  });
}

/* ── Cron monitoring ────────────────────────────────────────── */

interface CronMonitor {
  /** Call at the start of the cron job */
  start: () => void;
  /** Call when the cron job finishes — "ok" or "error" */
  finish: (status: "ok" | "error") => void;
}

/**
 * Create a Sentry Crons monitor for a scheduled job.
 *
 * @param slug  Unique slug, e.g. "generate-time-entries"
 * @param schedule  Cron expression, e.g. "0 2 * * *"
 *
 * Safe to call without Sentry DSN — returns no-op stubs.
 */
export function cronMonitor(slug: string, schedule: string): CronMonitor {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return { start: () => {}, finish: () => {} };
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: slug, status: "in_progress" },
    {
      schedule: { type: "crontab", value: schedule },
      // Alert if the job doesn't complete within 30 minutes
      maxRuntime: 30,
      // Alert if the job doesn't start within 5 minutes of schedule
      checkinMargin: 5,
    },
  );

  return {
    start: () => {
      // Check-in already created above — start() is a semantic placeholder
      // so callers can be explicit. The in_progress check-in was sent
      // when cronMonitor() was called.
    },
    finish: (status: "ok" | "error") => {
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: slug,
        status: status === "ok" ? "ok" : "error",
      });
    },
  };
}
