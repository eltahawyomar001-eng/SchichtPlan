# Shiftfy — Production Readiness Audit

**Date:** 2025-07-14
**Auditor:** Deep automated review of entire codebase
**Scope:** Full-stack SaaS production readiness across 7 dimensions

---

## Executive Summary

Shiftfy is a **feature-rich** application with ~120 API routes, 40+ database models, a solid auth system, and strong UI scaffolding. However, it has **critical gaps in data integrity, test coverage, and operational maturity** that would cause real problems when companies rely on it daily for payroll-relevant shift planning and time tracking.

**Overall readiness: ~60% for production B2B SaaS**

The good news: the architectural foundation is solid. The gaps are fixable with focused effort. Below is every finding, ranked by severity, with specific file references and effort estimates.

---

## Scoring by Dimension

| Dimension                | Score      | Verdict                                                                          |
| ------------------------ | ---------- | -------------------------------------------------------------------------------- |
| **Feature completeness** | ⭐⭐⭐⭐⭐ | Excellent — shifts, time tracking, absences, chat, billing, reports, automations |
| **Security**             | ⭐⭐⭐⭐   | Good — CSP, rate limiting, sanitization, brute-force lockout                     |
| **Auth & authorization** | ⭐⭐⭐⭐   | Good — 4-role RBAC, 2FA, permission matrix                                       |
| **UI/UX robustness**     | ⭐⭐⭐⭐   | Good — 58 loading skeletons, 3-level error boundaries, offline store             |
| **Data integrity**       | ⭐⭐       | **Weak** — race conditions, minimal transactions, no idempotency                 |
| **Test coverage**        | ⭐         | **Critical gap** — 11 test files for 120+ routes (~9%)                           |
| **Operational maturity** | ⭐⭐       | **Weak** — no staging, no DB backups strategy, no alerting, no E2E in CI         |

---

## 🔴 CRITICAL Issues (Must fix before production)

### C1. Race Conditions in Clock-In/Out

**File:** `src/app/api/time-entries/clock/route.ts`
**Problem:** Clock-in does `findFirst` (find active entry) → `create` (new entry) as two separate queries. If two requests arrive simultaneously (e.g., double-tap, spotty network), both see "no active entry" and both create clock-ins.

**Impact:** Duplicate time entries → incorrect payroll → legal liability under German ArbZG.

**Fix:** Wrap in `$transaction` with a unique constraint check, or use `upsert` with proper constraints.

**Effort:** 2-3 hours

---

### C2. Transaction Gaps Across Business-Critical Operations

**Finding:** Only **13 `$transaction` usages** across the entire codebase of **120+ route handlers**.

**Unprotected multi-step operations include:**

| Operation                                          | File                         | Risk                                                                |
| -------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| Create shift + audit log + notification + webhook  | `api/shifts/route.ts`        | Partial shift creation (shift created but audit/notification fails) |
| Create time entry + audit log                      | `api/time-entries/route.ts`  | Orphaned entries without audit trail                                |
| Approve absence + update vacation balance + notify | `api/absences/[id]/route.ts` | Balance mismatch if notification step errors                        |
| Month close + lock + e-signature                   | `api/month-close/route.ts`   | Partially locked months                                             |
| Create employee + dispatch webhook                 | `api/employees/route.ts`     | Silent webhook failures tolerable, but audit log gap is not         |

**Impact:** Data inconsistency under load or transient failures. For payroll software, this is legally critical.

**Fix:** Add `prisma.$transaction([...])` for all multi-step write operations that must be atomic. Side effects (webhooks, push notifications) should remain fire-and-forget OUTSIDE the transaction.

**Effort:** 3-5 days (systematic, route by route)

---

### C3. Test Coverage at ~9%

**Finding:** 11 test files covering authorization, subscription, utils, auto-scheduler, auto-fill, audit-fixes, and route structure. **Zero tests for:**

- Clock-in/out (the most critical flow!)
- Shift CRUD
- Absence CRUD & approval flow
- Time entry CRUD & status changes
- Month close/lock
- Chat messaging
- Service visits & signatures
- Billing checkout & webhook
- Import/export
- All cron jobs (5 of them)

