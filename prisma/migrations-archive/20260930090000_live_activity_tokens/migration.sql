-- A device's push token for one running Live Activity.
--
-- A Live Activity can normally only be changed by the app that started it,
-- while that app is running, so ending a break in the web app left the card on
-- the employee's lock screen asserting "on break". ActivityKit push is the only
-- way to correct it from anywhere else. See the LiveActivityToken model.

CREATE TABLE "LiveActivityToken" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "employeeId"  TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "labels"      JSONB,
    "companyName" TEXT,
    "timezone"    TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveActivityToken_pkey" PRIMARY KEY ("id")
);

-- One row per activity: re-registering the same activity updates in place
-- rather than accumulating duplicates that would each get their own push.
CREATE UNIQUE INDEX "LiveActivityToken_token_key" ON "LiveActivityToken"("token");

CREATE INDEX "LiveActivityToken_employeeId_idx" ON "LiveActivityToken"("employeeId");
CREATE INDEX "LiveActivityToken_workspaceId_idx" ON "LiveActivityToken"("workspaceId");

-- Cascade on both sides: these rows are meaningless without the employee they
-- belong to, and leaving them behind would push to a device about a person who
-- no longer exists in the workspace.
ALTER TABLE "LiveActivityToken"
  ADD CONSTRAINT "LiveActivityToken_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveActivityToken"
  ADD CONSTRAINT "LiveActivityToken_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
