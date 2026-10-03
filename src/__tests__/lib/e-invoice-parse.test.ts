/**
 * Reading e-invoices other systems sent us.
 *
 * Receiving has been mandatory for every German business since 1 January 2025,
 * earlier than the obligation to send, so this is the half of the law that
 * already binds our customers.
 *
 * The strongest test available is a round trip: parse the very invoices the
 * KoSIT validator accepted and check the figures come back. Anything the
 * parser gets wrong there, it would get wrong on a real supplier's invoice.
 */
import { describe, it, expect } from "vitest";
import {
  amountToCents,
  InvoiceParseError,
  missingKeyFields,
  parseEInvoice,
  parseInvoiceDate,
} from "@/lib/e-invoice/parse";
import { GOLDEN_INVOICES, ASSEMBLED_INVOICES } from "@/lib/e-invoice/fixtures";

describe("amounts", () => {
  it("converts decimals to integer cents", () => {
    expect(amountToCents("1234.56")).toBe(123456);
    expect(amountToCents("0.01")).toBe(1);
    expect(amountToCents("100")).toBe(10000);
  });

  it("avoids binary floating point error", () => {
    // Math.round(parseFloat("8.015") * 100) gives 801, not 802, because 8.015
    // has no exact binary representation. One cent out means a received
    // invoice will not reconcile against the payment.
    expect(amountToCents("8.015")).toBe(802);
    expect(amountToCents("1.005")).toBe(101);
  });

  it("accepts a comma as the decimal separator", () => {
    expect(amountToCents("1234,56")).toBe(123456);
  });

  it("handles negatives", () => {
    expect(amountToCents("-50.00")).toBe(-5000);
  });

  it("returns null for nonsense rather than NaN", () => {
    // NaN propagates silently into a total; null is visible.
    expect(amountToCents("abc")).toBeNull();
    expect(amountToCents("")).toBeNull();
    expect(amountToCents(undefined)).toBeNull();
  });
});

describe("dates", () => {
  it("reads CII format 102 (yyyyMMdd)", () => {
    expect(parseInvoiceDate("20261003")).toEqual(
      new Date(Date.UTC(2026, 9, 3)),
    );
  });

  it("reads UBL ISO dates", () => {
    expect(parseInvoiceDate("2026-10-03")).toEqual(
      new Date(Date.UTC(2026, 9, 3)),
    );
  });

  it("returns null for an unparseable date", () => {
    expect(parseInvoiceDate("03.10.2026")).toBeNull();
    expect(parseInvoiceDate("")).toBeNull();
  });
});

