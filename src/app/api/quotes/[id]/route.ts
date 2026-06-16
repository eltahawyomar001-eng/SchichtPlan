import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { updateQuoteSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals } from "@/lib/billing";

/** GET /api/quotes/[id] */
export const GET = withRoute(
  "/api/quotes/[id]",
  "GET",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const quote = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        client: { select: { id: true, name: true, address: true } },
      },
    });
    if (!quote)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...quote,
      totals: computeTotals(quote.items, quote.vatRate),
    });
  },
);

/** PATCH /api/quotes/[id] — only editable while still a draft. */
export const PATCH = withRoute(
  "/api/quotes/[id]",
  "PATCH",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(updateQuoteSchema, _json.data);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;

    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status !== "ENTWURF") {
      return NextResponse.json(
        {
          error: "ONLY_DRAFT_EDITABLE",
          message: "Nur Entwürfe sind bearbeitbar.",
        },
        { status: 409 },
      );
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        clientId:
          body.clientId !== undefined
            ? body.clientId || null
            : existing.clientId,
        title: body.title !== undefined ? body.title || null : existing.title,
        notes: body.notes !== undefined ? body.notes || null : existing.notes,
        issueDate: body.issueDate
          ? new Date(body.issueDate)
          : existing.issueDate,
        validUntil:
          body.validUntil !== undefined
            ? body.validUntil
              ? new Date(body.validUntil)
              : null
            : existing.validUntil,
        vatRate: body.vatRate ?? existing.vatRate,
        ...(body.items
          ? {
              items: {
                deleteMany: {},
                create: body.items.map((it, i) => ({
                  description: it.description,
                  quantity: it.quantity,
                  unitPriceCents: it.unitPriceCents,
                  position: i,
                })),
              },
            }
          : {}),
      },
      include: { items: { orderBy: { position: "asc" } } },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "Quote",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: body,
    });

    return NextResponse.json({
      ...quote,
      totals: computeTotals(quote.items, quote.vatRate),
    });
  },
);

/** DELETE /api/quotes/[id] — soft delete. */
export const DELETE = withRoute(
  "/api/quotes/[id]",
  "DELETE",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "delete");
    if (forbidden) return forbidden;

    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "Quote",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  },
);
