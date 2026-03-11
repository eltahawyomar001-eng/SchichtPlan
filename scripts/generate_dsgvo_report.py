#!/usr/bin/env python3
"""
Shiftfy — DSGVO Compliance Audit Report Generator
==================================================
Generates professional bilingual (EN + DE) PDF reports from the
DSGVO compliance audit data.

Usage:
    python3 scripts/generate_dsgvo_report.py

Output:
    reports/Shiftfy_DSGVO_Compliance_EN_<date>.pdf
    reports/Shiftfy_DSGVO_Compliance_DE_<date>.pdf
"""

import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, String

# ── Paths ─────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(SCRIPT_DIR, "fonts")
REPORTS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# ── Fonts ─────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont("DejaVu", os.path.join(FONTS_DIR, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", os.path.join(FONTS_DIR, "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("DejaVu-Italic", os.path.join(FONTS_DIR, "DejaVuSans-Oblique.ttf")))
pdfmetrics.registerFont(
    TTFont("DejaVu-BoldItalic", os.path.join(FONTS_DIR, "DejaVuSans-BoldOblique.ttf"))
)
pdfmetrics.registerFontFamily(
    "DejaVu",
    normal="DejaVu",
    bold="DejaVu-Bold",
    italic="DejaVu-Italic",
    boldItalic="DejaVu-BoldItalic",
)

# ── Brand Colors ──────────────────────────────────────────────
BRAND = HexColor("#059669")         # Emerald-600
BRAND_DARK = HexColor("#065f46")    # Emerald-800
BRAND_LIGHT = HexColor("#ecfdf5")   # Emerald-50
ACCENT = HexColor("#10b981")        # Emerald-500
TEXT_PRIMARY = HexColor("#111827")   # Gray-900
TEXT_MUTED = HexColor("#6b7280")    # Gray-500
BORDER = HexColor("#e5e7eb")        # Gray-200
BG_LIGHT = HexColor("#f9fafb")      # Gray-50
SUCCESS = HexColor("#059669")       # Emerald-600
WARNING = HexColor("#d97706")       # Amber-600
DANGER = HexColor("#dc2626")        # Red-600
SHIELD_BG = HexColor("#064e3b")     # Emerald-900

TODAY = datetime.now().strftime("%d-%m-%Y")
TODAY_DISPLAY = datetime.now().strftime("%d %B %Y")
TODAY_DE = datetime.now().strftime("%d. %B %Y")


# ═══════════════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════════════

def build_styles():
    return {
        "title": ParagraphStyle(
            "Title", fontName="DejaVu-Bold", fontSize=26, leading=32,
            textColor=white, alignment=TA_CENTER, spaceAfter=4 * mm,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle", fontName="DejaVu", fontSize=12, leading=16,
            textColor=HexColor("#a7f3d0"), alignment=TA_CENTER,
            spaceAfter=6 * mm,
        ),
        "h1": ParagraphStyle(
            "H1", fontName="DejaVu-Bold", fontSize=17, leading=22,
            textColor=BRAND_DARK, spaceBefore=10 * mm, spaceAfter=4 * mm,
        ),
        "h2": ParagraphStyle(
            "H2", fontName="DejaVu-Bold", fontSize=13, leading=17,
            textColor=TEXT_PRIMARY, spaceBefore=7 * mm, spaceAfter=3 * mm,
        ),
        "h3": ParagraphStyle(
            "H3", fontName="DejaVu-Bold", fontSize=11, leading=15,
            textColor=BRAND, spaceBefore=4 * mm, spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body", fontName="DejaVu", fontSize=9.5, leading=14,
            textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY,
            spaceAfter=2.5 * mm,
        ),
        "body_bold": ParagraphStyle(
            "BodyBold", fontName="DejaVu-Bold", fontSize=9.5, leading=14,
            textColor=TEXT_PRIMARY, spaceAfter=2.5 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet", fontName="DejaVu", fontSize=9, leading=13,
            textColor=TEXT_PRIMARY, leftIndent=12 * mm, bulletIndent=5 * mm,
            spaceAfter=1.5 * mm,
        ),
        "small": ParagraphStyle(
            "Small", fontName="DejaVu", fontSize=8, leading=11,
            textColor=TEXT_MUTED,
        ),
        "th": ParagraphStyle(
            "TH", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
            textColor=white,
        ),
        "tc": ParagraphStyle(
            "TC", fontName="DejaVu", fontSize=8.5, leading=12,
            textColor=TEXT_PRIMARY,
        ),
        "tc_bold": ParagraphStyle(
            "TCB", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
            textColor=TEXT_PRIMARY,
        ),
        "tc_success": ParagraphStyle(
            "TCS", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
            textColor=SUCCESS,
        ),
        "tc_warning": ParagraphStyle(
            "TCW", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
            textColor=WARNING,
        ),
        "tc_danger": ParagraphStyle(
            "TCD", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
            textColor=DANGER,
        ),
        "footer": ParagraphStyle(
            "Footer", fontName="DejaVu", fontSize=7.5, leading=10,
            textColor=TEXT_MUTED, alignment=TA_CENTER,
        ),
    }


# ═══════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def make_table(styles, headers, rows, col_widths=None):
    """Build a styled table with branded header row."""
    header_cells = [Paragraph(h, styles["th"]) for h in headers]
    data = [header_cells]
    for row in rows:
        data.append([
            Paragraph(str(c), styles["tc"]) if not isinstance(c, Paragraph) else c
            for c in row
        ])

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), BG_LIGHT))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


def status_cell(styles, val):
    """Return a green ✅ or yellow ⚠️ Paragraph."""
    if "✅" in val or "Implemented" in val or "Implementiert" in val:
        return Paragraph(f"✅ {val.replace('✅', '').strip()}", styles["tc_success"])
    if "⚠" in val or "Short" in val or "Kurz" in val:
        return Paragraph(f"⚠️ {val.replace('⚠️', '').strip()}", styles["tc_warning"])
    return Paragraph(val, styles["tc"])


def cover_block(t):
    """Branded cover header drawing."""
    w, h = 170 * mm, 65 * mm
    d = Drawing(w, h)
    d.add(Rect(0, 0, w, h, fillColor=SHIELD_BG, strokeColor=None, rx=6, ry=6))
    d.add(String(w / 2, 45 * mm, "SHIFTFY", fontSize=36, fillColor=white,
                 fontName="DejaVu-Bold", textAnchor="middle"))
    d.add(String(w / 2, 33 * mm, t["cover_subtitle"], fontSize=13,
                 fillColor=HexColor("#6ee7b7"), fontName="DejaVu", textAnchor="middle"))
    d.add(String(w / 2, 20 * mm, t["cover_line2"], fontSize=10,
                 fillColor=HexColor("#a7f3d0"), fontName="DejaVu", textAnchor="middle"))
    d.add(String(w / 2, 10 * mm, t["cover_date"], fontSize=9,
                 fillColor=HexColor("#86efac"), fontName="DejaVu-Italic", textAnchor="middle"))
    return d


