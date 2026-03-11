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
    const poolMax = parseInt(process.env.DATABASE_POOL_MAX || "5", 10);
    const pool = new Pool({
      connectionString,
      max: isNaN(poolMax) ? 5 : poolMax,
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
