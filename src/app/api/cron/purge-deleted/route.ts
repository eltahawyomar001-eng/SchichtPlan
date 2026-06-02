import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { withRoute } from "@/lib/with-route";

/**
 * GET /api/cron/purge-deleted
 *
 * Hard-purges records that have been soft-deleted for more than 30 days.
 * Runs daily at 04:00 UTC via Vercel Cron.
 *
 * Why 30 days: gives users a comfortable window to realise a mistake and
 * contact support for recovery. After 30 days the data is truly gone.
 *
 * Exceptions — records that are NEVER purged by this job:
 *   - TimeEntry / Employee (ArbZG §16: 2-year working-time retention)
 *   - AbsenceRequest (retention for HR compliance)
 *   - Ticket (may be needed for audit trails)
 *   - AuditLog (GoBD §147: 10-year retention)
 * Those are handled separately by the data-retention endpoint (GDPR erasure).
 */
export const GET = withRoute("/api/cron/purge-deleted", "GET", async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    shifts,
    locations,
    departments,
    skills,
    shiftTemplates,
    clients,
    projects,
    serviceVisits,
  ] = await Promise.all([
    prisma.shift.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.location.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.department.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.skill.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.shiftTemplate.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.client.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.project.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    prisma.serviceVisit.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
  ]);

  const totals = {
    shifts: shifts.count,
    locations: locations.count,
    departments: departments.count,
    skills: skills.count,
    shiftTemplates: shiftTemplates.count,
    clients: clients.count,
    projects: projects.count,
    serviceVisits: serviceVisits.count,
  };

  const total = Object.values(totals).reduce((s, n) => s + n, 0);

  log.info("[cron/purge-deleted] hard-purged soft-deleted records", {
    cutoff,
    ...totals,
    total,
  });

  return NextResponse.json({ purged: total, breakdown: totals });
});
