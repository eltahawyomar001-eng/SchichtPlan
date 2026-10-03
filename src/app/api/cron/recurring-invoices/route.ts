import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { addInterval } from "@/lib/billing";
import { issueInvoiceInTx } from "@/lib/e-invoice/issue";
import type { PreflightIssue } from "@/lib/e-invoice/preflight";

/**
 * GET /api/cron/recurring-invoices
 *
 * Generates the next invoice for every active recurring template whose
 * recurringNextRun is due, then advances the template's next-run date.
 * Runs daily via Vercel Cron. Children are created as GESENDET (sent) with a
 * 14-day due date.
 */
export const GET = withRoute(
  "/api/cron/recurring-invoices",
  "GET",
  async (req) => {
    const authHeader = req.headers.get("authorization");
    const cronSecret = authHeader?.replace("Bearer ", "");
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 401 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = await prisma.customerInvoice.findMany({
      where: {
        recurringActive: true,
        recurringNextRun: { lte: today },
        deletedAt: null,
      },
      include: { items: { orderBy: { position: "asc" } } },
    });

    let generated = 0;
    /** Children created but not issuable: incomplete tenant master data. */
    const blocked: {
      templateId: string;
      invoiceId: string;
      reason: string;
      issues: PreflightIssue[];
    }[] = [];
    for (const template of due) {
      try {
        const issueDate = template.recurringNextRun ?? today;
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 14);

        await prisma.$transaction(async (tx) => {
          // Created as a DRAFT and then issued through the normal gate, in
          // this same transaction.
          //
          // The number used to be drawn before the transaction opened, so a
          // failure anywhere below lost it and tore a hole in a sequence that
          // is supposed to be gapless. Going through the gate also means a
          // recurring invoice gets its XML, its checksum and its issuedAt like
          // any other -- previously it was marked GESENDET with no structured
          // document behind it at all, which from 2028 is not an invoice a
          // B2B recipient is obliged to accept.
          const child = await tx.customerInvoice.create({
            data: {
              workspaceId: template.workspaceId,
              clientId: template.clientId,
              number: null,
              title: template.title,
              notes: template.notes,
              issueDate,
              dueDate,
              vatRate: template.vatRate,
              recurring: "KEINE",
              recurringParentId: template.id,
              items: {
                create: template.items.map((it) => ({
                  description: it.description,
                  quantity: it.quantity,
                  unitPriceCents: it.unitPriceCents,
                  position: it.position,
                  vatRate: it.vatRate,
                  unitCode: it.unitCode,
                })),
              },
            },
          });

          const issued = await issueInvoiceInTx(tx, {
            invoiceId: child.id,
            workspaceId: template.workspaceId,
          });
          // A template whose master data is incomplete leaves the child as a
          // draft rather than failing the whole run or emitting an invalid
          // document. The customer sees it waiting in Rechnungen, and the
          // count comes back in the response so a failing tenant is visible
          // in the cron log instead of silently stuck.
          if (!issued.ok) {
            blocked.push({
              templateId: template.id,
              invoiceId: child.id,
              reason: issued.code,
              issues: issued.code === "PREFLIGHT_FAILED" ? issued.issues : [],
            });
          }

          const nextRun = addInterval(issueDate, template.recurring);
          await tx.customerInvoice.update({
            where: { id: template.id },
            data: { recurringNextRun: nextRun },
          });
        });
        generated++;
      } catch (err) {
        log.error("[cron recurring-invoices] failed for template", {
          templateId: template.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (blocked.length > 0) {
      // A tenant whose invoices cannot be issued is losing revenue silently,
      // which is worth a warning rather than an info line.
      log.warn("[cron recurring-invoices] drafts left unissued", {
        count: blocked.length,
        blocked,
      });
    }
    log.info("[cron recurring-invoices] done", {
      due: due.length,
      generated,
      blocked: blocked.length,
    });
    return NextResponse.json({
      due: due.length,
      generated,
      blocked: blocked.length,
      blockedDetail: blocked,
    });
  },
);
