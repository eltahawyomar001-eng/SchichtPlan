import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import {
  InvoiceParseError,
  missingKeyFields,
  parseEInvoice,
} from "@/lib/e-invoice/parse";

/**
 * The e-invoice inbox.
 *
 * Every German business has had to be able to RECEIVE e-invoices since
 * 1 January 2025 -- before the obligation to send them -- so this is the part
 * of the law that already binds our customers today.
 */

/**
 * An invoice is a small document; anything much larger is not one.
 *
 * A cap is needed regardless: the XML is held in memory to be parsed and then
 * stored in a TEXT column, and an unbounded upload is a trivial way to
 * exhaust either.
 */
const MAX_BYTES = 2 * 1024 * 1024;

/** GET /api/e-rechnung/eingang — the inbox. */
export const GET = withRoute("/api/e-rechnung/eingang", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "billing", "read");
  if (forbidden) return forbidden;

  const status = new URL(req.url).searchParams.get("status");

  const invoices = await prisma.incomingInvoice.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(status && status !== "ALLE"
        ? { status: status as "NEU" | "GEPRUEFT" | "BEZAHLT" | "ABGELEHNT" }
        : {}),
    },
    // The XML itself is deliberately NOT selected: the list would carry
    // megabytes of document bodies nobody is looking at.
    select: {
      id: true,
      fileName: true,
      syntax: true,
      number: true,
      typeCode: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      sellerName: true,
      sellerVatId: true,
      netCents: true,
      taxCents: true,
      grossCents: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const open = invoices.filter((i) => i.status === "NEU");
  return NextResponse.json({
    invoices,
    summary: {
      total: invoices.length,
      openCount: open.length,
      openCents: open.reduce((s, i) => s + (i.grossCents ?? 0), 0),
    },
  });
});

const importSchema = z.object({
  xml: z.string().min(1),
  fileName: z.string().trim().max(255).optional(),
});

/** POST /api/e-rechnung/eingang — import a received e-invoice. */
export const POST = withRoute(
  "/api/e-rechnung/eingang",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "create");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = importSchema.safeParse(_json.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const { xml, fileName } = parsed.data;
    if (Buffer.byteLength(xml, "utf8") > MAX_BYTES) {
      return NextResponse.json(
        {
          error: "TOO_LARGE",
          message: "Die Datei ist zu groß für eine E-Rechnung (max. 2 MB).",
        },
        { status: 413 },
      );
    }

    let invoice;
    try {
      invoice = parseEInvoice(xml);
    } catch (err) {
      if (err instanceof InvoiceParseError) {
        // The sender's message, verbatim: the user has to go back to the
        // supplier with it, and "Import fehlgeschlagen" gives them nothing
        // to say.
        return NextResponse.json(
          { error: err.code, message: err.message },
          { status: 422 },
        );
      }
      throw err;
    }

    // Identified by checksum, not by invoice number: two suppliers can use
    // the same numbering, while the same bytes are the same document.
    const sha256 = createHash("sha256").update(xml, "utf8").digest("hex");

    try {
      const created = await prisma.incomingInvoice.create({
        data: {
          workspaceId,
          xml,
          sha256,
          fileName: fileName ?? null,
          syntax: invoice.syntax,
          profile: invoice.profile,
          number: invoice.number,
          typeCode: invoice.typeCode,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          currency: invoice.currency,
          sellerName: invoice.seller.name,
          sellerVatId: invoice.seller.vatId,
          buyerName: invoice.buyer.name,
          netCents: invoice.netCents,
          taxCents: invoice.taxCents,
          grossCents: invoice.grossCents,
          precedingNumber: invoice.precedingInvoiceNumber,
          importedBy: user.id,
        },
        select: { id: true, number: true, sellerName: true, grossCents: true },
      });

      createAuditLog({
        action: "CREATE",
        entityType: "IncomingInvoice",
        entityId: created.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { number: created.number, seller: created.sellerName, sha256 },
      });

      return NextResponse.json(
        {
          ...created,
          syntax: invoice.syntax,
          // What a bookkeeper will have to supply by hand. Not a rejection:
          // a received invoice is the sender's document, and we do not get
          // to refuse it on a technicality.
          missing: missingKeyFields(invoice),
        },
        { status: 201 },
      );
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // The unique index did its job. A supplier resending the same invoice,
        // or a forwarded mail processed twice, would otherwise be booked and
        // paid twice.
        const existing = await prisma.incomingInvoice.findFirst({
          where: { workspaceId, sha256 },
          select: { id: true, number: true },
        });
        return NextResponse.json(
          {
            error: "ALREADY_IMPORTED",
            message: `Diese Rechnung wurde bereits importiert${existing?.number ? ` (${existing.number})` : ""}.`,
            id: existing?.id,
          },
          { status: 409 },
        );
      }
      throw err;
    }
  },
);
