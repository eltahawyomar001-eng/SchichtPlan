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
  // BR-DE-2: a German invoice must name a contact person.
  contact: {
    name: "Sabine Vogt",
    phone: "+49 621 1234560",
    email: "buchhaltung@musterreinigung.example",
  },
};

const SELLER_KLEIN: Party = {
  name: "Hausmeisterservice Mustermann",
  street: "Lindenweg 3",
  postalCode: "69115",
  city: "Heidelberg",
  countryCode: "DE",
  // No VAT ID: a Kleinunternehmer typically has only a Steuernummer, and the
  // invoice must still satisfy § 14 Abs. 4 with that alone. BR-CO-26 is a
  // separate requirement -- a Steuernummer does not identify the seller for
  // its purposes -- so the legal registration carries that instead.
  taxNumber: "32/123/45678",
  legalRegistrationId: "HRB 712345",
  email: "rechnung@hausmeister-mustermann.example",
  contact: {
    name: "Jörg Mustermann",
    phone: "+49 6221 998877",
    email: "rechnung@hausmeister-mustermann.example",
  },
};

const BUYER: Party = {
  name: "Beispiel Immobilienverwaltung GmbH",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "DE",
  vatId: "DE987654321",
  // BT-49: mandatory for the buyer too (PEPPOL-EN16931-R010).
  email: "kreditoren@beispiel-immobilien.example",
};

