import { NextResponse } from "next/server";
import { requireAuth, badRequest } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { computeReadiness } from "@/lib/audit-readiness";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/readiness?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Live audit-readiness score + findings for the period (not persisted).
 */
export const GET = withRoute(
  "/api/compliance/readiness",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return badRequest("from und to sind erforderlich");
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return badRequest("Ungültiger Zeitraum");
    }

    try {
      const result = await computeReadiness(workspaceId, from, to);
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("[readiness GET] failed", {
        error: msg,
        workspaceId,
        from,
        to,
      });
      return NextResponse.json(
        { error: "COMPUTE_FAILED", message: `Prüfung fehlgeschlagen: ${msg}` },
        { status: 500 },
      );
    }
  },
);
