import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import {
  collectBillableHours,
  previewNetCents,
} from "@/lib/e-invoice/from-hours";

/**
 * Invoicing recorded time.
 *
 * GET previews what is billable; POST turns it into a draft invoice. They run
 * the SAME collection, so the preview cannot promise something the creation
 * then declines to bill.
 */

const querySchema = z.object({
  clientId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

/** End of the given day, so `to` is inclusive the way a human means it. */
function endOfDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function collect(workspaceId: string, q: z.infer<typeof querySchema>) {
  const from = new Date(q.from);
  const to = endOfDay(q.to);

  const [entries, projects] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        date: { gte: from, lte: to },
        // Scoped to the client's projects in the query rather than filtered in
        // memory afterwards: a workspace can have a lot of time entries, and
        // loading all of them to throw most away does not stay fast.
        project: { clientId: q.clientId, deletedAt: null },
      },
      select: {
        id: true,
        date: true,
        netMinutes: true,
        status: true,
        projectId: true,
        invoicedItemId: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.project.findMany({
      where: { workspaceId, clientId: q.clientId, deletedAt: null },
      select: { id: true, name: true, billRate: true, clientId: true },
    }),
  ]);

  return collectBillableHours({ entries, projects, clientId: q.clientId });
}

/** GET /api/invoices/aus-stunden?clientId=&from=&to= — preview. */
export const GET = withRoute(
  "/api/invoices/aus-stunden",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      clientId: url.searchParams.get("clientId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
    }

    const result = await collect(workspaceId, parsed.data);

    return NextResponse.json({
      lines: result.lines,
      // Returned, not discarded: hours that cannot be billed are exactly what
      // the user needs to see, and silently dropping them is how a day's work
      // goes uninvoiced without anybody noticing.
      skipped: result.skipped,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      netCents: previewNetCents(result.lines),
    });
  },
);

/**
 * Another invoice claimed some of these hours while we were building this one.
 *
 * Its own class so the catch below cannot accidentally swallow a genuine
 * database failure and report it to the user as a harmless race.
 */
class ConcurrentClaimError extends Error {
  constructor() {
    super("CONCURRENT_CLAIM");
    this.name = "ConcurrentClaimError";
  }
}

const createSchema = querySchema.extend({
  title: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
  vatRate: z.number().min(0).max(100).optional(),
});

/** POST /api/invoices/aus-stunden — create a draft from the billable hours. */
export const POST = withRoute(
  "/api/invoices/aus-stunden",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "create");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = createSchema.safeParse(_json.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const client = await prisma.client.findFirst({
      where: { id: body.clientId, workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }

    const issuer = await prisma.invoiceIssuerProfile.findUnique({
      where: { workspaceId },
      select: { paymentTermDays: true },
    });

    const result = await collect(workspaceId, body);
    if (result.lines.length === 0) {
      return NextResponse.json(
        {
          error: "NOTHING_BILLABLE",
          message:
            "Im gewählten Zeitraum gibt es keine abrechenbaren Stunden für diesen Kunden.",
          skipped: result.skipped,
        },
        { status: 409 },
      );
    }

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (issuer?.paymentTermDays ?? 14));

    let invoice;
    try {
      invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.customerInvoice.create({
          data: {
            workspaceId,
            clientId: client.id,
            // No number: drawn at issue, like every other draft.
            number: null,
            title:
              body.title ??
              `Leistungen ${result.periodStart?.toLocaleDateString("de-DE")} – ${result.periodEnd?.toLocaleDateString("de-DE")}`,
            notes: body.notes ?? null,
            issueDate,
            dueDate,
            vatRate: body.vatRate ?? 19,
            items: {
              create: result.lines.map((l, i) => ({
                description: l.description,
                quantity: l.quantity,
                unitPriceCents: l.unitPriceCents,
                unitCode: l.unitCode,
                position: i,
              })),
            },
          },
          include: { items: { orderBy: { position: "asc" } } },
        });

        // Claim the hours INSIDE the transaction, and insist on claiming ALL of
        // them.
        //
        // `invoicedItemId: null` in the filter is what makes the claim safe
        // against a concurrent request that collected the same entries a moment
        // earlier. But a partial claim is not a partial success: the line above
        // already bills every one of those hours, so if some were taken by
        // another invoice between the collection and this write, this invoice
        // would bill them a second time. Short count therefore aborts the whole
        // transaction rather than quietly billing hours we no longer own.
        for (let i = 0; i < result.lines.length; i++) {
          const want = result.lines[i].entryIds;
          const claimed = await tx.timeEntry.updateMany({
            where: {
              id: { in: want },
              workspaceId,
              invoicedItemId: null,
            },
            data: { invoicedItemId: created.items[i].id },
          });
          if (claimed.count !== want.length) {
            throw new ConcurrentClaimError();
          }
        }

        return created;
      });
    } catch (err) {
      if (err instanceof ConcurrentClaimError) {
        // 409, and the user simply tries again: the second attempt collects
        // what is actually still billable.
        return NextResponse.json(
          {
            error: "CONCURRENT_CLAIM",
            message:
              "Ein Teil der Stunden wurde gerade von einer anderen Rechnung übernommen. Bitte versuchen Sie es erneut.",
          },
          { status: 409 },
        );
      }
      throw err;
    }

    createAuditLog({
      action: "CREATE",
      entityType: "CustomerInvoice",
      entityId: invoice.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: {
        fromHours: true,
        clientId: client.id,
        from: body.from,
        to: body.to,
        lines: result.lines.length,
        entries: result.lines.reduce((s, l) => s + l.entryIds.length, 0),
      },
    });

    return NextResponse.json(
      { id: invoice.id, lines: invoice.items.length, skipped: result.skipped },
      { status: 201 },
    );
  },
);
