import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { computeTotals } from "@/lib/billing";
import {
  buildDatevBuchungsstapel,
  datevBuffer,
  DEFAULT_ACCOUNTS,
  type DatevInvoice,
} from "@/lib/e-invoice/datev";

const querySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  consultantNumber: z.string().trim().min(1).max(10),
  clientNumber: z.string().trim().min(1).max(10),
  /** Defaults to the current calendar year. */
  fiscalYearStart: z.string().optional(),
  /** "csv" gives a plain readable export instead of the DATEV preamble. */
  format: z.enum(["datev", "csv"]).optional(),
});

function endOfDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

function deDate(d: Date): string {
  return d.toLocaleDateString("de-DE");
}

function euroPlain(cents: number): string {
  return `${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, "0")}`;
}

/**
 * GET /api/invoices/export/datev — issued invoices for the tax adviser.
 *
 * ISSUED only. A draft has no number and may still change, and a booking
 * batch containing one would put a figure into the ledger that does not
 * correspond to any document the customer sent.
 */
export const GET = withRoute(
  "/api/invoices/export/datev",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const url = new URL(req.url);
    const parsed = querySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_QUERY", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const q = parsed.data;
    const from = new Date(q.from);
    const to = endOfDay(q.to);

    const [invoices, issuer, workspace] = await Promise.all([
      prisma.customerInvoice.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          // Issued only -- see the note above.
          issuedAt: { not: null },
          issueDate: { gte: from, lte: to },
        },
        include: {
          items: { orderBy: { position: "asc" } },
          client: { select: { name: true } },
        },
        orderBy: { issueDate: "asc" },
      }),
      prisma.invoiceIssuerProfile.findUnique({
        where: { workspaceId },
        select: { kleinunternehmer: true, legalName: true },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
    ]);

    const rows: DatevInvoice[] = invoices.map((inv) => {
      const totals = computeTotals(inv.items, inv.vatRate);
      return {
        number: inv.number ?? "",
        issueDate: inv.issueDate,
        grossCents: totals.grossCents,
        vatRate: inv.vatRate,
        clientName: inv.client?.name ?? null,
        isCreditNote: Boolean(inv.correctsInvoiceId),
        kleinunternehmer: issuer?.kleinunternehmer ?? false,
        reverseCharge: inv.reverseCharge,
      };
    });

    createAuditLog({
      // ARCHIVE rather than a new action: this is the books being handed to
      // the tax adviser, and knowing WHICH period left the building is the
      // part worth keeping.
      action: "ARCHIVE",
      entityType: "CustomerInvoice",
      entityId: "export",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { datevExport: true, from: q.from, to: q.to, rows: rows.length },
    });

    // A plain CSV for anyone who just wants to read the figures. UTF-8 with a
    // BOM, because Excel otherwise reads a UTF-8 CSV as Latin-1 and mangles
    // every umlaut -- the opposite requirement to the DATEV file below.
    if (q.format === "csv") {
      const head = [
        "Rechnungsnummer",
        "Datum",
        "Kunde",
        "Netto",
        "USt",
        "Brutto",
        "Typ",
      ].join(";");
      const body = invoices.map((inv) => {
        const t = computeTotals(inv.items, inv.vatRate);
        return [
          inv.number ?? "",
          deDate(inv.issueDate),
          (inv.client?.name ?? "").replace(/;/g, ","),
          euroPlain(t.netCents),
          euroPlain(t.vatCents),
          euroPlain(t.grossCents),
          inv.correctsInvoiceId ? "Storno" : "Rechnung",
        ].join(";");
      });
      const csv = "﻿" + [head, ...body].join("\r\n") + "\r\n";
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Rechnungen_${q.from}_${q.to}.csv"`,
        },
      });
    }

    const fiscalYearStart = q.fiscalYearStart
      ? new Date(q.fiscalYearStart)
      : new Date(from.getFullYear(), 0, 1);

    const content = buildDatevBuchungsstapel({
      invoices: rows,
      consultant: {
        consultantNumber: q.consultantNumber,
        clientNumber: q.clientNumber,
        fiscalYearStart,
        name: issuer?.legalName ?? workspace?.name ?? "",
      },
      accounts: DEFAULT_ACCOUNTS,
      range: { from, to },
    });

    // new Uint8Array(...) rather than the Buffer itself: Node's Buffer is a
    // Uint8Array subclass but the web Response type does not accept it.
    const body = new Uint8Array(datevBuffer(content));

    return new Response(body, {
      headers: {
        // windows-1252 stated explicitly: DATEV reads the file as that
        // regardless, and the header keeps anything else in the chain from
        // guessing UTF-8.
        "Content-Type": "text/csv; charset=windows-1252",
        "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_${q.from}_${q.to}.csv"`,
        "Content-Length": String(body.byteLength),
        // So the UI can warn when an export would be empty.
        "X-Row-Count": String(rows.length),
      },
    });
  },
);
