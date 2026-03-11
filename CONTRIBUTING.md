# Contributing to Shiftfy

Thank you for your interest in contributing! This guide covers the development workflow, conventions, and PR process.

## Prerequisites

- **Node.js** ≥ 22.0.0
- **npm** ≥ 11.0.0
- **PostgreSQL** 16+ (local or Docker)
- **Upstash Redis** account (optional — rate limiting, caching degrade gracefully without it)

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/<org>/shiftfy.git
cd shiftfy

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local
# → Fill in DATABASE_URL, NEXTAUTH_SECRET, etc.

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npm run db:migrate:deploy

# 6. (Optional) Seed demo data
npm run db:seed

# 7. Start dev server
npm run dev
```

### Docker Alternative

```bash
docker compose up -d
```

This starts the app, PostgreSQL 16, and Redis 7 with healthchecks.

## Project Structure

| Path                    | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `src/app/(auth)/`       | Public auth pages (German URL slugs)        |
| `src/app/(dashboard)/`  | Protected pages (session-guarded in layout) |
| `src/app/api/`          | REST API route handlers                     |
| `src/lib/`              | Core business logic                         |
| `src/components/`       | React components (UI, layout, icons)        |
| `prisma/schema.prisma`  | Database schema (30+ models)                |
| `messages/{de,en}.json` | i18n translations                           |
| `e2e/`                  | Playwright E2E tests                        |
| `src/__tests__/`        | Vitest unit/integration tests               |

## Development Conventions

### Code Style

- **TypeScript** strict mode — no `any` casts
- **Tailwind CSS 4** — use `cn()` from `src/lib/utils.ts` for conditional classes
- **Emerald green** palette (`#059669`) for brand colors
- **Icons** are custom TypeScript SVG components in `src/components/icons/`

### API Route Pattern

Every API route follows this structure:

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

  // ... prisma query — ALWAYS filter by workspaceId
}
```

### Authorization

Four-role hierarchy: `OWNER > ADMIN > MANAGER > EMPLOYEE`

- `requirePermission(user, resource, action)` — returns `403` or `null`
- `requireManagement(user)` — OWNER/ADMIN/MANAGER only
- `requireAdmin(user)` — OWNER/ADMIN only

### Validation

All Zod schemas live in `src/lib/validations.ts`. Use `validateBody(schema, body)` — it returns a typed result or a 400 response.

### Logging

Use `log.info()`, `log.warn()`, `log.error()` from `src/lib/logger.ts` — never raw `console.log`.

### i18n

- Cookie-based locale (DE default, EN supported)
- All user-facing strings must have entries in both `messages/de.json` and `messages/en.json`
- Use `next-intl` hooks in client components, `getLocale()`/`getMessages()` in server components

## Database Migrations

> ⚠️ `npx prisma migrate dev` does **not** work with the Supabase connection pooler.

Use the **Supabase MCP tools** instead:

1. Edit `prisma/schema.prisma`
2. List existing tables → `mcp_supabase_list_tables`
3. Write migration SQL (CREATE/ALTER TABLE, enums, indexes)
4. Apply → `mcp_supabase_apply_migration`
5. Verify → `mcp_supabase_execute_sql`
6. Regenerate client → `npx prisma generate`

### SQL Conventions

- IDs: `TEXT NOT NULL DEFAULT gen_random_uuid()::text`
- Timestamps: `TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Enums: `CREATE TYPE "EnumName" AS ENUM ('VALUE1', 'VALUE2')`
- Always enable RLS on new tables
- Index naming: `TableName_columnName_idx`
- FK naming: `TableName_columnName_fkey`

## Testing

```bash
npm run test            # single run (Vitest)
npm run test:watch      # watch mode
npm run test:coverage   # with coverage (70% threshold enforced)
npm run test:e2e        # Playwright E2E
npm run test:e2e:ui     # Playwright interactive UI
```

### Test Conventions

- Tests in `src/__tests__/` mirroring the source structure
- Use factories from `src/__tests__/helpers/factories.ts`:
  - `buildOwner()`, `buildAdmin()`, `buildManager()`, `buildEmployee()`
- API tests mock NextAuth session and Prisma via `vi.hoisted()` + `vi.mock()`

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by Husky + commitlint:

```
feat(scope): add employee export
fix(auth): handle expired 2FA codes
chore(deps): bump next to 16.2.0
docs(api): update OpenAPI spec
test(shifts): add overlap validation tests
```

Valid types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `style`, `build`

Pre-commit hooks run ESLint + Prettier on staged `.ts/.tsx` files via lint-staged.

## Pull Request Process

1. **Branch** from `main` with a descriptive name: `feat/employee-export`, `fix/2fa-recovery`
2. **Write tests** for new features — coverage thresholds are enforced
3. **Run tests locally** before pushing: `npm run test`
4. **Create PR** with a clear description of what changed and why
5. **CI must pass** — tests, lint, build, security audit, E2E
6. **Request review** from at least one team member
7. **Squash merge** into `main`

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable                   | Required    | Description                                |
| -------------------------- | ----------- | ------------------------------------------ |
| `DATABASE_URL`             | ✅          | PostgreSQL connection string (pooled)      |
| `DIRECT_URL`               | ✅          | PostgreSQL direct connection (migrations)  |
| `NEXTAUTH_SECRET`          | ✅          | NextAuth JWT signing secret                |
| `NEXTAUTH_URL`             | ✅          | App base URL                               |
| `ENCRYPTION_KEY`           | ✅          | 32-byte hex key for 2FA secret encryption  |
| `STRIPE_SECRET_KEY`        | ✅          | Stripe API key                             |
| `UPSTASH_REDIS_REST_URL`   | Recommended | Upstash Redis URL (rate limiting, caching) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Upstash Redis token                        |
| `DATABASE_POOL_MAX`        | Optional    | Max DB connections (default: 5)            |
| `CORS_ALLOWED_ORIGINS`     | Optional    | Comma-separated allowed CORS origins       |

## Questions?

Open a discussion or reach out to the maintainers. Welcome aboard! 🚀