# ═══════════════════════════════════════════════════════════════
# CONTENT — GERMAN
# ═══════════════════════════════════════════════════════════════

CONTENT_DE = {
    "cover_subtitle": "DSGVO-Compliance-Bericht",
    "cover_line2": "Datenschutz-Audit · Technische Umsetzung · Löschkonzept",
    "cover_date": f"Stand: {TODAY_DE}",
    "footer": "Shiftfy · DSGVO-Compliance-Bericht · Vertraulich · Seite",

    "meta": [
        ("Verfasser", "Omar Rageh — Lead Software Architect & Datenschutz-Ansprechpartner"),
        ("Commit-Basis", "main Branch"),
        ("Plattform", "Shiftfy (SchichtPlan) — SaaS für Schichtplanung"),
        ("Prüfumfang", "GPS-Purge, Datenminimierung, Löschkonzept, Sicherheit"),
    ],

    # ── Section 0: Summary ──
    "summary_title": "Zusammenfassung",
    "summary_headers": ["Bereich", "Status"],
    "summary_rows": [
        ("1. GPS- & Standortdaten-Purge", "✅ Implementiert"),
        ("2. Abwesenheiten — Datenminimierung", "✅ Implementiert"),
        ("3. Löschkonzept & Aufbewahrungsfristen", "✅ Implementiert"),
        ("4. Sicherheit & Infrastruktur", "✅ Implementiert"),
        ("5. Verbleibende Empfehlungen", "⚠️ Kurzfristig"),
    ],

    # ── Section 1: GPS Purge ──
    "s1_title": "1. GPS- & Standortdaten-Purge",
    "s1_status": "Status: ✅ Vollständig implementiert",
    "s1_intro": (
        "Alle GPS- und Standortdaten wurden vollständig aus dem System entfernt. "
        "Die Plattform erhebt, verarbeitet und speichert keine Geolokationsdaten mehr. "
        "Dies betrifft sowohl die Datenbank-Ebene (Schema-Migrationen) als auch den "
        "gesamten Backend- und Frontend-Code."
    ),
    "s1_migration_title": "1.1 Schema-Migration",
    "s1_migration_name": "Migration: dsgvo_remove_gps_and_location_tracking_fields",
    "s1_migration_headers": ["Tabelle", "Entfernte Spalten"],
    "s1_migration_rows": [
        ("Location", "latitude, longitude, geofenceRadius"),
        ("ServiceVisit", "checkInLat, checkInLng, checkOutLat, checkOutLng, checkInWithinFence"),
        ("VisitSignature", "signedLat, signedLng"),
        ("ServiceVisitAuditLog", "gpsLat, gpsLng, gpsAccuracy, ipAddress"),
    ],
    "s1_migration_note": "Bestehende Daten wurden vor dem DROP auf NULL gesetzt. Migration ist irreversibel.",

    "s1_deleted_title": "1.2 Gelöschte Dateien (5)",
    "s1_deleted_headers": ["Datei", "Zweck"],
    "s1_deleted_rows": [
        ("src/lib/geofence.ts", "Haversine-Berechnung, Geofence-Check"),
        ("src/lib/hooks/use-service-gps.ts", "Client-seitiger GPS-watchPosition-Hook"),
        ("src/lib/static-map.ts", "Statische Kartenbilder (Mapbox/OSM)"),
        ("src/__tests__/lib/geofence.test.ts", "7 Geofence-Testfälle"),
        ("src/app/api/admin/gps-cleanup/route.ts", "GPS-Daten-Bereinigung (Cron-Job)"),
    ],

    "s1_backend_title": "1.3 Bereinigte Backend-Routen",
    "s1_backend_items": [
        "check-in / check-out / signature — GPS-Parameter aus Audit-Einträgen entfernt",
        "visit-audit.ts — gpsLat/gpsLng/gpsAccuracy/ipAddress aus Fingerprint und Checksum entfernt",
        "PDF-Route — GPS-Evidenzblock, Geofence-Badges, statische Karte, formatDMS() entfernt",
        "Service-Reports — Geofence-Spalte aus Besuchstabelle entfernt",
        "Locations PATCH — Geo-Feld-Updates entfernt",
        "validations.ts — updateLocationGeoSchema bereinigt",
    ],

    "s1_frontend_title": "1.4 Frontend-Bereinigung",
    "s1_frontend_items": [
        "leistungsnachweis/page.tsx — GPS-Typen und Geofence-Badge-JSX entfernt",
        "service-execution-view.tsx — GPS-Felder aus Location/Signature-Typen entfernt",
    ],

    "s1_infra_title": "1.5 Infrastruktur",
    "s1_infra_items": [
        "vercel.json — GPS-Cleanup-Cron entfernt",
        "middleware.ts — Permissions-Policy: geolocation=() (vorher geolocation=(self))",
    ],

    "s1_kept_title": "1.6 Bewusst beibehalten",
    "s1_kept_body": (
        "ESignature.ipAddress — Nicht GPS-Tracking, sondern rechtlich erforderliche "
        "E-Signatur-Dokumentation nach eIDAS-Verordnung und §126a BGB. "
        "Separate Rechtsgrundlage: Art. 6(1)(c) DSGVO."
    ),

    "s1_rec_title": "Empfehlungen",
    "s1_rec_items": [
        "MAPBOX_ACCESS_TOKEN aus env.ts RECOMMENDED-Liste entfernen (Dienst nicht mehr genutzt)",
        "Vercel Blob-Speicher auf verwaiste Kartenbilder prüfen",
    ],

    # ── Section 2: Absence Minimization ──
    "s2_title": "2. Abwesenheiten — Datenminimierung (Art. 9 DSGVO)",
    "s2_status": "Status: ✅ Vollständig implementiert",
    "s2_intro": (
        "Gemäß Art. 9 DSGVO (besondere Kategorien personenbezogener Daten) wurden "
        "alle Felder entfernt, die potenziell Gesundheitsdaten enthalten könnten. "
        "Zusätzlich wurde eine Kategorie-Maskierung implementiert, die verhindert, "
        "dass Nicht-Management-Nutzer die spezifische Abwesenheitskategorie anderer "
        "Mitarbeiter sehen können."
    ),

    "s2_migration_title": "2.1 Schema-Migration",
    "s2_migration_name": "Migration: dsgvo_remove_absence_reason_and_document",
    "s2_migration_headers": ["Tabelle", "Entfernte Spalte", "Begründung"],
    "s2_migration_rows": [
        ("AbsenceRequest", "reason (Text)", "Freitextfeld kann Gesundheitsdaten enthalten"),
        ("AbsenceRequest", "documentUrl (String)", "Ärztliche Atteste = besondere Datenkategorien"),
    ],

    "s2_api_title": "2.2 API-Änderungen",
    "s2_api_items": [
        "POST /api/absences — Akzeptiert kein reason oder documentUrl mehr",
        "PATCH /api/absences/[id] — documentUrl-Update-Logik vollständig entfernt",
        "GET /api/absences — Kategorie-Maskierung: Nicht-Management sieht nur \"ABWESEND\"",
        "GET /api/annual-planning — reason aus Select entfernt",
        "DELETE /api/absences/upload — Gesamte Upload-Route gelöscht",
    ],

    "s2_frontend_title": "2.3 Frontend-Bereinigung",
    "s2_frontend_items": [
        "Typ AbsenceRequest — reason und documentUrl Felder entfernt",
        "Formular — Bemerkung-Textarea und Dokumenten-Upload komplett entfernt",
        "Abwesenheitsliste — Anzeige von reason und Dokumenten-Link entfernt",
        "PaperclipIcon-Import entfernt",
        "i18n-Schlüssel bereinigt (de.json, en.json): 10 überflüssige Übersetzungen entfernt",
    ],

    "s2_rec_title": "Empfehlungen",
    "s2_rec_items": [
        "Vercel Blob-Speicher: Vorhandene Dateien unter absences/* via Blob-API löschen",
        "reviewNote auf Manager-Ansicht beschränken (bereits korrekt implementiert)",
    ],

    # ── Section 3: Retention ──
    "s3_title": "3. Löschkonzept (Art. 5(1)(e) — Speicherbegrenzung)",
    "s3_status": "Status: ✅ Vollständig implementiert",
    "s3_intro": (
        "Ein automatisiertes Löschkonzept stellt sicher, dass personenbezogene Daten "
        "nur so lange gespeichert werden, wie es der Verarbeitungszweck erfordert. "
        "Die Umsetzung erfolgt über einen neuen Cron-Job sowie einen manuellen "
        "Workspace-Löschendpunkt (\"Nuclear Option\")."
    ),

    "s3_auto_title": "3.1 Automatische Datenbereinigung",
    "s3_auto_endpoint": "Neuer Endpunkt: POST/GET /api/admin/data-retention",
    "s3_auto_cron": "Cron: Sonntags 04:30 UTC (vercel.json) · Manuell: Nur OWNER/ADMIN",
    "s3_auto_headers": ["Datentyp", "Aufbewahrung", "Rechtsgrundlage"],
    "s3_auto_rows": [
        ("VerificationToken", "7 Tage", "Keine gesetzl. Pflicht"),
        ("PasswordResetToken", "7 Tage", "Keine gesetzl. Pflicht"),
        ("Session", "30 Tage", "Art. 6(1)(b) — abgelaufene Sessions"),
        ("Invitation (abgelaufen)", "30 Tage", "Keine gesetzl. Pflicht"),
        ("Notification", "90 Tage", "Keine gesetzl. Pflicht"),
        ("ExportJob", "90 Tage", "Keine gesetzl. Pflicht"),
        ("AutoFillLog", "90 Tage", "Keine gesetzl. Pflicht"),
        ("ManagerAlert (bestätigt)", "90 Tage", "Keine gesetzl. Pflicht"),
        ("AutoScheduleRun", "180 Tage", "Keine gesetzl. Pflicht"),
        ("PushSubscription", "180 Tage", "Keine gesetzl. Pflicht"),
        ("AuditLog", "365 Tage", "Art. 6(1)(f) — berecht. Interesse"),
        ("ChatMessage", "365 Tage", "Keine gesetzl. Pflicht"),
        ("ESignature", "10 Jahre", "§147 AO, eIDAS-Verordnung"),
        ("ServiceVisitAuditLog", "10 Jahre", "§147 AO — Handels-/Steuerrecht"),
        ("TimeEntryAudit", "10 Jahre", "§147 AO — Lohnbuchhaltung"),
    ],

    "s3_nuke_title": "3.2 Nuclear Option (Art. 17 & Art. 28)",
    "s3_nuke_endpoint": "Neuer Endpunkt: DELETE /api/admin/workspace-wipe",
    "s3_nuke_items": [
        "Nur durch Workspace-OWNER auslösbar",
        "Explizite Bestätigung: { \"confirm\": \"DELETE-<workspaceId>\" }",
        "Löscht gesamten Workspace via Prisma onDelete: Cascade",
        "Alle Kinder-Tabellen werden kaskadierend gelöscht",
        "Irreversibel — kein Undo",
        "Stripe-Abo muss separat über Kundenportal gekündigt werden",
    ],

    "s3_excluded_title": "3.3 Nicht automatisch gelöschte Daten",
    "s3_excluded_headers": ["Datentyp", "Begründung"],
    "s3_excluded_rows": [
        ("Employee, Shift, TimeEntry", "Aktive Geschäftsdaten — Löschung via Deaktivierung"),
        ("AbsenceRequest", "Urlaubsplanung — aktive Geschäftslogik"),
        ("MonthClose", "Lohnbuchhaltung — §147 AO (10 Jahre)"),
        ("Subscription", "Stripe-Vertragsdaten — Vertragslaufzeit"),
    ],

    "s3_rec_title": "Empfehlungen",
    "s3_rec_items": [
        "Anonymisierungsoption für Ex-Mitarbeiter (Art. 17(3)(b))",
        "DSGVO-Export-Funktion (Art. 15/20) für Mitarbeiterdaten",
    ],

    # ── Section 4: Security ──
    "s4_title": "4. Sicherheit & Infrastruktur",
    "s4_status": "Status: ✅ Vollständig implementiert",
    "s4_intro": (
        "Die technischen und organisatorischen Maßnahmen (TOMs) gemäß Art. 32 DSGVO "
        "sind vollständig implementiert. Die Plattform erfüllt die Anforderungen "
        "an Transport-Verschlüsselung, Zugriffskontrolle, Rate-Limiting und Monitoring."
    ),

    "s4_transport_title": "4.1 Transport & Verschlüsselung",
    "s4_transport_headers": ["Maßnahme", "Status", "Details"],
    "s4_transport_rows": [
        ("HTTPS/TLS", "✅", "Vercel erzwingt TLS — kein HTTP möglich"),
        ("HSTS", "✅", "max-age=63072000; includeSubDomains; preload"),
        ("CSP", "✅", "Per-Request Nonce, script-src strict-dynamic"),
        ("X-Frame-Options", "✅", "DENY — kein Embedding möglich"),
        ("X-Content-Type-Options", "✅", "nosniff"),
        ("Referrer-Policy", "✅", "strict-origin-when-cross-origin"),
        ("Permissions-Policy", "✅", "camera=(), microphone=(), geolocation=()"),
    ],

    "s4_auth_title": "4.2 Authentifizierung & Autorisierung",
    "s4_auth_headers": ["Maßnahme", "Status", "Details"],
    "s4_auth_rows": [
        ("Session-Management", "✅", "NextAuth 4 mit JWT-Sessions"),
        ("RBAC", "✅", "4-Rollen: OWNER > ADMIN > MANAGER > EMPLOYEE"),
        ("Permissions-Matrix", "✅", "25+ Ressourcen × 5 Aktionen"),
        ("Workspace-Isolation", "✅", "Jede DB-Abfrage filtert nach workspaceId"),
    ],

    "s4_rate_title": "4.3 Rate Limiting",
    "s4_rate_headers": ["Endpunkt", "Limit", "Implementierung"],
    "s4_rate_rows": [
        ("Auth-Routen", "10 Req/60s", "Upstash Redis Sliding Window"),
        ("API-Routen", "60 Req/60s", "Upstash Redis Sliding Window"),
        ("IP-basiert", "✅", "x-forwarded-for Header"),
    ],

    "s4_monitoring_title": "4.4 Monitoring & Fehlerbehandlung",
    "s4_monitoring_headers": ["Dienst", "DSGVO-Konformität", "Details"],
    "s4_monitoring_rows": [
        ("Sentry (Error)", "✅ Art. 6(1)(f)", "Berechtigtes Interesse"),
        ("Sentry (Replay)", "✅ Art. 6(1)(a)", "Nur nach Cookie-Consent"),
        ("Logging", "✅", "Strukturiert, keine PII in Logs"),
    ],

    "s4_third_title": "4.5 Drittanbieter-Dienste",
    "s4_third_headers": ["Dienst", "Zweck", "DPA vorhanden?"],
    "s4_third_rows": [
        ("Vercel", "Hosting, Serverless", "✅ Standard-DPA"),
        ("Supabase", "PostgreSQL-Datenbank", "✅ DPA (EU: eu-west-1)"),
        ("Stripe", "Abrechnung", "✅ Standard-DPA"),
        ("Upstash", "Redis Rate-Limiting", "✅ DPA (EU Region)"),
        ("Sentry", "Error-Monitoring", "✅ Standard-DPA"),
        ("Vercel Blob", "Datei-Speicher", "✅ Teil des Vercel-DPA"),
    ],

    "s4_cron_title": "4.6 Cron-Jobs",
    "s4_cron_headers": ["Job", "Zeitplan", "Auth"],
    "s4_cron_rows": [
        ("Time-Entry-Generierung", "Täglich 02:00", "CRON_SECRET"),
        ("Überstunden-Check", "Montags 03:00", "CRON_SECRET"),
        ("Gehaltsabschluss", "1. des Monats 04:00", "CRON_SECRET"),
        ("Pausen-Erinnerung", "Alle 15 Min", "CRON_SECRET"),
        ("Datenbereinigung (NEU)", "Sonntags 04:30", "CRON_SECRET"),
    ],

    "s4_rec_title": "Empfehlungen",
    "s4_rec_items": [
        "Cookie-Banner-Implementierung überprüfen (cookie-banner.tsx vorhanden)",
        "Datenschutzerklärung auf Aktualität prüfen (Route: /datenschutz)",
    ],

    # ── Section 5: Changelog ──
    "s5_title": "5. Änderungsprotokoll dieser Audit-Runde",

    "s5_deleted_title": "Gelöschte Dateien (6)",
    "s5_deleted": [
        "src/lib/geofence.ts",
        "src/lib/hooks/use-service-gps.ts",
        "src/lib/static-map.ts",
        "src/__tests__/lib/geofence.test.ts",
        "src/app/api/admin/gps-cleanup/route.ts",
        "src/app/api/absences/upload/route.ts",
    ],

    "s5_new_title": "Neue Dateien (2)",
    "s5_new": [
        "src/app/api/admin/data-retention/route.ts — Automatische Datenbereinigung",
        "src/app/api/admin/workspace-wipe/route.ts — Nuclear Option (Art. 17/28)",
    ],

    "s5_changed_title": "Geänderte Dateien (20)",
    "s5_changed": [
        "prisma/schema.prisma — 2 Migrationen",
        "src/lib/visit-audit.ts — GPS aus Checksum entfernt",
        "src/app/api/service-visits/[id]/check-in/route.ts",
        "src/app/api/service-visits/[id]/check-out/route.ts",
        "src/app/api/service-visits/[id]/signature/route.ts",
        "src/app/api/service-visits/[id]/route.ts",
        "src/app/api/service-visits/[id]/pdf/route.ts",
        "src/app/api/service-reports/[id]/generate/route.ts",
        "src/app/api/locations/[id]/route.ts",
        "src/lib/validations.ts",
        "src/app/api/absences/route.ts — Kategorie-Maskierung",
        "src/app/api/absences/[id]/route.ts",
        "src/app/api/annual-planning/route.ts",
        "src/app/(dashboard)/abwesenheiten/page.tsx",
        "src/app/(dashboard)/leistungsnachweis/page.tsx",
        "src/components/service-execution/service-execution-view.tsx",
        "src/middleware.ts — geolocation=()",
        "vercel.json — Retention-Cron hinzugefügt",
        "messages/de.json — i18n-Schlüssel entfernt",
        "messages/en.json — i18n-Schlüssel entfernt",
    ],

    "s5_migrations_title": "Supabase-Migrationen (2)",
    "s5_migrations": [
        "dsgvo_remove_gps_and_location_tracking_fields",
        "dsgvo_remove_absence_reason_and_document",
    ],

    "s5_tests": "226/226 Tests bestanden · 0 Kompilierungsfehler",

    # ── Section 6: Recommendations ──
    "s6_title": "6. Offene Empfehlungen",
    "s6_headers": ["#", "Maßnahme", "Priorität", "Aufwand"],
    "s6_rows": [
        ("1", "MAPBOX_ACCESS_TOKEN aus env.ts entfernen", "Niedrig", "5 Min"),
        ("2", "Vercel Blob: absences/* Dateien löschen", "Mittel", "30 Min"),
        ("3", "Art. 15/20 Datenexport-Funktion", "Mittel", "4–8 Std"),
        ("4", "Ex-Mitarbeiter-Anonymisierung", "Mittel", "4–8 Std"),
        ("5", "Datenschutzerklärung aktualisieren", "Mittel", "1 Std"),
        ("6", "Verarbeitungsverzeichnis (Art. 30)", "Hoch", "2–4 Std"),
    ],

    "closing": (
        "Dieser Bericht wurde automatisiert erstellt und sollte durch den "
        "Datenschutz-Ansprechpartner geprüft werden."
    ),
}


