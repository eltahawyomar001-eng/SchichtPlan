import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { parseEInvoice } from "@/lib/e-invoice/parse";

/** GET /api/e-rechnung/eingang/[id] — one received invoice, fully parsed. */
export const GET = withRoute(
  "/api/e-rechnung/eingang/[id]",
  "GET",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const row = await prisma.incomingInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Re-parsed on read rather than storing every line at import: the XML is
    // the record, the columns are an index over it, and the line detail is
    // only wanted when someone actually opens the invoice.
    let detail = null;
    try {
      detail = parseEInvoice(row.xml);
    } catch {
      // A row that parsed at import but not now means our parser changed.
      // The stored columns still describe it, so the invoice stays readable.
      detail = null;
    }

    return NextResponse.json({ invoice: row, detail });
  },
);

const patchSchema = z.object({
  status: z.enum(["NEU", "GEPRUEFT", "BEZAHLT", "ABGELEHNT"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/** PATCH /api/e-rechnung/eingang/[id] — review state and notes. */
export const PATCH = withRoute(
  "/api/e-rechnung/eingang/[id]",
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
    const parsed = patchSchema.safeParse(_json.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const existing = await prisma.incomingInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const next = parsed.data.status;
    const updated = await prisma.incomingInvoice.update({
      where: { id },
      data: {
        ...(next ? { status: next } : {}),
        ...(parsed.data.notes !== undefined
          ? { notes: parsed.data.notes }
          : {}),
        // Only ever set, never cleared: when a document was first reviewed is
        // a fact, and moving it back to NEU does not unmake it.
        ...(next && next !== "NEU" ? { reviewedAt: new Date() } : {}),
        ...(next === "BEZAHLT" ? { paidAt: new Date() } : {}),
      },
      select: { id: true, status: true, notes: true, paidAt: true },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "IncomingInvoice",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: parsed.data,
    });

    return NextResponse.json(updated);
  },
);
