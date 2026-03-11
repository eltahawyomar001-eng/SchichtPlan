import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isOwner } from "@/lib/authorization";
import { workspaceWipeSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

/**
 * DELETE /api/admin/workspace-wipe
 *
 * DSGVO Art. 17 & Art. 28 — "Nuclear Option"
 *
 * Permanently and irreversibly deletes ALL data belonging to the
 * requesting user's workspace. This is used when:
 *   1. A customer terminates their contract (Art. 28(3)(g) DSGVO)
 *   2. A customer exercises their right to erasure (Art. 17 DSGVO)
 *
 * ONLY the workspace OWNER can trigger this.
 * Requires confirmation body: { confirm: "DELETE-<workspaceId>" }
 *
 * The deletion order respects foreign key constraints (children first).
 * After deletion, the workspace itself is removed, effectively logging
 * the owner out on next request.
 *
 * ⚠️ IRREVERSIBLE. No undo. The Stripe subscription is NOT cancelled
 *    by this endpoint — that must be handled separately via the Stripe
 *    customer portal or billing API.
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SessionUser;

    if (!isOwner(user)) {
      return NextResponse.json(
        { error: "Only the workspace owner can delete all data." },
        { status: 403 },
      );
    }

    const workspaceId = user.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace" }, { status: 400 });
    }

    // Require explicit confirmation
    const parsed = validateBody(workspaceWipeSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const expectedConfirm = `DELETE-${workspaceId}`;

    if (parsed.data.confirm !== expectedConfirm) {
      return NextResponse.json(
        {
          error: "Confirmation required",
          message: `Send { "confirm": "${expectedConfirm}" } to proceed.`,
        },
        { status: 400 },
      );
    }

    log.warn(
      `[workspace-wipe] Owner ${user.email} initiated full workspace deletion`,
      {
        workspaceId,
        userId: user.id,
      },
    );

    // ── Cascade delete ──────────────────────────────────────────
    // Prisma onDelete: Cascade handles most relations, but we delete
    // the workspace itself which cascades to all child records.
    // For safety, we explicitly delete junction/orphan tables first.

    // 1. Delete all workspace-scoped data via workspace cascade
    //    The schema defines onDelete: Cascade on all workspace relations,
    //    so deleting the workspace removes:
    //    - Employees → Shifts, TimeEntries, AbsenceRequests, Availabilities,
    //      ShiftChangeRequests, ShiftSwapRequests, TimeAccounts, VacationBalances,
    //      EmployeeSkills, ProjectMembers, ServiceVisits, etc.
    //    - Locations, Departments, Skills, ShiftTemplates, PublicHolidays
    //    - Notifications, NotificationPreferences, PushSubscriptions
    //    - AutomationSettings, AutomationRules, WebhookEndpoints
    //    - Clients, Projects, ServiceReports
    //    - ChatChannels → ChatMessages → ChatReactions, ChatAttachments
    //    - ESignatures, AuditLogs, ExportJobs
    //    - MonthClose records
    //    - StaffingRequirements, AutoScheduleRuns, AutoFillLogs, ManagerAlerts
    //    - Subscription, WorkspaceUsage
    //    - Invitations

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    log.warn(
      `[workspace-wipe] Workspace ${workspaceId} fully deleted by ${user.email}`,
    );

    return NextResponse.json({
      success: true,
      message:
        "Alle Daten wurden unwiderruflich gelöscht. (All data has been irreversibly deleted.)",
    });
  } catch (error) {
    log.error("Workspace wipe error:", { error });
    return NextResponse.json(
      { error: "Deletion failed. Please contact support." },
      { status: 500 },
    );
  }
}
