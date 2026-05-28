# Shiftfy — Intelligente Schichtplanung für Teams

> Moderne SaaS-Plattform zur Schichtplanung, Zeiterfassung, Personalverwaltung und Ticketing.  
> Entwickelt für den deutschen Markt mit Next.js, Prisma, Supabase, Stripe und TypeScript.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![Supabase](https://img.shields.io/badge/Supabase-Storage%20%2B%20DB-3ECF8E?logo=supabase)](https://supabase.com)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-635BFF?logo=stripe)](https://stripe.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## Features

### Schichtplanung

- Drag & Drop Wochenkalender mit Schichtblöcken
- Wiederverwendbare Schichtvorlagen
- Automatische Konflikterkennung (Überlappungen, Ruhezeiten nach ArbZG)
- Schichttausch-Anträge mit Manager-Genehmigung
- Teamkalender-Export als CSV (UTF-8 BOM, Excel-ready, lokalisierte Enum-Labels)

### Zeiterfassung

- Digitale Stempeluhr (Ein-/Ausstempeln mit GPS)
- Pausenverwaltung mit gesetzlicher Pausenregelung (ArbZG)
- Team-Übersicht: Live-Status aller Mitarbeiter
- Monatsabschluss-Workflow (Sperren → Exportieren)

### Personalverwaltung

- Mitarbeiter, Standorte (inkl. Bundesland), Abteilungen, Qualifikationen
- Abwesenheitsverwaltung mit feiertags-bewusster Tagesklassifizierung:  
  WORK / WEEKEND / HOLIDAY / VACATION — live Vorschau inkl. Feiertags-Aufschlüsselung
- Arbeitszeitkonten mit automatischer Saldo-Berechnung
- Team-Einladungen per E-Mail mit Rollen (Owner / Admin / Manager / Employee)

### Compliance & Rechtssicherheit (DE)

- **§34a Sachkunde-Verwaltung** — echte Zertifikate je Mitarbeiter (Zertifikatsnummer, ausstellende Stelle, Ausstellungs-/Ablaufdatum, Dokument-Upload via Supabase Storage). Standorte definieren Pflicht-Qualifikationen; Mitarbeiter ohne gültigen Nachweis werden bei der Einplanung **hart blockiert**. §34a-Compliance-Bericht je Standort/Zeitraum (inkl. fehlender Nachweise) druck- und exportfertig.
- **ArbZG §4 — Pausen-Durchsetzung** — Schichten, deren Arbeitszeit 6 bzw. 9 Stunden ohne ausreichende Pause überschreitet, lassen sich nicht speichern (422). Die gesetzliche Mindestpause (30 / 45 Min.) wird automatisch eingeplant und im Planer angezeigt. Greift bei Einzel-, Serien- und Bulk-Erstellung sowie bei Änderungen.
- **ArbZG §5 — Ruhezeit** — 11-Stunden-Mindestruhe zwischen Schichten als harte Planungssperre.
- **Betriebsrat-Portal (BetrVG §87)** — Management legt Dienstpläne (Zeitraum + optional Standort) zur Mitbestimmung vor; gesetzliche 3-Tage-Frist mit Überfälligkeits-Tracking. Betriebsratsmitglieder prüfen den schreibgeschützten Plan und stimmen zu oder verweigern mit Begründung. Mitgliederverwaltung (OWNER/ADMIN) und mitgliedsabhängiger Sidebar-Zugang.
- **eAU — elektronische Arbeitsunfähigkeitsbescheinigung** — Erfassung/Verwaltung je Krankmeldung (AU-Zeitraum, Erst-/Folgebescheinigung, Ausstellungsdatum, Krankenkasse — ohne Diagnose). Pluggable Provider-Architektur: HTTP-Gateway für zertifizierte ITSG/GKV-Connector (`EAU_GATEWAY_URL`) mit Fallback auf manuelle Erfassung über das SV-Meldeportal.

### Ticketsystem (Add-on)

- **Externes Ticket-Formular** (`/ticket/neu/[slug]`) — öffentlich zugänglicher Link je Workspace
- **Interne Verwaltung** mit Status-Workflow, Zuweisung, Kommentaren, Anhängen
- **Mandanten-isolierte Kategorien** (TicketCategoryDef) — Admins konfigurieren eigene Kategorien in Einstellungen → Ticket Kategorien; Fallback auf Standard-Enum
- **Dateianhänge** via Supabase Storage (Bucket `ticket-attachments`):
  - Bis zu 25 MB pro Datei, bis zu 20 Anhänge pro Ticket
  - Per-Workspace Speicherkontingent (entspricht dem gebuchten Ticketing-Tier)
  - MIME-Typ-Allowlist (Bilder, PDF, Office, Archive, Plaintext)
- **Soft-Delete Papierkorb**: Tickets verschieben → wiederherstellen → endgültig löschen (Blobs werden beim Purge bereinigt)
- **Audit-Trail** (`TicketEvent`): ERSTELLT, STATUS_GEAENDERT, ZUGEWIESEN, KOMMENTAR, GESCHLOSSEN, ANGEHANGT, GELOESCHT, WIEDERHERGESTELLT
- **Ticket-Objekt-Adresse** — Freitext-Feld für physische Referenz
- Öffentliche Token-basierte Statusseite für externe Einreicher

### Berichte & Export

- Stundenreports mit Überstunden-Erkennung
- Export: CSV, PDF, XLSX, DATEV-kompatibel
- Teamkalender-Export (Schichten + Abwesenheiten + gesetzliche Feiertage, nach Bundesland gefiltert)
- iCal-Feed für Kalenderintegration (Google, Apple, Outlook)

### Abrechnung & Preise

- Stripe Billing Integration (Checkout, Portal, Webhooks mit persistenter Idempotenz via `StripeEvent`-Tabelle)
- 4-Stufen-Basispreismodell: Basic → Professional → Enterprise (per Seat, monatlich / jährlich)
- **Schichtplanung Add-on**: €1,50/Nutzer/Monat oder €14,40/Nutzer/Jahr
- **Ticketing Add-on** in 3 Tiers:
  - Starter: €18,99/Monat — 200 Tickets, 5 GB Speicher
  - Growth: €33,99/Monat — 500 Tickets, 15 GB Speicher
  - Business: €55,99/Monat — 1.000 Tickets, 40 GB Speicher
- Auto-Link-Fallback: fehlende `stripeSubscriptionId` wird bei Add-on-Kauf automatisch aus Stripe nachgezogen

### Weitere Features

- Mehrsprachig (Deutsch / Englisch) via next-intl — vollständige Lokalisierung inkl. Rollen, Ticketing-Events und Papierkorb
- Authentifizierung: Credentials, Google OAuth (mit automatischem Employee-Profil + Trial bei OAuth-Sign-up)
- E-Mail-Verifizierung bei Registrierung (Resend)
- Zwei-Faktor-Authentifizierung (TOTP)
- Progressive Web App (PWA) — installierbar auf allen Geräten
- Push-Benachrichtigungen (Web Push + E-Mail)
- 12+ Automatisierungsregeln (ArbZG-Compliance, Auto-Genehmigungen)
- Storage-Health-Diagnose-Endpunkt für Admins (`/api/system/storage-health`)

---

## Tech-Stack

| Kategorie             | Technologie                                                        |
| --------------------- | ------------------------------------------------------------------ |
| **Framework**         | Next.js 16 (App Router, Server Components)                         |
| **Sprache**           | TypeScript 5                                                       |
| **Styling**           | Tailwind CSS 4                                                     |
| **Datenbank**         | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) auf Supabase        |
| **Dateispeicher**     | Supabase Storage (Bucket `ticket-attachments`, REST API via fetch) |
| **Authentifizierung** | NextAuth 4 (Credentials, Google OAuth, JWT)                        |
| **Zahlungen**         | Stripe (Checkout, Billing Portal, Webhooks, Add-ons)               |
| **E-Mail**            | Resend (Transaktionale E-Mails, Verifizierung)                     |
| **i18n**              | next-intl (DE/EN)                                                  |
| **Charts**            | Recharts                                                           |
| **Icons**             | Eigene SVG-Komponenten (TypeScript)                                |
| **Hosting**           | Vercel                                                             |
| **Commit-System**     | Conventional Commits, Husky, commitlint, lint-staged               |

