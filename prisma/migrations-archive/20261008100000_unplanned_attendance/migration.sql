-- A manager's decision on attendance that deviated from the roster.
--
-- Whether an entry deviates is DERIVED from the shift plan rather than stored:
-- the plan can change after the fact, and a stored verdict would quietly go
-- stale. What is stored is the decision itself, which is a fact about a person
-- and a moment and must outlive any later edit to the plan.

DO $$ BEGIN
  CREATE TYPE "UnplannedDecision" AS ENUM ('OFFEN', 'GENEHMIGT', 'ABGELEHNT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "TimeEntry"
  ADD COLUMN IF NOT EXISTS "unplannedDecision" "UnplannedDecision" NOT NULL DEFAULT 'OFFEN',
  ADD COLUMN IF NOT EXISTS "unplannedReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "unplannedDecidedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "unplannedDecidedAt" TIMESTAMP(3);

-- The admin view lists what is still undecided, per workspace.
CREATE INDEX IF NOT EXISTS "TimeEntry_workspaceId_unplannedDecision_idx"
  ON "TimeEntry"("workspaceId", "unplannedDecision");
