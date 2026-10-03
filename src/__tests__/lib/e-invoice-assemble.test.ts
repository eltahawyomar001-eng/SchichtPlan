/**
 * Mapping our rows onto EN 16931.
 *
 * This is where the judgement calls are: which of several addresses counts,
 * which tax category applies, what a missing field falls back to. Each of them
 * is a decision that would otherwise only be visible in the XML, and several
 * are wrong in ways the validator cannot detect because the result is a
 * perfectly valid invoice that says something untrue.
 */
import { describe, it, expect } from "vitest";
import {
  assembleCii,
  documentNote,
  exemptionReasonsFor,
  toInvoiceLines,
  type ClientInput,
  type InvoiceInput,
  type IssuerInput,
} from "@/lib/e-invoice/assemble";
import { PROFILE } from "@/lib/e-invoice/cii";

const issuer = (over: Partial<IssuerInput> = {}): IssuerInput => ({
  legalName: "Musterreinigung Rhein-Neckar GmbH",
  street: "Industriestraße 14",
  postalCode: "68161",
  city: "Mannheim",
  countryCode: "DE",
  vatId: "DE123456789",
  kleinunternehmer: false,
  email: "rechnung@musterreinigung.example",
  contactName: "Sabine Vogt",
  iban: "DE02120300000000202051",
  bic: "BYLADEM1001",
  paymentTermDays: 14,
  ...over,
});

const client = (over: Partial<ClientInput> = {}): ClientInput => ({
  name: "Beispiel Immobilienverwaltung GmbH",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "DE",
  invoiceEmail: "kreditoren@beispiel-immobilien.example",
  ...over,
});

const inv = (over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  number: "RE-2026-0001",
  issueDate: new Date("2026-10-03"),
  dueDate: new Date("2026-10-17"),
  vatRate: 19,
  items: [
    { description: "Unterhaltsreinigung", quantity: 10, unitPriceCents: 2850 },
  ],
  ...over,
});

describe("tax category", () => {
  it("is derived, not stored per line", () => {
    // The category follows from WHO is issuing and from the invoice as a
    // whole. Storing it per item would let one line show VAT while the next
    // claims § 19 on the same document.
    const lines = toInvoiceLines(
      inv({
        items: [
          { description: "A", quantity: 1, unitPriceCents: 100 },
          { description: "B", quantity: 1, unitPriceCents: 200 },
        ],
      }),
      { kleinunternehmer: true },
    );
    expect(lines.every((l) => l.category === "E")).toBe(true);
  });

  it("zeroes the rate for a Kleinunternehmer even when items carry one", () => {
    // Otherwise the document shows tax that was never charged.
    const lines = toInvoiceLines(
      inv({
        items: [
          { description: "A", quantity: 1, unitPriceCents: 100, vatRate: 19 },
        ],
      }),
      { kleinunternehmer: true },
    );
    expect(lines[0].vatRate).toBe(0);
  });

  it("falls back to the invoice rate when an item has none", () => {
    // Existing rows predate per-line rates, and must keep billing correctly.
    const lines = toInvoiceLines(inv({ vatRate: 7 }), {
      kleinunternehmer: false,
    });
    expect(lines[0].vatRate).toBe(7);
  });

  it("prefers the item rate over the invoice rate", () => {
    const lines = toInvoiceLines(
      inv({
        vatRate: 19,
        items: [
          { description: "A", quantity: 1, unitPriceCents: 100, vatRate: 7 },
        ],
      }),
      { kleinunternehmer: false },
    );
    expect(lines[0].vatRate).toBe(7);
  });

  it("defaults the unit to pieces, not hours", () => {
    expect(toInvoiceLines(inv(), { kleinunternehmer: false })[0].unitCode).toBe(
      "C62",
    );
  });
});

describe("exemption reasons", () => {
  it("supplies the § 19 note for a Kleinunternehmer", () => {
    expect(exemptionReasonsFor({ kleinunternehmer: true }, false).E).toContain(
      "§ 19 UStG",
    );
  });

  it("supplies the § 13b note for a reverse charge", () => {
    expect(exemptionReasonsFor({ kleinunternehmer: false }, true).AE).toContain(
      "§ 13b UStG",
    );
  });

  it("lets § 19 win over § 13b", () => {
    // A Kleinunternehmer cannot shift a tax liability it never charged.
    const reasons = exemptionReasonsFor({ kleinunternehmer: true }, true);
    expect(reasons.E).toBeTruthy();
    expect(reasons.AE).toBeUndefined();
  });

  it("supplies nothing for an ordinary taxable invoice", () => {
    expect(exemptionReasonsFor({ kleinunternehmer: false }, false)).toEqual({});
  });
});

