-- ArbZG §4 on recorded time, plus the employee's lateness justification.
--
-- Additive only. TimeEntry keeps its breakStart/breakEnd/breakMinutes columns
-- and they stay authoritative for every entry that has no TimeEntryBreak rows,
-- so nothing already recorded changes meaning when this lands.

CREATE TYPE "BreakSource" AS ENUM ('MITARBEITER', 'KORREKTUR');

-- Why a table rather than more columns: a day can have two breaks, and §4
-- needs to know WHEN the rest fell, not only how long it was. A day can reach
-- 45 minutes of break and still breach the law by taking all of it at the end,
-- after more than six hours at a stretch.
CREATE TABLE "TimeEntryBreak" (
    "id" TEXT NOT NULL,
    -- Offsets from clock-in, so an overnight shift needs no date arithmetic.
    "startOffsetMinutes" INTEGER NOT NULL,
    "endOffsetMinutes" INTEGER NOT NULL,
    -- An unconfirmed row is a claim, not rest. Only confirmed breaks count
    -- toward the statutory minimum, or a missing break could be papered over
    -- by entering one after the fact.
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "source" "BreakSource" NOT NULL DEFAULT 'MITARBEITER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "TimeEntryBreak_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeEntryBreak_timeEntryId_idx" ON "TimeEntryBreak"("timeEntryId");
CREATE INDEX "TimeEntryBreak_workspaceId_idx" ON "TimeEntryBreak"("workspaceId");

ALTER TABLE "TimeEntryBreak"
  ADD CONSTRAINT "TimeEntryBreak_timeEntryId_fkey"
  FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeEntryBreak"
  ADD CONSTRAINT "TimeEntryBreak_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A break must occupy real time. A zero-length or inverted row would be
-- silently dropped by the assessment anyway; rejecting it here keeps the bad
-- value from being stored at all.
ALTER TABLE "TimeEntryBreak"
  ADD CONSTRAINT "TimeEntryBreak_positive_duration"
  CHECK ("endOffsetMinutes" > "startOffsetMinutes" AND "startOffsetMinutes" >= 0);

-- The justification for arriving late. Whether an entry IS late stays derived
-- from the roster and the stamped clock-in; only the explanation is stored,
-- because that is a statement a person made and must outlive any later edit to
-- the plan.
ALTER TABLE "TimeEntry" ADD COLUMN "latenessReason" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN "latenessReasonAt" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN "latenessReasonBy" TEXT;
