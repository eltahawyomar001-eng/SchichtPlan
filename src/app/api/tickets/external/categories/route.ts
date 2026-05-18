import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { serverError, badRequest, notFound } from "@/lib/api-response";
import { requireTicketingAddon } from "@/lib/ticketing-addon";
import { ensureDefaultCategories } from "@/lib/ticket-categories";

/**
 * GET /api/tickets/external/categories?workspace=<slug>
 *
 * Public endpoint (no authentication). Returns the workspace's
 * custom ticket categories so the external submission form can render
 * them in its dropdown.
 *
 * Multi-tenant safety: the slug is resolved server-side to exactly one
 * workspace, and only that workspace's category rows are returned.
 * Categories themselves are non-sensitive tag labels, but we still
 * scope by workspaceId on every query so an attacker can't enumerate
 * other tenants' tag inventories by probing.
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

    const addonRequired = await requireTicketingAddon(workspace.id);
    if (addonRequired) return addonRequired;

    await ensureDefaultCategories(workspace.id);

    const categories = await prisma.ticketCategoryDef.findMany({
      where: { workspaceId: workspace.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        legacyEnum: true,
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    log.error("Error fetching external categories:", { error });
    captureRouteError(error, {
      route: "/api/tickets/external/categories",
      method: "GET",
    });
    return serverError();
  }
}
