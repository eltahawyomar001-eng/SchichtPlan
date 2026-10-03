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

      // An invoice cannot be "sent" before it has been issued. Flipping the
      // status used to be how sending worked, which produced an invoice with
      // a status but no number, no structured document and no § 14 Abs. 4
      // check -- the UI no longer offers it, and the API must not either.
      if (next === "GESENDET" && !existing.issuedAt) {
        return NextResponse.json(
          {
            error: "NOT_ISSUED",
            message:
              "Die Rechnung muss zuerst als E-Rechnung ausgestellt werden, bevor sie als gesendet markiert werden kann.",
          },
          { status: 409 },
        );
      }

      // Cancelling is a document, not a status. Writing STORNIERT directly
      // would mark the invoice cancelled with no credit note behind it, which
      // leaves the books showing a reversal that does not exist.
      if (next === "STORNIERT") {
        return NextResponse.json(
          {
            error: "USE_STORNO_ENDPOINT",
            message:
              "Eine gestellte Rechnung wird über eine Storno-Rechnung storniert, nicht durch eine Statusänderung.",
          },
          { status: 409 },
        );
      }
      const updated = await prisma.customerInvoice.update({
        where: { id },
        data: {
          status: next,
          sentAt:
            next === "GESENDET"
              ? (existing.sentAt ?? new Date())
              : existing.sentAt,
          paidAt: next === "BEZAHLT" ? new Date() : existing.paidAt,
          // Recurrence is stopped by the storno endpoint, which is now the
          // only route to STORNIERT -- so there is nothing to decide here.
          recurringActive: existing.recurringActive,
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
    //
    // issuedAt is checked FIRST and separately from the status. Status is a
    // workflow field that a future feature could legitimately move around;
    // issuedAt is the record of a legal event and is the thing that must never
    // be editable behind. GoBD allows no change to an issued invoice at all,
    // only a Storno or Korrektur that references it.
    if (existing.issuedAt) {
      return NextResponse.json(
        {
          error: "ISSUED_IMMUTABLE",
          message:
            `Die Rechnung ${existing.number ?? ""} wurde bereits gestellt und darf nach GoBD nicht mehr geändert werden. ` +
            "Erstellen Sie für eine Korrektur eine Storno-Rechnung.".trim(),
        },
        { status: 409 },
      );
    }
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

    // An issued invoice cannot be deleted, not even softly. It has a number
    // from a gapless sequence and the recipient already has it; removing it
    // from the books is exactly what § 147 AO and the GoBD retention rules
    // forbid. The lawful way to undo one is a Storno document.
    if (existing.issuedAt) {
      return NextResponse.json(
        {
          error: "ISSUED_NOT_DELETABLE",
          message:
            `Die gestellte Rechnung ${existing.number ?? ""} kann nicht gelöscht werden. ` +
            "Stornieren Sie sie stattdessen; der Storno bleibt nachvollziehbar.".trim(),
        },
        { status: 409 },
      );
    }

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
