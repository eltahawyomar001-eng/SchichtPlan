# Shiftfy — Copilot Instructions# Shiftfy — Copilot Instructions

## Architecture Overview## Architecture Overview

German-market SaaS for shift planning, time tracking, and workforce management. Multi-tenant architecture where every resource is scoped to a **Workspace** (the billing/isolation boundary).German-market SaaS for shift planning, time tracking, and workforce management. Multi-tenant architecture where every resource is scoped to a **Workspace** (the billing/isolation boundary).

**Stack:** Next.js 16 (App Router, Server Components) · TypeScript · Prisma 7 (PostgreSQL via `@prisma/adapter-pg`) · NextAuth 4 (JWT sessions) · Stripe Billing · next-intl (DE/EN) · Tailwind CSS 4 · Vitest · Vercel**Stack:** Next.js 16 (App Router, Server Components) · TypeScript · Prisma 7 (PostgreSQL via `@prisma/adapter-pg`) · NextAuth 4 (JWT sessions) · Stripe Billing · next-intl (DE/EN) · Tailwind CSS 4 · Vitest · Vercel

**Data flow:** `User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`. Each Workspace has a 1:1 `Subscription` + `WorkspaceUsage` for billing & quota enforcement. **All DB queries must filter by `workspaceId`.\*\***Data flow:** `User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`. Each Workspace has a 1:1 `Subscription` + `WorkspaceUsage` for billing & quota enforcement. **All DB queries must filter by `workspaceId`.\*\*

## Project Layout## Project Layout

- `src/app/(auth)/` — Public auth pages (login, register, pricing). German URL slugs (e.g., `/login`, `/registrieren`, `/preise`).- `src/app/(auth)/` — Public auth pages (login, register, pricing). German URL slugs.

- `src/app/(dashboard)/` — Protected pages with German URL slugs (e.g., `/abwesenheiten`, `/schichtplan`). Auth guard in `(dashboard)/layout.tsx` redirects unauthenticated users to `/login` and unboarded OWNER/ADMIN to `/onboarding`.- `src/app/(dashboard)/` — Protected pages, guarded by `getServerSession` in `(dashboard)/layout.tsx`.

- `src/app/api/` — 48+ REST API route handlers (Next.js Route Handlers, not Pages API).- `src/app/api/` — 48+ REST API route handlers (Next.js Route Handlers, not Pages API).

- `src/lib/` — Core business logic: `api-response.ts`, `authorization.ts`, `validations.ts`, `subscription-guard.ts`, `automations.ts`, `audit.ts`, `sentry.ts`, `logger.ts`, `db.ts`.- `src/lib/` — Core business logic: `api-response.ts`, `authorization.ts`, `validations.ts`, `subscription-guard.ts`, `automations.ts`, `audit.ts`, `sentry.ts`, `logger.ts`, `db.ts`.

- `prisma/schema.prisma` — 30+ models, 20+ enums, German enum values throughout (e.g., `VOLLZEIT`, `AUSSTEHEND`, `URLAUB`).- `prisma/schema.prisma` — 30+ models, German enum values (e.g., `VOLLZEIT`, `AUSSTEHEND`, `ENTWURF`).

- `messages/{de,en}.json` — i18n translations. German is the default locale (cookie-based, no URL prefix).- `messages/{de,en}.json` — i18n translations. German is the default locale (cookie-based, no URL prefix).

- `src/components/icons/` — 90+ custom TSX SVG icon components. Import from `@/components/icons`. Never use external icon libraries.

- `src/components/ui/` — Shared UI primitives (Button, Card, Modal, Input, etc.) using `cva` variants.## API Route Pattern (CRITICAL)

## API Route Pattern (CRITICAL)Every API route uses `requireAuth()` from `@/lib/api-response` — replicate this for new endpoints:

