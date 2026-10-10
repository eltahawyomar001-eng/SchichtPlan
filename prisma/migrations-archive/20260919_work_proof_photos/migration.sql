-- Photographic proof of work: a photo whose time and place are stamped by the
-- server, not the device. See the WorkProofPhoto model for why.

CREATE TABLE "WorkProofPhoto" (
    "id"             TEXT NOT NULL,
    "storagePath"    TEXT NOT NULL,
    "fileName"       VARCHAR(500) NOT NULL,
    "fileType"       VARCHAR(150) NOT NULL,
    "fileSize"       BIGINT NOT NULL,
    "capturedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude"       DOUBLE PRECISION,
    "longitude"      DOUBLE PRECISION,
    "accuracyM"      DOUBLE PRECISION,
    "distanceM"      DOUBLE PRECISION,
    "geofenceStatus" "GeofenceStatus",
    "locationMocked" BOOLEAN NOT NULL DEFAULT false,
    "note"           VARCHAR(500),
    "timeEntryId"    TEXT,
    "shiftId"        TEXT,
    "locationId"     TEXT,
    "employeeId"     TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"      TIMESTAMP(3),
    CONSTRAINT "WorkProofPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkProofPhoto_workspaceId_capturedAt_idx" ON "WorkProofPhoto"("workspaceId", "capturedAt");
CREATE INDEX "WorkProofPhoto_timeEntryId_idx" ON "WorkProofPhoto"("timeEntryId");
CREATE INDEX "WorkProofPhoto_shiftId_idx"     ON "WorkProofPhoto"("shiftId");
CREATE INDEX "WorkProofPhoto_employeeId_idx"  ON "WorkProofPhoto"("employeeId");

ALTER TABLE "WorkProofPhoto"
  ADD CONSTRAINT "WorkProofPhoto_timeEntryId_fkey"
  FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkProofPhoto"
  ADD CONSTRAINT "WorkProofPhoto_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkProofPhoto"
  ADD CONSTRAINT "WorkProofPhoto_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RESTRICT, matching TimeEntry: this is retained evidence, so an employee
-- carrying proof photos cannot be hard-deleted out from under them.
ALTER TABLE "WorkProofPhoto"
  ADD CONSTRAINT "WorkProofPhoto_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkProofPhoto"
  ADD CONSTRAINT "WorkProofPhoto_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkProofPhoto" ENABLE ROW LEVEL SECURITY;
