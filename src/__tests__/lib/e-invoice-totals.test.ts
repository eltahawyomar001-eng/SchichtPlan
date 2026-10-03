/**
 * Invoice arithmetic, which the validator checks and the tax office relies on.
 *
 * EN 16931 does not merely want the right total — it wants the total to equal
 * the sum of the lines (BR-CO-10), the tax to equal the sum of the breakdown
 * (BR-CO-14), and the grand total to equal basis plus tax (BR-CO-15). Those are
 * separate rules, and an invoice can satisfy one while failing another, which
 * is why rounding happens where it does.
 */
import { describe, it, expect } from "vitest";
import {
  computeEInvoiceTotals,
  lineNetCents,
  resolveCategory,
  EXEMPTION_REASONS,
  type InvoiceLine,
} from "@/lib/e-invoice/totals";

const line = (over: Partial<InvoiceLine> = {}): InvoiceLine => ({
  description: "Reinigung",
  quantity: 1,
  unitPriceCents: 10000,
  vatRate: 19,
  category: "S",
  ...over,
});

describe("line amounts", () => {
  it("rounds per line, not at the end", () => {
    // 7.5 h x 23.45 EUR = 175.875 EUR. The line must be 175.88, and the
    // invoice total must agree with it. Rounding only at the end gives a total
    // that disagrees with its own lines and fails BR-CO-10.
    const l = line({ quantity: 7.5, unitPriceCents: 2345 });
    expect(lineNetCents(l)).toBe(17588);
  });

  it("handles fractional hours exactly", () => {
    expect(lineNetCents(line({ quantity: 0.25, unitPriceCents: 4000 }))).toBe(
      1000,
    );
  });

  it("sums the lines into the line total", () => {
    const t = computeEInvoiceTotals([
      line({ quantity: 2, unitPriceCents: 5000 }),
      line({ quantity: 3, unitPriceCents: 1000 }),
    ]);
    expect(t.lineTotalCents).toBe(13000);
    // BR-CO-10: the two must be equal.
    expect(t.taxBasisCents).toBe(t.lineTotalCents);
  });
});

describe("standard rate", () => {
  it("computes 19 % and the gross total", () => {
    const t = computeEInvoiceTotals([line({ unitPriceCents: 10000 })]);
    expect(t.taxBasisCents).toBe(10000);
    expect(t.taxTotalCents).toBe(1900);
    expect(t.grandTotalCents).toBe(11900);
    expect(t.payableCents).toBe(11900);
  });

  it("satisfies basis + tax = grand total", () => {
    // BR-CO-15, checked explicitly because it is a separate rule from the
    // line-sum one and can fail on its own.
    const t = computeEInvoiceTotals([
      line({ quantity: 3, unitPriceCents: 3333 }),
      line({ quantity: 7, unitPriceCents: 1777, vatRate: 7 }),
    ]);
    expect(t.taxBasisCents + t.taxTotalCents).toBe(t.grandTotalCents);
  });

  it("satisfies tax total = sum of the breakdown", () => {
    // BR-CO-14.
    const t = computeEInvoiceTotals([
      line({ unitPriceCents: 10000 }),
      line({ unitPriceCents: 5000, vatRate: 7 }),
    ]);
    expect(t.breakdown.reduce((s, r) => s + r.taxCents, 0)).toBe(
      t.taxTotalCents,
    );
  });
});

describe("mixed rates", () => {
  it("produces one breakdown row per rate", () => {
    // The case the old single-rate model could not express at all.
    const t = computeEInvoiceTotals([
      line({ unitPriceCents: 10000, vatRate: 19 }),
      line({ unitPriceCents: 20000, vatRate: 7 }),
    ]);
    expect(t.breakdown).toHaveLength(2);
    const r19 = t.breakdown.find((r) => r.rate === 19)!;
    const r7 = t.breakdown.find((r) => r.rate === 7)!;
    expect(r19.taxableCents).toBe(10000);
    expect(r19.taxCents).toBe(1900);
    expect(r7.taxableCents).toBe(20000);
    expect(r7.taxCents).toBe(1400);
    expect(t.taxTotalCents).toBe(3300);
  });

  it("merges lines that share a rate into one row", () => {
    const t = computeEInvoiceTotals([
      line({ unitPriceCents: 10000 }),
      line({ unitPriceCents: 2500 }),
    ]);
    expect(t.breakdown).toHaveLength(1);
    expect(t.breakdown[0].taxableCents).toBe(12500);
  });

  it("computes tax on the category total, not per line", () => {
    // Three lines of 3.33 EUR at 19 %: per-line tax rounds to 0.63 each
    // (1.89 total), but the correct figure is 19 % of 9.99 = 1.8981 -> 1.90.
    // Summing rounded per-line tax drifts from the rounded total, which is
    // what BR-CO-17 rejects.
    const t = computeEInvoiceTotals([
      line({ unitPriceCents: 333 }),
      line({ unitPriceCents: 333 }),
      line({ unitPriceCents: 333 }),
    ]);
    expect(t.taxBasisCents).toBe(999);
    expect(t.taxTotalCents).toBe(190);
  });

  it("keeps the breakdown order stable", () => {
    // A regenerated invoice must be byte-identical to the archived one, which
    // is the whole point of storing a checksum at issue time.
    const lines = [
      line({ unitPriceCents: 100, vatRate: 7 }),
      line({ unitPriceCents: 100, vatRate: 19 }),
    ];
    const a = computeEInvoiceTotals(lines);
    const b = computeEInvoiceTotals([...lines].reverse());
    expect(a.breakdown.map((r) => `${r.category}:${r.rate}`)).toEqual(
      b.breakdown.map((r) => `${r.category}:${r.rate}`),
    );
  });
});

