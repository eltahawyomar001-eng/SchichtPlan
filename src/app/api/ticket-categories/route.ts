import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { requireAuth } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { log } from "@/lib/logger";
import {
  ensureDefaultCategories,
  slugifyCategoryName,
} from "@/lib/ticket-categories";
import { validateBody } from "@/lib/validations";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name erforderlich").max(80),
  color: z.string().trim().max(20).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

/**
 * GET /api/ticket-categories
 *
 * Lists the workspace's custom ticket categories. Available to every
 * authenticated member — required so the ticket-creation dropdown can be
 * rendered for employees. Mutation routes are admin-gated.
 */
export const GET = withRoute("/api/ticket-categories", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { workspaceId } = auth;

  await ensureDefaultCategories(workspaceId);

  const categories = await prisma.ticketCategoryDef.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      sortOrder: true,
      legacyEnum: true,
    },
  });

  return NextResponse.json({ categories });
});

/**
 * POST /api/ticket-categories — create a new tenant-scoped category.
 * OWNER/ADMIN only.
 */
export const POST = withRoute("/api/ticket-categories", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "settings", "update");
  if (forbidden) return forbidden;

  const parsed = validateBody(createCategorySchema, await req.json());
  if (!parsed.success) return parsed.response;
  const { name, color, sortOrder } = parsed.data;

  // Generate a slug; on collision append a short random suffix.
  let slug = slugifyCategoryName(name);
  const existing = await prisma.ticketCategoryDef.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
    select: { id: true },
  });
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  try {
    const created = await prisma.ticketCategoryDef.create({
      data: {
        workspaceId,
        name,
        slug,
        color: color || null,
        sortOrder: sortOrder ?? 1000,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    log.error("[ticket-categories] create failed", { err, workspaceId });
    return NextResponse.json(
      {
        error: "CATEGORY_CREATE_FAILED",
        message: "Kategorie konnte nicht erstellt werden.",
      },
      { status: 500 },
    );
  }
});
