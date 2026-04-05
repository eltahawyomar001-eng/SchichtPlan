# Infrastructure Cost Report / Infrastruktur-Kostenbericht

> **Last updated / Zuletzt aktualisiert:** 2025-07-04
> **Currency / Währung:** USD ($) and EUR (€) where applicable
> **Billing cycle / Abrechnungszyklus:** Monthly / Monatlich

---

# 🇬🇧 ENGLISH

## Executive Summary

Shiftfy's production infrastructure runs on **7 external services** with a total fixed monthly cost of **~$104 USD/month** (~€96/month). Stripe charges are purely transactional (no monthly fee). Domain costs add ~€1.50/month amortized.

### Monthly Fixed Costs at a Glance

| #   | Service                 | Plan             | Monthly Cost (USD) | Monthly Cost (EUR) |
| --- | ----------------------- | ---------------- | -----------------: | -----------------: |
| 1   | **Vercel**              | Pro              |             $20.00 |            ~€18.50 |
| 2   | **Supabase**            | Pro              |             $25.00 |            ~€23.10 |
| 3   | **GitHub Copilot**      | Pro (Individual) |             $39.00 |            ~€36.00 |
| 4   | **Resend**              | Pro              |             $20.00 |            ~€18.50 |
| 5   | **Sentry**              | Developer (Free) |              $0.00 |              €0.00 |
| 6   | **Upstash Redis**       | Free             |              $0.00 |              €0.00 |
| 7   | **Stripe**              | Pay-as-you-go    |              $0.00 |              €0.00 |
| 8   | **Domain** (shiftfy.de) | Annual amortized |             ~$1.60 |             ~€1.50 |
|     | **TOTAL FIXED**         |                  |       **~$105.60** |        **~$97.60** |

---

## 1. Vercel — Hosting & Edge Platform

|                    |                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **Plan**           | Pro                                                                                             |
| **Monthly cost**   | **$20.00/month** per team member                                                                |
| **What it covers** | Next.js 16 hosting, serverless functions, edge middleware, CDN, SSL, CI/CD, preview deployments |
| **URL**            | https://vercel.com/pricing                                                                      |

### Included in Pro ($20/month)

| Resource                       | Included Free          | Overage Rate  |
| ------------------------------ | :--------------------- | :------------ |
| Edge Requests                  | 1M/month               | $0.65 per 1M  |
| Fast Data Transfer             | 100 GB/month           | $0.15/GB      |
| Serverless Function Active CPU | 4 hours/month          | $0.18/hr      |
| Serverless Provisioned Memory  | 360 GB-hrs/month       | —             |
| Function Invocations           | 1M/month               | $0.60 per 1M  |
| Blob Storage                   | 1 GB                   | $0.15/GB      |
| Blob Simple Ops                | 10,000/month           | $0.004 per 1K |
| ISR Reads                      | 1M/month               | $4.50 per 1M  |
| ISR Writes                     | 200,000/month          | $8.00 per 1M  |
| Image Optimization             | 5,000 transforms/month | $5 per 1K     |
| Cron Jobs                      | ✅ Included            | —             |
| Web Analytics                  | 50,000 events/month    | $0.65 per 10K |
| Speed Insights                 | 10,000 events/month    | —             |

### Shiftfy Usage Notes

- **5 Cron Jobs** configured in `vercel.json`:
  - `generate-time-entries` — daily at 02:00
  - `overtime-check` — weekly Monday 03:00
  - `payroll-lock` — monthly 1st at 04:00
  - `break-reminder` — every 15 minutes
  - `data-retention` — weekly Sunday 04:30
- **Vercel Blob** used minimally (blob-cleanup route only, documents removed during DSGVO audit)
- **No Vercel Analytics add-on** — basic Web Analytics (50K events) is included

### ⚠️ Potential Overage Risks

- `break-reminder` runs **96 times/day** (2,880/month) — each is 1 function invocation, well within 1M limit
- Early-stage traffic unlikely to exceed 1M edge requests or 100GB transfer

---

## 2. Supabase — PostgreSQL Database

