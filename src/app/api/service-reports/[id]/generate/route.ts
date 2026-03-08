/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requirePdfQuota, recordPdfGeneration } from "@/lib/subscription-guard";
import { createAuditLog } from "@/lib/audit";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { log } from "@/lib/logger";

/**
 * POST /api/service-reports/[id]/generate
 *
 * Generates a Sammel-Leistungsnachweis (consolidated proof-of-service) PDF
 * for a given ServiceReport. Groups visits by location (Standort/Filiale),
 * includes GPS proof, timestamps, and embedded signature images.
 *
 * This is the core billing document for Facility Management / Reinigung
 * companies — it proves which services were rendered, when, and who signed off.
 *
 * The generated PDF is returned as a binary download. The report status
 * is updated to ERSTELLT and generatedAt is set.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reportId } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-reports", "update");
    if (forbidden) return forbidden;

    // Check PDF monthly quota
    const pdfLimit = await requirePdfQuota(workspaceId);
    if (pdfLimit) return pdfLimit;

    // ── Fetch report with all linked visits ──

    const report = await prisma.serviceReport.findFirst({
      where: { id: reportId, workspaceId },
      include: {
        visits: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true },
            },
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
              },
            },
            signature: true,
          },
          orderBy: { scheduledDate: "asc" },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!report.visits || report.visits.length === 0) {
      return NextResponse.json(
        { error: "Keine Besuche für diesen Bericht vorhanden" },
        { status: 400 },
      );
    }

    // ── Group visits by location ──
    const visitsByLocation = new Map<
      string,
      {
        locationName: string;
        locationAddress: string;
        locationLat: number | null;
        locationLng: number | null;
        visits: typeof report.visits;
      }
    >();

    for (const visit of report.visits) {
      const locId = visit.locationId;
      if (!visitsByLocation.has(locId)) {
        visitsByLocation.set(locId, {
          locationName: visit.location?.name ?? "Unbekannt",
          locationAddress: visit.location?.address ?? "",
          locationLat: visit.location?.latitude ?? null,
          locationLng: visit.location?.longitude ?? null,
          visits: [],
        });
      }
      visitsByLocation.get(locId)!.visits.push(visit);
    }

    // ── Fetch workspace info ──

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId },
      select: { name: true },
    });

    // ── Generate PDF ──
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();

    // ── Cover Page ──
    doc.setFontSize(20);
    doc.text("Sammel-Leistungsnachweis", 14, 25);

    doc.setFontSize(11);
    doc.text(`Unternehmen: ${workspace?.name || "-"}`, 14, 38);
    doc.text(`Bericht: ${report.title}`, 14, 45);

    const periodStart = new Date(report.periodStart).toLocaleDateString(
      "de-DE",
    );
    const periodEnd = new Date(report.periodEnd).toLocaleDateString("de-DE");
    doc.text(`Zeitraum: ${periodStart} – ${periodEnd}`, 14, 52);
    doc.text(`Standorte: ${visitsByLocation.size}`, 14, 59);
    doc.text(`Besuche gesamt: ${report.visits.length}`, 14, 66);

    const completedCount = report.visits.filter(
      (v: any) => v.status === "ABGESCHLOSSEN",
    ).length;
    doc.text(`Abgeschlossen: ${completedCount}`, 14, 73);

    // Generation timestamp
    const now = new Date();
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Erstellt am: ${now.toLocaleDateString("de-DE")} um ${now.toLocaleTimeString("de-DE")}`,
      14,
      82,
    );
    doc.setTextColor(0, 0, 0);

    // Divider
    doc.setDrawColor(5, 150, 105); // emerald-600
    doc.setLineWidth(0.5);
    doc.line(14, 86, pageWidth - 14, 86);

    // ── Summary table (all locations) ──
    const summaryRows: string[][] = [];
    let totalIdx = 1;
    for (const [, group] of visitsByLocation) {
      const groupCompleted = group.visits.filter(
        (v: any) => v.status === "ABGESCHLOSSEN",
      ).length;
      const groupSigned = group.visits.filter((v: any) => v.signature).length;
      summaryRows.push([
        String(totalIdx++),
        group.locationName,
        group.locationAddress,
        String(group.visits.length),
        String(groupCompleted),
        String(groupSigned),
      ]);
    }

    autoTable(doc, {
      head: [
        ["#", "Standort", "Adresse", "Besuche", "Abgeschl.", "Unterschriften"],
      ],
      body: summaryRows,
      startY: 92,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105] },
      columnStyles: {
        0: { cellWidth: 10 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 28, halign: "center" },
      },
    });

    // ── Per-Location Detail Pages ──
    let locationIdx = 0;
    for (const [, group] of visitsByLocation) {
      locationIdx++;
      doc.addPage();

      // Location header
      doc.setFontSize(14);
      doc.text(`Standort ${locationIdx}: ${group.locationName}`, 14, 18);

      doc.setFontSize(9);
      doc.text(`Adresse: ${group.locationAddress}`, 14, 26);

      if (group.locationLat && group.locationLng) {
        doc.text(
          `GPS: ${group.locationLat.toFixed(6)}, ${group.locationLng.toFixed(6)}`,
          14,
          32,
        );
      }

      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(0.3);
      doc.line(14, 35, pageWidth - 14, 35);

      // Visit detail table
      const rows: (string | number)[][] = [];
      for (const visit of group.visits) {
        const employeeName = visit.employee
          ? `${visit.employee.firstName} ${visit.employee.lastName}`
          : "-";
        const date = new Date(visit.scheduledDate).toLocaleDateString("de-DE");
        const status = translateStatus(visit.status);
        const checkIn = visit.checkInAt
          ? new Date(visit.checkInAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";
        const checkOut = visit.checkOutAt
          ? new Date(visit.checkOutAt).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";
        const duration = computeDuration(visit.checkInAt, visit.checkOutAt);
        const signed = visit.signature ? "✓" : "-";
        const fence = visit.checkInWithinFence ? "✓" : "✗";

        rows.push([
          date,
          employeeName,
          checkIn,
          checkOut,
          duration,
          fence,
          signed,
          status,
        ]);
      }

      autoTable(doc, {
        head: [
          [
            "Datum",
            "Mitarbeiter",
            "Check-in",
            "Check-out",
            "Dauer",
            "Geofence",
            "Signiert",
            "Status",
          ],
        ],
        body: rows,
        startY: 39,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [5, 150, 105] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 32 },
          4: { cellWidth: 18 },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 16, halign: "center" },
          7: { cellWidth: 24 },
        },
      });

      // ── GPS Proof Section ──
      let currentY = doc.lastAutoTable?.finalY ?? 120;
      const gpsProofVisits = group.visits.filter(
        (v: any) => v.checkInLat && v.checkInLng && v.checkInAt,
      );

      if (gpsProofVisits.length > 0) {
        currentY += 8;
        if (currentY > 260) {
          doc.addPage();
          currentY = 18;
        }

        doc.setFontSize(10);
        doc.text("GPS-Nachweis (Check-in Koordinaten)", 14, currentY);
        currentY += 5;

        const gpsRows: string[][] = [];
        for (const visit of gpsProofVisits) {
          const date = new Date(visit.scheduledDate).toLocaleDateString(
            "de-DE",
          );
          const checkInTime = new Date(visit.checkInAt!).toLocaleTimeString(
            "de-DE",
            { hour: "2-digit", minute: "2-digit", second: "2-digit" },
          );
          gpsRows.push([
            date,
            checkInTime,
            visit.checkInLat?.toFixed(6) ?? "-",
            visit.checkInLng?.toFixed(6) ?? "-",
            visit.checkInWithinFence ? "Innerhalb" : "Außerhalb",
          ]);
        }

        autoTable(doc, {
          head: [["Datum", "Uhrzeit", "Breitengrad", "Längengrad", "Geofence"]],
          body: gpsRows,
          startY: currentY,
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [80, 80, 80] },
        });

        currentY = doc.lastAutoTable?.finalY ?? currentY + 20;
      }

      // ── Signature Section ──
      const signedVisits = group.visits.filter((v: any) => v.signature);

      if (signedVisits.length > 0) {
        currentY += 8;
        if (currentY > 220) {
          doc.addPage();
          currentY = 18;
        }

        doc.setFontSize(10);
        doc.text("Unterschriften", 14, currentY);
        currentY += 6;

        for (const visit of signedVisits) {
          if (currentY > 240) {
            doc.addPage();
            currentY = 18;
          }

          const sig = visit.signature!;
          const date = new Date(visit.scheduledDate).toLocaleDateString(
            "de-DE",
          );

          doc.setFontSize(8);
          doc.text(
            `${date} — ${sig.signerName}${sig.signerRole ? ` (${sig.signerRole})` : ""}`,
            14,
            currentY,
          );
          currentY += 3;

          // Embed signature image
          if (sig.signatureData) {
            try {
              // signatureData is base64 PNG, possibly with data: prefix
              let imgData = sig.signatureData;
              if (!imgData.startsWith("data:")) {
                imgData = `data:image/png;base64,${imgData}`;
              }
              doc.addImage(imgData, "PNG", 14, currentY, 50, 18);
              currentY += 20;
            } catch {
              doc.setFontSize(7);
              doc.text(
                "[Signatur konnte nicht eingebettet werden]",
                14,
                currentY + 5,
              );
              currentY += 8;
            }
          }

          // Signature metadata
          doc.setFontSize(6);
          doc.setTextColor(100, 100, 100);
          const signedAt = new Date(sig.signedAt).toLocaleString("de-DE");
          const hashPreview = sig.signatureHash
            ? sig.signatureHash.slice(0, 16) + "…"
            : "-";
          doc.text(
            `Signiert: ${signedAt}  |  GPS: ${sig.signedLat?.toFixed(4) ?? "-"}, ${sig.signedLng?.toFixed(4) ?? "-"}  |  Hash: ${hashPreview}`,
            14,
            currentY,
          );
          doc.setTextColor(0, 0, 0);
          currentY += 6;
        }
      }
    }

    // ── Footer on last page ──
    const lastPageY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      "Dieses Dokument wurde automatisch generiert und dient als Leistungsnachweis.",
      14,
      lastPageY,
    );
    doc.text(
      `Bericht-ID: ${reportId}  |  Erstellt: ${now.toISOString()}`,
      14,
      lastPageY + 4,
    );
    doc.setTextColor(0, 0, 0);

    // ── Export PDF buffer ──
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // ── Update report status ──

    await prisma.serviceReport.update({
      where: { id: reportId },
      data: {
        status: "ERSTELLT",
        generatedAt: now,
        completedVisits: completedCount,
        totalVisits: report.visits.length,
      },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "service-report",
      entityId: reportId,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      metadata: {
        action: "generate-pdf",
        totalVisits: report.visits.length,
        completedVisits: completedCount,
        locations: visitsByLocation.size,
      },
    });

    log.info("[service-reports] PDF generated", {
      reportId,
      pages: doc.getNumberOfPages(),
      sizeBytes: pdfBuffer.length,
    });

    // Record PDF generation against monthly quota
    await recordPdfGeneration(workspaceId);

    // ── Return PDF as download ──
    const filename = `Leistungsnachweis_${report.title.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "_")}_${periodStart}-${periodEnd}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    log.error("Error generating service report PDF:", { error });
    return NextResponse.json(
      { error: "Fehler beim Erstellen des PDF" },
      { status: 500 },
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    GEPLANT: "Geplant",
    EINGECHECKT: "Eingecheckt",
    ABGESCHLOSSEN: "Abgeschlossen",
    STORNIERT: "Storniert",
  };
  return map[status] || status;
}

function computeDuration(
  checkIn: string | Date | null,
  checkOut: string | Date | null,
): string {
  if (!checkIn || !checkOut) return "-";
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return "-";
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}:${String(mins).padStart(2, "0")} h`;
}
