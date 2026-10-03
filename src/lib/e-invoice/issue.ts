/**
 * Issuing an invoice: the one irreversible step.
 *
 * Before this runs, an invoice is a draft that can be edited or thrown away.
 * After it, the document exists in the legal sense — it has a number from a
 * gapless sequence, it is frozen, and the only way to undo it is a Storno that
 * references it. GoBD does not allow anything else.
 *
 * So the whole thing is one transaction, in a deliberate order:
 *
 *   1. Re-read the invoice INSIDE the transaction. The caller's copy may be
 *      stale, and issuing twice is exactly the race that produces two numbers
 *      for one document.
 *   2. Preflight. Everything that can be checked is checked while nothing has
 *      been consumed yet.
 *   3. Draw the number from the counter.
 *   4. Generate the XML and hash it.
 *   5. Write, and mark issued.
 *
 * Steps 3 to 5 cannot be separated: a number drawn and then not written is the
 * gap the sequence is supposed to make impossible, and the transaction is what
 * guarantees the two happen together or not at all.
 */

import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildCii } from "./cii";
import { assembleCii } from "./assemble";
import { preflightInvoice, type PreflightIssue } from "./preflight";
import { nextInvoiceNumber } from "@/lib/billing";

export type IssueFormat = "XRECHNUNG" | "ZUGFERD";

export type IssueResult =
  | {
      ok: true;
      number: string;
      xml: string;
      sha256: string;
      format: IssueFormat;
    }
  | { ok: false; code: "ALREADY_ISSUED"; number: string | null }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "PREFLIGHT_FAILED"; issues: PreflightIssue[] };

/** SHA-256 of the XML as issued, so an audit can prove the archive is intact. */
export function xmlChecksum(xml: string): string {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Issue one draft invoice.
 *
 * Must be called inside a transaction, or given one: see the header. The
 * caller owns the audit log, because what gets logged depends on who issued it
 * and that is not this function's business.
 */
export async function issueInvoiceInTx(
  tx: Tx,
  opts: {
    invoiceId: string;
    workspaceId: string;
    /** Overrides the issuer default and the client preference. */
    format?: IssueFormat;
    /** Injectable so tests do not depend on the clock. */
    now?: Date;
  },
): Promise<IssueResult> {
  const now = opts.now ?? new Date();

  const invoice = await tx.customerInvoice.findFirst({
    where: {
      id: opts.invoiceId,
      workspaceId: opts.workspaceId,
      deletedAt: null,
    },
    include: {
      items: { orderBy: { position: "asc" } },
      client: true,
      corrects: { select: { number: true, issueDate: true } },
    },
  });
  if (!invoice) return { ok: false, code: "NOT_FOUND" };

  // Idempotent rather than an error: a double-submitted form must not produce
  // a second number, and the caller cannot reliably tell the two apart.
  if (invoice.issuedAt) {
    return { ok: false, code: "ALREADY_ISSUED", number: invoice.number };
  }

  const issuer = await tx.invoiceIssuerProfile.findUnique({
    where: { workspaceId: opts.workspaceId },
  });

  const isStorno = Boolean(invoice.correctsInvoiceId);
  const lines = invoice.items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unitPriceCents: it.unitPriceCents,
    vatRate: it.vatRate ?? invoice.vatRate,
    category: "S" as const,
    unitCode: it.unitCode,
  }));

  const issues = preflightInvoice({
    issuer,
    client: invoice.client,
    invoice: {
      issueDate: invoice.issueDate,
      lines,
      reverseCharge: invoice.reverseCharge,
      typeCode: isStorno ? "381" : "380",
      correctsNumber: invoice.corrects?.number ?? null,
    },
  });
  if (issues.length > 0) {
    return { ok: false, code: "PREFLIGHT_FAILED", issues };
  }
  // Preflight guarantees both, but narrowing the types here keeps the
  // assumption explicit rather than relying on a non-null assertion.
  if (!issuer || !invoice.client) {
    return { ok: false, code: "PREFLIGHT_FAILED", issues };
  }

  // The recipient's preference wins: a public body that only accepts
  // XRechnung will bounce a ZUGFeRD PDF no matter what our default says.
  const format: IssueFormat =
    opts.format ??
    (invoice.client.preferredFormat as IssueFormat | null) ??
    (issuer.defaultFormat as IssueFormat);

  const number =
    invoice.number ?? (await nextInvoiceNumber(opts.workspaceId, tx));

  const xml = buildCii(
    assembleCii({
      issuer,
      client: invoice.client,
      invoice: {
        number,
        typeCode: isStorno ? "381" : "380",
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        title: invoice.title,
        notes: invoice.notes,
        reverseCharge: invoice.reverseCharge,
        correctsNumber: invoice.corrects?.number ?? null,
        correctsDate: invoice.corrects?.issueDate ?? null,
        vatRate: invoice.vatRate,
        items: invoice.items,
      },
      format,
    }),
  );
  const sha256 = xmlChecksum(xml);

  await tx.customerInvoice.update({
    where: { id: invoice.id },
    data: {
      number,
      issuedAt: now,
      status: "GESENDET",
      sentAt: invoice.sentAt ?? now,
      einvoiceXml: xml,
      einvoiceFormat: format,
      einvoiceSha256: sha256,
    },
  });

  return { ok: true, number, xml, sha256, format };
}
