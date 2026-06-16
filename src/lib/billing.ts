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

export async function nextInvoiceNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.customerInvoice.count({
    where: { workspaceId, number: { startsWith: `RE-${year}-` } },
  });
  return `RE-${year}-${String(count + 1).padStart(4, "0")}`;
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
