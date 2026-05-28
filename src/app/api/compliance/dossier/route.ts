import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth, parseJsonBody, badRequest } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";
import { createAuditLog } from "@/lib/audit";
import { computeReadiness } from "@/lib/audit-readiness";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/dossier — list past generated dossiers.
 */
export const GET = withRoute("/api/compliance/dossier", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "shifts", "read");
  if (forbidden) return forbidden;

  const dossiers = await prisma.auditDossier.findMany({
    where: { workspaceId },
    orderBy: { generatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      readinessScore: true,
      passCount: true,
      warnCount: true,
      failCount: true,
      contentHash: true,
      generatedAt: true,
    },
  });
  return NextResponse.json(dossiers);
});

/**
 * POST /api/compliance/dossier — generate + persist an audit dossier for a
 * period. Stores the full snapshot and a SHA-256 content hash (tamper-evidence).
 * Body: { from, to }  (validated as periodStart/periodEnd)
 */
export const POST = withRoute(
  "/api/compliance/dossier",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data as { from?: unknown; to?: unknown };
    const from = body.from;
    const to = body.to;
    if (typeof from !== "string" || typeof to !== "string") {
      return badRequest("from und to sind erforderlich");
    }
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return badRequest("Ungültiger Zeitraum");
    }

    const result = await computeReadiness(workspaceId, from, to);

    const contentHash = createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex");

    const dossier = await prisma.auditDossier.create({
      data: {
        workspaceId,
        periodStart: new Date(from),
        periodEnd: new Date(to),
        readinessScore: result.score,
        passCount: result.totals.pass,
        warnCount: result.totals.warn,
        failCount: result.totals.fail,
        snapshot: result as object,
        contentHash,
        generatedById: user.id,
      },
    });

    createAuditLog({
      action: "CREATE",
      entityType: "AuditDossier",
      entityId: dossier.id,
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: { from, to, score: result.score, contentHash },
    });

    return NextResponse.json(dossier, { status: 201 });
  },
  { idempotent: true },
);