**Impact:** Every code change is a gamble. No regression safety net. Any refactoring (like adding transactions) risks breaking untested flows.

**Fix:** Prioritize tests for:

1. Clock-in/out (race conditions, break enforcement)
2. Shift CRUD (conflict detection, recurring shifts)
3. Absence approval (vacation balance updates)
4. Billing webhook (subscription state machine)
5. Month close (locking semantics)

**Effort:** 2-3 weeks for critical path coverage (~40% route coverage)

---

### C4. No Sentry Integration in API Routes

**Finding:** `Sentry.captureException` is used in error boundaries (frontend) but **zero** API route handlers call `captureException`. Errors are logged via `log.error()` only — if Vercel logs rotate, errors are lost.

**Impact:** Production errors go unnoticed. No alerting, no error tracking, no trend analysis.

**Fix:** Either:

- Add `Sentry.captureException(error)` in every catch block (tedious), OR
- Create a `withErrorHandler` wrapper that catches + logs + sends to Sentry automatically

**Effort:** 1-2 days (wrapper approach)

---

## 🟠 HIGH Issues (Fix within first month)

### H1. TimeEntry GPS Fields Still in Schema

**File:** `prisma/schema.prisma` lines 431-434
**References:** `zeiterfassung/page.tsx` (lines 89-92, 1030-1134), `stempeluhr/page.tsx` (lines 50-51), `time-entries/clock/team/route.ts` (lines 147-148)

**Problem:** Despite DSGVO GPS purge earlier in session, TimeEntry still has `clockInLat`, `clockInLng`, `clockOutLat`, `clockOutLng` columns and UI code referencing them.

**Fix:** Apply the same purge pattern used for Location/Employee/Shift GPS fields.

**Effort:** 3-4 hours + migration

---

### H2. Validation Inconsistency

**Finding:** ~79 routes use `req.json()`. Of those:

- ✅ ~25 use `validateBody(schema, body)` — standardized Zod validation with auto-sanitization
- ❌ ~54 use raw destructuring like `const { name, email } = await req.json()` with NO schema validation

**Unvalidated routes include:**

- `api/shift-templates/route.ts` — raw destructuring of `name, startTime, endTime, color`
- `api/departments/route.ts` — raw destructuring of `name, color, locationId`
- `api/skills/route.ts` — raw destructuring of `name, category`
- `api/clients/route.ts` — raw destructuring of `name, email, phone, address, notes`
- `api/time-entries/clock/route.ts` — raw destructuring of `action, timezone`
- `api/month-close/route.ts` — raw destructuring of `year, month, action`
- `api/chat/channels/[id]/messages/route.ts` — manual validation only for content length
- Plus ~47 more routes

**Impact:** No sanitization runs on unvalidated routes (XSS protection bypass). No type safety. Invalid data reaches the database.

**Fix:** Create Zod schemas for all remaining routes and use `validateBody()` consistently.

**Effort:** 3-4 days

---

### H3. No Staging Environment

**Finding:** `vercel.json` only defines production crons. No evidence of a staging/preview deployment strategy with a separate database. The CI pipeline (`ci.yml`) runs lint → test → build but **deploys directly to production** via Vercel's Git integration.

**Impact:** No way to test migrations, cron jobs, or billing flows before production. Database migrations applied directly to prod via Supabase MCP.

**Fix:**

1. Create a Supabase development branch for staging
2. Use Vercel preview deployments with a staging DB URL
3. Add a deployment gate (manual approval or E2E pass) before production

**Effort:** 1-2 days

---

### H4. File Upload Security Gaps

**File:** `src/app/api/import/route.ts`

**Problems:**

1. **No file size limit** — a 500MB Excel file would crash the serverless function (Vercel has a 4.5MB body limit which helps, but no explicit guard)
2. **No file type validation** — only checks extension (`.csv`), not MIME type or magic bytes
3. **Row-by-row inserts** — each imported employee/shift is a separate `prisma.create()` call in a loop. 1,000 rows = 1,000 DB round trips. No transaction, so partial imports are possible.
4. **No duplicate detection** — importing the same CSV twice creates duplicates
5. **No import limit** — a malicious file with 100,000 rows would timeout

