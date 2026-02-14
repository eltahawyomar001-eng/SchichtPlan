# SchichtPlan — Intelligente Schichtplanung für Teams

Moderne SaaS-Plattform zur Schichtplanung, Mitarbeiterverwaltung und Standortorganisation.
Entwickelt für den deutschen Markt mit Next.js, Prisma und TypeScript.

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
# → DATABASE_URL, NEXTAUTH_SECRET, STRIPE_SECRET_KEY anpassen

# Datenbank migrieren
npx prisma migrate dev

# Entwicklungsserver starten
npm run dev
```

Die App läuft unter **http://localhost:3000**.

---

## Tech-Stack

| Kategorie             | Technologie                                          |
| --------------------- | ---------------------------------------------------- |
| **Framework**         | Next.js 16 (App Router)                              |
| **Sprache**           | TypeScript 5                                         |
| **Styling**           | Tailwind CSS 4                                       |
| **Datenbank**         | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)       |
| **Authentifizierung** | NextAuth 4 (Credentials, JWT)                        |
| **Zahlungen**         | Stripe                                               |
| **Icons**             | Eigene SVG-Komponenten (TypeScript)                  |
| **Illustrationen**    | Eigene SVG-Szenen mit `ResizeObserver`               |
| **Commit-System**     | Conventional Commits, Husky, commitlint, lint-staged |

---

## Projektstruktur

```
schichtplan/
├── prisma/
│   └── schema.prisma              # Datenbankschema (User, Workspace, Shift …)
├── public/                        # Statische Assets
├── src/
│   ├── app/
│   │   ├── globals.css            # Design-Tokens & Utility-Klassen
│   │   ├── layout.tsx             # Root-Layout
│   │   ├── page.tsx               # Landing-Page / Auth-Redirect
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx     # Anmeldeseite
│   │   │   └── register/page.tsx  # Registrierungsseite
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         # Dashboard-Layout (Sidebar + Topbar)
│   │   │   ├── dashboard/         # Übersichts-Dashboard
│   │   │   ├── mitarbeiter/       # Mitarbeiterverwaltung
│   │   │   ├── standorte/         # Standortverwaltung
│   │   │   ├── schichtplan/       # Wochenkalender-Schichtplan
│   │   │   └── einstellungen/     # Einstellungen & Profil
│   │   └── api/
│   │       ├── auth/              # NextAuth + Registrierung
│   │       ├── employees/         # CRUD Mitarbeiter
│   │       ├── locations/         # CRUD Standorte
│   │       └── shifts/            # CRUD Schichten
│   ├── components/
│   │   ├── icons/                 # 28 SVG-Icon-Komponenten (TypeScript)
│   │   │   ├── CalendarIcon.tsx
│   │   │   ├── ClockIcon.tsx
│   │   │   ├── SchichtPlanMark.tsx
│   │   │   ├── …                  # + 25 weitere
│   │   │   └── index.ts           # Barrel-Export
│   │   ├── svgs/                  # 4 SVG-Illustrationen (responsive)
│   │   │   ├── PlanningIllustration.tsx
│   │   │   ├── DistributionIllustration.tsx
│   │   │   ├── DayToDayIllustration.tsx
│   │   │   ├── ReportingIllustration.tsx
│   │   │   └── index.ts
│   │   ├── landing/
│   │   │   └── LandingPage.tsx    # Connecteam-inspirierte Landing-Page
│   │   ├── layout/
│   │   │   ├── sidebar.tsx        # Seitenleiste mit Navigation
│   │   │   └── topbar.tsx         # Kopfleiste mit Benachrichtigungen
│   │   ├── ui/                    # Basis-UI-Komponenten (Button, Card …)
│   │   └── providers.tsx          # SessionProvider-Wrapper
│   └── lib/
│       ├── auth.ts                # NextAuth-Konfiguration
│       ├── db.ts                  # Prisma-Client (Singleton, PrismaPg)
│       └── utils.ts               # Hilfsfunktionen (cn, formatDate …)
├── .husky/                        # Git-Hooks (commit-msg, pre-commit)
├── commitlint.config.ts           # Conventional-Commits-Regeln
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── prisma.config.ts
├── tsconfig.json
└── package.json
```

---

## Design-Prinzipien

### SVG-Architektur

Alle Icons und Illustrationen sind als reine TypeScript-SVG-Komponenten implementiert — **kein externer Icon-Pack** (kein lucide-react, kein Heroicons).

- **Icons** (`src/components/icons/`): Typ-sicher über `SVGProps<SVGSVGElement>`, mit `<defs>`-Gradienten und eindeutigen IDs, `aria-hidden="true"` für Barrierefreiheit
- **Illustrationen** (`src/components/svgs/`): Komplexe Szenen mit `useRef` + `ResizeObserver` für responsive Skalierung bei jeder Viewportgröße

### UI / UX

- Connecteam-inspiriertes Design, angepasst an den deutschen Markt
- Markenfarben: Violett-Palette (`#7C3AED` → `#A78BFA`) mit neutralen Grautönen
- Glass-Effekte, subtile Animationen (`fadeInUp`, `fadeIn`), Grid-Pattern-Hintergründe
- Landing-Page mit Hero, Feature-Sektionen, Benefits-Grid, FAQ-Akkordeon

### Datenbank

- Prisma 7 mit PostgreSQL über Driver-Adapter (`@prisma/adapter-pg` + `pg.Pool`)
- Modelle: `User` (Rollen: OWNER, ADMIN, MANAGER, EMPLOYEE), `Workspace`, `Employee`, `Location`, `Shift`, `Absence`
- Deutsche Enum-Werte: `AbsenceType` → URLAUB, KRANK, FEIERTAG, SONSTIGES

---

## Commit-Konventionen

Dieses Projekt nutzt [Conventional Commits](https://www.conventionalcommits.org/) — erzwungen durch Husky + commitlint.

```
feat(scope): Neue Funktion hinzufügen
fix(scope): Fehler beheben
docs: Dokumentation aktualisieren
style: Formatierung anpassen (kein Code-Effekt)
refactor(scope): Code umstrukturieren
perf(scope): Performance verbessern
test(scope): Tests hinzufügen oder anpassen
chore: Build-Prozess oder Tooling ändern
ci: CI/CD-Konfiguration anpassen
```

### Beispiele

```bash
git commit -m "feat(schichtplan): Wochenansicht mit Drag-and-Drop"
git commit -m "fix(auth): Session-Ablauf korrekt behandeln"
git commit -m "docs: README mit Projektstruktur ergänzt"
git commit -m "chore: Husky und commitlint konfiguriert"
```

---

## Skripte

| Befehl          | Beschreibung                |
| --------------- | --------------------------- |
| `npm run dev`   | Entwicklungsserver starten  |
| `npm run build` | Produktions-Build erstellen |
| `npm start`     | Produktionsserver starten   |
| `npm run lint`  | ESLint ausführen            |

---

## Lizenz

Proprietär — © 2025 SchichtPlan. Alle Rechte vorbehalten.
