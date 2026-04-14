/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, isEmployee } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { requirePdfQuota, recordPdfGeneration } from "@/lib/subscription-guard";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { getExportHeaders, toPersonnelNumber } from "@/lib/time-utils";
import { getLocaleFromCookie } from "@/i18n/locale";

/**
 * GET /api/export/arbeitszeitnachweis?employeeId=...&month=2025-01
 *
 * Generates a per-employee Arbeitszeitnachweis (work time record) PDF.
 * Required by German labour law — employer must document daily
 * working hours exceeding 8h (ArbZG §16), in practice most employers
 * document all hours.
 */
export const GET = withRoute(
  "/api/export/arbeitszeitnachweis",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Plan gate
    const planGate = await requirePlanFeature(workspaceId, "csvPdfExport");
    if (planGate) return planGate;

    // PDF monthly quota check
    const pdfLimit = await requirePdfQuota(workspaceId);
    if (pdfLimit) return pdfLimit;

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month"); // YYYY-MM

    if (!employeeId || !month) {
      return NextResponse.json(
        {
          error:
            "employeeId and month (YYYY-MM) are required / employeeId und month (YYYY-MM) sind erforderlich",
        },
        { status: 400 },
      );
    }

    // Resolve locale for export labels
    const locale = await getLocaleFromCookie();
    const h = getExportHeaders(locale);
    const dateFmt = locale === "en" ? "en-GB" : "de-DE";

    // EMPLOYEE can only export their own record
    if (isEmployee(user)) {
      if (user.employeeId !== employeeId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const forbidden = requirePermission(user, "reports", "read");
      if (forbidden) return forbidden;
    }

    // Fetch employee
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, workspaceId },
    });
    if (!employee) {
      return NextResponse.json(
        {
          error:
            locale === "en"
              ? "Employee not found"
              : "Mitarbeiter nicht gefunden",
        },
        { status: 404 },
      );
    }

    // Fetch workspace for header
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    // Parse month range
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // last day of month

    // Fetch time entries for this employee in this month
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        workspaceId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    });

    // Build table rows
    const rows: string[][] = [];
    let totalMinutes = 0;

    // Create a map of entries by date
    const entriesByDate = new Map<string, typeof timeEntries>();
    for (const entry of timeEntries) {
      const dateKey = new Date(entry.date).toLocaleDateString("en-CA", {
        timeZone: "Europe/Berlin",
      });
      const existing = entriesByDate.get(dateKey) || [];
      existing.push(entry);
      entriesByDate.set(dateKey, existing);
    }

    // Iterate all days of the month
    const daysInMonth = endDate.getDate();
    const weekdayNamesDE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const weekdayNamesEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayNames = locale === "en" ? weekdayNamesEN : weekdayNamesDE;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day);
      const dateStr = date.toLocaleDateString("en-CA", {
        timeZone: "Europe/Berlin",
      });
      const dayName = weekdayNames[date.getDay()];
      const formattedDate =
        locale === "en"
          ? `${dayName}, ${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          : `${dayName}, ${String(day).padStart(2, "0")}.${String(monthNum).padStart(2, "0")}.${year}`;

      const entries = entriesByDate.get(dateStr) || [];

      if (entries.length === 0) {
        rows.push([formattedDate, "-", "-", "-", "-", ""]);
      } else {
        for (const entry of entries) {
          const start = entry.clockInAt
            ? new Date(entry.clockInAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : entry.startTime || "-";
          const end = entry.clockOutAt
            ? new Date(entry.clockOutAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : entry.endTime || "-";
          const breakMin = entry.breakMinutes ?? 0;
          const breakStr = breakMin > 0 ? `${breakMin} min` : "-";

          // Calculate duration
          let durationMin = 0;
          if (entry.netMinutes) {
            durationMin = entry.netMinutes;
          } else if (entry.startTime && entry.endTime) {
            const [sh, sm] = entry.startTime.split(":").map(Number);
            const [eh, em] = entry.endTime.split(":").map(Number);
            durationMin = eh * 60 + em - (sh * 60 + sm) - breakMin;
            if (durationMin < 0) durationMin += 1440;
          }

          totalMinutes += durationMin;
          const hours = Math.floor(durationMin / 60);
          const mins = durationMin % 60;
          const durationStr =
            durationMin > 0
              ? `${hours}:${String(mins).padStart(2, "0")} h`
              : "-";

          rows.push([
            formattedDate,
            start,
            end,
            breakStr,
            durationStr,
            entry.remarks || "",
          ]);
        }
      }
    }

    // ── Generate PDF ──
    const doc = new jsPDF() as any;
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const monthName = startDate.toLocaleDateString(dateFmt, {
      month: "long",
      year: "numeric",
    });

    // Header
    doc.setFontSize(16);
    doc.text(h.workTimeRecord, 14, 15);
    doc.setFontSize(10);
    doc.text(`${h.employer}: ${workspace?.name || "-"}`, 14, 24);
    doc.text(`${h.employeeSingle}: ${employeeName}`, 14, 30);
    doc.text(`${h.position}: ${employee.position || "-"}`, 14, 36);
    doc.text(`${h.period}: ${monthName}`, 14, 42);
    doc.text(`${h.personnelNumber}: ${toPersonnelNumber(employee.id)}`, 14, 48);

    // Table
    autoTable(doc, {
      head: [[h.date, h.start, h.end, h.break_, h.workingTime, h.remarks]],
      body: rows,
      startY: 54,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105] }, // emerald-600
      columnStyles: {
        0: { cellWidth: 38 },
        5: { cellWidth: 35 },
      },
    });

    // Summary
    const finalY = doc.lastAutoTable?.finalY ?? 200;
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    doc.setFontSize(10);
    doc.text(
      `${h.totalHours}: ${totalHours}:${String(totalMins).padStart(2, "0")} h`,
      14,
      finalY + 10,
    );

    if (employee.weeklyHours) {
      const expectedMonthlyHours =
        (employee.weeklyHours as number) * (daysInMonth / 7);
      doc.text(
        `${h.targetHoursApprox}: ${expectedMonthlyHours.toLocaleString(dateFmt, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
        14,
        finalY + 17,
      );
    }

    // Signature lines
    doc.setFontSize(8);
    doc.text(
      `${h.createdOn} ${new Date().toLocaleDateString(dateFmt)}`,
      14,
      finalY + 30,
    );
    doc.line(14, finalY + 48, 90, finalY + 48);
    doc.text(h.signatureEmployer, 14, finalY + 53);
    doc.line(110, finalY + 48, 190, finalY + 48);
    doc.text(h.signatureEmployee, 110, finalY + 53);

    const pdfBuffer = doc.output("arraybuffer") as ArrayBuffer;
    const filenamePrefix =
      locale === "en" ? "Work_Time_Record" : "Arbeitszeitnachweis";
    const filename = `${filenamePrefix}_${employeeName.replace(/\s+/g, "_")}_${month}.pdf`;

    // Record PDF generation against monthly quota
    await recordPdfGeneration(workspaceId);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
