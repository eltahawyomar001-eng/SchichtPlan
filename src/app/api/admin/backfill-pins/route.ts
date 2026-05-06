import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authorization";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";
import type { SessionUser } from "@/lib/types";

/**
 * POST /api/admin/backfill-pins
 *
 * One-time backfill: assigns a unique 4-digit PIN to every active employee
 * in the caller's workspace that currently has no pinHash. Sends the PIN by
 * email when the employee has an email address on record.
 *
 * Access: OWNER / ADMIN only.
 * Safe to call multiple times — skips employees who already have a PIN.
 */
export const POST = withRoute("/api/admin/backfill-pins", "POST", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { workspaceId, user } = auth;
  const forbidden = requireAdmin(user as SessionUser);
  if (forbidden) return forbidden;

  const employees = await prisma.employee.findMany({
    where: { workspaceId, pinHash: null, isActive: true, deletedAt: null },
    select: { id: true, firstName: true, email: true },
  });

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  const workspaceName = ws?.name ?? "";

  let assigned = 0;
  let emailed = 0;
  const errors: string[] = [];

  for (const emp of employees) {
    try {
      const rawPin = await generateUniquePin(workspaceId);
      const pHash = hashPin(workspaceId, rawPin);
      await prisma.employee.update({
        where: { id: emp.id },
        data: { pinHash: pHash },
      });
      assigned++;

      if (emp.email) {
        await sendPinEmail({
          to: emp.email,
          firstName: emp.firstName,
          rawPin,
          workspaceName,
        });
        emailed++;
      }
    } catch (err) {
      log.error("[backfill-pins] failed for employee", {
        err,
        employeeId: emp.id,
      });
      errors.push(emp.id);
    }
  }

  return NextResponse.json({
    assigned,
    emailed,
    errors,
    total: employees.length,
  });
});
