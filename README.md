# Shiftfy — Intelligente Schichtplanung für Teams

> Moderne SaaS-Plattform zur Schichtplanung, Zeiterfassung und Personalverwaltung.  
> Entwickelt für den deutschen Markt mit Next.js, Prisma, Stripe und TypeScript.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-635BFF?logo=stripe)](https://stripe.com)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## Features

### Schichtplanung

- Drag & Drop Wochenkalender mit Schichtblöcken
- Wiederverwendbare Schichtvorlagen
- Automatische Konflikterkennung (Überlappungen, Ruhezeiten)
- Schichttausch-Anträge mit Manager-Genehmigung

### Zeiterfassung

- Digitale Stempeluhr (Ein-/Ausstempeln mit GPS)
- Pausenverwaltung mit gesetzlicher Pausenregelung (ArbZG)
- Team-Übersicht: Live-Status aller Mitarbeiter
- Monatsabschluss-Workflow (Sperren → Exportieren)

### Personalverwaltung

- Mitarbeiter, Standorte, Abteilungen, Qualifikationen
- Abwesenheitsverwaltung (Urlaub, Krank, Elternzeit, Sonderurlaub)
- Arbeitszeitkonten mit automatischer Saldo-Berechnung
- Team-Einladungen per E-Mail mit Rollen (Owner/Admin/Manager/Employee)

### Berichte & Export

- Stundenreports mit Überstunden-Erkennung
- Export: CSV, PDF, XLSX, DATEV-kompatibel
- iCal-Feed für Kalenderintegration (Google, Apple, Outlook)

### Abrechnung & Preise

- Stripe Billing Integration (Checkout, Portal, Webhooks)
- 4-Stufen-Preismodell: Starter (kostenlos) → Team → Business → Enterprise
- Per-Seat-Abrechnung (keine Testphase, sofortiger Zugriff)
- SEPA-Lastschrift & Kreditkarte, Steuer-ID-Erfassung

### Weitere Features

- Mehrsprachig (Deutsch / Englisch) via next-intl
- Authentifizierung: Credentials, Google OAuth, Microsoft Azure AD
- E-Mail-Verifizierung bei Registrierung (Resend)
- Zwei-Faktor-Authentifizierung (TOTP)
- Progressive Web App (PWA) — installierbar auf allen Geräten
- Push-Benachrichtigungen (Web Push + E-Mail)
- 12+ Automatisierungsregeln (ArbZG-Compliance, Auto-Genehmigungen)
- Projekt- & Kundenmodul mit Zeiterfassung pro Projekt
- Webhooks & benutzerdefinierte Automatisierungen

---

## Tech-Stack

| Kategorie             | Technologie                                          |
| --------------------- | ---------------------------------------------------- |
| **Framework**         | Next.js 16 (App Router, Server Components)           |
| **Sprache**           | TypeScript 5                                         |
| **Styling**           | Tailwind CSS 4                                       |
| **Datenbank**         | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)       |
| **Authentifizierung** | NextAuth 4 (Credentials, Google, Azure AD, JWT)      |
| **Zahlungen**         | Stripe (Checkout, Billing Portal, Webhooks)          |
| **E-Mail**            | Resend (Transaktionale E-Mails, Verifizierung)       |
| **i18n**              | next-intl (DE/EN)                                    |
| **Charts**            | Recharts                                             |
| **Icons**             | Eigene SVG-Komponenten (28+ Icons, TypeScript)       |
| **Illustrationen**    | Eigene SVG-Szenen mit ResizeObserver                 |
| **Hosting**           | Vercel                                               |
| **Commit-System**     | Conventional Commits, Husky, commitlint, lint-staged |

---

## Schnellstart

```bash
# Repository klonen
git clone https://github.com/eltahawyomar001-eng/SchichtPlan.git
cd SchichtPlan

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# → Siehe "Umgebungsvariablen" unten

# Prisma-Client generieren
npx prisma generate

# Entwicklungsserver starten
npm run dev
```

