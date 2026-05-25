/**
 * Next.js instrumentation hook — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Validate environment variables before anything else
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  // Initialise Sentry on the server / edge runtimes
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Graceful shutdown: disconnect Prisma on SIGTERM / SIGINT so in-flight
    // queries can complete and the connection pool is cleanly released.
    const { prisma } = await import("@/lib/db");
    const shutdown = async (signal: string) => {
      await prisma.$disconnect().catch(() => {});
      process.exit(0);
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
