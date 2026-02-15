#!/usr/bin/env python3
"""
SchichtPlan - Business & Investment Report Generator
Generates a professional dual-language (DE/EN) PDF report
covering product capabilities, gaps, architecture, and roadmap.
"""

import os
import datetime
from fpdf import FPDF

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")
TODAY = datetime.date.today().strftime("%d.%m.%Y")
YEAR = datetime.date.today().year


# ─────────────────────────────────────────────
# Data
# ─────────────────────────────────────────────

WORKING_FEATURES = [
    {
        "category_de": "Authentifizierung & Registrierung",
        "category_en": "Authentication & Registration",
        "items": [
            ("E-Mail + Passwort Registrierung", "Email + password registration", "Benutzer + Workspace in einer Transaktion erstellt", "Creates user + workspace in a single transaction"),
            ("Login mit Zugangsdaten", "Credentials login", "JWT-basierte Sitzung via NextAuth", "JWT-based session via NextAuth"),
            ("Abmeldung", "Logout", "Von Sidebar und Einstellungen", "From sidebar and settings page"),
            ("Passwort ändern", "Password change", "Sicheres Hashing mit bcrypt", "Secure hashing with bcrypt"),
            ("Profilname bearbeiten", "Profile name editing", "Inline-Bearbeitung in Einstellungen", "Inline editing in settings"),
        ],
    },
    {
        "category_de": "Dashboard",
        "category_en": "Dashboard",
        "items": [
            ("Statistik-Karten", "Stats cards", "Mitarbeiter, Schichten, Standorte, heutige Schichten", "Employees, shifts, locations, today's shifts"),
            ("Onboarding-Assistent (3 Schritte)", "Onboarding wizard (3 steps)", "Wird angezeigt wenn Standort/Mitarbeiter/Schicht = 0", "Shows when location/employee/shift count = 0"),
            ("Heutige Schichtliste", "Today's shift list", "Zeitzonenbereinigt (Europe/Berlin)", "Timezone-aware (Europe/Berlin)"),
            ("Ausstehende Elemente", "Pending items panel", "Abwesenheiten, Tausch, Zeiteinträge", "Absences, swaps, time entries"),
            ("Schnellaktionen", "Quick action buttons", "Links zum Erstellen von Mitarbeitern/Schichten/Standorten", "Links to create employee/shift/location"),
        ],
    },
    {
        "category_de": "Schichtplanung",
        "category_en": "Shift Planning",
        "items": [
            ("Wochenkalender-Ansicht (Mo-So)", "Weekly calendar grid (Mon-Sun)", "Desktop 7-Spalten + mobiles vertikales Layout", "Desktop 7-column + mobile vertical layout"),
            ("Schichten erstellen/bearbeiten/löschen", "Create/edit/delete shifts", "Modal-Formulare mit Bestätigung", "Modal forms with confirmation dialogs"),
            ("Standortfilter", "Location filter", "Client-seitige Filterung", "Client-side dropdown filtering"),
            ("Wiederkehrende Schichten", "Recurring shifts", "Bis zu 52 Wochen Wiederholung", "Up to 52 weeks repetition"),
            ("Konfliktprüfung bei Erstellung", "Conflict detection on create", "Überlappung, Abwesenheit, Ruhezeit, Stundenlimits", "Overlap, absence, rest period, hour limits"),
        ],
    },
    {
        "category_de": "Mitarbeiterverwaltung",
        "category_en": "Employee Management",
        "items": [
            ("CRUD mit Suche", "CRUD with search", "Kartenlayout mit Avatar, E-Mail, Telefon, Stundensatz", "Card layout with avatar, email, phone, hourly rate"),
            ("Aktivieren/Deaktivieren", "Activate/deactivate toggle", "Badge-Klick schaltet isActive um", "Badge click toggles isActive"),
            ("Automatische Farbzuweisung", "Auto color assignment", "Zufaellige Farbe bei Erstellung", "Random color on creation"),
        ],
    },
    {
        "category_de": "Standortverwaltung",
        "category_en": "Location Management",
        "items": [
            ("CRUD mit Suche", "CRUD with search", "Karten-Grid mit Erstellung/Bearbeitung/Löschung", "Card grid with create/edit/delete"),
        ],
    },
    {
        "category_de": "Zeiterfassung",
        "category_en": "Time Tracking",
        "items": [
            ("Erstellen/Bearbeiten/Löschen", "Create/edit/delete", "Nur im Status ENTWURF/KORREKTUR bearbeitbar", "Only editable in DRAFT/CORRECTION status"),
            ("6-Stufen-Status-Workflow", "6-step status workflow", "ENTWURF > EINGEREICHT > GEPRUEFT > BESTAETIGT (mit Korrekturschleife)", "DRAFT > SUBMITTED > REVIEWED > CONFIRMED (with correction loop)"),
            ("Rollenbasierte Aktionen", "Role-based actions", "Manager: genehmigen/ablehnen/korrigieren. Mitarbeiter: einreichen", "Managers: approve/reject/correct. Employees: submit"),
            ("Überlappungserkennung", "Overlap detection", "Verhindert doppelte Einträge", "Prevents duplicate entries"),
            ("Audit-Protokoll", "Audit log", "Protokolliert jede Statusänderung", "Records every status change with performer + diff"),
            ("CSV-Export", "CSV export", "Deutsches Semikolon-Format für Excel", "German semicolon-separated with BOM for Excel"),
            ("ArbZG-konforme Pausenberechnung", "ArbZG break enforcement", "Automatische Pausenanpassung", "Auto-adjusts break minutes per German labor law"),
        ],
    },
    {
        "category_de": "Abwesenheitsverwaltung",
        "category_en": "Absence Management",
        "items": [
            ("Antrag erstellen", "Create request", "7 Kategorien, Datumsbereich, Halbtags-Unterstützung", "7 categories, date range, half-day support"),
            ("Genehmigen/Ablehnen", "Approve/reject", "Mit kaskadierender Schichtabsage", "With cascading shift cancellation"),
            ("Überlappungsprüfung", "Overlap check", "Verhindert doppelte Anträge", "Prevents duplicate requests"),
            ("Automatische Genehmigung", "Auto-approve", "Für Krankheit konfigurierbar", "Configurable for sick leave"),
        ],
    },
    {
        "category_de": "Schichttausch",
        "category_en": "Shift Swap",
        "items": [
            ("Tausch erstellen", "Create swap request", "Antragsteller, Schicht, optionales Ziel", "Requester, shift, optional target"),
            ("Tausch genehmigen/ablehnen", "Approve/reject", "Mit tatsaechlicher Schichtumzuweisung", "With actual shift reassignment in transaction"),
        ],
    },
    {
        "category_de": "Verfügbarkeiten",
        "category_en": "Availability",
        "items": [
            ("Wöchentliche Verfügbarkeit setzen", "Set weekly availability", "7-Tage-Formular mit Typ + Zeitraum", "7-day form with type + time range"),
            ("3 Verfügbarkeitstypen", "3 availability types", "Verfügbar, Bevorzugt, Nicht Verfügbar", "Available, Preferred, Not Available"),
        ],
    },
    {
        "category_de": "Zeitkonten",
        "category_en": "Time Accounts",
        "items": [
            ("Konto erstellen/aktualisieren", "Create/update account", "Vertragsstunden, Übertrag, Periodenbeginn", "Contract hours, carryover, period start"),
            ("Saldoberechnung", "Balance calculation", "Übertrag + gearbeitet - erwartet", "Carryover + worked - expected"),
            ("Fortschrittsbalken", "Progress bar", "Visuell gearbeitet vs. erwartet", "Visual worked vs expected"),
        ],
    },
    {
        "category_de": "Lohnexport",
        "category_en": "Payroll Export",
        "items": [
            ("DATEV-kompatibler CSV-Export", "DATEV-compatible CSV export", "Nur bestätigte Einträge", "Only confirmed entries"),
            ("Vorschau-Tabelle", "Preview table", "JSON-Modus zeigt Aufschlüsselung pro Mitarbeiter", "JSON mode shows per-employee breakdown"),
            ("Datumsbereich + Mitarbeiterfilter", "Date range + employee filter", "Schnellvoreinstellungen verfügbar", "Quick presets available"),
        ],
    },
    {
        "category_de": "Automatisierungen (10 Regeln)",
        "category_en": "Automations Engine (10 rules)",
        "items": [
            ("Schichtkonflikterkennung", "Shift conflict detection", "Überlappung, Abwesenheit, Verfügbarkeit", "Overlap, absence, unavailability"),
            ("Ruhezeit-Durchsetzung (ArbZG 11h)", "Rest period enforcement (ArbZG 11h)", "Prüft vorherigen/nächsten Tag", "Checks prev/next day"),
            ("Max. Tagesstunden (10h)", "Max daily hours (10h)", "ArbZG Paragraph 3", "ArbZG section 3"),
            ("Max. Wochenstunden (48h)", "Max weekly hours (48h)", "ArbZG Paragraph 3", "ArbZG section 3"),
            ("Kaskadierende Abwesenheitsabsage", "Cascade absence cancellation", "Storniert überlappende Schichten", "Cancels overlapping shifts"),
            ("Auto-Zeiteinträge aus Schichten", "Auto-create time entries", "Cron-fähiger Endpunkt", "Cron-ready endpoint"),
            ("Gesetzliche Pausenberechnung", "Legal break enforcement", "ArbZG-konforme Pausenminuten", "ArbZG-compliant break minutes"),
            ("Zeitkonten-Neuberechnung", "Time account recalculation", "Bei Bestätigungen ausgelöst", "Triggered on confirmation"),
            ("Auto-Genehmigung", "Auto-approve", "Für Krankheit und konfliktfreie Tausche", "For sick leave and conflict-free swaps"),
            ("Überstundenwarnungen", "Overtime alerts", "Cron-fähiger Endpunkt", "Cron-ready endpoint"),
        ],
    },
    {
        "category_de": "Benachrichtigungen",
        "category_en": "Notifications",
        "items": [
            ("In-App-Benachrichtigungen", "In-app notifications", "Polling, Badge, als gelesen markieren", "Polling, badge, mark-read"),
            ("E-Mail via Resend", "Email via Resend", "Vorlagen für alle wichtigen Ereignisse", "Templates for all major events"),
            ("Benachrichtigungseinstellungen", "Notification preferences", "E-Mail-Toggle pro Benutzer", "Per-user email opt-in/out"),
        ],
    },
    {
        "category_de": "Internationalisierung",
        "category_en": "Internationalization",
        "items": [
            ("Deutsch (Standard)", "German (default)", "Vollständige Abdeckung", "Full coverage"),
            ("Englisch", "English", "Vollständige Abdeckung", "Full coverage"),
            ("Cookie-basierter Sprachwechsel", "Cookie-based locale switching", "next-intl v4.8.2", "next-intl v4.8.2"),
        ],
    },
]

