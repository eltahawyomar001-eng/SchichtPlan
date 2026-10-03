/**
 * UN/CEFACT Cross Industry Invoice (CII), the syntax behind both XRechnung and
 * ZUGFeRD.
 *
 * Written by hand rather than taken from a library, deliberately. The two
 * candidates were `node-zugferd`, still 0.1.x beta and last published in August
 * 2025, and `@e-invoice-eu/core`, actively maintained but licensed WTFPL --
 * which under § 29 UrhG cannot do what it claims, since German authors cannot
 * waive their rights that way. Neither is something to put under a document
 * that is legally binding on our customers. The EN 16931 subset we need is
 * small and stable, and the KoSIT validator -- not a library's promises -- is
 * what actually proves the output is correct.
 *
 * Element ORDER is significant: CII is defined by XSD sequences, so a correct
 * element in the wrong position is a schema error. The order here follows the
 * EN 16931 CII syntax binding and should not be rearranged for readability.
 */

import type { EInvoiceTotals, InvoiceLine, TaxCategory } from "./totals";
import { lineNetCents } from "./totals";

/**
 * Specification identifiers (BT-24).
 *
 * XRechnung pins a VERSION, and KoSIT retires old ones: an invoice claiming a
 * version the recipient's validator no longer accepts is rejected outright.
 * Keep this in step with the configuration the validator in CI runs, and treat
 * a bump as a deliberate change rather than a dependency update.
 */
export const PROFILE = {
  /**
   * XRechnung 3.0 (CII). The German public-sector standard.
   *
   * The namespace is `xeinkauf.de:kosit`, NOT the older
   * `xoev-de:kosit:standard` that most tutorials still show. KoSIT moved it,
   * and the validator matches a document to a ruleset by this string alone:
   * get it wrong and every invoice is rejected with "no scenario matched",
   * which says nothing about the actual content. Taken from scenarios.xml in
   * the configuration the validator runs, which is the only authority on it.
   */
  XRECHNUNG:
    "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
  /** ZUGFeRD 2.x profile EN 16931 (COMFORT). */
  ZUGFERD_EN16931: "urn:cen.eu:en16931:2017",
} as const;

/** BT-3. 380 = invoice, 381 = credit note. */
export type DocumentTypeCode = "380" | "381";

export interface Party {
  name: string;
  street: string;
  addressLine2?: string | null;
  postalCode: string;
  city: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  vatId?: string | null;
  /** German Steuernummer, used when there is no VAT ID. */
  taxNumber?: string | null;
  /**
   * BT-34/BT-49, the electronic address.
   *
   * Mandatory for BOTH parties under PEPPOL-EN16931-R020 and R010; an invoice
   * without one is rejected even though nothing about it is otherwise wrong.
   */
  email?: string | null;
  /**
   * BG-6, the seller's contact person. BR-DE-2 makes this mandatory in
   * Germany, which is a national rule on top of EN 16931 and therefore absent
   * from most international examples.
   */
  contact?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  /**
   * BT-30, legal registration identifier (Handelsregister).
   *
   * BR-CO-26 needs the seller identifiable by BT-29, BT-30 or BT-31. A German
   * Steuernummer alone does NOT satisfy it, so a Kleinunternehmer with no VAT
   * ID must supply this.
   */
  legalRegistrationId?: string | null;
}

