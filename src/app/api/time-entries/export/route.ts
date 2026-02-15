import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import {
  formatMinutesToHHmm,
  formatIndustrial,
  getCalendarWeek,
  STATUS_LABELS,
} from "@/lib/time-utils";

/**
 * GET /api/time-entries/export?format=csv&start=...&end=...&employeeId=...
 *
 * Returns CSV (semicolon-separated for German Excel) with:
 * Mitarbeiter, Standort, KW, Datum, Start, Ende, Pause, Brutto, Netto,
 * Industriezeit, Status, Freigabe durch, Freigabe am
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
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

    // CSV header
    const sep = ";";
    const header = [
      "Mitarbeiter",
      "Standort",
      "KW",
      "Datum",
      "Start",
      "Ende",
      "Pause (HH:mm)",
      "Brutto (HH:mm)",
      "Netto (HH:mm)",
      "Industriezeit (h)",
      "Status",
      "Freigabe durch",
      "Freigabe am",
    ].join(sep);

    const rows = entries.map((e: EntryRow) => {
      const d = new Date(e.date);
      const kw = getCalendarWeek(d);
      const datum = d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      return [
        `${e.employee.firstName} ${e.employee.lastName}`,
        e.location?.name ?? "",
        `KW ${kw}`,
        datum,
        e.startTime,
        e.endTime,
        formatMinutesToHHmm(e.breakMinutes),
        formatMinutesToHHmm(e.grossMinutes),
        formatMinutesToHHmm(e.netMinutes),
        formatIndustrial(e.netMinutes),
        STATUS_LABELS[e.status] ?? e.status,
        e.confirmedBy ?? "",
        e.confirmedAt
          ? new Date(e.confirmedAt).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "",
      ].join(sep);
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
        "GESAMT",
        "",
        "",
        "",
        "",
        "",
        "",
        formatMinutesToHHmm(totalGross),
        formatMinutesToHHmm(totalNet),
        formatIndustrial(totalNet),
        "",
        "",
        "",
      ].join(sep),
    );

    const csv = "\uFEFF" + [header, ...rows].join("\r\n"); // BOM for German Excel

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zeiterfassung_export.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting time entries:", error);
    return NextResponse.json({ error: "Error exporting" }, { status: 500 });
  }
}
