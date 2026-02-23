#!/usr/bin/env python3
"""
Shiftfy Business Strategy Report — Bilingual EN/DE PDF
Competitive analysis, pricing model, profitability, color palette, domain strategy.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String, Circle
from reportlab.graphics import renderPDF
from datetime import datetime
import os

# ── Colors ──
BRAND_PURPLE = HexColor("#7C3AED")
BRAND_DARK = HexColor("#5B21B6")
BRAND_LIGHT = HexColor("#EDE9FE")
ACCENT_AMBER = HexColor("#F59E0B")
SUCCESS_GREEN = HexColor("#10B981")
DANGER_RED = HexColor("#EF4444")
SURFACE = HexColor("#F8F7FF")
SIDEBAR_DARK = HexColor("#1E1B4B")
TEXT_PRIMARY = HexColor("#111827")
TEXT_MUTED = HexColor("#6B7280")
TABLE_HEADER_BG = HexColor("#7C3AED")
TABLE_ALT_BG = HexColor("#F5F3FF")
LIGHT_GRAY = HexColor("#E5E7EB")
WHITE = white

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "Shiftfy_Business_Strategy_Report.pdf")


def build_styles():
    ss = getSampleStyleSheet()

    styles = {
        "title": ParagraphStyle(
            "ReportTitle", parent=ss["Title"],
            fontSize=28, leading=34, textColor=BRAND_PURPLE,
            spaceAfter=6, fontName="Helvetica-Bold",
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle", parent=ss["Normal"],
            fontSize=12, leading=16, textColor=TEXT_MUTED,
            spaceAfter=20, fontName="Helvetica",
        ),
        "h1": ParagraphStyle(
            "H1", parent=ss["Heading1"],
            fontSize=20, leading=26, textColor=BRAND_DARK,
            spaceBefore=24, spaceAfter=10, fontName="Helvetica-Bold",
        ),
        "h2": ParagraphStyle(
            "H2", parent=ss["Heading2"],
            fontSize=15, leading=20, textColor=BRAND_PURPLE,
            spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold",
        ),
        "h3": ParagraphStyle(
            "H3", parent=ss["Heading3"],
            fontSize=12, leading=16, textColor=TEXT_PRIMARY,
            spaceBefore=10, spaceAfter=4, fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "BodyText2", parent=ss["Normal"],
            fontSize=10, leading=14, textColor=TEXT_PRIMARY,
            spaceAfter=6, fontName="Helvetica", alignment=TA_JUSTIFY,
        ),
        "body_de": ParagraphStyle(
            "BodyDE", parent=ss["Normal"],
            fontSize=10, leading=14, textColor=TEXT_MUTED,
            spaceAfter=6, fontName="Helvetica-Oblique", alignment=TA_JUSTIFY,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=ss["Normal"],
            fontSize=10, leading=14, textColor=TEXT_PRIMARY,
            leftIndent=16, spaceAfter=3, fontName="Helvetica",
            bulletIndent=6, bulletFontName="Helvetica",
        ),
        "table_header": ParagraphStyle(
            "TableHeader", parent=ss["Normal"],
            fontSize=9, leading=12, textColor=WHITE,
            fontName="Helvetica-Bold", alignment=TA_CENTER,
        ),
        "table_cell": ParagraphStyle(
            "TableCell", parent=ss["Normal"],
            fontSize=9, leading=12, textColor=TEXT_PRIMARY,
            fontName="Helvetica", alignment=TA_CENTER,
        ),
        "table_cell_left": ParagraphStyle(
            "TableCellLeft", parent=ss["Normal"],
            fontSize=9, leading=12, textColor=TEXT_PRIMARY,
            fontName="Helvetica", alignment=TA_LEFT,
        ),
        "footer": ParagraphStyle(
            "Footer", parent=ss["Normal"],
            fontSize=8, leading=10, textColor=TEXT_MUTED,
            fontName="Helvetica", alignment=TA_CENTER,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=ss["Normal"],
            fontSize=10, leading=14, textColor=BRAND_DARK,
            fontName="Helvetica-Bold", spaceAfter=8,
            leftIndent=10, borderPadding=8,
        ),
    }
    return styles


def color_swatch(hex_color, name, role):
    d = Drawing(160, 30)
    d.add(Rect(0, 4, 22, 22, fillColor=HexColor(hex_color), strokeColor=HexColor("#D1D5DB"), strokeWidth=0.5, rx=3))
    d.add(String(28, 14, f"{name}  {hex_color}", fontName="Helvetica-Bold", fontSize=8, fillColor=TEXT_PRIMARY))
    d.add(String(28, 4, role, fontName="Helvetica", fontSize=7, fillColor=TEXT_MUTED))
    return d


def hr():
    return HRFlowable(width="100%", thickness=0.5, color=LIGHT_GRAY, spaceBefore=6, spaceAfter=6)


def make_table(headers, rows, col_widths=None):
    """Build a styled table from headers + rows."""
    s = build_styles()
    header_cells = [Paragraph(h, s["table_header"]) for h in headers]
    data = [header_cells]
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            st = s["table_cell_left"] if i == 0 else s["table_cell"]
            cells.append(Paragraph(str(cell), st))
        data.append(cells)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, LIGHT_GRAY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, TABLE_ALT_BG]),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t


def build_report():
    s = build_styles()
    doc = SimpleDocTemplate(
        OUTPUT_PATH, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )
    story = []
    W = doc.width

    # ═══════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════
    story.append(Spacer(1, 60))
    story.append(Paragraph("Shiftfy", s["title"]))
    story.append(Paragraph("Business Strategy &amp; Competitive Analysis Report", s["subtitle"]))
    story.append(Paragraph("Gesch\u00e4ftsstrategie &amp; Wettbewerbsanalyse", s["subtitle"]))
    story.append(Spacer(1, 20))
    story.append(hr())
    story.append(Spacer(1, 10))

    cover_info = [
        ["Prepared for", "Omar Rageh &amp; Mo Jordan"],
        ["Date / Datum", datetime.now().strftime("%B %d, %Y")],
        ["Version", "1.0"],
        ["Classification", "Confidential / Vertraulich"],
    ]
    for label, val in cover_info:
        story.append(Paragraph(f"<b>{label}:</b> {val}", s["body"]))

    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "This report provides a comprehensive analysis of the competitive landscape, "
        "recommended color palette, pricing strategy, cost structure, profitability projections, "
        "and domain/email infrastructure for the Shiftfy shift-scheduling SaaS platform.",
        s["body"]
    ))
    story.append(Paragraph(
        "Dieser Bericht bietet eine umfassende Analyse der Wettbewerbslandschaft, "
        "empfohlene Farbpalette, Preisstrategie, Kostenstruktur, Rentabilit\u00e4tsprognosen "
        "und Domain-/E-Mail-Infrastruktur f\u00fcr die Shiftfy-Schichtplanungs-SaaS-Plattform.",
        s["body_de"]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("Table of Contents / Inhaltsverzeichnis", s["h1"]))
    story.append(Spacer(1, 8))
    toc_items = [
        "1. Executive Summary / Zusammenfassung",
        "2. Competitive Landscape / Wettbewerbslandschaft",
        "3. Competitor Pricing Deep-Dive / Preisvergleich",
        "4. Industry Color Palette / Branchenfarben",
        "5. Recommended Shiftfy Color System / Empfohlenes Farbsystem",
        "6. Shiftfy Pricing Model / Preismodell",
        "7. Cost Structure &amp; Stripe Analysis / Kostenstruktur",
        "8. Profitability Projections / Rentabilit\u00e4tsprognosen",
        "9. Domain &amp; Email Strategy / Domain- &amp; E-Mail-Strategie",
        "10. Recommendations &amp; Next Steps / Empfehlungen",
    ]
    for item in toc_items:
        story.append(Paragraph(f"\u2022  {item}", s["body"]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 1. EXECUTIVE SUMMARY
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("1. Executive Summary", s["h1"]))
    story.append(Paragraph("Zusammenfassung", s["h3"]))
    story.append(Paragraph(
        "Shiftfy enters the German shift-scheduling market with a significant structural advantage: "
        "extremely low fixed operating costs (~\u20ac61/month) compared to competitors who maintain large teams, "
        "offices, and legacy infrastructure. The primary competitor, clockin.de, charges shift planning as a "
        "separate add-on (\u20ac24+/month) on top of their per-user time tracking fees. "
        "This creates a clear market opportunity: <b>bundle shift planning into every tier</b> and undercut "
        "clockin on total cost while delivering comparable or superior features.",
        s["body"]
    ))
    story.append(Paragraph(
        "Shiftfy tritt in den deutschen Schichtplanungsmarkt ein mit einem erheblichen strukturellen Vorteil: "
        "extrem niedrige fixe Betriebskosten (~\u20ac61/Monat) im Vergleich zu Wettbewerbern mit gro\u00dfen Teams, "
        "B\u00fcros und Legacy-Infrastruktur. Der Hauptwettbewerber clockin.de berechnet Schichtplanung als "
        "separates Add-on (\u20ac24+/Monat) zus\u00e4tzlich zu den Zeiterfassungs-Nutzergeb\u00fchren. "
        "Dies schafft eine klare Marktchance: <b>Schichtplanung in jede Preisstufe integrieren</b> und "
        "clockin bei den Gesamtkosten unterbieten.",
        s["body_de"]
    ))
    story.append(Spacer(1, 8))

    # Key metrics box
    key_metrics = [
        ["Metric", "Value"],
        ["Monthly Fixed Costs", "\u20ac61 ($65.50)"],
        ["Break-even Point", "~1 paying customer (15 users, Team plan)"],
        ["Stripe Cost", "\u20ac0 fixed \u2014 1.5% + \u20ac0.25 per transaction only"],
        ["Target Market", "Germany (DACH region), 5\u201350 employee businesses"],
        ["Key Differentiator", "Shift planning included free (competitors charge extra)"],
    ]
    story.append(make_table(
        key_metrics[0], key_metrics[1:],
        col_widths=[W*0.35, W*0.65]
    ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 2. COMPETITIVE LANDSCAPE
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("2. Competitive Landscape", s["h1"]))
    story.append(Paragraph("Wettbewerbslandschaft", s["h3"]))
    story.append(Paragraph(
        "The German Zeiterfassung (time tracking) and Schichtplanung (shift scheduling) market is dominated "
        "by a handful of established players. Below is an overview of the four most relevant competitors "
        "and their positioning:",
        s["body"]
    ))
    story.append(Paragraph(
        "Der deutsche Zeiterfassungs- und Schichtplanungsmarkt wird von einer Handvoll etablierter Anbieter "
        "dominiert. Nachfolgend ein \u00dcberblick \u00fcber die vier relevantesten Wettbewerber und "
        "deren Positionierung:",
        s["body_de"]
    ))
    story.append(Spacer(1, 8))

    comp_data = [
        ["Competitor", "HQ", "Focus", "Free Tier", "Shift Planning", "Pricing Model"],
        ["clockin.de", "Germany", "Time tracking + add-ons", "14-day trial", "Paid add-on (\u20ac24+/mo)", "Per user/mo + add-ons"],
        ["Papershift", "Germany", "Full workforce mgmt", "14-day trial", "Included in plans", "Package-based + support fee"],
        ["Connecteam", "Israel/US", "All-in-one deskless", "Free \u226410 users", "Included (Ops Hub)", "Hub-based, flat for 30 users"],
        ["Personio", "Germany", "HR + Payroll", "Demo only", "Limited", "Custom enterprise pricing"],
        ["Shiftfy (us)", "Germany", "Shift scheduling", "Free \u22645 users", "Included in ALL tiers", "Per user/mo, simple tiers"],
    ]
    story.append(make_table(
        comp_data[0], comp_data[1:],
        col_widths=[W*0.14, W*0.10, W*0.18, W*0.14, W*0.20, W*0.24]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Competitive Strengths of Shiftfy / Wettbewerbsvorteile von Shiftfy", s["h2"]))
    strengths = [
        "\u2022  <b>Shift planning is core, not an add-on</b> \u2014 clockin charges \u20ac24+/mo extra for it",
        "\u2022  <b>Radically lower operating costs</b> \u2014 \u20ac61/mo vs. competitors with 50+ employees",
        "\u2022  <b>Modern tech stack</b> \u2014 Next.js PWA, real-time, mobile-first (no legacy code)",
        "\u2022  <b>German-market native</b> \u2014 DSGVO-compliant, German UI, German support",
        "\u2022  <b>Free tier creates viral growth</b> \u2014 clockin has no permanent free tier",
    ]
    for item in strengths:
        story.append(Paragraph(item, s["body"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 3. COMPETITOR PRICING DEEP-DIVE
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("3. Competitor Pricing Deep-Dive", s["h1"]))
    story.append(Paragraph("Detaillierter Preisvergleich", s["h3"]))

    # clockin
    story.append(Paragraph("3.1 clockin.de", s["h2"]))
    story.append(Paragraph(
        "clockin uses a tiered per-user model with shift planning sold as a separate paid add-on. "
        "All prices shown are for 24-month contracts (best price). Monthly contracts are ~20% higher.",
        s["body"]
    ))
    story.append(Paragraph(
        "clockin verwendet ein gestaffeltes Nutzermodell mit Schichtplanung als separates kostenpflichtiges Add-on. "
        "Alle Preise gelten f\u00fcr 24-Monats-Vertr\u00e4ge (bester Preis). Monatsvertr\u00e4ge sind ~20% teurer.",
        s["body_de"]
    ))

    clockin_data = [
        ["Plan", "Price (24mo)", "Price (monthly)", "Key Features"],
        ["Digitale Stechuhr", "\u20ac3.19/user/mo", "\u20ac3.99/user/mo", "Clock in/out, app, browser, DATEV, calendar"],
        ["Projektzeiterfassung", "\u20ac5.59/user/mo", "\u20ac6.99/user/mo", "+ Project tracking, Lexware, CRM"],
        ["Zeiterfassung &amp; Doku", "\u20ac7.99/user/mo", "\u20ac9.99/user/mo", "+ Checklists, photos, signatures, forms"],
        ["Schichtplanung ADD-ON", "\u20ac24+/mo FLAT", "\u20ac24+/mo FLAT", "Drag &amp; drop shifts, conflict warnings"],
    ]
    story.append(make_table(
        clockin_data[0], clockin_data[1:],
        col_widths=[W*0.22, W*0.18, W*0.18, W*0.42]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "<b>Example: 20-person team wanting time tracking + shifts on clockin:</b><br/>"
        "Digitale Stechuhr: 20 \u00d7 \u20ac3.99 = \u20ac79.80 + Schichtplanung add-on: \u20ac24.00 = "
        "<b>\u20ac103.80/month</b><br/>"
        "With the mid-tier plan: 20 \u00d7 \u20ac6.99 + \u20ac24 = <b>\u20ac163.80/month</b>",
        s["callout"]
    ))

    # Connecteam
    story.append(Paragraph("3.2 Connecteam", s["h2"]))
    story.append(Paragraph(
        "Connecteam uses a hub-based model (Operations, Communications, HR). Each hub is priced separately. "
        "Shift scheduling is included in the Operations Hub. Prices are in USD.",
        s["body"]
    ))
    conn_data = [
        ["Plan (Ops Hub)", "Price (yearly)", "Price (monthly)", "Users Included"],
        ["Small Business", "Free", "Free", "\u226410 users, all features"],
        ["Basic", "$29/mo flat", "$35/mo flat", "30 users (+$0.80\u20131.00/extra)"],
        ["Advanced", "$49/mo flat", "$59/mo flat", "30 users (+$2.50\u20133.00/extra)"],
        ["Expert", "$99/mo flat", "$119/mo flat", "30 users (+$4.20\u20135.00/extra)"],
        ["Enterprise", "Custom", "Custom", "Custom"],
    ]
    story.append(make_table(
        conn_data[0], conn_data[1:],
        col_widths=[W*0.22, W*0.22, W*0.22, W*0.34]
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Note:</b> Connecteam is strong internationally but not optimized for the German market "
        "(no DATEV integration, no German-language support team, UI primarily in English). "
        "Their pricing is competitive for larger teams (30+ users at flat rate) but complex to understand.",
        s["body"]
    ))

    # Papershift
    story.append(Paragraph("3.3 Papershift", s["h2"]))
    story.append(Paragraph(
        "Papershift is a German-based workforce management platform offering Dienstplanung, Zeiterfassung, "
        "Urlaubsverwaltung, and Lohnabrechnung. They use package-based pricing with mandatory support fees "
        "starting at \u20ac39/month. Exact per-user pricing is not publicly disclosed\u2014they require a demo booking. "
        "Their minimum support cost creates a high entry barrier for small teams.",
        s["body"]
    ))
    story.append(Paragraph(
        "Papershift ist eine deutsche Workforce-Management-Plattform mit Dienstplanung, Zeiterfassung, "
        "Urlaubsverwaltung und Lohnabrechnung. Sie nutzen paketbasierte Preise mit obligatorischen "
        "Supportgeb\u00fchren ab \u20ac39/Monat. Genaue Nutzerpreise sind nicht \u00f6ffentlich\u2014eine "
        "Demo-Buchung ist erforderlich. Die Mindestsupportkosten schaffen eine hohe Einstiegsh\u00fcrde f\u00fcr kleine Teams.",
        s["body_de"]
    ))
    paper_data = [
        ["Support Tier", "Monthly Cost", "Includes"],
        ["Basic", "\u20ac39/mo", "Email support, helpdesk, digital onboarding"],
        ["Plus", "\u20ac99/mo", "+ Phone 10\u201316h, live chat, backup"],
        ["Expert", "\u20ac399/mo", "+ Phone 09\u201317h, remote support, optimization"],
    ]
    story.append(make_table(
        paper_data[0], paper_data[1:],
        col_widths=[W*0.20, W*0.20, W*0.60]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 4. INDUSTRY COLOR PALETTE
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("4. Industry Color Palette Analysis", s["h1"]))
    story.append(Paragraph("Branchenfarben-Analyse", s["h3"]))
    story.append(Paragraph(
        "Analysis of the leading competitors reveals consistent color patterns across the workforce "
        "management / time tracking SaaS industry:",
        s["body"]
    ))

    color_analysis = [
        ["Competitor", "Primary Color", "Palette Style", "Mood"],
        ["clockin.de", "Mid-Blue (#3B82F6)", "Blue + White + Light Gray", "Trust, corporate, safe"],
        ["Connecteam", "Teal-Green (#0D9488)", "Green + Dark nav + White", "Energy, freshness, action"],
        ["Papershift", "Bright Blue (#2563EB)", "Blue + Orange accent + White", "Professional, modern"],
        ["Personio", "Deep Blue (#1E3A5F)", "Navy + Coral accent", "Enterprise, premium"],
        ["Factorial", "Purple (#8B5CF6)", "Purple + Pink gradient", "Modern, trendy"],
    ]
    story.append(make_table(
        color_analysis[0], color_analysis[1:],
        col_widths=[W*0.18, W*0.22, W*0.28, W*0.32]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "<b>Key insight:</b> Blue dominates the German market (clockin, Papershift, Personio). "
        "Nobody owns purple. Shiftfy's purple (#7C3AED) is a genuine differentiator\u2014instantly "
        "recognizable and distinct from every major competitor.",
        s["callout"]
    ))
    story.append(Paragraph(
        "<b>Kernerkenntnis:</b> Blau dominiert den deutschen Markt. Niemand besetzt Lila. "
        "Shiftfys Lila (#7C3AED) ist ein echter Differenzierungsfaktor\u2014sofort erkennbar und "
        "von jedem gro\u00dfen Wettbewerber verschieden.",
        s["body_de"]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 5. RECOMMENDED COLOR SYSTEM
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("5. Recommended Shiftfy Color System", s["h1"]))
    story.append(Paragraph("Empfohlenes Farbsystem f\u00fcr Shiftfy", s["h3"]))
    story.append(Paragraph(
        "The following color system is designed to be industry-standard yet distinctive. "
        "It maintains the current brand purple while adding proper semantic colors for "
        "a professional application UI.",
        s["body"]
    ))

    palette_data = [
        ["Role", "Hex Code", "Usage (EN)", "Verwendung (DE)"],
        ["Primary (Brand)", "#7C3AED", "Buttons, active nav, links, brand elements", "Buttons, aktive Navigation, Links, Markenelemente"],
        ["Primary Dark", "#5B21B6", "Hover states, focus rings, headers", "Hover-Zust\u00e4nde, Fokusringe, Kopfzeilen"],
        ["Primary Light", "#EDE9FE", "Selected backgrounds, badges, tags", "Ausgew\u00e4hlte Hintergr\u00fcnde, Badges, Tags"],
        ["Accent (CTA)", "#F59E0B", "Upgrade banners, pricing highlights, alerts", "Upgrade-Banner, Preis-Highlights, Warnungen"],
        ["Success", "#10B981", "Clock-in confirmed, shifts approved, checks", "Einstempeln best\u00e4tigt, Schichten genehmigt"],
        ["Danger", "#EF4444", "Conflicts, overtime warnings, delete actions", "Konflikte, \u00dcberstunden-Warnungen, L\u00f6schen"],
        ["Warning", "#F59E0B", "Pending approvals, attention needed", "Ausstehende Genehmigungen, Aufmerksamkeit"],
        ["Info", "#3B82F6", "Informational tooltips, help text", "Info-Tooltips, Hilfetexte"],
        ["Surface / BG", "#F8F7FF", "App background (warm white w/ purple tint)", "App-Hintergrund (warmes Wei\u00df mit Lila-Ton)"],
        ["Sidebar", "#1E1B4B", "Dark indigo sidebar \u2014 premium feel", "Dunkle Indigo-Seitenleiste \u2014 Premium-Gef\u00fchl"],
        ["Text Primary", "#111827", "Main text, headings", "Haupttext, \u00dcberschriften"],
        ["Text Muted", "#6B7280", "Secondary text, descriptions, timestamps", "Sekund\u00e4rtext, Beschreibungen, Zeitstempel"],
        ["Border", "#E5E7EB", "Card borders, dividers, input borders", "Kartenr\u00e4nder, Trennlinien, Input-R\u00e4nder"],
    ]
    story.append(make_table(
        palette_data[0], palette_data[1:],
        col_widths=[W*0.14, W*0.12, W*0.37, W*0.37]
    ))
    story.append(Spacer(1, 12))

    # Visual swatches
    story.append(Paragraph("Visual Color Swatches:", s["h3"]))
    swatches = [
        ("#7C3AED", "Primary", "Brand purple"),
        ("#5B21B6", "Dark", "Hover/press"),
        ("#EDE9FE", "Light", "Backgrounds"),
        ("#F59E0B", "Accent", "CTA/upgrade"),
        ("#10B981", "Success", "Confirmed"),
        ("#EF4444", "Danger", "Warnings"),
        ("#1E1B4B", "Sidebar", "Navigation"),
        ("#F8F7FF", "Surface", "App BG"),
    ]
    swatch_row = []
    for hex_c, name, role in swatches:
        d = Drawing(62, 40)
        d.add(Rect(4, 10, 54, 26, fillColor=HexColor(hex_c), strokeColor=HexColor("#D1D5DB"), strokeWidth=0.5, rx=4))
        d.add(String(8, 2, f"{name}", fontName="Helvetica", fontSize=6, fillColor=TEXT_PRIMARY))
        swatch_row.append(d)

    swatch_table = Table([swatch_row], colWidths=[W/8]*8)
    swatch_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(swatch_table)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 6. SHIFTFY PRICING MODEL
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("6. Recommended Shiftfy Pricing Model", s["h1"]))
    story.append(Paragraph("Empfohlenes Shiftfy Preismodell", s["h3"]))

    story.append(Paragraph(
        "The pricing model is designed around three principles: (1) shift planning included in every tier "
        "(attacking clockin's biggest weakness), (2) a generous free tier for organic growth and referrals, "
        "and (3) per-user pricing that undercuts competitors at every team size.",
        s["body"]
    ))
    story.append(Paragraph(
        "Das Preismodell basiert auf drei Prinzipien: (1) Schichtplanung in jeder Stufe enthalten "
        "(Angriff auf clockins gr\u00f6\u00dfte Schw\u00e4che), (2) ein gro\u00dfz\u00fcgiges kostenloses Angebot f\u00fcr "
        "organisches Wachstum und Empfehlungen, (3) Nutzerpreise, die Wettbewerber bei jeder Teamgr\u00f6\u00dfe unterbieten.",
        s["body_de"]
    ))
    story.append(Spacer(1, 8))

    pricing_data = [
        ["Plan", "Monthly Price", "Annual Price", "Features"],
        [
            "Starter (Free)",
            "\u20ac0 forever",
            "\u20ac0 forever",
            "\u22645 employees, 1 location, shift planning, time tracking (Stempeluhr), "
            "team overview, basic export, no credit card required"
        ],
        [
            "Team",
            "\u20ac5.90/user/mo",
            "\u20ac4.90/user/mo",
            "Unlimited employees, \u22645 locations, shift templates, absence mgmt, "
            "CSV/PDF export, email notifications, team clock overview"
        ],
        [
            "Business",
            "\u20ac9.50/user/mo",
            "\u20ac7.90/user/mo",
            "Everything in Team + unlimited locations, custom roles &amp; permissions, "
            "API/webhooks, DATEV export, analytics dashboard, priority support"
        ],
        [
            "Enterprise",
            "Custom",
            "Custom",
            "Everything in Business + white-label, SSO/SAML, dedicated SLA, "
            "custom integrations, onboarding assistance"
        ],
    ]
    story.append(make_table(
        pricing_data[0], pricing_data[1:],
        col_widths=[W*0.14, W*0.16, W*0.15, W*0.55]
    ))
    story.append(Spacer(1, 12))

    # Direct comparison
    story.append(Paragraph("6.1 Direct Price Comparison: 20-Person Team", s["h2"]))
    story.append(Paragraph("Direkter Preisvergleich: 20-Personen-Team", s["h3"]))

    compare_data = [
        ["Provider", "Plan", "Monthly Cost", "Includes Shifts?", "Savings vs clockin"],
        ["clockin", "Stechuhr + Schichtplanung", "\u20ac103.80", "Yes (add-on)", "\u2014"],
        ["clockin", "Projekt + Schichtplanung", "\u20ac163.80", "Yes (add-on)", "\u2014"],
        ["Shiftfy", "Team (monthly)", "\u20ac118.00", "YES (included)", "\u2014"],
        ["Shiftfy", "Team (annual)", "\u20ac98.00", "YES (included)", "\u20ac5.80/mo saved"],
        ["Shiftfy", "Business (annual)", "\u20ac158.00", "YES (included)", "\u20ac5.80/mo saved"],
        ["Connecteam", "Ops Basic (yearly)", "$29 flat", "YES (included)", "USD, not DE-native"],
        ["Papershift", "Package + Basic Support", "\u20ac39+ support alone", "YES (included)", "Opaque pricing"],
    ]
    story.append(make_table(
        compare_data[0], compare_data[1:],
        col_widths=[W*0.14, W*0.26, W*0.16, W*0.18, W*0.26]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "<b>Key takeaway:</b> Shiftfy Team (annual) at \u20ac98/month for 20 users is cheaper than clockin's "
        "base plan + shifts (\u20ac103.80) while including MORE features. This is the core sales argument.",
        s["callout"]
    ))
    story.append(Paragraph(
        "<b>Kernaussage:</b> Shiftfy Team (j\u00e4hrlich) mit \u20ac98/Monat f\u00fcr 20 Nutzer ist g\u00fcnstiger als "
        "clockins Basispaket + Schichten (\u20ac103,80) und bietet MEHR Funktionen. "
        "Dies ist das zentrale Verkaufsargument.",
        s["body_de"]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 7. COST STRUCTURE & STRIPE
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("7. Cost Structure &amp; Stripe Analysis", s["h1"]))
    story.append(Paragraph("Kostenstruktur &amp; Stripe-Analyse", s["h3"]))

    story.append(Paragraph("7.1 Fixed Monthly Costs", s["h2"]))
    cost_data = [
        ["Service", "Monthly Cost", "Annual Cost", "Purpose"],
        ["Vercel Pro", "$25.00 (\u20ac23.25)", "\u20ac279.00", "Hosting, CDN, serverless functions, preview deploys"],
        ["Supabase Pro", "$20.00 (\u20ac18.60)", "\u20ac223.20", "PostgreSQL database, auth infrastructure, realtime"],
        ["Resend", "$20.00 (\u20ac18.60)", "\u20ac223.20", "Transactional email delivery (verification, notifications)"],
        ["Domain (shiftfy.de)", "\u20ac0.50", "\u20ac6.00", "Primary domain for app and email"],
        ["Domain (shiftfy.com)", "\u20ac1.00", "\u20ac12.00", "Brand protection, redirect to .de"],
        ["TOTAL FIXED", "\u20ac61.95/mo", "\u20ac743.40/yr", ""],
    ]
    story.append(make_table(
        cost_data[0], cost_data[1:],
        col_widths=[W*0.20, W*0.20, W*0.18, W*0.42]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("7.2 Stripe Pricing (Germany / EWR)", s["h2"]))
    story.append(Paragraph(
        "Stripe has <b>NO monthly fee, NO setup fee, and NO hidden charges</b>. You only pay per transaction. "
        "This is critical for a startup\u2014your payment processing cost is \u20ac0 until you earn revenue.",
        s["body"]
    ))
    story.append(Paragraph(
        "Stripe hat <b>KEINE monatliche Geb\u00fchr, KEINE Einrichtungsgeb\u00fchr und KEINE versteckten Kosten</b>. "
        "Sie zahlen nur pro Transaktion. Dies ist entscheidend f\u00fcr ein Startup\u2014Ihre "
        "Zahlungsabwicklungskosten sind \u20ac0, bis Sie Umsatz erzielen.",
        s["body_de"]
    ))

    stripe_data = [
        ["Transaction Type", "Stripe Fee", "Example on \u20ac49 payment"],
        ["EWR Standard Cards (Visa, MC)", "1.5% + \u20ac0.25", "\u20ac0.74 + \u20ac0.25 = \u20ac0.99"],
        ["EWR Premium Cards", "1.9% + \u20ac0.25", "\u20ac0.93 + \u20ac0.25 = \u20ac1.18"],
        ["UK Cards", "2.5% + \u20ac0.25", "\u20ac1.23 + \u20ac0.25 = \u20ac1.48"],
        ["Non-EU Cards", "3.25% + \u20ac0.25", "\u20ac1.59 + \u20ac0.25 = \u20ac1.84"],
        ["SEPA Direct Debit", "\u20ac0.35 flat", "\u20ac0.35"],
        ["Stripe Billing (subscriptions)", "0.7% of volume", "\u20ac0.34 on \u20ac49"],
        ["Refunds", "Fee NOT returned", "You lose the original fee"],
        ["Disputes/Chargebacks", "\u20ac15.00 per dispute", "Rare for B2B SaaS"],
    ]
    story.append(make_table(
        stripe_data[0], stripe_data[1:],
        col_widths=[W*0.32, W*0.28, W*0.40]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        "<b>Recommendation:</b> Use Stripe Billing (Pay-as-you-go at 0.7%) for subscription management. "
        "Encourage SEPA Direct Debit (\u20ac0.35 flat) over cards (1.5%+) to minimize fees for German customers. "
        "Most German SMBs prefer SEPA Lastschrift anyway.",
        s["callout"]
    ))
    story.append(Paragraph(
        "<b>Empfehlung:</b> Stripe Billing (Pay-as-you-go, 0,7%) f\u00fcr Abonnementverwaltung nutzen. "
        "SEPA-Lastschrift (\u20ac0,35 flat) gegen\u00fcber Karten (1,5%+) bevorzugen, um Geb\u00fchren f\u00fcr "
        "deutsche Kunden zu minimieren. Die meisten deutschen KMU bevorzugen ohnehin SEPA-Lastschrift.",
        s["body_de"]
    ))

    story.append(Spacer(1, 8))

    # Total effective cost per transaction
    story.append(Paragraph("7.3 Effective Stripe Cost per \u20ac49/month Subscription", s["h2"]))
    eff_data = [
        ["Payment Method", "Card/SEPA Fee", "Billing Fee (0.7%)", "Total Fee", "Net Revenue"],
        ["SEPA Lastschrift", "\u20ac0.35", "\u20ac0.34", "\u20ac0.69", "\u20ac48.31 (98.6%)"],
        ["EWR Standard Card", "\u20ac0.99", "\u20ac0.34", "\u20ac1.33", "\u20ac47.67 (97.3%)"],
        ["EWR Premium Card", "\u20ac1.18", "\u20ac0.34", "\u20ac1.52", "\u20ac47.48 (96.9%)"],
    ]
    story.append(make_table(
        eff_data[0], eff_data[1:],
        col_widths=[W*0.22, W*0.18, W*0.20, W*0.18, W*0.22]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 8. PROFITABILITY PROJECTIONS
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("8. Profitability Projections", s["h1"]))
    story.append(Paragraph("Rentabilit\u00e4tsprognosen", s["h3"]))

    story.append(Paragraph(
        "With fixed costs of only ~\u20ac62/month, Shiftfy reaches profitability extremely quickly. "
        "The projections below assume the Team plan (\u20ac4.90/user/mo annual) as the average, "
        "with 80% SEPA payment adoption.",
        s["body"]
    ))
    story.append(Paragraph(
        "Mit Fixkosten von nur ~\u20ac62/Monat erreicht Shiftfy extrem schnell die Rentabilit\u00e4t. "
        "Die folgenden Prognosen gehen vom Team-Plan (\u20ac4,90/Nutzer/Monat j\u00e4hrlich) als Durchschnitt aus, "
        "mit 80% SEPA-Zahlungsadoption.",
        s["body_de"]
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("8.1 Revenue Scenarios (Monthly)", s["h2"]))
    rev_data = [
        ["Scenario", "Paying Customers", "Avg Users/Customer", "Total Users", "Gross MRR", "Stripe Fees (~1.5%)", "Net MRR", "Fixed Costs", "PROFIT"],
        ["Break-even", "2", "10", "20", "\u20ac98", "~\u20ac2", "\u20ac96", "\u20ac62", "+\u20ac34"],
        ["Early traction", "5", "15", "75", "\u20ac368", "~\u20ac6", "\u20ac362", "\u20ac62", "+\u20ac300"],
        ["Growth", "15", "15", "225", "\u20ac1,103", "~\u20ac17", "\u20ac1,086", "\u20ac62", "+\u20ac1,024"],
        ["Scale", "30", "20", "600", "\u20ac2,940", "~\u20ac44", "\u20ac2,896", "\u20ac62", "+\u20ac2,834"],
        ["Mature", "75", "20", "1,500", "\u20ac7,350", "~\u20ac110", "\u20ac7,240", "\u20ac62", "+\u20ac7,178"],
        ["Market leader", "200", "25", "5,000", "\u20ac24,500", "~\u20ac368", "\u20ac24,132", "\u20ac62*", "+\u20ac24,070"],
    ]
    story.append(make_table(
        rev_data[0], rev_data[1:],
        col_widths=[W*0.11, W*0.09, W*0.09, W*0.08, W*0.10, W*0.11, W*0.10, W*0.10, W*0.10]
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "* At scale, Vercel/Supabase costs may increase marginally with traffic, but remain a small fraction of revenue.",
        s["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("8.2 Annual Revenue Projections", s["h2"]))
    annual_data = [
        ["Year", "Target Customers", "Avg Users", "Annual Revenue", "Annual Costs", "Annual Profit", "Profit Margin"],
        ["Year 1 (2026)", "15", "15", "\u20ac13,230", "\u20ac944", "+\u20ac12,286", "92.9%"],
        ["Year 2 (2027)", "50", "18", "\u20ac52,920", "\u20ac1,200*", "+\u20ac51,720", "97.7%"],
        ["Year 3 (2028)", "150", "20", "\u20ac176,400", "\u20ac2,000*", "+\u20ac174,400", "98.9%"],
    ]
    story.append(make_table(
        annual_data[0], annual_data[1:],
        col_widths=[W*0.14, W*0.14, W*0.10, W*0.17, W*0.14, W*0.16, W*0.15]
    ))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "* Costs increase slightly at scale (higher Supabase/Vercel tiers) but remain minimal relative to revenue. "
        "Does not include marketing spend, which would be the primary expense at growth stage.",
        s["body"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("8.3 Profit Margin Comparison", s["h2"]))
    margin_data = [
        ["Metric", "Shiftfy", "Typical SaaS", "Why"],
        ["Gross Margin", "~97%", "70\u201380%", "No servers to maintain, no support team salaries"],
        ["Fixed Cost Ratio", "~\u20ac62/mo", "\u20ac5,000\u201350,000/mo", "No office, no employees (yet), pure software"],
        ["Break-even Users", "~20", "500\u20131,000", "Ultra-lean operation"],
        ["CAC Payback", "~1 month", "6\u201318 months", "Free tier drives organic + word-of-mouth"],
    ]
    story.append(make_table(
        margin_data[0], margin_data[1:],
        col_widths=[W*0.18, W*0.18, W*0.18, W*0.46]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 9. DOMAIN & EMAIL STRATEGY
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("9. Domain &amp; Email Strategy", s["h1"]))
    story.append(Paragraph("Domain- &amp; E-Mail-Strategie", s["h3"]))

    story.append(Paragraph("9.1 Domain Purchases", s["h2"]))
    story.append(Paragraph(
        "You currently have a domain for \u20ac6/year. For the Shiftfy brand, you need to purchase:",
        s["body"]
    ))

    domain_data = [
        ["Domain", "Est. Cost", "Purpose", "Priority"],
        ["shiftfy.de", "~\u20ac6/yr", "Primary app domain, email sender domain", "CRITICAL"],
        ["shiftfy.com", "~\u20ac12/yr", "Brand protection, international redirect", "HIGH"],
        ["shiftfy.app", "~\u20ac15/yr", "Optional \u2014 trendy TLD for PWA branding", "LOW"],
    ]
    story.append(make_table(
        domain_data[0], domain_data[1:],
        col_widths=[W*0.18, W*0.14, W*0.46, W*0.22]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("9.2 Email Setup with Resend", s["h2"]))
    story.append(Paragraph(
        "<b>Do you need to buy a NEW domain specifically for Resend?</b><br/><br/>"
        "No! You do NOT need a separate domain for Resend. Here is exactly what to do:",
        s["body"]
    ))

    steps = [
        "<b>Step 1:</b> Buy <b>shiftfy.de</b> from any registrar (IONOS, Hetzner, Namecheap, etc.) \u2014 ~\u20ac6/yr",
        "<b>Step 2:</b> Go to your existing Resend dashboard \u2192 Domains \u2192 Add Domain",
        "<b>Step 3:</b> Enter <b>shiftfy.de</b> and Resend will give you DNS records to add (SPF, DKIM, DMARC TXT records)",
        "<b>Step 4:</b> Add those DNS records at your registrar's DNS settings",
        "<b>Step 5:</b> Wait for verification (usually 5\u201330 minutes)",
        "<b>Step 6:</b> Update your .env: <b>RESEND_FROM_EMAIL=\"Shiftfy &lt;noreply@shiftfy.de&gt;\"</b>",
        "<b>Step 7:</b> Deploy to Vercel with the updated env variable",
    ]
    for step in steps:
        story.append(Paragraph(f"\u2022  {step}", s["body"]))

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<b>Important:</b> Your current setup sends from <b>noreply@shiftdemo.shop</b> via Resend's shared domain. "
        "This works but has lower deliverability. Sending from your own verified domain (shiftfy.de) will "
        "dramatically improve email deliverability, avoid spam filters, and look professional.",
        s["callout"]
    ))
    story.append(Paragraph(
        "<b>Wichtig:</b> Ihr aktuelles Setup sendet von <b>noreply@shiftdemo.shop</b> \u00fcber Resends gemeinsame Domain. "
        "Das funktioniert, hat aber niedrigere Zustellbarkeit. Das Senden von Ihrer eigenen verifizierten Domain "
        "(shiftfy.de) verbessert die E-Mail-Zustellbarkeit dramatisch, vermeidet Spam-Filter und wirkt professionell.",
        s["body_de"]
    ))
    story.append(Spacer(1, 12))

    story.append(Paragraph("9.3 Total Domain/Email Cost Summary", s["h2"]))
    email_cost = [
        ["Item", "Annual Cost", "Notes"],
        ["shiftfy.de domain", "\u20ac6", "Primary domain"],
        ["shiftfy.com domain", "\u20ac12", "Brand protection"],
        ["Resend Pro (existing)", "\u20ac223 ($20/mo)", "Already paying \u2014 just add domain"],
        ["Additional Resend cost", "\u20ac0", "Adding a domain to Resend is FREE"],
        ["TOTAL NEW COST", "\u20ac18/year", "Just the two domain registrations"],
    ]
    story.append(make_table(
        email_cost[0], email_cost[1:],
        col_widths=[W*0.28, W*0.18, W*0.54]
    ))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # 10. RECOMMENDATIONS & NEXT STEPS
    # ═══════════════════════════════════════════════════
    story.append(Paragraph("10. Recommendations &amp; Next Steps", s["h1"]))
    story.append(Paragraph("Empfehlungen &amp; N\u00e4chste Schritte", s["h3"]))

    story.append(Paragraph("10.1 Immediate Actions (This Week)", s["h2"]))
    immediate = [
        "\u2022  <b>Buy shiftfy.de + shiftfy.com</b> \u2014 secure the brand before someone else does (\u20ac18/yr total)",
        "\u2022  <b>Verify shiftfy.de in Resend</b> \u2014 add DNS records, update RESEND_FROM_EMAIL",
        "\u2022  <b>Create Stripe account</b> \u2014 \u20ac0 to start, connect to Shiftfy for payment processing",
        "\u2022  <b>Apply the color palette</b> \u2014 update Tailwind config and globals.css with the recommended system",
    ]
    for item in immediate:
        story.append(Paragraph(item, s["body"]))

    story.append(Paragraph("10.2 Short-term (Next 2\u20134 Weeks)", s["h2"]))
    short_term = [
        "\u2022  <b>Implement Stripe Billing</b> \u2014 subscription checkout for Team + Business plans",
        "\u2022  <b>Build pricing page</b> \u2014 clear comparison against clockin (show the \u20ac5.80/mo savings)",
        "\u2022  <b>Launch free tier</b> \u2014 allow sign-ups with Starter plan (up to 5 users, 1 location)",
        "\u2022  <b>Add SEPA Direct Debit</b> \u2014 lower fees (\u20ac0.35 vs \u20ac0.99+) and preferred by German SMBs",
    ]
    for item in short_term:
        story.append(Paragraph(item, s["body"]))

    story.append(Paragraph("10.3 Medium-term (1\u20133 Months)", s["h2"]))
    medium_term = [
        "\u2022  <b>DATEV export</b> \u2014 critical for German market (clockin has it, we need it for Business tier)",
        "\u2022  <b>Landing page optimization</b> \u2014 German SEO for \"Schichtplanung Software\" + \"Zeiterfassung\"",
        "\u2022  <b>Google Ads campaign</b> \u2014 target clockin brand searches and generic shift planning keywords",
        "\u2022  <b>Referral program</b> \u2014 \u201cGet 1 month free for each referral\u201d to drive viral growth",
        "\u2022  <b>14-day trial for paid plans</b> \u2014 match industry standard (clockin, Papershift both offer this)",
    ]
    for item in medium_term:
        story.append(Paragraph(item, s["body"]))

    story.append(Paragraph("10.4 Key Strategic Principles", s["h2"]))
    principles = [
        "\u2022  <b>Never charge separately for shift planning</b> \u2014 this is your #1 differentiator vs clockin",
        "\u2022  <b>Keep the free tier generous</b> \u2014 5 users is enough for a small shop to fully adopt and then upgrade",
        "\u2022  <b>Price 5\u201310% below clockin's total cost</b> \u2014 just enough to win the deal, not so cheap it looks suspicious",
        "\u2022  <b>Focus on German market first</b> \u2014 DACH region has strong willingness to pay for SaaS tools",
        "\u2022  <b>Optimize for SEPA payments</b> \u2014 lower fees + preferred by your target customers",
    ]
    for item in principles:
        story.append(Paragraph(item, s["body"]))

    story.append(Spacer(1, 30))
    story.append(hr())
    story.append(Paragraph(
        "Confidential \u2014 Prepared for Shiftfy GbR / Omar Rageh &amp; Mo Jordan<br/>"
        f"Generated: {datetime.now().strftime('%B %d, %Y at %H:%M')}<br/>"
        "Vertraulich \u2014 Erstellt f\u00fcr Shiftfy GbR / Omar Rageh &amp; Mo Jordan",
        s["footer"]
    ))

    # Build PDF
    doc.build(story)
    print(f"\n\u2705 Report generated: {OUTPUT_PATH}")
    print(f"   File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    build_report()