---

## Schnellstart

```bash
# Repository klonen
git clone https://github.com/eltahawyomar001-eng/SchichtPlan.git
cd SchichtPlan

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env.local
# → Siehe "Umgebungsvariablen" unten

# Prisma-Client generieren
npx prisma generate

# Entwicklungsserver starten
npm run dev
```

Die App läuft unter **http://localhost:3000**.

> **Hinweis:** Datenbankmigrationen werden über Supabase verwaltet und nicht per
> `prisma migrate dev` ausgeführt. Schema-Änderungen an `prisma/schema.prisma` erfordern
> eine Migration über die Supabase MCP-Integration (`mcp__supabase__apply_migration`).

---

## Umgebungsvariablen

```env
# ─── Datenbank (Supabase) ───
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:6543/postgres"

# ─── Supabase (Datenbank + Storage) ───
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# ─── NextAuth ───
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# ─── OAuth (optional) ───
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ─── Stripe Billing ───
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Basis-Preise
STRIPE_PRICE_BASIC_MONTHLY="price_..."
STRIPE_PRICE_BASIC_ANNUAL="price_..."
STRIPE_PRICE_PROFESSIONAL_MONTHLY="price_..."
STRIPE_PRICE_PROFESSIONAL_ANNUAL="price_..."

# Ticketing Add-on Preise
STRIPE_PRICE_TICKETING_STARTER_MONTHLY="price_..."
STRIPE_PRICE_TICKETING_PRO_MONTHLY="price_..."
STRIPE_PRICE_TICKETING_BUSINESS_MONTHLY="price_..."

# Schichtplanung Add-on Preise
STRIPE_PRICE_SCHICHTPLANUNG_MONTHLY="price_..."
STRIPE_PRICE_SCHICHTPLANUNG_ANNUAL="price_..."

STRIPE_SIMULATION_MODE=false

# ─── Resend (E-Mail) ───
RESEND_API_KEY=""
RESEND_FROM_EMAIL="Shiftfy <noreply@yourdomain.com>"

# ─── Web Push (optional) ───
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:admin@yourdomain.com"

# ─── Sicherheit ───
ENCRYPTION_KEY="64-char-hex-string"
```