Every API route follows this exact structure. Reference `src/app/api/employees/route.ts` as the canonical example:```typescript

import { prisma } from "@/lib/db";

````typescriptimport { requirePermission } from "@/lib/authorization";

import { prisma } from "@/lib/db";import { someSchema, validateBody } from "@/lib/validations";

import { requirePermission } from "@/lib/authorization";import { log } from "@/lib/logger";

import { someSchema, validateBody } from "@/lib/validations";import { captureRouteError } from "@/lib/sentry";

import { log } from "@/lib/logger";import { requireAuth, serverError } from "@/lib/api-response";

import { captureRouteError } from "@/lib/sentry";

import { requireAuth, serverError } from "@/lib/api-response";export async function POST(req: Request) {

  try {

export async function POST(req: Request) {    const auth = await requireAuth(); // handles session + Bearer JWT (mobile)

  try {    if (!auth.ok) return auth.response;

    const auth = await requireAuth(); // handles session + Bearer JWT (mobile)    const { user, workspaceId } = auth;

    if (!auth.ok) return auth.response;

    const { user, workspaceId } = auth;    const forbidden = requirePermission(user, "resource-name", "create");

    if (forbidden) return forbidden;

    const forbidden = requirePermission(user, "resource-name", "create");

    if (forbidden) return forbidden;    const body = await req.json();

    const parsed = validateBody(someSchema, body);

    const body = await req.json();    if (!parsed.success) return parsed.response;

    const parsed = validateBody(someSchema, body);

    if (!parsed.success) return parsed.response;    // ... prisma query always filtered by workspaceId

  } catch (error) {

    // ... prisma query always filtered by workspaceId    log.error("Route failed", { error });

  } catch (error) {    captureRouteError(error, { route: "/api/resource", method: "POST" });

    log.error("Route failed", { error });    return serverError();

    captureRouteError(error, { route: "/api/resource", method: "POST" });  }

    return serverError();}

  }```

}

