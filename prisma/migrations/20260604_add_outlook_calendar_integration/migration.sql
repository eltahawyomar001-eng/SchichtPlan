-- Microsoft Outlook (Microsoft Graph) calendar integration.
-- Applied 2026-06-04 via Supabase MCP; mirrored here for `prisma migrate deploy`.
--
-- OutlookConnection: per-user calendar connection. accessToken/refreshToken are
-- AES-256-GCM encrypted at rest (see src/lib/encryption.ts), so a DB dump does
-- not yield usable Microsoft credentials.
CREATE TABLE IF NOT EXISTS "OutlookConnection" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "accessToken"    TEXT NOT NULL,
  "refreshToken"   TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "microsoftEmail" TEXT NOT NULL,
  "scope"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutlookConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OutlookConnection_userId_key" ON "OutlookConnection" ("userId");

ALTER TABLE "OutlookConnection"
  ADD CONSTRAINT "OutlookConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Short-lived CSRF/PKCE state for the OAuth handshake (one-time use).
CREATE TABLE IF NOT EXISTS "OutlookOAuthState" (
  "state"       TEXT NOT NULL,
  "verifier"    TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutlookOAuthState_pkey" PRIMARY KEY ("state")
);