|                    |                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| **Plan**           | Pro                                                                                                     |
| **Monthly cost**   | **$25.00/month**                                                                                        |
| **What it covers** | Managed PostgreSQL, connection pooler (PgBouncer), 8 GB database space, daily backups, 250 GB bandwidth |
| **URL**            | https://supabase.com/pricing                                                                            |

### Included in Pro ($25/month)

| Resource           | Included Free              | Overage Rate |
| ------------------ | :------------------------- | :----------- |
| Database Size      | 8 GB                       | $0.125/GB    |
| Bandwidth          | 250 GB/month               | $0.09/GB     |
| Daily Backups      | 7 days retention           | —            |
| Pooler Connections | Unlimited (via Supavisor)  | —            |
| Realtime           | 500 concurrent connections | —            |
| Storage            | 100 GB                     | $0.021/GB    |
| Edge Functions     | 2M invocations/month       | $2 per 1M    |

### Shiftfy Usage Notes

- **Prisma 7** connects via **Supabase connection pooler** (`pooler.supabase.com:6543`)
- `DATABASE_POOL_MAX=5` configured — lightweight connection usage
- **30+ Prisma models** — database size likely 100 MB–2 GB range for early stage
- `DIRECT_URL` used for migrations only
- ⚠️ `prisma migrate dev` does NOT work via pooler — migrations applied via Supabase MCP/Dashboard

---

## 3. GitHub Copilot — AI Development Assistant

|                    |                                                                                  |
| ------------------ | -------------------------------------------------------------------------------- |
| **Plan**           | Pro (Individual)                                                                 |
| **Monthly cost**   | **$39.00/month**                                                                 |
| **What it covers** | AI code completion, chat, agent mode, Claude Sonnet 4 access, multi-file editing |
| **URL**            | https://github.com/features/copilot                                              |

### Notes

- Development-only cost (not a production runtime dependency)
- Used for all Shiftfy development work (schema design, API routes, tests, DSGVO compliance)
- Does NOT affect end-user billing or production infrastructure

---

## 4. Resend — Transactional Email

|                    |                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Plan**           | Pro                                                                                       |
| **Monthly cost**   | **$20.00/month**                                                                          |
| **What it covers** | 50,000 emails/month, 10 custom domains, no daily limit, DKIM/SPF/DMARC, webhook endpoints |
| **URL**            | https://resend.com/pricing                                                                |

### Included in Pro ($20/month)

| Resource          | Limit                  |
| ----------------- | :--------------------- |
| Emails per month  | 50,000                 |
| Daily limit       | No limit               |
| Custom domains    | 10                     |
| Team members      | 5                      |
| Webhook endpoints | 10                     |
| Overage           | $0.90 per 1,000 emails |

### Shiftfy Usage Notes

- Used for: password resets, email verification, shift notifications, absence approvals, invitation emails
- Configured in `src/lib/notifications/email.ts` via `RESEND_API_KEY`
- From address: `noreply@shiftfy.de` (custom domain)
- Early-stage usage: likely <1,000 emails/month — well within 50K limit

---

## 5. Sentry — Error Monitoring

|                    |                                                               |
| ------------------ | ------------------------------------------------------------- |
| **Plan**           | Developer (Free)                                              |
| **Monthly cost**   | **$0.00**                                                     |
| **What it covers** | 5K errors/month, 50 session replays, 5M tracing spans, 1 user |
| **URL**            | https://sentry.io/pricing                                     |

### Included in Developer (Free)

| Resource        | Limit           |
| --------------- | :-------------- |
| Errors          | 5,000/month     |
| Session Replays | 50/month        |
| Tracing Spans   | 5M/month        |
| Users           | 1               |
| Data Retention  | 30-day lookback |

### Shiftfy Usage Notes

