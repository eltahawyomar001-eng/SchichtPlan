import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { isMonthLocked } from "@/lib/automations";
import { log } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit";
import { withRoute } from "@/lib/with-route";

type TimeEntryStatusValue =
  | "ENTWURF"
  | "EINGEREICHT"
  | "KORREKTUR"
  | "ZURUECKGEWIESEN"
  | "GEPRUEFT"
  | "BESTAETIGT";

// Manager bulk transitions. Mirrors the per-entry state machine in
// /api/time-entries/[id]/status but applied to many entries at once so a
// manager can clear the review queue without opening each entry individually.
const TRANSITIONS: Record<
  string,
  {
    from: TimeEntryStatusValue[];
    to: TimeEntryStatusValue;
    auditAction: string;
  }
> = {
  approve: { from: ["EINGEREICHT"], to: "GEPRUEFT", auditAction: "APPROVED" },
  confirm: { from: ["GEPRUEFT"], to: "BESTAETIGT", auditAction: "CONFIRMED" },
  reject: {
    from: ["EINGEREICHT", "GEPRUEFT"],
    to: "ZURUECKGEWIESEN",
    auditAction: "REJECTED",
  },
};

/**
 * POST /api/time-entries/bulk-status
 * Body: { ids: string[], action: "approve" | "confirm" | "reject", comment?: string }
 *
 * Applies a manager status transition to many time entries in one call.
 * Entries that are not in a valid source state (or in a locked month) are
 * skipped, not failed — the response reports how many were updated vs skipped.
 */
export const POST = withRoute(
  "/api/time-entries/bulk-status",
  "POST",
  async (req) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const workspaceId = user.workspaceId;

    if (!["OWNER", "ADMIN", "MANAGER"].includes(user.role ?? "")) {
      return NextResponse.json(
        { error: "Only managers can perform this action" },
        { status: 403 },
      );
    }

    const _json = await parseJsonBody(req);
    if (!_json.ok) return _json.response;
    const body = _json.data as {
      ids?: unknown;
      action?: unknown;
      comment?: unknown;
    };

    const action = typeof body.action === "string" ? body.action : "";
    const transition = TRANSITIONS[action];
    if (!transition) {
      return NextResponse.json(
        { error: `Ungültige Aktion: ${action}` },
        { status: 400 },
      );
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Keine Einträge" }, { status: 400 });
    }
    const comment = typeof body.comment === "string" ? body.comment : null;

    const entries = await prisma.timeEntry.findMany({
      where: {
        id: { in: ids },
        workspaceId: workspaceId ?? undefined,
        status: { in: transition.from },
      },
    });

    let updated = 0;
    const now = new Date();
    for (const entry of entries) {
      if (isMonthLocked(entry.date)) continue; // skip locked months
      try {
        await prisma.$transaction(async (tx) => {
          await tx.timeEntry.update({
            where: { id: entry.id },
            data: {
              status: transition.to,
              ...(action === "confirm"
                ? { confirmedAt: now, confirmedBy: user.id }
                : {}),
            },
          });
          await tx.timeEntryAudit.create({
            data: {
              action: transition.auditAction,
              comment,
              performedBy: user.id,
              timeEntryId: entry.id,
            },
          });
        });
        updated++;
      } catch (err) {
        log.error("[bulk-status] entry update failed", {
          entryId: entry.id,
          error: err,
        });
      }
    }

    if (updated > 0) {
      createAuditLog({
        action: action === "reject" ? "REJECT" : "APPROVE",
        entityType: "TimeEntry",
        entityId: `bulk:${updated}`,
        userId: user.id,
        userEmail: user.email,
        workspaceId: workspaceId!,
        changes: { action, count: updated, to: transition.to },
      });
    }

    return NextResponse.json({
      updated,
      skipped: ids.length - updated,
      to: transition.to,
    });
  },
  { idempotent: true },
);
