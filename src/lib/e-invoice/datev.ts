/**
 * DATEV EXTF "Buchungsstapel" export.
 *
 * The format tax advisers actually import. Not a generic CSV with a German
 * header: DATEV expects a specific two-line preamble, a fixed column order,
 * Windows-1252 encoding and German decimal commas, and gets all of it wrong
 * silently if any part is off -- the import either refuses the file or, worse,
 * books the figures into the wrong accounts.
 *
 * What this cannot know is the CHART OF ACCOUNTS. SKR03 and SKR04 use
 * different revenue accounts for the same transaction, and every practice
 * customises further. The defaults here are SKR03, which is the more common of
 * the two in German SMEs, and they are configurable precisely because getting
 * them from the customer's own tax adviser is the only way to be right.
 */

/** Account numbers, which come from the customer's tax adviser. */
export interface DatevAccounts {
  /** SKR03 8400 = Erlöse 19 % USt. */
  revenue19: string;
  /** SKR03 8300 = Erlöse 7 % USt. */
  revenue7: string;
  /** SKR03 8200 = Erlöse (no VAT), used for § 19 and § 13b. */
  revenue0: string;
  /**
   * Collective debtor account used when a client has no account of its own.
   *
   * A real ledger gives every customer a number in the debtor range. Until
   * then everything lands here, which imports cleanly but gives the adviser
   * no per-customer breakdown.
   */
  debtorFallback: string;
  /** Chart of accounts: 03 = SKR03, 04 = SKR04. */
  skr: "03" | "04";
}

export const DEFAULT_ACCOUNTS: DatevAccounts = {
  revenue19: "8400",
  revenue7: "8300",
  revenue0: "8200",
  debtorFallback: "10000",
  skr: "03",
};

export interface DatevInvoice {
  number: string;
  issueDate: Date;
  /** Gross, in cents. DATEV books the gross and derives the tax. */
  grossCents: number;
  /** Dominant VAT rate, deciding the revenue account. */
  vatRate: number;
  clientName: string | null;
  /** Per-customer debtor account, when the customer has one. */
  debtorAccount?: string | null;
  /** A credit note is booked the other way round. */
  isCreditNote?: boolean;
  kleinunternehmer?: boolean;
  reverseCharge?: boolean;
}

export interface DatevConsultant {
  /** Beraternummer, from the tax adviser. */
  consultantNumber: string;
  /** Mandantennummer, from the tax adviser. */
  clientNumber: string;
  /** Start of the fiscal year. */
  fiscalYearStart: Date;
  name: string;
}

/**
 * A field as DATEV expects it inside the preamble and data rows.
 *
 * Text is always quoted, because an unquoted field containing a semicolon
 * silently shifts every later column by one -- and company names contain
 * semicolons more often than one would like.
 */
