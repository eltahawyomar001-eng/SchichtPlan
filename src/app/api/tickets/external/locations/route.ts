import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { serverError, badRequest, notFound } from "@/lib/api-response";
import { requireTicketingAddon } from "@/lib/ticketing-addon";

/**
 * GET  /api/tickets/external/locations?workspace=<slug>
 *
 * Public endpoint (no authentication). Returns a list of location names
 * for the given workspace so external ticket forms can show a dropdown.
 */
export async function GET(req: Request) {
  try {
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

    // Add-on gate: don't expose location dropdown if workspace has no ticketing add-on.
    const addonRequired = await requireTicketingAddon(workspace.id);
    if (addonRequired) return addonRequired;

    const locations = await prisma.location.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json(locations);
  } catch (error) {
    log.error("Error fetching external locations:", { error });
    captureRouteError(error, {
      route: "/api/tickets/external/locations",
      method: "GET",
    });
    return serverError();
  }
}