describe("hostile input", () => {
  it("rejects a document type definition outright", () => {
    // The billion-laughs attack and external-entity file reads both arrive
    // this way, and no legitimate invoice declares a DTD.
    const xml = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY a "boom">]><Invoice/>`;
    expect(() => parseEInvoice(xml)).toThrow(InvoiceParseError);
    try {
      parseEInvoice(xml);
    } catch (e) {
      expect((e as InvoiceParseError).code).toBe("DTD_REJECTED");
    }
  });

  it("rejects an entity declaration even without a DOCTYPE", () => {
    expect(() =>
      parseEInvoice(`<!ENTITY xxe SYSTEM "file:///etc/passwd"><Invoice/>`),
    ).toThrow(InvoiceParseError);
  });

  it("rejects an empty file", () => {
    expect(() => parseEInvoice("   ")).toThrow(InvoiceParseError);
  });

  it("rejects something that is not an invoice at all", () => {
    try {
      parseEInvoice("<html><body>hello</body></html>");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as InvoiceParseError).code).toBe("UNKNOWN_FORMAT");
    }
  });

  it("rejects malformed XML with a readable message", () => {
    try {
      parseEInvoice("<Invoice><unclosed>");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(InvoiceParseError);
    }
  });
});

describe("round trip through our own CII", () => {
  // These are the exact documents the KoSIT validator accepted.
  it("reads back the standard invoice", () => {
    const inv = parseEInvoice(GOLDEN_INVOICES.standard());
    expect(inv.syntax).toBe("CII");
    expect(inv.number).toBe("RE-2026-0001");
    expect(inv.typeCode).toBe("380");
    expect(inv.issueDate).toEqual(new Date(Date.UTC(2026, 9, 3)));
    expect(inv.currency).toBe("EUR");
    expect(inv.seller.name).toBe("Musterreinigung Rhein-Neckar GmbH");
    expect(inv.seller.vatId).toBe("DE123456789");
    expect(inv.buyer.name).toBe("Beispiel Immobilienverwaltung GmbH");
    expect(inv.seller.city).toBe("Mannheim");
    expect(inv.lines).toHaveLength(3);
  });

  it("reads totals that agree with the document's own arithmetic", () => {
    const inv = parseEInvoice(GOLDEN_INVOICES.standard());
    expect(inv.netCents! + inv.taxCents!).toBe(inv.grossCents);
    expect(inv.payableCents).toBe(inv.grossCents);
  });

  it("reads a Kleinunternehmer invoice as having no tax", () => {
    const inv = parseEInvoice(GOLDEN_INVOICES.kleinunternehmer());
    expect(inv.taxCents).toBe(0);
    expect(inv.grossCents).toBe(inv.netCents);
  });

  it("reads the reference on a credit note", () => {
    const inv = parseEInvoice(GOLDEN_INVOICES.storno());
    expect(inv.typeCode).toBe("381");
    expect(inv.precedingInvoiceNumber).toBe("RE-2026-0001");
  });

  it("does not mistake a Steuernummer for a VAT ID", () => {
    // Both live in SpecifiedTaxRegistration, told apart only by schemeID:
    // VA is the VAT registration, FC the Steuernummer. Taking the first
    // would return the wrong number under the right label.
    const inv = parseEInvoice(GOLDEN_INVOICES.kleinunternehmer());
    expect(inv.seller.vatId).toBeNull();
  });

  it("reads every invoice we generate", () => {
    for (const [name, make] of Object.entries({
      ...GOLDEN_INVOICES,
      ...ASSEMBLED_INVOICES,
    })) {
      const inv = parseEInvoice(make());
      expect(inv.number, name).toBeTruthy();
      expect(inv.grossCents, name).not.toBeNull();
      expect(inv.seller.name, name).toBeTruthy();
    }
  });
});

describe("UBL", () => {
  // XRechnung may arrive as UBL rather than CII, and a receiving system that
  // handles only one turns away perfectly valid invoices from roughly half
  // the market.
  const ubl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ID>LIEF-2026-0815</cbc:ID>
  <cbc:IssueDate>2026-09-15</cbc:IssueDate>
  <cbc:DueDate>2026-09-29</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PostalAddress>
      <cbc:StreetName>Lieferweg 7</cbc:StreetName>
      <cbc:CityName>Köln</cbc:CityName>
      <cbc:PostalZone>50667</cbc:PostalZone>
      <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
    </cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>DE555666777</cbc:CompanyID></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>Muster Lieferant GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>Unsere Firma GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">190.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="EUR">1000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">1190.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:InvoicedQuantity unitCode="HUR">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">1000.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Reinigungsmittel</cbc:Name></cac:Item>
  </cac:InvoiceLine>
</Invoice>`;

  it("reads a UBL invoice", () => {
    const inv = parseEInvoice(ubl);
    expect(inv.syntax).toBe("UBL");
    expect(inv.number).toBe("LIEF-2026-0815");
    expect(inv.typeCode).toBe("380");
    expect(inv.issueDate).toEqual(new Date(Date.UTC(2026, 8, 15)));
    expect(inv.seller.name).toBe("Muster Lieferant GmbH");
    expect(inv.seller.vatId).toBe("DE555666777");
    expect(inv.seller.city).toBe("Köln");
    expect(inv.netCents).toBe(100000);
    expect(inv.taxCents).toBe(19000);
    expect(inv.grossCents).toBe(119000);
    expect(inv.lines).toHaveLength(1);
    expect(inv.lines[0].description).toBe("Reinigungsmittel");
  });

  it("identifies a UBL credit note by its root element", () => {
    // UBL carries no type code on a credit note: the root element IS the
    // type, so a parser keyed on InvoiceTypeCode reports it as an invoice
    // and the amount is booked with the wrong sign.
    const cn = ubl
      .replace("<Invoice ", "<CreditNote ")
      .replace("</Invoice>", "</CreditNote>")
      .replace("InvoiceLine", "CreditNoteLine")
      .replace("InvoiceLine", "CreditNoteLine")
      .replace("InvoicedQuantity", "CreditedQuantity")
      .replace("InvoicedQuantity", "CreditedQuantity");
    const inv = parseEInvoice(cn);
    expect(inv.syntax).toBe("UBL");
    expect(inv.typeCode).toBe("381");
  });
});

describe("missingKeyFields", () => {
  it("is empty for a complete invoice", () => {
    expect(missingKeyFields(parseEInvoice(GOLDEN_INVOICES.standard()))).toEqual(
      [],
    );
  });

  it("names what a bookkeeper would have to fill in by hand", () => {
    // Not a validity verdict: a received invoice is the sender's document and
    // we do not get to reject it on a technicality.
    const inv = parseEInvoice(GOLDEN_INVOICES.standard());
    inv.number = null;
    inv.grossCents = null;
    expect(missingKeyFields(inv)).toEqual([
      "Rechnungsnummer",
      "Rechnungsbetrag",
    ]);
  });
});
