# Staging Environment Guide

## Overview

Shiftfy uses **Vercel Preview Deployments** + **Supabase Database Branching** for staging. Every pull request automatically gets a preview URL with its own isolated database branch.

---

## Architecture

```
Production                      Staging (per PR)
┌──────────────┐               ┌──────────────────────┐
│ Vercel Prod  │               │ Vercel Preview        │
│ main branch  │               │ PR branch             │
│              │               │                       │
│ ┌──────────┐ │               │ ┌──────────────────┐  │
│ │ Supabase │ │               │ │ Supabase Branch  │  │
│ │ main DB  │ │               │ │ (auto-created)   │  │
│ └──────────┘ │               │ └──────────────────┘  │
└──────────────┘               └──────────────────────┘
```

---

## Setup Instructions

### 1. Enable Vercel Preview Deployments

Already enabled by default. Every PR push creates a preview at:

```
https://schichtplan-<hash>-<team>.vercel.app
```

### 2. Configure Supabase Branching

1. Go to your Supabase project → **Settings → Branching**
2. Enable **Git branching integration**
3. Connect to your GitHub repository
4. Each PR will auto-create a Supabase branch with all migrations applied

### 3. Environment Variables for Preview

In **Vercel Dashboard → Settings → Environment Variables**, set these for the **Preview** environment:

| Variable                   | Value                               | Notes                       |
| -------------------------- | ----------------------------------- | --------------------------- |
| `DATABASE_URL`             | Auto-set by Supabase integration    | Points to branch DB         |
| `NEXTAUTH_URL`             | `https://${VERCEL_URL}`             | Dynamic preview URL         |
| `NEXTAUTH_SECRET`          | Same as production                  | Shared secret               |
| `STRIPE_SECRET_KEY`        | Stripe **test** key (`sk_test_...`) | Never production key        |
| `STRIPE_WEBHOOK_SECRET`    | Test webhook secret                 | Separate from prod          |
| `STRIPE_SIMULATION_MODE`   | `true`                              | Skip real Stripe in staging |
| `UPSTASH_REDIS_REST_URL`   | Staging Redis URL                   | Separate from production    |
| `UPSTASH_REDIS_REST_TOKEN` | Staging Redis token                 | Separate from production    |
| `SENTRY_DSN`               | Same or staging-specific DSN        | Tags auto-set environment   |
| `RESEND_API_KEY`           | Test API key or empty               | Prevents real emails        |

### 4. Seed Data for Staging

Create a seed script at `prisma/seed-staging.ts`:

```typescript
// Run with: npx tsx prisma/seed-staging.ts
// Creates demo workspace, users, employees for QA testing
```

---

## Workflow

### For Developers

1. Create a feature branch from `main`
2. Push to GitHub → PR auto-created
3. Vercel deploys preview + Supabase creates DB branch
4. Test at the preview URL
5. QA approves → merge to `main`
6. Supabase branch merges migrations → Vercel deploys to production

### For QA

1. Open the Vercel preview link from the PR
2. Log in with staging test credentials
3. Test the feature
4. Report issues as PR comments

### Database Migrations in Staging

Migrations are applied via **Supabase MCP tools** (not `prisma migrate dev`):

```bash
# From the PR branch context:
# 1. Edit prisma/schema.prisma
# 2. Apply migration via MCP
# 3. Verify via MCP execute_sql
# 4. Run prisma generate
npx prisma generate
```

When the PR merges, migrations are automatically applied to production via `mcp_supabase_merge_branch`.

---

## Supabase Branch Management (MCP)

| Action               | MCP Tool                       |
| -------------------- | ------------------------------ |
| List branches        | `mcp_supabase_list_branches`   |
| Create branch        | `mcp_supabase_create_branch`   |
| Apply migration      | `mcp_supabase_apply_migration` |
| Merge to production  | `mcp_supabase_merge_branch`    |
| Reset branch         | `mcp_supabase_reset_branch`    |
| Rebase on production | `mcp_supabase_rebase_branch`   |
| Delete branch        | `mcp_supabase_delete_branch`   |

---

## CI Pipeline (Staging)

The existing CI pipeline (`.github/workflows/ci.yml`) runs on every PR:

1. **lint-and-typecheck** — ESLint + TypeScript strict
2. **test** — 340+ unit tests via Vitest
3. **security-audit** — `npm audit`
4. **build** — Full production build
5. **e2e** — Playwright end-to-end tests (against Vercel preview)

---

## Checklist: Setting Up Staging for the First Time

- [ ] Enable Supabase Git branching in project settings
- [ ] Connect Supabase to GitHub repository
- [ ] Set preview environment variables in Vercel
- [ ] Create separate Upstash Redis instance for staging
- [ ] Set `STRIPE_SIMULATION_MODE=true` for preview
- [ ] Verify CI pipeline runs on PRs
- [ ] Create staging seed data script
- [ ] Test full PR → preview → merge flow
- [ ] Verify Supabase branch auto-creation on PR

---

## Security Notes

- **Never** use production Stripe keys in staging
- **Never** share the production `DATABASE_URL` with preview deployments
- Staging Redis should be a separate instance to avoid polluting production rate limits
- Set `RESEND_API_KEY` to empty or a test key to prevent real emails
- Sentry automatically tags deployments by environment (`preview` vs `production`)