# ═══════════════════════════════════════════════════════════════
# CONTENT — ENGLISH
# ═══════════════════════════════════════════════════════════════

CONTENT_EN = {
    "cover_subtitle": "GDPR Compliance Report",
    "cover_line2": "Privacy Audit · Technical Implementation · Data Retention",
    "cover_date": f"Date: {TODAY_DISPLAY}",
    "footer": "Shiftfy · GDPR Compliance Report · Confidential · Page",

    "meta": [
        ("Author", "Omar Rageh — Lead Software Architect & Data Protection Contact"),
        ("Commit Basis", "main branch"),
        ("Platform", "Shiftfy (SchichtPlan) — SaaS Shift Planning"),
        ("Audit Scope", "GPS Purge, Data Minimization, Retention Policy, Security"),
    ],

    # ── Section 0: Summary ──
    "summary_title": "Executive Summary",
    "summary_headers": ["Area", "Status"],
    "summary_rows": [
        ("1. GPS & Location Data Purge", "✅ Implemented"),
        ("2. Absences — Data Minimization", "✅ Implemented"),
        ("3. Retention Policy & Deletion Concept", "✅ Implemented"),
        ("4. Security & Infrastructure", "✅ Implemented"),
        ("5. Remaining Recommendations", "⚠️ Short-term"),
    ],

    # ── Section 1: GPS Purge ──
    "s1_title": "1. GPS & Location Data Purge",
    "s1_status": "Status: ✅ Fully implemented",
    "s1_intro": (
        "All GPS and location data has been completely removed from the system. "
        "The platform no longer collects, processes, or stores any geolocation data. "
        "This applies to the database layer (schema migrations), all backend code, "
        "and the entire frontend."
    ),
    "s1_migration_title": "1.1 Schema Migration",
    "s1_migration_name": "Migration: dsgvo_remove_gps_and_location_tracking_fields",
    "s1_migration_headers": ["Table", "Removed Columns"],
    "s1_migration_rows": [
        ("Location", "latitude, longitude, geofenceRadius"),
        ("ServiceVisit", "checkInLat, checkInLng, checkOutLat, checkOutLng, checkInWithinFence"),
        ("VisitSignature", "signedLat, signedLng"),
        ("ServiceVisitAuditLog", "gpsLat, gpsLng, gpsAccuracy, ipAddress"),
    ],
    "s1_migration_note": "Existing data was set to NULL before DROP. Migration is irreversible.",

    "s1_deleted_title": "1.2 Deleted Files (5)",
    "s1_deleted_headers": ["File", "Purpose"],
    "s1_deleted_rows": [
        ("src/lib/geofence.ts", "Haversine calculation, geofence check"),
        ("src/lib/hooks/use-service-gps.ts", "Client-side GPS watchPosition hook"),
        ("src/lib/static-map.ts", "Static map images (Mapbox/OSM)"),
        ("src/__tests__/lib/geofence.test.ts", "7 geofence test cases"),
        ("src/app/api/admin/gps-cleanup/route.ts", "GPS data cleanup (cron job)"),
    ],

    "s1_backend_title": "1.3 Cleaned Backend Routes",
    "s1_backend_items": [
        "check-in / check-out / signature — GPS parameters removed from audit entries",
        "visit-audit.ts — gpsLat/gpsLng/gpsAccuracy/ipAddress removed from fingerprint and checksum",
        "PDF route — GPS evidence block, geofence badges, static map, formatDMS() removed",
        "Service Reports — geofence column removed from visit table",
        "Locations PATCH — geo field updates removed",
        "validations.ts — updateLocationGeoSchema cleaned",
    ],

    "s1_frontend_title": "1.4 Frontend Cleanup",
    "s1_frontend_items": [
        "leistungsnachweis/page.tsx — GPS types and geofence badge JSX removed",
        "service-execution-view.tsx — GPS fields removed from Location/Signature types",
    ],

    "s1_infra_title": "1.5 Infrastructure",
    "s1_infra_items": [
        "vercel.json — GPS cleanup cron removed",
        "middleware.ts — Permissions-Policy: geolocation=() (was geolocation=(self))",
    ],

    "s1_kept_title": "1.6 Deliberately Retained",
    "s1_kept_body": (
        "ESignature.ipAddress — Not GPS tracking, but legally required e-signature "
        "documentation per eIDAS Regulation and §126a BGB (German Civil Code). "
        "Separate legal basis: GDPR Art. 6(1)(c)."
    ),

    "s1_rec_title": "Recommendations",
    "s1_rec_items": [
        "Remove MAPBOX_ACCESS_TOKEN from env.ts RECOMMENDED list (service no longer used)",
        "Check Vercel Blob storage for orphaned map images",
    ],

    # ── Section 2: Absence Minimization ──
    "s2_title": "2. Absences — Data Minimization (GDPR Art. 9)",
    "s2_status": "Status: ✅ Fully implemented",
    "s2_intro": (
        "In accordance with GDPR Art. 9 (special categories of personal data), "
        "all fields that could potentially contain health data have been removed. "
        "Additionally, category masking has been implemented to prevent non-management "
        "users from seeing the specific absence category of other employees."
    ),

    "s2_migration_title": "2.1 Schema Migration",
    "s2_migration_name": "Migration: dsgvo_remove_absence_reason_and_document",
    "s2_migration_headers": ["Table", "Removed Column", "Justification"],
    "s2_migration_rows": [
        ("AbsenceRequest", "reason (Text)", "Free-text field may contain health data"),
        ("AbsenceRequest", "documentUrl (String)", "Medical certificates = special data categories"),
    ],

    "s2_api_title": "2.2 API Changes",
    "s2_api_items": [
        "POST /api/absences — No longer accepts reason or documentUrl",
        "PATCH /api/absences/[id] — documentUrl update logic fully removed",
        "GET /api/absences — Category masking: non-management sees only \"ABSENT\"",
        "GET /api/annual-planning — reason removed from select",
        "DELETE /api/absences/upload — Entire upload route deleted",
    ],

    "s2_frontend_title": "2.3 Frontend Cleanup",
    "s2_frontend_items": [
        "AbsenceRequest type — reason and documentUrl fields removed",
        "Form — comment textarea and document upload completely removed",
        "Absence list — display of reason and document link removed",
        "PaperclipIcon import removed",
        "i18n keys cleaned (de.json, en.json): 10 obsolete translations removed",
    ],

    "s2_rec_title": "Recommendations",
    "s2_rec_items": [
        "Vercel Blob storage: delete existing files under absences/* via Blob API",
        "Restrict reviewNote to manager view (already correctly implemented)",
    ],

    # ── Section 3: Retention ──
    "s3_title": "3. Retention Policy (Art. 5(1)(e) — Storage Limitation)",
    "s3_status": "Status: ✅ Fully implemented",
    "s3_intro": (
        "An automated retention policy ensures that personal data is only stored "
        "for as long as the processing purpose requires. Implementation includes "
        "a new cron job and a manual workspace deletion endpoint (\"Nuclear Option\")."
    ),

    "s3_auto_title": "3.1 Automated Data Retention",
    "s3_auto_endpoint": "New Endpoint: POST/GET /api/admin/data-retention",
    "s3_auto_cron": "Cron: Sundays 04:30 UTC (vercel.json) · Manual: OWNER/ADMIN only",
    "s3_auto_headers": ["Data Type", "Retention", "Legal Basis"],
    "s3_auto_rows": [
        ("VerificationToken", "7 days", "No legal requirement"),
        ("PasswordResetToken", "7 days", "No legal requirement"),
        ("Session", "30 days", "Art. 6(1)(b) — expired sessions"),
        ("Invitation (expired)", "30 days", "No legal requirement"),
        ("Notification", "90 days", "No legal requirement"),
        ("ExportJob", "90 days", "No legal requirement"),
        ("AutoFillLog", "90 days", "No legal requirement"),
        ("ManagerAlert (acknowledged)", "90 days", "No legal requirement"),
        ("AutoScheduleRun", "180 days", "No legal requirement"),
        ("PushSubscription", "180 days", "No legal requirement"),
        ("AuditLog", "365 days", "Art. 6(1)(f) — legitimate interest"),
        ("ChatMessage", "365 days", "No legal requirement"),
        ("ESignature", "10 years", "§147 AO, eIDAS Regulation"),
        ("ServiceVisitAuditLog", "10 years", "§147 AO — commercial/tax law"),
        ("TimeEntryAudit", "10 years", "§147 AO — payroll records"),
    ],

    "s3_nuke_title": "3.2 Nuclear Option (Art. 17 & Art. 28)",
    "s3_nuke_endpoint": "New Endpoint: DELETE /api/admin/workspace-wipe",
    "s3_nuke_items": [
        "Only triggerable by Workspace OWNER",
        "Explicit confirmation required: { \"confirm\": \"DELETE-<workspaceId>\" }",
        "Deletes entire workspace via Prisma onDelete: Cascade",
        "All child tables are cascade-deleted",
        "Irreversible — no undo",
        "Stripe subscription must be cancelled separately via customer portal",
    ],

    "s3_excluded_title": "3.3 Data Not Automatically Deleted",
    "s3_excluded_headers": ["Data Type", "Reason"],
    "s3_excluded_rows": [
        ("Employee, Shift, TimeEntry", "Active business data — deletion via deactivation"),
        ("AbsenceRequest", "Vacation planning — active business logic"),
        ("MonthClose", "Payroll accounting — §147 AO (10 years)"),
        ("Subscription", "Stripe contract data — contract duration"),
    ],

    "s3_rec_title": "Recommendations",
    "s3_rec_items": [
        "Anonymization option for former employees (Art. 17(3)(b))",
        "GDPR data export function (Art. 15/20) for employee data",
    ],

    # ── Section 4: Security ──
    "s4_title": "4. Security & Infrastructure",
    "s4_status": "Status: ✅ Fully implemented",
    "s4_intro": (
        "Technical and organizational measures (TOMs) per GDPR Art. 32 are fully "
        "implemented. The platform meets requirements for transport encryption, "
        "access control, rate limiting, and monitoring."
    ),

    "s4_transport_title": "4.1 Transport & Encryption",
    "s4_transport_headers": ["Measure", "Status", "Details"],
    "s4_transport_rows": [
        ("HTTPS/TLS", "✅", "Vercel enforces TLS — no HTTP possible"),
        ("HSTS", "✅", "max-age=63072000; includeSubDomains; preload"),
        ("CSP", "✅", "Per-request nonce, script-src strict-dynamic"),
        ("X-Frame-Options", "✅", "DENY — no embedding possible"),
        ("X-Content-Type-Options", "✅", "nosniff"),
        ("Referrer-Policy", "✅", "strict-origin-when-cross-origin"),
        ("Permissions-Policy", "✅", "camera=(), microphone=(), geolocation=()"),
    ],

    "s4_auth_title": "4.2 Authentication & Authorization",
    "s4_auth_headers": ["Measure", "Status", "Details"],
    "s4_auth_rows": [
        ("Session Management", "✅", "NextAuth 4 with JWT sessions"),
        ("RBAC", "✅", "4-role hierarchy: OWNER > ADMIN > MANAGER > EMPLOYEE"),
        ("Permissions Matrix", "✅", "25+ resources × 5 actions"),
        ("Workspace Isolation", "✅", "Every DB query filters by workspaceId"),
    ],

    "s4_rate_title": "4.3 Rate Limiting",
    "s4_rate_headers": ["Endpoint", "Limit", "Implementation"],
    "s4_rate_rows": [
        ("Auth routes", "10 req/60s", "Upstash Redis Sliding Window"),
        ("API routes", "60 req/60s", "Upstash Redis Sliding Window"),
        ("IP-based", "✅", "x-forwarded-for header"),
    ],

    "s4_monitoring_title": "4.4 Monitoring & Error Handling",
    "s4_monitoring_headers": ["Service", "GDPR Compliance", "Details"],
    "s4_monitoring_rows": [
        ("Sentry (Error)", "✅ Art. 6(1)(f)", "Legitimate interest"),
        ("Sentry (Replay)", "✅ Art. 6(1)(a)", "Only after cookie consent"),
        ("Logging", "✅", "Structured, no PII in logs"),
    ],

    "s4_third_title": "4.5 Third-Party Services",
    "s4_third_headers": ["Service", "Purpose", "DPA Available?"],
    "s4_third_rows": [
        ("Vercel", "Hosting, Serverless", "✅ Standard DPA"),
        ("Supabase", "PostgreSQL Database", "✅ DPA (EU: eu-west-1)"),
        ("Stripe", "Billing", "✅ Standard DPA"),
        ("Upstash", "Redis Rate Limiting", "✅ DPA (EU Region)"),
        ("Sentry", "Error Monitoring", "✅ Standard DPA"),
        ("Vercel Blob", "File Storage", "✅ Part of Vercel DPA"),
    ],

    "s4_cron_title": "4.6 Cron Jobs",
    "s4_cron_headers": ["Job", "Schedule", "Auth"],
    "s4_cron_rows": [
        ("Time Entry Generation", "Daily 02:00", "CRON_SECRET"),
        ("Overtime Check", "Mondays 03:00", "CRON_SECRET"),
        ("Payroll Close", "1st of month 04:00", "CRON_SECRET"),
        ("Break Reminder", "Every 15 min", "CRON_SECRET"),
        ("Data Retention (NEW)", "Sundays 04:30", "CRON_SECRET"),
    ],

    "s4_rec_title": "Recommendations",
    "s4_rec_items": [
        "Review cookie banner implementation (cookie-banner.tsx exists)",
        "Check privacy policy for currency (route: /datenschutz)",
    ],

    # ── Section 5: Changelog ──
    "s5_title": "5. Change Log — This Audit Round",

    "s5_deleted_title": "Deleted Files (6)",
    "s5_deleted": [
        "src/lib/geofence.ts",
        "src/lib/hooks/use-service-gps.ts",
        "src/lib/static-map.ts",
        "src/__tests__/lib/geofence.test.ts",
        "src/app/api/admin/gps-cleanup/route.ts",
        "src/app/api/absences/upload/route.ts",
    ],

    "s5_new_title": "New Files (2)",
    "s5_new": [
        "src/app/api/admin/data-retention/route.ts — Automated data retention",
        "src/app/api/admin/workspace-wipe/route.ts — Nuclear Option (Art. 17/28)",
    ],

    "s5_changed_title": "Modified Files (20)",
    "s5_changed": [
        "prisma/schema.prisma — 2 migrations",
        "src/lib/visit-audit.ts — GPS removed from checksum",
        "src/app/api/service-visits/[id]/check-in/route.ts",
        "src/app/api/service-visits/[id]/check-out/route.ts",
        "src/app/api/service-visits/[id]/signature/route.ts",
        "src/app/api/service-visits/[id]/route.ts",
        "src/app/api/service-visits/[id]/pdf/route.ts",
        "src/app/api/service-reports/[id]/generate/route.ts",
        "src/app/api/locations/[id]/route.ts",
        "src/lib/validations.ts",
        "src/app/api/absences/route.ts — Category masking",
        "src/app/api/absences/[id]/route.ts",
        "src/app/api/annual-planning/route.ts",
        "src/app/(dashboard)/abwesenheiten/page.tsx",
        "src/app/(dashboard)/leistungsnachweis/page.tsx",
        "src/components/service-execution/service-execution-view.tsx",
        "src/middleware.ts — geolocation=()",
        "vercel.json — Retention cron added",
        "messages/de.json — i18n keys removed",
        "messages/en.json — i18n keys removed",
    ],

    "s5_migrations_title": "Supabase Migrations (2)",
    "s5_migrations": [
        "dsgvo_remove_gps_and_location_tracking_fields",
        "dsgvo_remove_absence_reason_and_document",
    ],

    "s5_tests": "226/226 tests passing · 0 compile errors",

    # ── Section 6: Recommendations ──
    "s6_title": "6. Open Recommendations",
    "s6_headers": ["#", "Action", "Priority", "Effort"],
    "s6_rows": [
        ("1", "Remove MAPBOX_ACCESS_TOKEN from env.ts", "Low", "5 min"),
        ("2", "Vercel Blob: delete absences/* files", "Medium", "30 min"),
        ("3", "Art. 15/20 data export function", "Medium", "4–8 hrs"),
        ("4", "Former employee anonymization", "Medium", "4–8 hrs"),
        ("5", "Update privacy policy", "Medium", "1 hr"),
        ("6", "Records of processing (Art. 30)", "High", "2–4 hrs"),
    ],

    "closing": (
        "This report was generated automatically and should be reviewed by "
        "the designated Data Protection Contact."
    ),
}


