/**
 * The gate in front of an irreversible step.
 *
 * Every case here is a field whose absence produces either a document the
 * recipient's system rejects outright, or one it accepts while costing them
 * the input-tax deduction. The second kind is the dangerous one: nothing
 * visibly fails, and the customer finds out from their tax adviser months
 * later, so these are worth pinning down individually rather than as one
 * "is it complete" assertion.
 */
import { describe, it, expect } from "vitest";
import {
  preflightInvoice,
  type PreflightClient,
  type PreflightInvoice,
  type PreflightIssuer,
} from "@/lib/e-invoice/preflight";

const issuer = (over: Partial<PreflightIssuer> = {}): PreflightIssuer => ({
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
  ...over,
});

const client = (over: Partial<PreflightClient> = {}): PreflightClient => ({
  name: "Beispiel Immobilienverwaltung GmbH",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "DE",
  invoiceEmail: "kreditoren@beispiel-immobilien.example",
  ...over,
});

const invoice = (over: Partial<PreflightInvoice> = {}): PreflightInvoice => ({
  issueDate: new Date("2026-10-03"),
  lines: [
    {
      description: "Unterhaltsreinigung September 2026",
      quantity: 10,
      unitPriceCents: 2850,
      vatRate: 19,
      category: "S",
    },
  ],
  ...over,
});

const run = (over: {
  issuer?: PreflightIssuer | null;
  client?: PreflightClient | null;
  invoice?: PreflightInvoice;
}) =>
  preflightInvoice({
    issuer: over.issuer === undefined ? issuer() : over.issuer,
    client: over.client === undefined ? client() : over.client,
    invoice: over.invoice ?? invoice(),
  });

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

describe("a complete invoice", () => {
  it("has nothing blocking it", () => {
    expect(run({})).toEqual([]);
  });
});

describe("reporting", () => {
  it("returns every problem at once, not just the first", () => {
    // Someone fixing their master data should see the whole list. Discovering
    // a second missing field after fixing the first is how a setup gets
    // abandoned halfway.
    const issues = run({
      issuer: issuer({ legalName: "", vatId: null, taxNumber: null, iban: "" }),
    });
    expect(issues.length).toBeGreaterThan(2);
    expect(codes(issues)).toContain("ISSUER_NAME_MISSING");
    expect(codes(issues)).toContain("ISSUER_TAX_ID_MISSING");
    expect(codes(issues)).toContain("ISSUER_IBAN_MISSING");
  });

  it("names the form each fix lives in", () => {
    const issues = run({ client: client({ street: "" }) });
    expect(issues[0].scope).toBe("client");
  });

  it("explains where to fix it, not merely that it is missing", () => {
    const issues = run({ issuer: null });
    expect(issues[0].message).toContain("Einstellungen");
  });

  it("cites the rule behind each block", () => {
    // Support gets asked "why does it want this"; the answer should be on the
    // issue rather than in someone's memory.
    for (const issue of run({ issuer: issuer({ legalName: "" }) })) {
      expect(issue.basis).toBeTruthy();
    }
  });
});

describe("the issuer", () => {
  it("blocks when no issuer profile exists at all", () => {
    expect(codes(run({ issuer: null }))).toContain("ISSUER_MISSING");
  });

  it("accepts a Steuernummer instead of a VAT ID", () => {
    // § 14 Abs. 4 Nr. 2 accepts either. A sole trader often has only the
    // Steuernummer, and refusing that would lock out most of our customers.
    const issues = run({
      issuer: issuer({
        vatId: null,
        taxNumber: "32/123/45678",
        legalRegistrationId: "HRB 712345",
      }),
    });
    expect(codes(issues)).not.toContain("ISSUER_TAX_ID_MISSING");
  });

  it("blocks when neither tax identifier is present", () => {
    const issues = run({ issuer: issuer({ vatId: null, taxNumber: null }) });
    expect(codes(issues)).toContain("ISSUER_TAX_ID_MISSING");
  });

  it("requires a legal registration when there is no VAT ID", () => {
    // BR-CO-26 needs BT-29, BT-30 or BT-31; a Steuernummer is none of them,
    // so this invoice is lawful under German law and still rejected by the
    // recipient's validator.
    const issues = run({
      issuer: issuer({ vatId: null, taxNumber: "32/123/45678" }),
    });
    expect(codes(issues)).toContain("ISSUER_LEGAL_REGISTRATION_MISSING");
  });

  it("does not ask for a legal registration when a VAT ID is present", () => {
    expect(codes(run({}))).not.toContain("ISSUER_LEGAL_REGISTRATION_MISSING");
  });

  it("requires a contact person", () => {
    // BR-DE-2. A national rule, so it is absent from every international
    // EN 16931 example and easy to miss.
    expect(codes(run({ issuer: issuer({ contactName: null }) }))).toContain(
      "ISSUER_CONTACT_MISSING",
    );
  });

  it("requires an IBAN, since an invoice has to be payable", () => {
    expect(codes(run({ issuer: issuer({ iban: null }) }))).toContain(
      "ISSUER_IBAN_MISSING",
    );
  });

  it("treats whitespace as missing", () => {
    // A field containing a space passes a null check and still produces an
    // empty element in the XML.
    expect(codes(run({ issuer: issuer({ legalName: "   " }) }))).toContain(
      "ISSUER_NAME_MISSING",
    );
  });
});

