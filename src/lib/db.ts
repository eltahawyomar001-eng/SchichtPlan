import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const poolMax = parseInt(process.env.DATABASE_POOL_MAX || "15", 10);
    // Hard caps so a single slow query cannot hold a connection forever and
    // exhaust the pool. Override per-call via withQueryTimeout() if a specific
    // long-running operation needs more time (e.g. payroll export).
    const statementTimeoutMs = parseInt(
      process.env.DATABASE_STATEMENT_TIMEOUT_MS || "15000",
      10,
    );
    const pool = new Pool({
      connectionString,
      max: isNaN(poolMax) ? 15 : poolMax,
      statement_timeout: isNaN(statementTimeoutMs) ? 15000 : statementTimeoutMs,
      query_timeout: isNaN(statementTimeoutMs) ? 15000 : statementTimeoutMs,
    });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
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