# ═══════════════════════════════════════════════════════════════
# PDF BUILDER
# ═══════════════════════════════════════════════════════════════

def build_pdf(lang="de"):
    """Build the DSGVO compliance PDF for the given language."""
    c = CONTENT_DE if lang == "de" else CONTENT_EN
    styles = build_styles()

    filename = os.path.join(
        REPORTS_DIR,
        f"Shiftfy_DSGVO_Compliance_{lang.upper()}_{TODAY}.pdf",
    )

    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    def footer(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("DejaVu", 7.5)
        canvas.setFillColor(TEXT_MUTED)
        w, _ = A4
        canvas.drawCentredString(w / 2, 10 * mm, f'{c["footer"]} {doc_obj.page}')
        canvas.restoreState()

    story = []

    # ── COVER ──────────────────────────────────────────────────
    story.append(Spacer(1, 25 * mm))
    story.append(cover_block(c))
    story.append(Spacer(1, 12 * mm))

    # Meta table
    meta_data = [
        [Paragraph(f"<b>{k}</b>", styles["body"]), Paragraph(v, styles["body"])]
        for k, v in c["meta"]
    ]
    meta_tbl = Table(meta_data, colWidths=[85, 320])
    meta_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TEXTCOLOR", (0, 0), (0, -1), TEXT_MUTED),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
    ]))
    story.append(meta_tbl)
    story.append(PageBreak())

    # ── SUMMARY ────────────────────────────────────────────────
    story.append(Paragraph(c["summary_title"], styles["h1"]))
    summary_rows = []
    for area, stat in c["summary_rows"]:
        summary_rows.append([
            Paragraph(area, styles["tc_bold"]),
            status_cell(styles, stat),
        ])
    story.append(make_table(styles, c["summary_headers"], summary_rows, [280, 130]))
    story.append(Spacer(1, 6 * mm))

    # ── SECTION 1: GPS PURGE ──────────────────────────────────
    story.append(Paragraph(c["s1_title"], styles["h1"]))
    story.append(Paragraph(f'<b>{c["s1_status"]}</b>', styles["body_bold"]))
    story.append(Paragraph(c["s1_intro"], styles["body"]))

    story.append(Paragraph(c["s1_migration_title"], styles["h2"]))
    story.append(Paragraph(f'<i>{c["s1_migration_name"]}</i>', styles["small"]))
    story.append(Spacer(1, 2 * mm))
    story.append(make_table(
        styles, c["s1_migration_headers"], c["s1_migration_rows"],
        [120, 290],
    ))
    story.append(Paragraph(f'<i>{c["s1_migration_note"]}</i>', styles["small"]))
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph(c["s1_deleted_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s1_deleted_headers"], c["s1_deleted_rows"],
        [230, 180],
    ))

    story.append(Paragraph(c["s1_backend_title"], styles["h2"]))
    for item in c["s1_backend_items"]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph(c["s1_frontend_title"], styles["h2"]))
    for item in c["s1_frontend_items"]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph(c["s1_infra_title"], styles["h2"]))
    for item in c["s1_infra_items"]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph(c["s1_kept_title"], styles["h2"]))
    story.append(Paragraph(c["s1_kept_body"], styles["body"]))

    story.append(Paragraph(c["s1_rec_title"], styles["h3"]))
    for item in c["s1_rec_items"]:
        story.append(Paragraph(f"→ {item}", styles["bullet"]))

    story.append(PageBreak())

    # ── SECTION 2: ABSENCE MINIMIZATION ───────────────────────
    story.append(Paragraph(c["s2_title"], styles["h1"]))
    story.append(Paragraph(f'<b>{c["s2_status"]}</b>', styles["body_bold"]))
    story.append(Paragraph(c["s2_intro"], styles["body"]))

    story.append(Paragraph(c["s2_migration_title"], styles["h2"]))
    story.append(Paragraph(f'<i>{c["s2_migration_name"]}</i>', styles["small"]))
    story.append(Spacer(1, 2 * mm))
    story.append(make_table(
        styles, c["s2_migration_headers"], c["s2_migration_rows"],
        [100, 130, 180],
    ))

    story.append(Paragraph(c["s2_api_title"], styles["h2"]))
    for item in c["s2_api_items"]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph(c["s2_frontend_title"], styles["h2"]))
    for item in c["s2_frontend_items"]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph(c["s2_rec_title"], styles["h3"]))
    for item in c["s2_rec_items"]:
        story.append(Paragraph(f"→ {item}", styles["bullet"]))

    story.append(PageBreak())

    # ── SECTION 3: RETENTION ──────────────────────────────────
    story.append(Paragraph(c["s3_title"], styles["h1"]))
    story.append(Paragraph(f'<b>{c["s3_status"]}</b>', styles["body_bold"]))
    story.append(Paragraph(c["s3_intro"], styles["body"]))

    story.append(Paragraph(c["s3_auto_title"], styles["h2"]))
    story.append(Paragraph(f'<b>{c["s3_auto_endpoint"]}</b>', styles["body_bold"]))
    story.append(Paragraph(c["s3_auto_cron"], styles["small"]))
    story.append(Spacer(1, 2 * mm))
    # Highlight 10-year rows
    auto_rows = []
    for dtype, ret, basis in c["s3_auto_rows"]:
        if "10" in ret:
            auto_rows.append([
                Paragraph(f"<b>{dtype}</b>", styles["tc_bold"]),
                Paragraph(f"<b>{ret}</b>", styles["tc_bold"]),
                Paragraph(basis, styles["tc"]),
            ])
        else:
            auto_rows.append([dtype, ret, basis])
    story.append(make_table(
        styles, c["s3_auto_headers"], auto_rows,
        [130, 70, 210],
    ))

    story.append(Paragraph(c["s3_nuke_title"], styles["h2"]))
    story.append(Paragraph(f'<b>{c["s3_nuke_endpoint"]}</b>', styles["body_bold"]))
    for item in c["s3_nuke_items"]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph(c["s3_excluded_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s3_excluded_headers"], c["s3_excluded_rows"],
        [160, 250],
    ))

    story.append(Paragraph(c["s3_rec_title"], styles["h3"]))
    for item in c["s3_rec_items"]:
        story.append(Paragraph(f"→ {item}", styles["bullet"]))

    story.append(PageBreak())

    # ── SECTION 4: SECURITY ───────────────────────────────────
    story.append(Paragraph(c["s4_title"], styles["h1"]))
    story.append(Paragraph(f'<b>{c["s4_status"]}</b>', styles["body_bold"]))
    story.append(Paragraph(c["s4_intro"], styles["body"]))

    story.append(Paragraph(c["s4_transport_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s4_transport_headers"], c["s4_transport_rows"],
        [110, 40, 260],
    ))

    story.append(Paragraph(c["s4_auth_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s4_auth_headers"], c["s4_auth_rows"],
        [110, 40, 260],
    ))

    story.append(Paragraph(c["s4_rate_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s4_rate_headers"], c["s4_rate_rows"],
        [110, 80, 220],
    ))

    story.append(Paragraph(c["s4_monitoring_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s4_monitoring_headers"], c["s4_monitoring_rows"],
        [100, 100, 210],
    ))

    story.append(Paragraph(c["s4_third_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s4_third_headers"], c["s4_third_rows"],
        [80, 130, 200],
    ))

    story.append(Paragraph(c["s4_cron_title"], styles["h2"]))
    story.append(make_table(
        styles, c["s4_cron_headers"], c["s4_cron_rows"],
        [150, 130, 130],
    ))

    story.append(Paragraph(c["s4_rec_title"], styles["h3"]))
    for item in c["s4_rec_items"]:
        story.append(Paragraph(f"→ {item}", styles["bullet"]))

    story.append(PageBreak())

    # ── SECTION 5: CHANGELOG ──────────────────────────────────
    story.append(Paragraph(c["s5_title"], styles["h1"]))

    story.append(Paragraph(c["s5_deleted_title"], styles["h2"]))
    for i, f in enumerate(c["s5_deleted"], 1):
        story.append(Paragraph(f"{i}. {f}", styles["bullet"]))

    story.append(Paragraph(c["s5_new_title"], styles["h2"]))
    for i, f in enumerate(c["s5_new"], 1):
        story.append(Paragraph(f"{i}. {f}", styles["bullet"]))

    story.append(Paragraph(c["s5_changed_title"], styles["h2"]))
    for i, f in enumerate(c["s5_changed"], 1):
        story.append(Paragraph(f"{i}. {f}", styles["bullet"]))

    story.append(Paragraph(c["s5_migrations_title"], styles["h2"]))
    for i, m in enumerate(c["s5_migrations"], 1):
        story.append(Paragraph(f"{i}. {m}", styles["bullet"]))

    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f'<b>{c["s5_tests"]}</b>', styles["body_bold"]))

    story.append(PageBreak())

    # ── SECTION 6: RECOMMENDATIONS ────────────────────────────
    story.append(Paragraph(c["s6_title"], styles["h1"]))
    rec_rows = []
    for num, action, prio, effort in c["s6_rows"]:
        prio_style = styles["tc_warning"] if prio in ("Hoch", "High") else styles["tc"]
        rec_rows.append([
            Paragraph(num, styles["tc_bold"]),
            Paragraph(action, styles["tc"]),
            Paragraph(prio, prio_style),
            Paragraph(effort, styles["tc"]),
        ])
    story.append(make_table(
        styles, c["s6_headers"], rec_rows,
        [25, 240, 65, 80],
    ))

    story.append(Spacer(1, 10 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f'<i>{c["closing"]}</i>', styles["small"]))

    # Build
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return filename


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  Shiftfy — DSGVO Compliance Report Generator")
    print("=" * 60)
    print()

    de_path = build_pdf("de")
    print(f"  ✓  German report:  {de_path}")

    en_path = build_pdf("en")
    print(f"  ✓  English report: {en_path}")

    print()
    print("  Done! Both reports generated successfully.")
    print("=" * 60)
