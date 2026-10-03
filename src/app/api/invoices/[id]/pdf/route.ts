import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { requirePdfQuota, recordPdfGeneration } from "@/lib/subscription-guard";
import { withRoute } from "@/lib/with-route";
import { computeTotals } from "@/lib/billing";
import { generateBillingPdf } from "@/lib/billing-pdf";

/** GET /api/invoices/[id]/pdf — downloadable invoice PDF. */
export const GET = withRoute(
  "/api/invoices/[id]/pdf",
  "GET",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const pdfLimit = await requirePdfQuota(workspaceId);
    if (pdfLimit) return pdfLimit;

    const invoice = await prisma.customerInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        client: { select: { name: true, address: true } },
      },
    });
    if (!invoice)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [workspace, issuer] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      // InvoiceIssuerProfile, scoped to THIS workspace -- not the global
      // IssuerProfile, which is Shiftfy's own identity for the invoices
      // Shiftfy sends to its customers. Reading that one here printed
      // Shiftfy's name, address and VAT ID as the supplier on invoices our
      // customers send to THEIR clients: wrong under § 14 Abs. 4, and it
      // leaked our tax identifiers onto third-party documents.
      prisma.invoiceIssuerProfile.findUnique({ where: { workspaceId } }),
    ]);

    // A draft has no number yet, by design: GoBD counts the issued invoices,
    // so a number is drawn only at issue. The PDF of a draft therefore has to
    // say so rather than invent one -- and must not look like a real invoice,
    // because a draft that reads like one is exactly what ends up being paid
    // and booked.
    const isDraft = !invoice.number;
    const displayNumber = invoice.number ?? "ENTWURF";

    const pdf = generateBillingPdf({
      kind: "invoice",
      number: displayNumber,
      draft: isDraft,
      issueDate: invoice.issueDate,
      secondaryDate: invoice.dueDate,
      vatRate: invoice.vatRate,
      title: invoice.title,
      notes: invoice.notes,
      items: invoice.items,
      totals: computeTotals(invoice.items, invoice.vatRate),
      issuer: {
        name: issuer?.legalName ?? workspace?.name ?? "",
        address: issuer
          ? [
              issuer.street,
              issuer.addressLine2,
              `${issuer.postalCode} ${issuer.city}`.trim(),
            ]
              .filter(Boolean)
              .join("\n")
          : null,
        // Either identifier satisfies § 14 Abs. 4 Nr. 2; show whichever the
        // customer has, preferring the VAT ID since that is what a business
        // recipient expects to see.
        vatId: issuer?.vatId ?? issuer?.taxNumber ?? null,
      },
      recipient: {
        name: invoice.client?.name ?? null,
        address: invoice.client?.address ?? null,
      },
    });

    await recordPdfGeneration(workspaceId);

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Rechnung_${displayNumber}.pdf"`,
        "Content-Length": String(pdf.byteLength),
      },
    });
  },
);
