import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

/**
 * All known automation keys and their default enabled state.
 * When a workspace has no row for a key, it falls back to this default.
 */
export const AUTOMATION_DEFAULTS: Record<string, boolean> = {
  shiftConflictDetection: true,
  restPeriodEnforcement: true,
  cascadeAbsenceCancellation: true,
  autoCreateTimeEntries: true,
  legalBreakEnforcement: true,
  timeAccountRecalculation: true,
  recurringShifts: true,
  autoApproveAbsence: true,
  autoApproveSwap: true,
  overtimeAlerts: true,
  payrollAutoLock: true,
  notifications: true,
};

/** GET — Fetch all automation settings for the workspace */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Only owners/admins can view automation settings
    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await prisma.automationSetting.findMany({
      where: { workspaceId: user.workspaceId },
    });

    // Merge DB rows with defaults
    const merged: Record<string, boolean> = { ...AUTOMATION_DEFAULTS };
    for (const s of settings) {
      if (s.key in merged) {
        merged[s.key] = s.enabled;
      }
    }

    return NextResponse.json({ settings: merged });
  } catch (error) {
    console.error("Error fetching automation settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** PUT — Update one or more automation toggles */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (!user.workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, boolean> = body.settings;

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Validate keys
    const validKeys = Object.keys(AUTOMATION_DEFAULTS);
    const entries = Object.entries(updates).filter(([k]) =>
      validKeys.includes(k),
    );

    // Upsert each setting
    for (const [key, enabled] of entries) {
      await prisma.automationSetting.upsert({
        where: {
          workspaceId_key: {
            workspaceId: user.workspaceId,
            key,
          },
        },
        update: { enabled },
        create: {
          key,
          enabled,
          workspaceId: user.workspaceId,
        },
      });
    }

    // Return updated full state
    const settings = await prisma.automationSetting.findMany({
      where: { workspaceId: user.workspaceId },
    });

    const merged: Record<string, boolean> = { ...AUTOMATION_DEFAULTS };
    for (const s of settings) {
      if (s.key in merged) {
        merged[s.key] = s.enabled;
      }
    }

    return NextResponse.json({ settings: merged });
  } catch (error) {
    console.error("Error updating automation settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
