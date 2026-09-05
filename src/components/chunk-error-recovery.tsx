"use client";

import { useEffect } from "react";

/**
 * Last-resort recovery from a stale client bundle.
 *
 * `deploymentId` + Vercel Skew Protection keep an open session pinned to the
 * build that served it, but that guarantee has a finite window. A tab left
 * open over a weekend, or a client whose cached HTML outlives the retention
 * period, can still ask for a chunk that no longer exists. When that happens
 * the App Router throws a ChunkLoadError and the page goes blank, because the
 * error boundary's own chunk is part of what went missing.
 *
 * A user should never have to know the words "hard refresh". This listens for
 * that specific failure and reloads once, which re-fetches the current HTML
 * and the matching chunks.
 *
 * Guarded by sessionStorage so a genuinely broken deploy cannot turn into an
 * infinite reload loop: one automatic attempt per tab, then the error is left
 * to surface normally.
 */

const RELOAD_FLAG = "shiftfy:chunk-reload";

function isChunkLoadError(value: unknown): boolean {
  if (!value) return false;
  const err = value as { name?: string; message?: string };
  const name = err.name ?? "";
  const message = err.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    // Safari and Firefox phrase a failed module fetch differently.
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export function ChunkErrorRecovery() {
  useEffect(() => {
    // A successful load means the app is healthy again; clear the guard so a
    // future skew event is still allowed one automatic recovery.
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // Private mode / storage disabled — recovery just becomes best-effort.
    }

    const recover = (err: unknown) => {
      if (!isChunkLoadError(err)) return;
      try {
        if (sessionStorage.getItem(RELOAD_FLAG)) return; // already tried once
        sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        return; // cannot dedupe safely, so do not risk a reload loop
      }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => recover(e.error ?? e);
    const onRejection = (e: PromiseRejectionEvent) => recover(e.reason);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
