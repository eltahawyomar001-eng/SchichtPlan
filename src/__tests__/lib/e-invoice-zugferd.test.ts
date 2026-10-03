// @vitest-environment node
/**
 * The ZUGFeRD container.
 *
 * What a recipient's importer actually does with one of these files is: look
 * in /AF, find the attachment, pull the XML out and book it. So that is what
 * is tested -- the structure an importer keys on, and a byte-exact round trip
 * of the document that gets booked.
 *
 * Strict PDF/A-3B conformance is NOT asserted here, because the file does not
 * have it: see the header of lib/e-invoice/zugferd.ts, and
 * scripts/validate-zugferd.sh for the measured veraPDF result.
 *
 * Runs in the NODE environment, not the suite's default jsdom. pdf-lib checks
 * its arguments with cross-realm instanceof, and a Uint8Array produced by
 * jsdom's TextEncoder fails that check even though the value is correct --
 * server-side code tested in a browser environment it never runs in.
 */
import { describe, it, expect } from "vitest";
import {
  buildZugferdPdf,
  extractZugferdXml,
  ZUGFERD_FILENAME,
} from "@/lib/e-invoice/zugferd";
import { generateBillingPdf } from "@/lib/billing-pdf";
import { GOLDEN_INVOICES } from "@/lib/e-invoice/fixtures";

function samplePdf(): ArrayBuffer {
  return generateBillingPdf({
    kind: "invoice",
    number: "RE-2026-0001",
    issueDate: new Date(2026, 9, 3),
    secondaryDate: new Date(2026, 9, 17),
    vatRate: 19,
    title: "Unterhaltsreinigung",
    notes: null,
    items: [
      { description: "Reinigung", quantity: 162.5, unitPriceCents: 2850 },
    ],
    totals: { netCents: 463125, vatCents: 87994, grossCents: 551119 },
    issuer: {
      name: "Musterreinigung Rhein-Neckar GmbH",
      address: "Industriestraße 14\n68161 Mannheim",
      vatId: "DE123456789",
    },
    recipient: { name: "Beispiel Immobilien GmbH", address: "Parkallee 88" },
  });
}

async function build(xml = GOLDEN_INVOICES.standard()) {
  return buildZugferdPdf({
    pdf: samplePdf(),
    xml,
    invoiceNumber: "RE-2026-0001",
  });
}

const asText = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("the container", () => {
  it("produces a PDF", async () => {
    const out = await build();
    expect(asText(out).startsWith("%PDF-")).toBe(true);
  });

  it("names the attachment exactly as the specification requires", async () => {
    // Importers look for this name. Anything else and the file is treated as
    // an ordinary PDF with no invoice data in it.
    expect(ZUGFERD_FILENAME).toBe("factur-x.xml");
    // Written as UTF-16BE in the name tree, so the ASCII form is not present.
    const text = asText(await build());
    expect(text).toContain("AFRelationship");
  });

  it("lists the attachment in /AF, which is what importers scan", async () => {
    const text = asText(await build());
    expect(text).toContain("/AF");
    expect(text).toContain("/Alternative");
  });

  it("declares PDF/A identification", async () => {
    const text = asText(await build());
    expect(text).toContain("pdfaid:part");
    expect(text).toContain("<pdfaid:conformance>B</pdfaid:conformance>");
  });

  it("declares the ZUGFeRD profile in the Factur-X namespace", async () => {
    const text = asText(await build());
    expect(text).toContain("urn:factur-x:pdfa:CrossIndustryDocument");
    expect(text).toContain(
      "<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>",
    );
    expect(text).toContain("<fx:DocumentType>INVOICE</fx:DocumentType>");
  });

  it("describes its extension schema, as PDF/A demands", async () => {
    // PDF/A requires every non-standard XMP property to be DESCRIBED in the
    // metadata; without this the file is non-conforming even though the
    // properties themselves are right.
    const text = asText(await build());
    expect(text).toContain("pdfaExtension:schemas");
    expect(text).toContain("Factur-X PDFA Extension Schema");
  });

  it("carries an OutputIntent", async () => {
    const text = asText(await build());
    expect(text).toContain("GTS_PDFA1");
    expect(text).toContain("sRGB");
  });

  it("sets a document ID", async () => {
    expect(asText(await build())).toContain("/ID");
  });
});

describe("round trip", () => {
  it("gives the XML back byte for byte", async () => {
    // The only property that really matters: what comes out is what gets
    // booked, and a single changed character makes it a different document
    // from the one whose checksum we archived.
    const xml = GOLDEN_INVOICES.standard();
    const back = await extractZugferdXml(await build(xml));
    expect(back).toBe(xml);
  });

  it("survives the stream compression pdf-lib applies", async () => {
    // The attachment is stored Flate-compressed; reading the raw bytes gives
    // binary noise that looks like a corrupt invoice rather than a
    // compressed one.
    const back = await extractZugferdXml(await build());
    expect(back).toContain("<rsm:CrossIndustryInvoice");
  });

  it("round-trips every invoice we generate", async () => {
    for (const [name, make] of Object.entries(GOLDEN_INVOICES)) {
      const xml = make();
      const back = await extractZugferdXml(await build(xml));
      expect(back, name).toBe(xml);
    }
  });

  it("returns null for a PDF with no invoice attached", async () => {
    const plain = samplePdf();
    expect(await extractZugferdXml(new Uint8Array(plain))).toBeNull();
  });
});
