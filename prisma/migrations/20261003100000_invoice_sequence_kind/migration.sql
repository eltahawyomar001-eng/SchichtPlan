-- Give each document series its own gapless counter.
--
-- One workspace runs two unrelated invoice series: the invoices Shiftfy issues
-- to it (Stripe billing) and the invoices it issues to its own clients. They
-- shared a single counter row, so every Shiftfy invoice put a gap in the
-- customer's series and vice versa -- exactly what GoBD forbids.
--
-- Existing rows were all written by the Stripe webhook, so they keep their
-- value under SHIFTFY_BILLING and the customer series starts fresh at 0.

CREATE TYPE "InvoiceSequenceKind" AS ENUM ('SHIFTFY_BILLING', 'CUSTOMER_INVOICE');

ALTER TABLE "InvoiceSequence"
  ADD COLUMN "kind" "InvoiceSequenceKind" NOT NULL DEFAULT 'SHIFTFY_BILLING';

ALTER TABLE "InvoiceSequence" DROP CONSTRAINT "InvoiceSequence_pkey";
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_pkey"
  PRIMARY KEY ("workspaceId", "kind");

-- Seed the customer series from the highest number ALREADY ISSUED, so the
-- counter can never hand out a number that is already on a customer's invoice.
-- Numbers look like RE-2026-0042; the trailing digits are what counts.
INSERT INTO "InvoiceSequence" ("workspaceId", "kind", "lastNumber", "updatedAt")
SELECT
  "workspaceId",
  'CUSTOMER_INVOICE',
  COALESCE(MAX(NULLIF(regexp_replace("number", '^.*-', ''), '')::int), 0),
  now()
FROM "CustomerInvoice"
WHERE "number" ~ '^RE-[0-9]{4}-[0-9]+$'
GROUP BY "workspaceId"
ON CONFLICT ("workspaceId", "kind") DO NOTHING;
