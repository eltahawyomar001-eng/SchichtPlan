/**
 * Structural checks on the generated CII.
 *
 * These are NOT a substitute for the KoSIT validator — only it can say whether
 * an invoice is accepted. They catch the mistakes that would otherwise waste a
 * validator run: malformed XML, a missing mandatory field, totals that
 * disagree with the lines, an unescaped ampersand in a company name.
 *
 * The validator suite lives in scripts/validate-einvoices.sh and runs the same
 * fixtures.
 */
import { describe, it, expect } from "vitest";
import { GOLDEN_INVOICES } from "@/lib/e-invoice/fixtures";
import { buildCii, PROFILE } from "@/lib/e-invoice/cii";
import {
  computeEInvoiceTotals,
  type InvoiceLine,
} from "@/lib/e-invoice/totals";

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error(`XML is not well-formed: ${err.textContent}`);
  return doc;
}

/** Text of the first element with this local name, ignoring namespaces. */
function text(doc: Document, localName: string): string | null {
  const el = [...doc.getElementsByTagName("*")].find(
    (e) => e.localName === localName,
  );
  return el?.textContent ?? null;
}

function all(doc: Document, localName: string): Element[] {
  return [...doc.getElementsByTagName("*")].filter(
    (e) => e.localName === localName,
  );
}

/**
 * A value from the header summation specifically.
 *
 * `LineTotalAmount` appears on every LINE as well as on the header, and the
 * lines come first in document order, so a document-wide lookup silently
 * returns the first line's amount instead of the invoice total.
 */
function headerTotal(doc: Document, localName: string): number {
  const summation = all(
    doc,
    "SpecifiedTradeSettlementHeaderMonetarySummation",
  )[0];
  const el = [...summation.getElementsByTagName("*")].find(
    (e) => e.localName === localName,
  );
  return Number(el?.textContent ?? NaN);
}