export interface CiiInvoice {
  profile: string;
  /** BT-1. */
  number: string;
  typeCode: DocumentTypeCode;
  /** BT-2. */
  issueDate: Date;
  /** BT-9. */
  dueDate?: Date | null;
  /** BT-5. */
  currency: string;
  seller: Party;
  buyer: Party;
  /**
   * BT-10. The recipient's routing identifier.
   *
   * XRechnung requires it for public-sector recipients, and its presence is
   * what makes an invoice B2G.
   */
  buyerReference?: string | null;
  /** BG-14, the period the service covers. */
  periodStart?: Date | null;
  periodEnd?: Date | null;
  lines: InvoiceLine[];
  totals: EInvoiceTotals;
  /** BT-25/26: the invoice a Storno or Korrektur refers to. */
  precedingInvoiceNumber?: string | null;
  precedingInvoiceDate?: Date | null;
  /** Free-text note (BT-22), e.g. the Leistungsnachweis reference. */
  note?: string | null;
  payment?: {
    iban?: string | null;
    bic?: string | null;
    accountName?: string | null;
    /** BT-20, payment terms as text. */
    terms?: string | null;
  };
}

/** XML text escaping. Customer names legitimately contain & and quotes. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** BT-2 and friends: format 102, i.e. YYYYMMDD. */
function d102(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Cents as a decimal string. CII wants a plain number, never a currency sign. */
function amt(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Quantities keep four decimals; 7.5 hours must not become 8. */
function qty(value: number): string {
  return value
    .toFixed(4)
    .replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
}

function partyXml(tag: string, p: Party): string {
  // The seller's tax registration is split: VA is the VAT ID, FC the German
  // Steuernummer. § 14 Abs. 4 UStG accepts either, so both are emitted when
  // present and the validator checks at least one exists.
  const taxRegs = [
    p.vatId
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vatId)}</ram:ID></ram:SpecifiedTaxRegistration>`
      : "",
    p.taxNumber
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(p.taxNumber)}</ram:ID></ram:SpecifiedTaxRegistration>`
      : "",
  ].join("");

  const contact = p.contact
    ? `\n        <ram:DefinedTradeContact>${
        p.contact.name
          ? `\n          <ram:PersonName>${esc(p.contact.name)}</ram:PersonName>`
          : ""
      }${
        p.contact.phone
          ? `\n          <ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(p.contact.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>`
          : ""
      }${
        p.contact.email
          ? `\n          <ram:EmailURIUniversalCommunication><ram:URIID>${esc(p.contact.email)}</ram:URIID></ram:EmailURIUniversalCommunication>`
          : ""
      }
        </ram:DefinedTradeContact>`
    : "";

  const legalOrg = p.legalRegistrationId
    ? `\n        <ram:SpecifiedLegalOrganization><ram:ID>${esc(p.legalRegistrationId)}</ram:ID></ram:SpecifiedLegalOrganization>`
    : "";

  return `<${tag}>
        <ram:Name>${esc(p.name)}</ram:Name>${legalOrg}${contact}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(p.postalCode)}</ram:PostcodeCode>
          <ram:LineOne>${esc(p.street)}</ram:LineOne>${
            p.addressLine2
              ? `\n          <ram:LineTwo>${esc(p.addressLine2)}</ram:LineTwo>`
              : ""
          }
          <ram:CityName>${esc(p.city)}</ram:CityName>
          <ram:CountryID>${esc(p.countryCode)}</ram:CountryID>
        </ram:PostalTradeAddress>${
          p.email
            ? `\n        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>`
            : ""
        }
        ${taxRegs}
      </${tag}>`;
}

function lineXml(line: InvoiceLine, index: number): string {
  const net = lineNetCents(line);
  const rate = line.category === "S" ? line.vatRate : 0;
  return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${amt(line.unitPriceCents)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${esc(line.unitCode ?? "C62")}">${qty(line.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${line.category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${rate.toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${amt(net)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
}

function taxXml(
  row: EInvoiceTotals["breakdown"][number],
  category: TaxCategory,
): string {
  // BT-120 is mandatory for every category except S. Emitted only when the
  // caller supplied one: inventing a plausible reason would be worse than
  // letting the validator reject a document that is genuinely incomplete.
  const reason = row.exemptionReason
    ? `\n          <ram:ExemptionReason>${esc(row.exemptionReason)}</ram:ExemptionReason>`
    : "";
  return `        <ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${amt(row.taxCents)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>${reason}
          <ram:BasisAmount>${amt(row.taxableCents)}</ram:BasisAmount>
          <ram:CategoryCode>${category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${row.rate.toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`;
}

/** Render the invoice as EN 16931 CII XML. */
export function buildCii(inv: CiiInvoice): string {
  const t = inv.totals;

  const period =
    inv.periodStart && inv.periodEnd
      ? `\n        <ram:BillingSpecifiedPeriod>
          <ram:StartDateTime><udt:DateTimeString format="102">${d102(inv.periodStart)}</udt:DateTimeString></ram:StartDateTime>
          <ram:EndDateTime><udt:DateTimeString format="102">${d102(inv.periodEnd)}</udt:DateTimeString></ram:EndDateTime>
        </ram:BillingSpecifiedPeriod>`
      : "";

  const preceding = inv.precedingInvoiceNumber
    ? `\n        <ram:InvoiceReferencedDocument>
          <ram:IssuerAssignedID>${esc(inv.precedingInvoiceNumber)}</ram:IssuerAssignedID>${
            inv.precedingInvoiceDate
              ? `\n          <ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${d102(inv.precedingInvoiceDate)}</qdt:DateTimeString></ram:FormattedIssueDateTime>`
              : ""
          }
        </ram:InvoiceReferencedDocument>`
    : "";

  const payment = inv.payment?.iban
    ? `\n        <ram:SpecifiedTradeSettlementPaymentMeans>
          <ram:TypeCode>58</ram:TypeCode>
          <ram:PayeePartyCreditorFinancialAccount>
            <ram:IBANID>${esc(inv.payment.iban)}</ram:IBANID>${
              inv.payment.accountName
                ? `\n            <ram:AccountName>${esc(inv.payment.accountName)}</ram:AccountName>`
                : ""
            }
          </ram:PayeePartyCreditorFinancialAccount>${
            inv.payment.bic
              ? `\n          <ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${esc(inv.payment.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>`
              : ""
          }
        </ram:SpecifiedTradeSettlementPaymentMeans>`
    : "";

  const terms =
    inv.dueDate || inv.payment?.terms
      ? `\n        <ram:SpecifiedTradePaymentTerms>${
          inv.payment?.terms
            ? `\n          <ram:Description>${esc(inv.payment.terms)}</ram:Description>`
            : ""
        }${
          inv.dueDate
            ? `\n          <ram:DueDateDateTime><udt:DateTimeString format="102">${d102(inv.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>`
            : ""
        }
        </ram:SpecifiedTradePaymentTerms>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <!--
      BT-23. PEPPOL-EN16931-R001 requires it, and it must precede the guideline
      parameter: CII is an XSD sequence, so order is part of validity.
    -->
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${esc(inv.profile)}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.number)}</ram:ID>
    <ram:TypeCode>${inv.typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${d102(inv.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>${
      inv.note
        ? `\n    <ram:IncludedNote><ram:Content>${esc(inv.note)}</ram:Content></ram:IncludedNote>`
        : ""
    }
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${inv.lines.map(lineXml).join("\n")}
    <ram:ApplicableHeaderTradeAgreement>${
      inv.buyerReference
        ? `\n      <ram:BuyerReference>${esc(inv.buyerReference)}</ram:BuyerReference>`
        : ""
    }
      ${partyXml("ram:SellerTradeParty", inv.seller)}
      ${partyXml("ram:BuyerTradeParty", inv.buyer)}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${d102(inv.periodEnd ?? inv.issueDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${esc(inv.currency)}</ram:InvoiceCurrencyCode>${payment}
${t.breakdown.map((r) => taxXml(r, r.category)).join("\n")}${period}${terms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(t.lineTotalCents)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(t.taxBasisCents)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${esc(inv.currency)}">${amt(t.taxTotalCents)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(t.grandTotalCents)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amt(t.payableCents)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${preceding}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