**Fix:** Add file size check, batch inserts via `createMany()` in a transaction, row limit (e.g., 500), duplicate detection.

**Effort:** 1 day

---

### H5. Chat Messages Not Sanitized

**File:** `src/app/api/chat/channels/[id]/messages/route.ts` line 163

**Problem:** Chat messages are validated for length (1-5000 chars) but NOT run through `validateBody()` or `sanitize()`. The `content` field is stored raw. While React auto-escapes in JSX, if messages are ever rendered via `dangerouslySetInnerHTML` or exported, XSS is possible.

**Fix:** Add `sanitize(content)` before storing.

**Effort:** 30 minutes

---

### H6. No Idempotency on Write Endpoints

**Problem:** POST endpoints for shifts, time entries, absences, etc. have no idempotency keys. A network retry (or user double-click) creates duplicate records.

**Fix:** Accept an optional `Idempotency-Key` header; check Redis before processing; return cached response for duplicates.

**Effort:** 1-2 days (generic middleware approach)

---

### H7. E2E Tests Not in CI

**Finding:** Playwright is configured with 3 test files (`e2e/health.spec.ts`, `e2e/protected-routes.spec.ts`, `e2e/auth.spec.ts`) but **CI does not run them** — `ci.yml` only has lint, unit test, and build jobs.

**Fix:** Add a Playwright job to CI that runs against a preview deployment.

**Effort:** 1 day

---

## 🟡 MEDIUM Issues (Fix within first quarter)

### M1. No Database Backup Strategy Documented

**Problem:** Relying entirely on Supabase's built-in daily backups (Pro plan). No documented restore procedure, no backup verification tests, no point-in-time recovery configuration documented.

**Fix:** Document backup/restore procedures. Verify Supabase PITR is enabled. Test a restore.

**Effort:** Half day

---

### M2. Cron Job Error Handling

**Finding:** 5 cron jobs in `vercel.json`. Each has CRON_SECRET auth. But:

- No dead-letter queue or alert if a cron silently fails
- `break-reminder` runs every 15 minutes — if it errors, it retries in 15 min without notification
- `data-retention` deletes old data — a bug here causes irreversible data loss

**Fix:** Add Sentry capture in cron handlers. Consider a cron-monitoring service (e.g., Cronitor, Better Uptime).

**Effort:** 1 day

---

### M3. Webhook Delivery Blocking API Response

**File:** `src/lib/webhooks.ts`

**Problem:** Webhook delivery uses `RETRY_DELAYS = [1000, 3000, 10000]` with sequential retries inside the request handler. Worst case: 4 attempts × 10s timeout = 40+ seconds blocking. The `.catch()` in routes makes it fire-and-forget, but webhook retries still consume serverless function execution time.

**Fix:** Queue webhook deliveries to a background job (or accept single-attempt delivery with a webhook retry queue in Redis).

**Effort:** 1-2 days

---

### M4. No Request Size Limits on JSON Endpoints

**Problem:** No explicit `Content-Length` check on POST/PUT/PATCH handlers. While Vercel imposes a 4.5MB limit, there's no application-level guard. A 4MB JSON body would be parsed and processed.

**Fix:** Add a middleware check or early `Content-Length` validation for JSON endpoints (e.g., reject > 100KB).

**Effort:** 2 hours

---

### M5. Missing Compound Indexes

**Schema observations:**

- `Notification` table has no compound index for `[userId, isRead, createdAt]` — the most common query pattern (unread notifications for a user, sorted by date)
- `AuditLog` has no index for `[workspaceId, performedAt]` — time-range queries will table-scan
- `ESignature` has no index for `[workspaceId, createdAt]`

**Fix:** Add targeted compound indexes.

**Effort:** 1 hour + migration

---

### M6. No Rate Limiting on File Upload

**File:** `src/app/api/import/route.ts`

**Problem:** The import endpoint uses the standard API rate limit (60/60s). An attacker could upload 60 large files per minute, consuming significant server resources.

**Fix:** Apply a stricter rate limit (e.g., 5/60s) for import endpoints.

**Effort:** 30 minutes

---

