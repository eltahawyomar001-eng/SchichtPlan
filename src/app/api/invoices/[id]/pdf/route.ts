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
      prisma.issuerProfile.findFirst({ orderBy: { validFrom: "desc" } }),
    ]);

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
        name: issuer?.name ?? workspace?.name ?? "Shiftfy",
        address: issuer?.address ?? null,
        vatId: issuer?.vatId ?? null,
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
        "Content-Disposition": `attachment; filename="Rechnung_${invoice.number}.pdf"`,
        "Content-Length": String(pdf.byteLength),
      },
    });
  },
);
