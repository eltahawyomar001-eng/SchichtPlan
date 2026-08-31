/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/db";
import { requireAuth, notFound } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/compliance/dossier/[id]/pdf
 *
 * The FKS (Finanzkontrolle Schwarzarbeit) export.
 *
 * The dashboard previously offered only window.print(), which produces a
 * browser-dependent document with page chrome. An auditor arriving unannounced
 * needs one stable, self-contained artifact, which is what this generates.
 *
 * Deliberately NOT behind the PDF quota or a plan-feature gate: an FKS audit is
 * unannounced and the employer is legally obliged to produce records on the
 * spot. Refusing because a monthly counter ran out would turn a billing limit
 * into a legal problem for the customer.
 *
 * Sections, in the order an auditor works through them:
 *   1. Tamper-evidence fingerprint + period + score
 *   2. Working time: PLANNED vs ACTUAL (TimeEntry), MiLoG wage check
 *   3. OCR source documents (TimesheetImport.documentRef)
 *   4. §34a GewO / Bewacherregister status per guard
 *   5. Geofence check-in evidence (distance per punch)
 *   6. Released compliance blocks (ComplianceOverride)
 */

const EMERALD: [number, number, number] = [5, 150, 105];
const AMBER: [number, number, number] = [217, 119, 6];
const RED: [number, number, number] = [220, 38, 38];
const SLATE: [number, number, number] = [51, 65, 85];

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
const fmtMinutes = (m: number) =>
  `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")} h`;

/** German labels for the rules an override can release. */
const RULE_LABEL: Record<string, string> = {
  ARBZG_3: "ArbZG §3 (Höchstarbeitszeit)",
  ARBZG_4: "ArbZG §4 (Pause)",
  ARBZG_5: "ArbZG §5 (Ruhezeit)",
  SACHKUNDE_34A: "§34a GewO (Sachkunde)",
  GEOFENCE: "Geofence (Standort)",
};

const REGISTER_LABEL: Record<string, string> = {
  ANGEMELDET: "Angemeldet (Prüfung läuft)",
  GEPRUEFT: "Geprüft",
  ABGELEHNT: "Abgelehnt",
  ABGEMELDET: "Abgemeldet",
};

