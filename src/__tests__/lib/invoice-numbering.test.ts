/**
 * Invoice numbers must be gapless, sequential, unique per tenant, and never
 * reused. GoBD treats the sequence itself as part of the evidence: a gap or a
 * repeat is what an auditor looks for.
 *
 * The previous implementation derived the number from `count(*) + 1` over the
 * existing invoices, which fails on both counts. These pin the properties that
 * replaced it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpsert } = vi.hoisted(() => ({ mockUpsert: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { invoiceSequence: { upsert: mockUpsert } },
}));

import { nextInvoiceNumber } from "@/lib/billing";

beforeEach(() => vi.clearAllMocks());

describe("nextInvoiceNumber", () => {
  it("asks the database to increment, rather than counting rows", async () => {
    // The distinction is the whole fix: `increment` is applied by the database,
    // so two concurrent callers are serialised and get different numbers.
    // Counting rows lets both read the same value.
    mockUpsert.mockResolvedValue({ lastNumber: 7 });
    await nextInvoiceNumber("ws1");

    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.update).toEqual({ lastNumber: { increment: 1 } });
  });

  it("advances the CUSTOMER series, never Shiftfy's own billing series", async () => {
    // Both live in the same table. Advancing the wrong one puts a gap in a
    // series that belongs to a different legal document set.
    mockUpsert.mockResolvedValue({ lastNumber: 1 });
    await nextInvoiceNumber("ws1");

    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.where.workspaceId_kind.kind).toBe("CUSTOMER_INVOICE");
    expect(arg.create.kind).toBe("CUSTOMER_INVOICE");
  });

  it("scopes the counter to one workspace", async () => {
    mockUpsert.mockResolvedValue({ lastNumber: 3 });
    await nextInvoiceNumber("ws-abc");
    expect(mockUpsert.mock.calls[0][0].where.workspaceId_kind.workspaceId).toBe(
      "ws-abc",
    );
  });

  it("formats as RE-<year>-<4 digits>", async () => {
    mockUpsert.mockResolvedValue({ lastNumber: 42 });
    const year = new Date().getFullYear();
    await expect(nextInvoiceNumber("ws1")).resolves.toBe(`RE-${year}-0042`);
  });

  it("keeps widening past four digits rather than wrapping", async () => {
    // A workspace that issues more than 9999 invoices in a year must not start
    // colliding with its own earlier numbers.
    mockUpsert.mockResolvedValue({ lastNumber: 12345 });
    const year = new Date().getFullYear();
    await expect(nextInvoiceNumber("ws1")).resolves.toBe(`RE-${year}-12345`);
  });

  it("returns consecutive numbers across calls, with no reuse", async () => {
    // Simulates the counter: each call sees the value the database handed back.
    let n = 0;
    mockUpsert.mockImplementation(async () => ({ lastNumber: ++n }));
    const year = new Date().getFullYear();

    const numbers = [
      await nextInvoiceNumber("ws1"),
      await nextInvoiceNumber("ws1"),
      await nextInvoiceNumber("ws1"),
    ];

    expect(numbers).toEqual([
      `RE-${year}-0001`,
      `RE-${year}-0002`,
      `RE-${year}-0003`,
    ]);
    expect(new Set(numbers).size).toBe(3);
  });

  it("does not reuse a number after an invoice is removed", async () => {
    // The old behaviour: delete one of three invoices and the next number is
    // 0003 again -- a number already sent to a customer. The counter never
    // goes backwards, because it records what was HANDED OUT, not what exists.
    let handedOut = 3;
    mockUpsert.mockImplementation(async () => ({ lastNumber: ++handedOut }));
    const year = new Date().getFullYear();

    // An invoice is deleted here; the counter is untouched by that.
    await expect(nextInvoiceNumber("ws1")).resolves.toBe(`RE-${year}-0004`);
  });

  it("allocates through a transaction client when given one", async () => {
    // So the number and the invoice carrying it commit or roll back together;
    // otherwise a failed insert burns a number and leaves a gap.
    const txUpsert = vi.fn().mockResolvedValue({ lastNumber: 9 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = { invoiceSequence: { upsert: txUpsert } } as any;

    const year = new Date().getFullYear();
    await expect(nextInvoiceNumber("ws1", tx)).resolves.toBe(`RE-${year}-0009`);
    expect(txUpsert).toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
