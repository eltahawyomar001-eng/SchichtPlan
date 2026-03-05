/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { log } from "@/lib/logger";
import { fetchStaticMapImage } from "@/lib/static-map";

// Suppress unused import warning — autoTable attaches to jsPDF prototype
void autoTable;

// ── Brand colour palette (RGB tuples) ──
const EMERALD = [5, 150, 105] as const;
const DARK = [55, 65, 81] as const;
const MED = [107, 114, 128] as const;
const LGREY = [243, 244, 246] as const;
const BGREY = [209, 213, 219] as const;
const W = [255, 255, 255] as const;

/**
 * GET /api/service-visits/[id]/pdf
 *
 * Generates an audit-ready single-visit Leistungsnachweis PDF.
 *
 * Sections:
 * 1. Two-column header — logo placeholder, "LEISTUNGSNACHWEIS" title, QR code
 * 2. Company & visit metadata with status badge
 * 3. Time tracking table + timeline bar + geofence badge
 * 4. GPS evidence block with coordinates + static map image
 * 5. Certificate of Acceptance — framed signature with signer details
 * 6. Digital Integrity Certificate — SHA-256, server timestamp, device ID
 * 7. Legal disclaimer footer
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "service-visits", "read");
    if (forbidden) return forbidden;

    const where: Record<string, unknown> = { id, workspaceId };
    if (isEmployee(user) && user.employeeId) {
      where.employeeId = user.employeeId;
    }

    const visit = await prisma.serviceVisit.findFirst({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true } },
        location: {
          select: {
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        signature: true,
        visitAuditLogs: {
          orderBy: { serverTimestamp: "asc" },
          take: 5,
          select: {
            eventType: true,
            serverTimestamp: true,
            deviceId: true,
            gpsLat: true,
            gpsLng: true,
          },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (visit.status !== "ABGESCHLOSSEN") {
      return NextResponse.json(
        { error: "PDF kann nur für abgeschlossene Einsätze erstellt werden" },
        { status: 400 },
      );
    }

    // ── Fetch workspace name ──
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    // ── Pre-fetch async assets in parallel ──
    const now = new Date();
    const auditId = `LN-${visit.id.slice(-8).toUpperCase()}-${now.getFullYear()}`;

    const [qrDataUrl, mapImage] = await Promise.all([
      QRCode.toDataURL(
        JSON.stringify({ auditId, visitId: visit.id, ts: now.toISOString() }),
        { width: 200, margin: 1, errorCorrectionLevel: "M" },
      ).catch(() => null),
      visit.checkInLat && visit.checkInLng
        ? fetchStaticMapImage(visit.checkInLat, visit.checkInLng, 15, 300, 150)
        : Promise.resolve(null),
    ]);

    // ── Computed values ──
    const employeeName = `${visit.employee.firstName} ${visit.employee.lastName}`;
    const visitDate = new Date(visit.scheduledDate).toLocaleDateString(
      "de-DE",
      { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" },
    );

    const checkIn = visit.checkInAt
      ? new Date(visit.checkInAt).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";
    const checkOut = visit.checkOutAt
      ? new Date(visit.checkOutAt).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";

    let durationMins = 0;
    let durationLabel = "—";
    if (visit.checkInAt && visit.checkOutAt) {
      const diffMs =
        new Date(visit.checkOutAt).getTime() -
        new Date(visit.checkInAt).getTime();
      durationMins = Math.round(diffMs / 60000);
      const hours = Math.floor(durationMins / 60);
      const rem = durationMins % 60;
      durationLabel = hours > 0 ? `${hours}h ${rem}min` : `${rem}min`;
    }

    // Device ID from audit trail
    const deviceId =
      visit.visitAuditLogs?.find((l: any) => l.deviceId)?.deviceId ?? "—";

    // ══════════════════════════════════════════════════════════════
    //  PDF GENERATION
    // ══════════════════════════════════════════════════════════════
    const doc = new jsPDF() as any;
    const pw = doc.internal.pageSize.getWidth(); // 210 mm
    const ph = doc.internal.pageSize.getHeight(); // 297 mm
    const ml = 14;
    const mr = 14;
    const cw = pw - ml - mr; // content width
    void durationMins;
    void ph;

    // ─── 1. HEADER — Logo + Title (left) · Audit-ID + QR (right) ───

    // Logo placeholder
    doc.setDrawColor(...BGREY);
    doc.setFillColor(...LGREY);
    doc.roundedRect(ml, 10, 30, 12, 1.5, 1.5, "FD");
    doc.setFontSize(6);
    doc.setTextColor(...MED);
    doc.text("FIRMENLOGO", ml + 15, 17.5, { align: "center" });

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("LEISTUNGSNACHWEIS", ml + 34, 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MED);
    doc.text("Einzelnachweis — Proof of Service", ml + 34, 21);

    // Audit ID (right-aligned)
    const rx = pw - mr;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...EMERALD);
    doc.text(auditId, rx, 12, { align: "right" });

    // QR code
    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, "PNG", rx - 22, 14, 22, 22);
      } catch {
        /* non-critical */
      }
    }

    // Double-line divider
    doc.setDrawColor(...EMERALD);
    doc.setLineWidth(0.8);
    doc.line(ml, 38, pw - mr, 38);
    doc.setDrawColor(...BGREY);
    doc.setLineWidth(0.2);
    doc.line(ml, 38.8, pw - mr, 38.8);

    // ─── 2. METADATA BLOCK ─────────────────────────────────────────
    let y = 46;
    const vx = ml + 30; // value column

    const meta = (label: string, value: string) => {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(`${label}:`, ml, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(value, vx, y);
      y += 6;
    };

    meta("Unternehmen", workspace?.name || "—");
    meta("Standort", visit.location.name);
    if (visit.location.address) meta("Adresse", visit.location.address);
    meta("Datum", visitDate);
    meta("Mitarbeiter", employeeName);

    // Status pill
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Status:", ml, y);
    const st = "ABGESCHLOSSEN";
    const bw = doc.getTextWidth(st) + 6;
    doc.setFillColor(...EMERALD);
    doc.roundedRect(vx - 1, y - 3.5, bw, 5, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...W);
    doc.text(st, vx + 2, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // ─── 3. TIME TRACKING — Table + Timeline Bar ───────────────────
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Zeiterfassung", ml, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Check-in", "Check-out", "Dauer", "Geofence"]],
      body: [
        [
          checkIn,
          checkOut,
          durationLabel,
          visit.checkInWithinFence ? "Innerhalb ✓" : "Außerhalb ✗",
        ],
      ],
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        lineColor: [...BGREY] as any,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [...EMERALD] as any,
        textColor: [...W] as any,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { textColor: [...DARK] as any },
      margin: { left: ml, right: mr },
    });

    y = doc.lastAutoTable?.finalY ?? y + 20;
    y += 3;

    // Timeline bar
    if (visit.checkInAt && visit.checkOutAt) {
      const barW = cw;
      const barH = 6;

      doc.setFillColor(...EMERALD);
      doc.roundedRect(ml, y, barW, barH, 2, 2, "F");

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...W);
      doc.text(checkIn, ml + 2, y + 4);
      doc.text(checkOut, ml + barW - 2, y + 4, { align: "right" });
      doc.setFontSize(7);
      doc.text(durationLabel, ml + barW / 2, y + 4, { align: "center" });
      doc.setTextColor(0, 0, 0);
      y += barH + 4;

      // Geofence badge
      const ft = visit.checkInWithinFence
        ? "● INNERHALB GEOFENCE"
        : "● AUSSERHALB GEOFENCE";
      const fc = visit.checkInWithinFence ? EMERALD : ([220, 38, 38] as const);
      const fw = doc.getTextWidth(ft) + 8;
      doc.setFillColor(...fc);
      doc.roundedRect(ml, y, fw, 5, 1.5, 1.5, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...W);
      doc.text(ft, ml + 3, y + 3.5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    } else {
      y += 5;
    }

    // ─── 4. GPS EVIDENCE BLOCK — Coordinates + Map ─────────────────
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("GPS-Nachweis", ml, y);
    y += 6;

    const gpsRows: string[][] = [];
    if (visit.checkInLat && visit.checkInLng) {
      gpsRows.push([
        "Check-in",
        `${formatDMS(visit.checkInLat, true)},  ${formatDMS(visit.checkInLng, false)}`,
        checkIn,
      ]);
    }
    if (visit.checkOutLat && visit.checkOutLng) {
      gpsRows.push([
        "Check-out",
        `${formatDMS(visit.checkOutLat, true)},  ${formatDMS(visit.checkOutLng, false)}`,
        checkOut,
      ]);
    }
    if (visit.signature?.signedLat && visit.signature?.signedLng) {
      const signedTime = new Date(visit.signature.signedAt).toLocaleTimeString(
        "de-DE",
        { hour: "2-digit", minute: "2-digit", second: "2-digit" },
      );
      gpsRows.push([
        "Unterschrift",
        `${formatDMS(visit.signature.signedLat, true)},  ${formatDMS(visit.signature.signedLng, false)}`,
        signedTime,
      ]);
    }

    // Two-column: GPS table (left) + static map (right)
    const gpsW = mapImage ? cw * 0.55 : cw;
    const mapX = ml + gpsW + 4;
    const mapW = cw - gpsW - 4;

    if (gpsRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Ereignis", "Koordinaten", "Uhrzeit"]],
        body: gpsRows,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          font: "courier",
          lineColor: [...BGREY] as any,
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [...DARK] as any,
          textColor: [...W] as any,
          font: "helvetica",
          fontStyle: "bold",
          fontSize: 7,
        },
        margin: { left: ml, right: mapImage ? pw - ml - gpsW : mr },
      });

      const tableEndY = doc.lastAutoTable?.finalY ?? y + 20;

      // Static map image beside table
      if (mapImage) {
        const mapH = Math.max(tableEndY - y, 25);
        try {
          doc.setDrawColor(...BGREY);
          doc.setLineWidth(0.3);
          doc.rect(mapX, y, mapW, mapH);
          doc.addImage(
            mapImage,
            "PNG",
            mapX + 0.5,
            y + 0.5,
            mapW - 1,
            mapH - 1,
          );
          // "MAP" label
          doc.setFillColor(0, 0, 0);
          doc.rect(mapX, y, 12, 4, "F");
          doc.setFontSize(5.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...W);
          doc.text("MAP", mapX + 1.5, y + 3);
          doc.setTextColor(0, 0, 0);
        } catch {
          /* non-critical */
        }
      }

      y = (doc.lastAutoTable?.finalY ?? y + 20) + 4;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...MED);
      doc.text("Keine GPS-Daten verfügbar", ml, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    y += 6;

    // ─── 5. CERTIFICATE OF ACCEPTANCE — Signature box ──────────────
    if (visit.signature) {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("Abnahmezertifikat", ml, y);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MED);
      doc.text("Certificate of Acceptance", ml + 42, y);
      y += 5;

      // Certificate box
      const cbH = 52;
      doc.setDrawColor(...EMERALD);
      doc.setLineWidth(0.6);
      doc.setFillColor(250, 253, 250);
      doc.roundedRect(ml, y, cw, cbH, 2, 2, "FD");

      const ci = ml + 4;
      let cy = y + 6;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text("Unterzeichner:", ci, cy);
      doc.setFont("helvetica", "normal");
      doc.text(visit.signature.signerName, ci + 28, cy);
      cy += 5;

      if (visit.signature.signerRole) {
        doc.setFont("helvetica", "bold");
        doc.text("Position:", ci, cy);
        doc.setFont("helvetica", "normal");
        doc.text(visit.signature.signerRole, ci + 28, cy);
        cy += 5;
      }

      doc.setFont("helvetica", "bold");
      doc.text("Zeitpunkt:", ci, cy);
      doc.setFont("helvetica", "normal");
      doc.text(
        new Date(visit.signature.signedAt).toLocaleString("de-DE"),
        ci + 28,
        cy,
      );
      cy += 3;

      // Signature image frame
      const siX = ci;
      const siY = cy + 2;
      const siW = cw * 0.45;
      const siH = 26;

      doc.setDrawColor(...BGREY);
      doc.setFillColor(...W);
      doc.setLineWidth(0.3);
      doc.roundedRect(siX, siY, siW, siH, 1, 1, "FD");

      if (visit.signature.signatureData) {
        try {
          doc.addImage(
            visit.signature.signatureData,
            "PNG",
            siX + 2,
            siY + 1,
            siW - 4,
            siH - 2,
          );
        } catch {
          doc.setFontSize(7);
          doc.setTextColor(180, 0, 0);
          doc.text(
            "[Signatur konnte nicht eingebettet werden]",
            siX + 4,
            siY + siH / 2,
          );
        }
      }

      // Label below signature frame
      doc.setFontSize(6);
      doc.setTextColor(...MED);
      doc.text("Handschriftliche Unterschrift", siX, siY + siH + 3);

      // GPS at signing (right half of certificate box)
      if (visit.signature.signedLat && visit.signature.signedLng) {
        const gx = siX + siW + 8;
        let gy = siY + 4;
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text("GPS bei Unterschrift:", gx, gy);
        gy += 4;
        doc.setFont("courier", "normal");
        doc.setFontSize(6.5);
        doc.text(`${visit.signature.signedLat.toFixed(6)}`, gx, gy);
        gy += 3.5;
        doc.text(`${visit.signature.signedLng.toFixed(6)}`, gx, gy);
      }

      doc.setTextColor(0, 0, 0);
      y += cbH + 8;
    }

    // ─── 6. DIGITAL INTEGRITY CERTIFICATE ──────────────────────────
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    const iY = Math.max(y, doc.internal.pageSize.getHeight() - 55);
    const iH = 28;

    doc.setFillColor(...LGREY);
    doc.setDrawColor(...BGREY);
    doc.setLineWidth(0.3);
    doc.roundedRect(ml, iY, cw, iH, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("DIGITALES INTEGRITÄTSZERTIFIKAT", ml + 4, iY + 5);

    let iy = iY + 10;
    const iRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(`${label}:`, ml + 4, iy);
      doc.setFont("courier", "normal");
      doc.text(value, ml + 35, iy);
      iy += 4;
    };

    iRow("SHA-256", visit.signature?.signatureHash ?? "Keine Signatur");
    iRow("Server-Zeitstempel", now.toISOString());
    iRow("Geräte-ID", deviceId);
    iRow("Besuch-ID", visit.id);

    // ─── 7. LEGAL FOOTER ───────────────────────────────────────────
    const fy = iY + iH + 4;

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MED);
    doc.text(
      "Dieses Dokument wurde systemseitig erstellt und ist ohne handschriftliche Unterschrift rechtsverbindlich",
      ml,
      fy,
    );
    doc.text("gemäß den vereinbarten Abrechnungsrichtlinien.", ml, fy + 3);

    // Accent line
    doc.setDrawColor(...EMERALD);
    doc.setLineWidth(0.4);
    doc.line(ml, fy + 6, pw - mr, fy + 6);

    // Generation metadata
    doc.setFontSize(5.5);
    doc.text(
      `Audit-ID: ${auditId}  |  Besuch-ID: ${visit.id}  |  Erstellt: ${now.toISOString()}`,
      ml,
      fy + 9.5,
    );
    doc.setFontSize(6);
    doc.text(
      `Seite 1 von ${doc.internal.getNumberOfPages()}`,
      pw - mr,
      fy + 9.5,
      { align: "right" },
    );
    doc.setTextColor(0, 0, 0);

    // ── Return PDF ──
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `Leistungsnachweis_${visit.location.name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "_")}_${new Date(visit.scheduledDate).toISOString().split("T")[0]}.pdf`;

    log.info("[service-visits] Audit-ready PDF generated", {
      visitId: id,
      auditId,
      location: visit.location.name,
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    log.error("Error generating single-visit PDF:", { error });
    return NextResponse.json(
      { error: "Fehler beim Erstellen des PDF" },
      { status: 500 },
    );
  }
}

// ─── DMS Coordinate formatter ───────────────────────────────────

function formatDMS(decimal: number, isLat: boolean): string {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
  const direction = isLat
    ? decimal >= 0
      ? "N"
      : "S"
    : decimal >= 0
      ? "E"
      : "W";
  return `${degrees}°${minutes}′${seconds}″${direction}`;
}
