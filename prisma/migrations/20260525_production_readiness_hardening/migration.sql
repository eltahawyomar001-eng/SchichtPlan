-- Production readiness hardening — applied 2026-05-25 via Supabase MCP
-- Covers: C-4/C-9 PIN atomicity, H-7 WebhookFailure DLQ, H-8 indexes,
--         H-11 FK constraint, H-12 optimistic concurrency, H-18 pinEmailFailed

-- Employee: flag for failed PIN email delivery (retry cron reads this)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "pinEmailFailed" BOOLEAN NOT NULL DEFAULT false;

-- VacationBalance: optimistic concurrency version counter
ALTER TABLE "VacationBalance" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

-- WebhookFailure: dead-letter queue for failed webhook deliveries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookFailureStatus') THEN
    CREATE TYPE "WebhookFailureStatus" AS ENUM ('PENDING', 'RETRYING', 'FAILED', 'DELIVERED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WebhookFailure" (
    "id"           TEXT NOT NULL,
    "payload"      TEXT NOT NULL,
    "event"        TEXT NOT NULL,
    "status"       "WebhookFailureStatus" NOT NULL DEFAULT 'PENDING',
    "attempts"     INTEGER NOT NULL DEFAULT 0,
    "lastAttempt"  TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpointId"   TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    CONSTRAINT "WebhookFailure_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WebhookFailure"
    ADD CONSTRAINT "WebhookFailure_endpointId_fkey"
    FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE;

ALTER TABLE "WebhookFailure"
    ADD CONSTRAINT "WebhookFailure_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- Composite indexes for high-traffic FK columns (H-8)
CREATE INDEX IF NOT EXISTS "Shift_workspaceId_employeeId_idx"
    ON "Shift"("workspaceId", "employeeId");

CREATE INDEX IF NOT EXISTS "TimeEntry_workspaceId_employeeId_idx"
    ON "TimeEntry"("workspaceId", "employeeId");

CREATE INDEX IF NOT EXISTS "AbsenceRequest_workspaceId_employeeId_idx"
    ON "AbsenceRequest"("workspaceId", "employeeId");

CREATE INDEX IF NOT EXISTS "AbsenceRequest_workspaceId_startDate_idx"
    ON "AbsenceRequest"("workspaceId", "startDate");

CREATE INDEX IF NOT EXISTS "ShiftSwapRequest_workspaceId_createdAt_idx"
    ON "ShiftSwapRequest"("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS "WebhookFailure_workspaceId_status_idx"
    ON "WebhookFailure"("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "WebhookFailure_createdAt_idx"
    ON "WebhookFailure"("createdAt");

-- ShiftSwapRequest.shiftId FK: CASCADE → RESTRICT (H-11)
-- Deleting a shift with open swap requests must be an explicit action
ALTER TABLE "ShiftSwapRequest"
    DROP CONSTRAINT IF EXISTS "ShiftSwapRequest_shiftId_fkey";

ALTER TABLE "ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT;
