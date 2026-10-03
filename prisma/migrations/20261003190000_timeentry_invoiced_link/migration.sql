-- Link a time entry to the invoice line that billed it.
--
-- This is what stops the same hours being billed twice. Filtering by date
-- range cannot do it: ranges overlap, and a double-billed week is noticed by
-- the customer's client rather than by us.
--
-- ON DELETE SET NULL is deliberate. Discarding a DRAFT invoice releases its
-- hours back into the billable pool, which is what should happen. An ISSUED
-- invoice cannot be deleted at all, so its hours stay claimed permanently.
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "invoicedItemId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimeEntry_invoicedItemId_fkey'
  ) THEN
    ALTER TABLE "TimeEntry"
      ADD CONSTRAINT "TimeEntry_invoicedItemId_fkey"
      FOREIGN KEY ("invoicedItemId") REFERENCES "CustomerInvoiceItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Every billable-hours query filters on this, and it is the hot path of the
-- invoice preview.
CREATE INDEX IF NOT EXISTS "TimeEntry_invoicedItemId_idx"
  ON "TimeEntry"("invoicedItemId");
