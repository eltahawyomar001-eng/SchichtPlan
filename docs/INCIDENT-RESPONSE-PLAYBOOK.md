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

## Monitoring Endpoints

- **Health Check:** `GET /api/health` — returns 200 if DB + Redis are reachable
- **Sentry Dashboard:** https://sentry.io — error tracking and performance monitoring
- **BetterStack Status Page:** Configured separately (see MANUAL TASKS)
- **Vercel Dashboard:** Deployment status and function logs

## Common Incident Scenarios

### Database Connection Exhaustion

**Symptoms:** 500 errors across all API routes, Prisma `P1001` errors
**Root Cause:** Connection pool exhausted (max=15)
**Fix:** Scale up `DATABASE_POOL_MAX` env var, investigate long-running queries
**Prevention:** Monitor active connections, add query timeouts

### Redis Unavailable

**Symptoms:** Slow responses (fallback to in-memory), cache misses
**Root Cause:** Upstash Redis outage or rate limit
**Fix:** System auto-degrades to in-memory fallback. Monitor for Upstash recovery.
**Prevention:** Upstash Pro plan with higher rate limits

### Webhook Delivery Failures

**Symptoms:** Webhook endpoints not receiving events
**Root Cause:** Target server down or timeout (10s limit)
**Fix:** Check target server health, review Sentry logs for delivery failures
**Prevention:** Monitor webhook delivery success rate

### Authentication Failures

**Symptoms:** Users unable to login, 401 errors on API calls
**Root Cause:** JWT secret rotation, session provider issue
**Fix:** Verify `NEXTAUTH_SECRET` env var, check NextAuth configuration
**Prevention:** Never rotate secrets without coordinated deployment
