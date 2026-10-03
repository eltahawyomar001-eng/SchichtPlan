-- Foundation for EN 16931 e-invoicing.
--
-- Three gaps made the existing invoices impossible to express as XRechnung or
-- ZUGFeRD: one VAT rate per invoice, free-text addresses, and no record of
-- what was actually issued.

CREATE TYPE "EInvoiceFormat" AS ENUM ('XRECHNUNG', 'ZUGFERD');

-- ── The workspace as an invoice ISSUER to its own clients ──
-- Distinct from IssuerProfile (Shiftfy billing the workspace) and from
-- WorkspaceCustomer (the workspace as Shiftfy's customer).
CREATE TABLE "InvoiceIssuerProfile" (
    "id"               TEXT NOT NULL,
    "workspaceId"      TEXT NOT NULL,
    "legalName"        TEXT NOT NULL,
    "tradingName"      TEXT,
    "street"           TEXT NOT NULL,
    "addressLine2"     TEXT,
    "postalCode"       TEXT NOT NULL,
    "city"             TEXT NOT NULL,
    "countryCode"      TEXT NOT NULL DEFAULT 'DE',
    "vatId"            TEXT,
    "taxNumber"        TEXT,
    "kleinunternehmer" BOOLEAN NOT NULL DEFAULT false,
    "email"            TEXT,
    "phone"            TEXT,
    "bankName"         TEXT,
    "iban"             TEXT,
    "bic"              TEXT,
    "numberPrefix"     TEXT NOT NULL DEFAULT 'RE',
    "paymentTermDays"  INTEGER NOT NULL DEFAULT 14,
    "defaultFormat"    "EInvoiceFormat" NOT NULL DEFAULT 'ZUGFERD',
    "logoUrl"          TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvoiceIssuerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceIssuerProfile_workspaceId_key" ON "InvoiceIssuerProfile"("workspaceId");
ALTER TABLE "InvoiceIssuerProfile"
  ADD CONSTRAINT "InvoiceIssuerProfile_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Per-line VAT (BG-23) and unit of measure (BT-130) ──
ALTER TABLE "CustomerInvoiceItem" ADD COLUMN "vatRate"  DOUBLE PRECISION;
ALTER TABLE "CustomerInvoiceItem" ADD COLUMN "unitCode" TEXT NOT NULL DEFAULT 'C62';

-- Backfill from the invoice-level rate so existing lines keep their meaning
-- instead of silently becoming 0 %.
UPDATE "CustomerInvoiceItem" i
   SET "vatRate" = c."vatRate"
  FROM "CustomerInvoice" c
 WHERE i."invoiceId" = c."id" AND i."vatRate" IS NULL;

-- ── Structured recipient, for EN 16931 and B2G ──
ALTER TABLE "Client" ADD COLUMN "street"          TEXT;
ALTER TABLE "Client" ADD COLUMN "postalCode"      TEXT;
ALTER TABLE "Client" ADD COLUMN "city"            TEXT;
ALTER TABLE "Client" ADD COLUMN "countryCode"     TEXT NOT NULL DEFAULT 'DE';
ALTER TABLE "Client" ADD COLUMN "vatId"           TEXT;
ALTER TABLE "Client" ADD COLUMN "leitwegId"       TEXT;
ALTER TABLE "Client" ADD COLUMN "invoiceEmail"    TEXT;
ALTER TABLE "Client" ADD COLUMN "preferredFormat" "EInvoiceFormat";

-- ── What was actually issued (GoBD) ──
ALTER TABLE "CustomerInvoice" ADD COLUMN "issuedAt"          TIMESTAMP(3);
ALTER TABLE "CustomerInvoice" ADD COLUMN "einvoiceXml"       TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN "einvoiceFormat"    "EInvoiceFormat";
ALTER TABLE "CustomerInvoice" ADD COLUMN "einvoiceSha256"    TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN "correctsInvoiceId" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN "reverseCharge"     BOOLEAN NOT NULL DEFAULT false;

-- RESTRICT, not CASCADE: deleting an invoice that a Storno points at would
-- leave the correction referring to nothing.
ALTER TABLE "CustomerInvoice"
  ADD CONSTRAINT "CustomerInvoice_correctsInvoiceId_fkey"
  FOREIGN KEY ("correctsInvoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CustomerInvoice_correctsInvoiceId_idx" ON "CustomerInvoice"("correctsInvoiceId");
