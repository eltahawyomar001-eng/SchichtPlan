import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";
import { validateBody } from "@/lib/validations";

const patchCategorySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().max(20).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/ticket-categories/[id] — rename / recolor / reorder / deactivate.
 * Soft-delete via `isActive=false` is preferred over a hard delete so that
 * historical tickets retain their tag reference.
 */
export const PATCH = withRoute(
  "/api/ticket-categories/[id]",
  "PATCH",
  async (req, context) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const { id } = await context!.params;

    const current = await prisma.ticketCategoryDef.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!current) {
      return NextResponse.json(
        {
          error: "CATEGORY_NOT_FOUND",
          message: "Kategorie nicht gefunden.",
        },
        { status: 404 },
      );
    }

    const parsed = validateBody(patchCategorySchema, await req.json());
    if (!parsed.success) return parsed.response;

    try {
      const updated = await prisma.ticketCategoryDef.update({
        where: { id },
        data: parsed.data,
      });
      return NextResponse.json(updated);
    } catch (err) {
      log.error("[ticket-categories] update failed", { err, id });
      return NextResponse.json(
        {
          error: "CATEGORY_UPDATE_FAILED",
          message: "Kategorie konnte nicht aktualisiert werden.",
        },
        { status: 500 },
      );
    }
  },
);

/**
 * DELETE /api/ticket-categories/[id] — hard-delete if no tickets reference it,
 * otherwise soft-delete (isActive=false). Keeps historical category tags intact.
 */
export const DELETE = withRoute(
  "/api/ticket-categories/[id]",
  "DELETE",
  async (_req, context) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "settings", "update");
    if (forbidden) return forbidden;

    const { id } = await context!.params;

    const cat = await prisma.ticketCategoryDef.findFirst({
      where: { id, workspaceId },
      select: { id: true, _count: { select: { tickets: true } } },
    });
    if (!cat) {
      return NextResponse.json(
        {
          error: "CATEGORY_NOT_FOUND",
          message: "Kategorie nicht gefunden.",
        },
        { status: 404 },
      );
    }

    if (cat._count.tickets > 0) {
      // Tickets still reference it — soft delete only.
      const deactivated = await prisma.ticketCategoryDef.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ ...deactivated, softDeleted: true });
    }

    await prisma.ticketCategoryDef.delete({ where: { id } });
    return NextResponse.json({ id, deleted: true });
  },
);