export const GET = withRoute(
  "/api/compliance/dossier/[id]/pdf",
  "GET",
  async (_req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const dossier = await prisma.auditDossier.findFirst({
      where: { id, workspaceId },
    });
    if (!dossier) return notFound("Dossier nicht gefunden");

    const periodStart = new Date(dossier.periodStart);
    const periodEnd = new Date(dossier.periodEnd);
    const periodEndInclusive = new Date(periodEnd);
    periodEndInclusive.setHours(23, 59, 59, 999);

    const snapshot = (dossier.snapshot ?? {}) as any;

    /* ── Gather everything the snapshot does not already hold ──
       The snapshot was frozen from PLANNED shifts. An FKS auditor asks about
       hours ACTUALLY worked, so the time entries, their geofence evidence, the
       OCR provenance and the register status are read live and cross-
       referenced against it. */
    const [workspace, timeEntries, imports, employees, overrides] =
      await Promise.all([
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            name: true,
            betriebsnummer: true,
            minHourlyWageCents: true,
            securitySectorMode: true,
          },
        }),
        prisma.timeEntry.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            date: { gte: periodStart, lte: periodEnd },
          },
          select: {
            date: true,
            startTime: true,
            endTime: true,
            netMinutes: true,
            breakMinutes: true,
            status: true,
            checkInDistanceM: true,
            checkInAccuracyM: true,
            geofenceStatus: true,
            locationMocked: true,
            geofenceOverrideReason: true,
            employee: { select: { firstName: true, lastName: true } },
            location: { select: { name: true, geofenceRadiusMeters: true } },
          },
          orderBy: [{ date: "asc" }],
        }),
        prisma.timesheetImport.findMany({
          where: {
            workspaceId,
            importedAt: { gte: periodStart, lte: periodEndInclusive },
          },
          select: {
            id: true,
            status: true,
            source: true,
            documentRef: true,
            importedAt: true,
            reviewedAt: true,
            importedBy: { select: { name: true, email: true } },
            _count: { select: { entries: true } },
          },
          orderBy: { importedAt: "asc" },
        }),
        prisma.employee.findMany({
          where: { workspaceId, isActive: true, deletedAt: null },
          select: {
            firstName: true,
            lastName: true,
            hourlyRate: true,
            bewacherId: true,
            bewacherRegisterStatus: true,
            bewacherValidatedAt: true,
            reliabilityCheckedAt: true,
            employeeSkills: {
              select: {
                expiresAt: true,
                certificateNumber: true,
                skill: { select: { name: true } },
              },
            },
          },
          orderBy: { lastName: "asc" },
        }),
        prisma.complianceOverride.findMany({
          where: {
            workspaceId,
            overriddenAt: { gte: periodStart, lte: periodEndInclusive },
          },
          orderBy: { overriddenAt: "asc" },
        }),
      ]);

    // Resolve the managers named on the overrides.
    const overrideUserIds = [...new Set(overrides.map((o) => o.overriddenBy))];
    const overrideUsers = overrideUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: overrideUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(overrideUsers.map((u) => [u.id, u]));

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const MARGIN = 14;
    let y = MARGIN;

    /* ══ 1. Header + tamper-evidence fingerprint ══ */
    doc.setFontSize(17);
    doc.setTextColor(...SLATE);
    doc.text("Prüfdossier: Finanzkontrolle Schwarzarbeit (FKS)", MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(
      `${workspace?.name ?? "—"}${
        workspace?.betriebsnummer
          ? `  ·  Betriebsnummer ${workspace.betriebsnummer}`
          : ""
      }`,
      MARGIN,
      y,
    );
    y += 5;
    doc.text(
      `Prüfzeitraum: ${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`,
      MARGIN,
      y,
    );
    y += 5;
    doc.text(
      `Dossier erstellt am: ${fmtDateTime(dossier.generatedAt)}  ·  Export: ${fmtDateTime(new Date())}`,
      MARGIN,
      y,
    );
    y += 7;

    // The fingerprint is the whole point of a frozen dossier: it proves this
    // document reports the snapshot taken at generation time and not a later
    // edit. Printed in full, in monospace, so it can be compared by eye.
    doc.setDrawColor(...EMERALD);
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 18, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...EMERALD);
    doc.text(
      "SHA-256 MANIPULATIONSSCHUTZ (Fingerabdruck des Snapshots)",
      MARGIN + 3,
      y + 5,
    );
    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    // 64 hex chars do not fit one A4 line at this size — split deterministically.
    doc.text(dossier.contentHash.slice(0, 32), MARGIN + 3, y + 10.5);
    doc.text(dossier.contentHash.slice(32), MARGIN + 3, y + 15);
    doc.setFont("helvetica", "normal");
    y += 24;

    // Score band
    const score = dossier.readinessScore;
    const scoreColor = score >= 90 ? EMERALD : score >= 70 ? AMBER : RED;
    doc.setFontSize(11);
    doc.setTextColor(...scoreColor);
    doc.text(
      `Prüfbereitschaft: ${score}%   ·   Bestanden: ${dossier.passCount}   ·   Hinweise: ${dossier.warnCount}   ·   Verstöße: ${dossier.failCount}`,
      MARGIN,
      y,
    );
    y += 8;
    doc.setTextColor(...SLATE);

    /* ══ 2. Working time: planned vs actual ══ */
    const plannedByEmployee = new Map<string, number>();
    for (const s of snapshot.employeeSummaries ?? []) {
      const name = String(s.name ?? "—");
      plannedByEmployee.set(name, Number(s.netMinutes ?? s.totalMinutes ?? 0));
    }

    const actualByEmployee = new Map<
      string,
      { minutes: number; days: number }
    >();
    for (const te of timeEntries) {
      const name = te.employee
        ? `${te.employee.firstName} ${te.employee.lastName}`
        : "—";
      const cur = actualByEmployee.get(name) ?? { minutes: 0, days: 0 };
      cur.minutes += te.netMinutes ?? 0;
      cur.days += 1;
      actualByEmployee.set(name, cur);
    }

    const minWage = (workspace?.minHourlyWageCents ?? 1390) / 100;
    const rateByEmployee = new Map(
      employees.map((e) => [`${e.firstName} ${e.lastName}`, e.hourlyRate]),
    );

    const allNames = [
      ...new Set([...plannedByEmployee.keys(), ...actualByEmployee.keys()]),
    ].sort();

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Mitarbeiter",
          "Geplant",
          "Tatsächlich",
          "Differenz",
          "Tage",
          "Stundenlohn",
          "MiLoG",
        ],
      ],
      body: allNames.map((name) => {
        const planned = plannedByEmployee.get(name) ?? 0;
        const actual = actualByEmployee.get(name);
        const actualMin = actual?.minutes ?? 0;
        const diff = actualMin - planned;
        const rate = rateByEmployee.get(name);
        return [
          name,
          planned ? fmtMinutes(planned) : "—",
          actual ? fmtMinutes(actualMin) : "keine Erfassung",
          planned || actualMin
            ? `${diff >= 0 ? "+" : "-"}${fmtMinutes(Math.abs(diff))}`
            : "—",
          String(actual?.days ?? 0),
          rate != null ? `${rate.toFixed(2)} €` : "—",
          rate == null ? "—" : rate + 1e-9 >= minWage ? "OK" : "UNTERSCHRITTEN",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: EMERALD, fontSize: 8 },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 6) {
          if (data.cell.raw === "UNTERSCHRITTEN") {
            data.cell.styles.textColor = RED;
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.section === "body" && data.column.index === 2) {
          if (data.cell.raw === "keine Erfassung") {
            data.cell.styles.textColor = AMBER;
          }
        }
      },
      willDrawPage: () => {
        doc.setFontSize(11);
        doc.setTextColor(...SLATE);
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(
      `Geplante Zeiten aus dem eingefrorenen Dossier-Snapshot; tatsächliche Zeiten live aus der Zeiterfassung. Mindestlohn-Prüfwert: ${minWage.toFixed(2)} € / Stunde.`,
      MARGIN,
      y,
    );
    y += 8;

    /* ══ 3. OCR source documents ══ */
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text("Herkunftsnachweis der Stundenzettel (OCR-Import)", MARGIN, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Importiert am",
          "Quelle",
          "Status",
          "Zeilen",
          "Importiert von",
          "Dokument-Referenz (SHA-256)",
        ],
      ],
      body: imports.length
        ? imports.map((i) => [
            fmtDateTime(i.importedAt),
            String(i.source),
            String(i.status),
            String(i._count.entries),
            i.importedBy?.name ?? i.importedBy?.email ?? "—",
            i.documentRef,
          ])
        : [
            [
              {
                content:
                  "Im Prüfzeitraum wurden keine Stundenzettel per OCR importiert.",
                colSpan: 6,
                styles: { textColor: 120, halign: "center" as const },
              },
            ],
          ],
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      columnStyles: { 5: { font: "courier", fontSize: 6.5 } },
      headStyles: { fillColor: SLATE, fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(
      "Die Dokument-Referenz ist der SHA-256-Hash des eingescannten Originals. Das Original selbst wird aus Datenschutzgründen (DSGVO Art. 5) nicht gespeichert.",
      MARGIN,
      y,
      { maxWidth: PAGE_W - MARGIN * 2 },
    );
    y += 8;

    /* ══ 4. §34a GewO / Bewacherregister ══ */
    doc.addPage();
    y = MARGIN;
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text("§34a GewO: Sachkunde und Bewacherregister", MARGIN, y);
    y += 3;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Mitarbeiter",
          "Bewacher-ID",
          "Registerstatus",
          "Register geprüft",
          "Zuverlässigkeit",
          "§34a-Qualifikation",
          "Gültig bis",
        ],
      ],
      body: employees.map((e) => {
        const cert = e.employeeSkills.find((s) =>
          /34a|sachkunde|unterrichtung|bewacher/i.test(s.skill.name),
        );
        const expired = cert?.expiresAt
          ? new Date(cert.expiresAt) < today
          : false;
        return [
          `${e.firstName} ${e.lastName}`,
          e.bewacherId ?? "FEHLT",
          e.bewacherRegisterStatus
            ? (REGISTER_LABEL[e.bewacherRegisterStatus] ??
              e.bewacherRegisterStatus)
            : "FEHLT",
          e.bewacherValidatedAt ? fmtDate(e.bewacherValidatedAt) : "—",
          e.reliabilityCheckedAt ? fmtDate(e.reliabilityCheckedAt) : "—",
          cert ? cert.skill.name : "FEHLT",
          cert?.expiresAt
            ? `${fmtDate(cert.expiresAt)}${expired ? " (ABGELAUFEN)" : ""}`
            : cert
              ? "unbefristet"
              : "—",
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: EMERALD, fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const v = String(data.cell.raw ?? "");
        if (v === "FEHLT" || v.includes("ABGELAUFEN") || v === "Abgelehnt") {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = "bold";
        } else if (v.startsWith("Angemeldet")) {
          data.cell.styles.textColor = AMBER;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(
      workspace?.securitySectorMode
        ? "Sicherheitsgewerbe-Modus aktiv: §34a wird für jede Schicht erzwungen, unabhängig von objektspezifischen Anforderungen."
        : "Hinweis: Sicherheitsgewerbe-Modus ist NICHT aktiv. §34a wird nur dort geprüft, wo für das Objekt eine Qualifikation hinterlegt ist.",
      MARGIN,
      y,
      { maxWidth: PAGE_W - MARGIN * 2 },
    );
    y += 9;

    /* ══ 5. Geofence check-in evidence ══ */
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text("Standortnachweis der Stempelungen (Geofence)", MARGIN, y);
    y += 3;

    const geoEntries = timeEntries.filter(
      (te) => te.geofenceStatus !== null || te.checkInDistanceM !== null,
    );

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Datum",
          "Mitarbeiter",
          "Objekt",
          "Beginn",
          "Entfernung",
          "Radius",
          "Genauigkeit",
          "Status",
        ],
      ],
      body: geoEntries.length
        ? geoEntries.map((te) => [
            fmtDate(te.date),
            te.employee
              ? `${te.employee.firstName} ${te.employee.lastName}`
              : "—",
            te.location?.name ?? "—",
            te.startTime,
            te.checkInDistanceM != null
              ? `${Math.round(te.checkInDistanceM)} m`
              : "—",
            te.location?.geofenceRadiusMeters != null
              ? `${te.location.geofenceRadiusMeters} m`
              : "—",
            te.checkInAccuracyM != null
              ? `±${Math.round(te.checkInAccuracyM)} m`
              : "—",
            te.locationMocked ? "SIMULIERT" : (te.geofenceStatus ?? "—"),
          ])
        : [
            [
              {
                content:
                  "Für den Prüfzeitraum liegen keine Standortdaten vor. Der Geofence wurde für die betroffenen Objekte nicht aktiviert.",
                colSpan: 8,
                styles: { textColor: 120, halign: "center" as const },
              },
            ],
          ],
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: SLATE, fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const v = String(data.cell.raw ?? "");
        if (v === "SIMULIERT" || v === "OUTSIDE") {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = "bold";
        } else if (v === "UNAVAILABLE" || v === "OVERRIDDEN") {
          data.cell.styles.textColor = AMBER;
        } else if (v === "INSIDE") {
          data.cell.styles.textColor = EMERALD;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 9;

    /* ══ 6. Released compliance blocks ══ */
    if (y > 230) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text("Aufgehobene Compliance-Sperren", MARGIN, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [
        ["Zeitpunkt", "Regel", "Betrifft", "Freigegeben von", "Begründung"],
      ],
      body: overrides.length
        ? overrides.map((o) => {
            const actor = userById.get(o.overriddenBy);
            return [
              fmtDateTime(o.overriddenAt),
              RULE_LABEL[o.rule] ?? o.rule,
              `${o.entityType} ${o.entityId.slice(0, 8)}`,
              actor?.name ?? actor?.email ?? o.overriddenBy,
              o.reason,
            ];
          })
        : [
            [
              {
                content:
                  "Im Prüfzeitraum wurde keine Compliance-Sperre aufgehoben.",
                colSpan: 5,
                styles: { textColor: 120, halign: "center" as const },
              },
            ],
          ],
      styles: { fontSize: 7.5, cellPadding: 1.5, valign: "top" as const },
      headStyles: {
        fillColor: overrides.length ? AMBER : SLATE,
        fontSize: 7.5,
      },
      columnStyles: { 4: { cellWidth: 60 } },
      margin: { left: MARGIN, right: MARGIN },
    });

    /* ══ Footer on every page ══ */
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(6.5);
      doc.setTextColor(140);
      doc.text(
        `Shiftfy Prüfdossier · ${workspace?.name ?? ""} · Fingerabdruck ${dossier.contentHash.slice(0, 16)}…`,
        MARGIN,
        h - 8,
      );
      doc.text(`Seite ${p} / ${pageCount}`, PAGE_W - MARGIN, h - 8, {
        align: "right",
      });
    }

    const buffer = doc.output("arraybuffer") as ArrayBuffer;
    const filename = `FKS-Pruefdossier_${fmtDate(periodStart).replace(/\./g, "-")}_${fmtDate(
      periodEnd,
    ).replace(/\./g, "-")}.pdf`;

    createAuditLog({
      // The AuditAction enum has no EXPORT member; ARCHIVE is the closest
      // existing value and `metadata.format` disambiguates it. Adding an enum
      // member would need its own migration for one log line.
      action: "ARCHIVE",
      entityType: "AuditDossier",
      entityId: dossier.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: { format: "pdf", contentHash: dossier.contentHash },
    });

    log.info("[dossier] FKS PDF generated", {
      dossierId: dossier.id,
      workspaceId,
      timeEntries: timeEntries.length,
      overrides: overrides.length,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
