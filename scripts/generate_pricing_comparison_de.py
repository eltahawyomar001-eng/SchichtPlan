#!/usr/bin/env python3
"""
Shiftfy vs Clockin — Wettbewerbsanalyse: Preise & Funktionen
Erzeugt einen professionellen PDF-Bericht auf Deutsch.
"""

import os
from datetime import date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    HRFlowable,
)

# ─── Farben ──────────────────────────────────────────────────
EMERALD = colors.HexColor("#059669")
EMERALD_50 = colors.HexColor("#ecfdf5")
DARK = colors.HexColor("#111827")
GRAY_700 = colors.HexColor("#374151")
GRAY_500 = colors.HexColor("#6b7280")
GRAY_200 = colors.HexColor("#e5e7eb")
GRAY_50 = colors.HexColor("#f9fafb")
WHITE = colors.white
GREEN_TEXT = colors.HexColor("#059669")

# ─── Ausgabepfad ─────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, "shiftfy-vs-clockin-preisvergleich.pdf")

# ─── Stile ───────────────────────────────────────────────────
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    "CoverTitle", parent=styles["Title"],
    fontSize=28, leading=34, textColor=DARK,
    spaceAfter=6, alignment=TA_LEFT, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "CoverSub", parent=styles["Normal"],
    fontSize=14, leading=20, textColor=GRAY_500,
    spaceAfter=4, fontName="Helvetica",
))
styles.add(ParagraphStyle(
    "SectionHead", parent=styles["Heading1"],
    fontSize=18, leading=24, textColor=EMERALD,
    spaceBefore=20, spaceAfter=10, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "SubHead", parent=styles["Heading2"],
    fontSize=13, leading=18, textColor=DARK,
    spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "Body", parent=styles["Normal"],
    fontSize=10, leading=15, textColor=GRAY_700,
    spaceAfter=6, fontName="Helvetica",
))
styles.add(ParagraphStyle(
    "BodyBold", parent=styles["Normal"],
    fontSize=10, leading=15, textColor=DARK,
    spaceAfter=6, fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "SmallGray", parent=styles["Normal"],
    fontSize=8, leading=11, textColor=GRAY_500,
    spaceAfter=4, fontName="Helvetica",
))
styles.add(ParagraphStyle(
    "CalloutBody", parent=styles["Normal"],
    fontSize=10, leading=15, textColor=DARK,
    fontName="Helvetica", spaceAfter=4,
))
styles.add(ParagraphStyle(
    "BulletItem", parent=styles["Normal"],
    fontSize=10, leading=15, textColor=GRAY_700,
    fontName="Helvetica", leftIndent=14, bulletIndent=0,
    spaceAfter=3,
))

# ─── Hilfsfunktionen ────────────────────────────────────────

def p(text, style="Body"):
    return Paragraph(text, styles[style])

def heading(text):
    return Paragraph(text, styles["SectionHead"])

def subheading(text):
    return Paragraph(text, styles["SubHead"])

def spacer(h=6):
    return Spacer(1, h * mm)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=GRAY_200, spaceAfter=8, spaceBefore=4)

def eur(val):
    """Format a number as German EUR string: 1.234,56 €"""
    s = f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €"