```**Key conventions:**



**Key conventions:**- Use `requireAuth()` — not raw `getServerSession()`. It handles both web sessions and mobile Bearer JWT.

- Use `apiError()` / `apiSuccess()` and shortcut helpers (`unauthorized()`, `notFound()`, `forbidden()`, `serverError()`, `badRequest()`) from `@/lib/api-response`.

- Use `requireAuth()` — not raw `getServerSession()`. It handles both web sessions and mobile Bearer JWT. Pass `{ requireWorkspace: false }` only for onboarding routes.- Use `validateBody(schema, body)` with Zod schemas from `validations.ts`.

- Use `apiSuccess(data)` for `{ data: T }` responses and shortcut error helpers from `@/lib/api-response`: `unauthorized()`, `notFound()`, `forbidden()`, `serverError()`, `badRequest()`, `conflict()`, `tooMany()`, `payloadTooLarge()`, `noWorkspace()`.- Use `log.info/warn/error()` from `@/lib/logger` — never `console.log`.

- Use `validateBody(schema, body)` with Zod schemas from `@/lib/validations`. Error messages are in German (`"Pflichtfeld"`, `"Format muss HH:MM sein"`).- Wrap every handler in `try/catch` with `captureRouteError()` from `@/lib/sentry`.

- Use `log.info/warn/error()` from `@/lib/logger` — never `console.log`. Logger emits JSON in production, pretty output in dev.

- Wrap every handler in `try/catch` with `captureRouteError()` from `@/lib/sentry`.### Cross-cutting concerns in mutation routes (POST/PATCH/DELETE):



### Cross-cutting concerns in mutation routes (POST/PATCH/DELETE):- **Idempotency:** `checkIdempotency(req)` / `cacheIdempotentResponse(req, response)` from `@/lib/idempotency` on POST routes.

- **Audit logging:** `createAuditLog()` (fire-and-forget) or `createAuditLogTx()` (inside `$transaction`) from `@/lib/audit`.

- **Idempotency:** `checkIdempotency(req)` / `cacheIdempotentResponse(req, response)` from `@/lib/idempotency` on POST routes that create resources.- **Webhooks:** `dispatchWebhook(workspaceId, "entity.action", payload)` from `@/lib/webhooks` after successful mutations.

- **Audit logging:** `createAuditLog()` (fire-and-forget) or `createAuditLogTx(tx, ...)` (inside `prisma.$transaction`) from `@/lib/audit`.- **Pagination:** `parsePagination(req)` + `paginatedResponse(items, total, take, skip)` from `@/lib/pagination` on GET list endpoints.

- **Webhooks:** `dispatchWebhook(workspaceId, "entity.action", payload)` from `@/lib/webhooks` — fire-and-forget with `.catch()`.

- **Automations:** `executeCustomRules("entity.action", workspaceId, data)` from `@/lib/automations` — triggers workspace-defined automation rules.## Authorization System

- **Plan gating:** `requireUserSlot(workspaceId)` from `@/lib/subscription-guard` before creating employees/invitations. `requireFeature(workspaceId, "featureName")` for Professional-tier features.

- **Pagination:** `parsePagination(req)` + `paginatedResponse(items, total, take, skip)` from `@/lib/pagination` on GET list endpoints. Supports `?limit=&offset=` and `?page=&pageSize=`. Max 200 per page.Four-role hierarchy: `OWNER > ADMIN > MANAGER > EMPLOYEE`. Defined in `src/lib/authorization.ts` with a permission matrix over 25+ resources × 5 actions (`read`, `create`, `update`, `delete`, `approve`).



## Authorization System- `requirePermission(user, resource, action)` — returns `403 NextResponse` or `null`

- `requireManagement(user)` — OWNER/ADMIN/MANAGER only

Four-role hierarchy: `OWNER > ADMIN > MANAGER > EMPLOYEE`. Defined in `src/lib/authorization.ts` with a permission matrix over 25+ resources × 5 actions (`read`, `create`, `update`, `delete`, `approve`).- `requireAdmin(user)` — OWNER/ADMIN only

- `isOwner(user)`, `isEmployee(user)` — boolean checks

- `requirePermission(user, resource, action)` — returns `403 NextResponse` or `null`

- `requireManagement(user)` — OWNER/ADMIN/MANAGER onlyEMPLOYEE role has ownership-scoped access enforced at the route level (e.g., `if (isEmployee(user)) where.employeeId = user.employeeId`).

- `requireAdmin(user)` — OWNER/ADMIN only

- `isOwner(user)`, `isEmployee(user)` — boolean checks## Subscription & Plan Gating



EMPLOYEE role has ownership-scoped access enforced at the route level (e.g., `if (isEmployee(user)) where.employeeId = user.employeeId`). See the `Resource` type in `authorization.ts` for the full list of 25+ resource names to pass to `requirePermission`.Plans: **BASIC** (€19/mo, 10 employees) → **PROFESSIONAL** (€49/mo, 50 employees) → **ENTERPRISE** (custom). Plan configs in `src/lib/stripe.ts` (`PLANS` object). Use `requireUserSlot(workspaceId)` from `src/lib/subscription-guard.ts` before creating employees/invitations. Feature gating uses `requireFeature(workspaceId, "featureName")` from the same file.



## Subscription & Plan Gating## Validation



Plans: **BASIC** → **PROFESSIONAL** → **ENTERPRISE**. Plan configs in `src/lib/stripe.ts` (`PLANS` object). Limits tracked in the `WorkspaceUsage` model (user slots, PDF quota, storage bytes). `syncUsageLimits()` is called from billing webhooks when plans change.All Zod schemas live in `src/lib/validations.ts`. The `validateBody(schema, body)` helper returns `{ success, data }` or `{ success: false, response }` (a 400 NextResponse). Error messages are in German (`"Pflichtfeld"`, `"Format muss HH:MM sein"`).



## i18n## i18n



Cookie-based locale (`de` default, `en` supported). No URL prefix routing. Config in `src/i18n/request.ts`. Use `useTranslations()` / `useLocale()` from `next-intl` in client components. All user-facing strings must have entries in both `messages/de.json` and `messages/en.json`. Date formatting uses `date-fns` with `de` / `enUS` locales.Cookie-based locale (`de` default, `en` supported). No URL prefix routing. Use `next-intl` hooks in client components, `getLocale()`/`getMessages()` in server components. All user-facing strings must have entries in both `messages/de.json` and `messages/en.json`.



## Database## Database



Prisma uses a lazy-initialized Proxy client (`src/lib/db.ts`) with `@prisma/adapter-pg` — builds succeed without `DATABASE_URL`. Pool size configurable via `DATABASE_POOL_MAX` env var (default 5).Prisma uses a lazy-initialized Proxy client (`src/lib/db.ts`) with `@prisma/adapter-pg` — builds succeed without `DATABASE_URL`. German enum values throughout (e.g., `ContractType.VOLLZEIT`, `AbsenceCategory.URLAUB`). IDs use `cuid()`. Date-only fields use `@db.Date`. Time fields are stored as `String` in `HH:MM` format. Caching via Upstash Redis (`src/lib/cache.ts`) with in-memory fallback in dev.



**Data conventions:** IDs use `cuid()`. Date-only fields use `@db.Date`. Time fields are stored as `String` in `HH:MM` format. German enum values throughout (e.g., `ContractType.VOLLZEIT`, `AbsenceCategory.URLAUB`). Caching via Upstash Redis (`src/lib/cache.ts`) with in-memory `Map` fallback in dev.## Testing



**Input sanitization:** `sanitize()` / `sanitizeObject()` from `@/lib/sanitize` strips XSS vectors from user text fields. Used in Zod schemas via `.transform()`.Vitest (`vitest.config.ts`): jsdom default, node per-file via `@vitest-environment node` comment. Tests in `src/__tests__/`. 70% coverage threshold enforced.



## Testing**Test factories** in `src/__tests__/helpers/factories.ts`: `buildOwner()`, `buildAdmin()`, `buildManager()`, `buildEmployee()`, `buildRequest()`.



Vitest (`vitest.config.ts`): jsdom default, node per-file via `@vitest-environment node` comment at top of file. Tests in `src/__tests__/`. 70% coverage threshold enforced (lines, functions, statements; 65% branches).**API test pattern** — mock session + Prisma via `vi.hoisted()` + `vi.mock()`:



**Test factories** in `src/__tests__/helpers/factories.ts`: `buildOwner()`, `buildAdmin()`, `buildManager()`, `buildEmployee()`, `buildRequest()`, `buildRequestWithIp()`.```typescript

