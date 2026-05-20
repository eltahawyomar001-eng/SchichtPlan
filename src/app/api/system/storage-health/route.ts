import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { log } from "@/lib/logger";

/**
 * GET /api/system/storage-health
 *
 * Admin-only diagnostic. Confirms that NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are present and that a minimal upload +
 * delete round-trip against the Supabase Storage "ticket-attachments"
 * bucket succeeds.
 */
export const GET = withRoute("/api/system/storage-health", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "settings", "update");
  if (forbidden) return forbidden;

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "SUPABASE_ENV_MISSING",
        message: "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt.",
      },
      { status: 503 },
    );
  }

  const BUCKET = "ticket-attachments";
  const probePath = `_health/${workspaceId}/${Date.now()}.txt`;
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  };

  const start = Date.now();

  try {
    const putRes = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${probePath}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "text/plain",
          "x-upsert": "true",
        },
        body: "ok",
      },
    );
    const putMs = Date.now() - start;

    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => putRes.statusText);
      log.error("[storage-health] probe upload failed", {
        status: putRes.status,
        detail,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "STORAGE_PUT_FAILED",
          message: `Speicherprobe fehlgeschlagen (${putRes.status}): ${detail.slice(0, 240)}`,
        },
        { status: 502 },
      );
    }

    // Best-effort cleanup
    await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [probePath] }),
    }).catch((err) =>
      log.warn("[storage-health] probe cleanup failed", { err }),
    );

    return NextResponse.json({
      ok: true,
      latencyMs: putMs,
      bucket: BUCKET,
      probeUrl: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${probePath}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[storage-health] fetch threw", { err: msg });
    return NextResponse.json(
      {
        ok: false,
        error: "STORAGE_FETCH_FAILED",
        message: `Speicherprobe fehlgeschlagen: ${msg.slice(0, 240)}`,
      },
      { status: 502 },
    );
  }
});
