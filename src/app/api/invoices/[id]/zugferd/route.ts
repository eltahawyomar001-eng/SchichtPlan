import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { computeTotals } from "@/lib/billing";
import { generateBillingPdf } from "@/lib/billing-pdf";
import { loadInvoiceLogo } from "@/lib/invoice-logo";
import { buildZugferdPdf } from "@/lib/e-invoice/zugferd";

/**
 * GET /api/invoices/[id]/zugferd — the hybrid PDF.
 *
 * The PDF is rendered on demand, but the XML inside it is the ARCHIVED one,
 * never regenerated. That keeps a single authoritative document per invoice:
 * the readable layer can be rebuilt from current code, while the bookable
 * layer stays byte-identical to what was issued.
 */
export const GET = withRoute(
  "/api/invoices/[id]/zugferd",
  "GET",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const invoice = await prisma.customerInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        client: { select: { name: true, address: true } },
      },
    });
    if (!invoice)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!invoice.einvoiceXml || !invoice.number) {
      return NextResponse.json(
        {
          error: "NOT_ISSUED",
          message:
            "Für diese Rechnung liegt noch keine E-Rechnung vor. Stellen Sie die Rechnung zunächst aus.",
        },
        { status: 409 },
      );
    }

    const [workspace, issuer] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, logo: true },
      }),
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
      kind: "invoice",
      number: invoice.number,
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
        vatId: issuer?.vatId ?? issuer?.taxNumber ?? null,
        logo,
      },
      recipient: {
        name: invoice.client?.name ?? null,
        address: invoice.client?.address ?? null,
      },
    });

    const bytes = await buildZugferdPdf({
      pdf,
      xml: invoice.einvoiceXml,
      invoiceNumber: invoice.number,
    });

    // .slice() yields a plain ArrayBuffer, which the web Response type
    // accepts where a Uint8Array view does not.
    return new Response(bytes.slice().buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Rechnung_${invoice.number}.pdf"`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  },
);
