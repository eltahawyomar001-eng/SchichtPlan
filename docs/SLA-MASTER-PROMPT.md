# Shiftfy — SLA 99.9 Master Prompt

> **Purpose:** A single prompt you paste into a new Copilot conversation to execute all code-level improvements that raise the SLA Readiness Score from 74/100 → ≥99/100.
>
> **Prerequisite:** The operator must separately (outside code) handle items marked 🔧 MANUAL — these are dashboard configs, third-party sign-ups, and document-only tasks.
>
> **Estimated sessions:** 8–12 Copilot sessions (split by section below).

---

## Instructions for the AI Agent

You are working on **Shiftfy (SchichtPlan)** — a German-market SaaS for shift planning, time tracking, and workforce management. Read `.github/copilot-instructions.md` for full architecture context.

Your mission: execute every code change below to close **every gap** identified in `docs/SLA-AUDIT.md`. The current SLA Readiness Score is 74/100. After completing all items, the target is ≥99/100.

### Global Rules

1. **Never commit.** All changes stay uncommitted — we push everything together at the end.
2. **Follow the existing API route pattern** from `.github/copilot-instructions.md` exactly (requireAuth, requirePermission, validateBody, log, captureRouteError, serverError, try/catch).
3. **Use German enum values** as they exist in `prisma/schema.prisma`.
4. **i18n:** Any user-facing string must have entries in both `messages/de.json` and `messages/en.json`.
5. **Tests:** For every new utility (`src/lib/*`), write a unit test in `src/__tests__/lib/`.
6. **Dark mode:** Any new UI must support dark mode (class-based, `dark:` prefix).
7. **Prisma migrations:** Use Supabase MCP tools, never `npx prisma migrate dev`.
8. **Run tests** after each section to confirm nothing breaks: `npx vitest run --reporter=verbose`.

---

## SECTION 1 — `withRoute()` Higher-Order Function (Closes: M3, R5, partial A1)

**Goal:** Create a wrapper that every API route handler uses, eliminating the need to manually add try/catch, captureRouteError, log.error, and serverError in each route.

### 1A. Create `src/lib/with-route.ts`

Create a higher-order function `withRoute(routePath, handler)` that:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { captureRouteError } from "@/lib/sentry";
import { log } from "@/lib/logger";
import { serverError } from "@/lib/api-response";

type RouteHandler = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

