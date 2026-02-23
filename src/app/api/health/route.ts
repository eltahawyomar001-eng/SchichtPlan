import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health
 *
 * Lightweight health check for uptime monitors and load balancers.
 * Returns 200 if the server is running and the database is reachable.
 */
export async function GET() {
  const start = Date.now();

  try {
    // Simple DB connectivity check
    await prisma.$queryRawUnsafe("SELECT 1");
    const dbLatencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        dbLatencyMs,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[health] Database check failed:", error);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: "Database unreachable",
      },
      { status: 503 },
    );
  }
}
