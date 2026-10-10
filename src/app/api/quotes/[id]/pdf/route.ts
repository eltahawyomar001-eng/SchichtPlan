import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { requirePdfQuota, recordPdfGeneration } from "@/lib/subscription-guard";
import { withRoute } from "@/lib/with-route";
import { computeTotals } from "@/lib/billing";
import { generateBillingPdf } from "@/lib/billing-pdf";
import { loadInvoiceLogo } from "@/lib/invoice-logo";

/** GET /api/quotes/[id]/pdf — downloadable quote PDF. */
export const GET = withRoute(
  "/api/quotes/[id]/pdf",
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

    const quote = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        client: { select: { name: true, address: true } },
      },
    });
    if (!quote)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [workspace, issuer] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, logo: true },
      }),
      /**
       * InvoiceIssuerProfile, scoped to THIS workspace -- not the global
       * IssuerProfile, which is Shiftfy's own identity for the invoices
       * Shiftfy sends to its customers.
       *
       * Reading the global one here printed Shiftfy's legal name, address and
       * VAT ID as the supplier on quotes our customers send to THEIR clients:
       * wrong under § 14 Abs. 4, and it put our tax identifiers on third-party
       * documents. The invoice routes were corrected for this; quotes render
       * through the same generator and had the same bug.
       */
      prisma.invoiceIssuerProfile.findUnique({ where: { workspaceId } }),
    ]);

    /**
     * The same logo the plain PDF prints.
     *
     * Every route that renders a billing document has to load this, or the
     * logo appears on whichever one the uploader happened to test and is
     * missing from the rest. Resolves to null on any problem, so a logo can
     * never cost somebody their document.
     */
    const logo = await loadInvoiceLogo(issuer?.logoUrl ?? workspace?.logo);

    const pdf = generateBillingPdf({
      kind: "quote",
      number: quote.number,
      issueDate: quote.issueDate,
      secondaryDate: quote.validUntil,
      vatRate: quote.vatRate,
      title: quote.title,
      notes: quote.notes,
      items: quote.items,
      totals: computeTotals(quote.items, quote.vatRate),
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
        // Either identifier satisfies § 14 Abs. 4 Nr. 2; prefer the VAT ID,
        // which is what a business recipient expects to see.
        vatId: issuer?.vatId ?? issuer?.taxNumber ?? null,
        logo,
      },
      recipient: {
        name: quote.client?.name ?? null,
        address: quote.client?.address ?? null,
      },
    });

    await recordPdfGeneration(workspaceId);

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Angebot_${quote.number}.pdf"`,
        "Content-Length": String(pdf.byteLength),
      },
    });
  },
);
