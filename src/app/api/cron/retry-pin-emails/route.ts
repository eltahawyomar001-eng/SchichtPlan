import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPinEmail, generateUniquePin, hashPin } from "@/lib/employee-pin";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";

const BATCH_SIZE = 50;

/**
 * GET /api/cron/retry-pin-emails
 *
 * Retries PIN emails for employees where pinEmailFailed = true.
 * Runs via Vercel Cron every 6 hours.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");

  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  try {
    const employees = await prisma.employee.findMany({
      where: { pinEmailFailed: true, email: { not: null }, isActive: true },
      select: {
        id: true,
        firstName: true,
        email: true,
        workspaceId: true,
        pinHash: true,
        workspace: { select: { name: true } },
      },
      take: BATCH_SIZE,
    });

    let succeeded = 0;
    let failed = 0;

    for (const emp of employees) {
      if (!emp.email) continue;

      try {
        // Re-use existing PIN if present; otherwise assign a new one
        let rawPin: string;
        let pinHash: string | null = emp.pinHash;

        if (!pinHash) {
          rawPin = await generateUniquePin(emp.workspaceId);
          pinHash = hashPin(emp.workspaceId, rawPin);
          await prisma.employee.update({
            where: { id: emp.id },
            data: { pinHash },
          });
        } else {
          // We can't recover the raw PIN from the hash — assign a new one
          rawPin = await generateUniquePin(emp.workspaceId);
          const newHash = hashPin(emp.workspaceId, rawPin);
          await prisma.employee.update({
            where: { id: emp.id },
            data: { pinHash: newHash },
          });
        }

        await sendPinEmail({
          to: emp.email,
          firstName: emp.firstName,
          rawPin,
          workspaceName: emp.workspace.name,
        });

        await prisma.employee.update({
          where: { id: emp.id },
          data: { pinEmailFailed: false },
        });

        succeeded++;
      } catch (err) {
        log.error("[cron/retry-pin-emails] retry failed", {
          error: err,
          employeeId: emp.id,
        });
        failed++;
      }
    }

    log.info("[cron/retry-pin-emails] done", { succeeded, failed });
    return NextResponse.json({ succeeded, failed });
  } catch (err) {
    captureRouteError(err, {
      route: "/api/cron/retry-pin-emails",
      method: "GET",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
