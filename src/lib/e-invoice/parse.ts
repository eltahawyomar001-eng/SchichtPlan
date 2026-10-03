/**
 * Reading an e-invoice someone else sent us.
 *
 * Receiving has been mandatory for every German business since 1 January 2025
 * -- earlier than the obligation to SEND -- so this is the half of the law
 * that already applies to our customers today.
 *
 * Two syntaxes, not one. EN 16931 is a data model, and XRechnung can arrive as
 * either UN/CEFACT CII (what we generate) or OASIS UBL. A receiving system
 * that handles only one rejects perfectly valid invoices from about half the
 * market, so both are mapped here onto a single shape.
 *
 * Everything here treats its input as hostile. The XML comes from outside, and
 * the parser is configured to process no DTDs and no external entities:
 * entity expansion and external-entity resolution are the two classic ways a
 * document like this reads files off the server or exhausts its memory.
 */

import { XMLParser, XMLValidator } from "fast-xml-parser";

export type InvoiceSyntax = "CII" | "UBL";

export interface ParsedParty {
  name: string | null;
  vatId: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
}

export interface ParsedLine {
  description: string | null;
  quantity: number | null;
  netCents: number | null;
}

export interface ParsedInvoice {
  syntax: InvoiceSyntax;
  /** BT-24, the ruleset the sender claims to follow. */
  profile: string | null;
  /** BT-1. */
  number: string | null;
  /** BT-3. 380 invoice, 381 credit note. */
  typeCode: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  currency: string | null;
  seller: ParsedParty;
  buyer: ParsedParty;
  netCents: number | null;
  taxCents: number | null;
  grossCents: number | null;
  payableCents: number | null;
  lines: ParsedLine[];
  /** BT-25, when the document corrects another. */
  precedingInvoiceNumber: string | null;
}

export class InvoiceParseError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "InvoiceParseError";
  }
}

/**
 * Hardened parser.
 *
 * `processEntities: false` is the important one: it stops both external-entity
 * resolution (reading files off this server) and recursive entity expansion
 * (the "billion laughs" memory exhaustion). Neither has any legitimate use in
 * an invoice.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Namespace prefixes vary between senders -- ram:, cac:, n1: -- and matching
  // on them would make the parser depend on the sender's choice of prefix.
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/** First defined value among the given paths. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(root: any, ...paths: string[]): any {
  for (const path of paths) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = root;
    let ok = true;
    for (const seg of path.split(".")) {
      if (cur === null || cur === undefined) {
        ok = false;
        break;
      }
      // Repeated elements arrive as arrays; the first is the one meant when a
      // path addresses a single value.
      if (Array.isArray(cur)) cur = cur[0];
      cur = cur?.[seg];
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

/** A node's text, whether it came through as a string or as {#text}. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function text(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const t = v["#text"];
    return t === undefined || t === null ? null : String(t).trim() || null;
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * A decimal amount as integer cents.
 *
 * Via string inspection rather than `Math.round(parseFloat(x) * 100)`, because
 * that expression is wrong for values like 8.015 that cannot be represented
 * exactly in binary floating point -- and being one cent out on a received
 * invoice means it will not reconcile against the payment.
 */
export function amountToCents(raw: unknown): number | null {
  const s = text(raw);
  if (s === null) return null;
  const m = /^(-?)(\d+)(?:[.,](\d*))?$/.exec(s.replace(/\s/g, ""));
  if (!m) return null;
  const [, sign, whole, frac = ""] = m;
  const cents = frac.padEnd(2, "0").slice(0, 2);
  // Third decimal onwards decides the rounding of the second.
  const rest = frac.slice(2);
  let value = Number(whole) * 100 + Number(cents || "0");
  if (rest && Number(rest[0]) >= 5) value += 1;
  return sign === "-" ? -value : value;
}

