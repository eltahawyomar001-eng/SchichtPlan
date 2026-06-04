/**
 * One-shot backfill: hash any invitation tokens still stored in plaintext.
 *
 * Run with: npx tsx scripts/hash-invitation-tokens.ts
 *
 * Idempotent and safe to run repeatedly — rows whose token already starts with
 * the `sha256:` prefix are skipped, so a second run is a no-op. Existing
 * outstanding invitation links keep working: the app hashes the incoming raw
 * token on lookup, which now matches the stored hash.
 *
 * Self-contained: uses Prisma + the pg driver adapter directly (mirrors
 * scripts/backfill-seats.ts), no @/ alias dependencies.
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createHash } from "crypto";

// Load .env.local first, then .env, mirroring Next.js precedence.
config({ path: ".env.local" });
config({ path: ".env" });

const HASH_PREFIX = "sha256:";

function hashToken(raw: string): string {
  return HASH_PREFIX + createHash("sha256").update(raw, "utf8").digest("hex");
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const all = await prisma.invitation.findMany({
      select: { id: true, token: true },
    });

    const legacy = all.filter((i) => !i.token.startsWith(HASH_PREFIX));
    console.log(
      `Found ${all.length} invitations; ${legacy.length} still in plaintext.`,
    );

    let migrated = 0;
    for (const inv of legacy) {
      await prisma.invitation.update({
        where: { id: inv.id },
        data: { token: hashToken(inv.token) },
      });
      migrated++;
    }

    console.log(`Done. Hashed ${migrated} invitation token(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("hash-invitation-tokens failed:", err);
  process.exit(1);
});
