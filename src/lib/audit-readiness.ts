/**
 * Prüfungssicher — audit-readiness engine.
 *
 * Computes a compliance snapshot for a workspace over a date range, suitable
 * for a Zoll/FKS (Finanzkontrolle Schwarzarbeit), §34a (Gewerbeamt) or works
 * inspection. Reuses the data already enforced elsewhere (ArbZG breaks/rest,
 * §34a certifications, MiLoG wage) and turns it into one auditable artifact.
 *
 * Findings are returned STRUCTURED (code + values), not as localized strings,
 * so the UI and the printable dossier can render them in DE or EN.
 */

import { prisma } from "@/lib/db";
import {
  shiftGrossMinutes,
  requiredBreakForNet,
  ARBZG_REST_HOURS,
} from "@/lib/arbzg";

export type Severity = "WARN" | "FAIL";
export type CategoryKey =
  | "ARBZG_3"
  | "ARBZG_4"
  | "ARBZG_5"
  | "SACHKUNDE_34A"
  | "MILOG";

export interface Finding {
  category: CategoryKey;
  severity: Severity;
  /** Stable code the UI maps to a localized message. */
  code: string;
  employeeId?: string;
  employeeName?: string;
  date?: string; // YYYY-MM-DD
  locationName?: string;
  /** Structured params for the localized message (numbers, names, dates). */
  values?: Record<string, string | number>;
}

export interface CategorySummary {
  category: CategoryKey;
  items: number;
  pass: number;
  warn: number;
  fail: number;
}

export interface ReadinessResult {
  periodStart: string;
  periodEnd: string;
  minHourlyWageCents: number;
  score: number; // 0–100
  totals: { items: number; pass: number; warn: number; fail: number };
  categories: CategorySummary[];
  findings: Finding[];
  /** Per-employee working-time summary for the dossier. */
  employeeSummaries: {
    employeeId: string;
    name: string;
    shiftCount: number;
    plannedMinutes: number; // net (gross - break)
    hourlyRate: number | null;
  }[];
  generatedAt: string;
}

const DAY_MS = 86_400_000;
const ARBZG_3_MAX_NET = 10 * 60; // max 10h working time per shift
const CERT_EXPIRY_WARN_DAYS = 30;

function toDateTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}
function resolveShiftEnd(date: Date, startTime: string, endTime: string): Date {
  const start = toDateTime(date, startTime);
  const end = toDateTime(date, endTime);
  if (end <= start) end.setDate(end.getDate() + 1);
  return end;
}
function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export async function computeReadiness(
  workspaceId: string,
  from: string,
  to: string,
): Promise<ReadinessResult> {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const [workspace, shifts, employees, locationReq] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { minHourlyWageCents: true },
    }),
    prisma.shift.findMany({
      where: {
        workspaceId,
        date: { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        breakMinutes: true,
        employeeId: true,
        locationId: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
        location: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.employee.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        hourlyRate: true,
        employeeSkills: {
          select: { skillId: true, expiresAt: true, documentUrl: true },
        },
      },
    }),
    prisma.locationRequiredSkill.findMany({
      where: { location: { workspaceId } },
      select: {
        locationId: true,
        skillId: true,
        skill: { select: { name: true } },
      },
    }),
  ]);

  const minHourlyWageCents = workspace?.minHourlyWageCents ?? 1390;
  const minWage = minHourlyWageCents / 100;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // location → required [{skillId, name}]
  const reqByLocation = new Map<string, { skillId: string; name: string }[]>();
  for (const r of locationReq) {
    const arr = reqByLocation.get(r.locationId) ?? [];
    arr.push({ skillId: r.skillId, name: r.skill.name });
    reqByLocation.set(r.locationId, arr);
  }
  // employee → skillId → { expiresAt, documentUrl }
  const skillsByEmployee = new Map<
    string,
    Map<string, { expiresAt: Date | null; documentUrl: string | null }>
  >();
  for (const e of employees) {
    skillsByEmployee.set(
      e.id,
      new Map(
        e.employeeSkills.map((s) => [
          s.skillId,
          { expiresAt: s.expiresAt, documentUrl: s.documentUrl },
        ]),
      ),
    );
  }

  const findings: Finding[] = [];
  const counts: Record<
    CategoryKey,
    { items: number; warn: number; fail: number }
  > = {
    ARBZG_3: { items: 0, warn: 0, fail: 0 },
    ARBZG_4: { items: 0, warn: 0, fail: 0 },
    ARBZG_5: { items: 0, warn: 0, fail: 0 },
    SACHKUNDE_34A: { items: 0, warn: 0, fail: 0 },
    MILOG: { items: 0, warn: 0, fail: 0 },
  };

  const empName = (e?: { firstName: string; lastName: string } | null) =>
    e ? `${e.firstName} ${e.lastName}` : "—";

  // ── Per-shift checks: ArbZG §3, §4, §34a ──
  for (const s of shifts) {
    const gross = shiftGrossMinutes(s.startTime, s.endTime);
    const net = gross - (s.breakMinutes ?? 0);
    const dateStr = isoDate(new Date(s.date));

    // §4 break
    counts.ARBZG_4.items++;
    const requiredBreak = requiredBreakForNet(net);
    if ((s.breakMinutes ?? 0) < requiredBreak) {
      counts.ARBZG_4.fail++;
      findings.push({
        category: "ARBZG_4",
        severity: "FAIL",
        code: "BREAK_TOO_SHORT",
        employeeId: s.employeeId ?? undefined,
        employeeName: empName(s.employee),
        date: dateStr,
        locationName: s.location?.name,
        values: { planned: s.breakMinutes ?? 0, required: requiredBreak },
      });
    }

    // §3 max 10h working time
    counts.ARBZG_3.items++;
    if (net > ARBZG_3_MAX_NET) {
      counts.ARBZG_3.fail++;
      findings.push({
        category: "ARBZG_3",
        severity: "FAIL",
        code: "OVER_MAX_HOURS",
        employeeId: s.employeeId ?? undefined,
        employeeName: empName(s.employee),
        date: dateStr,
        locationName: s.location?.name,
        values: { netHours: (net / 60).toFixed(2) },
      });
    }

    // §34a certifications (only when assigned + location requires skills)
    if (s.employeeId && s.locationId) {
      const required = reqByLocation.get(s.locationId);
      if (required && required.length > 0) {
        const held = skillsByEmployee.get(s.employeeId);
        for (const req of required) {
          counts.SACHKUNDE_34A.items++;
          const cert = held?.get(req.skillId);
          if (!cert) {
            counts.SACHKUNDE_34A.fail++;
            findings.push({
              category: "SACHKUNDE_34A",
              severity: "FAIL",
              code: "CERT_MISSING",
              employeeId: s.employeeId,
              employeeName: empName(s.employee),
              date: dateStr,
              locationName: s.location?.name,
              values: { skill: req.name },
            });
            continue;
          }
          const expired = cert.expiresAt && new Date(cert.expiresAt) < today;
          if (expired) {
            counts.SACHKUNDE_34A.fail++;
            findings.push({
              category: "SACHKUNDE_34A",
              severity: "FAIL",
              code: "CERT_EXPIRED",
              employeeId: s.employeeId,
              employeeName: empName(s.employee),
              date: dateStr,
              locationName: s.location?.name,
              values: {
                skill: req.name,
                expiredAt: isoDate(new Date(cert.expiresAt!)),
              },
            });
            continue;
          }
          // valid — but warn on missing document or near expiry
          const expSoon =
            cert.expiresAt &&
            new Date(cert.expiresAt).getTime() - today.getTime() <
              CERT_EXPIRY_WARN_DAYS * DAY_MS;
          if (!cert.documentUrl) {
            counts.SACHKUNDE_34A.warn++;
            findings.push({
              category: "SACHKUNDE_34A",
              severity: "WARN",
              code: "CERT_NO_DOCUMENT",
              employeeId: s.employeeId,
              employeeName: empName(s.employee),
              locationName: s.location?.name,
              values: { skill: req.name },
            });
          } else if (expSoon) {
            counts.SACHKUNDE_34A.warn++;
            findings.push({
              category: "SACHKUNDE_34A",
              severity: "WARN",
              code: "CERT_EXPIRING",
              employeeId: s.employeeId,
              employeeName: empName(s.employee),
              locationName: s.location?.name,
              values: {
                skill: req.name,
                expiresAt: isoDate(new Date(cert.expiresAt!)),
              },
            });
          }
        }
      }
    }
  }

  // ── ArbZG §5 rest (per employee, consecutive shift gaps) ──
  const byEmployee = new Map<string, typeof shifts>();
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const arr = byEmployee.get(s.employeeId) ?? [];
    arr.push(s);
    byEmployee.set(s.employeeId, arr);
  }
  for (const [, empShifts] of byEmployee) {
    const sorted = [...empShifts].sort(
      (a, b) =>
        resolveShiftEnd(new Date(a.date), a.startTime, a.endTime).getTime() -
        resolveShiftEnd(new Date(b.date), b.startTime, b.endTime).getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevEnd = resolveShiftEnd(
        new Date(prev.date),
        prev.startTime,
        prev.endTime,
      );
      const curStart = toDateTime(new Date(cur.date), cur.startTime);
      if (curStart <= prevEnd) continue; // overlap handled by conflict checks
      counts.ARBZG_5.items++;
      const gapH = (curStart.getTime() - prevEnd.getTime()) / 3_600_000;
      if (gapH < ARBZG_REST_HOURS) {
        counts.ARBZG_5.fail++;
        findings.push({
          category: "ARBZG_5",
          severity: "FAIL",
          code: "REST_TOO_SHORT",
          employeeId: cur.employeeId ?? undefined,
          employeeName: empName(cur.employee),
          date: isoDate(new Date(cur.date)),
          values: { gapHours: gapH.toFixed(1), required: ARBZG_REST_HOURS },
        });
      }
    }
  }

  // ── MiLoG minimum wage (all active employees) ──
  for (const e of employees) {
    counts.MILOG.items++;
    if (e.hourlyRate == null) {
      counts.MILOG.warn++;
      findings.push({
        category: "MILOG",
        severity: "WARN",
        code: "WAGE_UNDOCUMENTED",
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
      });
    } else if (e.hourlyRate < minWage) {
      counts.MILOG.fail++;
      findings.push({
        category: "MILOG",
        severity: "FAIL",
        code: "WAGE_BELOW_MIN",
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        values: { rate: e.hourlyRate.toFixed(2), min: minWage.toFixed(2) },
      });
    }
  }

  // ── Per-employee working-time summary ──
  const summaryMap = new Map<
    string,
    {
      name: string;
      shiftCount: number;
      plannedMinutes: number;
      hourlyRate: number | null;
    }
  >();
  const rateById = new Map(employees.map((e) => [e.id, e.hourlyRate]));
  for (const s of shifts) {
    if (!s.employeeId) continue;
    const net =
      shiftGrossMinutes(s.startTime, s.endTime) - (s.breakMinutes ?? 0);
    const cur = summaryMap.get(s.employeeId) ?? {
      name: empName(s.employee),
      shiftCount: 0,
      plannedMinutes: 0,
      hourlyRate: rateById.get(s.employeeId) ?? null,
    };
    cur.shiftCount++;
    cur.plannedMinutes += net;
    summaryMap.set(s.employeeId, cur);
  }
  const employeeSummaries = [...summaryMap.entries()]
    .map(([employeeId, v]) => ({ employeeId, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Score ──
  const categories: CategorySummary[] = (
    Object.keys(counts) as CategoryKey[]
  ).map((category) => {
    const c = counts[category];
    return {
      category,
      items: c.items,
      pass: c.items - c.warn - c.fail,
      warn: c.warn,
      fail: c.fail,
    };
  });
  const totalItems = categories.reduce((s, c) => s + c.items, 0);
  const totalWarn = categories.reduce((s, c) => s + c.warn, 0);
  const totalFail = categories.reduce((s, c) => s + c.fail, 0);
  const totalPass = totalItems - totalWarn - totalFail;
  const score =
    totalItems === 0
      ? 100
      : Math.round((100 * (totalPass + 0.5 * totalWarn)) / totalItems);

  // Worst findings first.
  findings.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "FAIL" ? -1 : 1,
  );

  return {
    periodStart: from,
    periodEnd: to,
    minHourlyWageCents,
    score,
    totals: {
      items: totalItems,
      pass: totalPass,
      warn: totalWarn,
      fail: totalFail,
    },
    categories,
    findings,
    employeeSummaries,
    generatedAt: new Date().toISOString(),
  };
}
