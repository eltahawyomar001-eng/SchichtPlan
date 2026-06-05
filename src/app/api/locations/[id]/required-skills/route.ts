import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { parseJsonBody } from "@/lib/api-response";
import { withRoute } from "@/lib/with-route";
import { z } from "zod";

// GET /api/locations/[id]/required-skills
export const GET = withRoute(
  "/api/locations/[id]/required-skills",
  "GET",
  async (_req, context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    const { id } = await context!.params;

    const forbidden = requirePermission(user, "locations", "read");
    if (forbidden) return forbidden;

    const location = await prisma.location.findFirst({
      where: { id, workspaceId: user.workspaceId! },
      select: {
        id: true,
        name: true,
        requiredSkills: {
          select: {
            id: true,
            skillId: true,
            skill: { select: { id: true, name: true, category: true } },
          },
        },
      },
    });

    if (!location)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ requiredSkills: location.requiredSkills });
  },
);

// POST /api/locations/[id]/required-skills  { skillId }
export const POST = withRoute(
  "/api/locations/[id]/required-skills",
  "POST",
  async (req, context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    const { id } = await context!.params;

    const forbidden = requirePermission(user, "locations", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;

    const parsed = z
      .object({ skillId: z.string().cuid() })
      .safeParse(_json.data);
    if (!parsed.success)
      return NextResponse.json(
        { error: "INVALID_BODY", message: "skillId required" },
        { status: 400 },
      );

    // Verify location belongs to workspace
    const location = await prisma.location.findFirst({
      where: { id, workspaceId: user.workspaceId! },
      select: { id: true },
    });
    if (!location)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify skill belongs to workspace
    const skill = await prisma.skill.findFirst({
      where: { id: parsed.data.skillId, workspaceId: user.workspaceId! },
      select: { id: true, name: true, category: true },
    });
    if (!skill)
      return NextResponse.json(
        { error: "SKILL_NOT_FOUND", message: "Skill not found" },
        { status: 404 },
      );

    const entry = await prisma.locationRequiredSkill.upsert({
      where: {
        locationId_skillId: { locationId: id, skillId: parsed.data.skillId },
      },
      create: { locationId: id, skillId: parsed.data.skillId },
      update: {},
      include: { skill: { select: { id: true, name: true, category: true } } },
    });

    return NextResponse.json(entry, { status: 201 });
  },
);

// DELETE /api/locations/[id]/required-skills  { skillId }
export const DELETE = withRoute(
  "/api/locations/[id]/required-skills",
  "DELETE",
  async (req, context) => {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as SessionUser;
    const { id } = await context!.params;

    const forbidden = requirePermission(user, "locations", "update");
    if (forbidden) return forbidden;

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;

    const parsed = z
      .object({ skillId: z.string().cuid() })
      .safeParse(_json.data);
    if (!parsed.success)
      return NextResponse.json(
        { error: "INVALID_BODY", message: "skillId required" },
        { status: 400 },
      );

    await prisma.locationRequiredSkill.deleteMany({
      where: { locationId: id, skillId: parsed.data.skillId },
    });

    return NextResponse.json({ ok: true });
  },
);