BUGS = [
    {
        "title_de": "Keine Konfliktprüfung bei Schichtbearbeitung",
        "title_en": "No conflict detection on shift edit",
        "severity": "MITTEL / MEDIUM",
        "desc_de": "PATCH /api/shifts/[id] ruft checkShiftConflicts nicht auf. Schichten koennen so bearbeitet werden, dass sie sich überlappen oder Ruhezeiten verletzen.",
        "desc_en": "PATCH /api/shifts/[id] does not call checkShiftConflicts. Shifts can be edited to overlap or violate rest periods silently.",
        "location": "src/app/api/shifts/[id]/route.ts",
    },
    {
        "title_de": "Schichttausch-Formular: defekter Filter",
        "title_en": "Shift swap form: broken filter",
        "severity": "MITTEL / MEDIUM",
        "desc_de": "Die Variable requesterShifts in schichttausch/page.tsx (Zeile 195) hat eine Filterbedingung die immer true ergibt. Das Dropdown zeigt alle Schichten statt nur die des Antragstellers.",
        "desc_en": "The requesterShifts variable in schichttausch/page.tsx (line 195) has a filter condition that always returns true. The dropdown shows all shifts instead of only the requester's.",
        "location": "src/app/(dashboard)/schichttausch/page.tsx:195",
    },
    {
        "title_de": "Gemischte Fehlersprachen in API",
        "title_en": "Mixed error languages in API",
        "severity": "NIEDRIG / LOW",
        "desc_de": "Einige API-Routen geben deutsche Strings zurück, andere englische. Inkonsistente Fehlerbehandlung.",
        "desc_en": "Some API routes return German strings, others English. Inconsistent error handling.",
        "location": "Diverse API-Routen / Various API routes",
    },
    {
        "title_de": "Keine Middleware für Routenschutz",
        "title_en": "No middleware for route protection",
        "severity": "HOCH / HIGH",
        "desc_de": "Keine middleware.ts existiert. Alle Dashboard-Routen sind auf Edge-Ebene ungeschuetzt. Sitzung wird nur in API-Handlern und Server-Komponenten geprüft.",
        "desc_en": "No middleware.ts exists. All dashboard routes are unprotected at edge level. Session is only checked inside API handlers and server components.",
        "location": "Fehlend / Missing: middleware.ts",
    },
]

