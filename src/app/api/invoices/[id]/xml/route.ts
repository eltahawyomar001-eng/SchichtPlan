import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { xmlChecksum } from "@/lib/e-invoice/issue";

/**
 * GET /api/invoices/[id]/xml — the e-invoice as issued.
 *
 * Serves the ARCHIVED XML, never a freshly generated one. Regenerating would
 * reflect today's code and today's master data: a customer who has since moved
 * office would get a document with the new address under the old invoice
 * number, which is not the document the recipient holds and not what § 147 AO
 * requires us to keep.
 */
export const GET = withRoute(
  "/api/invoices/[id]/xml",
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
      select: {
        number: true,
        einvoiceXml: true,
        einvoiceSha256: true,
        einvoiceFormat: true,
        issuedAt: true,
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!invoice.einvoiceXml) {
      return NextResponse.json(
        {
          error: "NOT_ISSUED",
          message:
            "Für diese Rechnung liegt noch keine E-Rechnung vor. Stellen Sie die Rechnung zunächst aus.",
        },
        { status: 409 },
      );
    }

    // The archive is supposed to be byte-identical to what was sent, and the
    // checksum is the only thing that can show it still is. Checking on every
    // read is cheap, and a silent mismatch is exactly what an audit would
    // later be unable to explain.
    const actual = xmlChecksum(invoice.einvoiceXml);
    const intact = !invoice.einvoiceSha256 || actual === invoice.einvoiceSha256;

    const filename = `${invoice.einvoiceFormat === "XRECHNUNG" ? "XRechnung" : "ERechnung"}_${invoice.number ?? id}.xml`;

    return new Response(invoice.einvoiceXml, {
      status: 200,
      headers: {
        // The registered type for XRechnung. text/xml would have the browser
        // render it instead of handing it to the accounting software.
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // So a recipient or an auditor can verify the file without asking us.
        "X-Invoice-Checksum": actual,
        ...(intact ? {} : { "X-Invoice-Checksum-Mismatch": "true" }),
      },
    });
  },
);