Die App läuft unter **http://localhost:3000**.

> **Hinweis:** Datenbankmigrationen werden über Supabase verwaltet und nicht per
> `prisma migrate dev` ausgeführt. Schema-Änderungen an `prisma/schema.prisma` erfordern
> eine Migration über die Supabase MCP-Integration.

---

## Umgebungsvariablen

```env
# ─── Datenbank ───
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# ─── NextAuth ───
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# ─── OAuth (optional) ───
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""

# ─── Stripe Billing ───
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_TEAM_MONTHLY="price_..."
STRIPE_PRICE_TEAM_ANNUAL="price_..."
STRIPE_PRICE_BUSINESS_MONTHLY="price_..."
STRIPE_PRICE_BUSINESS_ANNUAL="price_..."

# ─── Resend (E-Mail) ───
RESEND_API_KEY=""

# ─── Web Push (optional) ───
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
```

---

## Projektstruktur

```
schichtplan/
├── prisma/
│   └── schema.prisma              # DB-Schema (30+ Modelle)
├── messages/
│   ├── de.json                    # Deutsche Übersetzungen
│   └── en.json                    # Englische Übersetzungen
├── scripts/                       # Tooling- und Generator-Skripte (lokal)
├── public/                        # Statische Assets, PWA Manifest
├── src/
│   ├── app/
│   │   ├── globals.css            # Design-Tokens & Farb-Palette
│   │   ├── layout.tsx             # Root-Layout
│   │   ├── page.tsx               # Landing-Page
│   │   ├── (auth)/
│   │   │   ├── login/             # Anmeldung
│   │   │   ├── register/          # Registrierung + E-Mail-Verifizierung
│   │   │   └── pricing/           # Preisseite
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/         # Übersichts-Dashboard
│   │   │   ├── mitarbeiter/       # Mitarbeiterverwaltung
│   │   │   ├── standorte/         # Standortverwaltung
│   │   │   ├── schichtplan/       # Wochenkalender-Schichtplan
│   │   │   ├── stempeluhr/        # Digitale Stempeluhr
│   │   │   ├── abwesenheiten/     # Abwesenheitsverwaltung
│   │   │   ├── berichte/          # Berichte & Analysen
│   │   │   ├── daten/             # Import/Export (CSV, XLSX, PDF)
│   │   │   └── einstellungen/     # Einstellungen & Profil
│   │   └── api/
│   │       ├── auth/              # NextAuth + Registrierung
│   │       ├── billing/           # Stripe (Checkout, Portal, Webhook)
│   │       ├── employees/         # CRUD Mitarbeiter
│   │       ├── locations/         # CRUD Standorte
│   │       ├── shifts/            # CRUD Schichten
│   │       ├── time-entries/      # Zeiterfassung
│   │       └── webhooks/          # Benutzerdefinierte Webhooks
│   ├── components/
│   │   ├── icons/                 # 28+ SVG-Icon-Komponenten
│   │   ├── svgs/                  # 4 SVG-Illustrationen (responsive)
│   │   ├── landing/               # Landing-Page Komponenten
│   │   ├── layout/                # Sidebar, Topbar
│   │   └── ui/                    # Basis-UI (Button, Card, Input ...)
│   └── lib/
│       ├── auth.ts                # NextAuth-Konfiguration
│       ├── db.ts                  # Prisma-Client (PrismaPg Adapter)
│       ├── stripe.ts              # Stripe-Client & Plan-Konfiguration
│       ├── subscription.ts        # Subscription DB-Service
│       ├── authorization.ts       # Rollen-basierte Zugriffskontrolle
│       └── utils.ts               # Hilfsfunktionen
├── .husky/                        # Git-Hooks (commit-msg, pre-commit)
├── commitlint.config.ts           # Conventional-Commits-Regeln
├── eslint.config.mjs
├── next.config.ts
├── prisma.config.ts
├── tsconfig.json
└── package.json
```