describe("the document note", () => {
  it("carries the § 19 note in readable form", () => {
    // BT-120 holds it in the tax breakdown, but the recipient's accounts
    // department reads the note, not the breakdown.
    const note = documentNote(inv(), { kleinunternehmer: true });
    expect(note).toContain("§ 19 UStG");
  });

  it("keeps the user's own notes as well as the legal one", () => {
    const note = documentNote(inv({ notes: "Objekt Parkallee 88" }), {
      kleinunternehmer: true,
    });
    expect(note).toContain("Objekt Parkallee 88");
    expect(note).toContain("§ 19 UStG");
  });

  it("names the reversed invoice on a Storno", () => {
    const note = documentNote(inv({ correctsNumber: "RE-2026-0001" }), {
      kleinunternehmer: false,
    });
    expect(note).toContain("RE-2026-0001");
  });

  it("is null when there is nothing to say", () => {
    expect(documentNote(inv(), { kleinunternehmer: false })).toBeNull();
  });
});

describe("parties", () => {
  it("uses the legal name, not the trading name", () => {
    // The invoice has to name the entity that is liable.
    const doc = assembleCii({
      issuer: issuer({ tradingName: "Mustergebäudeservice" }),
      client: client(),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.seller.name).toBe("Musterreinigung Rhein-Neckar GmbH");
  });

  it("prefers the invoicing email over the general contact one", () => {
    // Accounts payable is usually not the person we otherwise talk to.
    const doc = assembleCii({
      issuer: issuer(),
      client: client({
        invoiceEmail: "rechnungen@beispiel.example",
        email: "info@beispiel.example",
      }),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.buyer.email).toBe("rechnungen@beispiel.example");
  });

  it("falls back to the general email when no invoicing one is set", () => {
    const doc = assembleCii({
      issuer: issuer(),
      client: client({ invoiceEmail: null, email: "info@beispiel.example" }),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.buyer.email).toBe("info@beispiel.example");
  });

  it("falls back to the company phone for the contact person", () => {
    const doc = assembleCii({
      issuer: issuer({ phone: "+49 621 1234560", contactPhone: null }),
      client: client(),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.seller.contact?.phone).toBe("+49 621 1234560");
  });
});

describe("buyer reference (BT-10)", () => {
  it("carries the Leitweg-ID when the recipient is public sector", () => {
    // Its presence is what makes the invoice B2G.
    const doc = assembleCii({
      issuer: issuer(),
      client: client({ leitwegId: "991-12345-67" }),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.buyerReference).toBe("991-12345-67");
  });

  it("falls back to the invoice number rather than leaving it empty", () => {
    // BR-DE-15 demands the field for EVERY XRechnung, not just B2G ones, and
    // the invoice number is the only reference we can honestly supply when
    // the customer gave us none.
    const doc = assembleCii({
      issuer: issuer(),
      client: client(),
      invoice: inv({ number: "RE-2026-0042" }),
      format: "XRECHNUNG",
    });
    expect(doc.buyerReference).toBe("RE-2026-0042");
  });

  it("ignores a Leitweg-ID that is only whitespace", () => {
    const doc = assembleCii({
      issuer: issuer(),
      client: client({ leitwegId: "  " }),
      invoice: inv({ number: "RE-2026-0042" }),
      format: "XRECHNUNG",
    });
    expect(doc.buyerReference).toBe("RE-2026-0042");
  });
});

describe("format", () => {
  it("claims the XRechnung ruleset for XRECHNUNG", () => {
    // The recipient's validator picks its rules from this string alone.
    const doc = assembleCii({
      issuer: issuer(),
      client: client(),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.profile).toBe(PROFILE.XRECHNUNG);
  });

  it("claims plain EN 16931 for ZUGFeRD", () => {
    const doc = assembleCii({
      issuer: issuer(),
      client: client(),
      invoice: inv(),
      format: "ZUGFERD",
    });
    expect(doc.profile).toBe(PROFILE.ZUGFERD_EN16931);
  });
});

describe("payment", () => {
  it("states the terms in days as configured", () => {
    const doc = assembleCii({
      issuer: issuer({ paymentTermDays: 30 }),
      client: client(),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.payment?.terms).toContain("30 Tagen");
  });

  it("omits the payment block entirely when there is no IBAN", () => {
    // Better than an empty bank block, which reads as a configuration error
    // on the recipient's side.
    const doc = assembleCii({
      issuer: issuer({ iban: null }),
      client: client(),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.payment).toBeUndefined();
  });
});

describe("totals", () => {
  it("computes them from the resolved lines", () => {
    const doc = assembleCii({
      issuer: issuer(),
      client: client(),
      invoice: inv({
        items: [
          { description: "A", quantity: 10, unitPriceCents: 2850 },
          { description: "B", quantity: 1, unitPriceCents: 45000, vatRate: 7 },
        ],
      }),
      format: "XRECHNUNG",
    });
    expect(doc.totals.taxBasisCents).toBe(28500 + 45000);
    // Two rates, so two breakdown rows -- the case a single invoice-level rate
    // could not express at all.
    expect(doc.totals.breakdown).toHaveLength(2);
  });

  it("shows no tax for a Kleinunternehmer", () => {
    const doc = assembleCii({
      issuer: issuer({
        kleinunternehmer: true,
        vatId: null,
        taxNumber: "32/123/45678",
      }),
      client: client(),
      invoice: inv(),
      format: "XRECHNUNG",
    });
    expect(doc.totals.taxTotalCents).toBe(0);
    expect(doc.totals.grandTotalCents).toBe(doc.totals.taxBasisCents);
  });
});
