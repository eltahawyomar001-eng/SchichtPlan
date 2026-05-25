import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toIndustrialHours, toPersonnelNumber } from "@/lib/time-utils";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { createAuditLog } from "@/lib/audit";
import { datevExportSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import {
  uploadPayrollToDatev,
  isDatevConfigured,
} from "@/lib/integrations/datev-online";

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

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(datevExportSchema, _json.data);
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

    // Try to upload to DATEV. If credentials are not configured, the helper
    // returns { skipped: true } and we fall back to the "payload prepared"
    // response so the CSV export still works as an alternative.
    const uploadResult = await uploadPayrollToDatev({
      format: datevPayload.format,
      period: datevPayload.period,
      records: datevPayload.records as unknown as Record<string, unknown>[],
      employeeSummary: datevPayload.employeeSummary as unknown as Record<
        string,
        unknown
      >[],
    });

    const exportJobStatus = uploadResult.success
      ? "COMPLETED"
      : uploadResult.skipped
        ? "PENDING"
        : "FAILED";

    const exportJob = await prisma.exportJob.create({
      data: {
        format: "DATEV_ONLINE",
        fileName: `datev_online_${start}_${end}`,
        status: exportJobStatus,
        ...(monthCloseId ? { monthCloseId } : {}),
        workspaceId,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "DATEVOnlineExport",
      entityId: exportJob.id,
      userId: user.id,
      userEmail: user.email!,
      workspaceId,
      metadata: {
        datevReference: uploadResult.datevReference ?? null,
        recordCount: datevPayload.records.length,
        employeeCount: datevPayload.employeeSummary.length,
        periodStart: start,
        periodEnd: end,
        uploadStatus: uploadResult.status ?? exportJobStatus,
      },
    });

    if (uploadResult.success) {
      log.info("[datev-online] Upload accepted by DATEV", {
        exportJobId: exportJob.id,
        datevReference: uploadResult.datevReference,
        records: datevPayload.records.length,
      });
      return NextResponse.json({
        success: true,
        message:
          "DATEV-Upload erfolgreich an DATEV Unternehmen Online übermittelt.",
        messageEn: "Payroll successfully uploaded to DATEV Unternehmen Online.",
        exportJob: {
          id: exportJob.id,
          format: exportJob.format,
          status: exportJob.status,
        },
        datevReference: uploadResult.datevReference,
      });
    }

    if (uploadResult.skipped) {
      log.info("[datev-online] Payload prepared — DATEV credentials missing", {
        exportJobId: exportJob.id,
        records: datevPayload.records.length,
      });
      return NextResponse.json({
        success: false,
        pending: true,
        configured: isDatevConfigured(),
        message:
          "DATEV-Payload wurde erstellt, aber die API-Zugangsdaten für DATEV Unternehmen Online " +
          "sind im Workspace nicht hinterlegt. Bitte verwenden Sie den CSV-Export als Alternative.",
        messageEn:
          "DATEV payload was prepared but no DATEV credentials are configured for this workspace. " +
          "Please use CSV export as an alternative.",
        exportJob: {
          id: exportJob.id,
          format: exportJob.format,
          status: exportJob.status,
        },
        payload: datevPayload,
      });
    }

    // Hard failure (4xx/5xx from DATEV)
    log.error("[datev-online] Upload failed", {
      exportJobId: exportJob.id,
      reason: uploadResult.reason,
      httpStatus: uploadResult.httpStatus,
    });
    return NextResponse.json(
      {
        success: false,
        error: "DATEV_UPLOAD_FAILED",
        reason: uploadResult.reason,
        httpStatus: uploadResult.httpStatus,
        message:
          "Upload an DATEV Unternehmen Online fehlgeschlagen. Bitte CSV-Export verwenden " +
          "oder Administrator kontaktieren.",
        messageEn:
          "Upload to DATEV Unternehmen Online failed. Please use CSV export or contact your administrator.",
        exportJob: {
          id: exportJob.id,
          format: exportJob.format,
          status: exportJob.status,
        },
      },
      { status: 502 },
    );
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
    contractType: string | null;
  };
  location: { name: string } | null;
}

function buildDatevOnlinePayload(
  entries: DatevTimeEntry[],
  periodStart: string,
  periodEnd: string,
) {
  // DATEV LODAS Lohnart codes by contract type.
  // These are the standard LODAS defaults — a workspace may override them
  // via a future datevLohnartCode field on the Employee model if their
  // Steuerberater uses a different chart-of-accounts setup.
  //
  // 1000 — Laufender Arbeitslohn (VOLLZEIT, TEILZEIT, MIDIJOB)
  // 1400 — Geringfügig Beschäftigte, lfd. Bezüge (MINIJOB / § 8 SGB IV)
  function lohnartForContract(contractType: string | null): string {
    switch (contractType) {
      case "MINIJOB":
        return "1400";
      default:
        return "1000";
    }
  }

  // DATEV Lohn & Gehalt record format
  const records = entries.map((e) => ({
    personalnummer: toPersonnelNumber(e.employee.id),
    nachname: e.employee.lastName,
    vorname: e.employee.firstName,
    datum: formatDateISO(e.date),
    beginn: e.startTime,
    ende: e.endTime,
    pauseMinuten: e.breakMinutes,
    bruttoStunden: Number(toIndustrialHours(e.grossMinutes).toFixed(2)),
    nettoStunden: Number(toIndustrialHours(e.netMinutes).toFixed(2)),
    standort: e.location?.name || "",
    lohnart: lohnartForContract(e.employee.contractType ?? null),
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
          entries.find((e) => toPersonnelNumber(e.employee.id) === key)
            ?.employee.position ?? null,
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
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Europe/Berlin",
  });
}
