import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { scopeExtension } from "@/lib/workspace-scope";

/**
 * Connection-pooling strategy
 * ───────────────────────────
 * Two URLs are intentionally used and they must NOT be swapped:
 *
 *   DATABASE_URL  → Supavisor pooler (transaction mode), port 6543.
 *                   Used at runtime by every API route / server component.
 *                   Supports the high request volume Vercel serverless creates
 *                   without exhausting Postgres' max_connections.
 *
 *   DIRECT_URL    → Direct Postgres connection, port 5432.
 *                   Used ONLY by `prisma migrate` / `prisma db push`.
 *                   Migrations need a real session (CREATE TYPE, advisory locks)
 *                   that the transaction-mode pooler can't provide.
 *
 * Locally a single in-process `pg.Pool` is kept alive across hot-reloads via
 * `globalForPrisma`. In production, each serverless instance gets its own pool
 * but Supavisor multiplexes them down to a small set of real Postgres backends.
 *
 *   DATABASE_POOL_MAX           — local pool size (default 15)
 *   DATABASE_STATEMENT_TIMEOUT_MS — hard cap per query (default 15_000 ms)
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const poolMax = parseInt(process.env.DATABASE_POOL_MAX || "15", 10);
    const statementTimeoutMs = parseInt(
      process.env.DATABASE_STATEMENT_TIMEOUT_MS || "15000",
      10,
    );

    // Detect Supavisor / pgBouncer transaction-mode pooler so we can tune the
    // pg.Pool appropriately. Port 6543 is Supabase's pooled endpoint.
    const usingPooler =
      /:6543\b/.test(connectionString) ||
      /pgbouncer=true/i.test(connectionString) ||
      /pooler\.supabase\.(co|com)/i.test(connectionString);

    // When behind a transaction-mode pooler (Supavisor / pgBouncer) each
    // serverless function needs only a handful of simultaneous connections —
    // the pooler manages the real Postgres backend pool. A high max here just
    // wastes pooler slots. Default: 3 behind a pooler, 15 for direct.
    // Override with DATABASE_POOL_MAX env var when needed.
    const effectiveMax = isNaN(poolMax) ? (usingPooler ? 3 : 15) : poolMax;

    const pool = new Pool({
      connectionString,
      max: effectiveMax,
      statement_timeout: isNaN(statementTimeoutMs) ? 15000 : statementTimeoutMs,
      query_timeout: isNaN(statementTimeoutMs) ? 15000 : statementTimeoutMs,
      // Behind a transaction-mode pooler, server-side prepared statements break
      // because each transaction may run on a different backend. Disabling
      // keepAlive also helps short-lived serverless invocations release sockets
      // promptly so the pooler can hand them to the next request.
      keepAlive: !usingPooler,
      idleTimeoutMillis: usingPooler ? 5_000 : 30_000,
    });

    const adapter = new PrismaPg(pool);
    // Apply the workspace-scope backstop extension. The extended client
    // keeps the same surface (model delegates, $transaction, $executeRaw),
    // so the cast back to PrismaClient is safe for all existing call sites.
    globalForPrisma.prisma = new PrismaClient({ adapter }).$extends(
      scopeExtension,
    ) as unknown as PrismaClient;
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy Prisma-Client – wird erst beim ersten Zugriff initialisiert,
 * damit der Next.js-Build ohne DATABASE_URL durchlaufen kann.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getClient(), prop);
  },
});

/**
 * Race a Prisma promise against an explicit timeout. The pool already enforces
 * a 15s default statement_timeout, but call-site timeouts let a route fail
 * faster (e.g. 3s for a UI fetch) and surface a typed error rather than a
 * generic Postgres "canceling statement due to statement timeout".
 *
 *   const data = await withQueryTimeout(
 *     prisma.timeEntry.findMany({ where: ... }),
 *     3_000,
 *   );
 */
export async function withQueryTimeout<T>(
  query: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new QueryTimeoutError(timeoutMs)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([query, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class QueryTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Query exceeded ${timeoutMs}ms timeout`);
    this.name = "QueryTimeoutError";
  }
}

/**
 * Runs `fn` inside a Postgres transaction with the workspace context set.
 *
 *   set_config('app.current_workspace_id', workspaceId, true)
 *     The `true` flag makes the setting transaction-local — it is cleared
 *     automatically on COMMIT/ROLLBACK, which is safe for transaction-mode
 *     poolers (Supavisor / pgBouncer) where connections are shared.
 *
 * This sets a transaction-local GUC for any RLS policy that reads
 * `app.current_workspace_id`. NOTE: in production the app connects through
 * the Supavisor pooler as a BYPASSRLS role, so RLS is not actually enforced
 * on these queries — this wrapper is therefore NOT the tenant-isolation
 * mechanism. The real guards are, in order of strength:
 *   1. Explicit `where: { workspaceId }` on every query (primary).
 *   2. The runtime Prisma scope backstop in `@/lib/workspace-scope`, which
 *      auto-injects workspaceId for requests bound via `requireAuth`.
 *   3. The CI lint `npm run lint:scope`.
 * Keep using explicit workspace filters regardless of this wrapper.
 *
 * Cron jobs, webhooks, and Stripe handlers should NOT use this wrapper —
 * they legitimately need cross-workspace access.
 */
export async function withWorkspaceContext<T>(
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_workspace_id', ${workspaceId}, true)`;
    return fn(tx);
  });
}
