import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/notifications/email";
import { computeTotals } from "@/lib/billing";
import { generateBillingPdf } from "@/lib/billing-pdf";

const bodySchema = z.object({
  /** Overrides the client's stored invoicing address for this send only. */
  to: z.string().email().optional(),
  message: z.string().trim().max(2000).optional(),
});

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

/**
 * POST /api/invoices/[id]/send — email the invoice to the client.
 *
 * Both files go in one message: the XML, which is the legally relevant
 * document and what the recipient's software reads, and a PDF, which is what
 * a person reads. Sending only the XML is correct and unhelpful; sending only
 * the PDF does not satisfy the e-invoicing requirement at all.
 */
export const POST = withRoute(
  "/api/invoices/[id]/send",
  "POST",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "update");
    if (forbidden) return forbidden;

    let body: unknown = {};
    try {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const invoice = await prisma.customerInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        items: { orderBy: { position: "asc" } },
        client: true,
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only an issued invoice can be sent. A draft has no number and no
    // structured document, so what would arrive is not an invoice.
    if (!invoice.issuedAt || !invoice.einvoiceXml) {
      return NextResponse.json(
        {
          error: "NOT_ISSUED",
          message:
            "Die Rechnung muss zuerst als E-Rechnung ausgestellt werden, bevor sie versendet werden kann.",
        },
        { status: 409 },
      );
    }

    const to =
      parsed.data.to ??
      invoice.client?.invoiceEmail ??
      invoice.client?.email ??
      null;
    if (!to) {
      return NextResponse.json(
        {
          error: "NO_RECIPIENT",
          message:
            "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Bitte ergänzen Sie sie beim Kunden oder geben Sie eine Adresse an.",
        },
        { status: 409 },
      );
    }

    const [workspace, issuer] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      prisma.invoiceIssuerProfile.findUnique({ where: { workspaceId } }),
    ]);

    const totals = computeTotals(invoice.items, invoice.vatRate);

    const pdf = generateBillingPdf({
      kind: "invoice",
      number: invoice.number ?? "",
      issueDate: invoice.issueDate,
      secondaryDate: invoice.dueDate,
      vatRate: invoice.vatRate,
      title: invoice.title,
      notes: invoice.notes,
      items: invoice.items,
      totals,
      issuer: {
        name: issuer?.legalName ?? workspace?.name ?? "",
        address: issuer
          ? [
              issuer.street,
              issuer.addressLine2,
              `${issuer.postalCode} ${issuer.city}`.trim(),
            ]
              .filter(Boolean)
              .join("\n")
          : null,
        vatId: issuer?.vatId ?? issuer?.taxNumber ?? null,
      },
      recipient: {
        name: invoice.client?.name ?? null,
        address: invoice.client?.address ?? null,
      },
    });

    const senderName = issuer?.legalName ?? workspace?.name ?? "";
    const due = invoice.dueDate.toLocaleDateString("de-DE");
    const xmlName = `${invoice.einvoiceFormat === "XRECHNUNG" ? "XRechnung" : "ERechnung"}_${invoice.number}.xml`;

    const result = await sendEmail({
      to,
      type: "customer_invoice",
      category: "transactional",
      title: `Rechnung ${invoice.number} von ${senderName}`,
      message:
        (parsed.data.message?.trim()
          ? `${parsed.data.message.trim()}\n\n`
          : "") +
        `anbei erhalten Sie die Rechnung ${invoice.number} über ${euro(totals.grossCents)}, fällig am ${due}.\n\n` +
        // Said explicitly because an accounts-payable department that sees
        // only the PDF will file the PDF, and the XML is the document their
        // software is supposed to read.
        `Die Rechnung liegt als E-Rechnung (${xmlName}) sowie als PDF bei. Maßgeblich ist die XML-Datei.`,
      attachments: [
        { filename: xmlName, content: invoice.einvoiceXml },
        {
          filename: `Rechnung_${invoice.number}.pdf`,
          content: Buffer.from(pdf),
        },
      ],
    });

    if (!result.success) {
      // Not retried in the background: see sendEmail. Reporting the failure
      // lets the user try again rather than believing it went out.
      return NextResponse.json(
        {
          error: "SEND_FAILED",
          message:
            "Die Rechnung konnte nicht versendet werden. Bitte versuchen Sie es erneut.",
          detail: result.error,
        },
        { status: 502 },
      );
    }

    // sentAt only moves on success, so it remains an accurate record of when
    // the customer actually received the invoice.
    await prisma.customerInvoice.update({
      where: { id },
      data: { sentAt: new Date() },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "CustomerInvoice",
      entityId: id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { sent: true, to, number: invoice.number },
    });

    return NextResponse.json({ sent: true, to });
  },
);
