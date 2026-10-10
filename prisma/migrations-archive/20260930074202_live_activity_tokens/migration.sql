-- Live Activity / Dynamic Island push tokens.
--
-- This file previously contained nothing but dotenv banner output: a command's
-- stdout was redirected over it and the DDL was lost. The table exists in
-- deployed databases because they were built with `prisma db push`, which
-- never reads this directory -- so the gap stayed invisible until somebody
-- tried to rebuild from migrations.
--
-- Reconstructed from the live schema (information_schema) rather than from the
-- Prisma model alone, so the committed history matches what is actually
-- deployed: timestamps are `timestamp without time zone`, `labels` is jsonb,
-- and `timezone` carries its default.
--
-- Guarded with IF NOT EXISTS because every existing environment already has
-- the table; this must be a no-op there and a real create on an empty one.

CREATE TABLE IF NOT EXISTS "LiveActivityToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    -- Unique so re-registering the same activity updates the row rather than
    -- accumulating duplicates for one device.
    "token" TEXT NOT NULL,
    -- Localised captions captured at registration: ActivityKit replaces the
    -- content state wholesale, so the push must carry all of it.
    "labels" JSONB,
    "companyName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveActivityToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveActivityToken_token_key"
  ON "LiveActivityToken"("token");
CREATE INDEX IF NOT EXISTS "LiveActivityToken_employeeId_idx"
  ON "LiveActivityToken"("employeeId");
CREATE INDEX IF NOT EXISTS "LiveActivityToken_workspaceId_idx"
  ON "LiveActivityToken"("workspaceId");

DO $$ BEGIN
  ALTER TABLE "LiveActivityToken"
    ADD CONSTRAINT "LiveActivityToken_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LiveActivityToken"
    ADD CONSTRAINT "LiveActivityToken_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
