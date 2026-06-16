import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createInvoiceSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals, nextInvoiceNumber, addInterval } from "@/lib/billing";

/**
 * GET /api/invoices — list customer invoices + an outstanding-amount summary.
 * Side-effect: flips overdue GESENDET invoices to UEBERFAELLIG on read.
 */
export const GET = withRoute("/api/invoices", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "billing", "read");
  if (forbidden) return forbidden;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.customerInvoice.updateMany({
    where: {
      workspaceId,
      status: "GESENDET",
      dueDate: { lt: today },
      deletedAt: null,
    },
    data: { status: "UEBERFAELLIG" },
  });

  const invoices = await prisma.customerInvoice.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      items: { orderBy: { position: "asc" } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  const withTotals = invoices.map((inv) => ({
    ...inv,
    totals: computeTotals(inv.items, inv.vatRate),
  }));

  // Outstanding = not yet paid and not cancelled.
  const outstanding = withTotals.filter(
    (i) => i.status === "GESENDET" || i.status === "UEBERFAELLIG",
  );
  const summary = {
    outstandingCents: outstanding.reduce((s, i) => s + i.totals.grossCents, 0),
    outstandingCount: outstanding.length,
    overdueCents: withTotals
      .filter((i) => i.status === "UEBERFAELLIG")
      .reduce((s, i) => s + i.totals.grossCents, 0),
    overdueCount: withTotals.filter((i) => i.status === "UEBERFAELLIG").length,
    paidThisYearCents: withTotals
      .filter(
        (i) =>
          i.status === "BEZAHLT" &&
          i.paidAt &&
          new Date(i.paidAt).getFullYear() === today.getFullYear(),
      )
      .reduce((s, i) => s + i.totals.grossCents, 0),
  };

  return NextResponse.json({ invoices: withTotals, summary });
});

/** POST /api/invoices — create a draft invoice (optionally recurring). */
export const POST = withRoute("/api/invoices", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "billing", "create");
  if (forbidden) return forbidden;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const parsed = validateBody(createInvoiceSchema, _json.data);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  if (body.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: body.clientId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  const recurring = body.recurring ?? "KEINE";
  const issueDate = new Date(body.issueDate);
  const number = await nextInvoiceNumber(workspaceId);

  const invoice = await prisma.customerInvoice.create({
    data: {
      workspaceId,
      clientId: body.clientId || null,
      number,
      title: body.title || null,
      notes: body.notes || null,
      issueDate,
      dueDate: new Date(body.dueDate),
      vatRate: body.vatRate ?? 19,
      recurring,
      recurringActive: recurring !== "KEINE",
      recurringNextRun:
        recurring !== "KEINE" ? addInterval(issueDate, recurring) : null,
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
    entityType: "CustomerInvoice",
    entityId: invoice.id,
    userId: user.id,
    userEmail: user.email,
    workspaceId,
    changes: { number, recurring },
  });

  return NextResponse.json(
    { ...invoice, totals: computeTotals(invoice.items, invoice.vatRate) },
    { status: 201 },
  );
});
