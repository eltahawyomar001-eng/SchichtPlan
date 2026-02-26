import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requireLocationSlot } from "@/lib/subscription";
import { createLocationSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";

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

    const { take, skip } = parsePagination(req);

    const [locations, total] = await Promise.all([
      prisma.location.findMany({
        where: { workspaceId },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.location.count({ where: { workspaceId } }),
    ]);

    return paginatedResponse(locations, total, take, skip);
  } catch (error) {
    log.error("Error fetching locations:", { error: error });
    return NextResponse.json({ error: "Error loading" }, { status: 500 });
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

    // Only OWNER, ADMIN, MANAGER can create locations
    const forbidden = requirePermission(user, "locations", "create");
    if (forbidden) return forbidden;

    // Check plan limit
    const planLimit = await requireLocationSlot(workspaceId);
    if (planLimit) return planLimit;

    const body = await req.json();
    const parsed = validateBody(createLocationSchema, body);
    if (!parsed.success) return parsed.response;
    const { name, address } = parsed.data;

    const location = await prisma.location.create({
      data: {
        name,
        address: address || null,
        workspaceId,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    log.error("Error creating location:", { error: error });
    return NextResponse.json(
      { error: "Error creating resource" },
      { status: 500 },
    );
  }
}