DEAD_CODE = [
    ("requesterShifts Variable", "requesterShifts variable", "schichttausch/page.tsx:195",
     "Berechnet aber nie korrekt verwendet. Filter ist immer true.",
     "Computed but never correctly used. Filter always returns true."),
    ("MANAGER / EMPLOYEE Rollen", "MANAGER / EMPLOYEE roles", "schema.prisma",
     "Existiert im Enum, aber keine UI zum Zuweisen. Registrierung erstellt immer OWNER.",
     "Exists in enum but no UI to assign roles. Registration always creates OWNER."),
    ("ShiftStatus Enum (6 Werte)", "ShiftStatus enum (6 values)", "schema.prisma",
     "Schichten haben immer SCHEDULED. Kein Workflow zum Ändern.",
     "Shifts are always SCHEDULED. No workflow to change status."),
    ("shiftId auf TimeEntry", "shiftId on TimeEntry", "schema.prisma",
     "Optionale Verknuepfung existiert, wird aber in der UI nie gesetzt.",
     "Optional link exists but is never set from the UI."),
    ("phone / image auf User", "phone / image on User", "schema.prisma",
     "Felder existieren, keine UI zum Setzen.",
     "Fields exist, no UI to set them."),
    ("industry auf Workspace", "industry on Workspace", "schema.prisma",
     "Existiert im Schema, wird nie erhoben oder angezeigt.",
     "Exists in schema, never collected or displayed."),
    ("Account / Session / VerificationToken Modelle", "Account / Session / VerificationToken models", "schema.prisma",
     "NextAuth OAuth-Modelle, aber nur Credentials-Provider konfiguriert. Tabellen sind immer leer.",
     "NextAuth OAuth models but only Credentials provider configured. Tables always empty."),
    ("test-email Route", "test-email route", "api/test-email/route.ts",
     "Funktioniert, aber keine UI zeigt sie an. Nur via curl aufrufbar.",
     "Works but no UI exposes it. Only callable via curl."),
    ("validUntil auf Availability", "validUntil on Availability", "schema.prisma",
     "Feld für ablaufende Verfügbarkeit existiert, Formular setzt es nie.",
     "Field for expiring availability exists, form never sets it."),
    ("Cron-Endpunkte (3x)", "Cron endpoints (3x)", "api/automations/*",
     "3 Endpunkte unterstützen CRON_SECRET, aber keine vercel.json existiert.",
     "3 endpoints support CRON_SECRET but no vercel.json exists."),
]

