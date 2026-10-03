/**
 * Financial-loop helpers: document numbering, money totals, recurrence.
 *
 * All money is handled in integer cents to avoid float drift; only the
 * display layer divides by 100.
 */

import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

export type RecurringInterval =
  | "KEINE"
  | "MONATLICH"
  | "QUARTALSWEISE"
  | "JAEHRLICH";

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface DocumentTotals {
  netCents: number;
  vatCents: number;
  grossCents: number;
}

/** Net/VAT/gross totals for a set of line items at a given VAT rate (%). */
export function computeTotals(
  items: LineItem[],
  vatRate: number,
): DocumentTotals {
  const netCents = items.reduce(
    (sum, i) => sum + Math.round(i.quantity * i.unitPriceCents),
    0,
  );
  const vatCents = Math.round((netCents * vatRate) / 100);
  return { netCents, vatCents, grossCents: netCents + vatCents };
}

/**
 * Next sequential document number for the workspace within the current year,
 * formatted as PREFIX-YYYY-NNNN (e.g. "RE-2026-0007", "ANG-2026-0007").
 * Counts existing docs for the year — the @@unique([workspaceId, number])
 * constraint is the final guard against a race.
 */
export async function nextQuoteNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.quote.count({
    where: { workspaceId, number: { startsWith: `ANG-${year}-` } },
  });
  return `ANG-${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * The next invoice number for a workspace. Gapless, sequential, per tenant.
 *
 * This used to be `count(*) + 1` over the existing invoices, which is wrong in
 * two ways that both matter legally:
 *
 *  - It is not concurrency-safe. Two requests arriving together both read the
 *    same count and both return N+1; the unique index on (workspaceId, number)
 *    then turns one of them into a 500 instead of an invoice.
 *  - It is not gapless. The count reflects how many invoices EXIST, not how
 *    many have been ISSUED, so removing one makes the next invoice reuse a
 *    number that has already been sent to a customer. GoBD requires the
 *    sequence to be unbroken and never reused.
 *
 * A counter row is the fix: the increment is atomic, so the database decides
 * the order, and the number is derived from "how many have ever been handed
 * out" rather than from what currently exists.
 *
 * Pass `tx` when allocating inside a transaction, so the number and the
 * invoice that carries it commit or roll back together.
 */
export async function nextInvoiceNumber(
  workspaceId: string,
  tx: Pick<typeof prisma, "invoiceSequence"> = prisma,
): Promise<string> {
  const year = new Date().getFullYear();

  // Atomic: `increment` is applied by the database, so concurrent callers are
  // serialised on the row and each receives a distinct value.
  const seq = await tx.invoiceSequence.upsert({
    // CUSTOMER_INVOICE, never the default: the other series belongs to the
    // invoices Shiftfy issues to this workspace and must not be advanced here.
    where: {
      workspaceId_kind: { workspaceId, kind: "CUSTOMER_INVOICE" },
    },
    update: { lastNumber: { increment: 1 } },
    create: { workspaceId, kind: "CUSTOMER_INVOICE", lastNumber: 1 },
    select: { lastNumber: true },
  });

  return `RE-${year}-${String(seq.lastNumber).padStart(4, "0")}`;
}

/** A URL-safe opaque token for the public quote-acceptance page. */
export function generateAcceptToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Advance a date by one recurrence interval. Returns null for KEINE. */
export function addInterval(
  from: Date,
  interval: RecurringInterval,
): Date | null {
  if (interval === "KEINE") return null;
  const d = new Date(from);
  switch (interval) {
    case "MONATLICH":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTALSWEISE":
      d.setMonth(d.getMonth() + 3);
      break;
    case "JAEHRLICH":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}
