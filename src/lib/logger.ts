/* ═══════════════════════════════════════════════════════════════
   Structured logger
   ═══════════════════════════════════════════════════════════════
   Thin wrapper around console that emits JSON in production
   (for Vercel / Datadog / Sentry log ingestion) and pretty
   human-readable output in development.

   Request-ID aware:  Pass `requestId` in the data payload or
   use `log.withRequestId(id)` to get a scoped logger.

   Usage:
     import { log } from "@/lib/logger";
     log.info("Shift created", { shiftId, workspaceId });
     log.error("DB failed", { error });
     log.warn("Deprecated", { route });

     // Scoped to a request
     const rlog = log.withRequestId(reqId);
     rlog.info("Processing request");
   ═══════════════════════════════════════════════════════════════ */

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function serialize(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: IS_PRODUCTION ? undefined : error.stack,
    };
  }
  return error;
}

function emit(level: LogLevel, message: string, data?: LogPayload): void {
  const entry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...data,
    // Serialize any `error` field automatically
    ...(data?.error !== undefined ? { error: serialize(data.error) } : {}),
  };

  if (IS_PRODUCTION) {
    // Structured JSON — one line per log entry
    const method =
      level === "error" ? "error" : level === "warn" ? "warn" : "log";

    console[method](JSON.stringify(entry));
  } else {
    // Dev: readable prefix + optional data dump
    const prefix = `[${level.toUpperCase()}]`;
    const method =
      level === "error" ? "error" : level === "warn" ? "warn" : "log";
    if (data && Object.keys(data).length > 0) {
      console[method](prefix, message, data);
    } else {
      console[method](prefix, message);
    }
  }
}

/**
 * Returns a scoped logger that automatically includes `requestId` in
 * every log entry.
 */
function withRequestId(requestId: string) {
  return {
    info: (message: string, data?: LogPayload) =>
      emit("info", message, { requestId, ...data }),
    warn: (message: string, data?: LogPayload) =>
      emit("warn", message, { requestId, ...data }),
    error: (message: string, data?: LogPayload) =>
      emit("error", message, { requestId, ...data }),
  };
}

export const log = {
  info: (message: string, data?: LogPayload) => emit("info", message, data),
  warn: (message: string, data?: LogPayload) => emit("warn", message, data),
  error: (message: string, data?: LogPayload) => emit("error", message, data),
  withRequestId,
};
