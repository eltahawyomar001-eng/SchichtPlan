import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { updateInvoiceSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals } from "@/lib/billing";

const statusSchema = z.object({
  status: z.enum(["GESENDET", "BEZAHLT", "STORNIERT"]).optional(),
});

/** GET /api/invoices/[id] */
export const GET = withRoute(
  "/api/invoices/[id]",
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
        client: { select: { id: true, name: true, address: true } },
      },
    });
    if (!invoice)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...invoice,
      totals: computeTotals(invoice.items, invoice.vatRate),
    });
  },
);

/**
 * PATCH /api/invoices/[id]
 * - With { status }: transition (send / mark paid / cancel).
 * - Otherwise: edit fields/items (only allowed while ENTWURF).
 */
export const PATCH = withRoute(
  "/api/invoices/[id]",
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
    const raw = _json.data as Record<string, unknown>;

    const existing = await prisma.customerInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ── Status transition path ──
    if (raw.status !== undefined) {
      const parsed = statusSchema.safeParse(raw);
      if (!parsed.success || !parsed.data.status) {
        return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
      }
      const next = parsed.data.status;
      const updated = await prisma.customerInvoice.update({
        where: { id },
        data: {
          status: next,
          sentAt:
            next === "GESENDET"
              ? (existing.sentAt ?? new Date())
              : existing.sentAt,
          paidAt: next === "BEZAHLT" ? new Date() : existing.paidAt,
          // Stop recurrence if the template is cancelled.
          recurringActive:
            next === "STORNIERT" ? false : existing.recurringActive,
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
      createAuditLog({
        action: "UPDATE",
        entityType: "CustomerInvoice",
        entityId: id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { status: next },
      });
      return NextResponse.json({
        ...updated,
        totals: computeTotals(updated.items, updated.vatRate),
      });
    }

    // ── Field/item edit path (drafts only) ──
    if (existing.status !== "ENTWURF") {
      return NextResponse.json(
        {
          error: "ONLY_DRAFT_EDITABLE",
          message: "Nur Entwürfe sind bearbeitbar.",
        },
        { status: 409 },
      );
    }
    const parsed = validateBody(updateInvoiceSchema, raw);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;

    const updated = await prisma.customerInvoice.update({
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
        dueDate: body.dueDate ? new Date(body.dueDate) : existing.dueDate,
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
      entityType: "CustomerInvoice",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: body,
    });

    return NextResponse.json({
      ...updated,
      totals: computeTotals(updated.items, updated.vatRate),
    });
  },
);

/** DELETE /api/invoices/[id] — soft delete. */
export const DELETE = withRoute(
  "/api/invoices/[id]",
  "DELETE",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "delete");
    if (forbidden) return forbidden;

    const existing = await prisma.customerInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.customerInvoice.update({
      where: { id },
      data: { deletedAt: new Date(), recurringActive: false },
    });

    createAuditLog({
      action: "DELETE",
      entityType: "CustomerInvoice",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
    });

    return NextResponse.json({ success: true });
  },
);