describe.each(Object.entries(GOLDEN_INVOICES))("%s invoice", (name, make) => {
  const xml = make();
  const doc = parse(xml);

  it("is well-formed XML", () => {
    expect(doc.documentElement.localName).toBe("CrossIndustryInvoice");
  });

  it("declares a specification identifier (BT-24)", () => {
    // Without it the recipient cannot know which ruleset to validate against,
    // and KoSIT rejects the document before looking at anything else.
    expect(text(doc, "GuidelineSpecifiedDocumentContextParameter")).toContain(
      "urn:cen.eu:en16931:2017",
    );
  });

  it("carries the mandatory § 14 UStG header fields", () => {
    expect(text(doc, "ID")).toBeTruthy(); // BT-1 invoice number
    expect(text(doc, "TypeCode")).toMatch(/^38[01]$/); // BT-3
    expect(text(doc, "DateTimeString")).toMatch(/^\d{8}$/); // BT-2
    expect(text(doc, "InvoiceCurrencyCode")).toBe("EUR"); // BT-5
  });

  it("identifies both parties with a full postal address", () => {
    // EN 16931 wants the address in parts; a missing city or country is a
    // schema error, not a cosmetic gap.
    const names = all(doc, "Name").map((e) => e.textContent);
    expect(names.length).toBeGreaterThanOrEqual(2);
    for (const field of ["PostcodeCode", "LineOne", "CityName", "CountryID"]) {
      expect(all(doc, field).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives the seller a tax identifier", () => {
    // § 14 Abs. 4 UStG accepts either the VAT ID or the Steuernummer, so the
    // test accepts either scheme but insists on one of them.
    const schemes = all(doc, "ID")
      .map((e) => e.getAttribute("schemeID"))
      .filter(Boolean);
    expect(schemes.some((s) => s === "VA" || s === "FC")).toBe(true);
  });

  it("states the total as basis + tax, consistent with its own lines", () => {
    // BR-CO-10, BR-CO-13 and BR-CO-15, checked arithmetically rather than
    // trusting the builder.
    const lineTotal = headerTotal(doc, "LineTotalAmount");
    const basis = headerTotal(doc, "TaxBasisTotalAmount");
    const tax = headerTotal(doc, "TaxTotalAmount");
    const grand = headerTotal(doc, "GrandTotalAmount");
    const due = headerTotal(doc, "DuePayableAmount");

    expect(basis).toBeCloseTo(lineTotal, 2);
    expect(grand).toBeCloseTo(basis + tax, 2);
    expect(due).toBeCloseTo(grand, 2);
  });

  it("sums the line amounts to the line total", () => {
    const lines = all(doc, "IncludedSupplyChainTradeLineItem");
    const sum = lines.reduce((acc, el) => {
      const amount = [...el.getElementsByTagName("*")].find(
        (e) => e.localName === "LineTotalAmount",
      );
      return acc + Number(amount?.textContent ?? 0);
    }, 0);
    expect(sum).toBeCloseTo(headerTotal(doc, "LineTotalAmount"), 2);
  });

  it(`matches the committed shape for ${name}`, () => {
    // Golden file: a change to the XML is a deliberate act, because the
    // archived copy of an issued invoice must stay byte-stable.
    expect(xml).toMatchSnapshot();
  });
});

describe("tax categories", () => {
  it("gives a Kleinunternehmer invoice category E with a § 19 reason", () => {
    const doc = parse(GOLDEN_INVOICES.kleinunternehmer());
    expect(all(doc, "CategoryCode").map((e) => e.textContent)).toContain("E");
    expect(text(doc, "ExemptionReason")).toContain("§ 19 UStG");
    expect(headerTotal(doc, "TaxTotalAmount")).toBe(0);
  });

  it("gives an ordinary invoice category S and a non-zero tax", () => {
    const doc = parse(GOLDEN_INVOICES.standard());
    expect(all(doc, "CategoryCode").map((e) => e.textContent)).toContain("S");
    expect(headerTotal(doc, "TaxTotalAmount")).toBeGreaterThan(0);
  });

  it("writes one tax breakdown per rate", () => {
    // The standard fixture mixes 19 % and 7 %, which the old single-rate model
    // could not express at all.
    const doc = parse(GOLDEN_INVOICES.standard());
    const rates = all(doc, "ApplicableTradeTax")
      .filter(
        (e) => e.parentElement?.localName === "ApplicableHeaderTradeSettlement",
      )
      .map(
        (e) =>
          [...e.getElementsByTagName("*")].find(
            (c) => c.localName === "RateApplicablePercent",
          )?.textContent,
      );
    expect(new Set(rates)).toEqual(new Set(["19.00", "7.00"]));
  });
});

describe("B2G and corrections", () => {
  it("carries the Leitweg-ID as BuyerReference (BT-10)", () => {
    const doc = parse(GOLDEN_INVOICES["b2g-leitweg"]());
    expect(text(doc, "BuyerReference")).toBe("991-12345-67");
  });

  it("marks a Storno as a credit note referring to the original", () => {
    // BT-3 = 381 and BT-25: a correction that does not name what it corrects
    // breaks the audit trail GoBD requires.
    const doc = parse(GOLDEN_INVOICES.storno());
    expect(text(doc, "TypeCode")).toBe("381");
    expect(text(doc, "InvoiceReferencedDocument")).toContain("RE-2026-0001");
    // POSITIVE: BR-27 forbids a negative item net price. A credit note is
    // signalled by BT-3 = 381, not by negating the amounts.
    expect(headerTotal(doc, "GrandTotalAmount")).toBeGreaterThan(0);
  });
});

describe("escaping", () => {
  it("escapes characters that would otherwise break the document", () => {
    // "Müller & Söhne" is an ordinary German company name and an unescaped
    // ampersand makes the XML unparseable.
    const lines: InvoiceLine[] = [
      {
        description: 'Reinigung "Haus A" & Außenanlage',
        quantity: 1,
        unitPriceCents: 10000,
        vatRate: 19,
        category: "S",
      },
    ];
    const xml = buildCii({
      profile: PROFILE.ZUGFERD_EN16931,
      number: "RE-2026-0099",
      typeCode: "380",
      issueDate: new Date(Date.UTC(2026, 0, 2)),
      currency: "EUR",
      seller: {
        name: "Müller & Söhne GmbH",
        street: "Hauptstraße 1",
        postalCode: "10115",
        city: "Berlin",
        countryCode: "DE",
        vatId: "DE111111111",
      },
      buyer: {
        name: "A<B> Verwaltung",
        street: "Nebenweg 2",
        postalCode: "20095",
        city: "Hamburg",
        countryCode: "DE",
      },
      lines,
      totals: computeEInvoiceTotals(lines),
    });

    expect(() => parse(xml)).not.toThrow();
    expect(xml).toContain("Müller &amp; Söhne GmbH");
    expect(xml).toContain("A&lt;B&gt; Verwaltung");
  });
});
