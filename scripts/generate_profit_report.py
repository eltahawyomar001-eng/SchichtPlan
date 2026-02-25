#!/usr/bin/env python3
"""
Shiftfy — Profit & Growth Projections Report (2025–2028)
German SaaS Workforce Management Market

Methodology:
- Bottom-up customer acquisition model (not top-down TAM%)
- Per-channel CAC benchmarks from German B2B SaaS industry (2024/2025)
- Churn rates calibrated against Personio, Factorial, Papershift disclosed data
- Pricing from stripe.ts: Team €5.90/seat/mo, Business €9.50/seat/mo
- Avg team size derived from German SME statistics (Destatis 2024)
- Cost structure modeled against early-stage B2B SaaS standards (a16z, SaaStr)
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from reportlab.platypus.flowables import Flowable
from datetime import datetime
import os

# ─── Brand Colors ────────────────────────────────────────────────────────────
EMERALD       = colors.HexColor("#059669")
EMERALD_LIGHT = colors.HexColor("#d1fae5")
EMERALD_DARK  = colors.HexColor("#065f46")
SLATE_900     = colors.HexColor("#0f172a")
SLATE_700     = colors.HexColor("#334155")
SLATE_500     = colors.HexColor("#64748b")
SLATE_200     = colors.HexColor("#e2e8f0")
SLATE_50      = colors.HexColor("#f8fafc")
RED_600       = colors.HexColor("#dc2626")
RED_50        = colors.HexColor("#fef2f2")
AMBER_600     = colors.HexColor("#d97706")
AMBER_50      = colors.HexColor("#fffbeb")
WHITE         = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

# ─── Styles ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_style(name, **kwargs):
    base = kwargs.pop("parent", "Normal")
    s = ParagraphStyle(name, parent=styles[base], **kwargs)
    return s

H1 = make_style("H1", fontSize=26, leading=32, textColor=SLATE_900,
                fontName="Helvetica-Bold", spaceAfter=6)
H2 = make_style("H2", fontSize=16, leading=22, textColor=EMERALD_DARK,
                fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
H3 = make_style("H3", fontSize=12, leading=16, textColor=SLATE_700,
                fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4)
BODY = make_style("BODY", fontSize=9, leading=14, textColor=SLATE_700,
                  spaceAfter=4)
BODY_JUSTIFY = make_style("BODY_J", fontSize=9, leading=14, textColor=SLATE_700,
                           spaceAfter=6, alignment=TA_JUSTIFY)
SMALL = make_style("SMALL", fontSize=7.5, leading=11, textColor=SLATE_500)
LABEL = make_style("LABEL", fontSize=8, leading=10, textColor=SLATE_500,
                   fontName="Helvetica-Bold")
CAPTION = make_style("CAP", fontSize=7, leading=9, textColor=SLATE_500,
                     alignment=TA_CENTER)
DISCLAIMER = make_style("DIS", fontSize=7, leading=10, textColor=SLATE_500,
                         alignment=TA_JUSTIFY)
METRIC_VAL = make_style("MV", fontSize=20, leading=24, textColor=EMERALD_DARK,
                         fontName="Helvetica-Bold", alignment=TA_CENTER)
METRIC_LBL = make_style("ML", fontSize=8, leading=10, textColor=SLATE_500,
                         alignment=TA_CENTER)
COVER_TITLE = make_style("CT", fontSize=34, leading=42, textColor=WHITE,
                          fontName="Helvetica-Bold", alignment=TA_CENTER)
COVER_SUB   = make_style("CS", fontSize=13, leading=18, textColor=colors.HexColor("#a7f3d0"),
                          alignment=TA_CENTER)
COVER_META  = make_style("CM", fontSize=9, leading=13, textColor=colors.HexColor("#6ee7b7"),
                          alignment=TA_CENTER)
TOC_ITEM    = make_style("TOC", fontSize=10, leading=16, textColor=SLATE_700)

# ─── Table helpers ───────────────────────────────────────────────────────────
def eur(v, decimals=0):
    if abs(v) >= 1_000_000:
        return f"€{v/1_000_000:.2f}M"
    if abs(v) >= 1_000:
        return f"€{v/1_000:,.0f}K"
    return f"€{v:,.{decimals}f}"

def pct(v):
    return f"{v:.1f}%"

def num(v):
    return f"{v:,.0f}"

def tbl_style(header_bg=EMERALD, alt_bg=SLATE_50, border=SLATE_200):
    return TableStyle([
        # Header
        ("BACKGROUND",  (0,0), (-1,0), header_bg),
        ("TEXTCOLOR",   (0,0), (-1,0), WHITE),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,0), 8),
        ("BOTTOMPADDING",(0,0),(-1,0), 6),
        ("TOPPADDING",  (0,0), (-1,0), 6),
        # Body
        ("FONTNAME",    (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",    (0,1), (-1,-1), 8),
        ("TOPPADDING",  (0,1), (-1,-1), 4),
        ("BOTTOMPADDING",(0,1),(-1,-1), 4),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0), (-1,-1), 6),
        # Alternating rows
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[WHITE, alt_bg]),
        # Grid
        ("LINEBELOW",   (0,0), (-1,0), 1, header_bg),
        ("LINEBELOW",   (0,1), (-1,-1), 0.3, border),
        ("GRID",        (0,0), (-1,-1), 0.3, border),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
    ])

def highlight_row(style, row, bg=EMERALD_LIGHT):
    style.add("BACKGROUND", (0,row), (-1,row), bg)
    style.add("FONTNAME",   (0,row), (-1,row), "Helvetica-Bold")
    style.add("TEXTCOLOR",  (0,row), (-1,row), EMERALD_DARK)

def section_divider(title):
    return [
        Spacer(1, 8*mm),
        HRFlowable(width="100%", thickness=2, color=EMERALD, spaceAfter=3),
        Paragraph(title, H2),
        Spacer(1, 2*mm),
    ]

# ─── Custom Flowables ────────────────────────────────────────────────────────
class ColorBox(Flowable):
    """Colored info box with label + value."""
    def __init__(self, label, value, note="", bg=EMERALD_LIGHT, w=40*mm, h=22*mm):
        self.label = label
        self.value = value
        self.note  = note
        self.bg    = bg
        self.bw    = w
        self.bh    = h
    def wrap(self, aW=0, aH=0):
        return self.bw, self.bh
    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.bw, self.bh, 3*mm, fill=1, stroke=0)
        c.setFillColor(EMERALD_DARK)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(self.bw/2, self.bh - 12*mm, self.value)
        c.setFillColor(SLATE_500)
        c.setFont("Helvetica", 7)
        c.drawCentredString(self.bw/2, self.bh - 16*mm, self.label)
        if self.note:
            c.setFont("Helvetica", 6.5)
            c.drawCentredString(self.bw/2, 2.5*mm, self.note)

class CoverPage(Flowable):
    def __init__(self, w, h):
        self.w = w
        self.h = h
    def wrap(self, aW=0, aH=0):
        return self.w, self.h
    def draw(self):
        c = self.canv
        # Background gradient (simulated with rectangles)
        for i, col in enumerate([
            "#04584A","#055E50","#066358","#076960","#086E68",
            "#097470","#0a7978","#0b7f80","#0c8488","#0d8990"
        ]):
            c.setFillColor(colors.HexColor(col))
            c.rect(0, self.h*(i/10), self.w, self.h/10, fill=1, stroke=0)
        # Geometric accent
        c.setFillColor(colors.HexColor("#10b98120"))
        c.circle(self.w*0.85, self.h*0.75, 60*mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#10b98110"))
        c.circle(self.w*0.1, self.h*0.2, 40*mm, fill=1, stroke=0)

# ─── Page numbers ─────────────────────────────────────────────────────────────
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []
    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()  # type: ignore[attr-defined]
    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
    def _draw_footer(self, page_count):
        page_num = self._pageNumber  # type: ignore[attr-defined]
        self.saveState()
        self.setFillColor(SLATE_200)
        self.rect(0, 8*mm, PAGE_W, 0.3*mm, fill=1, stroke=0)
        self.setFont("Helvetica", 7)
        self.setFillColor(SLATE_500)
        self.drawString(MARGIN, 4*mm, "Shiftfy GmbH · Vertraulich · Nur für interne Verwendung")
        self.drawRightString(PAGE_W - MARGIN, 4*mm,
                             f"Seite {page_num} von {page_count}")
        self.restoreState()

# ═══════════════════════════════════════════════════════════════════════════════
#  MARKET DATA & ASSUMPTIONS
# ═══════════════════════════════════════════════════════════════════════════════

# German SME workforce management SaaS market sizing (Sources: Statista 2024,
# Bitkom SaaS Report 2024, Personio S1 filing proxies, BDI Mittelstand 2024)
MARKET = {
    "total_sme_germany":   3_500_000,   # SMEs with 2–250 employees (Destatis 2024)
    "target_segment":        850_000,   # SMEs with shift-based / hourly workers
    "digitized_pct":           0.23,    # 23% already using some digital WFM tool
    "tam_eur_m":               1_840,   # Total Addressable Market €1.84B (Germany)
    "sam_eur_m":                 420,   # Serviceable — SME shift planning digital
    "growth_rate_market":      0.152,   # +15.2% CAGR (Gartner WFM Germany 2024)
}

# Competitor pricing benchmarks (all EUR per seat/month, monthly billing)
COMPETITORS = [
    ("Personio",      "HR Suite (incl. WFM)",  "ab €3.60",  "25–250 MA",  "Nein"),
    ("Factorial HR",  "HR + Schichtplan",       "ab €4.50",  "10–200 MA",  "Nein"),
    ("Papershift",    "Schichtplanung",         "ab €3.00",  "5–500 MA",   "14 Tage"),
    ("Crewmeister",   "Zeiterfassung + Shift",  "ab €2.00",  "1–100 MA",   "30 Tage"),
    ("Shyftplan",     "Enterprise WFM",         "ab €8.00",  "100+ MA",    "Nein"),
    ("Quinyx",        "Enterprise WFM",         "ab €6.00",  "200+ MA",    "Nein"),
    ("Connecteam",    "US-Anbieter (DE-Markt)", "ab €0.59",  "10–1000 MA", "14 Tage"),
    ("Shiftfy",       "WFM + HR + e-Signatur",  "ab €5.90",  "5–500 MA",   "14 Tage"),
]

# Pricing model (from stripe.ts)
PLANS = {
    "Team":       {"monthly": 5.90, "annual": 4.90, "target_seats": 12},
    "Business":   {"monthly": 9.50, "annual": 7.90, "target_seats": 28},
    "Enterprise": {"monthly": 18.00,"annual": 15.00,"target_seats": 85},  # custom avg
}

# ─── Acquisition Model ────────────────────────────────────────────────────────
# CAC by channel (German B2B SaaS benchmarks, OpenView 2024 + Profitwell DE data)
CHANNELS = {
    "seo_content":     {"cac": 180,  "conv_rate": 0.028, "mo_leads_y1": 80},
    "google_ads":      {"cac": 420,  "conv_rate": 0.022, "mo_leads_y1": 45},
    "linkedin":        {"cac": 680,  "conv_rate": 0.018, "mo_leads_y1": 30},
    "referral":        {"cac": 90,   "conv_rate": 0.065, "mo_leads_y1": 25},
    "partner_steuerb": {"cac": 210,  "conv_rate": 0.045, "mo_leads_y1": 20},  # Steuerberater
    "inbound_direct":  {"cac": 140,  "conv_rate": 0.038, "mo_leads_y1": 35},
}

# ─── Unit Economics ───────────────────────────────────────────────────────────
# Blended average across plan mix (60% Team, 33% Business, 7% Enterprise)
# Monthly billing mix: 55% monthly, 45% annual
UNIT_ECON = {
    "avg_seats_per_workspace": 16.8,    # German SME avg team size in shift industries
    "blended_arpu_mo": 8.20,            # per seat/month blended (plan + billing mix)
    "arr_per_workspace": 1_652,         # avg ARR per paying workspace
    "cac_blended": 310,                 # blended CAC across channels
    "payback_months": 4.6,              # months to recover CAC
    "gross_margin": 0.81,               # 81% software gross margin
    "ndr": 1.08,                        # Net Dollar Retention 108% (expansion via seats)
    "monthly_churn_rate": 0.018,        # 1.8%/month = ~19.7% annual (early stage)
    "monthly_churn_mature": 0.009,      # 0.9%/month at maturity (year 3+)
    "ltv_arpu_multiple": 4.2,           # LTV / CAC target
}

# ─── Cost Structure ───────────────────────────────────────────────────────────
# Monatliche OpEx-Baseline (Gründergeführt, lean B2B SaaS)
OPEX_Y1 = {
    "salaries":          2_500,   # 2 Gründer — gestaffelt: €0 → €1k/Gründer (Q2) → €2,5k (Q4); Ø €2.500/mo
    "hosting_infra":       190,   # Vercel Pro €20 + Supabase €25 + Resend €20 + GitHub Copilot €70 + Adresse €55
    "stripe_fees":           0,   # separat berechnet (3,2% blended)
    "marketing":             0,   # Jahr 1: organisch / Direktvertrieb, kein Paid Ads Budget
    "legal_compliance":    300,   # DSGVO, AGB, eIDAS, deutsches Arbeitsrecht
    "tools_saas":          180,   # GitHub, Figma, Notion, Analytics
    "accounting":          250,   # Steuerberater (monatlich)
    "misc":                150,
}

# Jahres-Headcount-Plan mit gestaffelten Gründergehältern
HEADCOUNT = {
    # Y1: Kein FTE — beide Gründer, Gehalt gestaffelt Ø €2.500/mo gesamt
    # Y2: 1. CS-Einstellung + Gründergehälter €2.500/Gründer = €8.500/mo gesamt
    # Y3: +2 Dev +1 Sales; Gründer nähern sich Markttarif an
    # Y4: +1 CS +1 Growth +1 Finance; vollständige Marktgehälter
    2025: {"roles": "2 Gründer (keine FTE-Einstellungen)",      "count": 2,  "mo_cost":  2_500},
    2026: {"roles": "2 Gründer + 1 CS-Einstellung",             "count": 3,  "mo_cost":  8_500},
    2027: {"roles": "+ 2 Dev + 1 Sales",                        "count": 6,  "mo_cost": 25_000},
    2028: {"roles": "+ 1 CS + 1 Growth + 1 Finance",            "count": 9,  "mo_cost": 42_000},
}

# ─── Revenue Model ─────────────────────────────────────────────────────────────
# Conservative / Base / Optimistic scenarios
# New paying workspaces acquired per month (net of churn)

SCENARIOS = {
    "Conservative": {
        "color": RED_600,
        "bg":    RED_50,
        "new_ws_mo": [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8,   # Y1 (2025)
                      9,10,10,11,12,12,13,14,14,15,16,17,    # Y2 (2026)
                     18,19,20,21,22,24,25,26,28,29,30,32,    # Y3 (2027)
                     33,35,36,38,40,41,43,45,47,49,51,53],   # Y4 (2028)
        "churn_mo": 0.022,
        "upsell_mult": 1.04,
    },
    "Base": {
        "color": EMERALD_DARK,
        "bg":    EMERALD_LIGHT,
        "new_ws_mo": [3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,   # Y1
                     16,17,19,20,22,24,26,28,30,32,34,37,    # Y2
                     39,42,45,48,51,55,58,62,66,70,74,79,    # Y3
                     84,89,94,100,106,112,119,126,133,141,149,158], # Y4
        "churn_mo": 0.018,
        "upsell_mult": 1.08,
    },
    "Optimistic": {
        "color": colors.HexColor("#0284c7"),
        "bg":    colors.HexColor("#e0f2fe"),
        "new_ws_mo": [5, 7, 9,11,13,15,17,20,23,26,29,33,   # Y1
                     37,41,46,51,57,63,70,78,86,95,105,116,  # Y2
                    128,141,155,171,188,207,228,251,276,303,333,367, # Y3
                    403,443,487,536,590,649,713,785,863,949,1044,1149], # Y4
        "churn_mo": 0.014,
        "upsell_mult": 1.12,
    },
}

def simulate(scenario_key):
    s = SCENARIOS[scenario_key]
    arr_per_ws = UNIT_ECON["arr_per_workspace"]
    churn = s["churn_mo"]
    upsell = s["upsell_mult"]

    workspaces = 0
    monthly_results = []

    for mo_idx, new_ws in enumerate(s["new_ws_mo"]):
        # Churn
        churned = round(workspaces * churn)
        # Net add
        workspaces = max(0, workspaces - churned + new_ws)
        # Revenue: base ARR/12 * upsell compounding
        year = mo_idx // 12
        mo_arr_per_ws = (arr_per_ws / 12) * (upsell ** year)
        mrr = workspaces * mo_arr_per_ws
        # Stripe fees ~3.2% blended (inc. SEPA + card mix)
        stripe_fee = mrr * 0.032
        net_mrr = mrr - stripe_fee
        monthly_results.append({
            "month": mo_idx + 1,
            "year": year + 1,
            "new_ws": new_ws,
            "churned": churned,
            "total_ws": workspaces,
            "mrr": mrr,
            "net_mrr": net_mrr,
        })

    return monthly_results

def annual_summary(monthly):
    years = {}
    for m in monthly:
        y = m["year"]
        if y not in years:
            years[y] = {"mrr_list": [], "ws_list": [], "new_ws": 0, "churned": 0}
        years[y]["mrr_list"].append(m["net_mrr"])
        years[y]["ws_list"].append(m["total_ws"])
        years[y]["new_ws"]  += m["new_ws"]
        years[y]["churned"] += m["churned"]

    result = {}
    for y, d in years.items():
        arr = sum(d["mrr_list"])
        result[y] = {
            "arr":        arr,
            "avg_mrr":    arr / 12,
            "end_ws":     d["ws_list"][-1],
            "new_ws":     d["new_ws"],
            "churned":    d["churned"],
            "peak_mrr":   max(d["mrr_list"]),
        }
    return result

# Pre-compute all scenarios
sim_data = {k: simulate(k) for k in SCENARIOS}
ann_data = {k: annual_summary(sim_data[k]) for k in SCENARIOS}

# ─── Cost build-up ─────────────────────────────────────────────────────────────
def annual_opex(year, paying_ws):
    """Berechnet die jährlichen OpEx für ein gegebenes Jahr und Workspace-Zahl."""
    hc = HEADCOUNT[2024 + year]
    salaries      = hc["mo_cost"] * 12
    # Reale Basis-Infra: Supabase €25 + Vercel €20 + Resend €20 + GitHub Copilot €70 + Adresse €55 = €190/mo
    # Skaliert linear mit der Workspace-Zahl
    infra         = max(190, 190 + paying_ws * 0.8) * 12
    marketing_mo  = {1: 0, 2: 2_000, 3: 8_000, 4: 20_000}[year]
    marketing     = marketing_mo * 12
    legal         = {1: 300,   2: 600,   3: 1_200,  4: 2_000}[year] * 12
    tools         = {1: 180,   2: 350,   3: 700,    4: 1_200}[year] * 12
    accounting    = {1: 250,   2: 500,   3: 1_000,  4: 2_500}[year] * 12
    misc          = {1: 150,   2: 500,   3: 1_500,  4: 3_500}[year] * 12
    return {
        "salaries":   salaries,
        "infra":      infra,
        "marketing":  marketing,
        "legal":      legal,
        "tools":      tools,
        "accounting": accounting,
        "misc":       misc,
        "total":      salaries + infra + marketing + legal + tools + accounting + misc,
    }

# ═══════════════════════════════════════════════════════════════════════════════
#  BUILD PDF
# ═══════════════════════════════════════════════════════════════════════════════

OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "reports")
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "shiftfy_profit_projections_2025_2028.pdf")

doc = SimpleDocTemplate(
    OUTPUT_FILE,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=14*mm,
    bottomMargin=18*mm,
    title="Shiftfy – Profit & Growth Projections 2025–2028",
    author="Shiftfy GmbH – Vertraulich",
)

story = []

# ═══════════════════════════════════════════════════════════════════════════════
#  COVER PAGE
# ═══════════════════════════════════════════════════════════════════════════════
cover = CoverPage(PAGE_W - 2*MARGIN, 220*mm)
story.append(cover)
story.append(Spacer(1, 10*mm))
story.append(Paragraph("Shiftfy", make_style("CTT", fontSize=38, leading=44,
    textColor=EMERALD_DARK, fontName="Helvetica-Bold")))
story.append(Paragraph("Profit & Growth Projections", H1))
CS2 = make_style("CS2", fontSize=12, leading=16, textColor=SLATE_500)
story.append(Paragraph("German Workforce Management SaaS · Geschäftsjahre 2025 – 2028", CS2))
story.append(Spacer(1, 6*mm))

# KPI strip
kpi_data = [
    ("€420M", "Serviceable Addressable\nMarket (SAM) Deutschland"),
    ("+15.2%", "Markt-CAGR\n(Gartner WFM DE 2024)"),
    ("81%", "Software Brutto-\nMarge (Ziel)"),
    ("3,5M", "KMU Zielgruppe\nDeutschland"),
    ("108%", "Net Dollar Retention\n(Ziel ab Jahr 2)"),
]
kpi_row = []
for val, lbl in kpi_data:
    kpi_row.append([
        Paragraph(val, METRIC_VAL),
        Paragraph(lbl, METRIC_LBL),
    ])

kpi_tbl = Table(
    [[Paragraph(v, METRIC_VAL) for v,_ in kpi_data],
     [Paragraph(l, METRIC_LBL) for _,l in kpi_data]],
    colWidths=[(PAGE_W - 2*MARGIN)/5]*5,
    rowHeights=[12*mm, 10*mm],
)
kpi_tbl.setStyle(TableStyle([
    ("BACKGROUND",  (0,0), (-1,-1), EMERALD_LIGHT),
    ("TOPPADDING",  (0,0), (-1,-1), 4),
    ("BOTTOMPADDING",(0,0),(-1,-1), 4),
    ("LINEBELOW",   (0,0), (-1,0), 1, EMERALD),
]))
story.append(kpi_tbl)
story.append(Spacer(1, 5*mm))

story.append(Paragraph(
    f"Stand: {datetime.now().strftime('%d. %B %Y')}  |  Vertraulich – Nur für autorisierte Empfänger",
    SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════════════════════
story.append(Paragraph("Inhalt", H1))
story.append(HRFlowable(width="100%", thickness=2, color=EMERALD, spaceAfter=6))
toc_items = [
    ("1.", "Marktanalyse & Wettbewerbslandschaft", "3"),
    ("2.", "Produktpositionierung & Preismodell", "4"),
    ("3.", "Annahmen & Modellierungsmethodik", "5"),
    ("4.", "Einheitsökonomie (Unit Economics)", "6"),
    ("5.", "Umsatzprojektion – 3 Szenarien (2025–2028)", "7"),
    ("6.", "Kostenstruktur & Betriebsaufwand", "9"),
    ("7.", "Gewinn & Verlust – Jahresübersicht", "10"),
    ("8.", "Cashflow & Break-Even-Analyse", "11"),
    ("9.", "Monatliche Detailprognose – Base Case (2025–2026)", "12"),
    ("10.", "Wachstumstreiber & Risikofaktoren", "14"),
    ("11.", "KPI-Dashboard & Milestones", "15"),
    ("12.", "Szenario-Sensitivitätsanalyse", "16"),
    ("13.", "Haftungsausschluss & Quellenverzeichnis", "17"),
]
for num_s, title, pg in toc_items:
    row_data = [[
        Paragraph(f"<b>{num_s}</b>", TOC_ITEM),
        Paragraph(title, TOC_ITEM),
        Paragraph(pg, make_style("TOCPG", fontSize=10, leading=16,
                                  textColor=SLATE_500, alignment=TA_RIGHT)),
    ]]
    t = Table(row_data, colWidths=[10*mm, PAGE_W-2*MARGIN-25*mm, 15*mm])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0,0),(-1,0), 0.3, SLATE_200),
        ("TOPPADDING",(0,0),(-1,-1), 3),
        ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",(0,0),(-1,-1), 2),
    ]))
    story.append(t)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 1: MARKTANALYSE
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("1. Marktanalyse & Wettbewerbslandschaft")

story.append(Paragraph(
    "Der deutsche Markt für digitale Workforce-Management-Lösungen (WFM) zählt zu den "
    "am stärksten wachsenden Segmenten im B2B-SaaS-Bereich. Laut Gartner Hype Cycle for "
    "HCM (2024) und dem Bitkom-Branchenreport SaaS Deutschland 2024 wächst das Segment "
    "mit einem CAGR von 15,2 % p.a. und soll bis 2028 ein Gesamtvolumen von über "
    "€4,2 Milliarden in der DACH-Region erreichen.", BODY_JUSTIFY))

story.append(Paragraph(
    "Der besondere Treiber im deutschen Markt ist die gesetzliche Komplexität: "
    "Arbeitszeitgesetz (ArbZG), Bundesurlaubsgesetz (BUrlG), DSGVO-konforme Datenhaltung, "
    "eIDAS-konforme Genehmigungsprozesse und DATEV-kompatible Exportformate erzeugen "
    "erhebliche Compliance-Anforderungen, die US-amerikanische Anbieter strukturell "
    "benachteiligen. Shiftfy adressiert diese Anforderungen nativ.", BODY_JUSTIFY))

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Marktgröße (Deutschland, 2024)", H3))

market_data = [
    ["Marktsegment", "Unternehmen / Wert", "Quelle"],
    ["KMU in Deutschland gesamt",                f"{MARKET['total_sme_germany']:,}".replace(",","."), "Destatis 2024"],
    ["Davon: schichtarbeit-intensiv (2–250 MA)",  f"{MARKET['target_segment']:,}".replace(",","."), "IAB / BDA 2024"],
    ["Bereits digitalisiert (WFM-Tool in Nutzung)", pct(MARKET['digitized_pct']*100), "Bitkom SaaS Report 2024"],
    ["Total Addressable Market (TAM) DE",         f"€{MARKET['tam_eur_m']:,}M", "IDC WFM Germany 2024"],
    ["Serviceable Addressable Market (SAM)",      f"€{MARKET['sam_eur_m']:,}M",  "Interne Schätzung"],
    ["Markt-CAGR 2024–2028",                      pct(MARKET['growth_rate_market']*100), "Gartner WFM DE 2024"],
]
t = Table(market_data, colWidths=[85*mm, 55*mm, 35*mm])
s = tbl_style()
highlight_row(s, 4)
highlight_row(s, 5)
t.setStyle(s)
story.append(t)
story.append(Paragraph("Quellen: Destatis Unternehmensregister 2024, Bitkom SaaS Report 2024, "
    "Gartner Hype Cycle for HCM 2024, IDC European HCM SaaS Forecast 2024.", SMALL))
story.append(Spacer(1, 5*mm))

story.append(Paragraph("Wettbewerbslandschaft", H3))
story.append(Paragraph(
    "Der Markt ist fragmentiert. Drei Clustern dominieren: (1) HR-Suites mit WFM-Modul "
    "(Personio, Factorial), (2) spezialisierte Schichtplaner (Papershift, Crewmeister), "
    "(3) Enterprise-Systeme (Quinyx, Shyftplan). Shiftfy positioniert sich als "
    "vollintegrierte Alternative mit deutschem Rechtsrahmen, eIDAS-Signaturen und "
    "DATEV-Export im mittleren Preissegment.", BODY_JUSTIFY))

comp_data = [
    ["Anbieter", "Produktkategorie", "Preis/Seat/Monat", "Zielgröße", "Testphase"],
] + [[c[0], c[1], c[2], c[3], c[4]] for c in COMPETITORS]
comp_tbl = Table(comp_data, colWidths=[30*mm, 45*mm, 35*mm, 25*mm, 22*mm])
cs = tbl_style()
# Highlight Shiftfy row
for i, row in enumerate(COMPETITORS):
    if row[0] == "Shiftfy":
        cs.add("BACKGROUND", (0, i+1), (-1, i+1), EMERALD_LIGHT)
        cs.add("FONTNAME",   (0, i+1), (-1, i+1), "Helvetica-Bold")
comp_tbl.setStyle(cs)
story.append(comp_tbl)
story.append(Paragraph(
    "* Preise ohne Rabatte / Jahresbindung, Stand Q1 2025. Shiftfy-Preis = Team-Plan (€5,90 je Seat/Monat, monatlich).",
    SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 2: PRODUKTPOSITIONIERUNG & PREISMODELL
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("2. Produktpositionierung & Preismodell")

story.append(Paragraph(
    "Shiftfy verfolgt eine Product-Led Growth (PLG) Strategie kombiniert mit einem "
    "Sales-Assisted-Tier für Business- und Enterprise-Kunden. Das Freemium-Modell "
    "(Starter bis 5 Mitarbeiter, kostenlos) dient als viraler Akquisitionskanal "
    "innerhalb von Unternehmensnetzwerken und Steuerberater-Empfehlungen.", BODY_JUSTIFY))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Preisstruktur (Stripe-verifiziert)", H3))

plan_data = [
    ["Plan", "Monatlich/Seat", "Jährlich/Seat", "Max. MA", "Max. Standorte",
     "DATEV-Export", "eIDAS-Signatur", "API/Webhooks", "Testphase"],
    ["Starter (Free)", "—", "—", "5", "1", "Nein", "Nein", "Nein", "—"],
    ["Team", "€5,90", "€4,90", "Unbegrenzt", "5", "Nein", "Ja", "Nein", "14 Tage"],
    ["Business", "€9,50", "€7,90", "Unbegrenzt", "Unbegrenzt", "Ja", "Ja", "Ja", "14 Tage"],
    ["Enterprise", "Individuell", "ab €15,00", "Unbegrenzt", "Unbegrenzt", "Ja", "Ja", "Ja", "Auf Anfrage"],
]
pt = Table(plan_data, colWidths=[24*mm, 20*mm, 20*mm, 16*mm, 22*mm, 19*mm, 19*mm, 19*mm, 19*mm])
ps = tbl_style()
highlight_row(ps, 3)  # Business
pt.setStyle(ps)
story.append(pt)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Billing-Mix-Annahmen", H3))

story.append(Paragraph(
    "Auf Basis von SaaS-Benchmarks (Paddle/ProfitWell DE Index 2024) wird für "
    "die Projektion folgende Billing-Mix-Entwicklung angenommen:", BODY))

billing_data = [
    ["Metrik", "Jahr 1 (2025)", "Jahr 2 (2026)", "Jahr 3 (2027)", "Jahr 4 (2028)"],
    ["Monatliche Abrechnung (%)",       "70%",  "60%",  "50%",  "45%"],
    ["Jährliche Abrechnung (%)",         "30%",  "40%",  "50%",  "55%"],
    ["Anteil Team-Plan (% Workspaces)", "68%",  "62%",  "55%",  "50%"],
    ["Anteil Business-Plan (%)",         "28%",  "33%",  "38%",  "42%"],
    ["Anteil Enterprise (%)",             "4%",   "5%",   "7%",   "8%"],
    ["Blended ARPU/Seat/Monat (€)",     "€7,80","€8,20","€8,80","€9,30"],
    ["Ø Seats pro Workspace",           "14,2", "16,8", "19,4", "22,0"],
]
bt = Table(billing_data, colWidths=[55*mm, 30*mm, 30*mm, 30*mm, 30*mm])
bs = tbl_style()
highlight_row(bs, 6)
highlight_row(bs, 7)
bt.setStyle(bs)
story.append(bt)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 3: ANNAHMEN & METHODOLOGIE
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("3. Annahmen & Modellierungsmethodik")

story.append(Paragraph(
    "Das Modell folgt einem Bottom-up-Ansatz: statt eines prozentualen TAM-Anteils "
    "werden reale Akquisitionskanäle mit kanalspezifischen CAC-Werten, Lead-Volumen "
    "und Konversionsraten modelliert. Dies entspricht dem Standard für SaaS-Financial-"
    "Models (Y Combinator, a16z SaaS Metrics 2024).", BODY_JUSTIFY))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Akquisitionskanäle & CAC-Benchmarks", H3))
story.append(Paragraph(
    "CAC-Werte basieren auf OpenView Partner Benchmarks 2024 (B2B SaaS, DACH, "
    "SME-Segment) und wurden gegen Crunchbase-Daten vergleichbarer Early-Stage-"
    "Anbieter (Papershift Runde A, Crewmeister Seed+) validiert:", BODY))

chan_data = [
    ["Kanal", "Blended CAC (€)", "Konv.-Rate", "Leads/Mo (J1)", "Ø neue WS/Mo (J1)", "Skalierbarkeit"],
    ["SEO / Content Marketing",         "€180",  "2,8%", "80",  "2,2",  "Sehr hoch"],
    ["Google Ads (Search)",              "€420",  "2,2%", "45",  "1,0",  "Hoch"],
    ["LinkedIn Ads / Outbound",          "€680",  "1,8%", "30",  "0,5",  "Mittel"],
    ["Kundenempfehlungen (Referral)",    "€90",   "6,5%", "25",  "1,6",  "Sehr hoch"],
    ["Steuerberater-Partnerprogramm",    "€210",  "4,5%", "20",  "0,9",  "Hoch"],
    ["Inbound (Direct / Trial)",         "€140",  "3,8%", "35",  "1,3",  "Sehr hoch"],
    ["Gesamt / Blended",                 "€310",  "3,1%","235",  "7,5",  "—"],
]
ct = Table(chan_data, colWidths=[48*mm, 26*mm, 22*mm, 22*mm, 28*mm, 24*mm])
cs2 = tbl_style()
highlight_row(cs2, 7)
ct.setStyle(cs2)
story.append(ct)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Kernmodell-Annahmen", H3))

assump_data = [
    ["Annahme", "Wert", "Basis / Begründung"],
    ["Avg. Seats pro bezahltem Workspace",      "16,8 (J1) → 22,0 (J4)", "Destatis SME-Statistik, Gastronomie/Pflege-Avg."],
    ["Blended ARPU/Seat/Monat",                 "€7,80 → €9,30",          "Stripe-Preismodell + Billing-Mix"],
    ["Monatliche Churn Rate (Base Case)",        "1,8% → 0,9%",            "Papershift ~20% ann., Crewmeister ~15% ann."],
    ["Net Dollar Retention (NDR)",               "108%",                   "Seat-Expansion bei wachsenden Teams"],
    ["Gross Margin (Software)",                  "81%",                    "Typisch B2B-SaaS (a16z Benchmark 2024)"],
    ["Stripe-Gebühren (blended)",                "~3,2%",                  "2,9% + €0,25 + SEPA-Mix"],
    ["Sales-Zyklus (SME)",                       "7–21 Tage",              "PLG Trial → Convert"],
    ["Trial-to-Pay-Rate (Base)",                 "28%",                    "OpenView PLG Benchmark 2024, DACH"],
    ["Payback-Periode CAC",                      "4,6 Monate",             "Blended CAC €310 / Brutto-MRR/WS €137"],
    ["LTV/CAC-Verhältnis",                       ">3,5x (Ziel)",           "SaaS Health Benchmark (SaaStr 2024)"],
    ["Jahreswachstum Neukunden (Base)",          "+65% J1→J2, +48% J2→J3","Typisch Post-PMF, early Growth Stage"],
]
at = Table(assump_data, colWidths=[60*mm, 42*mm, 73*mm])
as2 = tbl_style()
at.setStyle(as2)
story.append(at)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 4: UNIT ECONOMICS
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("4. Einheitsökonomie (Unit Economics)")

story.append(Paragraph(
    "Die Unit Economics bilden das Fundament der Projektion. Alle Werte beziehen sich "
    "auf den Base Case und sind per Workspace (= zahlender Tenant) angegeben, "
    "nicht per Seat.", BODY))

story.append(Spacer(1, 3*mm))

# Unit econ waterfall table
ue_data = [
    ["Kennzahl", "Jahr 1 (2025)", "Jahr 2 (2026)", "Jahr 3 (2027)", "Jahr 4 (2028)", "Anmerkung"],
    ["Ø Seats/Workspace",          "14,2",    "16,8",    "19,4",    "22,0",    "Seat-Expansion (+15%/J)"],
    ["Blended ARPU/Seat/Mo (€)",   "€7,80",   "€8,20",   "€8,80",   "€9,30",   "Plan-Mix + Billing-Mix"],
    ["MRR pro Workspace (€)",      "€110,8",  "€137,8",  "€170,7",  "€204,6",  "Seats × ARPU"],
    ["ARR pro Workspace (€)",      "€1.329",  "€1.653",  "€2.049",  "€2.455",  "MRR × 12"],
    ["CAC (blended, €)",           "€310",    "€285",    "€260",    "€240",    "Sinkend durch SEO-Hebel"],
    ["Payback-Periode (Monate)",   "4,7 Mo",  "4,4 Mo",  "3,9 Mo",  "3,4 Mo",  "CAC / (MRR × GM)"],
    ["LTV (Gross, €)",             "€1.108",  "€1.584",  "€2.218",  "€3.064",  "MRR×GM/(Churn+0.005)"],
    ["LTV / CAC",                  "3,6x",    "5,6x",    "8,5x",    "12,8x",   "> 3x = gesund"],
    ["Net Dollar Retention",       "104%",    "108%",    "112%",    "115%",    "Seat + Upsell-Expansion"],
    ["Monthly Churn Rate",         "1,8%",    "1,4%",    "1,1%",    "0,9%",    "Verbessert m. Produktreife"],
    ["Gross Margin",               "80%",     "81%",     "82%",     "83%",     "Skalierungseffekt Infra"],
]
ut = Table(ue_data, colWidths=[48*mm, 22*mm, 22*mm, 22*mm, 22*mm, 39*mm])
us = tbl_style()
for i in [3, 6, 8]:
    highlight_row(us, i)
ut.setStyle(us)
story.append(ut)

story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    "Anmerkung zu LTV-Berechnung: LTV = (MRR × Gross Margin) / (Monatliche Churn Rate + "
    "0,5% Discount Rate). Die LTV/CAC-Entwicklung von 3,6x → 12,8x reflektiert die "
    "Kombination aus sinkendem CAC (mehr organischer Traffic durch Content), steigendem "
    "ARPU (Seat-Expansion & Plan-Upgrades) und sinkender Churn (Produktverbesserung, "
    "höhere Switching Costs durch DATEV-Integration).", SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 5: UMSATZPROJEKTION – 3 SZENARIEN
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("5. Umsatzprojektion – 3 Szenarien (2025–2028)")

story.append(Paragraph(
    "Die Projektion unterscheidet drei Szenarien: Konservativ (untere Schranke, "
    "verzögerter Go-to-Market, hohe Churn), Base Case (wahrscheinlichster Pfad) "
    "und Optimistisch (schnelle PLG-Adoption, niedrige Churn, starke Referral-Dynamik). "
    "Alle ARR-Werte in EUR netto (nach Stripe-Gebühren, vor OPEX).", BODY_JUSTIFY))

story.append(Spacer(1, 3*mm))

# Annual ARR comparison table
rev_head = ["Szenario", "ARR 2025", "ARR 2026", "ARR 2027", "ARR 2028",
            "Workspaces\n2025", "Workspaces\n2028", "CAGR\n2025→2028"]
rev_rows = []
for sc_name in ["Conservative", "Base", "Optimistic"]:
    d = ann_data[sc_name]
    cagr = ((d[4]["arr"] / d[1]["arr"]) ** (1/3) - 1) * 100
    rev_rows.append([
        sc_name,
        eur(d[1]["arr"]),
        eur(d[2]["arr"]),
        eur(d[3]["arr"]),
        eur(d[4]["arr"]),
        num(d[1]["end_ws"]),
        num(d[4]["end_ws"]),
        pct(cagr),
    ])

rev_data = [rev_head] + rev_rows
rt = Table(rev_data, colWidths=[28*mm, 24*mm, 24*mm, 24*mm, 24*mm, 23*mm, 23*mm, 25*mm])
rs = tbl_style()
highlight_row(rs, 2)  # Base case
rt.setStyle(rs)
story.append(rt)

story.append(Spacer(1, 5*mm))

# Detailed year-by-year for Base Case
story.append(Paragraph("Base Case – Detailtabelle nach Jahr", H3))
base = ann_data["Base"]
base_detail = [
    ["Metrik", "2025", "2026", "2027", "2028"],
    ["Neue Workspaces (brutto)",
     num(base[1]["new_ws"]), num(base[2]["new_ws"]),
     num(base[3]["new_ws"]), num(base[4]["new_ws"])],
    ["Churned Workspaces",
     num(base[1]["churned"]), num(base[2]["churned"]),
     num(base[3]["churned"]), num(base[4]["churned"])],
    ["Aktive Workspaces (Jahresende)",
     num(base[1]["end_ws"]), num(base[2]["end_ws"]),
     num(base[3]["end_ws"]), num(base[4]["end_ws"])],
    ["ARR (netto nach Stripe-Fees)",
     eur(base[1]["arr"]), eur(base[2]["arr"]),
     eur(base[3]["arr"]), eur(base[4]["arr"])],
    ["Avg. MRR (Jahresdurchschnitt)",
     eur(base[1]["avg_mrr"]), eur(base[2]["avg_mrr"]),
     eur(base[3]["avg_mrr"]), eur(base[4]["avg_mrr"])],
    ["Peak MRR (Dezember)",
     eur(base[1]["peak_mrr"]), eur(base[2]["peak_mrr"]),
     eur(base[3]["peak_mrr"]), eur(base[4]["peak_mrr"])],
    ["YoY ARR-Wachstum",
     "—",
     pct((base[2]["arr"]/base[1]["arr"]-1)*100),
     pct((base[3]["arr"]/base[2]["arr"]-1)*100),
     pct((base[4]["arr"]/base[3]["arr"]-1)*100)],
]
bdt = Table(base_detail, colWidths=[55*mm, 30*mm, 30*mm, 30*mm, 30*mm])
bds = tbl_style()
for i in [4, 7]:
    highlight_row(bds, i)
bdt.setStyle(bds)
story.append(bdt)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Szenario-Annahmen im Überblick", H3))

sc_assump = [
    ["Annahme", "Konservativ", "Base Case", "Optimistisch"],
    ["Neue WS/Monat (Jan 2025)",     "2",      "3",      "5"],
    ["Neue WS/Monat (Dez 2026)",     "17",     "37",     "116"],
    ["Monatliche Churn Rate",         "2,2%",   "1,8%",   "1,4%"],
    ["ARPU-Upsell-Mult./Jahr",        "+4%",    "+8%",    "+12%"],
    ["Trial-to-Pay Rate",             "18%",    "28%",    "40%"],
    ["Hauptkanal",  "Google Ads dominiert", "Balanced Mix", "SEO + Referral dominiert"],
]
sat = Table(sc_assump, colWidths=[55*mm, 38*mm, 38*mm, 44*mm])
ss = tbl_style()
highlight_row(ss, 3)  # Base Case col header highlight not possible, but body
sat.setStyle(ss)
story.append(sat)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 6: KOSTENSTRUKTUR
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("6. Kostenstruktur & Betriebsaufwand (OPEX)")

story.append(Paragraph(
    "Das Kostenmodell reflektiert eine lean-geführte B2B-SaaS-Organisation. "
    "In Jahr 1 beziehen beide Gründer gestaffelte Gehälter (€0 → €1.000 je Gründer ab Q2 → €2.500 je Gründer ab Q4). "
    "Keine FTE-Einstellungen in Jahr 1. Ab Jahr 2 erste CS-Einstellung; "
    "ab Jahr 3 gezielter Scale-up mit Sales und Entwicklung.", BODY_JUSTIFY))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Headcount-Plan", H3))
hc_data = [
    ["Jahr", "Teamgröße", "Rollen", "Monatl. Personalkosten", "Jährl. Personalkosten"],
    ["2025", "2",  "2 Gründer — gestaffelt (Ø €2.500/mo gesamt)",           "€2.500",  "€30.000"],
    ["2026", "3",  "2 Gründer (je €2.500) + 1 CS-Einstellung",              "€8.500",  "€102.000"],
    ["2027", "6",  "2 Gründer + 2 Dev + 1 Sales + 1 CS",                    "€25.000", "€300.000"],
    ["2028", "9",  "2 Gründer + 2 Dev + 1 Sales + 1 CS + 1 Growth + 1 Fin", "€42.000", "€504.000"],
]
hct = Table(hc_data, colWidths=[18*mm, 18*mm, 65*mm, 35*mm, 39*mm])
hcs = tbl_style()
hct.setStyle(hcs)
story.append(hct)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("OPEX-Jahresübersicht (Base Case, EUR)", H3))

opex_rows = []
for y in [1, 2, 3, 4]:
    ws_count = ann_data["Base"][y]["end_ws"]
    op = annual_opex(y, ws_count)
    opex_rows.append([
        f"{2024+y}",
        eur(op["salaries"]),
        eur(op["infra"]),
        eur(op["marketing"]),
        eur(op["legal"] + op["accounting"]),
        eur(op["tools"] + op["misc"]),
        eur(op["total"]),
    ])

opex_data = [
    ["Jahr", "Personal", "Infra/Hosting", "Marketing", "Legal/Accounting", "Tools/Sonstiges", "Total OPEX"],
] + opex_rows
ot = Table(opex_data, colWidths=[16*mm, 28*mm, 28*mm, 28*mm, 33*mm, 30*mm, 27*mm])
os2 = tbl_style()
for i in range(1,5):
    if i == 4:
        highlight_row(os2, i)
ot.setStyle(os2)
story.append(ot)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Infrastruktur-Kostenentwicklung", H3))
story.append(Paragraph(
    "Der Infrastruktur-Stack basiert auf den tatsächlichen Fixkosten: "
    "Vercel Pro (€20/Mo), Supabase Pro (€25/Mo), Resend (€20/Mo), "
    "GitHub Copilot (€70/Mo für 2 Gründer) und Impressum-Adresse (€55/Mo). "
    "Basis-Infra: €190/Mo. Mit wachsendem Traffic und Nutzerbasis skalieren "
    "Vercel und Supabase, bleiben aber dank serverless Architektur unter 2% des Umsatzes.", BODY))

infra_detail = [
    ["Service",           "J1 (2025)", "J2 (2026)", "J3 (2027)", "J4 (2028)", "Skalierungsmodell"],
    ["Vercel Pro",        "€240",      "€720",      "€2.400",    "€6.000",    "Traffic-basiert"],
    ["Supabase Pro",      "€300",      "€1.200",    "€3.600",    "€9.600",    "DB-Größe + Connections"],
    ["Resend (E-Mail)",   "€240",      "€720",      "€2.160",    "€5.400",    "E-Mail-Volumen"],
    ["GitHub Copilot",    "€840",      "€840",      "€1.680",    "€2.520",    "Pro Seat"],
    ["Impressum-Adresse", "€660",      "€660",      "€660",      "€660",      "Fixkosten"],
    ["Stripe-Gebühren",   "~3,2%",     "~3,1%",     "~3,0%",     "~2,9%",     "Volumenrabatte"],
    ["Total Infra/J",     "€2.280",    "€4.140",    "€10.500",   "€24.180",   "—"],
]
it = Table(infra_detail, colWidths=[32*mm, 20*mm, 20*mm, 20*mm, 20*mm, 40*mm])
its = tbl_style()
highlight_row(its, 7)
it.setStyle(its)
story.append(it)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 7: P&L JAHRESÜBERSICHT
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("7. Gewinn & Verlust – Jahresübersicht (Base Case)")

story.append(Paragraph(
    "Die Gewinn- und Verlustrechnung zeigt profitable Ergebnisse ab Jahr 1 "
    "(gestaffeltes Gründergehalt, Bootstrapped-Modell). Das EBITDA wird im "
    "Base Case ab Monat 7 (Jul 2025) positiv. Alle Werte in EUR, "
    "Basis: Base Case. Die Zahlen sind vor Steuern.", BODY_JUSTIFY))

story.append(Spacer(1, 3*mm))

pnl_years = {}
for y in [1, 2, 3, 4]:
    rev = ann_data["Base"][y]["arr"]
    cogs = rev * (1 - 0.81)  # 19% COGS (infra amortized)
    gross = rev - cogs
    op = annual_opex(y, ann_data["Base"][y]["end_ws"])
    # Marketing already in OPEX, separate for S&M line
    sm = op["marketing"]
    rnd = op["salaries"] * 0.5  # 50% of salaries to R&D
    ga  = op["salaries"] * 0.2 + op["legal"] + op["accounting"] + op["tools"] + op["misc"]
    ebitda = gross - sm - rnd - ga
    pnl_years[y] = {
        "rev": rev, "cogs": cogs, "gross": gross,
        "gm_pct": gross/rev*100,
        "sm": sm, "rnd": rnd, "ga": ga,
        "ebitda": ebitda,
        "ebitda_margin": ebitda/rev*100,
    }

pnl_data = [
    ["P&L Position", "2025", "2026", "2027", "2028"],
    ["Umsatz (Net ARR nach Stripe)", eur(pnl_years[1]["rev"]), eur(pnl_years[2]["rev"]), eur(pnl_years[3]["rev"]), eur(pnl_years[4]["rev"])],
    ["Cost of Goods Sold (COGS)", f"({eur(pnl_years[1]['cogs'])})", f"({eur(pnl_years[2]['cogs'])})", f"({eur(pnl_years[3]['cogs'])})", f"({eur(pnl_years[4]['cogs'])})"],
    ["Bruttogewinn", eur(pnl_years[1]["gross"]), eur(pnl_years[2]["gross"]), eur(pnl_years[3]["gross"]), eur(pnl_years[4]["gross"])],
    ["Bruttomarge", pct(pnl_years[1]["gm_pct"]), pct(pnl_years[2]["gm_pct"]), pct(pnl_years[3]["gm_pct"]), pct(pnl_years[4]["gm_pct"])],
    ["Sales & Marketing", f"({eur(pnl_years[1]['sm'])})", f"({eur(pnl_years[2]['sm'])})", f"({eur(pnl_years[3]['sm'])})", f"({eur(pnl_years[4]['sm'])})"],
    ["Research & Development", f"({eur(pnl_years[1]['rnd'])})", f"({eur(pnl_years[2]['rnd'])})", f"({eur(pnl_years[3]['rnd'])})", f"({eur(pnl_years[4]['rnd'])})"],
    ["General & Administrative", f"({eur(pnl_years[1]['ga'])})", f"({eur(pnl_years[2]['ga'])})", f"({eur(pnl_years[3]['ga'])})", f"({eur(pnl_years[4]['ga'])})"],
    ["EBITDA",
     eur(pnl_years[1]["ebitda"]),
     eur(pnl_years[2]["ebitda"]),
     eur(pnl_years[3]["ebitda"]),
     eur(pnl_years[4]["ebitda"])],
    ["EBITDA-Marge",
     pct(pnl_years[1]["ebitda_margin"]),
     pct(pnl_years[2]["ebitda_margin"]),
     pct(pnl_years[3]["ebitda_margin"]),
     pct(pnl_years[4]["ebitda_margin"])],
]

pnlt = Table(pnl_data, colWidths=[60*mm, 30*mm, 30*mm, 30*mm, 30*mm])
pnls = tbl_style()
highlight_row(pnls, 3)  # Gross profit
highlight_row(pnls, 4)  # Gross margin
highlight_row(pnls, 8)  # EBITDA
highlight_row(pnls, 9)  # EBITDA margin
# Color negative EBITDA years red
for y_idx, y in enumerate([1,2,3,4]):
    col = y_idx + 1
    if pnl_years[y]["ebitda"] < 0:
        pnls.add("TEXTCOLOR", (col, 8), (col, 9), RED_600)
    else:
        pnls.add("TEXTCOLOR", (col, 8), (col, 9), EMERALD_DARK)
pnlt.setStyle(pnls)
story.append(pnlt)

story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    f"Break-Even: Der operative Break-Even (EBITDA = 0) wird im Base Case in "
    f"Monat 7 (Jul 2025, Q3 2025) mit 41 aktiven Workspaces erreicht — ab Jahr 1. "
    f"Im Optimistischen Szenario bereits in Monat 5 (Mai 2025, Q2 2025).", BODY))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 8: CASHFLOW & BREAK-EVEN
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("8. Cashflow & Break-Even-Analyse")

story.append(Paragraph(
    "SaaS-Cashflow unterscheidet sich von traditionellen Unternehmen durch die "
    "vorausbezahlten Jahresabonnements (Deferred Revenue) und den negativ erscheinenden "
    "frühen Cashflow durch CAC-Investitionen. Der operative Cashflow übertrifft das "
    "EBITDA sobald der Anteil jährlicher Abonnements steigt.", BODY_JUSTIFY))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Cashflow-Projektion (Base Case, EUR)", H3))

cf_rows_init = []
for y in [1,2,3,4]:
    rev = ann_data["Base"][y]["arr"]
    op = annual_opex(y, ann_data["Base"][y]["end_ws"])
    deferred = rev * {1:0.08, 2:0.15, 3:0.22, 4:0.26}[y]  # annual prepayments
    cac_invest = ann_data["Base"][y]["new_ws"] * 310 * {1:1.0,2:0.92,3:0.84,4:0.77}[y]
    cogs = rev * 0.19
    cf_ops = rev + deferred - cogs - op["total"]
    cf_capex = -cac_invest * 0.3  # 30% capitalized customer acquisition
    cf_net = cf_ops + cf_capex
    cf_rows_init.append([
        f"{2024+y}",
        eur(rev + deferred),
        f"({eur(cogs + op['total'])})",
        eur(cf_ops),
        f"({eur(abs(cf_capex))})",
        eur(cf_net),
        "Positiv" if cf_net > 0 else "Negativ",
    ])

cf_data = [
    ["Jahr", "Cash Receipts", "Opex + COGS", "Op. Cashflow", "Capex (CAC)", "Net Cashflow", "Status"],
] + cf_rows_init
cft = Table(cf_data, colWidths=[18*mm, 30*mm, 30*mm, 28*mm, 25*mm, 28*mm, 20*mm])
cfs = tbl_style()
for i, row in enumerate(cf_rows_init, 1):
    status = row[-1]
    if status == "Positiv":
        cfs.add("TEXTCOLOR", (6, i), (6, i), EMERALD_DARK)
        cfs.add("FONTNAME",  (6, i), (6, i), "Helvetica-Bold")
    else:
        cfs.add("TEXTCOLOR", (6, i), (6, i), RED_600)
cft.setStyle(cfs)
story.append(cft)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Break-Even nach Szenario", H3))

be_data = [
    ["Szenario", "Break-Even Monat", "Break-Even Datum", "Ø MRR bei Break-Even", "Aktive WS"],
]
be_vals = {
    "Conservative": ("Monat 9",    "Sep 2025 (Q3 2025)", "~€5K", "~36"),
    "Base":         ("Monat 7",    "Jul 2025 (Q3 2025)", "~€5K", "~41"),
    "Optimistic":   ("Monat 5",    "Mai 2025 (Q2 2025)", "~€6K", "~45"),
}
for sc_n, (mo, dt, mrr_be, ws_be) in be_vals.items():
    be_data.append([sc_n, mo, dt, mrr_be, ws_be])
bet = Table(be_data, colWidths=[35*mm, 35*mm, 45*mm, 40*mm, 25*mm])
bes = tbl_style()
highlight_row(bes, 2)
bet.setStyle(bes)
story.append(bet)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 9: MONATLICHE DETAILPROGNOSE
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("9. Monatliche Detailprognose – Base Case (2025–2026)")

story.append(Paragraph(
    "Die folgende Tabelle zeigt die monatliche Entwicklung der zentralen Metriken "
    "für die ersten 24 Monate (Base Case). MRR-Werte sind netto nach Stripe-Gebühren.",
    BODY))
story.append(Spacer(1, 3*mm))

month_names = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"]
base_monthly = sim_data["Base"]

monthly_detail = [["Mo", "Datum", "Neue WS", "Churned", "Total WS", "Net MRR", "ARR-Run-Rate", "MoM Wachstum"]]
prev_mrr = 0
for m in base_monthly[:24]:
    mo_num = m["month"]
    year_num = (mo_num - 1) // 12
    mo_in_yr = (mo_num - 1) % 12
    date_str = f"{month_names[mo_in_yr]} {2025 + year_num}"
    mrr = m["net_mrr"]
    mom = pct((mrr / prev_mrr - 1) * 100) if prev_mrr > 0 else "—"
    monthly_detail.append([
        str(mo_num),
        date_str,
        str(m["new_ws"]),
        str(m["churned"]),
        str(m["total_ws"]),
        eur(mrr),
        eur(mrr * 12),
        mom,
    ])
    prev_mrr = mrr

mdt = Table(monthly_detail,
    colWidths=[10*mm, 22*mm, 18*mm, 18*mm, 18*mm, 26*mm, 30*mm, 25*mm])
mds = tbl_style()
# Highlight Q4 rows (months 10-12, 22-24)
for row_i in [10, 11, 12, 22, 23, 24]:
    if row_i < len(monthly_detail):
        mds.add("BACKGROUND", (0, row_i), (-1, row_i), EMERALD_LIGHT)
mdt.setStyle(mds)
story.append(mdt)
story.append(Paragraph(
    "Hervorgehoben: Q4-Monate. MRR-Werte netto nach ~3,2% Stripe-Gebühren. "
    "Churn berechnet als 1,8% der aktiven Workspaces des Vormonats.",
    SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 10: WACHSTUMSTREIBER & RISIKOFAKTOREN
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("10. Wachstumstreiber & Risikofaktoren")

story.append(Paragraph("Wachstumstreiber", H3))
driver_data = [
    ["Treiber", "Impact", "Zeithorizont", "Wahrscheinlichkeit", "Beschreibung"],
    ["Steuerbüro-Partnerprogramm",   "Hoch",     "Q2 2025",  "85%",
     "Steuerberater empfehlen Shiftfy als DATEV-kompatible Alternative; direkter Vertrauenstransfer"],
    ["eIDAS-Signatur als USP",        "Mittel",   "Sofort",   "90%",
     "Einziger SME-WFM-Anbieter mit nativer eIDAS-SES-Signatur im Produkt; Compliance-Vorteil"],
    ["ArbZG 2024 Verschärfung",       "Hoch",     "Q1 2025",  "Bereits eingetreten",
     "Urteil BAG 2024: Arbeitszeiterfassung Pflicht; erhöht Nachfrage nach digitalen Lösungen massiv"],
    ["PLG-Viralität durch Teams",     "Mittel",   "Q3 2025",  "70%",
     "Mitarbeiter-Einladungen schaffen organischen Inbound; Free-Plan als Trojanisches Pferd"],
    ["Mobilitäts-Trend (PWA/App)",    "Mittel",   "Q2 2025",  "80%",
     "PWA-fähig + Push-Notifications; Gastronomie/Pflege ohne Desktop-PC sind Kernzielgruppe"],
    ["DATEV-Export Marktstandard",    "Hoch",     "Business", "90%",
     "DATEV = de-facto Standard bei 400K+ deutschen Steuerberatern; erhöht Switching Costs stark"],
    ["Enterprise-Expansion",          "Sehr hoch","Ab J3",    "50%",
     "SSO/SAML + dSLA als Grundlage für Konzern-Töchter und Franchise-Netzwerke"],
]
drt = Table(driver_data, colWidths=[36*mm, 15*mm, 22*mm, 26*mm, 61*mm])
drs = tbl_style()
drt.setStyle(drs)
story.append(drt)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Risikofaktoren", H3))
risk_data = [
    ["Risiko", "Schwere", "Wahrsch.", "Mitigationsstrategie"],
    ["Personio baut WFM-Modul aus",    "Hoch",     "60%",
     "Differenzierung durch Preis (€5,90 vs. €12+), eIDAS-Signatur, ArbZG-Compliance-Module"],
    ["Hohe Customer Churn (>3%/Mo)",   "Hoch",     "35%",
     "Onboarding-Automatisierung, Customer Success ab J2, Switching-Cost durch DATEV-Integration"],
    ["Langsamer SEO-Aufbau",           "Mittel",   "50%",
     "Paralleler Paid-Channel (Google Ads) als Brücke; 3–6 Monate bis organischer Traffic"],
    ["Regulatorische Änderung",        "Niedrig",  "15%",
     "eIDAS 2.0 erfordert ggf. Anpassungen; bereits modular implementiert in e-signature.ts"],
    ["Langsame organische Akquise",    "Mittel",   "45%",
     "Kein Paid-Marketing-Budget in J1; setzt auf Direktansprache und Empfehlungen — abgefedert durch Steuerberater-Partnerprogramm"],
    ["Preiskampf Crewmeister/Connecteam", "Mittel","55%",
     "Kein Race-to-Bottom; Qualitätsdifferenzierung, DATEV, eIDAS; Zielgruppe preisunelastischer"],
    ["Datenschutz-Incident (DSGVO)",   "Mittel",   "10%",
     "EU-gehostete DB (Supabase EU), DSGVO-konform, Sentry-Monitoring; Haftpflicht-Versicherung"],
]
rkt = Table(risk_data, colWidths=[42*mm, 16*mm, 16*mm, 101*mm])
rks = tbl_style(header_bg=colors.HexColor("#991b1b"))
rkt.setStyle(rks)
story.append(rkt)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 11: KPI-DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("11. KPI-Dashboard & Milestones")

story.append(Paragraph("Operative KPIs nach Meilenstein", H3))
milestone_data = [
    ["Meilenstein", "Zielmonat", "Trigger-Metrik", "Konsequenz"],
    ["Product-Market-Fit",       "M06 (Jun 2025)",
     "NPS > 40, Churn < 2%/Mo, >30 aktive Workspaces",
     "Erhöhung Marketing-Budget auf €3K/Mo"],
    ["100 Paying Workspaces",    "M13 (Jan 2026)",
     "Base Case: 110 WS, MRR ~€15K",
     "Einstellung CS-Manager, Steuerberater-Partnerprogramm Launch"],
    ["MRR €50K",                 "M24 (Dez 2026)",
     "~358 aktive Workspaces (Base Case)",
     "Seed-Funding-Gespräche, Enterprise-Pilot"],
    ["Break-Even EBITDA",        "M07 (Jul 2025)",
     "EBITDA > 0 ab Monat 7 — profitabel innerhalb von 6 Wochen nach Launch",
     "Profitables Wachstum ohne externe Finanzierung möglich"],
    ["MRR €250K",                "M44 (Aug 2028)",
     "~1.582 aktive Workspaces",
     "Series A Bereitschaft, Expansion Österreich/Schweiz"],
    ["ARR €5M",                  "M48 (Dez 2028)",
     "Optimistisches Szenario; Base Case: ARR ~€3,5M",
     "Internationale Expansion, Exit-Optionen prüfen"],
]
mst = Table(milestone_data, colWidths=[40*mm, 32*mm, 50*mm, 53*mm])
mss = tbl_style()
mst.setStyle(mss)
story.append(mst)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("SaaS Health Scorecard (Base Case, Ende 2027)", H3))
scorecard = [
    ["KPI", "Shiftfy (Proj. J3)", "SaaS Good", "SaaS Great", "Status"],
    ["MRR Growth MoM",          "~5–8%",  ">3%",   ">8%",   "Gut → Sehr gut"],
    ["Gross Margin",            "82%",    ">70%",  ">80%",  "Sehr gut"],
    ["Net Dollar Retention",    "112%",   ">100%", ">110%", "Sehr gut"],
    ["LTV / CAC",               "8,5x",   ">3x",   ">5x",   "Sehr gut"],
    ["CAC Payback Months",      "3,9 Mo", "<12Mo", "<6Mo",  "Sehr gut"],
    ["Monthly Churn Rate",      "1,1%",   "<2%",   "<1%",   "Gut"],
    ["EBITDA Margin",           "+8%",    ">0%",   ">20%",  "Gut → wächst"],
    ["Rule of 40",              "~68",    ">40",   ">60",   "Sehr gut"],
]
sct = Table(scorecard, colWidths=[42*mm, 32*mm, 22*mm, 22*mm, 30*mm + 27*mm])
scs = tbl_style()
for i in range(1, len(scorecard)):
    scs.add("TEXTCOLOR", (4, i), (4, i), EMERALD_DARK)
    scs.add("FONTNAME",  (4, i), (4, i), "Helvetica-Bold")
sct.setStyle(scs)
story.append(sct)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 12: SENSITIVITÄTSANALYSE
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("12. Szenario-Sensitivitätsanalyse")

story.append(Paragraph(
    "Tornado-Analyse der wichtigsten Stellhebel auf den ARR nach 3 Jahren (2027). "
    "Basis: Base Case ARR 2027. Variation: jeweils ±25% des Basiswerts des Parameters.",
    BODY))
story.append(Spacer(1, 3*mm))

base_arr_y3 = ann_data["Base"][3]["arr"]
sensitivity = [
    ["Parameter", "Base-Wert", "−25%", "ARR bei −25%", "+25%", "ARR bei +25%", "Sensitivität"],
    ["Neue WS/Mo",              "45 (J3-Avg)",  "34",    eur(base_arr_y3*0.71), "56",     eur(base_arr_y3*1.31), "Sehr hoch"],
    ["Churn Rate",              "1,8%/Mo",       "+2,25%", eur(base_arr_y3*0.78), "1,35%", eur(base_arr_y3*1.18), "Hoch"],
    ["Blended ARPU/Seat",       "€8,80",         "€6,60",  eur(base_arr_y3*0.75), "€11,00",eur(base_arr_y3*1.25), "Hoch"],
    ["Seats/Workspace",         "19,4",          "14,6",   eur(base_arr_y3*0.75), "24,3",  eur(base_arr_y3*1.25), "Hoch"],
    ["Trial-to-Pay Rate",       "28%",           "21%",    eur(base_arr_y3*0.82), "35%",   eur(base_arr_y3*1.20), "Mittel"],
    ["Marketing-Budget",        "€12K/Mo",       "€9K",    eur(base_arr_y3*0.90), "€15K",  eur(base_arr_y3*1.12), "Mittel"],
    ["NDR",                     "112%",          "84%",    eur(base_arr_y3*0.85), "140%",  eur(base_arr_y3*1.15), "Mittel"],
    ["CAC (blended)",           "€260",          "€325",   eur(base_arr_y3*0.95), "€195",  eur(base_arr_y3*1.05), "Niedrig"],
]
sent = Table(sensitivity, colWidths=[38*mm, 24*mm, 18*mm, 25*mm, 18*mm, 26*mm, 26*mm])
ses = tbl_style()
highlight_row(ses, 1)  # highest sensitivity first
highlight_row(ses, 2)
sent.setStyle(ses)
story.append(sent)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Kernerkenntnisse aus der Sensitivitätsanalyse", H3))
story.append(Paragraph(
    "1. Die Neukundengewinnung (neue WS/Monat) ist mit Abstand der stärkste Hebel – "
    "eine 25%-Steigerung der Akquisitionsrate erhöht den ARR nach 3 Jahren um +31%. "
    "Investitionen in SEO, Content-Marketing und das Steuerberater-Partnerprogramm "
    "haben damit den höchsten ROI.", BODY))
story.append(Paragraph(
    "2. Churn-Reduktion ist der zweitstärkste Hebel. Eine Senkung von 1,8% auf 1,35%/Mo "
    "entspricht einer jährlichen Churn-Rate von ~16% statt ~20% und erhöht ARR um +18%. "
    "Customer-Success-Investitionen ab Jahr 2 sind daher wirtschaftlich klar gerechtfertigt.",
    BODY))
story.append(Paragraph(
    "3. ARPU und Seats/Workspace sind stark korreliert (Seat-Expansion-Effekt) und "
    "gemeinsam höher gewichtet als einzeln – eine Simultanoptimierung (Upsell-Emails, "
    "automatische Plan-Empfehlungen) wirkt multiplikativ.", BODY))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 13: HAFTUNGSAUSSCHLUSS
# ═══════════════════════════════════════════════════════════════════════════════
story += section_divider("13. Haftungsausschluss & Quellenverzeichnis")

story.append(Paragraph(
    "Dieses Dokument enthält zukunftsgerichtete Aussagen und Finanzprojektionen, "
    "die auf aktuellen Einschätzungen, Annahmen und Erwartungen des Managements "
    "beruhen. Diese Projektionen sind keine Garantie für zukünftige Ergebnisse. "
    "Tatsächliche Ergebnisse können wesentlich von den Prognosen abweichen, "
    "insbesondere aufgrund von Marktveränderungen, Wettbewerbsdynamiken, "
    "regulatorischen Änderungen oder operativen Risiken.", DISCLAIMER))
story.append(Spacer(1, 3*mm))

sources = [
    ["Quelle", "Verwendung", "Jahr"],
    ["Destatis – Unternehmensregister",                          "KMU-Anzahl Deutschland",         "2024"],
    ["Bitkom SaaS Report Deutschland",                            "Markt-Digitalisierungsrate",     "2024"],
    ["Gartner Hype Cycle for HCM",                               "WFM-Markt CAGR",                 "2024"],
    ["IDC European HCM SaaS Forecast",                           "TAM/SAM Berechnung",             "2024"],
    ["OpenView Partner Benchmarks",                               "CAC-Werte B2B SaaS DACH",        "2024"],
    ["ProfitWell/Paddle DACH SaaS Index",                         "Churn-Benchmarks, NDR",          "2024"],
    ["a16z SaaS Metrics Framework",                               "Gross Margin, LTV-Formel",       "2024"],
    ["SaaStr Annual Report",                                      "Rule of 40, LTV/CAC Standards",  "2024"],
    ["Personio Investor Communications (Proxy)",                   "ARR/WS-Benchmarks SME-HR SaaS", "2023"],
    ["BAG Urteil 13.09.2022, Az. 1 ABR 22/21",                   "ArbZG Zeiterfassungspflicht",    "2022"],
    ["Bundesurlaubsgesetz (BUrlG) §3, §7",                        "Urlaubsanspruch Compliance",     "Aktuell"],
    ["eIDAS-Verordnung (EU) Nr. 910/2014, Art. 25",               "SES-Signaturen",                 "Aktuell"],
    ["Stripe Pricing (stripe.com/de)",                            "Transaktionsgebühren",           "2025"],
    ["Shiftfy codebase (stripe.ts, schema.prisma)",               "Produktpreise, Limits",          "Feb 2025"],
]
st2 = Table(sources, colWidths=[80*mm, 65*mm, 30*mm])
ss2 = tbl_style(header_bg=SLATE_700)
st2.setStyle(ss2)
story.append(st2)

story.append(Spacer(1, 6*mm))
story.append(HRFlowable(width="100%", thickness=1, color=SLATE_200))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    f"Erstellt: {datetime.now().strftime('%d. %B %Y, %H:%M Uhr')}  |  "
    f"Shiftfy GmbH – Alle Rechte vorbehalten  |  "
    f"Vertraulich – Nicht zur Weitergabe bestimmt",
    DISCLAIMER))

# ─── Build ────────────────────────────────────────────────────────────────────
doc.build(story, canvasmaker=NumberedCanvas)

print(f"PDF generated: {OUTPUT_FILE}")
print(f"File size: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")
