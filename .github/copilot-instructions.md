# Shiftfy — Copilot Instructions

## Architecture Overview

German-market SaaS for shift planning, time tracking, and workforce management. Multi-tenant architecture where every resource is scoped to a **Workspace** (the billing/isolation boundary).

**Stack:** Next.js 16 (App Router, Server Components) · TypeScript · Prisma 7 (PostgreSQL via `@prisma/adapter-pg`) · NextAuth 4 (JWT sessions) · Stripe Billing · next-intl (DE/EN) · Tailwind CSS 4 · Vitest · Vercel

**Data flow:** `User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`. Each Workspace has a 1:1 `Subscription` + `WorkspaceUsage` for billing & quota enforcement. **All DB queries must filter by `workspaceId`.**

## Project Layout

- `src/app/(auth)/` — Public auth pages (login, register, pricing). German URL slugs (`/login`, `/registrieren`, `/preise`).
- `src/app/(dashboard)/` — Protected pages with German URL slugs (`/abwesenheiten`, `/schichtplan`). Auth guard in `(dashboard)/layout.tsx` redirects unauthenticated users to `/login` and unboarded OWNER/ADMIN to `/onboarding`.
- `src/app/api/` — 48+ REST API route handlers (Next.js Route Handlers, not Pages API).
- `src/lib/` — Core business logic: `api-response.ts`, `authorization.ts`, `validations.ts`, `subscription-guard.ts`, `automations.ts`, `audit.ts`, `sentry.ts`, `logger.ts`, `db.ts`, `with-route.ts`.
- `prisma/schema.prisma` — 30+ models, 20+ enums, German enum values throughout (e.g., `VOLLZEIT`, `AUSSTEHEND`, `URLAUB`, `ENTWURF`).
- `messages/{de,en}.json` — i18n translations. German is the default locale (cookie-based, no URL prefix).
- `src/components/icons/` — 90+ custom TSX SVG icon components with barrel export in `index.ts`. Import from `@/components/icons`. **Never use lucide-react, heroicons, or other external icon libraries.**
- `src/components/ui/` — Shared UI primitives (Button, Card, Modal, Input, etc.) using `cva` variants.

## API Route Pattern (CRITICAL)

**Two styles coexist** — new/refactored routes use the `withRoute` wrapper (preferred); some older routes use raw `export async function`. Follow `withRoute` for all new code.

### Preferred pattern — `withRoute` wrapper (`src/lib/with-route.ts`)

Handles try/catch, logging, Sentry capture, and optional idempotency automatically. Reference `src/app/api/skills/route.ts`:

```typescript
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { createSkillSchema, validateBody } from "@/lib/validations";
import { withRoute } from "@/lib/with-route";
import { requireAuth } from "@/lib/api-response";

export const POST = withRoute(
  "/api/skills",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "skills", "create");
    if (forbidden) return forbidden;

    const parsed = validateBody(createSkillSchema, await req.json());
    if (!parsed.success) return parsed.response;

    const skill = await prisma.skill.create({
      data: { ...parsed.data, workspaceId },
    });
    return NextResponse.json(skill, { status: 201 });
  },
  { idempotent: true },
); // opt-in idempotency for POST
```

For routes with dynamic params:

```typescript
export const PATCH = withRoute(
  "/api/items/[id]",
  "PATCH",
  async (req, context) => {
    const { id } = await context!.params;
    // ...
  },
);
```

### Legacy pattern — raw `export async function` (e.g., `src/app/api/employees/route.ts`)

Wraps handler body in manual `try/catch` with `log.error()`, `captureRouteError()`, and `return serverError()`. Reference the employees route for the full structure.

### Key conventions

- Use `requireAuth()` from `@/lib/api-response` — **not** raw `getServerSession()`. Handles both web sessions and mobile Bearer JWT. Pass `{ requireWorkspace: false }` only for onboarding routes.
- Use `apiSuccess(data)` for `{ data: T }` responses and shortcut error helpers: `unauthorized()`, `notFound()`, `forbidden()`, `serverError()`, `badRequest()`, `conflict()`, `tooMany()`, `payloadTooLarge()`, `noWorkspace()`.
- Use `validateBody(schema, body)` with Zod schemas from `@/lib/validations`. Error messages are in German (`"Pflichtfeld"`, `"Format muss HH:MM sein"`).
- Use `log.info/warn/error()` from `@/lib/logger` — **never `console.log`**. Logger emits JSON in production, pretty output in dev.
- Wrap every handler in `try/catch` with `captureRouteError()` from `@/lib/sentry` (automatic when using `withRoute`).

### Cross-cutting concerns in mutation routes (POST/PATCH/DELETE)

