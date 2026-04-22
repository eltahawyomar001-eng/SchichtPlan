-- Add ANGEHANGT to TicketEventType enum
ALTER TYPE "TicketEventType" ADD VALUE IF NOT EXISTS 'ANGEHANGT';

-- CreateTable: TicketAttachment
CREATE TABLE IF NOT EXISTS "TicketAttachment" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "ticketId"      TEXT NOT NULL,
  "commentId"     TEXT,
  "fileName"      VARCHAR(500) NOT NULL,
  "fileUrl"       TEXT NOT NULL,
  "fileType"      VARCHAR(150) NOT NULL,
  "fileSize"      BIGINT NOT NULL,
  "uploadedById"  TEXT,
  "uploaderName"  VARCHAR(200),
  "workspaceId"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketAttachment_ticketId_fkey"      FOREIGN KEY ("ticketId")     REFERENCES "Ticket"("id")        ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "TicketAttachment_commentId_fkey"     FOREIGN KEY ("commentId")    REFERENCES "TicketComment"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "TicketAttachment_uploadedById_fkey"  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")          ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TicketAttachment_workspaceId_fkey"   FOREIGN KEY ("workspaceId")  REFERENCES "Workspace"("id")     ON DELETE CASCADE  ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TicketAttachment_ticketId_idx"     ON "TicketAttachment"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketAttachment_commentId_idx"    ON "TicketAttachment"("commentId");
CREATE INDEX IF NOT EXISTS "TicketAttachment_workspaceId_idx"  ON "TicketAttachment"("workspaceId");
CREATE INDEX IF NOT EXISTS "TicketAttachment_uploadedById_idx" ON "TicketAttachment"("uploadedById");

ALTER TABLE "TicketAttachment" ENABLE ROW LEVEL SECURITY;
