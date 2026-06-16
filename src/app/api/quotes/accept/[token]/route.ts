import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals } from "@/lib/billing";

/**
 * Public quote-acceptance endpoint (no authentication — guarded by the opaque
 * acceptToken). Powers the one-click customer confirmation page.
 *
 * GET  /api/quotes/accept/[token] — read-only view for the customer.
 * POST /api/quotes/accept/[token] — body { decision: "accept" | "decline" }.
 */
export const GET = withRoute(
  "/api/quotes/accept/[token]",
  "GET",
  async (req, context) => {
    const { token } = await context!.params;

    const quote = await prisma.quote.findFirst({
      where: { acceptToken: token, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        client: { select: { name: true } },
        workspace: { select: { name: true } },
      },
    });
    if (!quote)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      number: quote.number,
      title: quote.title,
      notes: quote.notes,
      status: quote.status,
      issueDate: quote.issueDate,
      validUntil: quote.validUntil,
      vatRate: quote.vatRate,
      clientName: quote.client?.name ?? null,
      workspaceName: quote.workspace.name,
      items: quote.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
      totals: computeTotals(quote.items, quote.vatRate),
    });
  },
);

export const POST = withRoute(
  "/api/quotes/accept/[token]",
  "POST",
  async (req, context) => {
    const { token } = await context!.params;
    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const decision = (_json.data as { decision?: string }).decision;
    if (decision !== "accept" && decision !== "decline") {
      return NextResponse.json({ error: "INVALID_DECISION" }, { status: 400 });
    }

    const quote = await prisma.quote.findFirst({
      where: { acceptToken: token, deletedAt: null },
    });
    if (!quote)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (quote.status === "ANGENOMMEN" || quote.status === "ABGELEHNT") {
      return NextResponse.json(
        { error: "ALREADY_DECIDED", status: quote.status },
        { status: 409 },
      );
    }
    if (quote.status !== "GESENDET") {
      return NextResponse.json({ error: "NOT_OPEN" }, { status: 409 });
    }

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data:
        decision === "accept"
          ? { status: "ANGENOMMEN", acceptedAt: new Date() }
          : { status: "ABGELEHNT", declinedAt: new Date() },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Quote",
      entityId: quote.id,
      userId: "public",
      userEmail: "customer@public",
      workspaceId: quote.workspaceId,
      changes: { decision, via: "public-link" },
    });

    return NextResponse.json({ status: updated.status });
  },
);