- **Idempotency:** With `withRoute`, pass `{ idempotent: true }`. Without it, use `checkIdempotency(req)` / `cacheIdempotentResponse(req, response)` from `@/lib/idempotency`.
- **Audit logging:** `createAuditLog()` (fire-and-forget) or `createAuditLogTx(tx, ...)` (inside `prisma.$transaction`) from `@/lib/audit`.
- **Webhooks:** `dispatchWebhook(workspaceId, "entity.action", payload)` from `@/lib/webhooks` — fire-and-forget with `.catch()`.
- **Automations:** `executeCustomRules("entity.action", workspaceId, data)` from `@/lib/automations`.
- **Plan gating:** `requireUserSlot(workspaceId)` from `@/lib/subscription-guard` before creating employees/invitations. `requireFeature(workspaceId, "featureName")` for Professional-tier features.
- **Pagination:** `parsePagination(req)` + `paginatedResponse(items, total, take, skip)` from `@/lib/pagination` on GET list endpoints. Supports `?limit=&offset=` and `?page=&pageSize=`. Max 200 per page.

## Authorization System

Four-role hierarchy: `OWNER > ADMIN > MANAGER > EMPLOYEE`. Defined in `src/lib/authorization.ts` with a permission matrix over 25+ resources × 5 actions (`read`, `create`, `update`, `delete`, `approve`). See the `Resource` type for the full resource list.

- `requirePermission(user, resource, action)` — returns `403 NextResponse` or `null`
- `requireManagement(user)` — OWNER/ADMIN/MANAGER only
- `requireAdmin(user)` — OWNER/ADMIN only
- `isOwner(user)`, `isEmployee(user)` — boolean checks

EMPLOYEE role has ownership-scoped access enforced at the route level (e.g., `if (isEmployee(user)) where.employeeId = user.employeeId`).

## Subscription & Plan Gating

Plans: **BASIC** (€19/mo, 10 employees) → **PROFESSIONAL** (€49/mo, 50 employees) → **ENTERPRISE** (custom). Plan configs in `src/lib/stripe.ts` (`PLANS` object). Limits tracked in `WorkspaceUsage` model. `syncUsageLimits()` called from billing webhooks.

## Validation

All Zod schemas live in `src/lib/validations.ts`. The `validateBody(schema, body)` helper returns `{ success, data }` or `{ success: false, response }` (a 400 NextResponse). Error messages are in German. Input sanitization via `sanitize()` / `sanitizeObject()` from `@/lib/sanitize`.

## i18n

Cookie-based locale (`de` default, `en` supported). No URL prefix routing. Config in `src/i18n/request.ts`. Use `useTranslations()` / `useLocale()` from `next-intl` in client components; `getLocale()` / `getMessages()` in server components. All user-facing strings must have entries in both `messages/de.json` and `messages/en.json`. Date formatting uses `date-fns` with `de` / `enUS` locales.

## Database

Prisma uses a lazy-initialized Proxy client (`src/lib/db.ts`) with `@prisma/adapter-pg` — builds succeed without `DATABASE_URL`. Pool size configurable via `DATABASE_POOL_MAX` env var (default 5).

**Data conventions:** IDs use `cuid()`. Date-only fields use `@db.Date`. Time fields stored as `String` in `HH:MM` format. German enum values throughout (e.g., `ContractType.VOLLZEIT`, `AbsenceCategory.URLAUB`). Caching via Upstash Redis (`src/lib/cache.ts`) with in-memory `Map` fallback in dev.

## Testing

Vitest (`vitest.config.ts`): jsdom default, node per-file via `@vitest-environment node` comment at top of file. Tests in `src/__tests__/`. 70% coverage threshold enforced (lines, functions, statements; 65% branches).

**Test factories** in `src/__tests__/helpers/factories.ts`: `buildOwner()`, `buildAdmin()`, `buildManager()`, `buildEmployee()`, `buildRequest()`, `buildRequestWithIp()`.

**API test pattern** — mock session + Prisma via `vi.hoisted()` + `vi.mock()`. Also mock `@/lib/api-response` (with `requireAuth`), `next-auth`, `@/lib/auth`, `@/lib/sentry`, `@/lib/logger`, and fire-and-forget modules. See `src/__tests__/api/tickets.test.ts` for the canonical modern example:

```typescript
const { mockSession, mockFindMany } = vi.hoisted(() => ({
  mockSession: { user: null as SessionUser | null },
  mockFindMany: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
  getServerSession: vi.fn(() =>
    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { model: { findMany: mockFindMany } } }));
vi.mock("@/lib/api-response", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/api-response")>();
  return {
    ...orig,
    requireAuth: vi.fn(async () => {
      /* ... */
    }),
  };
});
vi.mock("@/lib/sentry", () => ({ captureRouteError: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
```