export function withRoute(
  routePath: string,
  method: string,
  handler: RouteHandler,
): RouteHandler {
  return async (req, context) => {
    const start = Date.now();
    try {
      const response = await handler(req, context);
      // Optionally log slow requests
      const duration = Date.now() - start;
      if (duration > 5000) {
        log.warn(`Slow route: ${routePath} ${method} took ${duration}ms`);
      }
      return response;
    } catch (error) {
      log.error(`${routePath} ${method} failed`, { error });
      captureRouteError(error, { route: routePath, method });
      return serverError();
    }
  };
}
```

### 1B. Write unit test `src/__tests__/lib/with-route.test.ts`

Test:

- Happy path passes response through
- Thrown error is caught, logged, sent to Sentry, returns 500
- Slow request (>5s) produces a warning log

### 1C. Migrate ALL 135 route files to use `withRoute()`

For every file in `src/app/api/**/route.ts`:

1. Import `withRoute` from `@/lib/with-route`
2. Wrap each exported handler: `export const GET = withRoute("/api/employees", "GET", async (req) => { ... })`
3. Remove the manual try/catch + captureRouteError + log.error + serverError() at the bottom of each handler (the wrapper now handles it)
4. Keep the business logic inside the handler body intact
5. **Do NOT remove** `requireAuth()`, `requirePermission()`, `validateBody()`, `createAuditLog()`, `dispatchWebhook()`, or `checkIdempotency()` — only the catch-block boilerplate

**Process each route group in order:**

- `src/app/api/employees/**` (3 route files)
- `src/app/api/shifts/**` (6 route files)
- `src/app/api/time-entries/**` (5 route files)
- `src/app/api/absences/**` (2 route files)
- `src/app/api/chat/**` (8 route files)
- `src/app/api/tickets/**` (7 route files)
- `src/app/api/billing/**` (3 route files)
- `src/app/api/admin/**` (3 route files)
- `src/app/api/automations/**` (4 route files)
- `src/app/api/export/**` (3 route files)
- All remaining routes (alphabetically)

After this section: `captureRouteError` coverage goes from 29/135 → 135/135 (100%). `log.error` goes from 118/135 → 135/135 (100%).

---

## SECTION 2 — Migrate All Routes to `requireAuth()` (Closes: R5)

**Goal:** Replace every instance of the 6-line raw `getServerSession` boilerplate with the 3-line `requireAuth()` guard.

For each of the ~96 routes that still use raw `getServerSession`:

**Find this pattern:**

```typescript
import { getServerSession } from "next-auth";
// ...
const session = await getServerSession(authOptions);
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const user = session.user as SessionUser;
const workspaceId = user.workspaceId;
```

**Replace with:**

```typescript
import { requireAuth } from "@/lib/api-response";
// ...
const auth = await requireAuth();
if (!auth.ok) return auth.response;
const { user, workspaceId } = auth;
```

- Remove the `import { getServerSession } from "next-auth"` and `import { authOptions } from "@/lib/auth"` lines if no longer used
- Remove `import { NextResponse } from "next/server"` if no longer used (check if other code in the file still needs it)
- Handle edge cases: some routes destructure `session.user.email` or `session.user.id` — ensure `auth.user` provides the same fields

After this section: `requireAuth()` adoption goes from 21/135 → 118/135 (all authenticated routes). The 17 public routes (auth/_, health, billing/webhook, tickets/external/_, holidays/bundeslaender) correctly skip auth.

---

## SECTION 3 — Zod Validation for All Mutation Routes (Closes: R2, S3)

**Goal:** Add Zod schemas and `validateBody()` to every remaining POST/PATCH/PUT/DELETE route that accepts a JSON body.

### 3A. Audit and create schemas in `src/lib/validations.ts`

For each route that uses raw `const { field1, field2 } = await req.json()` instead of `validateBody()`:

1. Read the route to understand what fields it expects
2. Create a Zod schema in `src/lib/validations.ts` following existing conventions:
   - Schema names: `createXSchema`, `updateXSchema`
   - Use `.min()`, `.max()`, `.regex()` for German-formatted validation messages (`"Pflichtfeld"`, `"Maximal X Zeichen"`)
   - Include `.optional()` for PATCH fields
3. Replace `const { ... } = await req.json()` with:
   ```typescript
   const body = await req.json();
   const parsed = validateBody(schemaName, body);
   if (!parsed.success) return parsed.response;
   const { field1, field2 } = parsed.data;
   ```

**Routes needing schemas (by priority — payroll-critical first):**

1. `api/time-entries/clock/route.ts` — `clockActionSchema` (`action`, `timezone`, `note`)
2. `api/month-close/route.ts` — `monthCloseActionSchema` (`year`, `month`, `action`)
3. `api/shift-templates/route.ts` — `createShiftTemplateSchema`, `updateShiftTemplateSchema`
4. `api/departments/route.ts` — `createDepartmentSchema`
5. `api/departments/[id]/route.ts` — `updateDepartmentSchema`
6. `api/skills/route.ts` — `createSkillSchema`
7. `api/clients/route.ts` — `createClientSchema`
8. `api/clients/[id]/route.ts` — `updateClientSchema`
9. `api/projects/route.ts` — `createProjectSchema`
10. `api/projects/[id]/route.ts` — `updateProjectSchema`
11. `api/chat/channels/route.ts` — `createChannelSchema`
12. `api/chat/channels/[id]/messages/route.ts` — `createMessageSchema`
13. `api/chat/channels/[id]/members/route.ts` — `channelMemberSchema`
14. `api/chat/channels/[id]/messages/[msgId]/reactions/route.ts` — `reactionSchema`
15. `api/shift-change-requests/route.ts` — `createShiftChangeRequestSchema`
16. `api/shift-change-requests/[id]/route.ts` — `updateShiftChangeRequestSchema`
17. `api/manager-alerts/[id]/route.ts` — `updateManagerAlertSchema`
18. `api/vacation-balances/route.ts` — `updateVacationBalanceSchema`
19. `api/vacation-balances/[id]/route.ts` — same
20. `api/webhooks/route.ts` — `createWebhookSchema`
21. `api/webhooks/[id]/route.ts` — `updateWebhookSchema`
22. `api/notification-preferences/route.ts` — `updateNotificationPreferencesSchema`
23. `api/push-subscriptions/route.ts` — `pushSubscriptionSchema`
24. `api/custom-roles/route.ts` — `createCustomRoleSchema`
25. `api/custom-roles/[id]/route.ts` — `updateCustomRoleSchema`
26. `api/automation-rules/route.ts` — `createAutomationRuleSchema`
27. `api/automation-rules/[id]/route.ts` — `updateAutomationRuleSchema`
28. `api/staffing-requirements/route.ts` — `createStaffingRequirementSchema`
29. `api/staffing-requirements/[id]/route.ts` — `updateStaffingRequirementSchema`
30. All remaining routes discovered during migration

### 3B. Write tests for new Zod schemas

Add tests in `src/__tests__/lib/validations-new.test.ts`:

- Valid input passes
- Missing required fields return appropriate German error messages
- Edge cases (empty strings, oversized inputs, invalid formats)

After this section: `validateBody()` adoption goes from 64/135 → 135/135 (all routes with body parsing). XSS sanitization coverage = 100%.

---

## SECTION 4 — Idempotency Middleware for All POST Routes (Closes: R1)

**Goal:** Extend the existing `checkIdempotency()` / `cacheIdempotentResponse()` from `src/lib/idempotency.ts` to all POST mutation routes.

### 4A. Make idempotency opt-in via `withRoute()` enhancement

Update `withRoute()` to accept an options object:

```typescript
export function withRoute(
  routePath: string,
  method: string,
  handler: RouteHandler,
  options?: { idempotent?: boolean },
): RouteHandler;
```

When `options.idempotent` is true and method is POST:

1. Call `checkIdempotency(req)` — if cached response exists, return it
2. Run handler
3. Call `cacheIdempotentResponse(req, response)`

### 4B. Add `idempotent: true` to all POST route exports

For every POST handler that mutates data:

```typescript
export const POST = withRoute(
  "/api/employees",
  "POST",
  async (req) => {
    // ...
  },
  { idempotent: true },
);
```

**Exclude from idempotency:**

- `api/auth/*` (login/register — session-based, not idempotent)
- `api/billing/webhook` (has its own Stripe-level idempotency)
- `api/health` (GET only)
- `api/time-entries/clock` (clock in/out is inherently sequential — use transaction lock instead)

### 4C. Add in-memory fallback to `src/lib/idempotency.ts` (Closes: A6 partial)

Update `idempotency.ts` to use an LRU Map when Redis is unavailable:

```typescript
const memoryCache = new Map<string, { response: string; timestamp: number }>();
const MAX_MEMORY_CACHE = 1000;
```

### 4D. Write tests in `src/__tests__/lib/idempotency.test.ts`

After this section: Idempotency coverage goes from 2/135 → all POST mutation routes.

---

## SECTION 5 — Pagination for All List Endpoints (Closes: P2)

**Goal:** Add `parsePagination()` + `paginatedResponse()` to every GET endpoint that returns a list.

For each GET route that calls `prisma.*.findMany()` without pagination:

1. Import `parsePagination`, `paginatedResponse` from `@/lib/pagination`
2. Add `const { take, skip } = parsePagination(req);` near the top
3. Add `const total = await prisma.*.count({ where });` before the findMany
4. Add `take, skip` to the findMany options
5. Return `paginatedResponse(items, total, take, skip)` instead of raw `apiSuccess(items)`

**Priority routes (high-cardinality data):**

1. `api/chat/channels/[id]/messages/route.ts`
2. `api/notifications/route.ts`
3. `api/audit-logs/route.ts`
4. `api/annual-planning/route.ts`
5. `api/shift-swaps/route.ts`
6. `api/shift-change-requests/route.ts`
7. `api/service-visits/route.ts`
8. `api/service-reports/route.ts`
9. All remaining GET list routes

For small-cardinality endpoints (departments, locations, skills — typically <50 records per workspace), add a `take: 200` safety cap even without full pagination.

After this section: Pagination goes from 20/135 → all GET list routes.

---

## SECTION 6 — Audit Logging for All Write Operations (Closes: partial Low finding)

**Goal:** Add `createAuditLog()` (fire-and-forget) or `createAuditLogTx()` (inside transactions) to every POST/PATCH/PUT/DELETE route that modifies data.

For each write route currently missing audit logging:

1. Import `createAuditLog` from `@/lib/audit` (or `createAuditLogTx` if inside a `$transaction`)
2. After the successful mutation, add:
   ```typescript
   createAuditLog({
     workspaceId,
     performedBy: user.id,
     action: "RESOURCE_CREATED", // or UPDATED, DELETED, etc.
     targetType: "ResourceType",
     targetId: resource.id,
     details: {
       /* relevant changed fields */
     },
   });
   ```
3. For routes with `$transaction`, use `createAuditLogTx(tx, { ... })` inside the transaction

**Priority order:**

1. `api/time-entries/**` — payroll-relevant
2. `api/absences/**` — leave balance changes
3. `api/month-close/**` — financial lock
4. `api/billing/**` — subscription changes
5. `api/workspace/**` — settings changes
6. `api/departments/**`, `api/locations/**`, `api/skills/**`
7. `api/chat/**` — channel creation/deletion only (not individual messages)
8. `api/shift-swaps/**`, `api/shift-change-requests/**`
9. All remaining write routes

After this section: Audit logging goes from 24/135 → all write operations.

---

## SECTION 7 — Webhook Dispatch for All Mutations (Closes: partial webhook gap)

**Goal:** Add `dispatchWebhook()` to all write operations so workspace integrations receive events.

For each POST/PATCH/DELETE route:

1. Import `dispatchWebhook` from `@/lib/webhooks`
2. After successful mutation (OUTSIDE any `$transaction`), add:
   ```typescript
   dispatchWebhook(workspaceId, "resource.action", {
     id: resource.id,
     // ... relevant fields
   }).catch(() => {}); // fire and forget
   ```

**Event naming convention:** `resource.created`, `resource.updated`, `resource.deleted`

**Standard events to add:**

- `shift.created`, `shift.updated`, `shift.deleted`
- `time_entry.created`, `time_entry.updated`, `time_entry.status_changed`
- `absence.created`, `absence.updated`, `absence.approved`, `absence.rejected`, `absence.deleted`
- `employee.created`, `employee.updated`, `employee.deleted` (already exists for some)
- `month_close.locked`, `month_close.unlocked`
- `shift_swap.requested`, `shift_swap.approved`, `shift_swap.rejected`
- `shift_change.requested`, `shift_change.approved`, `shift_change.rejected`
- `service_visit.created`, `service_visit.completed`, `service_visit.signed`

After this section: Webhook dispatch goes from 8/135 → all mutation routes.

---

## SECTION 8 — Prisma Retry Wrapper & Timeouts (Closes: R3, R4)

**Goal:** Handle transient database failures gracefully with retry logic and request timeouts.

### 8A. Create `src/lib/prisma-retry.ts`

```typescript
import { log } from "@/lib/logger";

const RETRYABLE_CODES = [
  "P1001", // Can't reach database server
  "P1002", // Database server timeout
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const code = error?.code ?? "";
      if (!RETRYABLE_CODES.includes(code) || attempt === MAX_RETRIES) {
        throw error;
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      log.warn(
        `Retrying ${label} (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delay}ms`,
        {
          code,
        },
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

### 8B. Create `src/lib/request-timeout.ts`

```typescript
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}
```

### 8C. Apply to critical routes

Wrap the main Prisma call in payroll-critical routes:

```typescript
const result = await withRetry(
  () =>
    prisma.$transaction(async (tx) => {
      /* ... */
    }),
  "/api/time-entries/clock POST",
);
```

Add `withTimeout()` around outbound webhook fetches in `src/lib/webhooks.ts`:

```typescript
const response = await withTimeout(
  fetch(webhook.url, { ... }),
  10_000, // 10s timeout per attempt
  `webhook ${webhook.url}`
);
```

### 8D. Write tests

- `src/__tests__/lib/prisma-retry.test.ts` — test retry on P1001, P2024; no retry on other errors; max 3 retries
- `src/__tests__/lib/request-timeout.test.ts` — test timeout fires, test fast resolution

---

## SECTION 9 — Compound Database Indexes (Closes: P3)

**Goal:** Add missing compound indexes to `prisma/schema.prisma` and apply the migration via Supabase MCP.

### 9A. Add to `prisma/schema.prisma`

```prisma
model Notification {
  // ... existing fields ...
  @@index([userId, isRead, createdAt], name: "Notification_userId_isRead_createdAt_idx")
}

