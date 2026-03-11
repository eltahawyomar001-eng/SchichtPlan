# Shiftfy — Backup & Restore Procedures

**Version:** 1.0
**Last updated:** 2025-07-14
**Owner:** Engineering / DevOps

---

## 1. Overview

Shiftfy relies on **Supabase (PostgreSQL)** as its primary data store. This document describes the backup strategy, restore procedures, and disaster recovery targets for the production database.

---

## 2. Recovery Objectives

| Metric                             | Target    | Notes                              |
| ---------------------------------- | --------- | ---------------------------------- |
| **RPO** (Recovery Point Objective) | ≤ 1 hour  | Maximum acceptable data loss       |
| **RTO** (Recovery Time Objective)  | ≤ 4 hours | Maximum time to restore service    |
| **Backup Retention**               | 30 days   | Daily backups retained for 30 days |

---

## 3. Backup Strategy

### 3.1 Supabase Automated Backups (Primary)

Supabase provides automatic database backups depending on the plan:

| Plan       | Backup Frequency | PITR            | Retention |
| ---------- | ---------------- | --------------- | --------- |
| Free       | None             | No              | —         |
| Pro        | Daily            | Optional add-on | 7 days    |
| Team       | Daily            | Included        | 14 days   |
| Enterprise | Daily + PITR     | Included        | 30+ days  |

**Action required:** Ensure your Supabase project is on **Pro plan or higher** with **PITR (Point-in-Time Recovery) enabled**.

### 3.2 Point-in-Time Recovery (PITR)

PITR uses PostgreSQL's Write-Ahead Log (WAL) archiving to allow recovery to any point in time within the retention window.

**To enable PITR:**

1. Go to Supabase Dashboard → Project Settings → Add-ons
2. Enable "Point in Time Recovery"
3. Confirm the additional cost

**Verification:** Check that PITR is active:

- Dashboard → Database → Backups → "Point in Time Recovery" tab should be visible

### 3.3 Manual Backup (Secondary)

For critical operations (schema migrations, data migrations), create a manual backup:

```bash
# Export full database via pg_dump
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump

# Export schema only (for disaster recovery reference)
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --file=schema_$(date +%Y%m%d_%H%M%S).sql
```

**Store backups in:**

- Encrypted cloud storage (e.g., AWS S3 with SSE-S3)
- Keep at least 3 recent manual backups

---

## 4. Restore Procedures

### 4.1 Restore from Supabase Daily Backup

1. Go to **Supabase Dashboard → Database → Backups**
2. Select the backup point to restore
3. Click **Restore** — this will replace the current database
4. Wait for the restore to complete (progress shown in dashboard)
5. Verify application connectivity
6. Run `npx prisma generate` if schema changed

> ⚠️ **Warning:** Restoring replaces ALL data in the database. Any data written after the backup point will be lost.

### 4.2 Restore from PITR

1. Go to **Supabase Dashboard → Database → Backups → Point in Time Recovery**
2. Select the target timestamp to restore to
3. Confirm the restore
4. Monitor progress in the dashboard
5. Verify data integrity

### 4.3 Restore from Manual Backup

```bash
# Restore from custom-format dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --no-owner \
  --no-acl \
  backup_YYYYMMDD_HHMMSS.dump

# After restore, regenerate Prisma client
npx prisma generate
```

### 4.4 Post-Restore Checklist

After any restore operation:

- [ ] Verify application can connect to database
- [ ] Check `/api/health` endpoint returns `{ status: "ok" }`
- [ ] Verify user authentication works (login/logout)
- [ ] Spot-check recent data (latest shifts, time entries, absences)
- [ ] Check Stripe webhook endpoint is receiving events
- [ ] Verify cron jobs are executing (check Vercel dashboard)
- [ ] Monitor Sentry for any new errors
- [ ] Notify affected users if data loss occurred

---

## 5. Pre-Migration Backup Protocol

Before applying any database migration:

1. **Create a manual backup** (see §3.3)
2. **Document the migration** — what changes, what could go wrong
3. **Apply to staging first** (Supabase development branch)
4. **Apply to production** via `mcp_supabase_apply_migration`
5. **Verify** via `mcp_supabase_execute_sql`
6. **Regenerate Prisma client** — `npx prisma generate`

---

## 6. Disaster Recovery Scenarios

### Scenario A: Accidental Data Deletion

1. Identify the timestamp of the deletion
2. Use PITR to restore to just before the deletion
3. Or: restore from the most recent daily backup
4. Follow post-restore checklist

### Scenario B: Corrupted Migration

1. Stop application deployments (disable Vercel auto-deploy)
2. Restore from the backup taken pre-migration (§5)
3. Fix the migration SQL
4. Re-apply the corrected migration
5. Re-enable deployments

### Scenario C: Full Database Loss

1. Contact Supabase support immediately
2. Restore from the most recent daily backup
3. Accept data loss up to RPO (≤ 1 hour with PITR, ≤ 24 hours without)
4. Follow post-restore checklist
5. Conduct incident post-mortem

---

## 7. Backup Verification Schedule

| Frequency     | Activity                                        |
| ------------- | ----------------------------------------------- |
| **Weekly**    | Verify Supabase backup exists in dashboard      |
| **Monthly**   | Test restore to a Supabase development branch   |
| **Quarterly** | Full disaster recovery drill (restore + verify) |

---

## 8. Contacts

| Role             | Contact                        |
| ---------------- | ------------------------------ |
| Database Admin   | (configure in team settings)   |
| Supabase Support | support@supabase.io            |
| On-call Engineer | (configure PagerDuty/Opsgenie) |

---

## 9. Related Documents

- `docs/PRODUCTION-READINESS-AUDIT.md` — Full production audit
- `docs/DSGVO-COMPLIANCE-REPORT.md` — Data protection compliance
- `docs/VERARBEITUNGSVERZEICHNIS.md` — Processing activities register
