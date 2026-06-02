import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { getLocaleFromCookie } from "@/i18n/locale";
import {
  getShiftStatusLabel,
  getAbsenceCategoryLabel,
  getRowTypeLabel,
} from "@/lib/time-utils";
import { getGermanHolidays } from "@/lib/holidays";

/**
 * GET /api/teamkalender/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a roster calendar export (Shifts + Absences + Public Holidays) for
 * the requested date range as a localised CSV. Replaces the legacy client-
 * side `new Blob()` exporter that dumped raw enums and ISO timestamps.
 *
 * Output guarantees:
 *  • UTF-8 with BOM so German umlauts render in Excel
 *  • `sep=;` Excel hint + `\r\n` line endings so columns split automatically
 *  • Dates formatted DD.MM.YYYY (de) or DD/MM/YYYY (en)
 *  • Times rendered as plain HH:mm — never ISO timestamps
 *  • Status / category enums translated to human-readable labels
 *  • Missing times collapse to an em-dash so cells are never empty
 */
export const GET = withRoute("/api/teamkalender/export", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const employeeId = searchParams.get("employeeId") || undefined;
  const departmentId = searchParams.get("departmentId") || undefined;

  if (!fromStr || !toStr) {
    return NextResponse.json(
      {
        error: "MISSING_RANGE",
        message:
          "Bitte Start- und Enddatum angeben (?from=YYYY-MM-DD&to=YYYY-MM-DD).",
      },
      { status: 400 },
    );
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json(
      { error: "INVALID_DATE", message: "Ungültiges Datum." },
      { status: 400 },
    );
  }

  const locale = await getLocaleFromCookie();
  const isDE = locale !== "en";
  const sep = ";";
  const dash = "—";

  // ── Fetch raw data scoped to the workspace and date range ──
  const [shifts, absences, workspace] = await Promise.all([
    prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: from, lte: to },
        ...(employeeId ? { employeeId } : {}),
        ...(departmentId
          ? { employee: { departments: { some: { departmentId } } } }
          : {}),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.absenceRequest.findMany({
      where: {
        workspaceId,
        startDate: { lte: to },
        endDate: { gte: from },
        deletedAt: null,
        status: { in: ["AUSSTEHEND", "GENEHMIGT"] },
        ...(employeeId ? { employeeId } : {}),
        ...(departmentId
          ? { employee: { departments: { some: { departmentId } } } }
          : {}),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ startDate: "asc" }],
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { bundesland: true },
    }),
  ]);

  // Public holidays for the years touched by the range, filtered to the
  // workspace's Bundesland (national holidays always included).
  const bundesland = workspace?.bundesland ?? "BE";
  const years = new Set<number>();
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    years.add(d.getFullYear());
  }
  const holidayDefs = Array.from(years).flatMap((y) => getGermanHolidays(y));
  const holidaysInRange = holidayDefs.filter((h) => {
    const hd = new Date(h.date);
    if (hd < from || hd > to) return false;
    return h.isNational || h.bundeslaender.includes(bundesland);
  });

  // ── Formatters ──
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(isDE ? "de-DE" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Berlin",
    });

  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // CSV field — always quote so embedded ; and " never split the column
    return `"${s.replace(/"/g, '""')}"`;
  };

  const headers = isDE
    ? ["Typ", "Mitarbeiter", "Datum", "Beginn", "Ende", "Status"]
    : ["Type", "Employee", "Date", "Start", "End", "Status"];

  const rows: string[][] = [];

  // Shifts
  for (const s of shifts) {
    const name = s.employee
      ? `${s.employee.firstName} ${s.employee.lastName}`.trim()
      : dash;
    rows.push([
      getRowTypeLabel("SHIFT", locale),
      name,
      fmtDate(new Date(s.date)),
      s.startTime || dash,
      s.endTime || dash,
      getShiftStatusLabel(s.status, locale),
    ]);
  }

  // Absences — one row per request (covers the whole [startDate, endDate]
  // range). Status column carries the absence category for clarity.
  for (const a of absences) {
    const name = a.employee
      ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
      : dash;
    const start = new Date(a.startDate);
    const end = new Date(a.endDate);
    const dateLabel =
      start.getTime() === end.getTime()
        ? fmtDate(start)
        : `${fmtDate(start)} – ${fmtDate(end)}`;
    rows.push([
      getRowTypeLabel("ABSENCE", locale),
      name,
      dateLabel,
      dash,
      dash,
      getAbsenceCategoryLabel(a.category, locale),
    ]);
  }

  // Public holidays
  for (const h of holidaysInRange) {
    rows.push([
      getRowTypeLabel("HOLIDAY", locale),
      dash,
      fmtDate(new Date(h.date)),
      dash,
      dash,
      h.name,
    ]);
  }

  // Sort by the parsed date column for a clean reading order.
  rows.sort((a, b) => {
    // first 10 chars of column index 2 = "DD.MM.YYYY" or "DD/MM/YYYY"
    const parse = (s: string) => {
      const m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);
      if (!m) return 0;
      return new Date(`${m[3]}-${m[2]}-${m[1]}`).getTime();
    };
    return parse(a[2]) - parse(b[2]);
  });

  const headerLine = headers.map(esc).join(sep);
  const bodyLines = rows.map((r) => r.map(esc).join(sep));

  // BOM (﻿) MUST be the first character so Excel detects UTF-8 and
  // renders ä/ö/ü/ß correctly. `sep=;` hint as line 1 tells Excel to use
  // semicolons even when the user's regional list separator is a comma.
  const BOM = "﻿";
  const csv =
    BOM + "sep=;\r\n" + [headerLine, ...bodyLines].join("\r\n") + "\r\n";

  const filename = `${isDE ? "kalender" : "calendar"}_${fromStr}_${toStr}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
