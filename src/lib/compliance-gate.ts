/**
 * The universal compliance gate.
 *
 * Every path that creates or reassigns a shift must go through here. Before
 * this existed, the ArbZG and §34a hard blocks lived inline in the two
 * /api/shifts routes only, so three other paths wrote shifts with no checks at
 * all: timesheet-import approval, auto-fill, and SOS acceptance. A guarantee
 * that holds on some write paths is not a guarantee, which is the whole point
 * of a compliance product.
 *
 * Checks run here:
 *   §34a GewO + Bewacherregister  → certification-check.ts
 *   ArbZG §3  max 10h/day         → arbzg.ts (whole-day aggregate)
 *   ArbZG §4  mandatory break     → arbzg.ts (pure)
 *   ArbZG §5  11h rest period     → arbzg.ts
 *
 * A block can be released, but never silently: an override requires a
 * management role and a written reason, and is recorded in ComplianceOverride
 * so an FKS auditor can see who released what and why.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isManagement } from "@/lib/authorization";
import type { SessionUser } from "@/lib/types";
import { log } from "@/lib/logger";
import {
  checkArbZg3MaxDaily,
  checkArbZg4BreakRequirement,
  checkArbZg5RestPeriod,
  shiftGrossMinutes,
} from "@/lib/arbzg";
import {
  checkLocationCertifications,
  describeCertViolations,
} from "@/lib/certification-check";

/** Mirrors the ComplianceRule enum in the Prisma schema. */
export type ComplianceRuleKey =
  | "ARBZG_3"
  | "ARBZG_4"
  | "ARBZG_5"
  | "SACHKUNDE_34A"
  | "GEOFENCE";

export interface ComplianceViolation {
  rule: ComplianceRuleKey;
  /** Stable machine code, e.g. ARBZG_3_OVER_DAILY_MAX. */
  code: string;
  message: string;
  messageEn: string;
  /** Structured detail for the UI (numbers, skill names, register status). */
  details?: Record<string, unknown>;
}

export interface ShiftComplianceInput {
  employeeId: string | null | undefined;
  locationId: string | null | undefined;
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:MM". */
  startTime: string;
  /** "HH:MM". */
  endTime: string;
  breakMinutes?: number;
  /** Set when editing, so the shift under edit is excluded from aggregates. */
  excludeShiftId?: string;
}

export interface BypassFlags {
  /** Which blocks the dispatcher is consciously releasing. */
  rules: ComplianceRuleKey[];
  /** Mandatory written justification. Recorded verbatim. */
  reason: string;
  /** The acting user — must hold a management role. */
  user: SessionUser;
}

/** An override that is ready to persist once the entity id is known. */
export interface PendingOverride {
  rule: ComplianceRuleKey;
  reason: string;
  overriddenBy: string;
  workspaceId: string;
}

export interface ComplianceResult {
  /** Violations that were raised and then consciously released. */
  overridden: ComplianceViolation[];
  /**
   * Overrides awaiting persistence. Populated only when the gate could not
   * write them itself because the shift did not exist yet — persist with
   * `recordComplianceOverrides` inside the creating transaction.
   */
  pendingOverrides: PendingOverride[];
}

/** Minimal shape shared by PrismaClient and an interactive transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Thrown when a shift breaches a rule that was not (or could not be) released.
 * Routes convert it with `toResponse()`; library callers can read `violations`.
 */
export class ComplianceError extends Error {
  readonly violations: ComplianceViolation[];
  readonly status = 422 as const;

  constructor(violations: ComplianceViolation[]) {
    super(
      `Shift blocked by ${violations.length} compliance violation(s): ` +
        violations.map((v) => v.code).join(", "),
    );
    this.name = "ComplianceError";
    this.violations = violations;
  }

  /** 422 Unprocessable Entity with the full structured violation array. */
  toResponse(): Response {
    return Response.json(
      {
        error: "COMPLIANCE_VIOLATION",
        message: this.violations.map((v) => v.message).join(" "),
        messageEn: this.violations.map((v) => v.messageEn).join(" "),
        violations: this.violations,
      },
      { status: this.status },
    );
  }
}

export function isComplianceError(e: unknown): e is ComplianceError {
  return e instanceof ComplianceError;
}

/**
 * Run every compliance check and return the violations found.
 *
 * Non-throwing. Use this where partial failure is the desired behaviour — the
 * bulk shift creator skips offending days and reports them rather than
 * aborting the whole range.
 */
