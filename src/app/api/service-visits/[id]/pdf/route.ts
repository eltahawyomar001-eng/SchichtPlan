/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission, isEmployee } from "@/lib/authorization";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { log } from "@/lib/logger";

// Suppress unused import warning — autoTable attaches to jsPDF prototype
void autoTable;

/**
 * GET /api/service-visits/[id]/pdf
 *
 * Generates a single-visit Leistungsnachweis (proof-of-service) PDF.
 * Includes: visit details, GPS proof, embedded signature image, and
 * SHA-256 integrity hash — legally compliant for German billing.
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

    // ── Generate PDF ──
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    const employeeName = `${visit.employee.firstName} ${visit.employee.lastName}`;
    const visitDate = new Date(visit.scheduledDate).toLocaleDateString(
      "de-DE",
      {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );

    // ── Header ──
    doc.setFontSize(18);
    doc.text("Leistungsnachweis", 14, 22);

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text("Einzelnachweis – Proof of Service", 14, 28);
    doc.setTextColor(0, 0, 0);

    // Horizontal line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(14, 32, pageWidth - 14, 32);

    // ── Company & Visit Info ──
    doc.setFontSize(10);
    let y = 40;

    doc.setFont("helvetica", "bold");
    doc.text("Unternehmen:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(workspace?.name || "—", 55, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Standort:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(visit.location.name, 55, y);
    y += 7;

    if (visit.location.address) {
      doc.setFont("helvetica", "bold");
      doc.text("Adresse:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(visit.location.address, 55, y);
      y += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Datum:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(visitDate, 55, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Mitarbeiter:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(employeeName, 55, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.text("Status:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text("Abgeschlossen ✓", 55, y);
    y += 12;

    // ── Time Tracking Table ──
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

    let duration = "—";
    if (visit.checkInAt && visit.checkOutAt) {
      const diffMs =
        new Date(visit.checkOutAt).getTime() -
        new Date(visit.checkInAt).getTime();
      const mins = Math.round(diffMs / 60000);
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      duration =
        hours > 0 ? `${hours}h ${remainingMins}min` : `${remainingMins}min`;
    }

    autoTable(doc, {
      startY: y,
      head: [["Check-in", "Check-out", "Dauer", "Geofence"]],
      body: [
        [
          checkIn,
          checkOut,
          duration,
          visit.checkInWithinFence ? "Innerhalb ✓" : "Außerhalb ✗",
        ],
      ],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable?.finalY ?? y + 25;
    y += 10;

    // ── GPS Proof Section ──
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("GPS-Nachweis", 14, y);
    doc.setFont("helvetica", "normal");
    y += 7;

    const gpsRows: string[][] = [];

    if (visit.checkInLat && visit.checkInLng) {
      gpsRows.push([
        "Check-in",
        `${formatDMS(visit.checkInLat, true)}, ${formatDMS(visit.checkInLng, false)}`,
        checkIn,
      ]);
    }

    if (visit.signature?.signedLat && visit.signature?.signedLng) {
      const signedTime = new Date(visit.signature.signedAt).toLocaleTimeString(
        "de-DE",
        { hour: "2-digit", minute: "2-digit", second: "2-digit" },
      );
      gpsRows.push([
        "Unterschrift",
        `${formatDMS(visit.signature.signedLat, true)}, ${formatDMS(visit.signature.signedLng, false)}`,
        signedTime,
      ]);
    }

    if (gpsRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Ereignis", "Koordinaten", "Uhrzeit"]],
        body: gpsRows,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5, font: "courier" },
        headStyles: { fillColor: [80, 80, 80] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable?.finalY ?? y + 20;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(130, 130, 130);
      doc.text("Keine GPS-Daten verfügbar", 14, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
    }

    y += 10;

    // ── Signature Section ──
    if (visit.signature) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Unterschrift", 14, y);
      doc.setFont("helvetica", "normal");
      y += 7;

      doc.setFontSize(9);
      doc.text(`Unterzeichner: ${visit.signature.signerName}`, 14, y);
      y += 5;

      if (visit.signature.signerRole) {
        doc.text(`Position: ${visit.signature.signerRole}`, 14, y);
        y += 5;
      }

      doc.text(
        `Zeitpunkt: ${new Date(visit.signature.signedAt).toLocaleString("de-DE")}`,
        14,
        y,
      );
      y += 8;

      // Embed signature image
      if (visit.signature.signatureData) {
        try {
          const imgData = visit.signature.signatureData;
          // Draw a box for the signature
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.rect(14, y, 80, 30);
          doc.addImage(imgData, "PNG", 16, y + 2, 76, 26);
          y += 35;
        } catch {
          doc.setFontSize(8);
          doc.setTextColor(180, 0, 0);
          doc.text("[Signatur konnte nicht eingebettet werden]", 14, y + 15);
          doc.setTextColor(0, 0, 0);
          y += 20;
        }
      }

      // Hash
      y += 3;
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(`SHA-256: ${visit.signature.signatureHash}`, 14, y);
      doc.setTextColor(0, 0, 0);
    }

    // ── Footer ──
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(
      "Dieses Dokument wurde automatisch generiert und dient als rechtsverbindlicher Leistungsnachweis.",
      14,
      footerY,
    );
    doc.text(
      `Besuch-ID: ${visit.id}  |  Erstellt: ${now.toISOString()}`,
      14,
      footerY + 4,
    );
    doc.setTextColor(0, 0, 0);

    // ── Return PDF ──
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `Leistungsnachweis_${visit.location.name.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "_")}_${new Date(visit.scheduledDate).toISOString().split("T")[0]}.pdf`;

    log.info("[service-visits] Single-visit PDF generated", {
      visitId: id,
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
