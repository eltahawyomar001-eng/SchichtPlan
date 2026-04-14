#!/usr/bin/env python3
"""
Shiftfy vs Clockin — Competitive Pricing & Feature Analysis
Generates a professional PDF report.
"""

import os
from datetime import date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
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

# ─── Colours ─────────────────────────────────────────────────
EMERALD = colors.HexColor("#059669")
EMERALD_LIGHT = colors.HexColor("#d1fae5")
EMERALD_50 = colors.HexColor("#ecfdf5")
DARK = colors.HexColor("#111827")
GRAY_700 = colors.HexColor("#374151")
GRAY_500 = colors.HexColor("#6b7280")
GRAY_200 = colors.HexColor("#e5e7eb")
GRAY_50 = colors.HexColor("#f9fafb")
WHITE = colors.white
RED_LIGHT = colors.HexColor("#fef2f2")
RED_TEXT = colors.HexColor("#dc2626")
GREEN_TEXT = colors.HexColor("#059669")
BLUE_LIGHT = colors.HexColor("#eff6ff")
BLUE_TEXT = colors.HexColor("#2563eb")

# ─── Output path ─────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, "shiftfy-vs-clockin-pricing-report.pdf")

# ─── Styles ──────────────────────────────────────────────────
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
    "TableCell", parent=styles["Normal"],
    fontSize=9, leading=12, textColor=GRAY_700,
    fontName="Helvetica",
))
styles.add(ParagraphStyle(
    "TableCellBold", parent=styles["Normal"],
    fontSize=9, leading=12, textColor=DARK,
    fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "TableHeader", parent=styles["Normal"],
    fontSize=9, leading=12, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_CENTER,
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
styles.add(ParagraphStyle(
    "WinnerCell", parent=styles["Normal"],
    fontSize=9, leading=12, textColor=GREEN_TEXT,
    fontName="Helvetica-Bold", alignment=TA_CENTER,
))

# ─── Helpers ─────────────────────────────────────────────────

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

def make_table(data, col_widths=None, header_rows=1):
    """Create a styled table with emerald header."""
    t = Table(data, colWidths=col_widths, repeatRows=header_rows)
    style_cmds = [
        # Header
        ("BACKGROUND", (0, 0), (-1, header_rows - 1), EMERALD),
        ("TEXTCOLOR", (0, 0), (-1, header_rows - 1), WHITE),
        ("FONTNAME", (0, 0), (-1, header_rows - 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, header_rows - 1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, header_rows - 1), 8),
        ("TOPPADDING", (0, 0), (-1, header_rows - 1), 8),
        # Body
        ("FONTNAME", (0, header_rows), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, header_rows), (-1, -1), 9),
        ("TEXTCOLOR", (0, header_rows), (-1, -1), GRAY_700),
        ("BOTTOMPADDING", (0, header_rows), (-1, -1), 6),
        ("TOPPADDING", (0, header_rows), (-1, -1), 6),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_200),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # First column bold
        ("FONTNAME", (0, header_rows), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, header_rows), (0, -1), DARK),
    ]
    # Alternating row colours
    for i in range(header_rows, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), GRAY_50))
        else:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), WHITE))
    t.setStyle(TableStyle(style_cmds))
    return t

def callout_box(title, body_lines, bg=EMERALD_50, border=EMERALD):
    """A highlight callout box."""
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
    return Paragraph(f"• {text}", styles["BulletItem"])


# ═════════════════════════════════════════════════════════════
#  BUILD DOCUMENT
# ═════════════════════════════════════════════════════════════

