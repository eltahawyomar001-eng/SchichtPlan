/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";

/** GET /api/month-close — list month-close records for workspace */
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

    const forbidden = requirePermission(user, "month-close", "read");
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {
      workspaceId: user.workspaceId,
    };
    if (year) where.year = parseInt(year, 10);

    const records = await (prisma as any).monthClose.findMany({
      where,
      include: { exportJobs: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/month-close — lock or export a month.
 * Body: { year, month, action: "lock" | "unlock" | "export" }
 */
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

    const forbidden = requirePermission(user, "month-close", "create");
    if (forbidden) return forbidden;

    const { year, month, action } = await req.json();

    if (!year || !month || !action) {
      return NextResponse.json(
        { error: "year, month, and action are required" },
        { status: 400 },
      );
    }

    // Upsert the month-close record
    const existing = await (prisma as any).monthClose.findFirst({
      where: {
        workspaceId: user.workspaceId,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
      },
    });

    if (action === "lock") {
      const record = existing
        ? await (prisma as any).monthClose.update({
            where: { id: existing.id },
            data: {
              status: "LOCKED",
              lockedBy: user.id,
              lockedAt: new Date(),
            },
          })
        : await (prisma as any).monthClose.create({
            data: {
              year: parseInt(year, 10),
              month: parseInt(month, 10),
              status: "LOCKED",
              lockedBy: user.id,
              lockedAt: new Date(),
              workspaceId: user.workspaceId,
            },
          });

      return NextResponse.json(record);
    }

    if (action === "unlock") {
      if (!existing) {
        return NextResponse.json({ error: "Month not found" }, { status: 404 });
      }

      const record = await (prisma as any).monthClose.update({
        where: { id: existing.id },
        data: { status: "OPEN", lockedBy: null, lockedAt: null },
      });

      return NextResponse.json(record);
    }

    if (action === "export") {
      if (!existing || existing.status === "OPEN") {
        return NextResponse.json(
          { error: "Month must be locked before export" },
          { status: 400 },
        );
      }

      const record = await (prisma as any).monthClose.update({
        where: { id: existing.id },
        data: { status: "EXPORTED", exportedAt: new Date() },
      });

      return NextResponse.json(record);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
