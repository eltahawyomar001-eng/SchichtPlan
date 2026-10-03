/**
 * Turning our database rows into the EN 16931 document model.
 *
 * Kept separate from both the DB layer and the XML writer, and pure, because
 * this mapping is where the judgement calls live — which tax category applies,
 * which of several addresses counts, what a missing field falls back to — and
 * those are exactly the decisions worth testing without a database.
 */

import type { CiiInvoice, DocumentTypeCode, Party } from "./cii";
import { PROFILE } from "./cii";
import {
  computeEInvoiceTotals,
  EXEMPTION_REASONS,
  resolveCategory,
  type EInvoiceTotals,
  type InvoiceLine,
} from "./totals";

/** The issuer fields the document needs. Mirrors InvoiceIssuerProfile. */
export interface IssuerInput {
  legalName: string;
  tradingName?: string | null;
  street: string;
  addressLine2?: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  vatId?: string | null;
  taxNumber?: string | null;
  legalRegistrationId?: string | null;
  kleinunternehmer: boolean;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  bankName?: string | null;
  iban?: string | null;
  bic?: string | null;
  paymentTermDays: number;
}

/** The recipient fields the document needs. Mirrors Client. */
export interface ClientInput {
  name: string;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  vatId?: string | null;
  leitwegId?: string | null;
  invoiceEmail?: string | null;
  email?: string | null;
}

export interface InvoiceInput {
  number: string;
  typeCode?: DocumentTypeCode;
  issueDate: Date;
  dueDate?: Date | null;
  title?: string | null;
  notes?: string | null;
  reverseCharge?: boolean;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  /** BT-25/26, for a Storno or Korrektur. */
  correctsNumber?: string | null;
  correctsDate?: Date | null;
  /** Falls back per item when an item carries no rate of its own. */
  vatRate: number;
  items: {
    description: string;
    quantity: number;
    unitPriceCents: number;
    vatRate?: number | null;
    unitCode?: string | null;
  }[];
}

/**
 * The invoice lines, with the tax category resolved per line.
 *
 * The category is NOT stored per item, because it is not a property of the
 * line: it follows from who is issuing (a Kleinunternehmer shows no VAT on
 * anything) and from the invoice (reverse charge applies to the whole
 * document). Deriving it keeps those from drifting apart, which would produce
 * an invoice showing VAT on one line and § 19 on the next.
 */
export function toInvoiceLines(
  invoice: InvoiceInput,
  issuer: Pick<IssuerInput, "kleinunternehmer">,
): InvoiceLine[] {
  const category = resolveCategory({
    kleinunternehmer: issuer.kleinunternehmer,
    reverseCharge: invoice.reverseCharge ?? false,
  });

  return invoice.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    // Only category S carries a rate at all; the others are zero by
    // definition and a stored rate on them would be wrong rather than unused.
    vatRate: category === "S" ? (item.vatRate ?? invoice.vatRate) : 0,
    category,
    unitCode: item.unitCode ?? "C62",
  }));
}

/** The exemption reason (BT-120) this invoice needs, if any. */
export function exemptionReasonsFor(
  issuer: Pick<IssuerInput, "kleinunternehmer">,
  reverseCharge: boolean,
): Partial<Record<"E" | "AE", string>> {
  if (issuer.kleinunternehmer) return { E: EXEMPTION_REASONS.KLEINUNTERNEHMER };
  if (reverseCharge) return { AE: EXEMPTION_REASONS.REVERSE_CHARGE };
  return {};
}

function issuerParty(issuer: IssuerInput): Party {
  return {
    // The LEGAL name (BT-27), not the trading name: the invoice has to name
    // the entity that is liable, and those differ often enough to matter.
    name: issuer.legalName,
    street: issuer.street,
    addressLine2: issuer.addressLine2,
    postalCode: issuer.postalCode,
    city: issuer.city,
    countryCode: issuer.countryCode,
    vatId: issuer.vatId,
    taxNumber: issuer.taxNumber,
    legalRegistrationId: issuer.legalRegistrationId,
    email: issuer.email,
    contact: {
      name: issuer.contactName,
      phone: issuer.contactPhone ?? issuer.phone,
      email: issuer.contactEmail ?? issuer.email,
    },
  };
}

function clientParty(client: ClientInput): Party {
  return {
    name: client.name,
    street: client.street ?? "",
    postalCode: client.postalCode ?? "",
    city: client.city ?? "",
    countryCode: client.countryCode ?? "DE",
    vatId: client.vatId,
    // The invoicing address wins over the general contact one: accounts
    // payable is usually not the person we otherwise talk to.
    email: client.invoiceEmail ?? client.email,
  };
}

/**
 * The note (BT-22) printed on the document.
 *
 * The exemption reason is carried in the tax breakdown already, but § 14 Abs. 4
 * and § 13b both require a readable note as well, and a recipient's accounts
 * department reads the note, not BT-120.
 */
export function documentNote(
  invoice: InvoiceInput,
  issuer: Pick<IssuerInput, "kleinunternehmer">,
): string | null {
  const parts: string[] = [];
  if (invoice.notes?.trim()) parts.push(invoice.notes.trim());
  if (issuer.kleinunternehmer) {
    parts.push(EXEMPTION_REASONS.KLEINUNTERNEHMER);
  } else if (invoice.reverseCharge) {
    parts.push(EXEMPTION_REASONS.REVERSE_CHARGE);
  }
  if (invoice.correctsNumber) {
    parts.push(`Storno der Rechnung ${invoice.correctsNumber}.`);
  }
  return parts.length ? parts.join("\n") : null;
}

/** The complete document model, ready for buildCii. */
export function assembleCii(input: {
  issuer: IssuerInput;
  client: ClientInput;
  invoice: InvoiceInput;
  format: "XRECHNUNG" | "ZUGFERD";
}): CiiInvoice {
  const { issuer, client, invoice } = input;
  const lines = toInvoiceLines(invoice, issuer);
  const totals: EInvoiceTotals = computeEInvoiceTotals(
    lines,
    exemptionReasonsFor(issuer, invoice.reverseCharge ?? false),
  );

  return {
    // ZUGFeRD is the plain EN 16931 guideline; XRechnung pins the German
    // national ruleset on top of it. The recipient's validator picks its rules
    // from this string alone, so it has to match what we actually produced.
    profile:
      input.format === "XRECHNUNG"
        ? PROFILE.XRECHNUNG
        : PROFILE.ZUGFERD_EN16931,
    number: invoice.number,
    typeCode: invoice.typeCode ?? "380",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: "EUR",
    seller: issuerParty(issuer),
    buyer: clientParty(client),
    // BT-10. The Leitweg-ID when the recipient is public sector; otherwise
    // BR-DE-15 still demands the field, and the invoice number is the only
    // reference we can honestly supply when the customer gave us none.
    buyerReference: client.leitwegId?.trim() || invoice.number,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    lines,
    totals,
    precedingInvoiceNumber: invoice.correctsNumber,
    precedingInvoiceDate: invoice.correctsDate,
    note: documentNote(invoice, issuer),
    payment: issuer.iban
      ? {
          iban: issuer.iban,
          bic: issuer.bic,
          accountName: issuer.legalName,
          terms: `Zahlbar innerhalb von ${issuer.paymentTermDays} Tagen ohne Abzug.`,
        }
      : undefined,
  };
}
