import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals, nextInvoiceNumber } from "@/lib/billing";

/**
 * POST /api/quotes/[id]/convert
 *
 * Converts an accepted (or sent) quote into a draft invoice, copying line
 * items and a 14-day default due date. Idempotent: returns the existing
 * invoice if the quote was already converted.
 */
export const POST = withRoute(
  "/api/quotes/[id]/convert",
  "POST",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "create");
    if (forbidden) return forbidden;

    const quote = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!quote)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (quote.convertedInvoiceId) {
      const existingInvoice = await prisma.customerInvoice.findFirst({
        where: { id: quote.convertedInvoiceId, workspaceId },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (existingInvoice) {
        return NextResponse.json({
          ...existingInvoice,
          totals: computeTotals(existingInvoice.items, existingInvoice.vatRate),
          alreadyConverted: true,
        });
      }
    }

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 14);
    const number = await nextInvoiceNumber(workspaceId);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.customerInvoice.create({
        data: {
          workspaceId,
          clientId: quote.clientId,
          quoteId: quote.id,
          number,
          title: quote.title,
          notes: quote.notes,
          issueDate,
          dueDate,
          vatRate: quote.vatRate,
          items: {
            create: quote.items.map((it) => ({
              description: it.description,
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              position: it.position,
            })),
          },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: { convertedInvoiceId: inv.id },
      });
      return inv;
    });

    createAuditLog({
      action: "CREATE",
      entityType: "CustomerInvoice",
      entityId: invoice.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { number, fromQuote: quote.number },
    });

    return NextResponse.json(
      { ...invoice, totals: computeTotals(invoice.items, invoice.vatRate) },
      { status: 201 },
    );
  },
);