### M7. Inconsistent Error Response Format

**Finding:** Error responses vary across routes:

- Some: `{ error: "Error loading" }` (generic)
- Some: `{ error: "Ungültige Eingabe", details: [...] }` (structured with field errors)
- Some: `{ error: "SERVER_ERROR" }` (code-style)
- Some: `{ error: "Not found" }` (English)
- Some: `{ error: "Fehler beim DATEV-Upload" }` (German)

**Impact:** Frontend error handling has to account for multiple formats. No consistent error code system for programmatic handling.

**Fix:** Standardize on `{ error: string, code?: string, details?: object }` format. Use error codes, not locale-specific messages, for programmatic use.

**Effort:** 2-3 days

---

### M8. No Graceful Degradation for Redis Outage

**Finding:** Rate limiting depends on Upstash Redis. If Redis is down, the middleware behavior depends on the Upstash client's error handling — requests might be blocked entirely or rate limiting might fail open.

**Fix:** Add try/catch around rate limiting with fail-open behavior + Sentry alert.

**Effort:** 2 hours

---

## 🟢 LOW Issues (Nice to have)

### L1. No API Versioning

All routes are at `/api/*` with no version prefix. Breaking changes will affect all clients.

### L2. No OpenAPI Spec for External Consumers

There's a `/api/docs` route with a partial OpenAPI spec, but it's hardcoded and likely outdated.

### L3. No Request Logging / Audit Trail for Read Operations

Write operations create `AuditLog` entries, but there's no request logging for sensitive reads (e.g., viewing employee data, exporting payroll).

### L4. JWT Session Token 7-Day Expiry Without Rotation

`maxAge: 7 * 24 * 60 * 60` in auth config. If a token is stolen, it's valid for 7 days. Consider shorter expiry with silent refresh.

### L5. No Automated Dependency Security Scanning

No `npm audit` in CI, no Dependabot/Snyk configuration.

### L6. `dangerouslySetInnerHTML` Usage

Found in `src/components/seo/JsonLd.tsx` (line 183, 207) — used for JSON-LD structured data with `JSON.stringify`. Low risk since it's server-rendered JSON, not user content, but worth noting.

---

## ✅ What's Already Strong

| Area                       | Details                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Security headers**       | CSP with nonce, HSTS, X-Frame-Options, nosniff, Permissions-Policy                |
| **Rate limiting**          | Upstash Redis sliding window (auth: 10/60s, API: 60/60s) with Retry-After headers |
| **Input sanitization**     | `deepSanitize()` in `validateBody()` strips XSS patterns recursively              |
| **Brute-force protection** | 5 failed logins → 15-minute lockout via Redis                                     |
| **Auth system**            | 4-role RBAC, 2FA (TOTP), Google/Azure AD OAuth, email verification                |
| **Loading states**         | 58 `loading.tsx` skeleton files across all dashboard pages                        |
| **Error boundaries**       | 3-level error boundaries with Sentry capture (global → app → dashboard)           |
| **Structured logging**     | JSON logger in production with requestId support                                  |
| **Health check**           | `/api/health` checks DB + Redis + memory stats                                    |
| **Webhook system**         | HMAC-signed with 3-retry delivery + exponential backoff                           |
| **Stripe webhook**         | Signature verification + Redis-backed idempotency guard                           |
| **Pagination**             | Consistent `parsePagination()` helper with MAX_PAGE_SIZE=200 cap                  |
| **Plan gating**            | `requirePlanFeature()`, `requireEmployeeSlot()`, `requireLocationSlot()`          |
| **Offline support**        | IndexedDB-backed offline store for service visits with sync queue                 |
| **CI pipeline**            | GitHub Actions: lint → typecheck → unit test → build                              |
| **Conventional commits**   | Husky + commitlint enforcing `feat(scope):` format                                |
| **Env validation**         | `validateEnv()` at startup with required/recommended var checks                   |
| **DSGVO compliance**       | Data retention cron, workspace wipe, data export, anonymization, cookie consent   |
| **Cron auth**              | All 5 cron jobs verify `CRON_SECRET` bearer token                                 |
| **i18n**                   | Complete DE/EN translations with cookie-based locale switching                    |