> Kein `BLOB_READ_WRITE_TOKEN` nötig — Dateispeicher läuft vollständig über Supabase Storage.

---

## Projektstruktur

```
schichtplan/
├── prisma/
│   └── schema.prisma              # DB-Schema (40+ Modelle)
├── messages/
│   ├── de.json                    # Deutsche Übersetzungen
│   └── en.json                    # Englische Übersetzungen
├── public/                        # Statische Assets, PWA Manifest
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── blog/[slug]/       # Blog-Artikel mit Mid-Article CTA
    │   │   ├── login/
    │   │   ├── register/
    │   │   └── pricing/
    │   ├── (dashboard)/
    │   │   ├── dashboard/
    │   │   ├── mitarbeiter/
    │   │   ├── standorte/
    │   │   ├── schichtplan/
    │   │   ├── teamkalender/      # Kalender + CSV-Export (Server-side)
    │   │   ├── stempeluhr/
    │   │   ├── abwesenheiten/     # inkl. Feiertags-Vorschau
    │   │   ├── tickets/           # Ticket-Verwaltung (intern)
    │   │   │   ├── [id]/          # Ticket-Detailansicht
    │   │   │   ├── neu/           # Ticket erstellen
    │   │   │   └── papierkorb/    # Soft-Delete Papierkorb
    │   │   ├── berichte/
    │   │   ├── daten/
    │   │   └── einstellungen/
    │   │       └── tickets/
    │   │           └── kategorien/ # Admin: Ticket-Kategorien verwalten
    │   ├── ticket/
    │   │   ├── neu/[slug]/        # Öffentliches Einreichungsformular
    │   │   └── [token]/           # Öffentliche Statusseite
    │   └── api/
    │       ├── auth/
    │       ├── billing/
    │       │   ├── addons/
    │       │   │   ├── schichtplanung/  # Add-on kaufen/kündigen
    │       │   │   └── ticketing/       # Add-on Tier wechseln
    │       │   ├── checkout/
    │       │   ├── portal/
    │       │   ├── subscription/
    │       │   ├── usage/         # Speicherverbrauch-Aufschlüsselung
    │       │   └── webhook/       # Stripe Webhook (StripeEvent Idempotenz)
    │       ├── tickets/
    │       │   ├── route.ts       # GET (Liste + Papierkorb-Filter) / POST
    │       │   ├── [id]/
    │       │   │   ├── route.ts         # GET / PATCH / DELETE (soft/purge)
    │       │   │   ├── attachments/     # POST (Upload) / GET
    │       │   │   └── restore/         # POST (Wiederherstellen)
    │       │   ├── assignees/           # GET alle Workspace-Nutzer
    │       │   └── external/
    │       │       ├── route.ts         # POST öffentliche Einreichung
    │       │       ├── categories/      # GET Kategorien (öffentlich)
    │       │       └── locations/       # GET Standorte (öffentlich)
    │       ├── ticket-categories/       # GET / POST (Admin CRUD)
    │       │   └── [id]/               # PATCH / DELETE
    │       ├── absences/
    │       │   └── preview/            # Stateless Feiertags-Vorschau
    │       ├── teamkalender/
    │       │   └── export/             # CSV-Export (Server-side)
    │       └── system/
    │           └── storage-health/     # Admin Storage-Diagnose
    ├── lib/
    │   ├── auth.ts                # NextAuth + OAuth Employee-Bootstrap
    │   ├── db.ts                  # Prisma-Client
    │   ├── stripe.ts
    │   ├── subscription.ts        # inkl. linkSubscriptionByCustomer()
    │   ├── authorization.ts
    │   ├── ticket-attachments.ts  # Supabase Storage REST (upload/delete/quota)
    │   ├── ticket-file-validation.ts  # Client-safe MIME/Größen-Validierung
    │   ├── ticket-trash.ts        # softDelete / restore / purge / Quota-Breakdown
    │   ├── ticket-events.ts       # Audit-Trail Helpers
    │   ├── ticket-categories.ts   # ensureDefaultCategories()
    │   ├── ticketing-addon.ts     # Tier-Konfiguration, syncTicketingLimits()
    │   ├── schichtplanung-addon.ts
    │   ├── absence-days.ts        # classifyAbsenceDays() / Feiertags-Engine
    │   ├── holidays.ts            # getGermanHolidays() nach Bundesland
    │   ├── time-utils.ts          # Zeitberechnung, CSV-Header, Status-Labels
    │   └── with-route.ts          # Route-Wrapper (Logging, Error-Capture)
    └── components/
        ├── icons/
        ├── landing/
        ├── layout/
        └── ui/
```

