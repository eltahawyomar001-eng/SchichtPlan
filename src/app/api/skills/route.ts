import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createSkillSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhooks";

export const GET = withRoute("/api/skills", "GET", async (req) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = (session.user as SessionUser).workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { take, skip } = parsePagination(req);

  const [skills, total] = await Promise.all([
    prisma.skill.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { employeeSkills: true } },
      },
      orderBy: { name: "asc" },
      take,
      skip,
    }),
    prisma.skill.count({ where: { workspaceId } }),
  ]);

  return paginatedResponse(skills, total, take, skip);
});

export const POST = withRoute(
  "/api/skills",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "employees", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createSkillSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, category } = parsed.data;

    try {
      const skill = await prisma.skill.create({
        data: {
          name,
          category: category || null,
          workspaceId,
        },
      });

      createAuditLog({
        action: "CREATE",
        entityType: "Skill",
        entityId: skill.id,
        userId: user.id,
        userEmail: user.email,
        workspaceId,
        changes: { name, category },
      });

      dispatchWebhook(workspaceId, "skill.created", {
        id: skill.id,
        name,
        category,
      }).catch(() => {});

      return NextResponse.json(skill, { status: 201 });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Skill already exists" },
          { status: 409 },
        );
      }
      throw error;
    }
  },
  { idempotent: true },
);