describe("Kleinunternehmer (§ 19 UStG)", () => {
  it("shows no VAT and carries the exemption reason", () => {
    const t = computeEInvoiceTotals(
      [line({ category: "E", vatRate: 0, unitPriceCents: 50000 })],
      { E: EXEMPTION_REASONS.KLEINUNTERNEHMER },
    );
    expect(t.taxTotalCents).toBe(0);
    expect(t.grandTotalCents).toBe(50000);
    expect(t.breakdown[0].category).toBe("E");
    expect(t.breakdown[0].exemptionReason).toContain("§ 19 UStG");
  });

  it("forces the rate to zero even if a rate was supplied", () => {
    // A Kleinunternehmer line carrying 19 % would be a document claiming tax
    // that was never charged.
    const t = computeEInvoiceTotals([
      line({ category: "E", vatRate: 19, unitPriceCents: 10000 }),
    ]);
    expect(t.breakdown[0].rate).toBe(0);
    expect(t.taxTotalCents).toBe(0);
  });
});

describe("reverse charge (§ 13b UStG)", () => {
  it("shows no VAT and carries the § 13b note", () => {
    const t = computeEInvoiceTotals(
      [line({ category: "AE", vatRate: 0, unitPriceCents: 120000 })],
      { AE: EXEMPTION_REASONS.REVERSE_CHARGE },
    );
    expect(t.taxTotalCents).toBe(0);
    expect(t.grandTotalCents).toBe(120000);
    expect(t.breakdown[0].exemptionReason).toContain("§ 13b UStG");
  });

  it("keeps exempt and reverse-charge as separate rows", () => {
    // Both are 0 %, but they mean different things to the tax office and
    // collapsing them by rate alone would lose that.
    const t = computeEInvoiceTotals([
      line({ category: "E", vatRate: 0 }),
      line({ category: "AE", vatRate: 0 }),
    ]);
    expect(t.breakdown).toHaveLength(2);
    expect(new Set(t.breakdown.map((r) => r.category))).toEqual(
      new Set(["E", "AE"]),
    );
  });
});

describe("resolveCategory", () => {
  it("returns S for an ordinary taxable invoice", () => {
    expect(
      resolveCategory({ kleinunternehmer: false, reverseCharge: false }),
    ).toBe("S");
  });

  it("returns AE for reverse charge", () => {
    expect(
      resolveCategory({ kleinunternehmer: false, reverseCharge: true }),
    ).toBe("AE");
  });

  it("returns E for a Kleinunternehmer", () => {
    expect(
      resolveCategory({ kleinunternehmer: true, reverseCharge: false }),
    ).toBe("E");
  });

  it("lets § 19 win over § 13b", () => {
    // An invoice cannot both show no tax because the issuer is exempt AND
    // shift a tax liability that was never charged.
    expect(
      resolveCategory({ kleinunternehmer: true, reverseCharge: true }),
    ).toBe("E");
  });
});

describe("edge cases", () => {
  it("handles an empty invoice without producing NaN", () => {
    const t = computeEInvoiceTotals([]);
    expect(t).toMatchObject({
      lineTotalCents: 0,
      taxTotalCents: 0,
      grandTotalCents: 0,
      breakdown: [],
    });
  });

  it("handles a credit note with negative amounts", () => {
    // A Storno is the same arithmetic with the sign flipped; it must not be
    // clamped to zero anywhere.
    const t = computeEInvoiceTotals([line({ unitPriceCents: -10000 })]);
    expect(t.taxBasisCents).toBe(-10000);
    expect(t.taxTotalCents).toBe(-1900);
    expect(t.grandTotalCents).toBe(-11900);
  });
});