def build():
    doc = SimpleDocTemplate(
        OUT_PATH,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title="Shiftfy vs Clockin — Pricing & Feature Analysis",
        author="Shiftfy GmbH",
    )

    story = []
    W = doc.width  # usable width

    # ─────────────────────────────────────────────────────────
    # COVER
    # ─────────────────────────────────────────────────────────
    story.append(spacer(20))
    story.append(Paragraph("Shiftfy vs Clockin", styles["CoverTitle"]))
    story.append(Paragraph("Competitive Pricing &amp; Feature Analysis", styles["CoverSub"]))
    story.append(spacer(6))
    story.append(Paragraph(
        f"Prepared by Shiftfy · {date.today().strftime('%B %d, %Y')} · Confidential",
        styles["SmallGray"],
    ))
    story.append(spacer(10))
    story.append(hr())

    # Quick stats row
    stats_data = [
        ["", "Shiftfy", "Clockin"],
        ["Pricing model", "Pure per-user\n(no base fee)", "Pure per-user\n(no base fee)"],
        ["Entry price", "€2.99/user/mo", "€3.99/user/mo"],
        ["Shift planning", "Included in every plan", "Add-on €24/mo"],
        ["Annual discount", "Up to 20%", "Up to 20% (24 months)"],
        ["Free trial", "14 days", "14 days"],
        ["Target market", "German SMBs", "German SMBs\n(Handwerk, Pflege)"],
    ]
    stats_table = make_table(stats_data, col_widths=[45 * mm, 52 * mm, 52 * mm])
    story.append(stats_table)
    story.append(spacer(10))

    story.append(callout_box(
        "💡 Key Takeaway",
        [
            "Shiftfy is <b>25–29% cheaper</b> than Clockin at every tier, "
            "while <b>including shift planning for free</b> — a feature Clockin charges €24/month extra for. "
            "This makes Shiftfy the clear price-performance leader for shift-based businesses."
        ],
    ))

    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────
    # 1. COMPANY PROFILES
    # ─────────────────────────────────────────────────────────
    story.append(heading("1. Company Profiles"))

    profiles = [
        ["", "Shiftfy", "Clockin"],
        ["Focus", "Shift planning, time tracking,\nworkforce management", "Time tracking,\nproject documentation"],
        ["Market", "German SMBs (Mittelstand)", "German SMBs — Handwerk,\nPflege, Produktion"],
        ["Customers", "Early-stage", "8,000+ companies"],
        ["Credentials", "DSGVO-konform\nMade in Germany", "OMR Leader Badge\nDATEV Partner\nMade in Germany"],
        ["Billing model", "Pure per-user (no base fee)", "Pure per-user (no base fee)"],
        ["Contract terms", "Monthly or annual", "1, 12, or 24 months"],
    ]
    story.append(make_table(profiles, col_widths=[40 * mm, 55 * mm, 55 * mm]))

    # ─────────────────────────────────────────────────────────
    # 2. PRICING COMPARISON
    # ─────────────────────────────────────────────────────────
    story.append(heading("2. Pricing Comparison"))

    story.append(subheading("2.1 Clockin Plans (per user, no base fee)"))
    clockin_data = [
        ["Plan", "Monthly", "12 months", "24 months (−20%)"],
        ["Digitale Stechuhr", "€3.99/user", "€3.59/user", "€3.19/user"],
        ["Projektzeiterfassung", "€6.99/user", "€6.29/user", "€5.59/user"],
        ["Zeiterfassung &\nDokumentation", "€9.99/user", "€8.99/user", "€7.99/user"],
    ]
    story.append(make_table(clockin_data, col_widths=[42 * mm, 35 * mm, 35 * mm, 42 * mm]))
    story.append(spacer(4))
    story.append(p("<b>Clockin Add-ons (flat fees):</b> Schichtplanung ab €24/mo · "
                    "Videodokumentation ab €79/mo · Gesprächsnotizen ab €49/mo · "
                    "Telefonassistent ab €99/mo"))

    story.append(spacer(6))
    story.append(subheading("2.2 Shiftfy Plans (per user, no base fee)"))
    shiftfy_data = [
        ["Plan", "Monthly", "Annual (savings)"],
        ["Basic", "€2.99/user", "€2.49/user (−17%)"],
        ["Professional", "€4.99/user", "€3.99/user (−20%)"],
        ["Enterprise", "€7.99/user", "€6.49/user (−19%)"],
    ]
    story.append(make_table(shiftfy_data, col_widths=[42 * mm, 42 * mm, 52 * mm]))
    story.append(spacer(4))
    story.append(p("<b>No add-ons needed:</b> Shift planning, team chat, absence management, "
                    "and time tracking are included in every Shiftfy plan at no extra cost."))

    # ─────────────────────────────────────────────────────────
    # 3. HEAD-TO-HEAD PRICE COMPARISON
    # ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(heading("3. Head-to-Head Price Comparison"))
    story.append(p("All prices are monthly per-user rates. Green = cheaper option."))

    story.append(subheading("3.1 Tier-by-Tier (Monthly Billing)"))
    tier_data = [
        ["Tier", "Shiftfy", "Clockin", "Shiftfy Savings"],
        ["Entry / Basic", "€2.99", "€3.99", "−25% ✓"],
        ["Mid / Professional", "€4.99", "€6.99", "−29% ✓"],
        ["Top / Enterprise", "€7.99", "€9.99", "−20% ✓"],
    ]
    t = make_table(tier_data, col_widths=[38 * mm, 32 * mm, 32 * mm, 38 * mm])
    # Highlight savings column
    t.setStyle(TableStyle([
        ("TEXTCOLOR", (3, 1), (3, -1), GREEN_TEXT),
        ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
    ]))
    story.append(t)

    story.append(spacer(8))
    story.append(subheading("3.2 Total Monthly Cost by Team Size (Basic tier)"))
    story.append(p("Clockin Basic (Digitale Stechuhr) vs Shiftfy Basic — monthly billing."))

    team_sizes = [1, 3, 5, 10, 15, 20, 30, 50, 100]
    team_data = [["Team Size", "Shiftfy Basic", "Clockin Stechuhr", "Δ (Savings)"]]
    for n in team_sizes:
        s = n * 2.99
        c = n * 3.99
        delta = ((c - s) / c) * 100
        team_data.append([
            f"{n} users",
            f"€{s:,.2f}",
            f"€{c:,.2f}",
            f"−{delta:.0f}% (€{c - s:,.2f})",
        ])
    story.append(make_table(team_data, col_widths=[28 * mm, 35 * mm, 38 * mm, 40 * mm]))

    story.append(spacer(8))
    story.append(subheading("3.3 Fair Comparison: Shiftfy Basic vs Clockin + Schichtplanung Add-on"))
    story.append(p("Since Clockin charges <b>€24/mo extra</b> for shift planning, "
                    "the fair comparison adds that to Clockin's cost:"))

    addon_data = [["Team Size", "Shiftfy Basic", "Clockin + Schichtplanung", "Δ (Savings)"]]
    for n in [1, 5, 10, 20, 50, 100]:
        s = n * 2.99
        c = n * 3.99 + 24.0
        delta = ((c - s) / c) * 100
        addon_data.append([
            f"{n} users",
            f"€{s:,.2f}",
            f"€{c:,.2f}",
            f"−{delta:.0f}% ✓",
        ])
    t2 = make_table(addon_data, col_widths=[28 * mm, 35 * mm, 45 * mm, 35 * mm])
    t2.setStyle(TableStyle([
        ("TEXTCOLOR", (3, 1), (3, -1), GREEN_TEXT),
        ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
    ]))
    story.append(t2)

    story.append(spacer(6))
    story.append(callout_box(
        "🏆 Shiftfy wins at EVERY team size",
        [
            "When shift planning is required, Shiftfy is <b>47–89% cheaper</b> "
            "than Clockin for teams of 1–100 users, because shift scheduling "
            "is included at no extra cost."
        ],
    ))

    # ─────────────────────────────────────────────────────────
    # 4. FEATURE COMPARISON
    # ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(heading("4. Feature Comparison Matrix"))
    story.append(p("✅ = Included · ❌ = Not available · 💰 = Paid add-on"))

    YES = "✅"
    NO = "❌"
    PAID = "💰"

    features = [
        ["Feature", "Shiftfy Basic", "Shiftfy Pro", "Shiftfy Ent.", "Clockin"],
        ["Shift Planning", YES, YES, YES, f"{PAID} €24/mo"],
        ["Time Tracking", YES, YES, YES, YES],
        ["Absence Mgmt", YES, YES, YES, f"{YES} (basic)"],
        ["Team Chat", YES, YES, YES, NO],
        ["Auto-Scheduling", NO, YES, YES, NO],
        ["DATEV Export", NO, YES, YES, YES],
        ["E-Signatures", NO, YES, YES, f"{YES} (Tier 3)"],
        ["Custom Roles", NO, YES, YES, NO],
        ["API & Webhooks", NO, YES, YES, NO],
        ["Analytics", NO, YES, YES, NO],
        ["Priority Support", NO, YES, YES, NO],
        ["SSO / SAML", NO, NO, YES, NO],
        ["SLA Guarantee", NO, NO, YES, NO],
        ["Project Time", NO, NO, NO, f"{YES} (Tier 2+)"],
        ["Photo/Video Docs", NO, NO, NO, f"{YES} (Tier 3)"],
        ["Checklists/Forms", NO, NO, NO, f"{YES} (Tier 3)"],
        ["Lexware Integration", NO, NO, NO, f"{YES} (Tier 2+)"],
        ["SAP / Personio", NO, NO, NO, YES],
        ["Multi-location", "1", "10", "Unlimited", "N/A"],
        ["Max employees", "15", "100", "Unlimited", "Unlimited"],
    ]
    ft = make_table(features, col_widths=[35 * mm, 28 * mm, 28 * mm, 28 * mm, 32 * mm])
    story.append(ft)

    # ─────────────────────────────────────────────────────────
    # 5. COMPETITIVE ADVANTAGES
    # ─────────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(heading("5. Competitive Advantages"))

    story.append(subheading("5.1 Shiftfy's Advantages"))
    for item in [
        "<b>25–29% cheaper</b> than Clockin at every comparable tier",
        "<b>Shift planning included</b> in every plan — Clockin charges €24/mo extra",
        "<b>Team chat built-in</b> — Clockin has no messaging feature",
        "<b>Auto-scheduling (Pro)</b> — AI-powered shift generation, no Clockin equivalent",
        "<b>Custom roles &amp; API/webhooks (Pro)</b> — Developer-friendly, no Clockin equivalent",
        "<b>Analytics dashboard (Pro)</b> — Visual insights not available in Clockin",
        "<b>Annual discount on 12-month term</b> — Clockin requires 24 months for same discount",
    ]:
        story.append(bullet(item))

    story.append(spacer(6))
    story.append(subheading("5.2 Clockin's Advantages"))
    for item in [
        "<b>Brand credibility</b> — 8,000+ customers, OMR Leader Badge, established DATEV Partner",
        "<b>More integrations</b> — Lexware, SAP, Personio, Sage in addition to DATEV",
        "<b>Project documentation</b> — Photos, videos, checklists, forms (construction/trades)",
        "<b>Broader industry focus</b> — Handwerk, Pflege, Produktion verticals",
        "<b>No employee cap per tier</b> — Pure pay-per-user scaling at any size",
        "<b>24-month lock-in discount</b> — Deeper savings for committed customers",
    ]:
        story.append(bullet(item))

    # ─────────────────────────────────────────────────────────
    # 6. STRATEGIC POSITIONING
    # ─────────────────────────────────────────────────────────
    story.append(spacer(8))
    story.append(heading("6. Strategic Positioning"))

    story.append(p(
        "Shiftfy occupies a distinct competitive position: <b>the most affordable "
        "all-in-one shift planning + time tracking solution</b> on the German market. "
        "While Clockin leads in project documentation (photos, checklists, forms) for trades, "
        "Shiftfy wins on price and features for any business where shift scheduling is the "
        "primary need."
    ))

    story.append(spacer(6))
    story.append(subheading("Recommended Marketing Angles"))
    for item in [
        '<b>"Schichtplanung inklusive — ohne Aufpreis"</b> — Highlight that competitors charge extra for shift planning',
        '<b>"Ab 2,99 € pro Nutzer"</b> — Lead with the lowest entry price on the market',
        '<b>"Keine Grundgebühr, keine versteckten Kosten"</b> — Simple, transparent pricing',
        '<b>"Wechseln und sofort sparen"</b> — Direct switch-from-competitor messaging',
        '<b>"14 Tage kostenlos — alle Funktionen"</b> — Full-feature trial removes risk',
    ]:
        story.append(bullet(item))

    # ─────────────────────────────────────────────────────────
    # 7. ANNUAL REVENUE PROJECTIONS
    # ─────────────────────────────────────────────────────────
    story.append(spacer(8))
    story.append(heading("7. Revenue Scenarios (New Pricing)"))
    story.append(p("Projected monthly recurring revenue (MRR) at different customer milestones, "
                    "assuming 80% Basic / 15% Professional / 5% Enterprise mix, "
                    "average 12 users per workspace, monthly billing."))

    rev_data = [["Workspaces", "Avg Users", "MRR", "ARR"]]
    for ws in [50, 100, 250, 500, 1000]:
        users_per = 12
        basic_rev = ws * 0.80 * users_per * 2.99
        pro_rev = ws * 0.15 * users_per * 4.99
        ent_rev = ws * 0.05 * users_per * 7.99
        mrr = basic_rev + pro_rev + ent_rev
        arr = mrr * 12
        rev_data.append([
            f"{ws:,}",
            f"{ws * users_per:,}",
            f"€{mrr:,.0f}",
            f"€{arr:,.0f}",
        ])
    story.append(make_table(rev_data, col_widths=[32 * mm, 32 * mm, 40 * mm, 45 * mm]))

    # ─────────────────────────────────────────────────────────
    # FOOTER / DISCLAIMER
    # ─────────────────────────────────────────────────────────
    story.append(spacer(16))
    story.append(hr())
    story.append(p(
        f"<i>Report generated on {date.today().strftime('%B %d, %Y')}. "
        "Clockin pricing sourced from clockin.de/preise. "
        "Shiftfy pricing from src/lib/stripe.ts. "
        "All prices exclude VAT. Subject to change.</i>",
        "SmallGray",
    ))
    story.append(p("<i>© 2026 Shiftfy GmbH — Confidential</i>", "SmallGray"))

    # ── Build ────────────────────────────────────────────────
    doc.build(story)
    print(f"\n✅ Report generated: {OUT_PATH}")
    print(f"   File size: {os.path.getsize(OUT_PATH) / 1024:.1f} KB")


if __name__ == "__main__":
    build()