function q(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** yyyyMMdd, which DATEV uses in the preamble. */
function ymd(d: Date): string {
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

/** ddMM — the booking date format inside a Buchungsstapel, with no year. */
function ddMM(d: Date): string {
  return (
    String(d.getDate()).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0")
  );
}

/**
 * Cents as a DATEV amount: always positive, comma as the decimal separator.
 *
 * The SIGN never appears here. Direction is carried by the Soll/Haben
 * indicator in its own column, and a negative amount alongside it would either
 * be rejected or book the entry backwards.
 */
export function datevAmount(cents: number): string {
  const v = Math.abs(cents);
  return `${Math.floor(v / 100)},${String(v % 100).padStart(2, "0")}`;
}

/** The revenue account for an invoice. */
export function revenueAccount(
  inv: DatevInvoice,
  accounts: DatevAccounts,
): string {
  // § 19 and § 13b both show no VAT, so neither can use a rated account --
  // booking them to 8400 would have the adviser declaring tax nobody charged.
  if (inv.kleinunternehmer || inv.reverseCharge) return accounts.revenue0;
  if (inv.vatRate >= 18) return accounts.revenue19;
  if (inv.vatRate >= 6) return accounts.revenue7;
  return accounts.revenue0;
}

/** The 31-field EXTF preamble line. */
function headerLine(
  consultant: DatevConsultant,
  accounts: DatevAccounts,
  range: { from: Date; to: Date },
  now: Date,
): string {
  const stamp =
    ymd(now) +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    "000";

  return [
    q("EXTF"),
    "700", // format version
    "21", // 21 = Buchungsstapel
    q("Buchungsstapel"),
    "13", // format version of the Buchungsstapel layout
    stamp,
    "", // imported-on, left to DATEV
    q("SHIFTFY"), // origin
    q("Shiftfy"),
    q(consultant.name),
    consultant.consultantNumber,
    consultant.clientNumber,
    ymd(consultant.fiscalYearStart),
    // Length of the debtor/creditor account numbers. 4 matches the defaults.
    "4",
    ymd(range.from),
    ymd(range.to),
    q(""), // batch description
    q(""), // dictation shorthand
    "1", // 1 = Finanzbuchführung
    "0", // 0 = no bookings locked
    q("EUR"),
    "",
    "",
    "",
    "",
    q(""), // derived currency
    "",
    q(accounts.skr),
    "",
    "",
    "",
    q(""),
  ].join(";");
}

/** The caption row. Order is fixed and must match the data rows exactly. */
const COLUMNS = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Kurs",
  "Basis-Umsatz",
  "WKZ Basis-Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
];

/**
 * One booking row.
 *
 * Debtor on Konto, revenue on Gegenkonto, which is the direction a sales
 * invoice is booked: the customer owes us, and the revenue is the counterpart.
 * A credit note reverses the Soll/Haben indicator rather than negating the
 * amount, for the reason given on datevAmount.
 */
function bookingRow(inv: DatevInvoice, accounts: DatevAccounts): string {
  const debtor = inv.debtorAccount?.trim() || accounts.debtorFallback;
  const fields = [
    datevAmount(inv.grossCents),
    q(inv.isCreditNote ? "H" : "S"),
    q("EUR"),
    "",
    "",
    "",
    q(debtor),
    q(revenueAccount(inv, accounts)),
    "", // BU-Schlüssel: left to the revenue account's own rate
    ddMM(inv.issueDate),
    // Belegfeld 1 is the invoice number and DATEV truncates it at 36
    // characters; longer numbers are silently cut, which breaks reconciliation.
    q(inv.number.slice(0, 36)),
    q(""),
    "",
    // Buchungstext is capped at 60 and is what the adviser actually reads in
    // the ledger, so the customer name goes here rather than the invoice
    // number they already have in Belegfeld 1.
    q((inv.clientName ?? "Rechnung").slice(0, 60)),
  ];
  return fields.join(";");
}

/**
 * The complete Buchungsstapel.
 *
 * Returned as a string; the caller encodes it. See datevBuffer -- the encoding
 * is not incidental.
 */
export function buildDatevBuchungsstapel(input: {
  invoices: DatevInvoice[];
  consultant: DatevConsultant;
  accounts?: DatevAccounts;
  range: { from: Date; to: Date };
  now?: Date;
}): string {
  const accounts = input.accounts ?? DEFAULT_ACCOUNTS;
  const lines = [
    headerLine(
      input.consultant,
      accounts,
      input.range,
      input.now ?? new Date(),
    ),
    COLUMNS.map(q).join(";"),
    ...input.invoices.map((i) => bookingRow(i, accounts)),
  ];
  // CRLF, which the DATEV importer expects.
  return lines.join("\r\n") + "\r\n";
}

/**
 * Windows-1252's own block, 0x80-0x9F.
 *
 * This is the only range where Windows-1252 differs from Latin-1, and it is
 * where the euro sign lives. German umlauts are all in the shared range and
 * need no mapping; the euro sign does, and it turns up in booking text.
 */
const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98,
  0x2122: 0x99, // ™
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

/**
 * The file as bytes, in Windows-1252.
 *
 * NOT UTF-8. DATEV reads EXTF files as Windows-1252, so a UTF-8 file turns
 * every umlaut in a customer name into mojibake in the ledger -- and "Müller
 * GmbH" arriving as "MÃ¼ller GmbH" is the kind of thing nobody notices until
 * the adviser asks about it.
 *
 * Iterated by code point rather than by index, so an emoji or any other
 * astral character in a customer-supplied name becomes ONE replacement byte
 * instead of two stray ones that would corrupt the rest of the line.
 *
 * Unmappable characters become "?" rather than throwing: a Greek or Cyrillic
 * customer name should not make the whole export fail.
 */
export function datevBuffer(csv: string): Buffer {
  const bytes: number[] = [];
  for (const ch of csv) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) {
      // 0x80-0x9F are control codes in Latin-1 and have no business in a CSV,
      // so anything landing there is replaced rather than passed through.
      bytes.push(code >= 0x80 && code <= 0x9f ? 0x3f : code);
    } else {
      bytes.push(CP1252_HIGH[code] ?? 0x3f);
    }
  }
  return Buffer.from(bytes);
}
