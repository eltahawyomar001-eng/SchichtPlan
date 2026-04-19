import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  formatIndustrial,
  getCalendarWeek,
  getStatusLabel,
  getExportHeaders,
} from "@/lib/time-utils";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { getLocaleFromCookie } from "@/i18n/locale";

/**
 * GET /api/time-entries/export?format=csv&start=...&end=...&employeeId=...
 *
 * Returns CSV (semicolon-separated for German Excel) with:
 * Mitarbeiter, Standort, KW, Datum, Start, Ende, Pause, Brutto, Netto,
 * Industriezeit, Status, Freigabe durch, Freigabe am
 */
export const GET = withRoute("/api/time-entries/export", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  // Only managers+ can export
  if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");
  const employeeId = searchParams.get("employeeId");

  const where: Record<string, unknown> = { workspaceId };
  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }
  if (employeeId) where.employeeId = employeeId;

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { employee: true, location: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  type EntryRow = (typeof entries)[number];

  // Resolve the user's chosen locale for locale-aware export
  const locale = await getLocaleFromCookie();
  const h = getExportHeaders(locale);
  const dateFmt = locale === "en" ? "en-GB" : "de-DE";
  const cwPrefix = locale === "en" ? "CW" : "KW";

  // CSV header
  const sep = ";";
  const header = [
    h.employee,
    h.location,
    h.calendarWeek,
    h.date,
    h.start,
    h.end,
    h.pauseMin,
    h.grossHHmm,
    h.netHHmm,
    h.industrialHours,
    h.status,
    h.confirmedBy,
    h.confirmedAt,
  ]
    .map((v) => `"${v}"`)
    .join(sep);

  const rows = entries.map((e: EntryRow) => {
    const d = new Date(e.date);
    const kw = getCalendarWeek(d);
    const datum = d.toLocaleDateString(dateFmt, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Use ="HH:mm" formula trick so Excel treats times as literal text
    const esc = (v: string) => `=${'"'}${v}${'"'}`;

    return [
      `${e.employee.firstName} ${e.employee.lastName}`,
      e.location?.name ?? "",
      `${cwPrefix} ${kw}`,
      datum,
      esc(e.startTime),
      esc(e.endTime),
      e.breakMinutes,
      formatIndustrial(e.grossMinutes, locale),
      formatIndustrial(e.netMinutes, locale),
      formatIndustrial(e.netMinutes, locale),
      getStatusLabel(e.status, locale),
      e.confirmedBy ?? "",
      e.confirmedAt
        ? new Date(e.confirmedAt).toLocaleDateString(dateFmt, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(sep);
  });

  // Summary row
  const totalNet = entries.reduce(
    (sum: number, e: EntryRow) => sum + e.netMinutes,
    0,
  );
  const totalGross = entries.reduce(
    (sum: number, e: EntryRow) => sum + e.grossMinutes,
    0,
  );
  rows.push("");
  rows.push(
    [
      h.total,
      "",
      "",
      "",
      "",
      "",
      "",
      formatIndustrial(totalGross, locale),
      formatIndustrial(totalNet, locale),
      formatIndustrial(totalNet, locale),
      "",
      "",
      "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(sep),
  );

  // BOM (\uFEFF) MUST be the very first bytes so Excel recognises UTF-8.
  // sep=; tells Excel to use semicolon as the list separator.
  const BOM = "\uFEFF";
  const csv = BOM + "sep=;\r\n" + [header, ...rows].join("\r\n");

  const filename =
    locale === "en" ? "time_tracking_export.csv" : "zeiterfassung_export.csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