---

## Preismodell

| Plan           | Monatlich          | Jährlich           | Mitarbeiter | Standorte  | Highlights                                  |
| -------------- | ------------------ | ------------------ | ----------- | ---------- | ------------------------------------------- |
| **Starter**    | kostenlos          | kostenlos          | bis 5       | 1          | Schichtplanung, Zeiterfassung, Basis-Export |
| **Team**       | €5,90/Nutzer/Monat | €4,90/Nutzer/Monat | Unbegrenzt  | bis 5      | Vorlagen, Abwesenheiten, CSV/PDF-Export     |
| **Business**   | €9,50/Nutzer/Monat | €7,90/Nutzer/Monat | Unbegrenzt  | Unbegrenzt | DATEV, API, Rollen, Analysen, Priorität     |
| **Enterprise** | Individuell        | Individuell        | Unbegrenzt  | Unbegrenzt | SSO/SAML, SLA, Custom-Integrationen         |

Keine Testphase — sofortiger Zugriff nach Abschluss. Jährliche Zahlung spart bis zu 17 %.

---

## Stripe-Integration

### Architektur

- `src/lib/stripe.ts` — Stripe-Client, Plan-Definitionen, Preis-Mapping
- `src/lib/subscription.ts` — DB-Service für Subscription-CRUD
- `prisma/schema.prisma` — `Subscription`-Modell (Plan, Status, Stripe-IDs)

### API-Endpunkte

| Endpunkt                    | Methode | Beschreibung                          |
| --------------------------- | ------- | ------------------------------------- |
| `/api/billing/checkout`     | POST    | Stripe Checkout Session erstellen     |
| `/api/billing/portal`       | POST    | Stripe Customer Portal öffnen         |
| `/api/billing/webhook`      | POST    | Stripe Webhook Events verarbeiten     |
| `/api/billing/subscription` | GET     | Aktuellen Subscription-Status abrufen |

### Stripe einrichten

1. Stripe-Account erstellen: [dashboard.stripe.com](https://dashboard.stripe.com)
2. Produkte & Preise im Stripe Dashboard anlegen (Team Monthly/Annual, Business Monthly/Annual)
3. Preis-IDs in `.env` eintragen (`STRIPE_PRICE_TEAM_MONTHLY`, etc.)
4. Webhook-Endpunkt konfigurieren: `https://yourdomain.com/api/billing/webhook`
5. Events abonnieren: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## Datenbank-Schema

### Kern-Modelle

`User` → `Workspace` → `Employee` → `Shift`, `TimeEntry`, `AbsenceRequest`

### Billing

`Workspace` → `Subscription` (1:1) mit Stripe-IDs, Plan, Status, Seat-Count

### Weitere Modelle

`Location`, `Department`, `Skill`, `ShiftTemplate`, `Availability`, `ShiftSwapRequest`, `ShiftChangeRequest`, `TimeAccount`, `VacationBalance`, `Notification`, `PushSubscription`, `Client`, `Project`, `MonthClose`, `ExportJob`, `WebhookEndpoint`, `AutomationRule`

---

## Design-Prinzipien

### SVG-Architektur

Alle Icons und Illustrationen sind als reine TypeScript-SVG-Komponenten implementiert — **kein externer Icon-Pack**.

### UI / UX

- Emerald-Green-Palette (`#059669` → `#34d399`) mit neutralen Grautönen
- Glass-Effekte, subtile Animationen, Grid-Pattern-Hintergründe
- Landing-Page: Hero → Features → Pricing → Benefits → FAQ → CTA

### Datenbank

- Prisma 7 mit PostgreSQL über Driver-Adapter (`@prisma/adapter-pg` + `pg.Pool`)
- Deutsche Enum-Werte: `AbsenceCategory` → URLAUB, KRANK, ELTERNZEIT, etc.

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
