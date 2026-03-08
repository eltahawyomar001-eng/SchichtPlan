import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { requirePlanFeature } from "@/lib/subscription";
import crypto from "crypto";
import { createWebhookSchema, validateBody } from "@/lib/validations";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { log } from "@/lib/logger";

/** GET /api/webhooks — list all webhook endpoints */
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

    const forbidden = requirePermission(user, "webhooks", "read");
    if (forbidden) return forbidden;

    // Check plan feature
    const planGate = await requirePlanFeature(user.workspaceId!, "apiWebhooks");
    if (planGate) return planGate;

    const { take, skip } = parsePagination(req);

    const [hooks, total] = await Promise.all([
      prisma.webhookEndpoint.findMany({
        where: { workspaceId: user.workspaceId },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.webhookEndpoint.count({
        where: { workspaceId: user.workspaceId },
      }),
    ]);

    return paginatedResponse(hooks, total, take, skip);
  } catch (error) {
    log.error("Error:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/webhooks — create a new webhook endpoint */
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

    const forbidden = requirePermission(user, "webhooks", "create");
    if (forbidden) return forbidden;

    // Check plan feature
    const planGate = await requirePlanFeature(user.workspaceId!, "apiWebhooks");
    if (planGate) return planGate;

    const body = await req.json();
    const parsed = validateBody(createWebhookSchema, body);
    if (!parsed.success) return parsed.response;
    const { url, events } = parsed.data;

    const secret = crypto.randomBytes(32).toString("hex");

    const hook = await prisma.webhookEndpoint.create({
      data: {
        url,
        secret,
        events,
        workspaceId: user.workspaceId,
      },
    });

    return NextResponse.json(hook, { status: 201 });
  } catch (error) {
    log.error("Error:", { error: error });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
