import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createQuoteSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals, nextQuoteNumber } from "@/lib/billing";

/** GET /api/quotes — list quotes for the workspace (newest first). */
export const GET = withRoute("/api/quotes", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "billing", "read");
  if (forbidden) return forbidden;

  const quotes = await prisma.quote.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      items: { orderBy: { position: "asc" } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const withTotals = quotes.map((q) => ({
    ...q,
    totals: computeTotals(q.items, q.vatRate),
  }));

  return NextResponse.json(withTotals);
});

/** POST /api/quotes — create a draft quote with line items. */
export const POST = withRoute("/api/quotes", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "billing", "create");
  if (forbidden) return forbidden;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const parsed = validateBody(createQuoteSchema, _json.data);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  // Guard: a client, if supplied, must belong to this workspace.
  if (body.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: body.clientId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  const number = await nextQuoteNumber(workspaceId);

  const quote = await prisma.quote.create({
    data: {
      workspaceId,
      clientId: body.clientId || null,
      number,
      title: body.title || null,
      notes: body.notes || null,
      issueDate: new Date(body.issueDate),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      vatRate: body.vatRate ?? 19,
      items: {
        create: body.items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          position: i,
        })),
      },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  createAuditLog({
    action: "CREATE",
    entityType: "Quote",
    entityId: quote.id,
    userId: user.id,
    userEmail: user.email,
    workspaceId,
    changes: { number },
  });

  return NextResponse.json(
    { ...quote, totals: computeTotals(quote.items, quote.vatRate) },
    { status: 201 },
  );
});