---

## Preismodell

### Basis-Pläne (per Seat)

| Plan             | Monatlich    | Jährlich      | Highlights                                   |
| ---------------- | ------------ | ------------- | -------------------------------------------- |
| **Basic**        | €2,99/Nutzer | €29,90/Nutzer | Schichtplanung, Zeiterfassung, Basis-Export  |
| **Professional** | €4,99/Nutzer | €39,90/Nutzer | Abwesenheiten, CSV/PDF-Export, Vorlagen      |
| **Enterprise**   | Individuell  | Individuell   | SSO, SLA, Custom-Integrationen, alle Add-ons |

### Add-ons

| Add-on                 | Preis                                      | Inhalt                              |
| ---------------------- | ------------------------------------------ | ----------------------------------- |
| **Schichtplanung**     | €1,50/Nutzer/Monat oder €14,40/Nutzer/Jahr | Erweiterte Schichtfunktionen        |
| **Ticketing Starter**  | €18,99/Monat                               | 200 Tickets/Monat, 5 GB Speicher    |
| **Ticketing Growth**   | €33,99/Monat                               | 500 Tickets/Monat, 15 GB Speicher   |
| **Ticketing Business** | €55,99/Monat                               | 1.000 Tickets/Monat, 40 GB Speicher |

---

## Stripe-Integration

### Architektur

- `src/lib/stripe.ts` — Stripe-Client, Plan-Definitionen, Preis-Mapping
- `src/lib/subscription.ts` — DB-Service inkl. `linkSubscriptionByCustomer()` (Auto-Link bei fehlendem Webhook)
- Webhook-Handler (`/api/billing/webhook`) mit persistenter Idempotenz: jedes Stripe-Event wird als `StripeEvent`-Datenbankzeile gespeichert; Duplikate werden per PK-Konflikt erkannt

### API-Endpunkte

| Endpunkt                             | Methode | Beschreibung                             |
| ------------------------------------ | ------- | ---------------------------------------- |
| `/api/billing/checkout`              | POST    | Stripe Checkout Session erstellen        |
| `/api/billing/portal`                | POST    | Stripe Customer Portal öffnen            |
| `/api/billing/webhook`               | POST    | Stripe Webhook Events verarbeiten        |
| `/api/billing/subscription`          | GET     | Aktuellen Subscription-Status abrufen    |
| `/api/billing/addons/schichtplanung` | POST    | Schichtplanung Add-on kaufen / kündigen  |
| `/api/billing/addons/ticketing`      | POST    | Ticketing-Tier wechseln                  |
| `/api/billing/usage`                 | GET     | Speicherverbrauch (aktiv vs. Papierkorb) |

