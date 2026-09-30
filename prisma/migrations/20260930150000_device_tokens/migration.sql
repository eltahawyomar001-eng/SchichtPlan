-- A device registered to receive push notifications.
--
-- Separate from LiveActivityToken: that one belongs to a single running Live
-- Activity and dies with it, while this belongs to the app install and lives
-- until the user signs out or APNs reports the token gone.

CREATE TABLE "DeviceToken" (
    "id"          TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "platform"    TEXT NOT NULL DEFAULT 'ios',
    "locale"      TEXT NOT NULL DEFAULT 'de',
    "timezone"    TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "userId"      TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "lastUsedAt"  TIMESTAMP(3),
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- One row per device: re-registering the same install updates in place rather
-- than accumulating duplicates that would each deliver the same alert.
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");
CREATE INDEX "DeviceToken_workspaceId_idx" ON "DeviceToken"("workspaceId");

ALTER TABLE "DeviceToken"
  ADD CONSTRAINT "DeviceToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeviceToken"
  ADD CONSTRAINT "DeviceToken_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
