import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { nextInvoiceNumber, addInterval } from "@/lib/billing";

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
    for (const template of due) {
      try {
        const issueDate = template.recurringNextRun ?? today;
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 14);
        const number = await nextInvoiceNumber(template.workspaceId);

        await prisma.$transaction(async (tx) => {
          await tx.customerInvoice.create({
            data: {
              workspaceId: template.workspaceId,
              clientId: template.clientId,
              number,
              status: "GESENDET",
              title: template.title,
              notes: template.notes,
              issueDate,
              dueDate,
              vatRate: template.vatRate,
              sentAt: new Date(),
              recurring: "KEINE",
              recurringParentId: template.id,
              items: {
                create: template.items.map((it) => ({
                  description: it.description,
                  quantity: it.quantity,
                  unitPriceCents: it.unitPriceCents,
                  position: it.position,
                })),
              },
            },
          });

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

    log.info("[cron recurring-invoices] done", {
      due: due.length,
      generated,
    });
    return NextResponse.json({ due: due.length, generated });
  },
);