MISSING_FEATURES = [
    ("Passwort-Zurücksetzen", "Password Reset", "MITTEL / MEDIUM",
     "Kein E-Mail-basierter Passwort-Reset. Login zeigt nur 'Administrator kontaktieren'.",
     "No email-based password reset. Login just shows 'contact administrator'."),
    ("Team-Einladungen", "Team Invitations", "HOCH / HIGH",
     "Kein Weg, andere Benutzer in den Workspace einzuladen. Jeder muss sich separat registrieren.",
     "No way to invite other users into the workspace. Each must register separately."),
    ("Mitarbeiter-Benutzer-Verknuepfung", "Employee-User Linking", "HOCH / HIGH",
     "Employee und User sind separate Modelle. Kein Self-Service für Mitarbeiter.",
     "Employee and User are separate models. No self-service for employees."),
    ("Schichtstatus-Workflow", "Shift Status Workflow", "MITTEL / MEDIUM",
     "6 Status im Enum, aber keine UI oder API zum Ändern. Immer SCHEDULED.",
     "6 statuses in enum but no UI or API to change. Always SCHEDULED."),
    ("Vercel Cron-Konfiguration", "Vercel Cron Configuration", "MITTEL / MEDIUM",
     "3 Automatisierungsendpunkte sind bereit, aber kein vercel.json konfiguriert.",
     "3 automation endpoints are ready but no vercel.json is configured."),
    ("Urlaubskontingent-Verwaltung", "Vacation Balance Tracking", "MITTEL / MEDIUM",
     "Abwesenheiten werden erfasst, aber kein Resturlaubszaehler.",
     "Absences are tracked but no remaining vacation days counter."),
    ("Mitarbeiter-Self-Service", "Employee Self-Service", "HOCH / HIGH",
     "Mitarbeiter koennen ihren eigenen Dienstplan nicht einsehen, Zeiten einreichen oder Abwesenheiten beantragen.",
     "Employees cannot view their own schedule, submit time entries, or request absences."),
    ("Drag-and-Drop Schichtplanung", "Drag-and-Drop Shift Planning", "NIEDRIG / LOW",
     "Schichten nur über Formular verschiebbar.",
     "Shifts can only be moved by editing the form."),
    ("Kalender Monats-/Tagesansicht", "Calendar Month/Day View", "NIEDRIG / LOW",
     "Nur Wochenansicht verfügbar.",
     "Only weekly view available."),
    ("PDF/Druck-Export Schichtplan", "PDF/Print Export for Shifts", "NIEDRIG / LOW",
     "Kein Druckformat oder PDF-Generierung.",
     "No print format or PDF generation."),
    ("Workspace-Namen bearbeiten", "Workspace Name Editing", "NIEDRIG / LOW",
     "Einstellungen zeigen ID, aber kein Weg den Namen zu ändern.",
     "Settings show ID but no way to change the name."),
    ("Dunkelmodus", "Dark Mode", "NIEDRIG / LOW",
     "Keine Dark-Mode-Unterstützung.",
     "No dark mode support."),
]

TECH_STACK = [
    ("Frontend", "Next.js 16.1.6, React 19.2, TypeScript 5, Tailwind CSS 4"),
    ("Backend", "Next.js API Routes (App Router), Server Components"),
    ("Datenbank / Database", "Supabase PostgreSQL + Prisma 7.4 (Driver Adapter)"),
    ("Authentifizierung / Auth", "NextAuth 4.24 (JWT + Credentials)"),
    ("E-Mail / Email", "Resend SDK"),
    ("i18n", "next-intl 4.8.2 (Cookie-basiert / Cookie-based)"),
    ("Icons", "55+ benutzerdefinierte SVG-Komponenten / 55+ custom SVG components"),
    ("Hosting", "Vercel (geplant / planned)"),
]

ARCHITECTURE_STATS = {
    "pages_de": "13 Seiten (1 Landing, 2 Auth, 11 Dashboard)",
    "pages_en": "13 pages (1 landing, 2 auth, 11 dashboard)",
    "api_de": "~20 API-Endpunkte in 15 Routendateien",
    "api_en": "~20 API endpoints across 15 route files",
    "models_de": "14 Datenbankmodelle",
    "models_en": "14 database models",
    "enums_de": "9 Enums",
    "enums_en": "9 enums",
    "icons_de": "55+ SVG-Komponenten",
    "icons_en": "55+ SVG components",
    "i18n_de": "~300+ Übersetzungsschluessel (DE + EN)",
    "i18n_en": "~300+ translation keys (DE + EN)",
    "automations_de": "10 deterministische Automatisierungsregeln",
    "automations_en": "10 deterministic automation rules",
}

ROADMAP = [
    {
        "phase_de": "Phase 1 - Kritische Korrekturen (1-2 Wochen)",
        "phase_en": "Phase 1 - Critical Fixes (1-2 weeks)",
        "items_de": [
            "middleware.ts für Routenschutz hinzufuegen",
            "Konfliktprüfung bei Schichtbearbeitung einbauen",
            "Schichttausch-Filter reparieren",
            "vercel.json Cron-Konfiguration erstellen",
        ],
        "items_en": [
            "Add middleware.ts for route protection",
            "Add conflict detection on shift edit",
            "Fix shift swap filter logic",
            "Create vercel.json cron configuration",
        ],
    },
    {
        "phase_de": "Phase 2 - Kernfunktionen (3-6 Wochen)",
        "phase_en": "Phase 2 - Core Features (3-6 weeks)",
        "items_de": [
            "Team-Einladungsystem via E-Mail",
            "Mitarbeiter-Benutzer-Verknuepfung + Self-Service-Portal",
            "Passwort-Zurücksetzen via E-Mail (Resend)",
            "Rollenmanagement-UI (OWNER/MANAGER/EMPLOYEE)",
        ],
        "items_en": [
            "Team invitation system via email",
            "Employee-user linking + self-service portal",
            "Password reset via email (Resend)",
            "Role management UI (OWNER/MANAGER/EMPLOYEE)",
        ],
    },
    {
        "phase_de": "Phase 3 - Erweiterungen (6-12 Wochen)",
        "phase_en": "Phase 3 - Enhancements (6-12 weeks)",
        "items_de": [
            "Urlaubskontingent-Verwaltung",
            "Schichtstatus-Workflow-UI",
            "Kalender Monats-/Tagesansicht",
            "Drag-and-Drop Schichtplanung",
            "PDF/Druck-Export",
            "Dunkelmodus",
        ],
        "items_en": [
            "Vacation balance tracking",
            "Shift status workflow UI",
            "Calendar month/day view",
            "Drag-and-drop shift planning",
            "PDF/print export",
            "Dark mode",
        ],
    },
]


# ─────────────────────────────────────────────
# PDF Builder
# ─────────────────────────────────────────────

