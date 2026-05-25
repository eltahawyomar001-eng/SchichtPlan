import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { cache } from "@/lib/cache";

/**
 * GET /api/import/status?jobId=<id>
 *
 * Poll the status of an async import job.
 * Returns { status, total, created?, skipped?, duplicates?, error? }
 */
export const GET = withRoute("/api/import/status", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId || !/^[0-9a-f-]{36}$/.test(jobId)) {
    return NextResponse.json(
      { error: "Missing or invalid jobId" },
      { status: 400 },
    );
  }

  const job = await cache.get<{
    status: string;
    total: number;
    created?: number;
    skipped?: number;
    duplicates?: number;
    error?: string;
    type: string;
    workspaceId: string;
  }>(`import:job:${jobId}`);

  if (!job) {
    return NextResponse.json(
      { error: "Job not found or expired" },
      { status: 404 },
    );
  }

  // Ensure the requesting user can only see their own workspace's jobs
  if (job.workspaceId !== user.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(job);
});
