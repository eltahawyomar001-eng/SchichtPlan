import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { serverError, badRequest, notFound } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";

/**
 * GET  /api/tickets/external/locations?workspace=<slug>
 *
 * Public endpoint (no authentication). Returns a list of location names
 * for the given workspace so external ticket forms can show a dropdown.
 */
export const GET = withRoute(
  "/api/tickets/external/locations",
  "GET",
  async (req) => {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      return badRequest("Workspace-Parameter fehlt");
    }

    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return notFound("Workspace nicht gefunden");
    }

    const locations = await prisma.location.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json(locations);
  },
);
