import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createShiftTemplateSchema, validateBody } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as SessionUser).workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Check plan feature
    const planGate = await requirePlanFeature(workspaceId, "shiftTemplates");
    if (planGate) return planGate;

    const { take, skip } = parsePagination(req);

    const [templates, total] = await Promise.all([
      prisma.shiftTemplate.findMany({
        where: { workspaceId },
        include: {
          location: {
            select: { id: true, name: true },
          },
        },
        orderBy: { startTime: "asc" },
        take,
        skip,
      }),
      prisma.shiftTemplate.count({ where: { workspaceId } }),
    ]);

    return paginatedResponse(templates, total, take, skip);
  } catch (error) {
    log.error("Error fetching templates:", { error: error });
    return NextResponse.json(
      { error: "Error loading templates" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "shifts", "create");
    if (forbidden) return forbidden;

    // Check plan feature
    const planGate = await requirePlanFeature(workspaceId, "shiftTemplates");
    if (planGate) return planGate;

    const parsed = validateBody(createShiftTemplateSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, startTime, endTime, color, locationId } = parsed.data;

    const template = await prisma.shiftTemplate.create({
      data: {
        name,
        startTime,
        endTime,
        color: color || null,
        locationId: locationId || null,
        workspaceId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    log.error("Error creating template:", { error: error });
    return NextResponse.json(
      { error: "Error creating template" },
      { status: 500 },
    );
  }
}
