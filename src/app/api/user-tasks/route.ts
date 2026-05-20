import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { validateBody } from "@/lib/validations";

const createSchema = z.object({
  title: z.string().min(1).max(200),
});

/**
 * GET /api/user-tasks
 * Returns the current user's personal task list.
 */
export const GET = withRoute("/api/user-tasks", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const tasks = await prisma.userTask.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      done: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ tasks });
});

/**
 * POST /api/user-tasks
 * Create a new task for the current user.
 */
export const POST = withRoute(
  "/api/user-tasks",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const parsed = validateBody(createSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const task = await prisma.userTask.create({
      data: {
        userId: user.id,
        workspaceId,
        title: parsed.data.title.trim(),
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

    return NextResponse.json(task, { status: 201 });
  },
  { idempotent: true },
);
