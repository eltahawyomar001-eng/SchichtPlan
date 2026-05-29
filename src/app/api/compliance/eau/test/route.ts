/**
 * GET /api/compliance/eau/test
 *
 * Ad-hoc eAU test endpoint — calls the DATEV gateway directly without
 * needing an employee record. Admin-only. Useful for verifying sandbox
 * connectivity and trying different DATEV IDs.
 *
 * Query params:
 *   consultantNumber  DATEV Beraternummer
 *   clientNumber      DATEV Mandantennummer
 *   personnelNumber   DATEV Personalnummer
 *   date              YYYY-MM-DD  (defaults to today)
 *   source            LODAS | LUG  (defaults to LODAS)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { requireAdmin } from "@/lib/authorization";
import { requestEau, isDatevSandbox } from "@/lib/sv-gateway";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const { searchParams } = new URL(req.url);
  const consultantNumber = searchParams.get("consultantNumber") ?? "";
  const clientNumber = searchParams.get("clientNumber") ?? "";
  const personnelNumber = searchParams.get("personnelNumber") ?? "";
  const date =
    searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const source = (searchParams.get("source") ?? "LODAS") as "LODAS" | "LUG";

  if (!consultantNumber || !clientNumber || !personnelNumber) {
    return NextResponse.json(
      {
        error:
          "Provide consultantNumber, clientNumber, and personnelNumber as query params",
        example:
          "/api/compliance/eau/test?consultantNumber=1&clientNumber=1&personnelNumber=1&date=2025-01-15",
      },
      { status: 400 },
    );
  }

  const result = await requestEau(
    {
      consultantNumber,
      clientNumber,
      personnelNumber,
      sicknessStartDate: date,
      source,
    },
    workspaceId,
  );

  return NextResponse.json({
    sandbox: isDatevSandbox(),
    input: { consultantNumber, clientNumber, personnelNumber, date, source },
    result,
  });
}