const BUYER_PUBLIC: Party = {
  name: "Stadtverwaltung Musterstadt",
  street: "Rathausplatz 1",
  postalCode: "76133",
  city: "Karlsruhe",
  countryCode: "DE",
  email: "rechnungseingang@musterstadt.example",
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
    // BR-DE-15 makes BT-10 mandatory for every XRechnung, not just for public
    // sector recipients -- where it additionally carries the Leitweg-ID.
    buyerReference: "Bestellung 2026-09",
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

/**
 * Storno: a credit note that must name the invoice it reverses.
 *
 * Amounts are POSITIVE. The reversal is expressed by the document type code
 * (BT-3 = 381), not by negating the figures: BR-27 forbids a negative item net
 * price outright, so a "negative invoice" is rejected even though the
 * arithmetic is self-consistent. The reader of a credit note understands the
 * direction from the document type, and the accounting system does the same.
 */
export function stornoInvoice(): string {
  const lines: InvoiceLine[] = [
    {
      description: "Storno zu Rechnung RE-2026-0001",
      quantity: 162.5,
      unitPriceCents: 2850,
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

/* ── Invoices assembled the way production assembles them ─────────────── */

/**
 * The fixtures above exercise the XML writer directly. These go through
 * assembleCii, which is the path a real invoice actually takes.
 *
 * Worth validating separately, because the two can disagree: the writer can be
 * perfectly correct while the mapping feeds it the wrong field, and the result
 * is a schema-valid invoice that is simply untrue. A Kleinunternehmer whose
 * Handelsregister number never reaches BT-30 is the concrete case -- rejected
 * by the recipient, with nothing wrong in cii.ts.
 */

import { assembleCii, type ClientInput, type IssuerInput } from "./assemble";

const ASSEMBLED_ISSUER: IssuerInput = {
  legalName: "Musterreinigung Rhein-Neckar GmbH",
  tradingName: "Mustergebäudeservice",
  street: "Industriestraße 14",
  postalCode: "68161",
  city: "Mannheim",
  countryCode: "DE",
  vatId: "DE123456789",
  taxNumber: null,
  legalRegistrationId: "HRB 712345",
  kleinunternehmer: false,
  email: "rechnung@musterreinigung.example",
  phone: "+49 621 1234560",
  contactName: "Sabine Vogt",
  contactPhone: null,
  contactEmail: null,
  addressLine2: null,
  bankName: "Beispielbank Mannheim",
  iban: "DE02120300000000202051",
  bic: "BYLADEM1001",
  paymentTermDays: 14,
};

const ASSEMBLED_CLIENT: ClientInput = {
  name: "Beispiel Immobilienverwaltung GmbH",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "DE",
  vatId: "DE987654321",
  leitwegId: null,
  invoiceEmail: "kreditoren@beispiel-immobilien.example",
  email: null,
};

/** Mixed rates, through the production mapping. */
export function assembledStandardInvoice(): string {
  return buildCii(
    assembleCii({
      issuer: ASSEMBLED_ISSUER,
      client: ASSEMBLED_CLIENT,
      invoice: {
        number: "RE-2026-0101",
        issueDate: new Date(Date.UTC(2026, 9, 3)),
        dueDate: new Date(Date.UTC(2026, 9, 17)),
        notes: "Objekt Parkallee 88, Leistungsnachweis liegt bei.",
        vatRate: 19,
        periodStart: new Date(Date.UTC(2026, 8, 1)),
        periodEnd: new Date(Date.UTC(2026, 8, 30)),
        items: [
          {
            description: "Unterhaltsreinigung September 2026",
            quantity: 162.5,
            unitPriceCents: 2850,
            unitCode: "HUR",
          },
          {
            description: "Verbrauchsmaterial",
            quantity: 12,
            unitPriceCents: 480,
            vatRate: 7,
          },
        ],
      },
      format: "XRECHNUNG",
    }),
  );
}

/** § 19, through the production mapping — the BT-30 case. */
export function assembledKleinunternehmerInvoice(): string {
  return buildCii(
    assembleCii({
      issuer: {
        ...ASSEMBLED_ISSUER,
        legalName: "Hausmeisterservice Mustermann",
        kleinunternehmer: true,
        vatId: null,
        taxNumber: "32/123/45678",
        legalRegistrationId: "HRB 712345",
      },
      client: ASSEMBLED_CLIENT,
      invoice: {
        number: "RE-2026-0102",
        issueDate: new Date(Date.UTC(2026, 9, 3)),
        dueDate: new Date(Date.UTC(2026, 9, 17)),
        vatRate: 19,
        items: [
          {
            description: "Hausmeisterleistungen September 2026",
            quantity: 48,
            unitPriceCents: 3200,
            unitCode: "HUR",
          },
        ],
      },
      format: "XRECHNUNG",
    }),
  );
}

/** § 13b reverse charge, through the production mapping. */
export function assembledReverseChargeInvoice(): string {
  return buildCii(
    assembleCii({
      issuer: ASSEMBLED_ISSUER,
      client: ASSEMBLED_CLIENT,
      invoice: {
        number: "RE-2026-0103",
        issueDate: new Date(Date.UTC(2026, 9, 3)),
        dueDate: new Date(Date.UTC(2026, 9, 17)),
        reverseCharge: true,
        vatRate: 19,
        items: [
          {
            description: "Bauleistungen Objekt Parkallee 88",
            quantity: 1,
            unitPriceCents: 1250000,
          },
        ],
      },
      format: "XRECHNUNG",
    }),
  );
}

/** A Storno, through the production mapping. */
export function assembledStornoInvoice(): string {
  return buildCii(
    assembleCii({
      issuer: ASSEMBLED_ISSUER,
      client: ASSEMBLED_CLIENT,
      invoice: {
        number: "RE-2026-0104",
        typeCode: "381",
        issueDate: new Date(Date.UTC(2026, 9, 10)),
        dueDate: new Date(Date.UTC(2026, 9, 24)),
        correctsNumber: "RE-2026-0101",
        correctsDate: new Date(Date.UTC(2026, 9, 3)),
        vatRate: 19,
        items: [
          {
            description: "Storno Unterhaltsreinigung September 2026",
            quantity: 162.5,
            unitPriceCents: 2850,
            unitCode: "HUR",
          },
        ],
      },
      format: "XRECHNUNG",
    }),
  );
}

/** Public sector, through the production mapping. */
export function assembledPublicSectorInvoice(): string {
  return buildCii(
    assembleCii({
      issuer: ASSEMBLED_ISSUER,
      client: {
        ...ASSEMBLED_CLIENT,
        name: "Stadtverwaltung Musterstadt",
        street: "Rathausplatz 1",
        postalCode: "76133",
        city: "Karlsruhe",
        vatId: null,
        leitwegId: "991-12345-67",
        invoiceEmail: "rechnungseingang@musterstadt.example",
      },
      invoice: {
        number: "RE-2026-0105",
        issueDate: new Date(Date.UTC(2026, 9, 3)),
        dueDate: new Date(Date.UTC(2026, 9, 17)),
        vatRate: 19,
        items: [
          {
            description: "Objektbetreuung Rathaus, September 2026",
            quantity: 210,
            unitPriceCents: 2990,
            unitCode: "HUR",
          },
        ],
      },
      format: "XRECHNUNG",
    }),
  );
}

/** Everything the validator must accept, writer path and mapping path. */
export const ASSEMBLED_INVOICES = {
  "assembled-standard": assembledStandardInvoice,
  "assembled-kleinunternehmer": assembledKleinunternehmerInvoice,
  "assembled-reverse-charge": assembledReverseChargeInvoice,
  "assembled-storno": assembledStornoInvoice,
  "assembled-b2g": assembledPublicSectorInvoice,
} as const;
