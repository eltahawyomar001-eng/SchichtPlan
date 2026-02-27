# Shiftfy — Copilot Instructions

## Architecture Overview

German-market SaaS for shift planning, time tracking, and workforce management. Multi-tenant architecture where every resource is scoped to a **Workspace** (the billing/isolation boundary).

**Stack:** Next.js 16 (App Router, Server Components) · TypeScript · Prisma 7 (PostgreSQL via `@prisma/adapter-pg`) · NextAuth 4 (JWT sessions) · Stripe Billing · next-intl (DE/EN) · Tailwind CSS 4 · Vitest · Vercel

**Data flow:** `User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`. Each Workspace has a 1:1 `Subscription` for Stripe billing. All DB queries must filter by `workspaceId`.

## Project Layout

- `src/app/(auth)/` — Public auth pages (login, register, pricing). German URL slugs.
- `src/app/(dashboard)/` — Protected pages, guarded by `getServerSession` in `(dashboard)/layout.tsx`.
- `src/app/api/` — 35+ REST API route handlers (Next.js Route Handlers, not Pages API).
- `src/lib/` — Core business logic: `auth.ts`, `authorization.ts`, `stripe.ts`, `subscription.ts`, `validations.ts`, `db.ts`, `logger.ts`.
- `prisma/schema.prisma` — 30+ models, German enum values (e.g., `URLAUB`, `AUSSTEHEND`, `ENTWURF`).
- `messages/{de,en}.json` — i18n translations. German is the default locale (cookie-based, no URL prefix).

## API Route Pattern (CRITICAL)

Every API route follows this exact structure — replicate it for new endpoints:

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requirePermission } from "@/lib/authorization";
import { someSchema, validateBody } from "@/lib/validations";
import { log } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!user.workspaceId)
    return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const forbidden = requirePermission(user, "resource-name", "create");
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = validateBody(someSchema, body);
  if (!parsed.success) return parsed.response;

  // ... prisma query with workspaceId filter
}
```

**Key conventions:** Always cast `session.user as SessionUser`. Always check `workspaceId`. Always use `validateBody()` with Zod schemas from `validations.ts`. Always use `log.info/warn/error()` instead of raw `console.log`.

## Authorization System

Four-role hierarchy: `OWNER > ADMIN > MANAGER > EMPLOYEE`. Defined in `src/lib/authorization.ts` with a full permission matrix over 25+ resources × 5 actions (`read`, `create`, `update`, `delete`, `approve`).

Use these helpers in routes:

- `requirePermission(user, resource, action)` — returns `403 NextResponse` or `null`
- `requireManagement(user)` — OWNER/ADMIN/MANAGER only
- `requireAdmin(user)` — OWNER/ADMIN only
- `isOwner(user)`, `isEmployee(user)` — boolean checks

EMPLOYEE role has ownership-scoped access enforced at the route level (can only see/edit own records).

## Subscription & Plan Gating

Plans: STARTER (free, 5 employees, 1 location) → TEAM → BUSINESS → ENTERPRISE. Plan configs are in `src/lib/stripe.ts` (`PLANS` object). Use `requireEmployeeSlot(workspaceId)` from `src/lib/subscription.ts` before creating employees to enforce plan limits.

## Validation

All Zod schemas live in `src/lib/validations.ts`. The `validateBody(schema, body)` helper returns `{ success, data }` or `{ success: false, response }` (a 400 NextResponse). Error messages are in German.

## i18n

Cookie-based locale (`de` default, `en` supported). No URL prefix routing. Use `next-intl` hooks in client components, `getLocale()`/`getMessages()` in server components. All user-facing strings should have entries in `messages/de.json` and `messages/en.json`.

## Database

Prisma uses a lazy-initialized client via Proxy (`src/lib/db.ts`) so builds work without `DATABASE_URL`. Enum values are German (e.g., `TimeEntryStatus.ENTWURF`, `AbsenceCategory.URLAUB`, `ShiftStatus.SCHEDULED`). IDs use `cuid()`. Date-only fields use `@db.Date`. Time fields are stored as `String` in `HH:MM` format.

## Testing

Vitest with jsdom environment. Tests in `src/__tests__/`. Use factories from `src/__tests__/helpers/factories.ts` (`buildOwner()`, `buildAdmin()`, `buildManager()`, `buildEmployee()`). API tests mock `next-auth` session and Prisma using `vi.hoisted()` + `vi.mock()`.

```bash
npm run test          # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

## Commits & Linting

Conventional Commits enforced by Husky + commitlint: `feat(scope): message`, `fix(scope): message`. Pre-commit runs ESLint + Prettier via lint-staged on staged `.ts/.tsx` files.

## Database Migrations (CRITICAL — use Supabase MCP)

**⚠️ `npx prisma migrate dev` does NOT work** — the Supabase connection pooler (`aws-1-eu-west-1.pooler.supabase.com:6543`) rejects Prisma migrate connections (P1001).

**Always use the Supabase MCP tools instead:**

### Migration Workflow

1. **Edit** `prisma/schema.prisma` with the new/changed models
2. **List current DB tables** → `mcp_supabase_list_tables` (schemas: `["public"]`)
3. **Compare** Prisma schema models vs existing tables — identify missing tables, columns, indexes, enums
4. **Write migration SQL** — CREATE TYPE (enums), CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE INDEX, foreign keys, enable RLS
5. **Apply** → `mcp_supabase_apply_migration` with a descriptive snake_case name (e.g., `add_autofill_log_and_manager_alert`)
6. **Verify** → `mcp_supabase_execute_sql` to confirm tables/columns exist
7. **Regenerate client** → `npx prisma generate`

### Available MCP Tools

| Tool                                     | Purpose                                       |
| ---------------------------------------- | --------------------------------------------- |
| `mcp_supabase_list_tables`               | See all existing tables, columns, constraints |
| `mcp_supabase_apply_migration`           | Apply DDL migrations (CREATE, ALTER, DROP)    |
| `mcp_supabase_execute_sql`               | Run raw SQL queries (SELECT, verify state)    |
| `mcp_supabase_list_migrations`           | List all applied migrations                   |
| `mcp_supabase_generate_typescript_types` | Generate TS types from DB schema              |

### SQL Conventions for Migrations

- IDs: `TEXT NOT NULL DEFAULT gen_random_uuid()::text`
- Timestamps: `TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Enums: `CREATE TYPE "EnumName" AS ENUM ('VALUE1', 'VALUE2')`
- Always add `ENABLE ROW LEVEL SECURITY` on new tables
- Always add appropriate indexes (workspaceId, foreign keys, query patterns)
- Foreign key naming: `TableName_columnName_fkey`
- Index naming: `TableName_columnName_idx`

## Key Patterns

- **Styling:** `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge). Emerald green palette (`#059669`). All icons are custom TypeScript SVG components in `src/components/icons/`.
- **Error monitoring:** Sentry (client, server, edge configs at project root).
- **Path alias:** `@/*` maps to `./src/*`.
- **Prisma changes:** Edit `schema.prisma`, then migrate via Supabase MCP (see above), then `npx prisma generate`.
- **Build command:** `prisma generate && next build` — Prisma client is generated before Next.js build.
