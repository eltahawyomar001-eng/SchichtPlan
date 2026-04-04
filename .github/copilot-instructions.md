# Shiftfy — Copilot Instructions

## Architecture Overview

German-market SaaS for shift planning, time tracking, and workforce management. Multi-tenant architecture where every resource is scoped to a **Workspace** (the billing/isolation boundary).

**Stack:** Next.js 16 (App Router, Server Components) · TypeScript · Prisma 7 (PostgreSQL via `@prisma/adapter-pg`) · NextAuth 4 (JWT sessions) · Stripe Billing · next-intl (DE/EN) · Tailwind CSS 4 · Vitest · Vercel

**Data flow:** `User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`. Each Workspace has a 1:1 `Subscription` + `WorkspaceUsage` for billing & quota enforcement. **All DB queries must filter by `workspaceId`.**

## Project Layout

- `src/app/(auth)/` — Public auth pages (login, register, pricing). German URL slugs.
- `src/app/(dashboard)/` — Protected pages, guarded by `getServerSession` in `(dashboard)/layout.tsx`.
- `src/app/api/` — 48+ REST API route handlers (Next.js Route Handlers, not Pages API).
- `src/lib/` — Core business logic: `api-response.ts`, `authorization.ts`, `validations.ts`, `subscription-guard.ts`, `automations.ts`, `audit.ts`, `sentry.ts`, `logger.ts`, `db.ts`.
- `prisma/schema.prisma` — 30+ models, German enum values (e.g., `VOLLZEIT`, `AUSSTEHEND`, `ENTWURF`).
- `messages/{de,en}.json` — i18n translations. German is the default locale (cookie-based, no URL prefix).

## API Route Pattern (CRITICAL)

Every API route uses `requireAuth()` from `@/lib/api-response` — replicate this for new endpoints:

```typescript
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorization";
import { someSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";
import { captureRouteError } from "@/lib/sentry";
import { requireAuth, serverError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(); // handles session + Bearer JWT (mobile)
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const forbidden = requirePermission(user, "resource-name", "create");
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = validateBody(someSchema, body);
    if (!parsed.success) return parsed.response;

    // ... prisma query always filtered by workspaceId
  } catch (error) {
    log.error("Route failed", { error });
    captureRouteError(error, { route: "/api/resource", method: "POST" });
    return serverError();
  }
}
```

**Key conventions:**

- Use `requireAuth()` — not raw `getServerSession()`. It handles both web sessions and mobile Bearer JWT.
- Use `apiError()` / `apiSuccess()` and shortcut helpers (`unauthorized()`, `notFound()`, `forbidden()`, `serverError()`, `badRequest()`) from `@/lib/api-response`.
- Use `validateBody(schema, body)` with Zod schemas from `validations.ts`.
- Use `log.info/warn/error()` from `@/lib/logger` — never `console.log`.
- Wrap every handler in `try/catch` with `captureRouteError()` from `@/lib/sentry`.

### Cross-cutting concerns in mutation routes (POST/PATCH/DELETE):

- **Idempotency:** `checkIdempotency(req)` / `cacheIdempotentResponse(req, response)` from `@/lib/idempotency` on POST routes.
- **Audit logging:** `createAuditLog()` (fire-and-forget) or `createAuditLogTx()` (inside `$transaction`) from `@/lib/audit`.
- **Webhooks:** `dispatchWebhook(workspaceId, "entity.action", payload)` from `@/lib/webhooks` after successful mutations.
- **Pagination:** `parsePagination(req)` + `paginatedResponse(items, total, take, skip)` from `@/lib/pagination` on GET list endpoints.

## Authorization System

Four-role hierarchy: `OWNER > ADMIN > MANAGER > EMPLOYEE`. Defined in `src/lib/authorization.ts` with a permission matrix over 25+ resources × 5 actions (`read`, `create`, `update`, `delete`, `approve`).

- `requirePermission(user, resource, action)` — returns `403 NextResponse` or `null`
- `requireManagement(user)` — OWNER/ADMIN/MANAGER only
- `requireAdmin(user)` — OWNER/ADMIN only
- `isOwner(user)`, `isEmployee(user)` — boolean checks

EMPLOYEE role has ownership-scoped access enforced at the route level (e.g., `if (isEmployee(user)) where.employeeId = user.employeeId`).

## Subscription & Plan Gating

Plans: **BASIC** (€19/mo, 10 employees) → **PROFESSIONAL** (€49/mo, 50 employees) → **ENTERPRISE** (custom). Plan configs in `src/lib/stripe.ts` (`PLANS` object). Use `requireUserSlot(workspaceId)` from `src/lib/subscription-guard.ts` before creating employees/invitations. Feature gating uses `requireFeature(workspaceId, "featureName")` from the same file.

## Validation

All Zod schemas live in `src/lib/validations.ts`. The `validateBody(schema, body)` helper returns `{ success, data }` or `{ success: false, response }` (a 400 NextResponse). Error messages are in German (`"Pflichtfeld"`, `"Format muss HH:MM sein"`).

## i18n

Cookie-based locale (`de` default, `en` supported). No URL prefix routing. Use `next-intl` hooks in client components, `getLocale()`/`getMessages()` in server components. All user-facing strings must have entries in both `messages/de.json` and `messages/en.json`.

## Database

Prisma uses a lazy-initialized Proxy client (`src/lib/db.ts`) with `@prisma/adapter-pg` — builds succeed without `DATABASE_URL`. German enum values throughout (e.g., `ContractType.VOLLZEIT`, `AbsenceCategory.URLAUB`). IDs use `cuid()`. Date-only fields use `@db.Date`. Time fields are stored as `String` in `HH:MM` format. Caching via Upstash Redis (`src/lib/cache.ts`) with in-memory fallback in dev.

## Testing

Vitest (`vitest.config.ts`): jsdom default, node per-file via `@vitest-environment node` comment. Tests in `src/__tests__/`. 70% coverage threshold enforced.

**Test factories** in `src/__tests__/helpers/factories.ts`: `buildOwner()`, `buildAdmin()`, `buildManager()`, `buildEmployee()`, `buildRequest()`.

**API test pattern** — mock session + Prisma via `vi.hoisted()` + `vi.mock()`:

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
vi.mock("@/lib/db", () => ({ prisma: { model: { findMany: mockFindMany } } }));
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

## Key Patterns

- **Styling:** `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge). Emerald green palette (#059669). Icons are custom TSX SVG components in `src/components/icons/`.
- **Error monitoring:** Sentry (client, server, edge configs at project root). Use `captureRouteError()` in every API catch block.
- **Path alias:** `@/*` maps to `./src/*`.
- **Build:** `prisma generate && next build && next-sitemap`.
- **Node:** Requires Node ≥22, npm ≥11.
