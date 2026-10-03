-- Receiving e-invoices.
--
-- Mandatory for every German business since 1 January 2025, which is earlier
-- than the obligation to send them.

DO $$ BEGIN
  CREATE TYPE "EInvoiceSyntax" AS ENUM ('CII', 'UBL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IncomingInvoiceStatus" AS ENUM ('NEU','GEPRUEFT','BEZAHLT','ABGELEHNT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "IncomingInvoice" (
  "id"              TEXT PRIMARY KEY,
  "workspaceId"     TEXT NOT NULL,
  -- The retained document, exactly as received. § 147 AO requires the original
  -- form, so this is never regenerated from the parsed columns below.
  "xml"             TEXT NOT NULL,
  "sha256"          TEXT NOT NULL,
  "fileName"        TEXT,
  "syntax"          "EInvoiceSyntax" NOT NULL,
  "profile"         TEXT,
  "number"          TEXT,
  "typeCode"        TEXT,
  "issueDate"       DATE,
  "dueDate"         DATE,
  "currency"        TEXT,
  "sellerName"      TEXT,
  "sellerVatId"     TEXT,
  "buyerName"       TEXT,
  "netCents"        INTEGER,
  "taxCents"        INTEGER,
  "grossCents"      INTEGER,
  "precedingNumber" TEXT,
  "status"          "IncomingInvoiceStatus" NOT NULL DEFAULT 'NEU',
  "notes"           TEXT,
  "importedBy"      TEXT,
  "reviewedAt"      TIMESTAMP(3),
  "paidAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "deletedAt"       TIMESTAMP(3),
  CONSTRAINT "IncomingInvoice_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- The same document must not be imported twice: a supplier resending an
-- invoice, or a forwarded mail processed twice, would otherwise be booked and
-- paid twice. The checksum is what identifies it, not the invoice number,
-- because two suppliers can and do use the same numbering.
CREATE UNIQUE INDEX IF NOT EXISTS "IncomingInvoice_workspaceId_sha256_key"
  ON "IncomingInvoice"("workspaceId", "sha256");
CREATE INDEX IF NOT EXISTS "IncomingInvoice_workspaceId_status_idx"
  ON "IncomingInvoice"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "IncomingInvoice_workspaceId_issueDate_idx"
  ON "IncomingInvoice"("workspaceId", "issueDate");
