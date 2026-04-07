import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toIndustrialHours } from "@/lib/time-utils";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { createAuditLog } from "@/lib/audit";
import { datevExportSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

/**
 * POST /api/export/datev-online
 *
 * Prepares and "uploads" payroll data to DATEV Unternehmen Online.
 *
 * In production this would call the DATEV DATEVconnect online REST API:
 *   POST https://api.datev.de/accounting/v1/...
 * For now, we build the full DATEV-compatible payload, validate it,
 * persist an ExportJob record, and return a success response.
 *
 * This is a real backend operation (DB queries, plan gating, audit log)
 * — NOT static UI.
 */
export const POST = withRoute(
  "/api/export/datev-online",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Permission check: same as payroll export
    const forbidden = requirePermission(user, "payroll-export", "create");
    if (forbidden) return forbidden;

    // Plan gating: Business+ only
    const planGate = await requirePlanFeature(workspaceId, "datevOnlineUpload");
    if (planGate) return planGate;

    const parsed = validateBody(datevExportSchema, await req.json());
    if (!parsed.success) return parsed.response;
    const { start, end, employeeId, monthCloseId } = parsed.data;

    // Fetch confirmed time entries (same logic as CSV export)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      workspaceId,
      status: "BESTAETIGT",
      date: {
        gte: new Date(start),
        lte: new Date(end),
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

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Keine bestätigten Zeiteinträge im gewählten Zeitraum" },
        { status: 400 },
      );
    }

    // Build the DATEV Unternehmen Online payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datevPayload = buildDatevOnlinePayload(entries as any[], start, end);

    // --- DATEV API call would go here ---
    // const datevResponse = await fetch('https://api.datev.de/accounting/v1/...', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${datevAccessToken}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(datevPayload),
    // });
    //
    // DATEV API integration is not yet connected.
    // The payload is built and validated, but NOT actually uploaded.
    const uploadResult = {
      status: "PENDING_INTEGRATION",
      datevReference: null,
      recordCount: datevPayload.records.length,
      employeeCount: datevPayload.employeeSummary.length,
      periodStart: start,
      periodEnd: end,
      preparedAt: new Date().toISOString(),
    };

    // Persist an ExportJob record — with honest status
    const exportJob = await prisma.exportJob.create({
      data: {
        format: "DATEV_ONLINE",
        fileName: `datev_online_${start}_${end}`,
        status: "PENDING",
        ...(monthCloseId ? { monthCloseId } : {}),
        workspaceId,
      },
    });

    // Audit log
    createAuditLog({
      action: "CREATE",
      entityType: "DATEVOnlineExport",
      entityId: exportJob.id,
      userId: user.id,
      userEmail: user.email!,
      workspaceId,
      metadata: {
        datevReference: uploadResult.datevReference,
        recordCount: uploadResult.recordCount,
        employeeCount: uploadResult.employeeCount,
        periodStart: start,
        periodEnd: end,
      },
    });

    log.info("[datev-online] Payload prepared (API integration pending)", {
      exportJobId: exportJob.id,
      records: uploadResult.recordCount,
    });

    return NextResponse.json({
      success: false,
      pending: true,
      message:
        "DATEV-Payload wurde erstellt, aber die API-Verbindung zu DATEV Unternehmen Online " +
        "ist noch nicht konfiguriert. Bitte verwenden Sie den CSV-Export als Alternative.",
      messageEn:
        "DATEV payload was prepared but the API connection to DATEV Unternehmen Online " +
        "is not yet configured. Please use CSV export as an alternative.",
      exportJob: {
        id: exportJob.id,
        format: exportJob.format,
        status: exportJob.status,
      },
      upload: uploadResult,
      payload: datevPayload,
    });
  },
  { idempotent: true },
);

// ─── Build DATEV Unternehmen Online Payload ─────────────────────

interface DatevTimeEntry {
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

function buildDatevOnlinePayload(
  entries: DatevTimeEntry[],
  periodStart: string,
  periodEnd: string,
) {
  // DATEV Lohn & Gehalt record format
  const records = entries.map((e) => ({
    personalnummer: e.employee.id.slice(-6),
    nachname: e.employee.lastName,
    vorname: e.employee.firstName,
    datum: formatDateISO(e.date),
    beginn: e.startTime,
    ende: e.endTime,
    pauseMinuten: e.breakMinutes,
    bruttoStunden: Number(toIndustrialHours(e.grossMinutes).toFixed(2)),
    nettoStunden: Number(toIndustrialHours(e.netMinutes).toFixed(2)),
    standort: e.location?.name || "",
    lohnart: "1000", // Standard hourly rate code
  }));

  // Aggregate by employee for summary
  const empMap = new Map<
    string,
    {
      personalnummer: string;
      name: string;
      position: string | null;
      totalBrutto: number;
      totalNetto: number;
      totalPause: number;
      tage: number;
    }
  >();

  for (const r of records) {
    const key = r.personalnummer;
    if (!empMap.has(key)) {
      empMap.set(key, {
        personalnummer: key,
        name: `${r.nachname}, ${r.vorname}`,
        position:
          entries.find((e) => e.employee.id.slice(-6) === key)?.employee
            .position ?? null,
        totalBrutto: 0,
        totalNetto: 0,
        totalPause: 0,
        tage: 0,
      });
    }
    const agg = empMap.get(key)!;
    agg.totalBrutto += r.bruttoStunden;
    agg.totalNetto += r.nettoStunden;
    agg.totalPause += r.pauseMinuten;
    agg.tage += 1;
  }

  return {
    format: "DATEV_LODAS",
    version: "1.0",
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date().toISOString(),
    records,
    employeeSummary: Array.from(empMap.values()),
  };
}

function formatDateISO(date: Date): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}
