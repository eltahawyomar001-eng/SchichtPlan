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
  /**
   * An invoice that has not been issued yet.
   *
   * Marked unmistakably on the page, because a draft PDF that looks like a
   * finished invoice is the one that gets emailed, paid and booked -- and it
   * carries no valid number, so it cannot be booked correctly.
   */
  draft?: boolean;
  issueDate: Date;
  /** Quotes: validUntil; Invoices: dueDate. */
  secondaryDate: Date | null;
  vatRate: number;
  title: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number }[];
  totals: { netCents: number; vatCents: number; grossCents: number };
  issuer: {
    name: string;
    address: string | null;
    vatId: string | null;
    /**
     * The company logo, already fetched and base64-encoded.
     *
     * Optional by design: the PDF must render identically minus the image when
     * no logo is stored or it could not be loaded. An invoice is a legal record
     * a customer is waiting for, and a decorative image is not worth failing it
     * over.
     */
    logo?: { data: string; format: "PNG" | "JPEG" } | null;
  };
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
  const isDraft = doc_.draft === true;
  const doc = new jsPDF() as any;
  const pw = doc.internal.pageSize.getWidth();
  const ml = 15;
  const mr = 15;
  const rx = pw - mr;

  // ── Header: issuer (left) + document title (right) ──
  //
  // The logo sits above the issuer name and pushes the block down, rather than
  // being placed beside it: a wide wordmark and a square icon need very
  // different widths, and anything measured from the right would collide with
  // the document title on one of them.
  let headerTop = 18;
  if (doc_.issuer.logo) {
    try {
      const boxH = 14;
      const boxW = 45;
      const props = doc.getImageProperties(
        `data:image/${doc_.issuer.logo.format.toLowerCase()};base64,${doc_.issuer.logo.data}`,
      );
      // Fit inside the box without distorting it. A stretched logo looks worse
      // than no logo, and this is the one element a customer recognises.
      const scale = Math.min(boxW / props.width, boxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(
        doc_.issuer.logo.data,
        doc_.issuer.logo.format,
        ml,
        12,
        w,
        h,
      );
      headerTop = 12 + h + 6;
    } catch {
      // A corrupt image must not take the invoice with it; the header simply
      // renders without it.
      headerTop = 18;
    }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(doc_.issuer.name, ml, headerTop);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MED);
  let iy = headerTop + 5;
  for (const line of (doc_.issuer.address ?? "").split("\n").filter(Boolean)) {
    doc.text(line, ml, iy);
    iy += 4;
  }
  if (doc_.issuer.vatId) {
    doc.text(`USt-IdNr.: ${doc_.issuer.vatId}`, ml, iy);
  }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  // Grey, not the brand colour: the draft should not look like the real thing
  // at a glance across a desk.
  doc.setTextColor(...(isDraft ? MED : EMERALD));
  doc.text(isDraft ? `${docLabel} (ENTWURF)` : docLabel, rx, 18, {
    align: "right",
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.text(
    isDraft ? "Noch keine Rechnungsnummer" : `Nr. ${doc_.number}`,
    rx,
    25,
    { align: "right" },
  );
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
  // § 19 UStG (Kleinunternehmer): no VAT is charged, so omit the MwSt. row
  // and show the legally required note below. Inferred from a 0% rate so no
  // caller change is needed; flips automatically once a real VAT rate is set.
  const isKleinunternehmer = doc_.vatRate === 0;
  if (isKleinunternehmer) {
    totalRow("Gesamtbetrag", euro(doc_.totals.grossCents), true);
  } else {
    totalRow("Nettobetrag", euro(doc_.totals.netCents));
    totalRow(`zzgl. MwSt. (${doc_.vatRate}%)`, euro(doc_.totals.vatCents));
    doc.setDrawColor(...LGREY);
    doc.line(labelX, ty - 2, valX, ty - 2);
    totalRow("Gesamtbetrag", euro(doc_.totals.grossCents), true);
  }

  // ── Notes / payment terms ──
  ty += 6;
  if (isKleinunternehmer) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MED);
    const note =
      "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).";
    const wrappedNote = doc.splitTextToSize(note, pw - ml - mr);
    doc.text(wrappedNote, ml, ty);
    ty += wrappedNote.length * 4 + 4;
  }
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

  // ── Draft watermark ──
  //
  // Drawn LAST so it sits over the content on every page: a draft has to be
  // unusable as an invoice, not merely labelled as one in a corner that a
  // scanner or an accounts-payable workflow will crop away.
  if (isDraft) {
    const pageCount = doc.internal.getNumberOfPages();
    const ph = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(60);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...MED);
      // jsPDF has no alpha on text in every build, so a light grey at an
      // angle is the portable way to keep it readable underneath.
      doc.text("ENTWURF", pw / 2, ph / 2, {
        align: "center",
        angle: 35,
      });
    }
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}
