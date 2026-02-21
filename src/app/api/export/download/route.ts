/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * GET /api/export?type=shifts|time-entries|employees&format=xlsx|csv|pdf&start=...&end=...
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "reports", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "shifts";
    const format = searchParams.get("format") || "xlsx";
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const projectId = searchParams.get("projectId");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SchichtPlan";

    if (type === "employees") {
      const employees = await prisma.employee.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { lastName: "asc" },
      });

      const ws = workbook.addWorksheet("Mitarbeiter");
      ws.columns = [
        { header: "Vorname", key: "firstName", width: 20 },
        { header: "Nachname", key: "lastName", width: 20 },
        { header: "E-Mail", key: "email", width: 30 },
        { header: "Telefon", key: "phone", width: 20 },
        { header: "Position", key: "position", width: 20 },
        { header: "Stundenlohn", key: "hourlyRate", width: 15 },
        { header: "Wochenstunden", key: "weeklyHours", width: 15 },
      ];
      employees.forEach((e) => ws.addRow(e));
    } else if (type === "time-entries") {
      const where: Record<string, unknown> = {
        workspaceId: user.workspaceId,
      };
      if (start && end) {
        where.date = { gte: new Date(start), lte: new Date(end) };
      }
      if (projectId) where.projectId = projectId;

      const entries = await prisma.timeEntry.findMany({
        where,
        include: { employee: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });

      const ws = workbook.addWorksheet("Zeiteinträge");
      ws.columns = [
        { header: "Datum", key: "date", width: 15 },
        { header: "Mitarbeiter", key: "employee", width: 25 },
        { header: "Start", key: "startTime", width: 10 },
        { header: "Ende", key: "endTime", width: 10 },
        { header: "Pause (Min)", key: "breakMinutes", width: 12 },
        { header: "Netto (Min)", key: "netMinutes", width: 12 },
        { header: "Status", key: "status", width: 15 },
        { header: "Bemerkung", key: "remarks", width: 30 },
      ];
      entries.forEach((e) =>
        ws.addRow({
          date: e.date.toISOString().split("T")[0],
          employee: `${e.employee.firstName} ${e.employee.lastName}`,
          startTime: e.startTime,
          endTime: e.endTime,
          breakMinutes: e.breakMinutes,
          netMinutes: e.netMinutes,
          status: e.status,
          remarks: e.remarks,
        }),
      );
    } else {
      // shifts
      const where: Record<string, unknown> = {
        workspaceId: user.workspaceId,
      };
      if (start && end) {
        where.date = { gte: new Date(start), lte: new Date(end) };
      }

      const shifts = await prisma.shift.findMany({
        where,
        include: { employee: true, location: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });

      const ws = workbook.addWorksheet("Schichtplan");
      ws.columns = [
        { header: "Datum", key: "date", width: 15 },
        { header: "Mitarbeiter", key: "employee", width: 25 },
        { header: "Start", key: "startTime", width: 10 },
        { header: "Ende", key: "endTime", width: 10 },
        { header: "Standort", key: "location", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Notizen", key: "notes", width: 30 },
      ];
      shifts.forEach((s) =>
        ws.addRow({
          date: s.date.toISOString().split("T")[0],
          employee: s.employee
            ? `${s.employee.firstName} ${s.employee.lastName}`
            : "—",
          startTime: s.startTime,
          endTime: s.endTime,
          location: s.location?.name || "—",
          status: s.status,
          notes: s.notes,
        }),
      );
    }

    let buffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === "pdf") {
       
      const doc = new jsPDF() as any;
      const ws = workbook.worksheets[0];
      if (ws) {
        const headers: string[] = [];
        const body: string[][] = [];
        ws.getRow(1).eachCell((cell) => {
          headers.push(String(cell.value ?? ""));
        });
        ws.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowData: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            rowData.push(String(cell.value ?? ""));
          });
          body.push(rowData);
        });

        doc.setFontSize(14);
        doc.text(`SchichtPlan – ${type}`, 14, 15);
        doc.setFontSize(8);
        doc.text(
          `Erstellt am ${new Date().toLocaleDateString("de-DE")}`,
          14,
          22,
        );

        autoTable(doc, {
          head: [headers],
          body,
          startY: 28,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [124, 58, 237] },
        });
      }

      const pdfOutput = doc.output("arraybuffer") as ArrayBuffer;
      buffer = Buffer.from(pdfOutput);
      contentType = "application/pdf";
      ext = "pdf";
    } else if (format === "csv") {
      const csvBuffer = await workbook.csv.writeBuffer();
      buffer = Buffer.from(csvBuffer);
      contentType = "text/csv; charset=utf-8";
      ext = "csv";
    } else {
      const xlsxBuffer = await workbook.xlsx.writeBuffer();
      buffer = Buffer.from(xlsxBuffer);
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = "xlsx";
    }

    const filename = `${type}_${new Date().toISOString().split("T")[0]}.${ext}`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
