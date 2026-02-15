import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { toIndustrialHours } from "@/lib/time-utils";

// ─── GET  /api/export/datev ─────────────────────────────────────
// Returns a DATEV-compatible CSV for payroll
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

    // Only managers/admins/owners can export
    if (user.role === "EMPLOYEE") {
      return NextResponse.json(
        { error: "No permission for export" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const employeeId = searchParams.get("employeeId");
    const format = searchParams.get("format") || "datev"; // datev | csv

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start and end date are required" },
        { status: 400 },
      );
    }

    const where: Record<string, unknown> = {
      workspaceId,
      status: "BESTAETIGT", // Only confirmed entries
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (employeeId) where.employeeId = employeeId;

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        employee: true,
        location: true,
      },
      orderBy: [{ employee: { lastName: "asc" } }, { date: "asc" }],
    });

    if (format === "json") {
      // Return raw JSON for preview
      const summary = aggregateByEmployee(entries);
      return NextResponse.json(summary);
    }

    // Build CSV
    const csv = buildDATEVCsv(entries, format === "datev");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lohnexport_${startDate}_${endDate}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting:", error);
    return NextResponse.json({ error: "Error exporting" }, { status: 500 });
  }
}

// ─── Aggregation helper ─────────────────────────────────────────

interface TimeEntryWithRelations {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  grossMinutes: number;
  netMinutes: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
  };
  location: { name: string } | null;
}

function aggregateByEmployee(entries: TimeEntryWithRelations[]) {
  const map = new Map<
    string,
    {
      employeeId: string;
      name: string;
      position: string | null;
      totalGrossMinutes: number;
      totalNetMinutes: number;
      totalBreakMinutes: number;
      days: number;
      entries: TimeEntryWithRelations[];
    }
  >();

  for (const entry of entries) {
    const key = entry.employee.id;
    if (!map.has(key)) {
      map.set(key, {
        employeeId: key,
        name: `${entry.employee.lastName}, ${entry.employee.firstName}`,
        position: entry.employee.position,
        totalGrossMinutes: 0,
        totalNetMinutes: 0,
        totalBreakMinutes: 0,
        days: 0,
        entries: [],
      });
    }
    const agg = map.get(key)!;
    agg.totalGrossMinutes += entry.grossMinutes;
    agg.totalNetMinutes += entry.netMinutes;
    agg.totalBreakMinutes += entry.breakMinutes;
    agg.days += 1;
    agg.entries.push(entry);
  }

  return Array.from(map.values()).map((a) => ({
    ...a,
    totalGrossHours: toIndustrialHours(a.totalGrossMinutes),
    totalNetHours: toIndustrialHours(a.totalNetMinutes),
    totalBreakHours: toIndustrialHours(a.totalBreakMinutes),
    entries: undefined, // don't send raw entries in summary
  }));
}

// ─── CSV builder ────────────────────────────────────────────────

function buildDATEVCsv(
  entries: TimeEntryWithRelations[],
  datevFormat: boolean,
): string {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const sep = datevFormat ? ";" : ",";

  const headers = [
    "Personalnummer",
    "Nachname",
    "Vorname",
    "Datum",
    "Beginn",
    "Ende",
    "Pause (Min)",
    "Brutto (Std)",
    "Netto (Std)",
    "Standort",
  ];

  const rows = entries.map((e) => [
    e.employee.id.slice(-6), // Short personnel number
    e.employee.lastName,
    e.employee.firstName,
    formatDateDE(e.date),
    e.startTime,
    e.endTime,
    String(e.breakMinutes),
    toIndustrialHours(e.grossMinutes)
      .toFixed(2)
      .replace(".", datevFormat ? "," : "."),
    toIndustrialHours(e.netMinutes)
      .toFixed(2)
      .replace(".", datevFormat ? "," : "."),
    e.location?.name || "",
  ]);

  const csvLines = [
    headers.join(sep),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(sep)),
  ];

  return BOM + csvLines.join("\r\n");
}

function formatDateDE(date: Date): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