### Stripe einrichten

1. Produkte & Preise im Stripe Dashboard anlegen
2. Preis-IDs in `.env.local` eintragen
3. Webhook-Endpunkt konfigurieren: `https://yourdomain.com/api/billing/webhook`
4. Events abonnieren: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`

---

## Supabase Storage

Ticket-Anhänge werden im Supabase Storage Bucket `ticket-attachments` gespeichert.  
Der Bucket ist mit öffentlichem Lesezugriff konfiguriert; Pfade sind durch Timestamps + Zufallstoken kollisionsresistent und nicht erratbar.

### RLS-Policies

| Policy                              | Rolle  | Operation |
| ----------------------------------- | ------ | --------- |
| `service_upload_ticket_attachments` | `anon` | INSERT    |
| `service_delete_ticket_attachments` | `anon` | DELETE    |
| `public_read_ticket_attachments`    | public | SELECT    |

Der `anon`-Key wird serverseitig verwendet (hinter authentifizierten API-Routen). Kein `BLOB_READ_WRITE_TOKEN` erforderlich.

### Storage-Diagnose

```
GET /api/system/storage-health   (erfordert Admin-Rolle)
```

Führt einen Probe-Upload + Delete durch und gibt `{ ok, latencyMs, bucket }` zurück.

---

## Datenbank-Schema

### Kern-Modelle

`User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`

### Ticketing

`Ticket` → `TicketComment`, `TicketAttachment`, `TicketEvent`  
`TicketCategoryDef` (mandanten-isoliert, `@@unique([workspaceId, slug])`)  
Soft-Delete via `deletedAt: DateTime?` (orthogonal zum Status-Enum)

### Billing

`Workspace` → `Subscription` (1:1) mit Stripe-IDs, Plan, Status, Seat-Count, Add-on-Felder  
`StripeEvent` — persistente Idempotenz-Tabelle (event id als PK)  
`WorkspaceUsage` — Speicherkontingent pro Workspace

### Weitere Modelle

`Location` (inkl. `bundesland`), `Department`, `Skill`, `ShiftTemplate`, `Availability`, `ShiftSwapRequest`, `ShiftChangeRequest`, `TimeAccount`, `VacationBalance`, `Notification`, `PushSubscription`, `Client`, `Project`, `MonthClose`, `ExportJob`, `WebhookEndpoint`, `AutomationRule`

---

## Design-Prinzipien

- Emerald-Green-Palette (`#059669` → `#34d399`) mit neutralen Grautönen, Dark-Mode-Support
- Alle Icons als reine TypeScript-SVG-Komponenten — kein externer Icon-Pack
- Prisma 7 mit PostgreSQL über Driver-Adapter (`@prisma/adapter-pg` + `pg.Pool`)
- Deutsche Enum-Werte: `AbsenceCategory` → URLAUB, KRANK, ELTERNZEIT, etc.
- Migrations via Supabase MCP (`apply_migration`) — kein `prisma migrate dev`

---

## Commit-Konventionen

[Conventional Commits](https://www.conventionalcommits.org/) — erzwungen durch Husky + commitlint.

```
feat(scope): Neue Funktion hinzufügen
fix(scope): Fehler beheben
docs: Dokumentation aktualisieren
refactor(scope): Code umstrukturieren
chore: Build-Prozess oder Tooling ändern
```

---

## Skripte

| Befehl                  | Beschreibung                      |
| ----------------------- | --------------------------------- |
| `npm run dev`           | Entwicklungsserver starten        |
| `npm run build`         | Produktions-Build erstellen       |
| `npm start`             | Produktionsserver starten         |
| `npm run lint`          | ESLint ausführen                  |
| `npx prisma generate`   | Prisma-Client generieren          |
| `npx prisma studio`     | Prisma Studio (DB-Browser)        |
| `npm run test`          | Tests einmalig ausführen (Vitest) |
| `npm run test:watch`    | Tests im Watch-Modus              |
| `npm run test:coverage` | Tests mit Coverage-Report         |

---

## Lizenz

Proprietär — © 2024–2026 Shiftfy. Alle Rechte vorbehalten.