---

## Prioritized Roadmap

### Phase 1: Data Integrity (Week 1-2)

| #   | Task                                              | Effort | Impact                                |
| --- | ------------------------------------------------- | ------ | ------------------------------------- |
| C1  | Fix clock-in/out race condition with transactions | 3h     | 🔴 Prevents duplicate payroll entries |
| C2  | Add transactions to 15 critical write operations  | 3-5d   | 🔴 Prevents data inconsistency        |
| H1  | Purge TimeEntry GPS fields                        | 4h     | 🟠 DSGVO compliance completion        |
| H5  | Sanitize chat messages                            | 30m    | 🟠 Closes XSS vector                  |

### Phase 2: Observability (Week 2-3)

| #   | Task                                                     | Effort | Impact                      |
| --- | -------------------------------------------------------- | ------ | --------------------------- |
| C4  | Add Sentry `captureException` wrapper for all API routes | 1-2d   | 🔴 Errors become visible    |
| M2  | Add Sentry to cron jobs + monitoring service             | 1d     | 🟡 Prevents silent failures |
| M8  | Graceful Redis failure handling                          | 2h     | 🟡 Prevents total outage    |

### Phase 3: Validation & Security (Week 3-4)

| #   | Task                                             | Effort | Impact                                   |
| --- | ------------------------------------------------ | ------ | ---------------------------------------- |
| H2  | Create Zod schemas for all 54 unvalidated routes | 3-4d   | 🟠 Consistent sanitization + type safety |
| H4  | Harden file import (size, type, batch, limits)   | 1d     | 🟠 Prevents abuse                        |
| H6  | Add idempotency key middleware                   | 1-2d   | 🟠 Prevents duplicate records            |
| M4  | Add request size limits                          | 2h     | 🟡 Defense in depth                      |

### Phase 4: Testing (Week 4-6)

| #   | Task                                                    | Effort | Impact                   |
| --- | ------------------------------------------------------- | ------ | ------------------------ |
| C3  | Write tests for clock-in/out, shifts, absences, billing | 2-3w   | 🔴 Regression safety net |
| H7  | Add Playwright E2E to CI pipeline                       | 1d     | 🟠 Catch UI regressions  |

### Phase 5: Operational Maturity (Week 6-8)

| #   | Task                                            | Effort | Impact                  |
| --- | ----------------------------------------------- | ------ | ----------------------- |
| H3  | Set up staging environment with separate DB     | 1-2d   | 🟠 Safe testing ground  |
| M1  | Document backup/restore procedures, verify PITR | 4h     | 🟡 Disaster recovery    |
| M3  | Move webhook retries to background queue        | 1-2d   | 🟡 Faster API responses |
| M5  | Add compound indexes for Notification, AuditLog | 1h     | 🟡 Query performance    |
| M7  | Standardize error response format               | 2-3d   | 🟡 Better DX            |

---

## Total Effort Estimate

| Phase                   | Duration   | Impact                                      |
| ----------------------- | ---------- | ------------------------------------------- |
| Phase 1: Data Integrity | ~2 weeks   | Prevents data corruption and payroll errors |
| Phase 2: Observability  | ~1 week    | Makes production issues visible             |
| Phase 3: Validation     | ~1.5 weeks | Closes security gaps                        |
| Phase 4: Testing        | ~3 weeks   | Enables safe iteration                      |
| Phase 5: Operations     | ~2 weeks   | Professional SaaS operations                |

**Total: ~10 weeks of focused work to reach production-grade quality.**

After Phase 1-3 (~4.5 weeks), the system would be safe enough for early adopters.
After Phase 4-5 (~10 weeks total), companies can rely on it daily.

---

## Bottom Line

Shiftfy has impressive feature breadth and solid security foundations. The critical gaps are:

1. **Data integrity** — race conditions and missing transactions in payroll-relevant flows
2. **Test coverage** — 9% is dangerously low for software that calculates wages
3. **Observability** — errors happen in production but nobody would know
4. **Validation** — 54 routes accept unvalidated input

These are all **solvable problems** that follow known patterns. The architecture doesn't need to change — it's well-structured. It needs hardening.
