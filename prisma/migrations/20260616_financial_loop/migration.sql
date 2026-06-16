-- Financial loop: customer-facing Quotes -> CustomerInvoices (+ line items, recurring).
-- Distinct from the Stripe subscription "Invoice" table.

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ENTWURF', 'GESENDET', 'ANGENOMMEN', 'ABGELEHNT', 'STORNIERT');
CREATE TYPE "CustomerInvoiceStatus" AS ENUM ('ENTWURF', 'GESENDET', 'BEZAHLT', 'UEBERFAELLIG', 'STORNIERT');
CREATE TYPE "RecurringInterval" AS ENUM ('KEINE', 'MONATLICH', 'QUARTALSWEISE', 'JAEHRLICH');

-- CreateTable Quote
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "number" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT,
    "notes" TEXT,
    "issueDate" DATE NOT NULL,
    "validUntil" DATE,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "acceptToken" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "convertedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable QuoteItem
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomerInvoice
CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT,
    "quoteId" TEXT,
    "number" TEXT NOT NULL,
    "status" "CustomerInvoiceStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT,
    "notes" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recurring" "RecurringInterval" NOT NULL DEFAULT 'KEINE',
    "recurringNextRun" DATE,
    "recurringActive" BOOLEAN NOT NULL DEFAULT false,
    "recurringParentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable CustomerInvoiceItem
CREATE TABLE "CustomerInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomerInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- Indexes & unique constraints
CREATE UNIQUE INDEX "Quote_acceptToken_key" ON "Quote"("acceptToken");
CREATE UNIQUE INDEX "Quote_workspaceId_number_key" ON "Quote"("workspaceId", "number");
CREATE INDEX "Quote_workspaceId_status_idx" ON "Quote"("workspaceId", "status");
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

CREATE UNIQUE INDEX "CustomerInvoice_workspaceId_number_key" ON "CustomerInvoice"("workspaceId", "number");
CREATE INDEX "CustomerInvoice_workspaceId_status_idx" ON "CustomerInvoice"("workspaceId", "status");
CREATE INDEX "CustomerInvoice_workspaceId_dueDate_idx" ON "CustomerInvoice"("workspaceId", "dueDate");
CREATE INDEX "CustomerInvoice_recurringActive_recurringNextRun_idx" ON "CustomerInvoice"("recurringActive", "recurringNextRun");
CREATE INDEX "CustomerInvoice_clientId_idx" ON "CustomerInvoice"("clientId");
CREATE INDEX "CustomerInvoiceItem_invoiceId_idx" ON "CustomerInvoiceItem"("invoiceId");

-- Foreign keys
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceItem" ADD CONSTRAINT "CustomerInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the workspace-wide RLS posture (app-level scoping is the real guard;
-- Prisma connects via a privileged role, so enabling RLS without policies is
-- consistent with the existing tables and silences the Supabase advisor).
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerInvoiceItem" ENABLE ROW LEVEL SECURITY;
