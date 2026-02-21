#!/usr/bin/env python3
"""
SchichtPlan – Full App Audit Report Generator
Generates a professional bilingual (DE/EN) PDF report.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import (
    HexColor,
    white,
    black,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import os

# ─── Colors ──────────────────────────────────────────────────────
BRAND = HexColor("#7c3aed")
BRAND_LIGHT = HexColor("#ede9fe")
BRAND_DARK = HexColor("#5b21b6")
GREEN = HexColor("#10b981")
GREEN_BG = HexColor("#ecfdf5")
RED = HexColor("#ef4444")
RED_BG = HexColor("#fef2f2")
AMBER = HexColor("#f59e0b")
AMBER_BG = HexColor("#fffbeb")
GRAY_50 = HexColor("#f9fafb")
GRAY_100 = HexColor("#f3f4f6")
GRAY_200 = HexColor("#e5e7eb")
GRAY_500 = HexColor("#6b7280")
GRAY_700 = HexColor("#374151")
GRAY_900 = HexColor("#111827")

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "SchichtPlan_Audit_Report.pdf")

# ─── Styles ──────────────────────────────────────────────────────

def build_styles():
    ss = getSampleStyleSheet()

    styles = {
        "title": ParagraphStyle(
            "Title",
            parent=ss["Title"],
            fontSize=28,
            leading=34,
            textColor=white,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=ss["Normal"],
            fontSize=13,
            leading=18,
            textColor=HexColor("#c4b5fd"),
            alignment=TA_LEFT,
            spaceAfter=0,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=ss["Heading1"],
            fontSize=20,
            leading=26,
            textColor=BRAND_DARK,
            spaceBefore=18,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=ss["Heading2"],
            fontSize=14,
            leading=19,
            textColor=GRAY_900,
            spaceBefore=14,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=ss["Normal"],
            fontSize=10,
            leading=15,
            textColor=GRAY_700,
            spaceAfter=6,
        ),
        "body_small": ParagraphStyle(
            "BodySmall",
            parent=ss["Normal"],
            fontSize=9,
            leading=13,
            textColor=GRAY_500,
            spaceAfter=4,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=ss["Normal"],
            fontSize=9,
            leading=13,
            textColor=GRAY_700,
        ),
        "cell_bold": ParagraphStyle(
            "CellBold",
            parent=ss["Normal"],
            fontSize=9,
            leading=13,
            textColor=GRAY_900,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=ss["Normal"],
            fontSize=7,
            leading=10,
            textColor=GRAY_500,
            alignment=TA_CENTER,
        ),
        "toc_item": ParagraphStyle(
            "TOCItem",
            parent=ss["Normal"],
            fontSize=11,
            leading=22,
            textColor=GRAY_700,
            leftIndent=12,
        ),
    }
    return styles


# ─── Data ────────────────────────────────────────────────────────

def get_audit_data():
    """
    Returns the complete audit data structure with both DE and EN text.
    """

    # Feature categories with items
    # Status: "yes" = implemented, "partial" = partially done, "no" = missing
    features = [
        {
            "category_de": "1. Authentifizierung & Sicherheit",
            "category_en": "1. Authentication & Security",
            "items": [
                ("E-Mail/Passwort Login", "Email/Password Login", "yes",
                 "Vollständig implementiert mit NextAuth + bcrypt.",
                 "Fully implemented with NextAuth + bcrypt."),
                ("Registrierung mit Workspace-Erstellung", "Registration with Workspace Creation", "yes",
                 "Neuer Account erstellt automatisch einen Workspace.",
                 "New account automatically creates a workspace."),
                ("Passwort vergessen / zurücksetzen", "Forgot / Reset Password", "yes",
                 "Token-basierter Reset-Flow via E-Mail (Resend).",
                 "Token-based reset flow via email (Resend)."),
                ("Einladungssystem (Token-basiert)", "Invitation System (Token-based)", "yes",
                 "Admins laden Mitarbeiter per E-Mail ein; Token-basierte Annahme.",
                 "Admins invite employees via email; token-based acceptance."),
                ("RBAC (4 Rollen: Owner, Admin, Manager, Employee)", "RBAC (4 Roles: Owner, Admin, Manager, Employee)", "yes",
                 "21 Ressourcen mit granularer Zugriffskontrolle.",
                 "21 resources with granular access control."),
                ("Rate Limiting", "Rate Limiting", "yes",
                 "Auth: 10 Req/60s, API: 60 Req/60s – IP-basiert.",
                 "Auth: 10 req/60s, API: 60 req/60s – IP-based."),
                ("Security Headers (CSP, HSTS, X-Frame-Options)", "Security Headers (CSP, HSTS, X-Frame-Options)", "yes",
                 "DSGVO Art. 32 konform, in Middleware gesetzt.",
                 "GDPR Art. 32 compliant, set in middleware."),
                ("Zwei-Faktor-Authentifizierung (2FA)", "Two-Factor Authentication (2FA)", "no",
                 "Noch nicht implementiert.",
                 "Not yet implemented."),
                ("OAuth/SSO (Google, Microsoft)", "OAuth/SSO (Google, Microsoft)", "no",
                 "Nur Credentials-Provider vorhanden.",
                 "Only credentials provider available."),
            ],
        },
        {
            "category_de": "2. Schichtplanung (Kern-Feature)",
            "category_en": "2. Shift Scheduling (Core Feature)",
            "items": [
                ("Schichten erstellen / bearbeiten / löschen", "Create / Edit / Delete Shifts", "yes",
                 "CRUD mit Modal-Formular, Standort- und MA-Zuweisung.",
                 "CRUD with modal form, location & employee assignment."),
                ("Wochenansicht mit Filterung", "Weekly View with Filtering", "yes",
                 "Filter nach Standort, Mitarbeiter; Wochennavigation.",
                 "Filter by location, employee; week navigation."),
                ("Schichtstatus-Workflow", "Shift Status Workflow", "yes",
                 "7 Status: Geplant, Bestätigt, In Arbeit, Abgeschlossen, etc.",
                 "7 statuses: Scheduled, Confirmed, In Progress, Completed, etc."),
                ("Nacht-/Feiertags-/Sonntags-Zuschläge", "Night/Holiday/Sunday Surcharges", "yes",
                 "Automatische Erkennung mit Zuschlagsprozent im Datenmodell.",
                 "Auto-detection with surcharge percentage in data model."),
                ("Schichtvorlagen", "Shift Templates", "yes",
                 "Wiederverwendbare Vorlagen mit Start-/Endzeit, Standort, Farbe.",
                 "Reusable templates with start/end time, location, color."),
                ("Konflikterkennung (Doppelbelegung)", "Conflict Detection (Double Booking)", "yes",
                 "Automation-Regel prüft überlappende Schichten.",
                 "Automation rule checks overlapping shifts."),
                ("Schichtwiederholung (Recurring)", "Shift Recurrence (Recurring)", "yes",
                 "repeatWeeks-Feld zum Wiederholen über mehrere Wochen.",
                 "repeatWeeks field for repeating across multiple weeks."),
                ("Drag & Drop Schichtplanung", "Drag & Drop Shift Planning", "no",
                 "Kalenderansicht existiert, aber kein Drag & Drop.",
                 "Calendar view exists but no drag & drop."),
                ("Auto-Scheduling / KI-Vorschläge", "Auto-Scheduling / AI Suggestions", "no",
                 "Kein automatisches Befüllen basierend auf Verfügbarkeit.",
                 "No automatic filling based on availability."),
                ("Monatsansicht / Tagesansicht", "Monthly View / Daily View", "no",
                 "Nur Wochenansicht vorhanden.",
                 "Only weekly view available."),
            ],
        },
        {
            "category_de": "3. Mitarbeiterverwaltung",
            "category_en": "3. Employee Management",
            "items": [
                ("Mitarbeiter CRUD", "Employee CRUD", "yes",
                 "Anlegen, Bearbeiten, Löschen mit allen Stammdaten.",
                 "Create, edit, delete with all master data."),
                ("Abteilungen / Departments", "Departments", "yes",
                 "Eigene Verwaltungsseite, Farbcodierung, Standort-Zuordnung.",
                 "Dedicated management page, color coding, location assignment."),
                ("Qualifikationen / Skills", "Qualifications / Skills", "yes",
                 "Skill-Verwaltung mit Kategorien und Ablaufdatum.",
                 "Skill management with categories and expiry dates."),
                ("Standortverwaltung", "Location Management", "yes",
                 "CRUD für Standorte mit Adresse.",
                 "CRUD for locations with address."),
                ("Mitarbeiter-Profil-Verknüpfung", "Employee-Profile Linking", "yes",
                 "Mitarbeiter wird mit User-Account verknüpft.",
                 "Employee is linked to user account."),
                ("Mitarbeiter-Import (CSV/Excel)", "Employee Import (CSV/Excel)", "no",
                 "Kein Bulk-Import vorhanden.",
                 "No bulk import available."),
                ("Org-Chart / Team-Hierarchie", "Org Chart / Team Hierarchy", "no",
                 "Keine visuelle Teamstruktur.",
                 "No visual team structure."),
            ],
        },
        {
            "category_de": "4. Zeiterfassung",
            "category_en": "4. Time Tracking",
            "items": [
                ("Zeiteinträge erstellen / bearbeiten", "Create / Edit Time Entries", "yes",
                 "Formular mit Datum, Start, Ende, Pause, Bemerkungen.",
                 "Form with date, start, end, break, remarks."),
                ("6-stufiger Genehmigungs-Workflow", "6-Step Approval Workflow", "yes",
                 "Entwurf → Eingereicht → Korrektur → Zurückgewiesen → Geprüft → Bestätigt.",
                 "Draft → Submitted → Correction → Rejected → Reviewed → Confirmed."),
                ("Audit-Log pro Zeiteintrag", "Audit Log per Time Entry", "yes",
                 "Vollständige Änderungshistorie mit Kommentaren.",
                 "Complete change history with comments."),
                ("Brutto-/Netto-Minuten Berechnung", "Gross/Net Minutes Calculation", "yes",
                 "Automatische Berechnung abzüglich Pausen.",
                 "Automatic calculation minus breaks."),
                ("Stempeluhr / Live-Tracking", "Time Clock / Live Tracking", "no",
                 "Kein Ein-/Ausstempeln in Echtzeit.",
                 "No real-time clock-in/clock-out."),
                ("GPS-basierte Zeiterfassung", "GPS-based Time Tracking", "no",
                 "Keine Standortverifikation.",
                 "No location verification."),
            ],
        },
        {
            "category_de": "5. Abwesenheiten & Urlaub",
            "category_en": "5. Absences & Vacation",
            "items": [
                ("Abwesenheitsanträge (7 Kategorien)", "Absence Requests (7 Categories)", "yes",
                 "Urlaub, Krank, Elternzeit, Sonderurlaub, Unbezahlt, Fortbildung, Sonstiges.",
                 "Vacation, Sick, Parental, Special, Unpaid, Training, Other."),
                ("Genehmigungs-Workflow", "Approval Workflow", "yes",
                 "Ausstehend → Genehmigt / Abgelehnt / Storniert.",
                 "Pending → Approved / Rejected / Cancelled."),
                ("Halbtags-Unterstützung", "Half-Day Support", "yes",
                 "Start- und End-Halbtag wählbar.",
                 "Start and end half-day selectable."),
                ("Urlaubskonto pro Mitarbeiter", "Vacation Balance per Employee", "yes",
                 "Anspruch, Übertrag, Verbraucht, Geplant, Verbleibend.",
                 "Entitlement, carry-over, used, planned, remaining."),
                ("Feiertage (alle 16 Bundesländer)", "Public Holidays (all 16 Federal States)", "yes",
                 "Automatische Erkennung nach Bundesland.",
                 "Auto-detection by federal state."),
                ("Teamkalender-Übersicht", "Team Calendar Overview", "no",
                 "Kein visueller Kalender mit Abwesenheits-Überlappungen.",
                 "No visual calendar with absence overlaps."),
            ],
        },
        {
            "category_de": "6. Verfügbarkeiten",
            "category_en": "6. Availability",
            "items": [
                ("Wöchentliche Verfügbarkeit setzen", "Set Weekly Availability", "yes",
                 "Pro Wochentag mit Typ (Verfügbar, Bevorzugt, Nicht verfügbar).",
                 "Per weekday with type (Available, Preferred, Unavailable)."),
                ("Gültigkeitszeitraum", "Validity Period", "yes",
                 "validFrom / validUntil für zeitbegrenzte Verfügbarkeiten.",
                 "validFrom / validUntil for time-limited availability."),
            ],
        },
        {
            "category_de": "7. Schichttausch & -änderungen",
            "category_en": "7. Shift Swaps & Changes",
            "items": [
                ("Schichttausch-Anfragen", "Shift Swap Requests", "yes",
                 "Mitarbeiter können Tausch anfragen; 6-stufiger Status.",
                 "Employees can request swaps; 6-step status."),
                ("Schichtänderungs-Anfragen", "Shift Change Requests", "yes",
                 "Datum, Zeit, Notizen ändern mit Begründung.",
                 "Change date, time, notes with reason."),
                ("Manager-Genehmigung", "Manager Approval", "yes",
                 "Genehmigung / Ablehnung mit Review-Notiz.",
                 "Approval / rejection with review note."),
            ],
        },
        {
            "category_de": "8. Zeitkonten & Lohnexport",
            "category_en": "8. Time Accounts & Payroll Export",
            "items": [
                ("Zeitkonto pro Mitarbeiter", "Time Account per Employee", "yes",
                 "Vertragsstunden, Übertrag, aktueller Saldo.",
                 "Contract hours, carry-over, current balance."),
                ("DATEV-Lohnexport (CSV)", "DATEV Payroll Export (CSV)", "yes",
                 "Export im DATEV-Format für den Steuerberater.",
                 "Export in DATEV format for tax consultant."),
                ("Lohnexport-Vorschau", "Payroll Export Preview", "yes",
                 "Tabellarische Vorschau vor Download.",
                 "Tabular preview before download."),
                ("Integration mit Lohnabrechnungs-Software", "Payroll Software Integration", "no",
                 "Nur CSV-Export, keine API-Integration.",
                 "Only CSV export, no API integration."),
            ],
        },
        {
            "category_de": "9. Berichte & Analysen",
            "category_en": "9. Reports & Analytics",
            "items": [
                ("Monatsberichte", "Monthly Reports", "yes",
                 "Zusammenfassung: Schichten, Stunden, Abwesenheiten, MA-Statistiken.",
                 "Summary: shifts, hours, absences, employee statistics."),
                ("Frei wählbarer Zeitraum", "Custom Date Range", "yes",
                 "Start- und Enddatum frei einstellbar.",
                 "Start and end date freely adjustable."),
                ("Stunden pro Mitarbeiter", "Hours per Employee", "yes",
                 "Individuelle Aufschlüsselung im Bericht.",
                 "Individual breakdown in report."),
                ("Diagramme / Grafiken", "Charts / Graphs", "no",
                 "Nur tabellarische Darstellung, keine Diagramme.",
                 "Only tabular display, no charts."),
                ("Export als PDF/Excel", "Export as PDF/Excel", "no",
                 "Berichte können nicht heruntergeladen werden.",
                 "Reports cannot be downloaded."),
            ],
        },
        {
            "category_de": "10. Benachrichtigungen",
            "category_en": "10. Notifications",
            "items": [
                ("In-App Benachrichtigungen", "In-App Notifications", "yes",
                 "Dropdown mit ungelesenen Nachrichten, Link zur Seite.",
                 "Dropdown with unread messages, link to page."),
                ("E-Mail-Benachrichtigungen", "Email Notifications", "yes",
                 "Über Resend versandt; ein/ausschaltbar.",
                 "Sent via Resend; toggleable."),
                ("E-Mail-Präferenzen", "Email Preferences", "yes",
                 "Eigene Einstellungsseite zum Aktivieren/Deaktivieren.",
                 "Dedicated settings page to enable/disable."),
                ("Push-Benachrichtigungen", "Push Notifications", "no",
                 "Datenmodell existiert, aber kein Service Worker.",
                 "Data model exists but no service worker."),
            ],
        },
        {
            "category_de": "11. Automatisierungen",
            "category_en": "11. Automations",
            "items": [
                ("Automatisierungs-Engine", "Automation Engine", "yes",
                 "10+ Regeln: Konflikterkennung, Zuschläge, Pausen-Prüfung etc.",
                 "10+ rules: conflict detection, surcharges, break validation etc."),
                ("Pro-Workspace ein-/ausschaltbar", "Per-Workspace Toggle", "yes",
                 "Jede Regel kann individuell aktiviert/deaktiviert werden.",
                 "Each rule can be individually toggled on/off."),
                ("Benutzerdefinierte Regeln", "Custom Rules", "no",
                 "Nur vordefinierte Regeln, keine eigenen erstellbar.",
                 "Only predefined rules, no custom ones."),
            ],
        },
        {
            "category_de": "12. Internationalisierung (i18n)",
            "category_en": "12. Internationalization (i18n)",
            "items": [
                ("Deutsch (Standard)", "German (Default)", "yes",
                 "Vollständig übersetzt mit next-intl.",
                 "Fully translated with next-intl."),
                ("Englisch", "English", "yes",
                 "Vollständig übersetzt als zweite Sprache.",
                 "Fully translated as second language."),
                ("Sprachumschalter", "Language Switcher", "yes",
                 "In Navbar und Dashboard verfügbar.",
                 "Available in navbar and dashboard."),
                ("Weitere Sprachen (TR, PL, AR, etc.)", "Additional Languages (TR, PL, AR, etc.)", "no",
                 "Nur DE/EN unterstützt.",
                 "Only DE/EN supported."),
            ],
        },
        {
            "category_de": "13. PWA & Mobile",
            "category_en": "13. PWA & Mobile",
            "items": [
                ("PWA Manifest & Icons", "PWA Manifest & Icons", "yes",
                 "Standalone-App mit Branding, alle Icon-Größen.",
                 "Standalone app with branding, all icon sizes."),
                ("iOS/Android Installier-Prompt", "iOS/Android Install Prompt", "yes",
                 "Smartes Banner mit 14-Tage-Cooldown.",
                 "Smart banner with 14-day cooldown."),
                ("Safe-Area-Insets (Notch/Dynamic Island)", "Safe-Area Insets (Notch/Dynamic Island)", "yes",
                 "Alle Seiten und Modals PWA-konform.",
                 "All pages and modals PWA-compliant."),
                ("Responsive Design", "Responsive Design", "yes",
                 "Mobile-First mit Bottom-Sheet-Modals.",
                 "Mobile-first with bottom-sheet modals."),
                ("Offline-Modus / Service Worker", "Offline Mode / Service Worker", "no",
                 "Kein Offline-Caching implementiert.",
                 "No offline caching implemented."),
            ],
        },
        {
            "category_de": "14. Einstellungen",
            "category_en": "14. Settings",
            "items": [
                ("Profilbearbeitung (Name)", "Profile Editing (Name)", "yes",
                 "Name ändern in Einstellungen.",
                 "Change name in settings."),
                ("Passwort ändern", "Change Password", "yes",
                 "Altes + neues Passwort mit Validierung.",
                 "Old + new password with validation."),
                ("Team-Verwaltung (Mitglieder & Einladungen)", "Team Management (Members & Invitations)", "yes",
                 "Rollen ändern, Mitglieder entfernen, Einladungen senden/widerrufen.",
                 "Change roles, remove members, send/revoke invitations."),
                ("Workspace-Einstellungen (Name, Branche, Bundesland)", "Workspace Settings (Name, Industry, State)", "yes",
                 "Editierbar für Owner/Admin.",
                 "Editable for Owner/Admin."),
                ("Konto löschen", "Delete Account", "yes",
                 "Account-Löschung mit Bestätigungs-Dialog.",
                 "Account deletion with confirmation dialog."),
                ("Daten-Export (DSGVO)", "Data Export (GDPR)", "yes",
                 "JSON-Export aller persönlichen Daten (Art. 20 DSGVO).",
                 "JSON export of all personal data (Art. 20 GDPR)."),
            ],
        },
        {
            "category_de": "15. Rechtliches / Compliance",
            "category_en": "15. Legal / Compliance",
            "items": [
                ("Datenschutzerklärung", "Privacy Policy", "yes",
                 "Eigene Seite unter /datenschutz.",
                 "Dedicated page at /datenschutz."),
                ("Impressum", "Legal Notice / Imprint", "yes",
                 "Eigene Seite unter /impressum.",
                 "Dedicated page at /impressum."),
                ("AGB", "Terms of Service", "yes",
                 "Eigene Seite unter /agb.",
                 "Dedicated page at /agb."),
                ("Widerrufsbelehrung", "Cancellation Policy", "yes",
                 "Eigene Seite unter /widerruf.",
                 "Dedicated page at /widerruf."),
                ("Barrierefreiheitserklärung", "Accessibility Statement", "yes",
                 "Eigene Seite unter /barrierefreiheit.",
                 "Dedicated page at /barrierefreiheit."),
                ("DSGVO-Einwilligung bei Registrierung", "GDPR Consent at Registration", "yes",
                 "Checkbox mit Timestamp (consentGivenAt).",
                 "Checkbox with timestamp (consentGivenAt)."),
            ],
        },
        {
            "category_de": "16. Infrastruktur & DevOps",
            "category_en": "16. Infrastructure & DevOps",
            "items": [
                ("Next.js 16 App Router", "Next.js 16 App Router", "yes",
                 "Neueste Version mit Server Components.",
                 "Latest version with Server Components."),
                ("PostgreSQL (Supabase)", "PostgreSQL (Supabase)", "yes",
                 "Produktions-Datenbank mit Connection Pooling.",
                 "Production database with connection pooling."),
                ("Prisma ORM 7.4", "Prisma ORM 7.4", "yes",
                 "Type-safe Datenbankzugriff.",
                 "Type-safe database access."),
                ("Vercel Deployment", "Vercel Deployment", "yes",
                 "Automatisches Deployment bei Push auf main.",
                 "Auto-deployment on push to main."),
                ("ESLint + Prettier + Husky", "ESLint + Prettier + Husky", "yes",
                 "Code-Qualität mit Pre-Commit-Hooks.",
                 "Code quality with pre-commit hooks."),
                ("Commitlint (Conventional Commits)", "Commitlint (Conventional Commits)", "yes",
                 "Erzwungene konventionelle Commit-Messages.",
                 "Enforced conventional commit messages."),
                ("Stripe Integration (vorbereitet)", "Stripe Integration (Prepared)", "partial",
                 "Pakete installiert, aber kein Billing-Flow.",
                 "Packages installed but no billing flow."),
                ("CI/CD Pipeline (GitHub Actions)", "CI/CD Pipeline (GitHub Actions)", "no",
                 "Keine automatisierten Tests oder Pipelines.",
                 "No automated tests or pipelines."),
                ("Automatisierte Tests", "Automated Tests", "no",
                 "Keine Unit-/Integration-/E2E-Tests.",
                 "No unit/integration/E2E tests."),
                ("Logging / Monitoring (Sentry, etc.)", "Logging / Monitoring (Sentry, etc.)", "no",
                 "Keine Fehlerüberwachung eingerichtet.",
                 "No error monitoring set up."),
            ],
        },
        {
            "category_de": "17. Landing Page & Marketing",
            "category_en": "17. Landing Page & Marketing",
            "items": [
                ("Professionelle Landing Page", "Professional Landing Page", "yes",
                 "Hero, Features, Testimonials, CTA-Sektionen.",
                 "Hero, features, testimonials, CTA sections."),
                ("SEO Metadaten", "SEO Metadata", "partial",
                 "Basis-Metadaten vorhanden, aber kein sitemap.xml.",
                 "Basic metadata present but no sitemap.xml."),
                ("Blog / Content-Marketing", "Blog / Content Marketing", "no",
                 "Kein Blog oder Content-Bereich.",
                 "No blog or content area."),
                ("Preisseite", "Pricing Page", "no",
                 "Keine öffentliche Preisübersicht.",
                 "No public pricing overview."),
            ],
        },
    ]

    return features


# ─── PDF Builder ─────────────────────────────────────────────────

def draw_cover_page(canvas, doc):
    """Custom cover page background."""
    w, h = A4
    # Gradient-like background
    canvas.setFillColor(BRAND)
    canvas.rect(0, h * 0.55, w, h * 0.45, fill=1, stroke=0)
    canvas.setFillColor(BRAND_DARK)
    canvas.rect(0, h * 0.55, w, 3, fill=1, stroke=0)


def draw_page_footer(canvas, doc):
    """Standard page footer with page number."""
    w, h = A4
    canvas.setFillColor(GRAY_200)
    canvas.rect(0, 0, w, 18 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_500)
    canvas.drawCentredString(
        w / 2, 10 * mm,
        f"SchichtPlan Audit Report  •  {datetime.now().strftime('%d.%m.%Y')}  •  Seite / Page {doc.page}",
    )


def build_pdf():
    styles = build_styles()
    features = get_audit_data()

    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=25 * mm,
    )

    story = []

    # ── Cover Page ───────────────────────────────────────────────

    story.append(Spacer(1, 100 * mm))
    story.append(Paragraph("SchichtPlan", styles["title"]))
    story.append(Paragraph("App-Audit-Bericht / App Audit Report", styles["subtitle"]))
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            f'<font color="#c4b5fd" size="10">{datetime.now().strftime("%d. %B %Y")}</font>',
            styles["subtitle"],
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            '<font color="#c4b5fd" size="9">Erstellt für / Prepared for: Stakeholder Review</font>',
            styles["subtitle"],
        )
    )

    story.append(PageBreak())

    # ── Table of Contents ────────────────────────────────────────

    story.append(Paragraph("Inhaltsverzeichnis / Table of Contents", styles["h1"]))
    story.append(Spacer(1, 4 * mm))

    toc_items = [
        "Zusammenfassung / Executive Summary",
        "Feature-Übersicht / Feature Overview",
    ]
    for f in features:
        toc_items.append(f'{f["category_de"]} / {f["category_en"]}')
    toc_items.append("Fehlende Features / Missing Features")
    toc_items.append("Empfehlungen / Recommendations")

    for i, item in enumerate(toc_items, 1):
        story.append(
            Paragraph(f'<font color="{BRAND.hexval()}">{i}.</font>  {item}', styles["toc_item"])
        )

    story.append(PageBreak())

    # ── Executive Summary ────────────────────────────────────────

    story.append(Paragraph("Zusammenfassung / Executive Summary", styles["h1"]))

    # Count features
    total = sum(len(cat["items"]) for cat in features)
    done = sum(1 for cat in features for it in cat["items"] if it[2] == "yes")
    partial = sum(1 for cat in features for it in cat["items"] if it[2] == "partial")
    missing = sum(1 for cat in features for it in cat["items"] if it[2] == "no")

    pct = int(done / total * 100) if total else 0

    story.append(Paragraph("<b>DE:</b>", styles["body"]))
    story.append(
        Paragraph(
            f"SchichtPlan ist eine <b>Schichtplanungs-SaaS</b> für den deutschen Markt, "
            f"gebaut mit Next.js 16, TypeScript, Prisma und PostgreSQL. "
            f"Die App ist als <b>Progressive Web App (PWA)</b> installierbar und "
            f"vollständig in Deutsch und Englisch lokalisiert.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            f"Von <b>{total} geprüften Features</b> sind "
            f'<font color="{GREEN.hexval()}"><b>{done} vollständig implementiert</b></font>, '
            f'<font color="{AMBER.hexval()}"><b>{partial} teilweise vorhanden</b></font> und '
            f'<font color="{RED.hexval()}"><b>{missing} noch nicht umgesetzt</b></font>. '
            f"Das ergibt einen <b>Umsetzungsgrad von {pct}%</b>.",
            styles["body"],
        )
    )

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("<b>EN:</b>", styles["body"]))
    story.append(
        Paragraph(
            f"SchichtPlan is a <b>shift scheduling SaaS</b> for the German market, "
            f"built with Next.js 16, TypeScript, Prisma, and PostgreSQL. "
            f"The app is installable as a <b>Progressive Web App (PWA)</b> and "
            f"fully localized in German and English.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            f"Out of <b>{total} audited features</b>, "
            f'<font color="{GREEN.hexval()}"><b>{done} are fully implemented</b></font>, '
            f'<font color="{AMBER.hexval()}"><b>{partial} are partially available</b></font>, and '
            f'<font color="{RED.hexval()}"><b>{missing} are not yet built</b></font>. '
            f"This gives an <b>implementation rate of {pct}%</b>.",
            styles["body"],
        )
    )

    # Summary stats box
    story.append(Spacer(1, 6 * mm))
    summary_data = [
        [
            Paragraph(f'<font size="20" color="{GREEN.hexval()}"><b>{done}</b></font>', styles["cell"]),
            Paragraph(f'<font size="20" color="{AMBER.hexval()}"><b>{partial}</b></font>', styles["cell"]),
            Paragraph(f'<font size="20" color="{RED.hexval()}"><b>{missing}</b></font>', styles["cell"]),
            Paragraph(f'<font size="20" color="{BRAND.hexval()}"><b>{pct}%</b></font>', styles["cell"]),
        ],
        [
            Paragraph('<font size="8">Implementiert\nImplemented</font>', styles["cell"]),
            Paragraph('<font size="8">Teilweise\nPartial</font>', styles["cell"]),
            Paragraph('<font size="8">Fehlt\nMissing</font>', styles["cell"]),
            Paragraph('<font size="8">Fortschritt\nProgress</font>', styles["cell"]),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[38 * mm, 38 * mm, 38 * mm, 38 * mm])
    summary_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_200),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, GRAY_200),
            ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(summary_table)

    story.append(PageBreak())

    # ── Feature Detail Sections ──────────────────────────────────

    story.append(Paragraph("Feature-Übersicht / Feature Overview", styles["h1"]))
    story.append(
        Paragraph(
            "Im Folgenden werden alle Features nach Kategorie aufgelistet. "
            "Jedes Feature wird bewertet und auf Deutsch sowie Englisch beschrieben.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            '<i>Below, all features are listed by category. '
            'Each feature is rated and described in German and English.</i>',
            styles["body_small"],
        )
    )
    story.append(Spacer(1, 4 * mm))

    status_labels = {
        "yes": ("✓ Vorhanden / Implemented", GREEN, GREEN_BG),
        "partial": ("◐ Teilweise / Partial", AMBER, AMBER_BG),
        "no": ("✗ Fehlt / Missing", RED, RED_BG),
    }

    for cat in features:
        # Category heading
        story.append(
            Paragraph(
                f'{cat["category_de"]}<br/>'
                f'<font color="{GRAY_500.hexval()}" size="10"><i>{cat["category_en"]}</i></font>',
                styles["h2"],
            )
        )

        # Build table
        header = [
            Paragraph('<font size="8"><b>Feature</b></font>', styles["cell_bold"]),
            Paragraph('<font size="8"><b>Status</b></font>', styles["cell_bold"]),
            Paragraph('<font size="8"><b>Details (DE / EN)</b></font>', styles["cell_bold"]),
        ]

        rows = [header]
        for name_de, name_en, status, desc_de, desc_en in cat["items"]:
            label, color, bg = status_labels[status]
            rows.append([
                Paragraph(
                    f'<font size="8">{name_de}</font><br/>'
                    f'<font size="7" color="{GRAY_500.hexval()}"><i>{name_en}</i></font>',
                    styles["cell"],
                ),
                Paragraph(
                    f'<font size="7" color="{color.hexval()}"><b>{label.split("/")[0].strip()}</b></font><br/>'
                    f'<font size="6" color="{color.hexval()}"><i>{label.split("/")[1].strip()}</i></font>',
                    styles["cell"],
                ),
                Paragraph(
                    f'<font size="8">{desc_de}</font><br/>'
                    f'<font size="7" color="{GRAY_500.hexval()}"><i>{desc_en}</i></font>',
                    styles["cell"],
                ),
            ])

        col_widths = [48 * mm, 28 * mm, 78 * mm]
        t = Table(rows, colWidths=col_widths, repeatRows=1)

        # Style: alternating rows, header, borders
        table_style_cmds = [
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_LIGHT),
            ("TEXTCOLOR", (0, 0), (-1, 0), GRAY_900),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_200),
            ("LINEBELOW", (0, 0), (-1, 0), 1, BRAND),
            ("LINEBELOW", (0, 1), (-1, -1), 0.3, GRAY_200),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]

        # Alternating row backgrounds
        for i in range(1, len(rows)):
            if i % 2 == 0:
                table_style_cmds.append(
                    ("BACKGROUND", (0, i), (-1, i), GRAY_50)
                )

        # Color-code status column background
        for i, row_data in enumerate(cat["items"], 1):
            _, _, status, _, _ = row_data
            _, _, bg = status_labels[status]
            table_style_cmds.append(
                ("BACKGROUND", (1, i), (1, i), bg)
            )

        t.setStyle(TableStyle(table_style_cmds))
        story.append(KeepTogether([t]))
        story.append(Spacer(1, 6 * mm))

    story.append(PageBreak())

    # ── Missing Features Summary ─────────────────────────────────

    story.append(Paragraph("Fehlende Features / Missing Features", styles["h1"]))
    story.append(
        Paragraph(
            "Die folgenden Features fehlen noch und sollten für einen vollwertigen "
            "Produktlaunch priorisiert werden:",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            '<i>The following features are still missing and should be prioritized '
            'for a full product launch:</i>',
            styles["body_small"],
        )
    )
    story.append(Spacer(1, 3 * mm))

    missing_items = []
    for cat in features:
        for name_de, name_en, status, desc_de, desc_en in cat["items"]:
            if status == "no":
                missing_items.append((name_de, name_en, cat["category_de"], cat["category_en"]))

    missing_header = [
        Paragraph('<font size="8"><b>#</b></font>', styles["cell_bold"]),
        Paragraph('<font size="8"><b>Feature</b></font>', styles["cell_bold"]),
        Paragraph('<font size="8"><b>Kategorie / Category</b></font>', styles["cell_bold"]),
    ]
    missing_rows = [missing_header]
    for i, (nde, nen, cde, cen) in enumerate(missing_items, 1):
        missing_rows.append([
            Paragraph(f'<font size="8">{i}</font>', styles["cell"]),
            Paragraph(
                f'<font size="8">{nde}</font><br/>'
                f'<font size="7" color="{GRAY_500.hexval()}"><i>{nen}</i></font>',
                styles["cell"],
            ),
            Paragraph(
                f'<font size="8">{cde.split(".")[0].strip()}. …</font><br/>'
                f'<font size="7" color="{GRAY_500.hexval()}"><i>{cen.split(".")[0].strip()}. …</i></font>',
                styles["cell"],
            ),
        ])

    missing_table = Table(missing_rows, colWidths=[10 * mm, 70 * mm, 74 * mm], repeatRows=1)
    missing_table_style = [
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), RED_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), GRAY_900),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_200),
        ("LINEBELOW", (0, 0), (-1, 0), 1, RED),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, GRAY_200),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(missing_rows)):
        if i % 2 == 0:
            missing_table_style.append(("BACKGROUND", (0, i), (-1, i), GRAY_50))

    missing_table.setStyle(TableStyle(missing_table_style))
    story.append(missing_table)

    story.append(PageBreak())

    # ── Recommendations ──────────────────────────────────────────

    story.append(Paragraph("Empfehlungen / Recommendations", styles["h1"]))

    recommendations = [
        (
            "Höchste Priorität / Highest Priority",
            [
                ("Automatisierte Tests (Unit + E2E)",
                 "Automated Tests (Unit + E2E)",
                 "Ohne Tests ist jedes Deployment riskant. Jest + Playwright empfohlen.",
                 "Without tests, every deployment is risky. Jest + Playwright recommended."),
                ("CI/CD Pipeline",
                 "CI/CD Pipeline",
                 "GitHub Actions für Lint, Test, Build, Deploy.",
                 "GitHub Actions for lint, test, build, deploy."),
                ("Fehlerüberwachung (Sentry)",
                 "Error Monitoring (Sentry)",
                 "Produktionsfehler werden sonst nicht erkannt.",
                 "Production errors will otherwise go unnoticed."),
            ],
        ),
        (
            "Hohe Priorität / High Priority",
            [
                ("Drag & Drop Schichtplanung",
                 "Drag & Drop Shift Planning",
                 "Wettbewerbsvorteil – Benutzer erwarten dies.",
                 "Competitive advantage – users expect this."),
                ("Stempeluhr / Live-Tracking",
                 "Time Clock / Live Tracking",
                 "Essentiell für Branchen mit Vor-Ort-Arbeit.",
                 "Essential for industries with on-site work."),
                ("Push-Benachrichtigungen",
                 "Push Notifications",
                 "PWA-Infrastruktur existiert bereits; Service Worker fehlt.",
                 "PWA infrastructure already exists; service worker missing."),
                ("Stripe Billing Flow",
                 "Stripe Billing Flow",
                 "Pakete installiert, aber kein Checkout/Subscription.",
                 "Packages installed but no checkout/subscription."),
            ],
        ),
        (
            "Mittlere Priorität / Medium Priority",
            [
                ("OAuth/SSO (Google, Microsoft)",
                 "OAuth/SSO (Google, Microsoft)",
                 "Senkt die Registrierungshürde.",
                 "Lowers the registration barrier."),
                ("Monats- und Tagesansicht",
                 "Monthly & Daily View",
                 "Flexiblere Schichtplanung.",
                 "More flexible shift planning."),
                ("Diagramme in Berichten",
                 "Charts in Reports",
                 "Visuelle Aufbereitung der Daten.",
                 "Visual data presentation."),
                ("Bericht-Export (PDF/Excel)",
                 "Report Export (PDF/Excel)",
                 "Manager wollen Berichte herunterladen.",
                 "Managers want to download reports."),
            ],
        ),
        (
            "Niedrige Priorität / Lower Priority",
            [
                ("Weitere Sprachen (TR, PL, AR)",
                 "Additional Languages (TR, PL, AR)",
                 "Für Expansion in andere Märkte.",
                 "For expansion into other markets."),
                ("CSV/Excel-Import für Mitarbeiter",
                 "CSV/Excel Import for Employees",
                 "Hilfreich für große Teams beim Onboarding.",
                 "Helpful for large teams during onboarding."),
                ("2FA / Zwei-Faktor-Authentifizierung",
                 "2FA / Two-Factor Authentication",
                 "Sicherheits-Upgrade für Enterprise-Kunden.",
                 "Security upgrade for enterprise customers."),
                ("Blog / Content-Marketing + Preisseite",
                 "Blog / Content Marketing + Pricing Page",
                 "Für SEO und Conversion-Optimierung.",
                 "For SEO and conversion optimization."),
            ],
        ),
    ]

    for priority_label, items in recommendations:
        story.append(Paragraph(f"<b>{priority_label}</b>", styles["h2"]))
        for nde, nen, dde, den in items:
            story.append(
                Paragraph(
                    f'<font color="{BRAND.hexval()}">▸</font> '
                    f'<b>{nde}</b> / <i>{nen}</i>',
                    styles["body"],
                )
            )
            story.append(
                Paragraph(
                    f'    {dde}<br/>'
                    f'    <font color="{GRAY_500.hexval()}"><i>{den}</i></font>',
                    styles["body_small"],
                )
            )
        story.append(Spacer(1, 4 * mm))

    # ── Tech Stack Summary ───────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Tech-Stack / Technology Stack", styles["h1"]))

    stack_data = [
        ["Frontend", "Next.js 16.1.6, React 19, TypeScript 5, Tailwind CSS 4"],
        ["Backend", "Next.js API Routes (App Router), Server Components"],
        ["Datenbank / Database", "PostgreSQL (Supabase), Prisma ORM 7.4"],
        ["Auth", "NextAuth 4 (Credentials Provider), bcrypt"],
        ["E-Mail", "Resend (Pro), Domain: shiftdemo.shop"],
        ["i18n", "next-intl 4.8.2 (DE + EN)"],
        ["Validierung / Validation", "Zod 4"],
        ["PWA", "Web Manifest, Safe-Area Insets, Install Prompt"],
        ["Hosting", "Vercel (Production)"],
        ["Code-Qualität / Quality", "ESLint, Prettier, Husky, Commitlint"],
        ["Zahlungen / Payments", "Stripe (Pakete installiert, Flow ausstehend)"],
    ]

    stack_header = [
        Paragraph('<font size="9"><b>Komponente / Component</b></font>', styles["cell_bold"]),
        Paragraph('<font size="9"><b>Technologie / Technology</b></font>', styles["cell_bold"]),
    ]

    stack_rows = [stack_header]
    for comp, tech in stack_data:
        stack_rows.append([
            Paragraph(f'<font size="9">{comp}</font>', styles["cell"]),
            Paragraph(f'<font size="9">{tech}</font>', styles["cell"]),
        ])

    stack_table = Table(stack_rows, colWidths=[50 * mm, 104 * mm], repeatRows=1)
    stack_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_200),
            ("LINEBELOW", (0, 0), (-1, 0), 1, BRAND),
            ("LINEBELOW", (0, 1), (-1, -1), 0.3, GRAY_200),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(stack_table)

    # ── Build ────────────────────────────────────────────────────

    doc.build(
        story,
        onFirstPage=draw_cover_page,
        onLaterPages=draw_page_footer,
    )

    print(f"\n✅ Report generated: {OUTPUT_PATH}")
    print(f"   Total features: {total}")
    print(f"   Implemented: {done} ({pct}%)")
    print(f"   Partial: {partial}")
    print(f"   Missing: {missing}")


if __name__ == "__main__":
    build_pdf()