/** A date in either CII's yyyyMMdd (format 102) or UBL's ISO yyyy-MM-dd. */
export function parseInvoiceDate(raw: unknown): Date | null {
  const s = text(raw);
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

function num(raw: unknown): number | null {
  const s = text(raw);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const EMPTY_PARTY: ParsedParty = {
  name: null,
  vatId: null,
  street: null,
  postalCode: null,
  city: null,
  countryCode: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ciiParty(node: any): ParsedParty {
  if (!node) return { ...EMPTY_PARTY };
  const addr = pick(node, "PostalTradeAddress");
  // The VAT ID sits in a repeated element distinguished only by a scheme
  // attribute: VA is the VAT registration, FC the Steuernummer. Taking the
  // first one would silently return a Steuernummer as a VAT ID.
  const regs = pick(node, "SpecifiedTaxRegistration");
  const list = Array.isArray(regs) ? regs : regs ? [regs] : [];
  let vatId: string | null = null;
  for (const r of list) {
    const id = pick(r, "ID");
    const scheme = Array.isArray(id)
      ? id[0]?.["@_schemeID"]
      : id?.["@_schemeID"];
    if (scheme === "VA") {
      vatId = text(id);
      break;
    }
  }
  return {
    name: text(pick(node, "Name")),
    vatId,
    street: text(pick(addr, "LineOne")),
    postalCode: text(pick(addr, "PostcodeCode")),
    city: text(pick(addr, "CityName")),
    countryCode: text(pick(addr, "CountryID")),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ublParty(node: any): ParsedParty {
  if (!node) return { ...EMPTY_PARTY };
  const addr = pick(node, "PostalAddress");
  return {
    name:
      text(pick(node, "PartyLegalEntity.RegistrationName")) ??
      text(pick(node, "PartyName.Name")),
    vatId: text(pick(node, "PartyTaxScheme.CompanyID")),
    street: text(pick(addr, "StreetName")),
    postalCode: text(pick(addr, "PostalZone")),
    city: text(pick(addr, "CityName")),
    countryCode: text(pick(addr, "Country.IdentificationCode")),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): any[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCii(doc: any): ParsedInvoice {
  const ctx = pick(doc, "ExchangedDocumentContext");
  const head = pick(doc, "ExchangedDocument");
  const trade = pick(doc, "SupplyChainTradeTransaction");
  const agreement = pick(trade, "ApplicableHeaderTradeAgreement");
  const settlement = pick(trade, "ApplicableHeaderTradeSettlement");
  const sum = pick(
    settlement,
    "SpecifiedTradeSettlementHeaderMonetarySummation",
  );
  const terms = pick(settlement, "SpecifiedTradePaymentTerms");

  return {
    syntax: "CII",
    profile: text(pick(ctx, "GuidelineSpecifiedDocumentContextParameter.ID")),
    number: text(pick(head, "ID")),
    typeCode: text(pick(head, "TypeCode")),
    issueDate: parseInvoiceDate(pick(head, "IssueDateTime.DateTimeString")),
    dueDate: parseInvoiceDate(pick(terms, "DueDateDateTime.DateTimeString")),
    currency: text(pick(settlement, "InvoiceCurrencyCode")),
    seller: ciiParty(pick(agreement, "SellerTradeParty")),
    buyer: ciiParty(pick(agreement, "BuyerTradeParty")),
    netCents: amountToCents(pick(sum, "TaxBasisTotalAmount")),
    taxCents: amountToCents(pick(sum, "TaxTotalAmount")),
    grossCents: amountToCents(pick(sum, "GrandTotalAmount")),
    payableCents: amountToCents(pick(sum, "DuePayableAmount")),
    precedingInvoiceNumber: text(
      pick(settlement, "InvoiceReferencedDocument.IssuerAssignedID"),
    ),
    lines: asArray(pick(trade, "IncludedSupplyChainTradeLineItem")).map(
      (l) => ({
        description:
          text(pick(l, "SpecifiedTradeProduct.Name")) ??
          text(pick(l, "AssociatedDocumentLineDocument.Content")),
        quantity: num(pick(l, "SpecifiedLineTradeDelivery.BilledQuantity")),
        netCents: amountToCents(
          pick(
            l,
            "SpecifiedLineTradeSettlement.SpecifiedTradeSettlementLineMonetarySummation.LineTotalAmount",
          ),
        ),
      }),
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseUbl(doc: any, isCreditNote: boolean): ParsedInvoice {
  const totals = pick(doc, "LegalMonetaryTotal");
  const taxTotal = pick(doc, "TaxTotal");
  const lineTag = isCreditNote ? "CreditNoteLine" : "InvoiceLine";
  const qtyTag = isCreditNote ? "CreditedQuantity" : "InvoicedQuantity";

  return {
    syntax: "UBL",
    profile: text(pick(doc, "CustomizationID")),
    number: text(pick(doc, "ID")),
    // UBL carries the type code only on an invoice; a credit note is
    // identified by its ROOT ELEMENT instead, so 381 has to be supplied here.
    typeCode: isCreditNote
      ? "381"
      : (text(pick(doc, "InvoiceTypeCode")) ?? "380"),
    issueDate: parseInvoiceDate(pick(doc, "IssueDate")),
    dueDate: parseInvoiceDate(pick(doc, "DueDate")),
    currency: text(pick(doc, "DocumentCurrencyCode")),
    seller: ublParty(pick(doc, "AccountingSupplierParty.Party")),
    buyer: ublParty(pick(doc, "AccountingCustomerParty.Party")),
    netCents: amountToCents(pick(totals, "TaxExclusiveAmount")),
    taxCents: amountToCents(pick(taxTotal, "TaxAmount")),
    grossCents: amountToCents(pick(totals, "TaxInclusiveAmount")),
    payableCents: amountToCents(pick(totals, "PayableAmount")),
    precedingInvoiceNumber: text(
      pick(doc, "BillingReference.InvoiceDocumentReference.ID"),
    ),
    lines: asArray(pick(doc, lineTag)).map((l) => ({
      description:
        text(pick(l, "Item.Name")) ?? text(pick(l, "Item.Description")),
      quantity: num(pick(l, qtyTag)),
      netCents: amountToCents(pick(l, "LineExtensionAmount")),
    })),
  };
}

/** Parse an incoming e-invoice in either syntax. */
export function parseEInvoice(xml: string): ParsedInvoice {
  if (!xml || !xml.trim()) {
    throw new InvoiceParseError("Die Datei ist leer.", "EMPTY");
  }
  // Rejected before parsing rather than relying on the parser's own handling:
  // a document declaring a DTD has no legitimate reason to be an invoice, and
  // this is the cheapest point to refuse it.
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new InvoiceParseError(
      "Die Datei enthält eine Dokumenttyp-Definition und wird aus Sicherheitsgründen abgelehnt.",
      "DTD_REJECTED",
    );
  }

  // Validated BEFORE parsing, because the parser is lenient: given
  // "<Invoice><unclosed>" it returns an object rather than throwing, and the
  // result is a near-empty invoice that looks successfully imported. A
  // truncated upload is exactly how that happens in practice.
  const check = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (check !== true) {
    throw new InvoiceParseError(
      `Die Datei ist kein gültiges XML: ${check.err.msg} (Zeile ${check.err.line}).`,
      "MALFORMED",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (err) {
    throw new InvoiceParseError(
      `Die Datei konnte nicht als XML gelesen werden: ${err instanceof Error ? err.message : String(err)}`,
      "MALFORMED",
    );
  }

  if (doc?.CrossIndustryInvoice) return parseCii(doc.CrossIndustryInvoice);
  if (doc?.Invoice) return parseUbl(doc.Invoice, false);
  if (doc?.CreditNote) return parseUbl(doc.CreditNote, true);

  throw new InvoiceParseError(
    "Die Datei ist keine E-Rechnung im Format XRechnung oder ZUGFeRD (CII oder UBL).",
    "UNKNOWN_FORMAT",
  );
}

/**
 * Whether a parsed invoice carries enough to be booked.
 *
 * Deliberately NOT a validity verdict. A received invoice is the sender's
 * document and we do not get to reject it on a technicality; this only tells
 * the user what they will have to fill in by hand.
 */
export function missingKeyFields(inv: ParsedInvoice): string[] {
  const missing: string[] = [];
  if (!inv.number) missing.push("Rechnungsnummer");
  if (!inv.issueDate) missing.push("Rechnungsdatum");
  if (!inv.seller.name) missing.push("Name des Rechnungsstellers");
  if (inv.grossCents === null) missing.push("Rechnungsbetrag");
  return missing;
}
