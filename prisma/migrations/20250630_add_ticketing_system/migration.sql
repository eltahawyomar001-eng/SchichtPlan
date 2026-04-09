-- CreateEnum: TicketCategory
CREATE TYPE "TicketCategory" AS ENUM ('SCHICHTPLAN', 'ZEITERFASSUNG', 'LOHNABRECHNUNG', 'TECHNIK', 'HR', 'SONSTIGES');

-- CreateEnum: TicketPriority
CREATE TYPE "TicketPriority" AS ENUM ('NIEDRIG', 'MITTEL', 'HOCH', 'DRINGEND');

-- CreateEnum: TicketStatus
CREATE TYPE "TicketStatus" AS ENUM ('OFFEN', 'IN_BEARBEITUNG', 'GESCHLOSSEN');

-- CreateEnum: TicketType
CREATE TYPE "TicketType" AS ENUM ('INTERN', 'EXTERN');

-- CreateEnum: TicketEventType
CREATE TYPE "TicketEventType" AS ENUM ('ERSTELLT', 'ANGESEHEN', 'STATUS_GEAENDERT', 'ZUGEWIESEN', 'KOMMENTAR', 'GESCHLOSSEN');

-- CreateTable: Ticket
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ticketNumber" TEXT NOT NULL,
    "ticketType" "TicketType" NOT NULL DEFAULT 'INTERN',
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MITTEL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OFFEN',
    "location" VARCHAR(200),
    "externalSubmitterName" VARCHAR(200),
    "externalToken" TEXT,
    "createdById" TEXT,
    "assignedToId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "firstViewedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "firstViewedById" TEXT,
    "firstResponseAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "resolvedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "slaBreached" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TicketComment
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TicketEvent
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ticketId" TEXT NOT NULL,
    "eventType" "TicketEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" VARCHAR(200),
    "oldValue" VARCHAR(500),
    "newValue" VARCHAR(500),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Ticket
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE UNIQUE INDEX "Ticket_externalToken_key" ON "Ticket"("externalToken");
CREATE INDEX "Ticket_workspaceId_idx" ON "Ticket"("workspaceId");
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX "Ticket_externalToken_idx" ON "Ticket"("externalToken");
CREATE INDEX "Ticket_workspaceId_status_idx" ON "Ticket"("workspaceId", "status");
CREATE INDEX "Ticket_workspaceId_ticketNumber_idx" ON "Ticket"("workspaceId", "ticketNumber");

-- CreateIndex: TicketComment
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");
CREATE INDEX "TicketComment_authorId_idx" ON "TicketComment"("authorId");

-- CreateIndex: TicketEvent
CREATE INDEX "TicketEvent_ticketId_idx" ON "TicketEvent"("ticketId");
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- AddForeignKey: Ticket
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TicketComment
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TicketEvent
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketEvent" ENABLE ROW LEVEL SECURITY;
