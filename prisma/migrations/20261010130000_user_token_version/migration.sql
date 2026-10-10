-- Session revocation for mobile tokens. Bumping this invalidates every token
-- issued before the bump; see the schema comment for why stateless JWTs needed
-- it. Defaults to 0 so pre-existing tokens keep working until revoked.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
