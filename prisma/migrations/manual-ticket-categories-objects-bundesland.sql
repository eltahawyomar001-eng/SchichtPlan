-- Manual migration: ticket categories per workspace, ticket object-address,
-- location bundesland. Applied via direct psql against DIRECT_URL to bypass
-- Supabase's auth.users cross-schema introspection limitation in prisma db push.

BEGIN;

-- 1. Location.bundesland (nullable, 2-letter Bundesland code)
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "bundesland" TEXT;

-- 2. Ticket.objectAddress + Ticket.categoryDefId
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "objectAddress" VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "categoryDefId" TEXT;

CREATE INDEX IF NOT EXISTS "Ticket_categoryDefId_idx"
  ON "Ticket" ("categoryDefId");

-- 3. TicketCategoryDef table — per-workspace custom categories
CREATE TABLE IF NOT EXISTS "TicketCategoryDef" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name"        VARCHAR(80) NOT NULL,
  "slug"        VARCHAR(80) NOT NULL,
  "color"       VARCHAR(20),
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
  "legacyEnum"  "TicketCategory",
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketCategoryDef_workspaceId_slug_key" UNIQUE ("workspaceId", "slug"),
  CONSTRAINT "TicketCategoryDef_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE
);

-- FK from Ticket → TicketCategoryDef (only after both tables exist).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Ticket' AND constraint_name = 'Ticket_categoryDefId_fkey'
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT "Ticket_categoryDefId_fkey"
      FOREIGN KEY ("categoryDefId") REFERENCES "TicketCategoryDef" ("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TicketCategoryDef_workspaceId_isActive_sortOrder_idx"
  ON "TicketCategoryDef" ("workspaceId", "isActive", "sortOrder");

COMMIT;
