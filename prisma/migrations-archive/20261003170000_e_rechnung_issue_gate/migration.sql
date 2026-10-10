-- E-Rechnung: the issue gate.
--
-- Two changes, both about WHEN an invoice number comes into existence.

-- BR-DE-2 needs a named contact person on every German e-invoice, and BR-CO-26
-- needs the seller identifiable by something that is not a Steuernummer.
ALTER TABLE "InvoiceIssuerProfile"
  ADD COLUMN IF NOT EXISTS "legalRegistrationId" TEXT,
  ADD COLUMN IF NOT EXISTS "contactName"  TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

-- A draft must not consume a number. GoBD requires the ISSUED invoices to be
-- gapless, so a number handed out at draft creation leaves an unexplainable
-- hole every time a draft is discarded. Dropping NOT NULL is non-destructive:
-- existing rows keep the numbers they already have, and the unique constraint
-- on (workspaceId, number) continues to hold because Postgres does not treat
-- two NULLs as equal -- several drafts can coexist.
ALTER TABLE "CustomerInvoice" ALTER COLUMN "number" DROP NOT NULL;
