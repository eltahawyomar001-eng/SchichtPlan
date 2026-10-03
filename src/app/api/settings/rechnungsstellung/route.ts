import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { preflightInvoice } from "@/lib/e-invoice/preflight";

/**
 * The workspace's identity as an INVOICE ISSUER.
 *
 * Distinct from the workspace record and from the global IssuerProfile, which
 * is Shiftfy's own identity for the invoices Shiftfy sends. This is what
 * appears as the supplier on invoices the customer sends to their own clients,
 * so it is what § 14 Abs. 4 UStG governs.
 */
const schema = z.object({
  legalName: z.string().trim().min(1).max(200),
  tradingName: z.string().trim().max(200).nullish(),
  street: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).nullish(),
  postalCode: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(100),
  countryCode: z.string().trim().length(2).toUpperCase().default("DE"),
  vatId: z.string().trim().max(30).nullish(),
  taxNumber: z.string().trim().max(30).nullish(),
  legalRegistrationId: z.string().trim().max(50).nullish(),
  kleinunternehmer: z.boolean().default(false),
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(50).nullish(),
  contactName: z.string().trim().max(200).nullish(),
  contactPhone: z.string().trim().max(50).nullish(),
  contactEmail: z.string().trim().email().max(200).nullish(),
  bankName: z.string().trim().max(200).nullish(),
  // Loose on purpose: IBANs differ by country and rejecting a valid foreign
  // one would be worse than accepting a typo the bank will bounce anyway.
  iban: z.string().trim().max(40).nullish(),
  bic: z.string().trim().max(20).nullish(),
  numberPrefix: z.string().trim().min(1).max(10).default("RE"),
  paymentTermDays: z.number().int().min(0).max(365).default(14),
  defaultFormat: z.enum(["XRECHNUNG", "ZUGFERD"]).default("XRECHNUNG"),
});

/** Empty strings from a form mean "not set", not "set to nothing". */
const nullIfBlank = (v: string | null | undefined) =>
  v === undefined || v === null || v.trim() === "" ? null : v.trim();

/** GET /api/settings/rechnungsstellung */
export const GET = withRoute(
  "/api/settings/rechnungsstellung",
  "GET",
  async () => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "billing", "read");
    if (forbidden) return forbidden;

    const profile = await prisma.invoiceIssuerProfile.findUnique({
      where: { workspaceId },
    });

    // The same preflight the issue gate runs, against the profile alone. It
    // lets the form show what is still missing for an e-invoice before the
    // customer has an invoice to be blocked on -- which is the difference
    // between configuring this once and discovering it at the worst moment.
    const issues = profile
      ? preflightInvoice({
          issuer: profile,
          // Not under test here; a placeholder keeps the client and document
          // checks from drowning out the issuer ones.
          client: {
            name: "x",
            street: "x",
            postalCode: "x",
            city: "x",
            invoiceEmail: "x@example.com",
          },
          invoice: {
            issueDate: new Date(),
            lines: [
              {
                description: "x",
                quantity: 1,
                unitPriceCents: 1,
                vatRate: 19,
                category: "S",
              },
            ],
          },
        }).filter((i) => i.scope === "issuer")
      : [];

    return NextResponse.json({ profile, issues });
  },
);

/** PUT /api/settings/rechnungsstellung — create or replace the profile. */
export const PUT = withRoute(
  "/api/settings/rechnungsstellung",
  "PUT",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    // Who the invoices come from is not an ordinary edit.
    const forbidden = requirePermission(user, "billing", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = schema.safeParse(_json.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const b = parsed.data;

    // § 14 Abs. 4 Nr. 2 accepts either identifier, but not neither. Refused
    // here as well as at issue time, so the customer is told while they are
    // looking at the form rather than weeks later.
    if (!nullIfBlank(b.vatId) && !nullIfBlank(b.taxNumber)) {
      return NextResponse.json(
        {
          error: "TAX_ID_REQUIRED",
          message:
            "Bitte geben Sie eine USt-IdNr. oder eine Steuernummer an. Eine von beiden muss auf jeder Rechnung stehen (§ 14 Abs. 4 Nr. 2 UStG).",
        },
        { status: 400 },
      );
    }

    const data = {
      legalName: b.legalName,
      tradingName: nullIfBlank(b.tradingName),
      street: b.street,
      addressLine2: nullIfBlank(b.addressLine2),
      postalCode: b.postalCode,
      city: b.city,
      countryCode: b.countryCode,
      vatId: nullIfBlank(b.vatId),
      taxNumber: nullIfBlank(b.taxNumber),
      legalRegistrationId: nullIfBlank(b.legalRegistrationId),
      kleinunternehmer: b.kleinunternehmer,
      email: nullIfBlank(b.email),
      phone: nullIfBlank(b.phone),
      contactName: nullIfBlank(b.contactName),
      contactPhone: nullIfBlank(b.contactPhone),
      contactEmail: nullIfBlank(b.contactEmail),
      bankName: nullIfBlank(b.bankName),
      iban: nullIfBlank(b.iban)?.replace(/\s+/g, "") ?? null,
      bic: nullIfBlank(b.bic),
      numberPrefix: b.numberPrefix,
      paymentTermDays: b.paymentTermDays,
      defaultFormat: b.defaultFormat,
    };

    const profile = await prisma.invoiceIssuerProfile.upsert({
      where: { workspaceId },
      update: data,
      create: { workspaceId, ...data },
    });

    createAuditLog({
      action: "UPDATE",
      entityType: "InvoiceIssuerProfile",
      entityId: profile.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      // The identity that appears on legally binding documents, so the change
      // itself belongs in the trail.
      changes: data,
    });

    return NextResponse.json({ profile });
  },
);
