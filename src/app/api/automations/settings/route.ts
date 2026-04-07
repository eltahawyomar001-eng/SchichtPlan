import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import {
  updateAutomationSettingsSchema,
  validateBody,
} from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

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
export const GET = withRoute(
  "/api/automations/settings",
  "GET",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

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
  },
);

/** PUT — Update one or more automation toggles */
export const PUT = withRoute(
  "/api/automations/settings",
  "PUT",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    if (!["OWNER", "ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = validateBody(updateAutomationSettingsSchema, body);
    if (!parsed.success) return parsed.response;
    const updates = parsed.data.settings;

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

    createAuditLog({
      action: "UPDATE",
      entityType: "AutomationSettings",
      userId: user.id,
      userEmail: user.email,
      workspaceId,
      changes: updates,
    });

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
  },
);
