/* ═══════════════════════════════════════════════════════════════
   Workspace-scope backstop — defense-in-depth tenant isolation
   ═══════════════════════════════════════════════════════════════
   Production tenant isolation is enforced at the application layer
   (`where: { workspaceId }` on every query) and lint-checked in CI
   (`npm run lint:scope`). RLS is inert behind the Supavisor
   service_role pooler, so there is no database backstop.

   This module adds a SECOND, runtime guard: an AsyncLocalStorage
   context carries the authenticated request's workspaceId, and a
   Prisma client extension (`scopeExtension`) automatically injects
   `workspaceId` into the `where` clause of bulk/read operations on
   workspace-scoped models. A developer who forgets the manual filter
   is now caught at runtime instead of leaking cross-tenant rows.

   Industry pattern: ALS request context + Prisma `$extends` query
   component (the supported mechanism in Prisma 7 — `$use` middleware
   was removed in Prisma 5).

   Escape hatches for legitimately cross-workspace code
   (cron, Stripe webhooks, super-admin, auth): they never enter a
   workspace scope, so nothing is injected. Use `runUnscoped()` to
   explicitly drop scope inside a request if ever needed.
   ═══════════════════════════════════════════════════════════════ */

import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";

interface ScopeStore {
  /** null = explicitly unscoped (cross-workspace allowed). */
  workspaceId: string | null;
}

const storage = new AsyncLocalStorage<ScopeStore>();

/**
 * Bind the current async execution to a workspace for the remainder of
 * the request. Called by `requireAuth` once the workspace is resolved.
 * Uses `enterWith` so the scope persists across subsequent awaits in the
 * same request without wrapping the whole handler.
 */
export function enterWorkspaceScope(workspaceId: string): void {
  storage.enterWith({ workspaceId });
}

/** Run `fn` bound to a workspace scope (callback form). */
export function runWithWorkspaceScope<T>(workspaceId: string, fn: () => T): T {
  return storage.run({ workspaceId }, fn);
}

/**
 * Run `fn` with scope explicitly disabled — for code paths inside a
 * request that legitimately need cross-workspace access.
 */
export function runUnscoped<T>(fn: () => T): T {
  return storage.run({ workspaceId: null }, fn);
}

/** Current workspace scope, or null if none/unscoped. */
export function currentWorkspaceScope(): string | null {
  return storage.getStore()?.workspaceId ?? null;
}

/**
 * Models that carry a `workspaceId` column and are therefore tenant-scoped.
 * SINGLE SOURCE OF TRUTH is prisma/schema.prisma — this list is verified
 * against the schema by src/__tests__/lib/workspace-scope.test.ts, which
 * fails CI if they ever drift.
 */
export const SCOPED_MODELS: ReadonlySet<string> = new Set([
  "AbsenceRequest",
  "AuditDossier",
  "AuditLog",
  "AutoFillLog",
  "AutoScheduleRun",
  "AutomationRule",
  "AutomationSetting",
  "Availability",
  "BetriebsratMember",
  "Client",
  "CustomRole",
  "DATEVToken",
  "DatevOAuthState",
  "Department",
  "ESignature",
  "EauRequest",
  "Employee",
  "ExportJob",
  "Feedback",
  "ICalToken",
  "Invitation",
  "Invoice",
  "InvoiceSequence",
  "Location",
  "ManagerAlert",
  "MonthClose",
  "Notification",
  "OutlookOAuthState",
  "Project",
  "ServiceReport",
  "ServiceVisit",
  "ServiceVisitAuditLog",
  "Shift",
  "ShiftChangeRequest",
  "ShiftPlanApproval",
  "ShiftSwapRequest",
  "ShiftTemplate",
  "Skill",
  "SosRequest",
  "StaffingRequirement",
  "StationSession",
  "Subscription",
  "SvSubmission",
  "Ticket",
  "TicketAttachment",
  "TicketCategoryDef",
  "TimeAccount",
  "TimeEntry",
  "User",
  "UserTask",
  "VacationBalance",
  "WebhookEndpoint",
  "WebhookFailure",
  "WorkspaceCustomer",
  "WorkspaceUsage",
]);

/**
 * Operations whose results/effects span multiple rows. A missing filter
 * here leaks or mutates across tenants, so these get the injected scope.
 *
 * Deliberately excluded (matching the CI scope guard's rationale):
 *   - findUnique/findUniqueOrThrow — by-unique-key lookups (tokens etc.)
 *   - create/createMany/upsert    — scope lives in `data`, not `where`
 *   - delete/update (singular)    — target a unique key via `where`
 */
export const SCOPED_OPS: ReadonlySet<string> = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "updateMany",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

type WhereInput = Record<string, unknown> | undefined;

/** True if this model+operation pair should receive the injected scope. */
export function shouldScope(model: string, operation: string): boolean {
  return SCOPED_MODELS.has(model) && SCOPED_OPS.has(operation);
}

/** AND the workspace filter onto an existing where clause without widening it. */
export function injectWorkspace(
  where: WhereInput,
  workspaceId: string,
): WhereInput {
  // Always AND so an existing (possibly redundant) workspaceId stays intact and
  // a forgotten one is added. AND of [{workspaceId}, existing] never widens.
  return { AND: [{ workspaceId }, where ?? {}] };
}

/**
 * Prisma client extension applying the workspace-scope backstop.
 * Apply with `prisma.$extends(scopeExtension)`.
 *
 * Typed loosely on purpose: the `$allModels`/`$allOperations` query
 * component is part of the stable Prisma client-extensions API, but its
 * generic argument shape is awkward to spell out without the generated
 * client types here. The runtime contract (model, operation, args, query)
 * is stable and exercised by the unit test.
 */
export const scopeExtension = Prisma.defineExtension({
  name: "workspace-scope-backstop",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const workspaceId = storage.getStore()?.workspaceId ?? null;
        if (workspaceId && shouldScope(model, operation)) {
          const a = args as { where?: WhereInput } & Record<string, unknown>;
          return query({
            ...a,
            where: injectWorkspace(a.where, workspaceId),
          });
        }
        return query(args);
      },
    },
  },
});