class ReportPDF(FPDF):
    """Custom PDF class with SchichtPlan branding."""

    BRAND_DARK = (15, 23, 42)       # slate-900
    BRAND_PRIMARY = (59, 130, 246)   # blue-500
    BRAND_GREEN = (34, 197, 94)      # green-500
    BRAND_RED = (239, 68, 68)        # red-500
    BRAND_AMBER = (245, 158, 11)     # amber-500
    BRAND_GRAY = (100, 116, 139)     # slate-500
    BRAND_LIGHT = (241, 245, 249)    # slate-100
    WHITE = (255, 255, 255)

    def __init__(self, lang: str = "de"):
        super().__init__()
        self.lang = lang
        self.set_auto_page_break(auto=True, margin=25)

        # Add Unicode font (DejaVu)
        fonts_dir = os.path.join(os.path.dirname(__file__), "fonts")
        self.add_font("DejaVu", "", os.path.join(fonts_dir, "DejaVuSans.ttf"))
        self.add_font("DejaVu", "B", os.path.join(fonts_dir, "DejaVuSans-Bold.ttf"))
        self.add_font("DejaVu", "I", os.path.join(fonts_dir, "DejaVuSans-Oblique.ttf"))
        self.add_font("DejaVu", "BI", os.path.join(fonts_dir, "DejaVuSans-BoldOblique.ttf"))

    # ── Header / Footer ──

    def header(self):
        if self.page_no() == 1:
            return  # cover page has its own header
        self.set_font("DejaVu", "B", 9)
        self.set_text_color(*self.BRAND_GRAY)
        title = "SchichtPlan - Produktbericht" if self.lang == "de" else "SchichtPlan - Product Report"
        self.cell(0, 8, title, align="L")
        self.cell(0, 8, TODAY, align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*self.BRAND_PRIMARY)
        self.set_line_width(0.4)
        self.line(10, self.get_y(), self.w - 10, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-20)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*self.BRAND_GRAY)
        if self.lang == "de":
            txt = f"SchichtPlan  |  Vertraulich  |  Seite {self.page_no()}/{{nb}}"
        else:
            txt = f"SchichtPlan  |  Confidential  |  Page {self.page_no()}/{{nb}}"
        self.cell(0, 10, txt, align="C")

    # ── Helpers ──

    def _section_title(self, num: str, title: str):
        self.ln(4)
        self.set_font("DejaVu", "B", 16)
        self.set_text_color(*self.BRAND_DARK)
        self.cell(0, 10, f"{num}  {title}", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*self.BRAND_PRIMARY)
        self.set_line_width(0.6)
        self.line(10, self.get_y(), 80, self.get_y())
        self.ln(6)

    def _sub_title(self, title: str):
        self.set_font("DejaVu", "B", 12)
        self.set_text_color(*self.BRAND_PRIMARY)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def _body(self, text: str):
        self.set_font("DejaVu", "", 10)
        self.set_text_color(*self.BRAND_DARK)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def _bullet(self, text: str, indent: int = 14):
        self.set_font("DejaVu", "", 10)
        self.set_text_color(*self.BRAND_DARK)
        x = self.l_margin + indent
        self.set_x(x)
        bullet_w = 6
        self.cell(bullet_w, 5.5, chr(8226))
        # remaining width for text
        w = self.w - x - bullet_w - self.r_margin
        self.multi_cell(w, 5.5, text)

    def _badge(self, text: str, color: tuple):
        self.set_font("DejaVu", "B", 8)
        w = self.get_string_width(text) + 6
        x = self.get_x()
        y = self.get_y()
        self.set_fill_color(*color)
        self.set_text_color(*self.WHITE)
        self.rect(x, y, w, 5.5, style="F")
        self.set_xy(x + 1, y)
        self.cell(w - 2, 5.5, text)
        self.set_xy(x + w + 2, y)
        self.set_text_color(*self.BRAND_DARK)

    def _table_header(self, cols: list[tuple[str, int]]):
        self.set_font("DejaVu", "B", 9)
        self.set_fill_color(*self.BRAND_DARK)
        self.set_text_color(*self.WHITE)
        for label, w in cols:
            self.cell(w, 7, label, border=1, fill=True, align="C")
        self.ln()
        self.set_text_color(*self.BRAND_DARK)

    def _table_row(self, vals: list[tuple[str, int]], fill: bool = False):
        self.set_font("DejaVu", "", 9)
        if fill:
            self.set_fill_color(*self.BRAND_LIGHT)
        max_h = 7
        # Calculate row height
        x_start = self.get_x()
        y_start = self.get_y()
        heights = []
        for text, w in vals:
            n_lines = max(1, len(self.multi_cell(w, 5, text, dry_run=True, output="LINES")))
            heights.append(n_lines * 5)
        max_h = max(heights)
        # Check page break
        if y_start + max_h > self.h - 25:
            self.add_page()
            y_start = self.get_y()
        # Draw cells
        for i, (text, w) in enumerate(vals):
            self.set_xy(x_start + sum(ww for _, ww in vals[:i]), y_start)
            if fill:
                self.rect(self.get_x(), self.get_y(), w, max_h, style="F")
            self.set_xy(x_start + sum(ww for _, ww in vals[:i]) + 1, y_start + 1)
            self.multi_cell(w - 2, 5, text)
        self.set_xy(x_start, y_start + max_h)

    # ── Cover Page ──

    def cover_page(self):
        self.add_page()
        self.ln(40)
        # Brand box
        self.set_fill_color(*self.BRAND_DARK)
        self.rect(0, 30, self.w, 90, style="F")
        self.set_y(45)
        self.set_font("DejaVu", "B", 36)
        self.set_text_color(*self.WHITE)
        self.cell(0, 16, "SchichtPlan", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("DejaVu", "", 14)
        if self.lang == "de":
            self.cell(0, 8, "Intelligente Schichtplanung für den deutschen Markt", align="C", new_x="LMARGIN", new_y="NEXT")
        else:
            self.cell(0, 8, "Intelligent Shift Scheduling for the German Market", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(6)
        self.set_font("DejaVu", "", 11)
        self.set_draw_color(*self.BRAND_PRIMARY)
        self.set_line_width(0.3)
        self.line(60, self.get_y(), self.w - 60, self.get_y())
        self.ln(8)
        if self.lang == "de":
            self.cell(0, 7, "Produkt- und Investitionsbericht", align="C", new_x="LMARGIN", new_y="NEXT")
        else:
            self.cell(0, 7, "Product & Investment Report", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 7, TODAY, align="C", new_x="LMARGIN", new_y="NEXT")

        # Below brand box
        self.set_y(140)
        self.set_text_color(*self.BRAND_DARK)
        self.set_font("DejaVu", "B", 12)
        if self.lang == "de":
            self.cell(0, 8, "Inhaltsverzeichnis", align="L", new_x="LMARGIN", new_y="NEXT")
        else:
            self.cell(0, 8, "Table of Contents", align="L", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        toc = [
            ("1", "Executive Summary"),
            ("2", "Technologie-Stack / Technology Stack"),
            ("3", "Architektur / Architecture"),
            ("4", "Funktionsumfang / Feature Inventory" if self.lang == "de" else "Feature Inventory"),
            ("5", "Bekannte Fehler / Known Bugs"),
            ("6", "Toter Code / Dead Code & Unused Schema"),
            ("7", "Fehlende Funktionen / Missing Features" if self.lang == "de" else "Missing Features / Gaps"),
            ("8", "Roadmap"),
            ("9", "Zusammenfassung / Conclusion" if self.lang == "de" else "Conclusion"),
        ]
        self.set_font("DejaVu", "", 11)
        for num, title in toc:
            self.cell(8, 7, num + ".")
            self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")

    # ── Sections ──

    def section_executive_summary(self):
        self.add_page()
        self._section_title("1", "Executive Summary")
        if self.lang == "de":
            self._body(
                "SchichtPlan ist eine vollständig entwickelte SaaS-Lösung für die Schichtplanung, "
                "die speziell für den deutschen Markt konzipiert wurde. Die Plattform deckt den gesamten "
                "Lebenszyklus der Personalschichtplanung ab: von der Mitarbeiter- und Standortverwaltung "
                "über die Schichtplanung und Zeiterfassung bis hin zum Lohnexport im DATEV-Format."
            )
            self._body(
                "Die Anwendung befindet sich in einem fortgeschrittenen Entwicklungsstadium mit 11 voll "
                "funktionsfähigen Dashboard-Seiten, 20+ API-Endpunkten, 14 Datenbankmodellen und einer "
                "Automatisierungs-Engine mit 10 konfigurierbaren Regeln. Die gesamte Plattform ist zweisprachig "
                "(Deutsch/Englisch) und konform mit dem Arbeitszeitgesetz (ArbZG)."
            )
            self._body(
                "Wesentliche Stärken:\n"
                "  - ArbZG-konforme Arbeitszeitprüfung (Ruhezeiten, Pausen, Stundenlimits)\n"
                "  - 6-stufiger Zeiterfassungs-Workflow mit vollständigem Audit-Trail\n"
                "  - DATEV-kompatibler Lohnexport\n"
                "  - 10 konfigurierbare Automatisierungsregeln\n"
                "  - Vollständige Zweisprachigkeit (DE/EN)"
            )
            self._body(
                "Kritische Lücken die vor einem Marktstart adressiert werden müssen:\n"
                "  - Fehlender Routenschutz (keine middleware.ts)\n"
                "  - Keine Team-Einladungsfunktion (Multi-User unmöglich)\n"
                "  - Mitarbeiter nicht mit Benutzerkonten verknuepft (kein Self-Service)"
            )
        else:
            self._body(
                "SchichtPlan is a fully developed SaaS solution for shift scheduling, specifically designed "
                "for the German market. The platform covers the complete lifecycle of workforce shift management: "
                "from employee and location management, through shift planning and time tracking, to payroll "
                "export in DATEV format."
            )
            self._body(
                "The application is in an advanced development stage with 11 fully functional dashboard pages, "
                "20+ API endpoints, 14 database models, and an automation engine with 10 configurable rules. "
                "The entire platform is bilingual (German/English) and compliant with the German Working Time Act (ArbZG)."
            )
            self._body(
                "Key strengths:\n"
                "  - ArbZG-compliant working time validation (rest periods, breaks, hour limits)\n"
                "  - 6-step time entry workflow with full audit trail\n"
                "  - DATEV-compatible payroll export\n"
                "  - 10 configurable automation rules\n"
                "  - Full bilingual support (DE/EN)"
            )
            self._body(
                "Critical gaps that must be addressed before market launch:\n"
                "  - Missing route protection (no middleware.ts)\n"
                "  - No team invitation feature (multi-user impossible)\n"
                "  - Employees not linked to user accounts (no self-service)"
            )

    def section_tech_stack(self):
        self.add_page()
        self._section_title("2", "Technologie-Stack / Technology Stack" if self.lang == "de" else "Technology Stack")
        cols = [
            ("Bereich / Layer" if self.lang == "de" else "Layer", 50),
            ("Technologie / Technology" if self.lang == "de" else "Technology", 140),
        ]
        self._table_header(cols)
        for i, (layer, tech) in enumerate(TECH_STACK):
            self._table_row([(layer, 50), (tech, 140)], fill=(i % 2 == 0))
        self.ln(6)

    def section_architecture(self):
        self._section_title("3", "Architektur / Architecture" if self.lang == "de" else "Architecture")
        stats = ARCHITECTURE_STATS
        suffix = f"_{self.lang}"
        items = [
            ("Seiten / Pages" if self.lang == "de" else "Pages", stats[f"pages{suffix}"]),
            ("API-Endpunkte / API Endpoints" if self.lang == "de" else "API Endpoints", stats[f"api{suffix}"]),
            ("Datenbankmodelle / DB Models" if self.lang == "de" else "DB Models", stats[f"models{suffix}"]),
            ("Enums", stats[f"enums{suffix}"]),
            ("Icons", stats[f"icons{suffix}"]),
            ("i18n", stats[f"i18n{suffix}"]),
            ("Automatisierungen / Automations" if self.lang == "de" else "Automations", stats[f"automations{suffix}"]),
        ]
        cols = [
            ("Metrik / Metric" if self.lang == "de" else "Metric", 70),
            ("Wert / Value" if self.lang == "de" else "Value", 120),
        ]
        self._table_header(cols)
        for i, (metric, value) in enumerate(items):
            self._table_row([(metric, 70), (value, 120)], fill=(i % 2 == 0))
        self.ln(6)

    def section_features(self):
        self.add_page()
        title = "Funktionsumfang" if self.lang == "de" else "Feature Inventory"
        self._section_title("4", title)
        if self.lang == "de":
            self._body(
                "Die folgende Tabelle listet alle funktionierenden Features der Anwendung, "
                "gruppiert nach Kategorie. Jede Funktion wurde anhand des Quellcodes verifiziert."
            )
        else:
            self._body(
                "The following table lists all working features of the application, "
                "grouped by category. Each feature has been verified against the source code."
            )

        total_features = sum(len(cat["items"]) for cat in WORKING_FEATURES)
        self._body(f"{'Gesamtzahl' if self.lang == 'de' else 'Total features'}: {total_features}")
        self.ln(2)

        for cat in WORKING_FEATURES:
            cat_name = cat[f"category_{self.lang}"]
            self._sub_title(cat_name)
            col_feat = "Funktion" if self.lang == "de" else "Feature"
            col_note = "Details" if self.lang == "de" else "Details"
            cols = [(col_feat, 70), (col_note, 120)]
            self._table_header(cols)
            for i, item in enumerate(cat["items"]):
                if self.lang == "de":
                    feat, note = item[0], item[2]
                else:
                    feat, note = item[1], item[3]
                self._table_row([(feat, 70), (note, 120)], fill=(i % 2 == 0))
            self.ln(4)

    def section_bugs(self):
        self.add_page()
        title = "Bekannte Fehler" if self.lang == "de" else "Known Bugs"
        self._section_title("5", title)
        if self.lang == "de":
            self._body(f"Es wurden {len(BUGS)} Fehler im Quellcode identifiziert:")
        else:
            self._body(f"{len(BUGS)} bugs were identified in the source code:")
        self.ln(2)
        for bug in BUGS:
            title_key = f"title_{self.lang}"
            desc_key = f"desc_{self.lang}"
            severity = bug["severity"]

            self.set_font("DejaVu", "B", 11)
            self.set_text_color(*self.BRAND_DARK)
            self.cell(0, 7, bug[title_key], new_x="LMARGIN", new_y="NEXT")

            # Severity badge
            sev_text = severity
            if "HOCH" in severity or "HIGH" in severity:
                color = self.BRAND_RED
            elif "MITTEL" in severity or "MEDIUM" in severity:
                color = self.BRAND_AMBER
            else:
                color = self.BRAND_GRAY
            self._badge(sev_text, color)
            self.ln(3)

            self.set_font("DejaVu", "I", 9)
            self.set_text_color(*self.BRAND_GRAY)
            loc_label = "Ort" if self.lang == "de" else "Location"
            self.cell(0, 5, f"{loc_label}: {bug['location']}", new_x="LMARGIN", new_y="NEXT")

            self._body(bug[desc_key])
            self.ln(3)

    def section_dead_code(self):
        self.add_page()
        title = "Toter Code & unbenutztes Schema" if self.lang == "de" else "Dead Code & Unused Schema"
        self._section_title("6", title)
        if self.lang == "de":
            self._body(
                f"Die folgenden {len(DEAD_CODE)} Elemente existieren im Quellcode oder Datenbankschema, "
                "erfuellen aber keine Funktion oder werden nie genutzt:"
            )
        else:
            self._body(
                f"The following {len(DEAD_CODE)} items exist in the source code or database schema "
                "but serve no function or are never used:"
            )
        self.ln(2)

        col_item = "Element" if self.lang == "de" else "Item"
        col_loc = "Ort" if self.lang == "de" else "Location"
        col_reason = "Grund" if self.lang == "de" else "Reason"
        cols = [(col_item, 50), (col_loc, 45), (col_reason, 95)]
        self._table_header(cols)
        for i, entry in enumerate(DEAD_CODE):
            if self.lang == "de":
                item, loc, reason = entry[0], entry[2], entry[3]
            else:
                item, loc, reason = entry[1], entry[2], entry[4]
            self._table_row([(item, 50), (loc, 45), (reason, 95)], fill=(i % 2 == 0))
        self.ln(4)

    def section_missing(self):
        self.add_page()
        title = "Fehlende Funktionen" if self.lang == "de" else "Missing Features"
        self._section_title("7", title)
        if self.lang == "de":
            self._body(
                f"{len(MISSING_FEATURES)} fehlende Funktionen wurden identifiziert, "
                "priorisiert nach Auswirkung auf die Marktreife:"
            )
        else:
            self._body(
                f"{len(MISSING_FEATURES)} missing features were identified, "
                "prioritized by impact on market readiness:"
            )
        self.ln(2)

        col_feat = "Funktion" if self.lang == "de" else "Feature"
        col_prio = "Priorität" if self.lang == "de" else "Priority"
        col_desc = "Beschreibung" if self.lang == "de" else "Description"
        cols = [(col_feat, 45), (col_prio, 30), (col_desc, 115)]
        self._table_header(cols)
        for i, entry in enumerate(MISSING_FEATURES):
            if self.lang == "de":
                feat, desc = entry[0], entry[3]
            else:
                feat, desc = entry[1], entry[4]
            prio = entry[2]
            self._table_row([(feat, 45), (prio, 30), (desc, 115)], fill=(i % 2 == 0))
        self.ln(4)

    def section_roadmap(self):
        self.add_page()
        self._section_title("8", "Roadmap")
        if self.lang == "de":
            self._body(
                "Die folgende Roadmap priorisiert die Entwicklung in drei Phasen, "
                "basierend auf Kritikalitaet und Marktreife-Anforderungen:"
            )
        else:
            self._body(
                "The following roadmap prioritizes development in three phases, "
                "based on criticality and market readiness requirements:"
            )
        self.ln(2)

        for phase in ROADMAP:
            phase_key = f"phase_{self.lang}"
            items_key = f"items_{self.lang}"
            self._sub_title(phase[phase_key])
            for item in phase[items_key]:
                self._bullet(item)
            self.ln(4)

    def section_conclusion(self):
        self.add_page()
        title = "Zusammenfassung" if self.lang == "de" else "Conclusion"
        self._section_title("9", title)
        if self.lang == "de":
            self._body(
                "SchichtPlan ist ein technisch ausgereiftes Produkt mit einer soliden Architektur "
                "und einem umfassenden Funktionsumfang. Die Plattform adressiert ein klar definiertes "
                "Marktsegment - die Schichtplanung für kleine und mittlere Unternehmen im deutschen Markt - "
                "mit besonderem Fokus auf ArbZG-Konformitaet."
            )
            self._body(
                "Das Produkt befindet sich in einem Zustand, in dem die Kernfunktionalitaet vollständig "
                "implementiert ist, aber kritische Lücken im Bereich Multi-User-Fähigkeit und "
                "Sicherheit geschlossen werden müssen, bevor ein öffentlicher Launch möglich ist."
            )
            self._body(
                "Mit der Umsetzung der Phase-1-Korrekturen (geschaetzt 1-2 Wochen) wäre das Produkt "
                "technisch für einen Beta-Launch bereit. Die Phase-2-Erweiterungen (3-6 Wochen) würden "
                "die Multi-User-Fähigkeit ermöglichen, die für eine Kommerzialisierung unabdingbar ist."
            )
            self._sub_title("Investitions-Highlights")
            highlights = [
                "Vollständig ArbZG-konformer Tech-Stack - einzigartiges Differenzierungsmerkmal",
                "14 Datenbankmodelle, 20+ API-Endpunkte, 11 Dashboard-Seiten = erheblicher bestehender Entwicklungswert",
                "DATEV-Lohnexport integriert = sofortige Kompatibilitaet mit deutscher Lohnbuchhaltung",
                "Zweisprachig (DE/EN) = Expansionsfähigkeit in DACH-Region und darüber hinaus",
                "Modulare Automatisierungs-Engine = Plattform-Erweiterbarkeit für künftige Regeln",
                "Moderner Tech-Stack (Next.js 16, React 19, Prisma 7) = langfristige Wartbarkeit",
            ]
            for h in highlights:
                self._bullet(h)
        else:
            self._body(
                "SchichtPlan is a technically mature product with a solid architecture "
                "and comprehensive feature set. The platform addresses a clearly defined "
                "market segment - shift scheduling for small and medium enterprises in the German market - "
                "with special focus on ArbZG (Working Time Act) compliance."
            )
            self._body(
                "The product is in a state where core functionality is fully implemented, "
                "but critical gaps in multi-user capability and security must be closed "
                "before a public launch is possible."
            )
            self._body(
                "With implementation of Phase 1 fixes (estimated 1-2 weeks), the product would be "
                "technically ready for a beta launch. Phase 2 enhancements (3-6 weeks) would enable "
                "multi-user capability, which is essential for commercialization."
            )
            self._sub_title("Investment Highlights")
            highlights = [
                "Fully ArbZG-compliant tech stack - unique differentiator in the market",
                "14 database models, 20+ API endpoints, 11 dashboard pages = significant existing development value",
                "DATEV payroll export integrated = immediate compatibility with German payroll accounting",
                "Bilingual (DE/EN) = expansion capability into DACH region and beyond",
                "Modular automation engine = platform extensibility for future rules",
                "Modern tech stack (Next.js 16, React 19, Prisma 7) = long-term maintainability",
            ]
            for h in highlights:
                self._bullet(h)

    # ── Build ──

    def build(self) -> str:
        self.alias_nb_pages()
        self.cover_page()
        self.section_executive_summary()
        self.section_tech_stack()
        self.section_architecture()
        self.section_features()
        self.section_bugs()
        self.section_dead_code()
        self.section_missing()
        self.section_roadmap()
        self.section_conclusion()

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        filename = f"SchichtPlan_Report_{self.lang.upper()}_{TODAY.replace('.', '-')}.pdf"
        path = os.path.join(OUTPUT_DIR, filename)
        self.output(path)
        return path


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  SchichtPlan Report Generator")
    print("=" * 60)
    print()

    # German report
    print("[1/2] Generating German report (DE)...")
    pdf_de = ReportPDF(lang="de")
    path_de = pdf_de.build()
    print(f"      Saved: {path_de}")

    # English report
    print("[2/2] Generating English report (EN)...")
    pdf_en = ReportPDF(lang="en")
    path_en = pdf_en.build()
    print(f"      Saved: {path_en}")

    print()
    print("-" * 60)
    print(f"  Both reports saved to: {OUTPUT_DIR}/")
    print("-" * 60)


if __name__ == "__main__":
    main()