- **DSGVO-compliant** integration: session replay & tracing gated behind analytics cookie consent
- Error monitoring runs under legitimate interest (Art. 6(1)(f) DSGVO) — no consent required
- Configured via `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN`
- Client, server, and edge configs at project root (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`)

### ⚠️ Upgrade Considerations

- If team grows beyond 1 developer or errors exceed 5K/month → **Team plan at $26/month** (billed annually)

---

## 6. Upstash Redis — Rate Limiting & Caching

|                    |                                   |
| ------------------ | --------------------------------- |
| **Plan**           | Free                              |
| **Monthly cost**   | **$0.00**                         |
| **What it covers** | 256 MB data, 500K commands/month  |
| **URL**            | https://upstash.com/pricing/redis |

### Included in Free

| Resource         | Limit   |
| ---------------- | :------ |
| Data Size        | 256 MB  |
| Monthly Commands | 500,000 |
| Max Request Size | 10 MB   |
| Max Record Size  | 100 MB  |
| Databases        | 1       |

### Shiftfy Usage Notes

- **Rate limiting** in middleware (auth: 10 req/60s, API: 60 req/60s)
- **Login lockout** tracking (`src/lib/login-lockout.ts`)
- **Caching layer** (`src/lib/cache.ts`)
- **Idempotency keys** (`src/lib/idempotency.ts`)
- **Webhook dedup** in billing webhook route
- Graceful degradation: all Redis features check `hasRedis` flag and skip if unavailable

### ⚠️ Upgrade Considerations

- If commands exceed 500K/month → **Pay-as-you-go at $0.20 per 100K commands**
- At moderate traffic (~100 users), expect ~50K–200K commands/month — safe on free tier

---

## 7. Stripe — Payment Processing

|                    |                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Plan**           | Standard (Pay-as-you-go)                                                                |
| **Monthly cost**   | **$0.00 fixed** (transaction fees only)                                                 |
| **What it covers** | Payment processing, Checkout, Billing (subscription management), Radar fraud prevention |
| **URL**            | https://stripe.com/en-de/pricing                                                        |

### Transaction Fees (EU / Germany)

| Payment Type            | Fee                                     |
| ----------------------- | :-------------------------------------- |
| Standard EEA cards      | **1.5% + €0.25** per transaction        |
| Premium EEA cards       | 1.9% + €0.25 per transaction            |
| UK cards                | 2.5% + €0.25 per transaction            |
| International cards     | 3.25% + €0.25 (+2% currency conversion) |
| SEPA Direct Debit       | €0.35 per transaction                   |
| Radar (fraud ML)        | Included                                |
| Billing (pay-as-you-go) | 0.7% of billing volume                  |

### Shiftfy Pricing Model (from `src/lib/stripe.ts`)

| Plan         | Base/month        | Per User/month                      |
| ------------ | :---------------- | :---------------------------------- |
| Basic        | €19 + €2.50/user  | `STRIPE_PRICE_BASIC_MONTHLY`        |
| Professional | €49 + €4.50/user  | `STRIPE_PRICE_PROFESSIONAL_MONTHLY` |
| Enterprise   | Custom (min €500) | Custom quote                        |

### Cost Example

For a Basic customer with 10 employees paying €44/month (€19 base + €25 users):

- Stripe processing: €44 × 1.5% + €0.25 = **€0.91 per transaction**
- Stripe Billing: €44 × 0.7% = €0.31
- **Total Stripe cost per customer per month: ~€1.22**

---

## 8. Domain — shiftfy.de

|                       |                                               |
| --------------------- | --------------------------------------------- |
| **Registrar**         | Varies (likely Vercel Domains or external)    |
| **Annual cost**       | **~€18/year** (~$19.50/year) for `.de` domain |
| **Monthly amortized** | **~€1.50/month**                              |

### Subdomains in Use

- `www.shiftfy.de` — Landing page / marketing
- `app.shiftfy.de` — Application (referenced in iCal routes)
- `staging.shiftfy.de` — Staging environment (via Vercel alias in GitHub Actions)

---

## 9. Free Services (No Cost)

| Service                                 | What For                                          | Cost |
| --------------------------------------- | ------------------------------------------------- | :--- |
| **GitHub** (Free/included with Copilot) | Git hosting, CI/CD Actions (2,000 min/month free) | $0   |
| **Google OAuth**                        | Social login (optional)                           | $0   |
| **Azure AD OAuth**                      | Enterprise SSO (optional)                         | $0   |
| **Web Push (VAPID)**                    | Browser push notifications                        | $0   |
| **Let's Encrypt** (via Vercel)          | SSL/TLS certificates                              | $0   |

---

## Total Monthly Cost Breakdown

### Fixed Costs (Predictable)

| Service            | Monthly (USD) | Monthly (EUR) |
| ------------------ | :------------ | :------------ |
| Vercel Pro         | $20.00        | ~€18.50       |
| Supabase Pro       | $25.00        | ~€23.10       |
| GitHub Copilot Pro | $39.00        | ~€36.00       |
| Resend Pro         | $20.00        | ~€18.50       |
| Sentry Developer   | $0.00         | €0.00         |
| Upstash Free       | $0.00         | €0.00         |
| Domain (amortized) | ~$1.60        | ~€1.50        |
| **TOTAL**          | **~$105.60**  | **~$97.60**   |

### Variable Costs (Transaction-based)

| Trigger                                  | Estimated Cost        |
| ---------------------------------------- | :-------------------- |
| Per Stripe transaction (EEA card)        | ~€0.91 + 0.7% billing |
| Vercel overage (unlikely at early stage) | $0.00                 |
| Resend overage (unlikely)                | $0.00                 |
| Upstash overage (unlikely)               | $0.00                 |

### Production vs Development Split

| Category                      | Services                                               | Monthly Cost |
| ----------------------------- | ------------------------------------------------------ | :----------- |
| **Production Infrastructure** | Vercel + Supabase + Resend + Sentry + Upstash + Domain | **$66.60**   |
| **Development Tooling**       | GitHub Copilot                                         | **$39.00**   |

---

## Scaling Cost Projections

| Metric   | Current (Free Tier) | 100 Users           | 1,000 Users          | Action Needed                     |
| -------- | :------------------ | :------------------ | :------------------- | :-------------------------------- |
| Sentry   | Free (5K errors)    | ~$26/mo (Team)      | ~$26/mo (Team)       | Upgrade when >1 dev or >5K errors |
| Upstash  | Free (500K cmds)    | ~$0–2/mo (PAYG)     | ~$5–10/mo (PAYG)     | Auto-scales on PAYG               |
| Vercel   | $20 (Pro included)  | $20 (within limits) | $20 + ~$5–15 overage | Monitor function invocations      |
| Supabase | $25 (8GB DB)        | $25 (within limits) | $25 + ~$5–10 overage | Monitor DB size                   |
| Resend   | $20 (50K emails)    | $20 (within limits) | $20 + ~$20 overage   | ~2K emails/1000 users             |
| Stripe   | Transaction fees    | ~€50/mo fees        | ~€500/mo fees        | Scales with revenue               |

### Projected Monthly Costs by Stage

| Stage                      | Fixed | Variable (est.) | Total (est.)    |
| -------------------------- | :---- | :-------------- | :-------------- |
| **Pre-launch / Current**   | ~$106 | ~$0             | **~$106/month** |
| **100 paying customers**   | ~$132 | ~$50 Stripe     | **~$182/month** |
| **1,000 paying customers** | ~$160 | ~$500 Stripe    | **~$660/month** |

---

---

# 🇩🇪 DEUTSCH

## Zusammenfassung

Die Produktionsinfrastruktur von Shiftfy läuft auf **7 externen Diensten** mit monatlichen Fixkosten von **~97,60 €/Monat** (~$105,60 USD). Stripe-Gebühren fallen nur transaktionsbasiert an (keine monatliche Grundgebühr). Domainkosten betragen ~1,50 €/Monat (anteilig).

### Monatliche Fixkosten auf einen Blick

| #   | Dienst                  | Tarif                 | Monatliche Kosten (EUR) | Monatliche Kosten (USD) |
| --- | ----------------------- | --------------------- | :---------------------: | :---------------------: |
| 1   | **Vercel**              | Pro                   |         ~€18,50         |         $20,00          |
| 2   | **Supabase**            | Pro                   |         ~€23,10         |         $25,00          |
| 3   | **GitHub Copilot**      | Pro (Einzelperson)    |         ~€36,00         |         $39,00          |
| 4   | **Resend**              | Pro                   |         ~€18,50         |         $20,00          |
| 5   | **Sentry**              | Developer (Kostenlos) |          €0,00          |          $0,00          |
| 6   | **Upstash Redis**       | Kostenlos             |          €0,00          |          $0,00          |
| 7   | **Stripe**              | Nutzungsbasiert       |          €0,00          |          $0,00          |
| 8   | **Domain** (shiftfy.de) | Jährlich (anteilig)   |         ~€1,50          |         ~$1,60          |
|     | **GESAMT FIXKOSTEN**    |                       |       **~€97,60**       |      **~$105,60**       |

---

## 1. Vercel — Hosting & Edge-Plattform

|                       |                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| **Tarif**             | Pro                                                                                             |
| **Monatliche Kosten** | **$20,00/Monat** pro Teammitglied                                                               |
| **Leistungsumfang**   | Next.js 16 Hosting, Serverless Functions, Edge Middleware, CDN, SSL, CI/CD, Preview Deployments |
| **URL**               | https://vercel.com/pricing                                                                      |

### Im Pro-Tarif enthalten ($20/Monat)

| Ressource               | Inkl. Freikontingent | Überschreitungskosten |
| ----------------------- | :------------------- | :-------------------- |
| Edge-Anfragen           | 1 Mio./Monat         | $0,65 pro 1 Mio.      |
| Schneller Datentransfer | 100 GB/Monat         | $0,15/GB              |
| Serverless Active CPU   | 4 Stunden/Monat      | $0,18/Std.            |
| Function Invocations    | 1 Mio./Monat         | $0,60 pro 1 Mio.      |
| Blob Storage            | 1 GB                 | $0,15/GB              |
| Cron Jobs               | ✅ Enthalten         | —                     |
| Web Analytics           | 50.000 Events/Monat  | $0,65 pro 10K         |

### Shiftfy-Nutzung

- **5 Cron Jobs** in `vercel.json` konfiguriert:
  - `generate-time-entries` — täglich um 02:00 Uhr
  - `overtime-check` — wöchentlich Montag 03:00 Uhr
  - `payroll-lock` — monatlich am 1. um 04:00 Uhr
  - `break-reminder` — alle 15 Minuten
  - `data-retention` — wöchentlich Sonntag 04:30 Uhr
- **Vercel Blob** wird minimal genutzt (Dokumente im Rahmen der DSGVO-Bereinigung entfernt)

---

## 2. Supabase — PostgreSQL-Datenbank

|                       |                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Tarif**             | Pro                                                                                                                  |
| **Monatliche Kosten** | **$25,00/Monat**                                                                                                     |
| **Leistungsumfang**   | Verwaltetes PostgreSQL, Connection Pooler (PgBouncer/Supavisor), 8 GB Datenbank, tägliche Backups, 250 GB Bandbreite |
| **URL**               | https://supabase.com/pricing                                                                                         |

### Im Pro-Tarif enthalten ($25/Monat)

| Ressource           | Inkl. Freikontingent | Überschreitungskosten |
| ------------------- | :------------------- | :-------------------- |
| Datenbankgröße      | 8 GB                 | $0,125/GB             |
| Bandbreite          | 250 GB/Monat         | $0,09/GB              |
| Tägliche Backups    | 7 Tage Aufbewahrung  | —                     |
| Pooler-Verbindungen | Unbegrenzt           | —                     |

### Shiftfy-Nutzung

- **Prisma 7** verbindet über den **Supabase Connection Pooler**
- `DATABASE_POOL_MAX=5` — sparsame Verbindungsnutzung
- **30+ Prisma-Modelle** — Datenbankgröße ca. 100 MB–2 GB in der Frühphase
- ⚠️ `prisma migrate dev` funktioniert NICHT über den Pooler — Migrationen via Supabase MCP/Dashboard

---

## 3. GitHub Copilot — KI-Entwicklungsassistent

|                       |                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------- |
| **Tarif**             | Pro (Einzelperson)                                                                            |
| **Monatliche Kosten** | **$39,00/Monat**                                                                              |
| **Leistungsumfang**   | KI-Code-Vervollständigung, Chat, Agent-Modus, Claude Sonnet 4 Zugang, Multi-Datei-Bearbeitung |
| **URL**               | https://github.com/features/copilot                                                           |

### Hinweise

- Reine **Entwicklungskosten** (keine Produktions-Laufzeitabhängigkeit)
- Wird für die gesamte Shiftfy-Entwicklung genutzt (Schema-Design, API-Routen, Tests, DSGVO-Compliance)
- Hat **keinen Einfluss** auf Endnutzer-Abrechnung oder Produktionsinfrastruktur

---

## 4. Resend — Transaktions-E-Mails

|                       |                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Tarif**             | Pro                                                                                  |
| **Monatliche Kosten** | **$20,00/Monat**                                                                     |
| **Leistungsumfang**   | 50.000 E-Mails/Monat, 10 benutzerdefinierte Domains, kein Tageslimit, DKIM/SPF/DMARC |
| **URL**               | https://resend.com/pricing                                                           |

### Im Pro-Tarif enthalten ($20/Monat)

| Ressource                  | Limit                   |
| -------------------------- | :---------------------- |
| E-Mails pro Monat          | 50.000                  |
| Tageslimit                 | Kein Limit              |
| Benutzerdefinierte Domains | 10                      |
| Teammitglieder             | 5                       |
| Webhook-Endpunkte          | 10                      |
| Überschreitung             | $0,90 pro 1.000 E-Mails |

### Shiftfy-Nutzung

- Verwendet für: Passwort-Zurücksetzung, E-Mail-Verifizierung, Schicht-Benachrichtigungen, Abwesenheits-Genehmigungen, Einladungs-E-Mails
- Konfiguriert in `src/lib/notifications/email.ts` über `RESEND_API_KEY`
- Absenderadresse: `noreply@shiftfy.de` (eigene Domain)
- Frühphasen-Nutzung: voraussichtlich <1.000 E-Mails/Monat — weit innerhalb des 50K-Limits

---

## 5. Sentry — Fehlerüberwachung

|                       |                                                                          |
| --------------------- | ------------------------------------------------------------------------ |
| **Tarif**             | Developer (Kostenlos)                                                    |
| **Monatliche Kosten** | **€0,00**                                                                |
| **Leistungsumfang**   | 5.000 Fehler/Monat, 50 Session-Replays, 5 Mio. Tracing-Spans, 1 Benutzer |
| **URL**               | https://sentry.io/pricing                                                |

### Shiftfy-Nutzung

- **DSGVO-konform** integriert: Session-Replay & Tracing nur mit Analytics-Cookie-Einwilligung
- Fehlerüberwachung läuft unter berechtigtem Interesse (Art. 6 Abs. 1 lit. f DSGVO)
- ⚠️ **Upgrade empfohlen** bei >1 Entwickler oder >5.000 Fehlern/Monat → **Team-Tarif: $26/Monat**

---

## 6. Upstash Redis — Rate-Limiting & Caching

|                       |                                     |
| --------------------- | ----------------------------------- |
| **Tarif**             | Kostenlos                           |
| **Monatliche Kosten** | **€0,00**                           |
| **Leistungsumfang**   | 256 MB Daten, 500.000 Befehle/Monat |
| **URL**               | https://upstash.com/pricing/redis   |

### Shiftfy-Nutzung

- **Rate-Limiting** in Middleware (Auth: 10 Anfr./60s, API: 60 Anfr./60s)
- **Login-Sperre** (`src/lib/login-lockout.ts`)
- **Caching-Schicht** (`src/lib/cache.ts`)
- **Idempotenz-Schlüssel** (`src/lib/idempotency.ts`)
- Graceful Degradation: Alle Redis-Features prüfen `hasRedis`-Flag und werden übersprungen falls nicht verfügbar

### ⚠️ Upgrade-Überlegungen

- Bei >500K Befehlen/Monat → **Pay-as-you-go: $0,20 pro 100K Befehle**
- Bei moderatem Traffic (~100 Nutzer): ca. 50K–200K Befehle/Monat — sicher im Free-Tier

---

## 7. Stripe — Zahlungsabwicklung

|                       |                                                                                 |
| --------------------- | ------------------------------------------------------------------------------- |
| **Tarif**             | Standard (nutzungsbasiert)                                                      |
| **Monatliche Kosten** | **€0,00 Fixkosten** (nur Transaktionsgebühren)                                  |
| **Leistungsumfang**   | Zahlungsabwicklung, Checkout, Billing (Abo-Verwaltung), Radar Betrugsprävention |
| **URL**               | https://stripe.com/de/pricing                                                   |

### Transaktionsgebühren (EU / Deutschland)

| Zahlungsart               | Gebühr                                  |
| ------------------------- | :-------------------------------------- |
| Standard-EWR-Karten       | **1,5% + 0,25 €** pro Transaktion       |
| Premium-EWR-Karten        | 1,9% + 0,25 € pro Transaktion           |
| UK-Karten                 | 2,5% + 0,25 € pro Transaktion           |
| Internationale Karten     | 3,25% + 0,25 € (+2% Währungsumrechnung) |
| SEPA-Lastschrift          | 0,35 € pro Transaktion                  |
| Radar (Betrugs-ML)        | Enthalten                               |
| Billing (nutzungsbasiert) | 0,7% des Abrechnungsvolumens            |

### Shiftfy-Preismodell (aus `src/lib/stripe.ts`)

| Tarif        | Basis/Monat               | Pro Nutzer/Monat                    |
| ------------ | :------------------------ | :---------------------------------- |
| Basic        | 19 € + 2,50 €/Nutzer      | `STRIPE_PRICE_BASIC_MONTHLY`        |
| Professional | 49 € + 4,50 €/Nutzer      | `STRIPE_PRICE_PROFESSIONAL_MONTHLY` |
| Enterprise   | Individuell (mind. 500 €) | Individuelles Angebot               |

### Kostenbeispiel

Für einen Basic-Kunden mit 10 Mitarbeitern, der 44 €/Monat zahlt (19 € Basis + 25 € Nutzer):

- Stripe-Verarbeitung: 44 € × 1,5% + 0,25 € = **0,91 € pro Transaktion**
- Stripe Billing: 44 € × 0,7% = 0,31 €
- **Gesamte Stripe-Kosten pro Kunde pro Monat: ~1,22 €**

---

## 8. Domain — shiftfy.de

|                          |                                                |
| ------------------------ | ---------------------------------------------- |
| **Registrar**            | Variabel (Vercel Domains oder extern)          |
| **Jährliche Kosten**     | **~18 €/Jahr** (~$19,50/Jahr) für `.de`-Domain |
| **Monatlich (anteilig)** | **~1,50 €/Monat**                              |

### Subdomains im Einsatz

- `www.shiftfy.de` — Landingpage / Marketing
- `app.shiftfy.de` — Anwendung (referenziert in iCal-Routen)
- `staging.shiftfy.de` — Staging-Umgebung (via Vercel-Alias in GitHub Actions)

---

## 9. Kostenlose Dienste (keine Kosten)

| Dienst                                    | Verwendung                                              | Kosten |
| ----------------------------------------- | ------------------------------------------------------- | :----- |
| **GitHub** (Free / mit Copilot enthalten) | Git-Hosting, CI/CD Actions (2.000 Min./Monat kostenlos) | 0 €    |
| **Google OAuth**                          | Social Login (optional)                                 | 0 €    |
| **Azure AD OAuth**                        | Enterprise SSO (optional)                               | 0 €    |
| **Web Push (VAPID)**                      | Browser-Push-Benachrichtigungen                         | 0 €    |
| **Let's Encrypt** (via Vercel)            | SSL/TLS-Zertifikate                                     | 0 €    |

---

## Gesamtkosten — Monatliche Aufstellung

### Fixkosten (vorhersehbar)

| Dienst             | Monatlich (EUR) | Monatlich (USD) |
| ------------------ | :-------------- | :-------------- |
| Vercel Pro         | ~€18,50         | $20,00          |
| Supabase Pro       | ~€23,10         | $25,00          |
| GitHub Copilot Pro | ~€36,00         | $39,00          |
| Resend Pro         | ~€18,50         | $20,00          |
| Sentry Developer   | €0,00           | $0,00           |
| Upstash Free       | €0,00           | $0,00           |
| Domain (anteilig)  | ~€1,50          | ~$1,60          |
| **GESAMT**         | **~€97,60**     | **~$105,60**    |

### Variable Kosten (transaktionsbasiert)

| Auslöser                                              | Geschätzte Kosten      |
| ----------------------------------------------------- | :--------------------- |
| Pro Stripe-Transaktion (EWR-Karte)                    | ~0,91 € + 0,7% Billing |
| Vercel-Überschreitung (unwahrscheinlich in Frühphase) | 0,00 €                 |
| Resend-Überschreitung (unwahrscheinlich)              | 0,00 €                 |
| Upstash-Überschreitung (unwahrscheinlich)             | 0,00 €                 |

### Produktion vs. Entwicklung

| Kategorie                    | Dienste                                                | Monatliche Kosten |
| ---------------------------- | ------------------------------------------------------ | :---------------- |
| **Produktionsinfrastruktur** | Vercel + Supabase + Resend + Sentry + Upstash + Domain | **~€61,60**       |
| **Entwicklungswerkzeuge**    | GitHub Copilot                                         | **~€36,00**       |

---

## Skalierungsprognosen

| Kennzahl | Aktuell (Free-Tier)      | 100 Nutzer                | 1.000 Nutzer                   | Handlungsbedarf                           |
| -------- | :----------------------- | :------------------------ | :----------------------------- | :---------------------------------------- |
| Sentry   | Kostenlos (5K Fehler)    | ~€24/Mo. (Team)           | ~€24/Mo. (Team)                | Upgrade bei >1 Entwickler oder >5K Fehler |
| Upstash  | Kostenlos (500K Befehle) | ~€0–2/Mo. (PAYG)          | ~€5–9/Mo. (PAYG)               | Automatische Skalierung mit PAYG          |
| Vercel   | €18,50 (Pro enthalten)   | €18,50 (innerhalb Limits) | €18,50 + ~€5–14 Überschreitung | Function Invocations überwachen           |
| Supabase | €23,10 (8GB DB)          | €23,10 (innerhalb Limits) | €23,10 + ~€5–9 Überschreitung  | Datenbankgröße überwachen                 |
| Resend   | €18,50 (50K E-Mails)     | €18,50 (innerhalb Limits) | €18,50 + ~€18 Überschreitung   | ~2K E-Mails pro 1.000 Nutzer              |
| Stripe   | Transaktionsgebühren     | ~€46/Mo. Gebühren         | ~€460/Mo. Gebühren             | Skaliert mit Umsatz                       |

### Prognostizierte Monatskosten nach Phase

| Phase                     | Fixkosten | Variable (gesch.) | Gesamt (gesch.) |
| ------------------------- | :-------- | :---------------- | :-------------- |
| **Vor Launch / Aktuell**  | ~€98      | ~€0               | **~€98/Monat**  |
| **100 zahlende Kunden**   | ~€122     | ~€46 Stripe       | **~€168/Monat** |
| **1.000 zahlende Kunden** | ~€148     | ~€460 Stripe      | **~€608/Monat** |

---

## Quellenverzeichnis

| Dienst         | Preisseite                                  | Abgerufen  |
| -------------- | ------------------------------------------- | :--------- |
| Vercel         | https://vercel.com/pricing                  | 2025-07-04 |
| Supabase       | https://supabase.com/pricing                | 2025-07-04 |
| GitHub Copilot | https://github.com/features/copilot#pricing | 2025-07-04 |
| Resend         | https://resend.com/pricing                  | 2025-07-04 |
| Sentry         | https://sentry.io/pricing                   | 2025-07-04 |
| Upstash        | https://upstash.com/pricing/redis           | 2025-07-04 |
| Stripe (DE)    | https://stripe.com/en-de/pricing            | 2025-07-04 |

---

_Generated from codebase audit of `src/lib/env.ts`, `.env.example`, `package.json`, `vercel.json`, `src/lib/stripe.ts`, and all `process.env._` references across the Shiftfy codebase.\*
