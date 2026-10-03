/**
 * Write a ZUGFeRD sample for the PDF/A validator.
 *
 * Separate from the vitest suite for the same reason the KoSIT script is:
 * veraPDF is a container that reads files, not a test runner.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { generateBillingPdf } from "../src/lib/billing-pdf";
import {
  buildZugferdPdf,
  extractZugferdXml,
} from "../src/lib/e-invoice/zugferd";
import { GOLDEN_INVOICES } from "../src/lib/e-invoice/fixtures";

const out = process.argv[2];
if (!out) {
  console.error("usage: build-zugferd-sample.ts <output-dir>");
  process.exit(2);
}

async function main() {
  mkdirSync(out, { recursive: true });

  const pdf = generateBillingPdf({
    kind: "invoice",
    number: "RE-2026-0001",
    issueDate: new Date(2026, 9, 3),
    secondaryDate: new Date(2026, 9, 17),
    vatRate: 19,
    title: "Unterhaltsreinigung September 2026",
    notes: null,
    items: [
      {
        description: "Unterhaltsreinigung",
        quantity: 162.5,
        unitPriceCents: 2850,
      },
    ],
    totals: { netCents: 463125, vatCents: 87994, grossCents: 551119 },
    issuer: {
      name: "Musterreinigung Rhein-Neckar GmbH",
      address: "Industriestraße 14\n68161 Mannheim",
      vatId: "DE123456789",
    },
    recipient: {
      name: "Beispiel Immobilienverwaltung GmbH",
      address: "Parkallee 88\n60322 Frankfurt am Main",
    },
  });

  const xml = GOLDEN_INVOICES.standard();
  const zf = await buildZugferdPdf({ pdf, xml, invoiceNumber: "RE-2026-0001" });
  writeFileSync(join(out, "zugferd.pdf"), zf);

  // The round trip is the part that actually matters to a recipient: the
  // bookable document has to come back out byte-identical.
  const back = await extractZugferdXml(zf);
  console.log(`wrote ${join(out, "zugferd.pdf")} (${zf.byteLength} bytes)`);
  console.log(
    `extract round-trip: ${back === xml ? "IDENTICAL" : back ? "DIFFERENT" : "FAILED"}`,
  );
  if (back !== xml) process.exit(1);
}

void main();
