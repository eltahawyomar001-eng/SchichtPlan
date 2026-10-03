/**
 * The four invoices the validator must accept.
 *
 * Fictional companies throughout: these end up in CI output and in test
 * fixtures, and real customer data has no business there.
 *
 * Chosen to cover the cases where German e-invoicing actually differs from the
 * generic EN 16931 case, rather than four variations of the same happy path:
 * an ordinary taxable invoice with mixed rates, a § 19 Kleinunternehmer, a
 * public-sector recipient with a Leitweg-ID, and a Storno referring back to an
 * earlier document.
 */

import { buildCii, PROFILE, type CiiInvoice, type Party } from "./cii";
import {
  computeEInvoiceTotals,
  EXEMPTION_REASONS,
  type InvoiceLine,
} from "./totals";

const SELLER: Party = {
  name: "Musterreinigung Rhein-Neckar GmbH",
  street: "Industriestraße 14",
  postalCode: "68161",
  city: "Mannheim",
  countryCode: "DE",
  vatId: "DE123456789",
  email: "rechnung@musterreinigung.example",
};

const SELLER_KLEIN: Party = {
  name: "Hausmeisterservice Mustermann",
  street: "Lindenweg 3",
  postalCode: "69115",
  city: "Heidelberg",
  countryCode: "DE",
  // No VAT ID: a Kleinunternehmer typically has only a Steuernummer, and the
  // invoice must still satisfy § 14 Abs. 4 with that alone.
  taxNumber: "32/123/45678",
};

const BUYER: Party = {
  name: "Beispiel Immobilienverwaltung GmbH",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "DE",
  vatId: "DE987654321",
};

const BUYER_PUBLIC: Party = {
  name: "Stadtverwaltung Musterstadt",
  street: "Rathausplatz 1",
  postalCode: "76133",
  city: "Karlsruhe",
  countryCode: "DE",
};

const PAYMENT = {
  iban: "DE02120300000000202051",
  bic: "BYLADEM1001",
  accountName: "Musterreinigung Rhein-Neckar GmbH",
  terms: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
};

function build(
  lines: InvoiceLine[],
  over: Partial<CiiInvoice>,
  reasons: Parameters<typeof computeEInvoiceTotals>[1] = {},
): string {
  const totals = computeEInvoiceTotals(lines, reasons);
  return buildCii({
    profile: PROFILE.XRECHNUNG,
    number: "RE-2026-0001",
    typeCode: "380",
    issueDate: new Date(Date.UTC(2026, 9, 3)),
    dueDate: new Date(Date.UTC(2026, 9, 17)),
    currency: "EUR",
    seller: SELLER,
    buyer: BUYER,
    periodStart: new Date(Date.UTC(2026, 8, 1)),
    periodEnd: new Date(Date.UTC(2026, 8, 30)),
    payment: PAYMENT,
    lines,
    totals,
    ...over,
  });
}

/** Mixed 19 % / 7 %, billed from hours — the ordinary case. */
export function standardInvoice(): string {
  const lines: InvoiceLine[] = [
    {
      description: "Unterhaltsreinigung September 2026, Objekt Parkallee 88",
      quantity: 162.5,
      unitPriceCents: 2850,
      vatRate: 19,
      category: "S",
      unitCode: "HUR",
    },
    {
      description: "Winterdienst-Bereitschaft, Pauschale",
      quantity: 1,
      unitPriceCents: 45000,
      vatRate: 19,
      category: "S",
    },
    {
      description: "Verbrauchsmaterial (ermäßigter Satz)",
      quantity: 12,
      unitPriceCents: 480,
      vatRate: 7,
      category: "S",
    },
  ];
  return build(lines, {});
}

/** § 19 UStG: no VAT shown, exemption note mandatory. */
export function kleinunternehmerInvoice(): string {
  const lines: InvoiceLine[] = [
    {
      description: "Hausmeisterleistungen September 2026",
      quantity: 48,
      unitPriceCents: 3200,
      vatRate: 0,
      category: "E",
      unitCode: "HUR",
    },
  ];
  return build(
    lines,
    {
      number: "RE-2026-0002",
      seller: SELLER_KLEIN,
      payment: { ...PAYMENT, accountName: SELLER_KLEIN.name },
    },
    { E: EXEMPTION_REASONS.KLEINUNTERNEHMER },
  );
}

/** B2G: a Leitweg-ID is what makes XRechnung mandatory for this recipient. */
export function publicSectorInvoice(): string {
  const lines: InvoiceLine[] = [
    {
      description: "Objektbetreuung Rathaus, September 2026",
      quantity: 210,
      unitPriceCents: 2990,
      vatRate: 19,
      category: "S",
      unitCode: "HUR",
    },
  ];
  return build(lines, {
    number: "RE-2026-0003",
    buyer: BUYER_PUBLIC,
    buyerReference: "991-12345-67",
  });
}

/** Storno: a credit note that must name the invoice it reverses. */
export function stornoInvoice(): string {
  const lines: InvoiceLine[] = [
    {
      description: "Storno zu Rechnung RE-2026-0001",
      quantity: 162.5,
      unitPriceCents: -2850,
      vatRate: 19,
      category: "S",
      unitCode: "HUR",
    },
  ];
  return build(lines, {
    number: "RE-2026-0004",
    typeCode: "381",
    precedingInvoiceNumber: "RE-2026-0001",
    precedingInvoiceDate: new Date(Date.UTC(2026, 9, 3)),
    note: "Storno der Rechnung RE-2026-0001 vom 03.10.2026.",
  });
}

export const GOLDEN_INVOICES = {
  standard: standardInvoice,
  kleinunternehmer: kleinunternehmerInvoice,
  "b2g-leitweg": publicSectorInvoice,
  storno: stornoInvoice,
} as const;