export async function evaluateShiftCompliance(
  shiftData: ShiftComplianceInput,
  workspaceId: string,
): Promise<ComplianceViolation[]> {
  const {
    employeeId,
    locationId,
    date,
    startTime,
    endTime,
    breakMinutes = 0,
    excludeShiftId,
  } = shiftData;

  const violations: ComplianceViolation[] = [];

  // ── ArbZG §4 — mandatory break. Pure, and applies to unassigned shifts too.
  const break4 = checkArbZg4BreakRequirement(startTime, endTime, breakMinutes);
  if (break4.violation) {
    violations.push({
      rule: "ARBZG_4",
      code: "ARBZG_4_BREAK_TOO_SHORT",
      message: break4.message!,
      messageEn: break4.messageEn!,
      details: {
        plannedBreakMinutes: breakMinutes,
        minBreakMinutes: break4.minBreakMinutes,
        netMinutes: break4.netMinutes,
      },
    });
  }

  // The remaining checks are all per-employee; an OPEN shift has nobody to
  // check against, so they only run once the shift is assigned.
  if (!employeeId) return violations;

  const plannedNetMinutes = Math.max(
    0,
    shiftGrossMinutes(startTime, endTime) - breakMinutes,
  );

  const [certViolations, arbzg3, arbzg5] = await Promise.all([
    checkLocationCertifications(employeeId, locationId, workspaceId),
    checkArbZg3MaxDaily(employeeId, date, plannedNetMinutes, {
      workspaceId,
      excludeShiftId,
    }),
    checkArbZg5RestPeriod({
      employeeId,
      date,
      startTime,
      endTime,
      workspaceId,
      excludeShiftId,
    }),
  ]);

  if (certViolations.length > 0) {
    const summary = describeCertViolations(certViolations);
    violations.push({
      rule: "SACHKUNDE_34A",
      code: "CERTIFICATION_REQUIRED",
      message: `§34a GewO: Mitarbeiter darf nicht eingeplant werden — ${summary}.`,
      messageEn: `§34a GewO: employee may not be scheduled — ${summary}.`,
      details: { violations: certViolations },
    });
  }

  if (arbzg3.violation) {
    violations.push({
      rule: "ARBZG_3",
      code: "ARBZG_3_OVER_DAILY_MAX",
      message: arbzg3.message!,
      messageEn: arbzg3.messageEn!,
      details: {
        existingMinutes: arbzg3.existingMinutes,
        totalMinutes: arbzg3.totalMinutes,
        maxMinutes: arbzg3.maxMinutes,
      },
    });
  }

  if (arbzg5.violation) {
    violations.push({
      rule: "ARBZG_5",
      code: "ARBZG_5_INSUFFICIENT_REST",
      message: arbzg5.message!,
      messageEn: arbzg5.messageEn!,
    });
  }

  return violations;
}

/**
 * Assert that a shift may be written, throwing `ComplianceError` if not.
 *
 * When `bypassFlags` is supplied, violations whose rule appears in
 * `bypassFlags.rules` are released instead of thrown, provided the acting user
 * holds a management role and gave a reason. Anything not listed still blocks:
 * a dispatcher cannot release §34a by claiming to release §4.
 *
 * Overrides are written immediately when the target shift already exists
 * (`excludeShiftId`). On creation the id does not exist yet, so they come back
 * as `pendingOverrides` for the caller to persist with
 * `recordComplianceOverrides` inside the same transaction as the insert.
 */
export async function assertShiftCompliance(
  shiftData: ShiftComplianceInput,
  workspaceId: string,
  bypassFlags?: BypassFlags,
): Promise<ComplianceResult> {
  const violations = await evaluateShiftCompliance(shiftData, workspaceId);

  if (violations.length === 0) {
    return { overridden: [], pendingOverrides: [] };
  }

  // No bypass requested → everything blocks.
  if (!bypassFlags || bypassFlags.rules.length === 0) {
    throw new ComplianceError(violations);
  }

  // An override is a privileged act. A non-management user requesting one is
  // treated as no bypass at all, so the block stands rather than silently
  // degrading to "allowed".
  if (!isManagement(bypassFlags.user)) {
    log.warn("compliance-gate: override refused, insufficient role", {
      userId: bypassFlags.user.id,
      role: bypassFlags.user.role,
      workspaceId,
      rules: bypassFlags.rules,
    });
    throw new ComplianceError(violations);
  }

  const reason = bypassFlags.reason?.trim();
  if (!reason) {
    log.warn("compliance-gate: override refused, no reason given", {
      userId: bypassFlags.user.id,
      workspaceId,
    });
    throw new ComplianceError(violations);
  }

  const releasable = new Set(bypassFlags.rules);
  const overridden = violations.filter((v) => releasable.has(v.rule));
  const remaining = violations.filter((v) => !releasable.has(v.rule));

  if (remaining.length > 0) {
    throw new ComplianceError(remaining);
  }

  const pendingOverrides: PendingOverride[] = overridden.map((v) => ({
    rule: v.rule,
    reason,
    overriddenBy: bypassFlags.user.id,
    workspaceId,
  }));

  // Editing an existing shift: the entity id is known, so record now.
  if (shiftData.excludeShiftId) {
    await recordComplianceOverrides(
      prisma,
      "Shift",
      shiftData.excludeShiftId,
      pendingOverrides,
    );
    return { overridden, pendingOverrides: [] };
  }

  return { overridden, pendingOverrides };
}

/**
 * Persist pending overrides against a now-known entity.
 *
 * Pass the transaction client from the shift insert so the override and the
 * shift it justifies commit together — an override without its shift, or a
 * shift without its override, would both misrepresent the audit trail.
 */
export async function recordComplianceOverrides(
  db: Db,
  entityType: string,
  entityId: string,
  overrides: PendingOverride[],
): Promise<void> {
  if (overrides.length === 0) return;

  await db.complianceOverride.createMany({
    data: overrides.map((o) => ({
      rule: o.rule,
      entityType,
      entityId,
      reason: o.reason,
      overriddenBy: o.overriddenBy,
      workspaceId: o.workspaceId,
    })),
  });

  log.warn("compliance-gate: hard block overridden", {
    entityType,
    entityId,
    rules: overrides.map((o) => o.rule),
    overriddenBy: overrides[0].overriddenBy,
    workspaceId: overrides[0].workspaceId,
  });
}
