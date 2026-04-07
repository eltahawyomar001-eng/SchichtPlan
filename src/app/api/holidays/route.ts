import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGermanHolidays, BUNDESLAENDER } from "@/lib/holidays";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/holidays?year=2025&bundesland=HE
 * Returns public holidays for the workspace's Bundesland (or query param).
 * Computed on the fly — no DB seed required.
 */
export const GET = withRoute("/api/holidays", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const bundeslandParam = searchParams.get("bundesland");

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  // Use query param, then workspace setting, then default HE
  let bundesland = bundeslandParam;
  if (!bundesland) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspace = await (prisma.workspace as any).findUnique({
      where: { id: workspaceId },
      select: { bundesland: true },
    });
    bundesland = workspace?.bundesland || "HE";
  }

  const bl = bundesland || "HE";
  const allHolidays = getGermanHolidays(year);

  // Filter to relevant ones for this Bundesland
  const holidays = allHolidays.filter(
    (h) => h.isNational || h.bundeslaender.includes(bl),
  );

  return NextResponse.json({
    year,
    bundesland: bl,
    bundeslandName: BUNDESLAENDER[bl] || bl,
    holidays: holidays.map((h) => ({
      name: h.name,
      date: h.date,
      isNational: h.isNational,
    })),
  });
});

/**
 * GET list of all Bundesländer
 * Available via /api/holidays/bundeslaender
 */
export { BUNDESLAENDER };
