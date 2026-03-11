import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";
import { createClientSchema, validateBody } from "@/lib/validations";

/** GET /api/clients — list all clients for the workspace */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "clients", "read");
    if (forbidden) return forbidden;

    const { take, skip } = parsePagination(req);

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where: { workspaceId: user.workspaceId },
        include: {
          projects: { select: { id: true, name: true, status: true } },
        },
        orderBy: { name: "asc" },
        take,
        skip,
      }),
      prisma.client.count({
        where: { workspaceId: user.workspaceId },
      }),
    ]);

    return paginatedResponse(clients, total, take, skip);
  } catch (error) {
    log.error("Error fetching clients:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/clients — create a new client */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    const forbidden = requirePermission(user, "clients", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createClientSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const { name, email, phone, address, notes } = parsed.data;

    const client = await prisma.client.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        workspaceId: user.workspaceId,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    log.error("Error creating client:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
