-- Default to XRechnung, not ZUGFeRD.
--
-- XRechnung is a complete, legally valid e-invoice on its own, and the only
-- format a German public body is obliged to accept. ZUGFeRD additionally needs
-- a PDF/A-3 container that is not implemented yet, so the previous default
-- would have stamped invoices with a format we do not actually produce.
ALTER TABLE "InvoiceIssuerProfile"
  ALTER COLUMN "defaultFormat" SET DEFAULT 'XRECHNUNG';

-- No existing rows to migrate: the table ships in this same release and no
-- workspace has configured a profile yet. Written anyway so that re-running
-- the chain on a database that did get rows under the old default still lands
-- in the right state.
UPDATE "InvoiceIssuerProfile" SET "defaultFormat" = 'XRECHNUNG'
 WHERE "defaultFormat" = 'ZUGFERD';