model AuditLog {
  // ... existing fields ...
  @@index([workspaceId, performedAt], name: "AuditLog_workspaceId_performedAt_idx")
}

model ESignature {
  // ... existing fields ...
  @@index([workspaceId, createdAt], name: "ESignature_workspaceId_createdAt_idx")
}
```

### 9B. Apply migration via Supabase MCP

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
  ON "Notification" ("userId", "isRead", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_workspaceId_performedAt_idx"
  ON "AuditLog" ("workspaceId", "performedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ESignature_workspaceId_createdAt_idx"
  ON "ESignature" ("workspaceId", "createdAt" DESC);
```

### 9C. Regenerate Prisma client

```bash
npx prisma generate
```

---

## SECTION 10 — Graceful Degradation: Redis Fallback Everywhere (Closes: A6)

**Goal:** Ensure `idempotency.ts` and `login-lockout.ts` work when Redis is down, matching the pattern in `cache.ts`.

### 10A. Update `src/lib/login-lockout.ts`

Add an in-memory Map fallback:

```typescript
const memoryAttempts = new Map<
  string,
  { count: number; lockedUntil?: number }
>();

// In recordFailedAttempt(): if no Redis, use memoryAttempts
// In isLocked(): if no Redis, check memoryAttempts
// In resetAttempts(): if no Redis, delete from memoryAttempts
```

