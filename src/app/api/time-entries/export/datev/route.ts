import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorization";
import { requireAuth } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/time-entries/export/datev?month=YYYY-MM
 *
 * Exports time entries as a DATEV Lohn & Gehalt compatible CSV.
 * Columns: Mitarbeiter-Nr, Nachname, Vorname, Datum, Beginn, Ende, Pause (min), Netto (h:mm), Bemerkung
 */
export const GET = withRoute(
  "/api/time-entries/export/datev",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    const forbidden = requirePermission(user, "time-entries", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "INVALID_MONTH" }, { status: 400 });
    }

    const [year, mon] = month.split("-").map(Number);
    const from = new Date(Date.UTC(year, mon - 1, 1));
    const to = new Date(Date.UTC(year, mon, 0, 23, 59, 59));

    const entries = await prisma.timeEntry.findMany({
      where: {
        workspaceId,
        date: { gte: from, lte: to },
        deletedAt: null,
        status: { not: "ZURUECKGEWIESEN" },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { employee: { lastName: "asc" } },
        { date: "asc" },
        { startTime: "asc" },
      ],
    });

    const formatNetTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}:${String(m).padStart(2, "0")}`;
    };

    const formatDate = (d: Date) =>
      d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Berlin",
      });

    // DATEV header
    const rows: string[] = [
      [
        "Mitarbeiter-Nr",
        "Nachname",
        "Vorname",
        "Datum",
        "Beginn",
        "Ende",
        "Pause (Min)",
        "Netto (h:mm)",
        "Lohnart",
        "Bemerkung",
      ].join(";"),
    ];

    // Use employee.id short suffix as Mitarbeiter-Nr (first 8 chars)
    for (const entry of entries) {
      const empNr = entry.employee.id.slice(-8).toUpperCase();
      rows.push(
        [
          empNr,
          entry.employee.lastName,
          entry.employee.firstName,
          formatDate(entry.date),
          entry.startTime,
          entry.endTime,
          String(entry.breakMinutes),
          formatNetTime(entry.netMinutes),
          "2000", // DATEV Lohnart 2000 = Arbeitsstunden
          (entry.remarks ?? "").replace(/;/g, ","),
        ].join(";"),
      );
    }

    const csv = "﻿" + rows.join("\r\n"); // BOM for Excel UTF-8 detection
    const filename = `shiftfy-datev-${month}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
