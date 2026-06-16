import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { requirePdfQuota, recordPdfGeneration } from "@/lib/subscription-guard";
import { withRoute } from "@/lib/with-route";
import { computeTotals } from "@/lib/billing";
import { generateBillingPdf } from "@/lib/billing-pdf";

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
        select: { name: true },
      }),
      prisma.issuerProfile.findFirst({ orderBy: { validFrom: "desc" } }),
    ]);

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
        name: issuer?.name ?? workspace?.name ?? "Shiftfy",
        address: issuer?.address ?? null,
        vatId: issuer?.vatId ?? null,
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
