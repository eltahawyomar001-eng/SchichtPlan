/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { requirePdfQuota, recordPdfGeneration } from "@/lib/subscription-guard";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * GET /api/export?type=shifts|time-entries|employees&format=xlsx|csv|pdf&start=...&end=...
 */
export const GET = withRoute("/api/export/download", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "reports", "read");
  if (forbidden) return forbidden;

  // Check plan feature
  const planGate = await requirePlanFeature(user.workspaceId!, "csvPdfExport");
  if (planGate) return planGate;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "shifts";
  const format = searchParams.get("format") || "xlsx";
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const projectId = searchParams.get("projectId");

  // PDF-specific quota check
  if (format === "pdf") {
    const pdfLimit = await requirePdfQuota(user.workspaceId!);
    if (pdfLimit) return pdfLimit;
  }

  // Fetch workspace name for export branding
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId! },
    select: { name: true },
  });
  const companyName = workspace?.name || "Export";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = companyName;

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

    // Check which months are closed to show "Abgeschlossen" in Status
    const monthCloseRecords = await prisma.monthClose.findMany({
      where: {
        workspaceId: user.workspaceId,
        status: { in: ["LOCKED", "EXPORTED"] },
      },
      select: { year: true, month: true },
    });
    const closedMonths = new Set(
      monthCloseRecords.map((mc) => `${mc.year}-${mc.month}`),
    );

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
    entries.forEach((e) => {
      const entryDate = new Date(e.date);
      const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`;
      const isClosed = closedMonths.has(monthKey);

      ws.addRow({
        date: new Date(e.date).toLocaleDateString("en-CA", {
          timeZone: "Europe/Berlin",
        }),
        employee: `${e.employee.firstName} ${e.employee.lastName}`,
        startTime: e.startTime,
        endTime: e.endTime,
        breakMinutes: e.breakMinutes,
        netMinutes: e.netMinutes,
        status: isClosed ? "Abgeschlossen" : e.status,
        remarks: e.remarks,
      });
    });
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
        date: new Date(s.date).toLocaleDateString("en-CA", {
          timeZone: "Europe/Berlin",
        }),
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
      doc.text(`${companyName} – ${type}`, 14, 15);
      doc.setFontSize(8);
      doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, 14, 22);

      autoTable(doc, {
        head: [headers],
        body,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 150, 105] }, // emerald-600
      });
    }

    const pdfOutput = doc.output("arraybuffer") as ArrayBuffer;
    buffer = Buffer.from(pdfOutput);
    contentType = "application/pdf";
    ext = "pdf";

    // Record PDF generation against monthly quota
    await recordPdfGeneration(user.workspaceId!);
  } else if (format === "csv") {
    // German Excel expects semicolon separator + UTF-8 BOM
    const csvBuffer = await workbook.csv.writeBuffer({
      formatterOptions: { delimiter: ";" },
    });
    const BOM = Buffer.from("\uFEFF", "utf-8");
    buffer = Buffer.concat([BOM, Buffer.from(csvBuffer)]);
    contentType = "text/csv; charset=utf-8";
    ext = "csv";
  } else {
    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    buffer = Buffer.from(xlsxBuffer);
    contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }

  const safeName = companyName
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  const filename = `${safeName}_${type}_${new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Berlin" })}.${ext}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
