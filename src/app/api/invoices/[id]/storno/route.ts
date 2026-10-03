import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { issueInvoiceInTx } from "@/lib/e-invoice/issue";

const bodySchema = z.object({
  /** Shown on the Storno and kept for the audit trail. */
  reason: z.string().trim().min(1).max(500).optional(),
  /** Issue it straight away. A draft Storno is of no use to anybody. */
  issue: z.boolean().optional(),
});

/**
 * POST /api/invoices/[id]/storno — reverse an issued invoice.
 *
 * The ONLY lawful way to undo an issued invoice: GoBD permits no change to one
 * and no deletion of one, so a correction is a new document that references
 * the original and cancels it out.
 *
 * The Storno carries POSITIVE amounts. The reversal is expressed by the
 * document type code (BT-3 = 381), not by negating the figures -- BR-27
 * forbids a negative item net price outright, so a "negative invoice" is
 * rejected by the recipient even though its arithmetic is self-consistent.
 */
export const POST = withRoute(
  "/api/invoices/[id]/storno",
  "POST",
  async (req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Creating a document, not editing one.
    const forbidden = requirePermission(user, "billing", "create");
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

    const original = await prisma.customerInvoice.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!original) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Nothing to reverse: a draft is simply edited or discarded, and issuing a
    // Storno against it would put a credit note into the books for a document
    // the recipient never received.
    if (!original.issuedAt) {
      return NextResponse.json(
        {
          error: "NOT_ISSUED",
          message:
            "Diese Rechnung wurde noch nicht gestellt. Entwürfe können direkt bearbeitet oder gelöscht werden.",
        },
        { status: 409 },
      );
    }

    // One Storno per invoice. A second one would credit the amount twice.
    const existingStorno = await prisma.customerInvoice.findFirst({
      where: { correctsInvoiceId: id, workspaceId, deletedAt: null },
      select: { id: true, number: true },
    });
    if (existingStorno) {
      return NextResponse.json(
        {
          error: "ALREADY_CANCELLED",
          message: `Diese Rechnung wurde bereits mit der Storno-Rechnung ${existingStorno.number ?? "(Entwurf)"} storniert.`,
          stornoId: existingStorno.id,
        },
        { status: 409 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      const storno = await tx.customerInvoice.create({
        data: {
          workspaceId,
          clientId: original.clientId,
          number: null,
          correctsInvoiceId: original.id,
          title: `Storno zu Rechnung ${original.number}`,
          notes: parsed.data.reason ?? null,
          // Today, NOT the original's date. The reversal happens in the period
          // it is actually booked in; back-dating it into a closed period is
          // what the gapless-and-chronological requirement forbids.
          issueDate: today,
          dueDate: today,
          vatRate: original.vatRate,
          reverseCharge: original.reverseCharge,
          // Copied rather than referenced: the original is frozen, and the
          // Storno has to keep showing what it reversed even if the master
          // data behind those lines changes afterwards.
          items: {
            create: original.items.map((it) => ({
              description: `Storno: ${it.description}`,
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              position: it.position,
              vatRate: it.vatRate,
              unitCode: it.unitCode,
            })),
          },
        },
      });

      // The original is marked cancelled, but kept. Removing it is what GoBD
      // forbids; the pair -- invoice and Storno -- is the audit trail.
      await tx.customerInvoice.update({
        where: { id: original.id },
        data: { status: "STORNIERT", recurringActive: false },
      });

      const issued =
        parsed.data.issue === false
          ? null
          : await issueInvoiceInTx(tx, {
              invoiceId: storno.id,
              workspaceId,
            });

      return { storno, issued };
    });

    createAuditLog({
      action: "CREATE",
      entityType: "CustomerInvoice",
      entityId: result.storno.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: {
        storno: true,
        correctsInvoiceId: original.id,
        correctsNumber: original.number,
        reason: parsed.data.reason ?? null,
        number: result.issued?.ok ? result.issued.number : null,
      },
    });

    // A Storno that could not be issued still exists as a draft rather than
    // being rolled back: the original is cancelled either way, and losing the
    // credit note would leave the books showing an invoice with no reversal.
    const notIssued = result.issued && !result.issued.ok ? result.issued : null;

    return NextResponse.json(
      {
        id: result.storno.id,
        number: result.issued?.ok ? result.issued.number : null,
        issued: result.issued?.ok ?? false,
        ...(notIssued
          ? {
              warning: "STORNO_NOT_ISSUED",
              message:
                "Die Storno-Rechnung wurde als Entwurf angelegt, konnte aber noch nicht gestellt werden.",
              issues:
                notIssued.code === "PREFLIGHT_FAILED" ? notIssued.issues : [],
            }
          : {}),
      },
      { status: 201 },
    );
  },
);
