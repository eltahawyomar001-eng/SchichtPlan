import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, notFound } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { withRoute } from "@/lib/with-route";

export const dynamic = "force-dynamic";

/**
 * GET /api/compliance/dossier/[id] — full persisted dossier snapshot (for the
 * printable view).
 */
export const GET = withRoute(
  "/api/compliance/dossier/[id]",
  "GET",
  async (_req, context) => {
    const { id } = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "shifts", "read");
    if (forbidden) return forbidden;

    const dossier = await prisma.auditDossier.findFirst({
      where: { id, workspaceId },
    });
    if (!dossier) return notFound("Dossier nicht gefunden");

    return NextResponse.json(dossier);
  },
);