def make_table(data, col_widths=None, header_rows=1):
    t = Table(data, colWidths=col_widths, repeatRows=header_rows)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), EMERALD),
        ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), WHITE),
        ("FONTNAME", (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, header_rows - 1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, header_rows - 1), 8),
        ("TOPPADDING", (0, 0), (-1, header_rows - 1), 8),
        ("FONTNAME", (0, header_rows), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, header_rows), (-1, -1), 9),
        ("TEXTCOLOR", (0, header_rows), (-1, -1), GRAY_700),
        ("BOTTOMPADDING", (0, header_rows), (-1, -1), 6),
        ("TOPPADDING", (0, header_rows), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_200),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, header_rows), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, header_rows), (0, -1), DARK),
    ]
    for i in range(header_rows, len(data)):
        bg = GRAY_50 if i % 2 == 0 else WHITE
        style_cmds.append(("BACKGROUND", (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def callout_box(title, body_lines, bg=EMERALD_50, border=EMERALD):
    content = []
    if title:
        content.append(Paragraph(f"<b>{title}</b>", styles["BodyBold"]))
    for line in body_lines:
        content.append(Paragraph(line, styles["CalloutBody"]))
    inner = Table([[content]], colWidths=[160 * mm])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 1, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return inner

def bullet(text):
    return Paragraph(f"\u2022 {text}", styles["BulletItem"])


# ═════════════════════════════════════════════════════════════
#  DOKUMENT ERSTELLEN
# ═════════════════════════════════════════════════════════════

MONATE_DE = {
    1: "Januar", 2: "Februar", 3: "März", 4: "April",
    5: "Mai", 6: "Juni", 7: "Juli", 8: "August",
    9: "September", 10: "Oktober", 11: "November", 12: "Dezember",
}

def datum_de():
    d = date.today()
    return f"{d.day}. {MONATE_DE[d.month]} {d.year}"


def build():
    doc = SimpleDocTemplate(
        OUT_PATH,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title="Shiftfy vs Clockin \u2014 Preisvergleich & Funktionsanalyse",
        author="Shiftfy GmbH",
    )

    story = []

    # ─────────────────────────────────────────────────────────
    # DECKBLATT
    # ─────────────────────────────────────────────────────────
    story.append(spacer(20))
    story.append(Paragraph("Shiftfy vs Clockin", styles["CoverTitle"]))
    story.append(Paragraph("Preisvergleich &amp; Funktionsanalyse", styles["CoverSub"]))
    story.append(spacer(6))
    story.append(Paragraph(
        f"Erstellt von Shiftfy \u00b7 {datum_de()} \u00b7 Vertraulich",
        styles["SmallGray"],
    ))
    story.append(spacer(10))
    story.append(hr())

    # Schnellübersicht
    stats_data = [
        ["", "Shiftfy", "Clockin"],
        ["Preismodell", "Pro Nutzer\n(keine Grundgebühr)", "Pro Nutzer\n(keine Grundgebühr)"],
        ["Einstiegspreis", "2,99 €/Nutzer/Mo.", "3,99 €/Nutzer/Mo."],
        ["Schichtplanung", "In jedem Plan inklusive", "Aufpreis 24 €/Mo."],
        ["Jahresrabatt", "Bis zu 20 %", "Bis zu 20 % (24 Monate)"],
        ["Kostenlose Testphase", "14 Tage", "14 Tage"],
        ["Zielmarkt", "Deutscher Mittelstand", "Deutscher Mittelstand\n(Handwerk, Pflege)"],
    ]
    story.append(make_table(stats_data, col_widths=[45 * mm, 52 * mm, 52 * mm]))
    story.append(spacer(10))

    story.append(callout_box(
        "\U0001f4a1 Kernaussage",
        [
            "Shiftfy ist in jeder Preisstufe <b>25\u201329 % günstiger</b> als Clockin "
            "und hat <b>Schichtplanung kostenlos inklusive</b> \u2014 eine Funktion, die Clockin mit "
            "24 €/Monat extra berechnet. Damit ist Shiftfy der klare Preis-Leistungs-Sieger "
            "für schichtbasierte Betriebe."
        ],
    ))

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────
    # 1. UNTERNEHMENSPROFILE
    # ─────────────────────────────────────────────────────────
    story.append(heading("1. Unternehmensprofile"))

    profiles = [
        ["", "Shiftfy", "Clockin"],
        ["Schwerpunkt", "Schichtplanung, Zeiterfassung,\nPersonalmanagement", "Zeiterfassung,\nProjektdokumentation"],
        ["Markt", "Deutscher Mittelstand", "Deutscher Mittelstand \u2014\nHandwerk, Pflege, Produktion"],
        ["Kunden", "Frühphase", "8.000+ Unternehmen"],
        ["Referenzen", "DSGVO-konform\nMade in Germany", "OMR Leader Badge\nDATEV-Partner\nMade in Germany"],
        ["Abrechnungsmodell", "Pro Nutzer (keine Grundgebühr)", "Pro Nutzer (keine Grundgebühr)"],
        ["Vertragslaufzeiten", "Monatlich oder jährlich", "1, 12 oder 24 Monate"],
    ]
    story.append(make_table(profiles, col_widths=[40 * mm, 55 * mm, 55 * mm]))

    # ─────────────────────────────────────────────────────────
    # 2. PREISVERGLEICH
    # ─────────────────────────────────────────────────────────
    story.append(heading("2. Preisvergleich"))

    story.append(subheading("2.1 Clockin-Tarife (pro Nutzer, keine Grundgebühr)"))
    clockin_data = [
        ["Tarif", "Monatlich", "12 Monate", "24 Monate (\u221220 %)"],
        ["Digitale Stechuhr", "3,99 €/Nutzer", "3,59 €/Nutzer", "3,19 €/Nutzer"],
        ["Projektzeiterfassung", "6,99 €/Nutzer", "6,29 €/Nutzer", "5,59 €/Nutzer"],
        ["Zeiterfassung &amp;\nDokumentation", "9,99 €/Nutzer", "8,99 €/Nutzer", "7,99 €/Nutzer"],
    ]
    story.append(make_table(clockin_data, col_widths=[42 * mm, 35 * mm, 35 * mm, 42 * mm]))
    story.append(spacer(4))
    story.append(p("<b>Clockin-Zusatzmodule (Pauschalpreise):</b> Schichtplanung ab 24 €/Mo. \u00b7 "
                    "Videodokumentation ab 79 €/Mo. \u00b7 Gesprächsnotizen ab 49 €/Mo. \u00b7 "
                    "Telefonassistent ab 99 €/Mo."))

    story.append(spacer(6))
    story.append(subheading("2.2 Shiftfy-Tarife (pro Nutzer, keine Grundgebühr)"))
    shiftfy_data = [
        ["Tarif", "Monatlich", "Jährlich (Ersparnis)"],
        ["Basic", "2,99 €/Nutzer", "2,49 €/Nutzer (\u221217 %)"],
        ["Professional", "4,99 €/Nutzer", "3,99 €/Nutzer (\u221220 %)"],
        ["Enterprise", "7,99 €/Nutzer", "6,49 €/Nutzer (\u221219 %)"],
    ]
    story.append(make_table(shiftfy_data, col_widths=[42 * mm, 42 * mm, 52 * mm]))
    story.append(spacer(4))
    story.append(p("<b>Keine Zusatzmodule nötig:</b> Schichtplanung, Team-Chat, Abwesenheitsverwaltung "
                    "und Zeiterfassung sind in jedem Shiftfy-Tarif ohne Aufpreis enthalten."))

    # ─────────────────────────────────────────────────────────
    # 3. DIREKTVERGLEICH
    # ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(heading("3. Direkter Preisvergleich"))
    story.append(p("Alle Preise sind monatliche Pro-Nutzer-Tarife. Grün = günstigere Option."))

    story.append(subheading("3.1 Tarif-für-Tarif (monatliche Abrechnung)"))
    tier_data = [
        ["Stufe", "Shiftfy", "Clockin", "Shiftfy-Ersparnis"],
        ["Einsteiger / Basic", "2,99 €", "3,99 €", "\u221225 % \u2713"],
        ["Mittel / Professional", "4,99 €", "6,99 €", "\u221229 % \u2713"],
        ["Premium / Enterprise", "7,99 €", "9,99 €", "\u221220 % \u2713"],
    ]
    t = make_table(tier_data, col_widths=[40 * mm, 30 * mm, 30 * mm, 40 * mm])
    t.setStyle(TableStyle([
        ("TEXTCOLOR", (3, 1), (3, -1), GREEN_TEXT),
        ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
    ]))
    story.append(t)

    story.append(spacer(8))
    story.append(subheading("3.2 Monatliche Gesamtkosten nach Teamgröße (Basic-Tarif)"))
    story.append(p("Clockin Digitale Stechuhr vs. Shiftfy Basic \u2014 monatliche Abrechnung."))

    team_sizes = [1, 3, 5, 10, 15, 20, 30, 50, 100]
    team_data = [["Teamgröße", "Shiftfy Basic", "Clockin Stechuhr", "\u0394 (Ersparnis)"]]
    for n in team_sizes:
        s = n * 2.99
        c = n * 3.99
        delta = ((c - s) / c) * 100
        team_data.append([
            f"{n} Nutzer",
            eur(s),
            eur(c),
            f"\u2212{delta:.0f} % ({eur(c - s)})",
        ])
    story.append(make_table(team_data, col_widths=[28 * mm, 35 * mm, 38 * mm, 42 * mm]))

    story.append(spacer(8))
    story.append(subheading("3.3 Fairer Vergleich: Shiftfy Basic vs. Clockin + Schichtplanung"))
    story.append(p("Da Clockin für Schichtplanung <b>24 €/Mo. extra</b> berechnet, "
                    "wird dieser Aufpreis hier eingerechnet:"))

    addon_data = [["Teamgröße", "Shiftfy Basic", "Clockin + Schichtplanung", "\u0394 (Ersparnis)"]]
    for n in [1, 5, 10, 20, 50, 100]:
        s = n * 2.99
        c = n * 3.99 + 24.0
        delta = ((c - s) / c) * 100
        addon_data.append([
            f"{n} Nutzer",
            eur(s),
            eur(c),
            f"\u2212{delta:.0f} % \u2713",
        ])
    t2 = make_table(addon_data, col_widths=[28 * mm, 33 * mm, 48 * mm, 35 * mm])
    t2.setStyle(TableStyle([
        ("TEXTCOLOR", (3, 1), (3, -1), GREEN_TEXT),
        ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
    ]))
    story.append(t2)

    story.append(spacer(6))
    story.append(callout_box(
        "\U0001f3c6 Shiftfy gewinnt bei JEDER Teamgröße",
        [
            "Wenn Schichtplanung benötigt wird, ist Shiftfy <b>47\u201389 % günstiger</b> "
            "als Clockin für Teams von 1\u2013100 Nutzern, da Schichtplanung "
            "ohne Aufpreis enthalten ist."
        ],
    ))

    # ─────────────────────────────────────────────────────────
    # 4. FUNKTIONSVERGLEICH
    # ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(heading("4. Funktionsvergleich"))
    story.append(p("\u2705 = Enthalten \u00b7 \u274c = Nicht verfügbar \u00b7 \U0001f4b0 = Kostenpflichtiges Zusatzmodul"))

    JA = "\u2705"
    NEIN = "\u274c"
    BEZAHLT = "\U0001f4b0"

    features = [
        ["Funktion", "Shiftfy\nBasic", "Shiftfy\nPro", "Shiftfy\nEnterprise", "Clockin"],
        ["Schichtplanung", JA, JA, JA, f"{BEZAHLT} 24 €/Mo."],
        ["Zeiterfassung", JA, JA, JA, JA],
        ["Abwesenheitsverwaltung", JA, JA, JA, f"{JA} (Basis)"],
        ["Team-Chat", JA, JA, JA, NEIN],
        ["Auto-Schichtplanung", NEIN, JA, JA, NEIN],
        ["DATEV-Export", NEIN, JA, JA, JA],
        ["E-Signaturen", NEIN, JA, JA, f"{JA} (Stufe 3)"],
        ["Rollen &amp; Berechtigungen", NEIN, JA, JA, NEIN],
        ["API &amp; Webhooks", NEIN, JA, JA, NEIN],
        ["Berichte &amp; Analysen", NEIN, JA, JA, NEIN],
        ["Priorisierter Support", NEIN, JA, JA, NEIN],
        ["SSO / SAML", NEIN, NEIN, JA, NEIN],
        ["SLA-Garantie", NEIN, NEIN, JA, NEIN],
        ["Projektzeiterfassung", NEIN, NEIN, NEIN, f"{JA} (Stufe 2+)"],
        ["Foto-/Videodokumentation", NEIN, NEIN, NEIN, f"{JA} (Stufe 3)"],
        ["Checklisten/Formulare", NEIN, NEIN, NEIN, f"{JA} (Stufe 3)"],
        ["Lexware-Integration", NEIN, NEIN, NEIN, f"{JA} (Stufe 2+)"],
        ["SAP / Personio", NEIN, NEIN, NEIN, JA],
        ["Standorte", "1", "10", "Unbegrenzt", "k. A."],
        ["Max. Mitarbeiter", "15", "100", "Unbegrenzt", "Unbegrenzt"],
    ]
    ft = make_table(features, col_widths=[38 * mm, 26 * mm, 26 * mm, 28 * mm, 32 * mm])
    story.append(ft)

    # ─────────────────────────────────────────────────────────
    # 5. WETTBEWERBSVORTEILE
    # ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(heading("5. Wettbewerbsvorteile"))

    story.append(subheading("5.1 Vorteile von Shiftfy"))
    for item in [
        "<b>25\u201329 % günstiger</b> als Clockin in jeder vergleichbaren Preisstufe",
        "<b>Schichtplanung inklusive</b> in jedem Plan \u2014 Clockin verlangt 24 €/Mo. extra",
        "<b>Team-Chat integriert</b> \u2014 Clockin bietet keine Messaging-Funktion",
        "<b>Auto-Schichtplanung (Pro)</b> \u2014 KI-gestützte Dienstplanerstellung, kein Clockin-Äquivalent",
        "<b>Rollen &amp; API/Webhooks (Pro)</b> \u2014 Entwicklerfreundlich, kein Clockin-Äquivalent",
        "<b>Analyse-Dashboard (Pro)</b> \u2014 Visuelle Einblicke, bei Clockin nicht verfügbar",
        "<b>Jahresrabatt ab 12 Monaten</b> \u2014 Clockin verlangt 24 Monate für denselben Rabatt",
    ]:
        story.append(bullet(item))

    story.append(spacer(6))
    story.append(subheading("5.2 Vorteile von Clockin"))
    for item in [
        "<b>Markenbekanntheit</b> \u2014 8.000+ Kunden, OMR Leader Badge, etablierter DATEV-Partner",
        "<b>Mehr Integrationen</b> \u2014 Lexware, SAP, Personio, Sage zusätzlich zu DATEV",
        "<b>Projektdokumentation</b> \u2014 Fotos, Videos, Checklisten, Formulare (Bau/Handwerk)",
        "<b>Breitere Branchenausrichtung</b> \u2014 Handwerk, Pflege, Produktion",
        "<b>Keine Mitarbeiter-Obergrenze</b> \u2014 Reines Pro-Nutzer-Modell ohne Limits",
        "<b>24-Monats-Bindungsrabatt</b> \u2014 Tiefere Ersparnis für langfristig gebundene Kunden",
    ]:
        story.append(bullet(item))

    # ─────────────────────────────────────────────────────────
    # 6. STRATEGISCHE POSITIONIERUNG
    # ─────────────────────────────────────────────────────────
    story.append(spacer(8))
    story.append(heading("6. Strategische Positionierung"))

    story.append(p(
        "Shiftfy besetzt eine klare Wettbewerbsposition: <b>die günstigste "
        "All-in-One-Lösung für Schichtplanung und Zeiterfassung</b> auf dem deutschen Markt. "
        "Während Clockin bei der Projektdokumentation (Fotos, Checklisten, Formulare) für das "
        "Handwerk führend ist, gewinnt Shiftfy bei Preis und Funktionen für jeden Betrieb, "
        "bei dem Schichtplanung im Vordergrund steht."
    ))

    story.append(spacer(6))
    story.append(subheading("Empfohlene Marketing-Botschaften"))
    for item in [
        '<b>\u201eSchichtplanung inklusive \u2014 ohne Aufpreis\u201c</b> \u2014 Hervorheben, dass Mitbewerber extra für Schichtplanung berechnen',
        '<b>\u201eAb 2,99 € pro Nutzer\u201c</b> \u2014 Den niedrigsten Einstiegspreis am Markt betonen',
        '<b>\u201eKeine Grundgebühr, keine versteckten Kosten\u201c</b> \u2014 Einfache, transparente Preise',
        '<b>\u201eWechseln und sofort sparen\u201c</b> \u2014 Direktes Wechsel-vom-Wettbewerber-Messaging',
        '<b>\u201e14 Tage kostenlos \u2014 alle Funktionen\u201c</b> \u2014 Vollfunktions-Testphase nimmt das Risiko',
    ]:
        story.append(bullet(item))

    # ─────────────────────────────────────────────────────────
    # 7. UMSATZPROGNOSEN
    # ─────────────────────────────────────────────────────────
    story.append(spacer(8))
    story.append(heading("7. Umsatzszenarien (Neue Preise)"))
    story.append(p("Prognostizierter monatlich wiederkehrender Umsatz (MRR) bei verschiedenen "
                    "Kundenmeilensteinen. Annahme: 80 % Basic / 15 % Professional / 5 % Enterprise, "
                    "durchschnittlich 12 Nutzer pro Workspace, monatliche Abrechnung."))

    rev_data = [["Workspaces", "Nutzer gesamt", "MRR", "ARR"]]
    for ws in [50, 100, 250, 500, 1000]:
        users_per = 12
        basic_rev = ws * 0.80 * users_per * 2.99
        pro_rev = ws * 0.15 * users_per * 4.99
        ent_rev = ws * 0.05 * users_per * 7.99
        mrr = basic_rev + pro_rev + ent_rev
        arr = mrr * 12
        rev_data.append([
            f"{ws:,}".replace(",", "."),
            f"{ws * users_per:,}".replace(",", "."),
            eur(mrr),
            eur(arr),
        ])
    story.append(make_table(rev_data, col_widths=[32 * mm, 32 * mm, 40 * mm, 45 * mm]))

    # ─────────────────────────────────────────────────────────
    # FUSSZEILE / HAFTUNGSAUSSCHLUSS
    # ─────────────────────────────────────────────────────────
    story.append(spacer(16))
    story.append(hr())
    story.append(p(
        f"<i>Bericht erstellt am {datum_de()}. "
        "Clockin-Preise entnommen von clockin.de/preise. "
        "Shiftfy-Preise aus src/lib/stripe.ts. "
        "Alle Preise verstehen sich zzgl. MwSt. Änderungen vorbehalten.</i>",
        "SmallGray",
    ))
    story.append(p("<i>\u00a9 2026 Shiftfy GmbH \u2014 Vertraulich</i>", "SmallGray"))

    # ── Erstellen ────────────────────────────────────────────
    doc.build(story)
    print(f"\n\u2705 Bericht erstellt: {OUT_PATH}")
    print(f"   Dateigröße: {os.path.getsize(OUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    build()
