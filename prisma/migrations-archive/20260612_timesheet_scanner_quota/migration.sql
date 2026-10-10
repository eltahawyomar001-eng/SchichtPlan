-- AI Timesheet Scanner: monthly scan quota + premium add-on entitlement.

-- Scan quota counter on WorkspaceUsage (mirrors the PDF/ticket/email counters).
ALTER TABLE "WorkspaceUsage" ADD COLUMN "scansThisMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WorkspaceUsage" ADD COLUMN "scansMonthlyLimit" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "WorkspaceUsage" ADD COLUMN "scansResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Premium add-on entitlement on Subscription (mirrors the schichtplanung add-on).
ALTER TABLE "Subscription" ADD COLUMN "timesheetScannerAddonActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "timesheetScannerStripeSubscriptionItemId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "timesheetScannerAddonBilling" TEXT;
