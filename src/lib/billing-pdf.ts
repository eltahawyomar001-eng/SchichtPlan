/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared PDF generator for customer-facing Quotes and Invoices.
 * Uses jsPDF + jspdf-autotable (same stack as the Leistungsnachweis PDF).
 * All money is passed in integer cents.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Suppress unused import warning — autoTable attaches to the jsPDF prototype.
void autoTable;

const EMERALD = [5, 150, 105] as const;
const DARK = [55, 65, 81] as const;
const MED = [107, 114, 128] as const;
const LGREY = [243, 244, 246] as const;

export interface BillingPdfDoc {
  kind: "quote" | "invoice";
  number: string;
  issueDate: Date;
  /** Quotes: validUntil; Invoices: dueDate. */
  secondaryDate: Date | null;
  vatRate: number;
  title: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number }[];
  totals: { netCents: number; vatCents: number; grossCents: number };
  issuer: { name: string; address: string | null; vatId: string | null };
  recipient: { name: string | null; address: string | null };
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}
function deDate(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function generateBillingPdf(doc_: BillingPdfDoc): ArrayBuffer {
  const isInvoice = doc_.kind === "invoice";
  const docLabel = isInvoice ? "RECHNUNG" : "ANGEBOT";
  const doc = new jsPDF() as any;
  const pw = doc.internal.pageSize.getWidth();
  const ml = 15;
  const mr = 15;
  const rx = pw - mr;

  // ── Header: issuer (left) + document title (right) ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(doc_.issuer.name, ml, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MED);
  let iy = 23;
  for (const line of (doc_.issuer.address ?? "").split("\n").filter(Boolean)) {
    doc.text(line, ml, iy);
    iy += 4;
  }
  if (doc_.issuer.vatId) {
    doc.text(`USt-IdNr.: ${doc_.issuer.vatId}`, ml, iy);
  }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...EMERALD);
  doc.text(docLabel, rx, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(`Nr. ${doc_.number}`, rx, 25, { align: "right" });
  doc.text(`Datum: ${deDate(doc_.issueDate)}`, rx, 30, { align: "right" });
  if (doc_.secondaryDate) {
    doc.text(
      `${isInvoice ? "Fällig" : "Gültig bis"}: ${deDate(doc_.secondaryDate)}`,
      rx,
      35,
      { align: "right" },
    );
  }

  // ── Recipient block ──
  let y = 50;
  doc.setFontSize(8);
  doc.setTextColor(...MED);
  doc.text(isInvoice ? "Rechnungsempfänger" : "Angebot für", ml, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(doc_.recipient.name ?? "—", ml, y);
  if (doc_.recipient.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MED);
    for (const line of doc_.recipient.address.split("\n").filter(Boolean)) {
      y += 4.5;
      doc.text(line, ml, y);
    }
  }

  if (doc_.title) {
    y += 9;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(doc_.title, ml, y);
  }

  // ── Line items table ──
  autoTable(doc, {
    startY: y + 6,
    head: [["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Summe"]],
    body: doc_.items.map((it, i) => [
      String(i + 1),
      it.description,
      String(it.quantity),
      euro(it.unitPriceCents),
      euro(Math.round(it.quantity * it.unitPriceCents)),
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [EMERALD[0], EMERALD[1], EMERALD[2]],
      textColor: 255,
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: [55, 65, 81] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      2: { halign: "right", cellWidth: 20 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30 },
    },
    margin: { left: ml, right: mr },
  });

  // ── Totals ──
  let ty = (doc as any).lastAutoTable.finalY + 8;
  const labelX = pw - mr - 60;
  const valX = rx;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9);
    doc.setTextColor(
      bold ? DARK[0] : MED[0],
      bold ? DARK[1] : MED[1],
      bold ? DARK[2] : MED[2],
    );
    doc.text(label, labelX, ty);
    doc.setTextColor(0, 0, 0);
    doc.text(value, valX, ty, { align: "right" });
    ty += bold ? 7 : 5.5;
  };
  totalRow("Nettobetrag", euro(doc_.totals.netCents));
  totalRow(`zzgl. MwSt. (${doc_.vatRate}%)`, euro(doc_.totals.vatCents));
  doc.setDrawColor(...LGREY);
  doc.line(labelX, ty - 2, valX, ty - 2);
  totalRow("Gesamtbetrag", euro(doc_.totals.grossCents), true);

  // ── Notes / payment terms ──
  ty += 6;
  if (doc_.notes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MED);
    const wrapped = doc.splitTextToSize(doc_.notes, pw - ml - mr);
    doc.text(wrapped, ml, ty);
    ty += wrapped.length * 4 + 4;
  }
  if (isInvoice && doc_.secondaryDate) {
    doc.setFontSize(8);
    doc.setTextColor(...MED);
    doc.text(
      `Zahlbar ohne Abzug bis zum ${deDate(doc_.secondaryDate)}.`,
      ml,
      ty,
    );
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}