const { mockSession, mockFindMany } = vi.hoisted(() => ({

**API test pattern** — mock session + Prisma via `vi.hoisted()` + `vi.mock()`. Also mock `next/headers`, `@/lib/auth`, and fire-and-forget modules (`@/lib/automations`, `@/lib/webhooks`):  mockSession: { user: null as SessionUser | null },

  mockFindMany: vi.fn(),

```typescript}));

const { mockSession, mockFindMany } = vi.hoisted(() => ({vi.mock("next-auth", () => ({

  mockSession: { user: null as SessionUser | null },  default: vi.fn(),

  mockFindMany: vi.fn(),  getServerSession: vi.fn(() =>

}));    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),

vi.mock("next-auth", () => ({  ),

  default: vi.fn(),}));

  getServerSession: vi.fn(() =>vi.mock("@/lib/db", () => ({ prisma: { model: { findMany: mockFindMany } } }));

    Promise.resolve(mockSession.user ? { user: mockSession.user } : null),```

  ),

}));```bash

vi.mock("next/headers", () => ({npm run test           # single run

  headers: vi.fn(() => Promise.resolve(new Headers())),npm run test:watch     # watch mode

  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),npm run test:coverage  # with v8 coverage

}));npm run test:e2e       # Playwright e2e

vi.mock("@/lib/auth", () => ({ authOptions: {} }));```

vi.mock("@/lib/db", () => ({ prisma: { model: { findMany: mockFindMany } } }));

```## Commits & Linting



```bashConventional Commits enforced by Husky + commitlint: `feat(scope): message`, `fix(scope): message`. Pre-commit runs ESLint + Prettier via lint-staged on staged `.ts/.tsx` files.

npm run test           # single run

npm run test:watch     # watch mode## Database Migrations (CRITICAL — use Supabase MCP)

npm run test:coverage  # with v8 coverage

