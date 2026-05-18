import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";

/**
 * GET /api/system/storage-health
 *
 * Admin-only diagnostic. Confirms that BLOB_READ_WRITE_TOKEN is present
 * and that a minimal put + delete round-trip against Vercel Blob works.
 * Use this when a workspace reports the "Datei-Upload ist derzeit nicht
 * konfiguriert" toast — it tells you in one request whether the prod
 * environment is missing the token vs. has a different problem.
 *
 * Returns `{ ok: true, latencyMs }` on success, otherwise a structured
 * error code that the caller (and ops) can act on directly.
 */
export const GET = withRoute("/api/system/storage-health", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "settings", "update");
  if (forbidden) return forbidden;

  const tokenPresent = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!tokenPresent) {
    return NextResponse.json(
      {
        ok: false,
        error: "BLOB_TOKEN_MISSING",
        message:
          "BLOB_READ_WRITE_TOKEN ist nicht gesetzt. Bitte in den Vercel-Umgebungsvariablen ergänzen und neu deployen.",
      },
      { status: 503 },
    );
  }

  const probePath = `_health/${workspaceId}/${Date.now()}.txt`;
  const probeBody = Buffer.from("ok", "utf8");
  const start = Date.now();

  try {
    const blob = await put(probePath, probeBody, {
      access: "public",
      contentType: "text/plain",
      addRandomSuffix: true,
    });
    const putMs = Date.now() - start;
    try {
      await del(blob.url);
    } catch (err) {
      log.warn("[storage-health] probe blob cleanup failed", {
        url: blob.url,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return NextResponse.json({
      ok: true,
      latencyMs: putMs,
      probeUrl: blob.url,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[storage-health] put failed", { err: msg });
    return NextResponse.json(
      {
        ok: false,
        error: "BLOB_PUT_FAILED",
        message: `Speicherprobe fehlgeschlagen: ${msg.slice(0, 240)}`,
      },
      { status: 502 },
    );
  }
});
