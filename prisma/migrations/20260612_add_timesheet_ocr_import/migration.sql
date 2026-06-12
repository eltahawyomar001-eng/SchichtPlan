-- AI-Powered Timesheet (Stundenzettel) Extraction — staging tables.
-- Imported rows land here as PENDING_REVIEW with a full audit trail and are
-- only promoted into "Shift" once a manager approves them.

-- CreateEnum
CREATE TYPE "TimesheetImportStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimesheetImportSource" AS ENUM ('ANTHROPIC', 'OPENAI', 'MOCK');

-- CreateTable
CREATE TABLE "TimesheetImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "TimesheetImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "source" "TimesheetImportSource" NOT NULL,
    "documentRef" TEXT NOT NULL,
    "missingEmployees" TEXT NOT NULL DEFAULT '[]',
    "importedByUserId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetImportEntry" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "confidenceScores" TEXT NOT NULL DEFAULT '{}',
    "status" "TimesheetImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "materializedShiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetImportEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetImport_workspaceId_status_idx" ON "TimesheetImport"("workspaceId", "status");
CREATE INDEX "TimesheetImport_workspaceId_importedAt_idx" ON "TimesheetImport"("workspaceId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetImportEntry_materializedShiftId_key" ON "TimesheetImportEntry"("materializedShiftId");
CREATE INDEX "TimesheetImportEntry_workspaceId_status_idx" ON "TimesheetImportEntry"("workspaceId", "status");
CREATE INDEX "TimesheetImportEntry_importId_idx" ON "TimesheetImportEntry"("importId");
CREATE INDEX "TimesheetImportEntry_employeeId_idx" ON "TimesheetImportEntry"("employeeId");

-- AddForeignKey
ALTER TABLE "TimesheetImport" ADD CONSTRAINT "TimesheetImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetImport" ADD CONSTRAINT "TimesheetImport_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetImport" ADD CONSTRAINT "TimesheetImport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TimesheetImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimesheetImportEntry" ADD CONSTRAINT "TimesheetImportEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS to match the workspace's enable-RLS-all-public-tables baseline.
-- (RLS is inert behind the service_role pooler in prod, but kept consistent.)
ALTER TABLE "TimesheetImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimesheetImportEntry" ENABLE ROW LEVEL SECURITY;
