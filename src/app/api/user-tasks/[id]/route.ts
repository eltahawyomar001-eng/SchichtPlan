import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { validateBody } from "@/lib/validations";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  done: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

/**
 * PATCH /api/user-tasks/[id]
 * Update title / done / sortOrder of one of the user's own tasks.
 */
export const PATCH = withRoute(
  "/api/user-tasks/[id]",
  "PATCH",
  async (req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const parsed = validateBody(updateSchema, _json.data);
    if (!parsed.success) return parsed.response;

    const existing = await prisma.userTask.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const data = parsed.data;
    const updated = await prisma.userTask.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.done !== undefined && { done: data.done }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
      select: {
        id: true,
        title: true,
        done: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  },
);

/**
 * DELETE /api/user-tasks/[id]
 */
export const DELETE = withRoute(
  "/api/user-tasks/[id]",
  "DELETE",
  async (_req, context) => {
    const params = await context!.params;
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const existing = await prisma.userTask.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json(
        { error: "Not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    await prisma.userTask.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  },
);
