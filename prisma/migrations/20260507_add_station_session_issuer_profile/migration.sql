-- StationSession: tracks station access tokens for revocation support
CREATE TABLE "StationSession" (
  "id"             TEXT NOT NULL,
  "workspaceId"    TEXT NOT NULL,
  "sessionKeyHash" TEXT NOT NULL,
  "deviceName"     TEXT NOT NULL DEFAULT 'Unbekanntes Gerät',
  "issuedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"      TIMESTAMP(3),
  CONSTRAINT "StationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StationSession_sessionKeyHash_key" ON "StationSession"("sessionKeyHash");
CREATE INDEX "StationSession_workspaceId_idx" ON "StationSession"("workspaceId");
CREATE INDEX "StationSession_sessionKeyHash_idx" ON "StationSession"("sessionKeyHash");

ALTER TABLE "StationSession"
  ADD CONSTRAINT "StationSession_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IssuerProfile: versioned company identity for GoBD-compliant invoicing
CREATE TABLE "IssuerProfile" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "vatId"     TEXT,
  "address"   TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IssuerProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IssuerProfile_validFrom_idx" ON "IssuerProfile"("validFrom");
