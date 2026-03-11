import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

const startedAt = Date.now();

/**
 * GET /api/health
 *
 * Comprehensive health check for uptime monitors and load balancers.
 * Returns 200 if the server is running and the database is reachable.
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, unknown> = {};

  // ── Database ──────────────────────────────────────────────
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: "ok",
      latencyMs: Date.now() - start,
    };
    dbOk = true;
  } catch (error) {
    log.error("[health] Database check failed:", { error });
    checks.database = {
      status: "error",
      error: "Database unreachable",
    };
  }

  // ── Redis (Upstash) ──────────────────────────────────────
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const redisStart = Date.now();
    try {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      checks.redis = {
        status: res.ok ? "ok" : "error",
        latencyMs: Date.now() - redisStart,
      };
    } catch {
      checks.redis = { status: "error", error: "Redis unreachable" };
    }
  } else {
    checks.redis = { status: "not_configured" };
  }

  // ── Stripe ────────────────────────────────────────────────
  if (process.env.STRIPE_SECRET_KEY) {
    const stripeStart = Date.now();
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        },
      });
      checks.stripe = {
        status: res.ok ? "ok" : "error",
        latencyMs: Date.now() - stripeStart,
      };
    } catch {
      checks.stripe = { status: "error", error: "Stripe unreachable" };
    }
  } else if (process.env.STRIPE_SIMULATION_MODE === "true") {
    checks.stripe = { status: "simulation_mode" };
  } else {
    checks.stripe = { status: "not_configured" };
  }

  // ── System info ───────────────────────────────────────────
  const mem = process.memoryUsage();
  const overall = dbOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status: overall,
      version: process.env.npm_package_version || "0.1.0",
      apiVersion: 1,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      node: process.version,
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      checks,
    },
    { status: overall === "ok" ? 200 : 503 },
  );
}
