/**
 * The DATEV booking batch.
 *
 * Every assertion here is a way the file can be wrong WITHOUT anything
 * visibly failing: the adviser imports it, the figures land, and the mistake
 * surfaces at the next VAT return. Those are worth pinning individually.
 */
import { describe, it, expect } from "vitest";
import {
  buildDatevBuchungsstapel,
  datevAmount,
  datevBuffer,
  DEFAULT_ACCOUNTS,
  revenueAccount,
  type DatevInvoice,
} from "@/lib/e-invoice/datev";

const consultant = {
  consultantNumber: "12345",
  clientNumber: "67890",
  fiscalYearStart: new Date(2026, 0, 1),
  name: "Musterreinigung Rhein-Neckar GmbH",
};

const inv = (over: Partial<DatevInvoice> = {}): DatevInvoice => ({
  number: "RE-2026-0001",
  issueDate: new Date(2026, 9, 3),
  grossCents: 119000,
  vatRate: 19,
  clientName: "Beispiel Immobilien GmbH",
  ...over,
});

const build = (invoices: DatevInvoice[]) =>
  buildDatevBuchungsstapel({
    invoices,
    consultant,
    range: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) },
    now: new Date(2026, 9, 3, 14, 30, 0),
  });

const rows = (csv: string) => csv.trimEnd().split("\r\n");

describe("amounts", () => {
  it("uses a comma as the decimal separator", () => {
    expect(datevAmount(119000)).toBe("1190,00");
    expect(datevAmount(5)).toBe("0,05");
  });

  it("is always positive", () => {
    // Direction is carried by the Soll/Haben column. A negative amount here
    // is either rejected or books the entry backwards.
    expect(datevAmount(-119000)).toBe("1190,00");
  });
});

describe("revenue account", () => {
  it("uses the 19 % account for a standard invoice", () => {
    expect(revenueAccount(inv(), DEFAULT_ACCOUNTS)).toBe("8400");
  });

  it("uses the 7 % account for the reduced rate", () => {
    expect(revenueAccount(inv({ vatRate: 7 }), DEFAULT_ACCOUNTS)).toBe("8300");
  });

  it("uses the untaxed account for a Kleinunternehmer", () => {
    // Booking § 19 revenue to 8400 would have the adviser declaring tax that
    // was never charged.
    expect(
      revenueAccount(inv({ kleinunternehmer: true }), DEFAULT_ACCOUNTS),
    ).toBe("8200");
  });

  it("uses the untaxed account for reverse charge", () => {
    expect(revenueAccount(inv({ reverseCharge: true }), DEFAULT_ACCOUNTS)).toBe(
      "8200",
    );
  });

  it("lets § 19 override a rate left on the invoice", () => {
    expect(
      revenueAccount(
        inv({ kleinunternehmer: true, vatRate: 19 }),
        DEFAULT_ACCOUNTS,
      ),
    ).toBe("8200");
  });
});

describe("the preamble", () => {
  it("declares EXTF and the Buchungsstapel type", () => {
    const [header] = rows(build([inv()]));
    expect(header.startsWith('"EXTF";700;21;"Buchungsstapel"')).toBe(true);
  });

  it("carries the adviser's numbers", () => {
    const [header] = rows(build([inv()]));
    expect(header).toContain(";12345;67890;20260101;");
  });

  it("states the chart of accounts", () => {
    expect(rows(build([inv()]))[0]).toContain('"03"');
  });

  it("puts the captions on line two, before any booking", () => {
    const r = rows(build([inv()]));
    expect(r[1]).toContain("Soll/Haben-Kennzeichen");
    expect(r[1]).toContain("Belegfeld 1");
    expect(r).toHaveLength(3);
  });
});

describe("booking rows", () => {
  it("books debtor to revenue with S for an invoice", () => {
    const r = rows(build([inv()]))[2].split(";");
    expect(r[0]).toBe("1190,00");
    expect(r[1]).toBe('"S"');
    expect(r[6]).toBe('"10000"'); // Konto: debtor
    expect(r[7]).toBe('"8400"'); // Gegenkonto: revenue
  });

  it("reverses only the indicator for a credit note", () => {
    // The amount stays positive; H is what makes it a reversal.
    const r = rows(build([inv({ isCreditNote: true })]))[2].split(";");
    expect(r[0]).toBe("1190,00");
    expect(r[1]).toBe('"H"');
  });

  it("uses the per-customer debtor account when there is one", () => {
    const r = rows(build([inv({ debtorAccount: "10042" })]))[2].split(";");
    expect(r[6]).toBe('"10042"');
  });

  it("writes the booking date as ddMM, without a year", () => {
    // The year comes from the preamble; putting it here is a common way to
    // have every booking land in the wrong period.
    const r = rows(build([inv()]))[2].split(";");
    expect(r[9]).toBe("0310");
  });

  it("puts the invoice number in Belegfeld 1", () => {
    const r = rows(build([inv()]))[2].split(";");
    expect(r[10]).toBe('"RE-2026-0001"');
  });

  it("truncates an over-long invoice number at DATEV's limit", () => {
    const r = rows(build([inv({ number: "X".repeat(50) })]))[2].split(";");
    expect(r[10]).toBe(`"${"X".repeat(36)}"`);
  });

  it("quotes a customer name containing a semicolon", () => {
    // Unquoted, it would shift every later column by one and silently
    // corrupt the booking.
    const csv = build([inv({ clientName: "Meier; Sohn GmbH" })]);
    expect(csv).toContain('"Meier; Sohn GmbH"');
    expect(rows(csv)[2].split(";")).toHaveLength(15);
  });

  it("escapes a quote inside a name", () => {
    const csv = build([inv({ clientName: 'Zum "Goldenen" Hirsch' })]);
    expect(csv).toContain('"Zum ""Goldenen"" Hirsch"');
  });
});

describe("line endings", () => {
  it("uses CRLF, which the importer expects", () => {
    const csv = build([inv()]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").length).toBeGreaterThan(3);
  });
});

describe("encoding", () => {
  it("writes umlauts as Windows-1252, not UTF-8", () => {
    // UTF-8 would turn "Müller GmbH" into "MÃ¼ller GmbH" in the ledger.
    const b = datevBuffer("Müller");
    expect([...b]).toEqual([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]);
  });

  it("maps the euro sign into the Windows-1252 block", () => {
    // The one character German booking text needs that Latin-1 lacks.
    expect([...datevBuffer("€")]).toEqual([0x80]);
  });

  it("replaces an astral character with a single byte", () => {
    // Iterating by index rather than code point would emit two stray bytes
    // from the surrogate pair and corrupt the rest of the line.
    expect([...datevBuffer("a😀b")]).toEqual([0x61, 0x3f, 0x62]);
  });

  it("replaces unmappable characters rather than failing the export", () => {
    expect([...datevBuffer("Ωmega")]).toEqual([0x3f, 0x6d, 0x65, 0x67, 0x61]);
  });

  it("round-trips a full row through the encoder", () => {
    const b = datevBuffer(build([inv({ clientName: "Grünflächen Müller" })]));
    expect(b.toString("latin1")).toContain("Grünflächen Müller");
  });
});

describe("an empty period", () => {
  it("still produces a valid file with just the two header lines", () => {
    // An adviser importing an empty batch should see an empty batch, not a
    // malformed file.
    const r = rows(build([]));
    expect(r).toHaveLength(2);
    expect(r[0]).toContain("EXTF");
  });
});