npm run test:e2e       # Playwright e2e**⚠️ `npx prisma migrate dev` does NOT work** — the Supabase connection pooler rejects Prisma migrate connections (P1001).

````

**Always use Supabase MCP tools instead:**

## Commits & Linting

1. **Edit** `prisma/schema.prisma` with new/changed models

Conventional Commits enforced by Husky + commitlint: `feat(scope): message`, `fix(scope): message`. Pre-commit runs ESLint + Prettier via lint-staged on staged `.ts/.tsx` files.2. **List current tables** → `mcp_supabase_list_tables` (schemas: `["public"]`)

3. **Compare** schema vs existing tables — identify missing tables, columns, indexes, enums

## Database Migrations (CRITICAL — use Supabase MCP)4. **Write migration SQL** — `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, foreign keys, `ENABLE ROW LEVEL SECURITY`

5. **Apply** → `mcp_supabase_apply_migration` with descriptive snake_case name

**⚠️ `npx prisma migrate dev` does NOT work** — the Supabase connection pooler rejects Prisma migrate connections (P1001).6. **Verify** → `mcp_supabase_execute_sql` to confirm

7. **Regenerate client** → `npx prisma generate`

**Always use Supabase MCP tools instead:**

### SQL Conventions

1. **Edit** `prisma/schema.prisma` with new/changed models

2. **List current tables** → `mcp_supabase_list_tables` (schemas: `["public"]`)- IDs: `TEXT NOT NULL DEFAULT gen_random_uuid()::text`

3. **Compare** schema vs existing tables — identify missing tables, columns, indexes, enums- Timestamps: `TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`

4. **Write migration SQL** — `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, foreign keys, `ENABLE ROW LEVEL SECURITY`- Enums: `CREATE TYPE "EnumName" AS ENUM ('VALUE1', 'VALUE2')`

5. **Apply** → `mcp_supabase_apply_migration` with descriptive snake_case name- Always `ENABLE ROW LEVEL SECURITY` on new tables

6. **Verify** → `mcp_supabase_execute_sql` to confirm- Index naming: `TableName_columnName_idx`, FK naming: `TableName_columnName_fkey`

7. **Regenerate client** → `npx prisma generate`

## Key Patterns

### SQL Conventions

- **Styling:** `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge). Emerald green palette (#059669). Icons are custom TSX SVG components in `src/components/icons/`.

- IDs: `TEXT NOT NULL DEFAULT gen_random_uuid()::text`- **Error monitoring:** Sentry (client, server, edge configs at project root). Use `captureRouteError()` in every API catch block.

- Timestamps: `TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`- **Path alias:** `@/*` maps to `./src/*`.

- Enums: `CREATE TYPE "EnumName" AS ENUM ('VALUE1', 'VALUE2')`- **Build:** `prisma generate && next build && next-sitemap`.

- Always `ENABLE ROW LEVEL SECURITY` on new tables- **Node:** Requires Node ≥22, npm ≥11.

- Index naming: `TableName_columnName_idx`, FK naming: `TableName_columnName_fkey`

## Key Patterns

- **Styling:** `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge). Emerald green palette (#059669). Components use `cva` for variants (see `src/components/ui/button.tsx`).
- **Icons:** Custom TSX SVG components in `src/components/icons/` — 90+ icons with barrel export in `index.ts`. Never use lucide-react or heroicons directly.
- **Error monitoring:** Sentry (client, server, edge configs at project root). Use `captureRouteError()` in every API catch block.
- **Rate limiting:** Upstash Redis sliding-window in `middleware.ts`: auth 10/60s, API 60/60s, import 5/60s. Falls back to allow-all without Redis env vars.
- **Security headers:** CSP with per-request nonce, HSTS, X-Frame-Options DENY — all set in `middleware.ts`.
- **Env validation:** `validateEnv()` in `src/lib/env.ts` — required: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Recommended: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `SENTRY_DSN`, `UPSTASH_REDIS_*`, `CRON_SECRET`.
- **Path alias:** `@/*` maps to `./src/*`.
- **Build:** `prisma generate && next build && next-sitemap`.
- **Node:** Requires Node ≥22, npm ≥11.