### 10B. Update `src/lib/idempotency.ts`

(Done in Section 4C above — ensure it's implemented)

### 10C. Write tests for both fallback paths

---

## SECTION 11 — Webhook Background Queue (Closes: P4)

**Goal:** Move webhook retry logic out of the request handler so it doesn't block API responses.

### 11A. Update `src/lib/webhooks.ts`

Replace the synchronous retry loop with a single-attempt delivery + Redis queue for retries:

```typescript
export async function dispatchWebhook(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Attempt immediate delivery (single try, 10s timeout)
  // On failure: queue to Redis with retry metadata
  // A separate cron or the next request can process the retry queue
}
```

Alternatively, if keeping it simple: reduce to single attempt with `withTimeout(fetch(...), 10_000)` and no in-handler retries. Log failures to Sentry for visibility.

### 11B. Add `withTimeout()` to the fetch call

(Use the `request-timeout.ts` from Section 8B)

---

## SECTION 12 — Data Retention Cron Safety Net (Closes: D4)

**Goal:** Prevent the data-retention cron from accidentally deleting too much data.

### 12A. Update the data-retention automation route

In `src/app/api/automations/data-retention/route.ts` (or wherever the cron handler is):

1. Add a **dry-run mode**: check for `?dryRun=true` query param that counts but doesn't delete
2. Add **deletion count logging**: before and after each delete, log the count with `log.info`
3. Add **Sentry alerts on unusual volume**: if deletion count > 1000 for any single table in one run, log a warning and send to Sentry
4. Add **pre-delete count validation**: query the count first; if it's >50% of the table, abort and alert

```typescript
const count = await prisma.notification.count({ where: deleteWhere });
if (count > totalCount * 0.5) {
  log.error("Data retention: refusing to delete >50% of notifications", {
    count,
    totalCount,
  });
  captureRouteError(new Error("Suspicious retention deletion volume"), {
    route,
    method: "POST",
  });
  return apiError("Safety check: deletion volume too high", 500);
}
```

---

## SECTION 13 — Soft Delete for Critical Entities (Closes: D5)

**Goal:** Add `deletedAt` column to Employee, Shift, TimeEntry, Absence, and ServiceVisit so accidental deletions are recoverable.

### 13A. Schema changes in `prisma/schema.prisma`

Add to each model:

```prisma
deletedAt DateTime?
```

### 13B. Apply migration via Supabase MCP

```sql
ALTER TABLE "Employee" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Shift" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Absence" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ServiceVisit" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Employee_deletedAt_idx" ON "Employee" ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "Shift_deletedAt_idx" ON "Shift" ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "TimeEntry_deletedAt_idx" ON "TimeEntry" ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "Absence_deletedAt_idx" ON "Absence" ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "ServiceVisit_deletedAt_idx" ON "ServiceVisit" ("deletedAt") WHERE "deletedAt" IS NULL;
```

### 13C. Create Prisma middleware or update delete routes

In each DELETE handler for these models, change:

```typescript
await prisma.employee.delete({ where: { id } });
```

to:

```typescript
await prisma.employee.update({
  where: { id },
  data: { deletedAt: new Date() },
});
```

In each findMany/findFirst query, add:

```typescript
where: { ...existingWhere, deletedAt: null }
```

### 13D. Add `api/admin/restore/route.ts`

Create an OWNER-only endpoint to restore soft-deleted records:

```typescript
// POST /api/admin/restore
// Body: { type: "Employee" | "Shift" | ..., id: string }
// Sets deletedAt = null
```

### 13E. Regenerate Prisma client

```bash
npx prisma generate
```

---

## SECTION 14 — SLA Support Timestamps in Ticket Model (Closes: T3)

**Goal:** Track when tickets are created, first responded to, and resolved — enabling support SLA measurement.

### 14A. Schema changes in `prisma/schema.prisma`

Add to `Ticket` model:

```prisma
firstResponseAt  DateTime?
resolvedAt       DateTime?
slaBreached      Boolean   @default(false)
```

### 14B. Apply migration via Supabase MCP

```sql
ALTER TABLE "Ticket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "slaBreached" BOOLEAN NOT NULL DEFAULT false;
```

### 14C. Update ticket routes

- `api/tickets/[id]/comments/route.ts` POST: When the first comment is added by a non-reporter, set `firstResponseAt = new Date()` if it's null
- `api/tickets/[id]/route.ts` PATCH: When status changes to RESOLVED/CLOSED, set `resolvedAt = new Date()`
- Add SLA breach detection: if `firstResponseAt` - `createdAt` > 24h (Basic) or 8h (Professional), set `slaBreached = true`

### 14D. Update `api/tickets/stats/route.ts`

Add SLA metrics to the stats response:

```typescript
const slaStats = {
  averageFirstResponseMinutes: ...,
  averageResolutionMinutes: ...,
  slaBreachCount: ...,
  slaComplianceRate: ...,
};
```

### 14E. Regenerate Prisma client

---

## SECTION 15 — Maintenance Notification System (Closes: T5)

**Goal:** Create an API endpoint and email template for announcing planned maintenance.

### 15A. Create `src/app/api/admin/maintenance-notification/route.ts`

OWNER-only endpoint:

```typescript
// POST /api/admin/maintenance-notification
// Body: { scheduledAt: ISO string, durationMinutes: number, description: string }
// Sends email to all workspace owners/admins via Resend
// Creates a notification record for each workspace
```

### 15B. Create email template

In the Resend email sender, add a `maintenance-notification` template:

- Subject: `[Shiftfy] Geplante Wartung am {date}` / `[Shiftfy] Scheduled Maintenance on {date}`
- Body: Date, expected duration, description, link to status page

### 15C. Add i18n strings

In `messages/de.json` and `messages/en.json`:

```json
"maintenance": {
  "notification_subject": "Geplante Wartung am {date}",
  "notification_body": "...",
  "duration": "Voraussichtliche Dauer: {minutes} Minuten"
}
```

---

## SECTION 16 — JWT Session Hardening (Closes: S4)

**Goal:** Reduce JWT maxAge from 24h to 1h with silent background refresh.

### 16A. Update `src/lib/auth.ts`

Change NextAuth session config:

```typescript
session: {
  strategy: "jwt",
  maxAge: 60 * 60, // 1 hour (was 24h)
  updateAge: 5 * 60, // Refresh every 5 minutes (was 12h)
},
```

### 16B. Update the client-side SessionProvider

Ensure `SessionProvider` has `refetchInterval` set to refresh silently:

```typescript
<SessionProvider session={session} refetchInterval={4 * 60}>
  {children}
</SessionProvider>
```

This makes the client re-check the session every 4 minutes, and NextAuth's `updateAge: 300` ensures the JWT is refreshed if it's older than 5 minutes.

### 16C. Update mobile Bearer token

In `src/lib/api-response.ts`, ensure `requireAuth()` for Bearer JWT also validates token age:

```typescript
// If token.iat is older than 1h, return 401
if (token.iat && Date.now() / 1000 - token.iat > 3600) {
  return { ok: false, response: unauthorized() };
}
```

---

## SECTION 17 — Connection Pool Increase (Closes: SC1)

**Goal:** Increase the database connection pool to handle concurrent load.

### 17A. Update `.env.example` and documentation

```
DATABASE_POOL_MAX=15  # Was 5, increased for concurrent load
```

### 17B. Update `src/lib/db.ts` default

Change the default fallback:

```typescript
const poolMax = parseInt(process.env.DATABASE_POOL_MAX || "15", 10);
```

---

## SECTION 18 — Incident Response Playbook & Post-Mortem Template (Closes: M2, M8)

**Goal:** Create documentation for incident management.

### 18A. Create `docs/INCIDENT-RESPONSE-PLAYBOOK.md`

```markdown
# Incident Response Playbook

## Severity Levels

- **SEV1 (Critical):** Complete service outage, data loss, security breach
- **SEV2 (High):** Major feature unavailable (clock-in, payroll), >50% users affected
- **SEV3 (Medium):** Single feature degraded, <50% users affected
- **SEV4 (Low):** Cosmetic issue, workaround available

## Response Times

| Severity | Detection | Acknowledgment | Resolution Target |
| -------- | --------- | -------------- | ----------------- |
| SEV1     | < 5 min   | < 15 min       | < 1h              |
| SEV2     | < 5 min   | < 30 min       | < 4h              |
| SEV3     | < 30 min  | < 2h           | < 24h             |
| SEV4     | < 24h     | < 48h          | Next release      |

## Escalation Path

1. BetterStack alert fires → Primary on-call (SMS + email)
2. If no ack in 15 min → Secondary on-call
3. If SEV1/SEV2 → Update status page immediately
4. If SEV1 → All-hands incident channel

## Incident Commander Checklist

- [ ] Acknowledge the alert
- [ ] Assess severity
- [ ] Update status page
- [ ] Begin investigation
- [ ] Communicate ETA to affected customers
- [ ] Implement fix
- [ ] Verify fix via /api/health + smoke tests
- [ ] Close incident on status page
- [ ] Schedule post-mortem within 48h

## Communication Templates

### Status Page - Investigating

"We are investigating reports of [brief description]. We will provide an update within 30 minutes."

### Status Page - Identified

"The issue has been identified as [root cause]. We are implementing a fix. ETA: [time]."

### Status Page - Resolved

"The issue has been resolved. [Brief description of fix]. We apologize for the inconvenience."
```

### 18B. Create `docs/POST-MORTEM-TEMPLATE.md`

```markdown
# Post-Mortem: [Incident Title]

**Date:** YYYY-MM-DD
**Severity:** SEV1/2/3/4
**Duration:** HH:MM
**Author:** [Name]

## Summary

[1–2 sentence description]

## Timeline (UTC)

| Time  | Event                  |
| ----- | ---------------------- |
| HH:MM | Alert fired            |
| HH:MM | Acknowledged by [name] |
| HH:MM | Root cause identified  |
| HH:MM | Fix deployed           |
| HH:MM | Verified resolved      |

## Root Cause

[Technical description]

## Impact

- Users affected: N
- Duration: X minutes
- Data impact: None / Describe

## Detection

How was it detected? Could we have caught it sooner?

## Resolution

What was done to fix it?

## Action Items

| #   | Action               | Owner | Due Date | Status |
| --- | -------------------- | ----- | -------- | ------ |
| 1   | [Prevent recurrence] |       |          |        |
| 2   | [Improve detection]  |       |          |        |
| 3   | [Improve response]   |       |          |        |

## Lessons Learned

- What went well?
- What could be improved?
```

---

## SECTION 19 — SLA Document (Closes: T2)

**Goal:** Create the publishable SLA terms.

### 19A. Create `src/app/sla/page.tsx`

Create a public SLA page (German URL: `/sla`) following the same pattern as `/agb`, `/datenschutz`, `/impressum`:

- Use the SLA template from Section 13 of `docs/SLA-AUDIT.md`
- Add i18n support (DE/EN)
- Add ThemeToggle for dark mode
- Add SEO metadata

### 19B. Add i18n strings

Add comprehensive SLA text to `messages/de.json` and `messages/en.json`.

### 19C. Add link to footer

Add "SLA" link next to AGB, Datenschutz, Impressum in the landing page footer and the dashboard footer.

---

## SECTION 20 — Monitoring Infrastructure Code (Closes: M1, M4, M6, M7, A1, A2)

**Goal:** While BetterStack/Axiom sign-ups are manual, the code-side integration can be prepared.

### 20A. Create `src/lib/monitoring.ts`

```typescript
/**
 * Monitoring helpers for SLA measurement.
 * Integrates with BetterStack Uptime API for programmatic incident management.
 */

const BETTERSTACK_API_KEY = process.env.BETTERSTACK_API_KEY;

/** Report an incident to the status page */
export async function reportIncident(title: string, body: string) {
  if (!BETTERSTACK_API_KEY) return;
  // POST to BetterStack Incidents API
}

/** Resolve an incident */
export async function resolveIncident(incidentId: string) {
  if (!BETTERSTACK_API_KEY) return;
  // PATCH to BetterStack Incidents API
}

/** Create a maintenance window */
export async function createMaintenanceWindow(
  startsAt: Date,
  endsAt: Date,
  title: string,
) {
  if (!BETTERSTACK_API_KEY) return;
  // POST to BetterStack Maintenances API
}
```

### 20B. Update `src/lib/env.ts`

Add to RECOMMENDED env vars:

```typescript
"BETTERSTACK_API_KEY",
"AXIOM_TOKEN",
"AXIOM_DATASET",
```

### 20C. Create `src/app/api/admin/incidents/route.ts`

OWNER-only endpoint to programmatically create/resolve incidents on the status page. This lets the maintenance notification system (Section 15) also update the status page.

### 20D. Enhance Sentry configuration

In `sentry.server.config.ts`, add alert-worthy event hooks:

```typescript
Sentry.init({
  // ... existing config ...
  beforeSend(event) {
    // Tag high-severity events for alerting
    if (event.level === "fatal" || event.level === "error") {
      event.tags = { ...event.tags, sla_relevant: "true" };
    }
    return event;
  },
});
```

---

## 🔧 MANUAL TASKS (Not code — operator must do these)

These items cannot be automated via code changes. Complete them alongside the code work:

| #   | Task                                                                                                                     | Where                                               | Time   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------ |
| M1  | Sign up for BetterStack free tier, create monitor for `https://shiftfy.de/api/health` (60s interval), create status page | betterstack.com                                     | 30 min |
| M2  | Configure Sentry alert rules: spike >10 errors/min, new error in production, P95 > 2s                                    | sentry.io → Alerts                                  | 30 min |
| M3  | Sign up for Axiom free tier, connect Vercel log drain                                                                    | axiom.co + Vercel dashboard                         | 20 min |
| M4  | Verify PITR is enabled on Supabase production project                                                                    | Supabase dashboard → Database → Backups             | 5 min  |
| M5  | Upgrade Upstash to Pay-as-you-go plan                                                                                    | Upstash console                                     | 5 min  |
| M6  | Set Vercel spending alerts ($50, $100 thresholds)                                                                        | Vercel dashboard → Settings → Billing               | 5 min  |
| M7  | Enable Vercel Firewall (included in Pro)                                                                                 | Vercel dashboard → Firewall                         | 5 min  |
| M8  | Set `DATABASE_POOL_MAX=15` in Vercel production env vars                                                                 | Vercel dashboard → Settings → Environment Variables | 2 min  |
| M9  | Create off-site backup cron (pg_dump → S3, weekly)                                                                       | GitHub Actions workflow or external cron            | 2h     |
| M10 | Schedule first quarterly backup restore drill                                                                            | Calendar + document process                         | 30 min |

---

## Completion Checklist

After all sections are done, verify:

| Metric                           | Before        | After                                     | Target                                            |
| -------------------------------- | ------------- | ----------------------------------------- | ------------------------------------------------- |
| `captureRouteError()` coverage   | 29/135 (21%)  | 135/135 (100%)                            | 100%                                              |
| `requireAuth()` adoption         | 21/135 (16%)  | 118/135 (87%)                             | All authed routes                                 |
| `validateBody()` with Zod        | 64/135 (47%)  | 135/135 (100%)                            | 100%                                              |
| Idempotency (`checkIdempotency`) | 2/135 (1.5%)  | ~80/135 (all POSTs)                       | All POSTs                                         |
| Pagination (`parsePagination`)   | 20/135 (15%)  | ~60/135 (all lists)                       | All lists                                         |
| Audit logging (`createAuditLog`) | 24/135 (18%)  | ~90/135 (all writes)                      | All writes                                        |
| Webhook dispatch                 | 8/135 (6%)    | ~90/135 (all mutations)                   | All mutations                                     |
| `log.error()` in catch           | 118/135 (87%) | 135/135 (100%)                            | 100%                                              |
| `$transaction` for atomicity     | 24/135 (18%)  | Unchanged (already covers critical paths) | ✅                                                |
| Compound indexes                 | 101           | 104                                       | Add 3 missing                                     |
| Soft delete (critical entities)  | 0             | 5 models                                  | Employee, Shift, TimeEntry, Absence, ServiceVisit |
| SLA timestamps in tickets        | No            | Yes                                       | firstResponseAt, resolvedAt, slaBreached          |
| Incident playbook                | No            | Yes                                       | `docs/INCIDENT-RESPONSE-PLAYBOOK.md`              |
| Post-mortem template             | No            | Yes                                       | `docs/POST-MORTEM-TEMPLATE.md`                    |
| SLA public page                  | No            | Yes                                       | `/sla` route                                      |
| Maintenance notification         | No            | Yes                                       | Admin endpoint + email                            |
| JWT maxAge                       | 24h           | 1h                                        | With 5-min refresh                                |
| DB pool max                      | 5             | 15                                        | Via env var                                       |
| Redis fallback (idempotency)     | No            | Yes                                       | In-memory LRU                                     |
| Redis fallback (login-lockout)   | No            | Yes                                       | In-memory Map                                     |
| Prisma retry on transient errors | No            | Yes                                       | 3 retries, exponential backoff                    |
| Request timeout                  | No            | Yes                                       | 10s for outbound, Prisma default                  |
| Data retention safety net        | No            | Yes                                       | Dry-run, volume alerts, 50% abort                 |
| Webhook timeout                  | No            | Yes                                       | 10s via withTimeout                               |

### Run final verification:

```bash
npx vitest run --reporter=verbose
npx tsc --noEmit
npx eslint .
```

### Expected SLA Score After Completion:

| Dimension                      | Before | After   | Delta   |
| ------------------------------ | ------ | ------- | ------- |
| Availability & Uptime          | 72     | 95      | +23     |
| Performance                    | 78     | 95      | +17     |
| Data Durability & Recovery     | 80     | 97      | +17     |
| Monitoring & Incident Response | 55     | 95      | +40     |
| Security & Compliance          | 88     | 96      | +8      |
| API Reliability                | 70     | 99      | +29     |
| Support & Communication        | 40     | 90      | +50     |
| Scalability                    | 75     | 92      | +17     |
| **TOTAL (weighted avg)**       | **74** | **~95** | **+21** |

> **Note:** Reaching 99–100 requires the 🔧 MANUAL tasks (monitoring dashboards, PITR verification, pentest, SOC 2) which are outside code scope. The code changes alone bring the score to ~95. With manual tasks complete, the score reaches ≥99.

---

_This prompt was generated from `docs/SLA-AUDIT.md` (74/100 baseline) cross-referenced with `docs/PRODUCTION-READINESS-AUDIT.md` (92/100) and `docs/PRODUCTION-READINESS-AUDIT-v1.md` (60/100 historical)._
