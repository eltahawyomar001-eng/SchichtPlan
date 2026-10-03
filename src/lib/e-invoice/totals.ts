/**
 * Money and tax for EN 16931 invoices.
 *
 * Separate from lib/billing's computeTotals, which takes ONE rate for the whole
 * invoice. EN 16931 requires the tax broken down per category and rate (BG-23),
 * so a document mixing 19 % services with 7 % goods -- ordinary in cleaning and
 * catering -- cannot be expressed by a single rate at all.
 *
 * Everything is integer cents. Floats drift, and an invoice that is one cent
 * out fails the validator's arithmetic rules (BR-CO-13/15) and gets rejected.
 */

/**
 * VAT category code (BT-151, UNCL5305 subset).
 *
 * Only the four Germany actually needs. Picking the wrong one is not cosmetic:
 * category E without an exemption reason fails BR-E-10, and S with a zero rate
 * fails BR-S-05.
 */
export type TaxCategory =
  /** Standard rate. The normal case. */
  | "S"
  /** Exempt. § 19 UStG Kleinunternehmer. Requires an exemption reason. */
  | "E"
  /** Reverse charge, § 13b UStG. Requires the note and a zero rate. */
  | "AE"
  /** Zero-rated. */
  | "Z";

export interface InvoiceLine {
  /** Free text, BT-153. */
  description: string;
  /** BT-129. May be fractional: 7.5 hours is a normal quantity here. */
  quantity: number;
  /** BT-146, in cents. */
  unitPriceCents: number;
  /** BT-152, e.g. 19 or 7. Zero for categories E, AE and Z. */
  vatRate: number;
  category: TaxCategory;
  /** UN/ECE Rec 20 code (BT-130). "HUR" hours, "DAY" days, "C62" pieces. */
  unitCode?: string;
}

/** One row of the VAT breakdown (BG-23). */
export interface TaxBreakdownRow {
  category: TaxCategory;
  /** BT-119. */
  rate: number;
  /** BT-116, the taxable base for this category and rate. */
  taxableCents: number;
  /** BT-117. */
  taxCents: number;
  /** BT-120. Mandatory whenever the category is not S. */
  exemptionReason?: string;
}

export interface EInvoiceTotals {
  /** BT-106, sum of the line net amounts. */
  lineTotalCents: number;
  /** BT-109, total without VAT. */
  taxBasisCents: number;
  /** BT-110, total VAT. */
  taxTotalCents: number;
  /** BT-112, total with VAT. */
  grandTotalCents: number;
  /** BT-115, what the customer actually has to pay. */
  payableCents: number;
  breakdown: TaxBreakdownRow[];
}

/** The exemption reasons (BT-120) German invoices need. */
export const EXEMPTION_REASONS: Record<string, string> = {
  KLEINUNTERNEHMER:
    "Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG.",
  REVERSE_CHARGE:
    "Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.",
};

/**
 * One line's net amount (BT-131), in cents.
 *
 * Rounded HERE, per line, before anything is summed. EN 16931 defines the
 * invoice total as the sum of the line amounts, so rounding at the end instead
 * produces a total that disagrees with its own lines by a cent or two and
 * fails BR-CO-10.
 */
export function lineNetCents(line: InvoiceLine): number {
  return Math.round(line.quantity * line.unitPriceCents);
}

/**
 * Totals and the per-category VAT breakdown.
 *
 * `exemptionReasons` supplies BT-120 per category; a category that needs one
 * and has none is left for the validator to reject rather than being given a
 * plausible-sounding default, because the wrong reason on an invoice is worse
 * than a missing one.
 */
export function computeEInvoiceTotals(
  lines: InvoiceLine[],
  exemptionReasons: Partial<Record<TaxCategory, string>> = {},
): EInvoiceTotals {
  const lineTotalCents = lines.reduce((sum, l) => sum + lineNetCents(l), 0);

  /**
   * Grouped by category AND rate, not by rate alone.
   *
   * 0 % reverse charge and 0 % exempt are different rows with different
   * meanings, and collapsing them loses the distinction the tax office cares
   * about.
   */
  const groups = new Map<string, TaxBreakdownRow>();

  for (const line of lines) {
    const rate = line.category === "S" ? line.vatRate : 0;
    const key = `${line.category}:${rate}`;
    const existing = groups.get(key);
    const net = lineNetCents(line);

    if (existing) {
      existing.taxableCents += net;
    } else {
      groups.set(key, {
        category: line.category,
        rate,
        taxableCents: net,
        taxCents: 0,
        exemptionReason: exemptionReasons[line.category],
      });
    }
  }

  const breakdown = [...groups.values()].map((row) => ({
    ...row,
    // Computed on the category's TOTAL base, not summed from per-line tax.
    // Rounding each line's tax and adding them up drifts from the rounded
    // total, which is what BR-CO-17 checks.
    taxCents: Math.round((row.taxableCents * row.rate) / 100),
  }));

  // Stable order, so a regenerated invoice is byte-identical to the archived
  // one -- which is the point of storing a checksum at issue time.
  breakdown.sort((a, b) =>
    a.category === b.category
      ? a.rate - b.rate
      : a.category < b.category
        ? -1
        : 1,
  );

  const taxBasisCents = breakdown.reduce((s, r) => s + r.taxableCents, 0);
  const taxTotalCents = breakdown.reduce((s, r) => s + r.taxCents, 0);
  const grandTotalCents = taxBasisCents + taxTotalCents;

  return {
    lineTotalCents,
    taxBasisCents,
    taxTotalCents,
    grandTotalCents,
    payableCents: grandTotalCents,
    breakdown,
  };
}

/**
 * The tax category for an invoice, from the issuer's and invoice's situation.
 *
 * Order matters. A Kleinunternehmer never shows VAT at all, so § 19 wins over
 * § 13b: an invoice cannot simultaneously show no tax because the issuer is
 * exempt and shift a tax liability that was never charged.
 */
export function resolveCategory(opts: {
  kleinunternehmer: boolean;
  reverseCharge: boolean;
}): TaxCategory {
  if (opts.kleinunternehmer) return "E";
  if (opts.reverseCharge) return "AE";
  return "S";
}

/** Cents as German currency text, for the PDF and the UI. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
