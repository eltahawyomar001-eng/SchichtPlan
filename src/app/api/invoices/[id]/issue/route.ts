import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { issueInvoiceInTx } from "@/lib/e-invoice/issue";
import { preflightInvoice } from "@/lib/e-invoice/preflight";

const bodySchema = z.object({
  format: z.enum(["XRECHNUNG", "ZUGFERD"]).optional(),
});

/**
 * POST /api/invoices/[id]/issue — issue a draft as an e-invoice.
 *
 * The point of no return. Draws the invoice number, generates and archives the
 * XML, and freezes the record; from here the only correction is a Storno.
 */
export const POST = withRoute(
  "/api/invoices/[id]/issue",
  "POST",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Issuing is not an edit, it is the creation of a legal document. It needs
    // the same permission as creating one.
    const forbidden = requirePermission(user, "billing", "create");
    if (forbidden) return forbidden;

    // The body is optional here -- issuing with the configured default format
    // is the normal case -- so an empty body must not be a parse error.
    let body: unknown = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_FORMAT" }, { status: 400 });
    }

    // One transaction: a number drawn without the document being written is
    // precisely the gap the sequence exists to prevent.
    const result = await prisma.$transaction((tx) =>
      issueInvoiceInTx(tx, {
        invoiceId: id,
        workspaceId,
        format: parsed.data.format,
      }),
    );

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (result.code === "ALREADY_ISSUED") {
        return NextResponse.json(
          {
            error: "ALREADY_ISSUED",
            message:
              `Die Rechnung ${result.number ?? ""} wurde bereits gestellt und kann nicht erneut gestellt werden. Für eine Korrektur erstellen Sie eine Storno-Rechnung.`.trim(),
            number: result.number,
          },
          { status: 409 },
        );
      }
      // 422, not 400: the request is well-formed, the data behind it is not
      // yet complete enough to produce a lawful invoice.
      return NextResponse.json(
        {
          error: "PREFLIGHT_FAILED",
          message:
            "Die Rechnung kann noch nicht gestellt werden. Bitte ergänzen Sie die folgenden Angaben.",
          issues: result.issues,
        },
        { status: 422 },
      );
    }

    createAuditLog({
      action: "UPDATE",
      entityType: "CustomerInvoice",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      // The checksum goes in the audit log as well as on the row: it is what
      // lets an audit show the archived XML is the one that was issued, even
      // if the row were later tampered with.
      changes: {
        issued: true,
        number: result.number,
        format: result.format,
        einvoiceSha256: result.sha256,
      },
    });

    return NextResponse.json({
      number: result.number,
      format: result.format,
      sha256: result.sha256,
    });
  },
);

/**
 * GET /api/invoices/[id]/issue — what still stands in the way of issuing.
 *
 * Same checks the POST runs, without the consequences, so the UI can show the
 * blocking list on the invoice before the user commits to anything.
 */
export const GET = withRoute(
  "/api/invoices/[id]/issue",
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
        client: true,
        corrects: { select: { number: true } },
      },
    });
    if (!invoice)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const issuer = await prisma.invoiceIssuerProfile.findUnique({
      where: { workspaceId },
    });

    const issues = preflightInvoice({
      issuer,
      client: invoice.client,
      invoice: {
        issueDate: invoice.issueDate,
        lines: invoice.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          vatRate: it.vatRate ?? invoice.vatRate,
          category: "S" as const,
          unitCode: it.unitCode,
        })),
        reverseCharge: invoice.reverseCharge,
        typeCode: invoice.correctsInvoiceId ? "381" : "380",
        correctsNumber: invoice.corrects?.number ?? null,
      },
    });

    return NextResponse.json({
      canIssue: issues.length === 0 && !invoice.issuedAt,
      alreadyIssued: Boolean(invoice.issuedAt),
      issues,
    });
  },
);
