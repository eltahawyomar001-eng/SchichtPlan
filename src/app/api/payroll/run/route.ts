import { NextResponse } from "next/server";
import { requireAuth, badRequest } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { computePayroll } from "@/lib/payroll";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/run?year=YYYY&month=M
 * Computes the monthly gross-wage breakdown (base + surcharges + continued pay).
 * Read-only — nothing is persisted.
 */
export const GET = withRoute("/api/payroll/run", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "payroll-export", "read");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return badRequest("Ungültiges Jahr");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return badRequest("Ungültiger Monat");
  }

  try {
    const result = await computePayroll(workspaceId, year, month);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("[payroll run] failed", { error: msg, workspaceId, year, month });
    return NextResponse.json(
      { error: "COMPUTE_FAILED", message: `Berechnung fehlgeschlagen: ${msg}` },
      { status: 500 },
    );
  }
});