describe("the recipient", () => {
  it("blocks an invoice with no client", () => {
    expect(codes(run({ client: null }))).toContain("CLIENT_MISSING");
  });

  it("requires the address in structured fields", () => {
    // The legacy free-text `address` column cannot be parsed back into BG-8
    // reliably enough for a document that is rejected automatically.
    const issues = run({ client: client({ street: null, postalCode: null }) });
    expect(codes(issues)).toContain("CLIENT_ADDRESS_INCOMPLETE");
    expect(
      issues.find((i) => i.code === "CLIENT_ADDRESS_INCOMPLETE")!.message,
    ).toContain("Freitext");
  });

  it("accepts the general email when no invoicing address is set", () => {
    const issues = run({
      client: client({ invoiceEmail: null, email: "info@beispiel.example" }),
    });
    expect(codes(issues)).not.toContain("CLIENT_EMAIL_MISSING");
  });

  it("blocks when the client has no email at all", () => {
    const issues = run({ client: client({ invoiceEmail: null, email: null }) });
    expect(codes(issues)).toContain("CLIENT_EMAIL_MISSING");
  });
});

describe("the document", () => {
  it("blocks an invoice with no lines", () => {
    expect(codes(run({ invoice: invoice({ lines: [] }) }))).toContain(
      "NO_LINES",
    );
  });

  it("blocks a negative unit price before the number is burnt", () => {
    // BR-27. Catching it here rather than at the validator matters: by the
    // time the validator sees it, the number has already been drawn.
    const issues = run({
      invoice: invoice({
        lines: [
          {
            description: "Storno",
            quantity: 1,
            unitPriceCents: -1000,
            vatRate: 19,
            category: "S",
          },
        ],
      }),
    });
    expect(codes(issues)).toContain("NEGATIVE_UNIT_PRICE");
    expect(
      issues.find((i) => i.code === "NEGATIVE_UNIT_PRICE")!.message,
    ).toContain("Storno");
  });

  it("requires a description on every line", () => {
    const issues = run({
      invoice: invoice({
        lines: [
          {
            description: "  ",
            quantity: 1,
            unitPriceCents: 1000,
            vatRate: 19,
            category: "S",
          },
        ],
      }),
    });
    expect(codes(issues)).toContain("LINE_DESCRIPTION_MISSING");
  });

  it("requires an issue date", () => {
    expect(codes(run({ invoice: invoice({ issueDate: null }) }))).toContain(
      "ISSUE_DATE_MISSING",
    );
  });

  it("makes a Storno name the invoice it reverses", () => {
    const issues = run({
      invoice: invoice({ typeCode: "381", correctsNumber: null }),
    });
    expect(codes(issues)).toContain("CORRECTION_REFERENCE_MISSING");
  });

  it("accepts a Storno that names its original", () => {
    const issues = run({
      invoice: invoice({ typeCode: "381", correctsNumber: "RE-2026-0001" }),
    });
    expect(codes(issues)).not.toContain("CORRECTION_REFERENCE_MISSING");
  });

  it("requires the client VAT ID for a reverse charge", () => {
    // § 13b shifts the liability onto the recipient, which only holds if the
    // recipient is identifiable as a taxable person.
    const issues = run({ invoice: invoice({ reverseCharge: true }) });
    expect(codes(issues)).toContain("REVERSE_CHARGE_WITHOUT_CLIENT_VAT_ID");
  });

  it("accepts a reverse charge when the client has a VAT ID", () => {
    const issues = preflightInvoice({
      issuer: issuer(),
      client: client({ vatId: "DE987654321" }),
      invoice: invoice({ reverseCharge: true }),
    });
    expect(issues).toEqual([]);
  });
});