```bash
npm run test           # single run
npm run test:watch     # watch mode
npm run test:coverage  # with v8 coverage
npm run test:e2e       # Playwright e2e
```

## Commits & Linting

Conventional Commits enforced by Husky + commitlint: `feat(scope): message`, `fix(scope): message`. Pre-commit runs ESLint + Prettier via lint-staged on staged `.ts/.tsx` files.

## Database Migrations (CRITICAL — use Supabase MCP)

**⚠️ `npx prisma migrate dev` does NOT work** — the Supabase connection pooler rejects Prisma migrate connections (P1001).

**Always use Supabase MCP tools instead:**

1. **Edit** `prisma/schema.prisma` with new/changed models
2. **List current tables** → `mcp_supabase_list_tables` (schemas: `["public"]`)
3. **Compare** schema vs existing tables — identify missing tables, columns, indexes, enums
4. **Write migration SQL** — `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, foreign keys, `ENABLE ROW LEVEL SECURITY`
5. **Apply** → `mcp_supabase_apply_migration` with descriptive snake_case name
6. **Verify** → `mcp_supabase_execute_sql` to confirm
7. **Regenerate client** → `npx prisma generate`

### SQL Conventions

- IDs: `TEXT NOT NULL DEFAULT gen_random_uuid()::text`
- Timestamps: `TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Enums: `CREATE TYPE "EnumName" AS ENUM ('VALUE1', 'VALUE2')`
- Always `ENABLE ROW LEVEL SECURITY` on new tables
- Index naming: `TableName_columnName_idx`, FK naming: `TableName_columnName_fkey`

## German Labor Law Compliance (CRITICAL)

Business logic actively enforces German labor regulations — these are **not** just UI validations:

- **ArbZG §3** (Arbeitszeitgesetz): Max 10h/day and 48h/week enforced in `src/lib/automations.ts`, `src/lib/auto-fill.ts`, `src/lib/auto-scheduler.ts`, and at clock-in time in `src/app/api/time-entries/clock/route.ts`.
- **BUrlG §3** (Bundesurlaubsgesetz): Minimum vacation entitlement = `workDaysPerWeek × 4` days. Enforced in `src/app/api/vacation-balances/route.ts` — rejecting any entitlement below the legal minimum with a German error message.
- **BUrlG §7(3)**: Vacation carry-over recorded but expires March 31 of the following year. Only auto-provision `VacationBalance` rows for the **current calendar year** — never for past/future years.
- `VacationBalance.used` + `planned` are always recalculated from actual `AbsenceRequest` rows on every GET, not stored as a trust-me value.

When modifying absence, vacation, time-entry, or scheduling code, verify compliance with these statutes is preserved.

## Ticketing System

Added in migration `20250630_add_ticketing_system`. Key dedicated libs:

- `src/lib/ticket-number.ts` — `createTicketWithNumber()` generates sequential `#TK-XXXX` numbers (workspace-scoped, atomic).
- `src/lib/ticket-events.ts` — `logTicketCreated()`, `logTicketUpdated()`, etc. (audit trail).
- `src/lib/ticket-notifications.ts` — `notifyNewTicket()`, `notifyTicketAssigned()` — fire-and-forget.

The tickets route (`src/app/api/tickets/`) still uses the **legacy** raw `export async function` style (not yet migrated to `withRoute`). Reference it only for legacy patterns; use `withRoute` for any new ticket sub-routes.

## Key Patterns

- **Styling:** `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge). Emerald green palette (#059669). Components use `cva` for variants (see `src/components/ui/button.tsx`).
- **Icons:** Custom TSX SVG components in `src/components/icons/` — 90+ icons with barrel export in `index.ts`. **Never use external icon libraries.**
- **Error monitoring:** Sentry (client, server, edge configs at project root). Use `captureRouteError()` in every API catch block.
- **Rate limiting:** Upstash Redis sliding-window in `middleware.ts`: auth 10/60s, API 60/60s. Falls back to allow-all without Redis env vars.
- **Security headers:** CSP with per-request nonce, HSTS, X-Frame-Options DENY — all set in `middleware.ts`.
- **Env validation:** `validateEnv()` in `src/lib/env.ts` — required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Recommended: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `SENTRY_DSN`, `UPSTASH_REDIS_*`, `CRON_SECRET`.
- **Path alias:** `@/*` maps to `./src/*`.
- **Build:** `prisma generate && next build && next-sitemap`.
- **Node:** Requires Node ≥22, npm ≥11.
