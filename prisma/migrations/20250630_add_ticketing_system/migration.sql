-- CreateEnum: TicketCategory
CREATE TYPE "TicketCategory" AS ENUM ('SCHICHTPLAN', 'ZEITERFASSUNG', 'LOHNABRECHNUNG', 'TECHNIK', 'HR', 'SONSTIGES');

-- CreateEnum: TicketPriority
CREATE TYPE "TicketPriority" AS ENUM ('NIEDRIG', 'MITTEL', 'HOCH', 'DRINGEND');

-- CreateEnum: TicketStatus
CREATE TYPE "TicketStatus" AS ENUM ('OFFEN', 'IN_BEARBEITUNG', 'WARTEND', 'GELOEST', 'GESCHLOSSEN');

-- CreateTable: Ticket
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ticketNumber" TEXT NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MITTEL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OFFEN',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "closedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TicketComment
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Ticket
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE INDEX "Ticket_workspaceId_idx" ON "Ticket"("workspaceId");
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX "Ticket_workspaceId_status_idx" ON "Ticket"("workspaceId", "status");
CREATE INDEX "Ticket_workspaceId_ticketNumber_idx" ON "Ticket"("workspaceId", "ticketNumber");

-- CreateIndex: TicketComment
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");
CREATE INDEX "TicketComment_authorId_idx" ON "TicketComment"("authorId");

-- AddForeignKey: Ticket
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TicketComment
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketComment" ENABLE ROW LEVEL SECURITY;
