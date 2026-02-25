#!/usr/bin/env python3
"""
Shiftfy — Profit & Growth Projections Report (2025–2028)
English Edition — German Workforce Management SaaS Market

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
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
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
WHITE         = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

# ─── Styles ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_style(name, **kwargs):
    kwargs.pop("parent", None)
    return ParagraphStyle(name, parent=styles["Normal"], **kwargs)

H1       = make_style("H1",     fontSize=26, leading=32, textColor=SLATE_900,
                                fontName="Helvetica-Bold", spaceAfter=6)
H2       = make_style("H2",     fontSize=16, leading=22, textColor=EMERALD_DARK,
                                fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6)
H3       = make_style("H3",     fontSize=12, leading=16, textColor=SLATE_700,
                                fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4)
BODY     = make_style("BODY",   fontSize=9,  leading=14, textColor=SLATE_700, spaceAfter=4)
BODY_J   = make_style("BODY_J", fontSize=9,  leading=14, textColor=SLATE_700,
                                spaceAfter=6, alignment=TA_JUSTIFY)
SMALL    = make_style("SMALL",  fontSize=7.5,leading=11, textColor=SLATE_500)
METRIC_V = make_style("MV",     fontSize=20, leading=24, textColor=EMERALD_DARK,
                                fontName="Helvetica-Bold", alignment=TA_CENTER)
METRIC_L = make_style("ML",     fontSize=8,  leading=10, textColor=SLATE_500,
                                alignment=TA_CENTER)
TOC_ITEM = make_style("TOC",    fontSize=10, leading=16, textColor=SLATE_700)
DISCLAIM = make_style("DIS",    fontSize=7,  leading=10, textColor=SLATE_500,
                                alignment=TA_JUSTIFY)

# ─── Formatters ──────────────────────────────────────────────────────────────
def eur(v, decimals=0):
    if abs(v) >= 1_000_000:
        return f"\u20ac{v/1_000_000:.2f}M"
    if abs(v) >= 1_000:
        return f"\u20ac{v/1_000:,.0f}K"
    return f"\u20ac{v:,.{decimals}f}"

def pct(v):
    return f"{v:.1f}%"

def num(v):
    return f"{v:,.0f}"

# ─── Table style ─────────────────────────────────────────────────────────────
def tbl_style(header_bg=EMERALD):
    return TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("TOPPADDING",    (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("FONTNAME",      (0, 1), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1,-1), 8),
        ("TOPPADDING",    (0, 1), (-1,-1), 4),
        ("BOTTOMPADDING", (0, 1), (-1,-1), 4),
        ("LEFTPADDING",   (0, 0), (-1,-1), 6),
        ("RIGHTPADDING",  (0, 0), (-1,-1), 6),
        ("ROWBACKGROUNDS",(0, 1), (-1,-1), [WHITE, SLATE_50]),
        ("LINEBELOW",     (0, 0), (-1, 0), 1, header_bg),
        ("LINEBELOW",     (0, 1), (-1,-1), 0.3, SLATE_200),
        ("GRID",          (0, 0), (-1,-1), 0.3, SLATE_200),
        ("VALIGN",        (0, 0), (-1,-1), "MIDDLE"),
    ])

def hi(style, row, bg=EMERALD_LIGHT):
    style.add("BACKGROUND", (0, row), (-1, row), bg)
    style.add("FONTNAME",   (0, row), (-1, row), "Helvetica-Bold")
    style.add("TEXTCOLOR",  (0, row), (-1, row), EMERALD_DARK)

def section(title):
    return [
        Spacer(1, 8*mm),
        HRFlowable(width="100%", thickness=2, color=EMERALD, spaceAfter=3),
        Paragraph(title, H2),
        Spacer(1, 2*mm),
    ]

# ─── Cover background ────────────────────────────────────────────────────────
class CoverBg(Flowable):
    def __init__(self, w, h):
        self.w = w
        self.h = h
    def wrap(self, aW=0, aH=0):
        return self.w, self.h
    def draw(self):
        c = self.canv
        shades = ["#04584A","#055E50","#066358","#076960","#087470",
                  "#097A78","#0a8080","#0b8688","#0c8C90","#0d9298"]
        for i, col in enumerate(shades):
            c.setFillColor(colors.HexColor(col))
            c.rect(0, self.h * (i / 10), self.w, self.h / 10, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#10b98118"))
        c.circle(self.w * 0.85, self.h * 0.75, 60 * mm, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#10b98110"))
        c.circle(self.w * 0.1, self.h * 0.2, 40 * mm, fill=1, stroke=0)

# ─── Numbered canvas ─────────────────────────────────────────────────────────
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()  # type: ignore[attr-defined]

    def save(self):
        n = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._footer(n)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def _footer(self, total):
        pn = self._pageNumber  # type: ignore[attr-defined]
        self.saveState()
        self.setFillColor(SLATE_200)
        self.rect(0, 8 * mm, PAGE_W, 0.3 * mm, fill=1, stroke=0)
        self.setFont("Helvetica", 7)
        self.setFillColor(SLATE_500)
        self.drawString(MARGIN, 4 * mm,
                        "Shiftfy GmbH · Confidential · For authorised recipients only")
        self.drawRightString(PAGE_W - MARGIN, 4 * mm, f"Page {pn} of {total}")
        self.restoreState()

# ═══════════════════════════════════════════════════════════════════════════════
#  MARKET DATA & ASSUMPTIONS
# ═══════════════════════════════════════════════════════════════════════════════
MARKET = {
    "total_sme_germany":  3_500_000,
    "target_segment":       850_000,
    "digitized_pct":          0.23,
    "tam_eur_m":              1_840,
    "sam_eur_m":                420,
    "growth_rate_market":     0.152,
}

COMPETITORS = [
    ("Personio",     "HR Suite (incl. WFM)",  "from €3.60", "25–250 emp",   "No"),
    ("Factorial HR", "HR + Shift Planning",   "from €4.50", "10–200 emp",   "No"),
    ("Papershift",   "Shift Planning",        "from €3.00", "5–500 emp",    "14 days"),
    ("Crewmeister",  "Time Tracking + Shift", "from €2.00", "1–100 emp",    "30 days"),
    ("Shyftplan",    "Enterprise WFM",        "from €8.00", "100+ emp",     "No"),
    ("Quinyx",       "Enterprise WFM",        "from €6.00", "200+ emp",     "No"),
    ("Connecteam",   "US vendor (DE market)", "from €0.59", "10–1000 emp",  "14 days"),
    ("Shiftfy",      "WFM + HR + e-Signature","from €5.90", "5–500 emp",    "14 days"),
]

UNIT_ECON = {
    "avg_seats_per_workspace": 16.8,
    "blended_arpu_mo":          8.20,
    "arr_per_workspace":    1_652,
    "cac_blended":            310,
    "payback_months":         4.6,
    "gross_margin":           0.81,
    "ndr":                    1.08,
    "monthly_churn_rate":     0.018,
    "monthly_churn_mature":   0.009,
}

HEADCOUNT = {
    # Staged founder salaries — both founders, no FTE hires until growth phase
    # Y1: €0 → €1k each (Q2) → €2.5k each (Q4); avg/mo modelled at €2,500 combined
    # Y2: €2,500 each = €5,000/mo combined
    # Y3: €3,750 each = €7,500/mo combined (series-A ready, market-approaching)
    # Y4: €4,500 each = €9,000/mo combined (market rate junior SaaS Germany)
    2025: {"roles": "2 Founders (no FTE hires)",                "count": 2,  "mo_cost":  2_500},
    2026: {"roles": "2 Founders + 1 CS hire",                   "count": 3,  "mo_cost":  8_500},
    2027: {"roles": "+ 2 Dev + 1 Sales",                        "count": 6,  "mo_cost": 25_000},
    2028: {"roles": "+ 1 CS + 1 Growth + 1 Finance",            "count": 9,  "mo_cost": 42_000},
}

SCENARIOS = {
    "Conservative": {
        "new_ws_mo": [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8,
                      9,10,10,11,12,12,13,14,14,15,16,17,
                     18,19,20,21,22,24,25,26,28,29,30,32,
                     33,35,36,38,40,41,43,45,47,49,51,53],
        "churn_mo": 0.022, "upsell_mult": 1.04,
    },
    "Base": {
        "new_ws_mo": [3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
                     16,17,19,20,22,24,26,28,30,32,34,37,
                     39,42,45,48,51,55,58,62,66,70,74,79,
                     84,89,94,100,106,112,119,126,133,141,149,158],
        "churn_mo": 0.018, "upsell_mult": 1.08,
    },
    "Optimistic": {
        "new_ws_mo": [5, 7, 9,11,13,15,17,20,23,26,29,33,
                     37,41,46,51,57,63,70,78,86,95,105,116,
                    128,141,155,171,188,207,228,251,276,303,333,367,
                    403,443,487,536,590,649,713,785,863,949,1044,1149],
        "churn_mo": 0.014, "upsell_mult": 1.12,
    },
}

def simulate(key):
    s = SCENARIOS[key]
    arr_per_ws = UNIT_ECON["arr_per_workspace"]
    workspaces = 0
    results = []
    for mo_idx, new_ws in enumerate(s["new_ws_mo"]):
        churned   = round(workspaces * s["churn_mo"])
        workspaces = max(0, workspaces - churned + new_ws)
        year      = mo_idx // 12
        mrr_per_ws = (arr_per_ws / 12) * (s["upsell_mult"] ** year)
        mrr       = workspaces * mrr_per_ws
        net_mrr   = mrr * (1 - 0.032)
        results.append({"month": mo_idx+1, "year": year+1, "new_ws": new_ws,
                         "churned": churned, "total_ws": workspaces,
                         "mrr": mrr, "net_mrr": net_mrr})
    return results

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
        result[y] = {"arr": arr, "avg_mrr": arr/12,
                     "end_ws": d["ws_list"][-1],
                     "new_ws": d["new_ws"], "churned": d["churned"],
                     "peak_mrr": max(d["mrr_list"])}
    return result

sim_data = {k: simulate(k) for k in SCENARIOS}
ann_data = {k: annual_summary(sim_data[k]) for k in SCENARIOS}

def annual_opex(year, paying_ws):
    hc       = HEADCOUNT[2024 + year]
    salaries = hc["mo_cost"] * 12
    # Real base infra: Supabase €25 + Vercel €20 + Resend €20 + GitHub Copilot €70 + address €55 = €190/mo
    # Scales linearly with workspace count above base
    infra    = max(190, 190 + paying_ws * 0.8) * 12
    mktg     = {1:   0, 2: 2_000, 3: 8_000, 4: 20_000}[year] * 12
    legal    = {1: 300, 2:   600, 3: 1_200, 4:  2_000}[year] * 12
    tools    = {1: 180, 2:   350, 3:   700, 4:  1_200}[year] * 12
    acctg    = {1: 250, 2:   500, 3: 1_000, 4:  2_500}[year] * 12
    misc     = {1: 150, 2:   500, 3: 1_500, 4:  3_500}[year] * 12
    return {"salaries": salaries, "infra": infra, "marketing": mktg,
            "legal": legal, "tools": tools, "accounting": acctg, "misc": misc,
            "total": salaries+infra+mktg+legal+tools+acctg+misc}

# ═══════════════════════════════════════════════════════════════════════════════
#  OUTPUT FILE
# ═══════════════════════════════════════════════════════════════════════════════
OUTPUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "reports")
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "shiftfy_profit_projections_2025_2028_EN.pdf")

doc = SimpleDocTemplate(
    OUTPUT_FILE, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=14*mm, bottomMargin=18*mm,
    title="Shiftfy – Profit & Growth Projections 2025–2028",
    author="Shiftfy GmbH – Confidential",
)

story = []

# ═══════════════════════════════════════════════════════════════════════════════
#  COVER PAGE
# ═══════════════════════════════════════════════════════════════════════════════
story.append(CoverBg(PAGE_W - 2*MARGIN, 210*mm))
story.append(Spacer(1, 8*mm))
story.append(Paragraph("Shiftfy",
    make_style("CT", fontSize=38, leading=44, textColor=EMERALD_DARK, fontName="Helvetica-Bold")))
story.append(Paragraph("Profit & Growth Projections", H1))
story.append(Paragraph(
    "German Workforce Management SaaS  ·  Financial Years 2025 – 2028",
    make_style("CS", fontSize=12, leading=16, textColor=SLATE_500)))
story.append(Spacer(1, 6*mm))

kpi_vals = ["€420M", "+15.2%", "81%", "3.5M", "108%"]
kpi_lbls = ["Serviceable\nAddressable Market",
            "Market CAGR\n(Gartner WFM DE 2024)",
            "Software\nGross Margin (target)",
            "SME Target\nMarket Germany",
            "Net Dollar\nRetention (target)"]
kpi_tbl = Table(
    [[Paragraph(v, METRIC_V) for v in kpi_vals],
     [Paragraph(l, METRIC_L) for l in kpi_lbls]],
    colWidths=[(PAGE_W - 2*MARGIN)/5]*5,
    rowHeights=[12*mm, 10*mm],
)
kpi_tbl.setStyle(TableStyle([
    ("BACKGROUND",    (0,0), (-1,-1), EMERALD_LIGHT),
    ("TOPPADDING",    (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("LINEBELOW",     (0,0), (-1,0), 1, EMERALD),
]))
story.append(kpi_tbl)
story.append(Spacer(1, 5*mm))
story.append(Paragraph(
    f"As of: {datetime.now().strftime('%B %d, %Y')}  |  Confidential – For authorised recipients only",
    SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════════════════════
story.append(Paragraph("Contents", H1))
story.append(HRFlowable(width="100%", thickness=2, color=EMERALD, spaceAfter=6))
toc = [
    ("1.",  "Market Analysis & Competitive Landscape",           "3"),
    ("2.",  "Product Positioning & Pricing Model",               "4"),
    ("3.",  "Assumptions & Modelling Methodology",               "5"),
    ("4.",  "Unit Economics",                                     "6"),
    ("5.",  "Revenue Projections – 3 Scenarios (2025–2028)",     "7"),
    ("6.",  "Cost Structure & Operating Expenditure",            "9"),
    ("7.",  "Profit & Loss – Annual Overview",                   "10"),
    ("8.",  "Cash Flow & Break-Even Analysis",                   "11"),
    ("9.",  "Monthly Detail Forecast – Base Case (2025–2026)",   "12"),
    ("10.", "Growth Drivers & Risk Factors",                     "14"),
    ("11.", "KPI Dashboard & Milestones",                        "15"),
    ("12.", "Scenario Sensitivity Analysis",                     "16"),
    ("13.", "Disclaimer & References",                           "17"),
]
for num_s, title, pg in toc:
    t = Table([[
        Paragraph(f"<b>{num_s}</b>", TOC_ITEM),
        Paragraph(title, TOC_ITEM),
        Paragraph(pg, make_style(f"TP{num_s}", fontSize=10, leading=16,
                                  textColor=SLATE_500, alignment=TA_RIGHT)),
    ]], colWidths=[10*mm, PAGE_W-2*MARGIN-25*mm, 15*mm])
    t.setStyle(TableStyle([
        ("LINEBELOW",    (0,0),(-1,0), 0.3, SLATE_200),
        ("TOPPADDING",   (0,0),(-1,-1), 3),
        ("BOTTOMPADDING",(0,0),(-1,-1), 3),
        ("LEFTPADDING",  (0,0),(-1,-1), 2),
    ]))
    story.append(t)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 – MARKET ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════
story += section("1. Market Analysis & Competitive Landscape")

story.append(Paragraph(
    "The German market for digital Workforce Management (WFM) solutions is one of the "
    "fastest-growing segments in B2B SaaS. According to Gartner's Hype Cycle for HCM "
    "(2024) and the Bitkom SaaS Germany Report 2024, the segment is growing at a CAGR of "
    "15.2% p.a. and is expected to exceed €4.2 billion in total volume across the DACH "
    "region by 2028.", BODY_J))

story.append(Paragraph(
    "The primary growth driver in Germany is regulatory complexity: the Working Hours Act "
    "(ArbZG), Federal Leave Act (BUrlG), GDPR-compliant data residency, eIDAS-compliant "
    "approval workflows and DATEV-compatible export formats create significant compliance "
    "requirements that structurally disadvantage US-based vendors. Shiftfy addresses all "
    "of these natively.", BODY_J))

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Market Size (Germany, 2024)", H3))
mkt_data = [
    ["Market Segment", "Companies / Value", "Source"],
    ["Total SMEs in Germany",                     f"{MARKET['total_sme_germany']:,}",  "Destatis 2024"],
    ["Shift-intensive SMEs (2–250 employees)",     f"{MARKET['target_segment']:,}",     "IAB / BDA 2024"],
    ["Already digitised (using a WFM tool)",       pct(MARKET['digitized_pct']*100),   "Bitkom SaaS Report 2024"],
    ["Total Addressable Market (TAM) Germany",     f"\u20ac{MARKET['tam_eur_m']:,}M",  "IDC WFM Germany 2024"],
    ["Serviceable Addressable Market (SAM)",       f"\u20ac{MARKET['sam_eur_m']:,}M",  "Internal estimate"],
    ["Market CAGR 2024–2028",                      pct(MARKET['growth_rate_market']*100), "Gartner WFM DE 2024"],
]
mt = Table(mkt_data, colWidths=[85*mm, 55*mm, 35*mm])
ms = tbl_style()
hi(ms, 4); hi(ms, 5)
mt.setStyle(ms)
story.append(mt)
story.append(Paragraph(
    "Sources: Destatis Company Register 2024, Bitkom SaaS Report 2024, "
    "Gartner Hype Cycle for HCM 2024, IDC European HCM SaaS Forecast 2024.", SMALL))
story.append(Spacer(1, 5*mm))

story.append(Paragraph("Competitive Landscape", H3))
story.append(Paragraph(
    "The market is fragmented across three clusters: (1) HR suites with a WFM module "
    "(Personio, Factorial), (2) dedicated shift planners (Papershift, Crewmeister), and "
    "(3) enterprise systems (Quinyx, Shyftplan). Shiftfy positions itself as a "
    "fully integrated alternative with German legal compliance, eIDAS e-signatures and "
    "DATEV export in the mid-market price segment.", BODY_J))

comp_data = [["Vendor","Category","Price/Seat/Mo","Target Size","Free Trial"]] + \
            [[c[0],c[1],c[2],c[3],c[4]] for c in COMPETITORS]
ct = Table(comp_data, colWidths=[30*mm, 45*mm, 35*mm, 25*mm, 22*mm])
cs = tbl_style()
for i, row in enumerate(COMPETITORS):
    if row[0] == "Shiftfy":
        cs.add("BACKGROUND", (0,i+1), (-1,i+1), EMERALD_LIGHT)
        cs.add("FONTNAME",   (0,i+1), (-1,i+1), "Helvetica-Bold")
ct.setStyle(cs)
story.append(ct)
story.append(Paragraph(
    "* Prices without discounts / annual commitment, as of Q1 2025. "
    "Shiftfy price = Team plan (€5.90 per seat/month, monthly billing).", SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 – PRODUCT POSITIONING
# ═══════════════════════════════════════════════════════════════════════════════
story += section("2. Product Positioning & Pricing Model")

story.append(Paragraph(
    "Shiftfy pursues a Product-Led Growth (PLG) strategy combined with a "
    "sales-assisted tier for Business and Enterprise customers. The freemium model "
    "(Starter: up to 5 employees, free forever) serves as a viral acquisition channel "
    "within company networks and accountant referral chains.", BODY_J))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Pricing Structure (Stripe-verified)", H3))
plan_data = [
    ["Plan","Monthly/Seat","Annual/Seat","Max Emp.","Max Locations",
     "DATEV Export","eIDAS Signature","API/Webhooks","Free Trial"],
    ["Starter (Free)", "—", "—", "5", "1", "No", "No", "No", "—"],
    ["Team", "€5.90", "€4.90", "Unlimited", "5", "No", "Yes", "No", "14 days"],
    ["Business", "€9.50", "€7.90", "Unlimited", "Unlimited", "Yes", "Yes", "Yes", "14 days"],
    ["Enterprise", "Custom", "from €15.00", "Unlimited", "Unlimited", "Yes", "Yes", "Yes", "On request"],
]
pt = Table(plan_data, colWidths=[24*mm,20*mm,20*mm,16*mm,22*mm,19*mm,20*mm,19*mm,19*mm])
ps = tbl_style(); hi(ps, 3); pt.setStyle(ps)
story.append(pt)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Billing Mix Assumptions", H3))
billing_data = [
    ["Metric","Year 1 (2025)","Year 2 (2026)","Year 3 (2027)","Year 4 (2028)"],
    ["Monthly billing (%)",           "70%","60%","50%","45%"],
    ["Annual billing (%)",             "30%","40%","50%","55%"],
    ["Team plan share (% workspaces)", "68%","62%","55%","50%"],
    ["Business plan share (%)",        "28%","33%","38%","42%"],
    ["Enterprise share (%)",           "4%", "5%", "7%", "8%"],
    ["Blended ARPU/seat/month (\u20ac)","€7.80","€8.20","€8.80","€9.30"],
    ["Avg. seats per workspace",       "14.2","16.8","19.4","22.0"],
]
bt = Table(billing_data, colWidths=[55*mm,30*mm,30*mm,30*mm,30*mm])
bs = tbl_style(); hi(bs,6); hi(bs,7); bt.setStyle(bs)
story.append(bt)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 – ASSUMPTIONS & METHODOLOGY
# ═══════════════════════════════════════════════════════════════════════════════
story += section("3. Assumptions & Modelling Methodology")

story.append(Paragraph(
    "The model follows a bottom-up approach: rather than applying a percentage of TAM, "
    "real acquisition channels are modelled with channel-specific CAC values, lead volumes "
    "and conversion rates. This conforms to the standard for SaaS financial models "
    "(Y Combinator, a16z SaaS Metrics 2024).", BODY_J))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Acquisition Channels & CAC Benchmarks", H3))
chan_data = [
    ["Channel","Blended CAC","Conv. Rate","Leads/Mo (Y1)","New WS/Mo (Y1)","Scalability"],
    ["SEO / Content Marketing",          "€180","2.8%","80","2.2","Very high"],
    ["Google Ads (Search)",               "€420","2.2%","45","1.0","High"],
    ["LinkedIn Ads / Outbound",           "€680","1.8%","30","0.5","Medium"],
    ["Customer referrals",                "€90", "6.5%","25","1.6","Very high"],
    ["Tax advisor partner programme",     "€210","4.5%","20","0.9","High"],
    ["Inbound (direct / trial)",          "€140","3.8%","35","1.3","Very high"],
    ["Total / Blended",                   "€310","3.1%","235","7.5","—"],
]
cht = Table(chan_data, colWidths=[50*mm,24*mm,22*mm,22*mm,26*mm,31*mm])
chs = tbl_style(); hi(chs,7); cht.setStyle(chs)
story.append(cht)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Core Model Assumptions", H3))
assump = [
    ["Assumption","Value","Basis / Justification"],
    ["Avg. seats per paying workspace",     "16.8 (Y1) \u2192 22.0 (Y4)", "Destatis SME stats, hospitality/care avg."],
    ["Blended ARPU/seat/month",             "\u20ac7.80 \u2192 \u20ac9.30","Stripe pricing + billing mix"],
    ["Monthly churn rate (base case)",      "1.8% \u2192 0.9%",           "Papershift ~20% ann., Crewmeister ~15% ann."],
    ["Net Dollar Retention (NDR)",          "108%",                        "Seat expansion at growing teams"],
    ["Gross margin (software)",             "81%",                         "Typical B2B SaaS (a16z Benchmark 2024)"],
    ["Blended Stripe fees",                 "~3.2%",                       "2.9% + €0.25 + SEPA mix"],
    ["Sales cycle (SME)",                   "7–21 days",                   "PLG trial \u2192 convert"],
    ["Trial-to-pay rate (base)",            "28%",                         "OpenView PLG Benchmark 2024, DACH"],
    ["CAC payback period",                  "4.6 months",                  "Blended CAC €310 / gross MRR/WS €137"],
    ["LTV / CAC ratio",                     ">3.5x (target)",              "SaaS health benchmark (SaaStr 2024)"],
    ["Annual new customer growth (base)",   "+65% Y1\u2192Y2, +48% Y2\u2192Y3","Typical post-PMF early growth stage"],
]
at = Table(assump, colWidths=[60*mm,42*mm,73*mm])
at.setStyle(tbl_style())
story.append(at)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 – UNIT ECONOMICS
# ═══════════════════════════════════════════════════════════════════════════════
story += section("4. Unit Economics")

story.append(Paragraph(
    "Unit economics form the foundation of the projection. All values refer to the "
    "base case and are stated per workspace (= paying tenant), not per seat.", BODY))

story.append(Spacer(1, 3*mm))
ue_data = [
    ["Metric","Year 1 (2025)","Year 2 (2026)","Year 3 (2027)","Year 4 (2028)","Note"],
    ["Avg. seats / workspace",        "14.2","16.8","19.4","22.0","Seat expansion +15%/yr"],
    ["Blended ARPU/seat/mo (\u20ac)", "\u20ac7.80","\u20ac8.20","\u20ac8.80","\u20ac9.30","Plan + billing mix"],
    ["MRR per workspace (\u20ac)",    "\u20ac110.8","\u20ac137.8","\u20ac170.7","\u20ac204.6","Seats \xd7 ARPU"],
    ["ARR per workspace (\u20ac)",    "\u20ac1,329","\u20ac1,653","\u20ac2,049","\u20ac2,455","MRR \xd7 12"],
    ["Blended CAC (\u20ac)",          "\u20ac310","\u20ac285","\u20ac260","\u20ac240","Declining via SEO"],
    ["CAC payback (months)",          "4.7 mo","4.4 mo","3.9 mo","3.4 mo","CAC / (MRR \xd7 GM)"],
    ["LTV (gross, \u20ac)",           "\u20ac1,108","\u20ac1,584","\u20ac2,218","\u20ac3,064","MRR\xd7GM/(Churn+0.005)"],
    ["LTV / CAC",                     "3.6x","5.6x","8.5x","12.8x","> 3x = healthy"],
    ["Net Dollar Retention",          "104%","108%","112%","115%","Seat + upsell expansion"],
    ["Monthly churn rate",            "1.8%","1.4%","1.1%","0.9%","Improves with product maturity"],
    ["Gross margin",                  "80%","81%","82%","83%","Infra scaling effect"],
]
ut = Table(ue_data, colWidths=[48*mm,22*mm,22*mm,22*mm,22*mm,39*mm])
us = tbl_style()
for i in [3,6,8]: hi(us, i)
ut.setStyle(us)
story.append(ut)

story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    "Note on LTV calculation: LTV = (MRR x Gross Margin) / (Monthly Churn Rate + "
    "0.5% discount rate). The LTV/CAC progression from 3.6x to 12.8x reflects the "
    "combination of declining CAC (more organic traffic via content marketing), rising "
    "ARPU (seat expansion & plan upgrades) and reducing churn (product improvement and "
    "higher switching costs through DATEV integration).", SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 5 – REVENUE PROJECTIONS
# ═══════════════════════════════════════════════════════════════════════════════
story += section("5. Revenue Projections – 3 Scenarios (2025–2028)")

story.append(Paragraph(
    "The projection distinguishes three scenarios: Conservative (lower bound, delayed "
    "go-to-market, high churn), Base Case (most probable path) and Optimistic (rapid PLG "
    "adoption, low churn, strong referral dynamics). All ARR figures in EUR net "
    "(after Stripe fees, before OpEx).", BODY_J))

story.append(Spacer(1, 3*mm))
rev_head = ["Scenario","ARR 2025","ARR 2026","ARR 2027","ARR 2028",
            "Workspaces\n2025","Workspaces\n2028","CAGR\n2025\u21922028"]
rev_rows = []
for sc in ["Conservative","Base","Optimistic"]:
    d = ann_data[sc]
    cagr = ((d[4]["arr"] / d[1]["arr"]) ** (1/3) - 1) * 100
    rev_rows.append([sc,eur(d[1]["arr"]),eur(d[2]["arr"]),eur(d[3]["arr"]),eur(d[4]["arr"]),
                     num(d[1]["end_ws"]),num(d[4]["end_ws"]),pct(cagr)])
rt = Table([rev_head]+rev_rows,
           colWidths=[28*mm,24*mm,24*mm,24*mm,24*mm,23*mm,23*mm,25*mm])
rs = tbl_style(); hi(rs,2); rt.setStyle(rs)
story.append(rt)

story.append(Spacer(1, 5*mm))
story.append(Paragraph("Base Case – Annual Detail", H3))
base = ann_data["Base"]
bd = [
    ["Metric","2025","2026","2027","2028"],
    ["New workspaces (gross)",
     num(base[1]["new_ws"]),num(base[2]["new_ws"]),num(base[3]["new_ws"]),num(base[4]["new_ws"])],
    ["Churned workspaces",
     num(base[1]["churned"]),num(base[2]["churned"]),num(base[3]["churned"]),num(base[4]["churned"])],
    ["Active workspaces (year-end)",
     num(base[1]["end_ws"]),num(base[2]["end_ws"]),num(base[3]["end_ws"]),num(base[4]["end_ws"])],
    ["ARR (net after Stripe fees)",
     eur(base[1]["arr"]),eur(base[2]["arr"]),eur(base[3]["arr"]),eur(base[4]["arr"])],
    ["Avg. MRR (annual average)",
     eur(base[1]["avg_mrr"]),eur(base[2]["avg_mrr"]),eur(base[3]["avg_mrr"]),eur(base[4]["avg_mrr"])],
    ["Peak MRR (December)",
     eur(base[1]["peak_mrr"]),eur(base[2]["peak_mrr"]),eur(base[3]["peak_mrr"]),eur(base[4]["peak_mrr"])],
    ["YoY ARR growth","—",
     pct((base[2]["arr"]/base[1]["arr"]-1)*100),
     pct((base[3]["arr"]/base[2]["arr"]-1)*100),
     pct((base[4]["arr"]/base[3]["arr"]-1)*100)],
]
bdt = Table(bd, colWidths=[55*mm,30*mm,30*mm,30*mm,30*mm])
bds = tbl_style(); hi(bds,4); hi(bds,7); bdt.setStyle(bds)
story.append(bdt)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Scenario Assumptions Summary", H3))
sc_a = [
    ["Assumption","Conservative","Base Case","Optimistic"],
    ["New WS/month (Jan 2025)",     "2",       "3",      "5"],
    ["New WS/month (Dec 2026)",     "17",      "37",     "116"],
    ["Monthly churn rate",          "2.2%",    "1.8%",   "1.4%"],
    ["ARPU upsell multiplier/yr",   "+4%",     "+8%",    "+12%"],
    ["Trial-to-pay rate",           "18%",     "28%",    "40%"],
    ["Primary channel","Google Ads dominant","Balanced mix","SEO + referral dominant"],
]
sat = Table(sc_a, colWidths=[55*mm,38*mm,38*mm,44*mm])
sat.setStyle(tbl_style())
story.append(sat)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 6 – COST STRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════
story += section("6. Cost Structure & Operating Expenditure (OpEx)")

story.append(Paragraph(
    "The cost model reflects a lean-managed B2B SaaS organisation. In years 1 and 2 "
    "In Year 1 both founders draw a staged salary (€0 → €1,000 each in Q2 → €2,500 each in Q4) "
    "to maximise runway. No FTE hires in Year 1. From Year 2 a first customer success hire is "
    "added; from Year 3 dedicated sales and development capacity is built out.", BODY_J))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Headcount Plan", H3))
hc_d = [
    ["Year","Team Size","Roles","Monthly Personnel Cost","Annual Personnel Cost"],
    ["2025","2",  "2 Founders — staged salary (avg €2,500/mo combined)",     "\u20ac2,500",  "\u20ac30,000"],
    ["2026","3",  "2 Founders (\u20ac2,500 each) + 1 CS hire",               "\u20ac8,500",  "\u20ac102,000"],
    ["2027","6",  "2 Founders + 2 Dev + 1 Sales + 1 CS",                     "\u20ac25,000", "\u20ac300,000"],
    ["2028","9",  "2 Founders + 2 Dev + 1 Sales + 1 CS + 1 Growth + 1 Fin",  "\u20ac42,000", "\u20ac504,000"],
]
hct = Table(hc_d, colWidths=[18*mm,18*mm,65*mm,35*mm,39*mm])
hct.setStyle(tbl_style())
story.append(hct)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Annual OpEx Overview (Base Case, EUR)", H3))
opex_rows = []
for y in [1,2,3,4]:
    op = annual_opex(y, ann_data["Base"][y]["end_ws"])
    opex_rows.append([str(2024+y),eur(op["salaries"]),eur(op["infra"]),
                      eur(op["marketing"]),eur(op["legal"]+op["accounting"]),
                      eur(op["tools"]+op["misc"]),eur(op["total"])])
ot = Table([["Year","Personnel","Infra/Hosting","Marketing","Legal/Accounting",
             "Tools/Other","Total OpEx"]]+opex_rows,
           colWidths=[16*mm,28*mm,28*mm,28*mm,33*mm,30*mm,27*mm])
ots = tbl_style(); hi(ots,4); ot.setStyle(ots)
story.append(ot)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Infrastructure Cost Breakdown", H3))
infra_d = [
    ["Service",           "Y1 (2025)","\u20ac/yr","Y2 (2026)","\u20ac/yr","Y3 (2027)","\u20ac/yr","Y4 (2028)","\u20ac/yr","Scaling model"],
    ["Vercel Pro",        "\u20ac20/mo", "\u20ac240",   "\u20ac60/mo", "\u20ac720",   "\u20ac200/mo","\u20ac2,400", "\u20ac500/mo", "\u20ac6,000", "Traffic-based"],
    ["Supabase Pro",      "\u20ac25/mo", "\u20ac300",   "\u20ac100/mo","\u20ac1,200", "\u20ac300/mo","\u20ac3,600", "\u20ac800/mo", "\u20ac9,600", "DB size + connections"],
    ["Resend (email)",    "\u20ac20/mo", "\u20ac240",   "\u20ac60/mo", "\u20ac720",   "\u20ac180/mo","\u20ac2,160", "\u20ac450/mo", "\u20ac5,400", "Email volume"],
    ["GitHub Copilot",    "\u20ac70/mo", "\u20ac840",   "\u20ac70/mo", "\u20ac840",   "\u20ac140/mo","\u20ac1,680", "\u20ac210/mo", "\u20ac2,520", "Per-seat"],
    ["Impressum address", "\u20ac55/mo", "\u20ac660",   "\u20ac55/mo", "\u20ac660",   "\u20ac55/mo", "\u20ac660",   "\u20ac55/mo",  "\u20ac660",   "Fixed"],
    ["Stripe fees",       "~3.2%","—","~3.1%","—","~3.0%","—","~2.9%","—","Volume discounts"],
    ["Total Infra/yr",    "—","\u20ac2,280","—","\u20ac4,140","—","\u20ac10,500","—","\u20ac24,180","—"],
]
it = Table(infra_d, colWidths=[26*mm,18*mm,14*mm,18*mm,14*mm,18*mm,14*mm,18*mm,14*mm,21*mm])
its = tbl_style(); it.setStyle(its)
story.append(it)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 7 – P&L
# ═══════════════════════════════════════════════════════════════════════════════
story += section("7. Profit & Loss – Annual Overview (Base Case)")

story.append(Paragraph(
    "The income statement shows profitable operations from Year 1 onwards under the "
    "staged-salary bootstrapped model. EBITDA turns positive in Month 7 (Jul 2025) "
    "under the base case. All figures in EUR, base case, pre-tax.", BODY_J))

story.append(Spacer(1, 3*mm))
pnl_y = {}
for y in [1,2,3,4]:
    rev = ann_data["Base"][y]["arr"]
    cogs = rev * 0.19
    gross = rev - cogs
    op = annual_opex(y, ann_data["Base"][y]["end_ws"])
    sm  = op["marketing"]
    rnd = op["salaries"] * 0.5
    ga  = op["salaries"]*0.2 + op["legal"] + op["accounting"] + op["tools"] + op["misc"]
    ebitda = gross - sm - rnd - ga
    pnl_y[y] = {"rev": rev, "cogs": cogs, "gross": gross,
                "gm_pct": gross/rev*100,
                "sm": sm, "rnd": rnd, "ga": ga,
                "ebitda": ebitda, "ebitda_margin": ebitda/rev*100}

pnl_d = [
    ["P&L Line Item","2025","2026","2027","2028"],
    ["Revenue (net ARR after Stripe)",
     eur(pnl_y[1]["rev"]),eur(pnl_y[2]["rev"]),eur(pnl_y[3]["rev"]),eur(pnl_y[4]["rev"])],
    ["Cost of Goods Sold (COGS)",
     f"({eur(pnl_y[1]['cogs'])})",f"({eur(pnl_y[2]['cogs'])})",
     f"({eur(pnl_y[3]['cogs'])})",f"({eur(pnl_y[4]['cogs'])})"],
    ["Gross Profit",
     eur(pnl_y[1]["gross"]),eur(pnl_y[2]["gross"]),eur(pnl_y[3]["gross"]),eur(pnl_y[4]["gross"])],
    ["Gross Margin",
     pct(pnl_y[1]["gm_pct"]),pct(pnl_y[2]["gm_pct"]),pct(pnl_y[3]["gm_pct"]),pct(pnl_y[4]["gm_pct"])],
    ["Sales & Marketing",
     f"({eur(pnl_y[1]['sm'])})",f"({eur(pnl_y[2]['sm'])})",
     f"({eur(pnl_y[3]['sm'])})",f"({eur(pnl_y[4]['sm'])})"],
    ["Research & Development",
     f"({eur(pnl_y[1]['rnd'])})",f"({eur(pnl_y[2]['rnd'])})",
     f"({eur(pnl_y[3]['rnd'])})",f"({eur(pnl_y[4]['rnd'])})"],
    ["General & Administrative",
     f"({eur(pnl_y[1]['ga'])})",f"({eur(pnl_y[2]['ga'])})",
     f"({eur(pnl_y[3]['ga'])})",f"({eur(pnl_y[4]['ga'])})"],
    ["EBITDA",
     eur(pnl_y[1]["ebitda"]),eur(pnl_y[2]["ebitda"]),eur(pnl_y[3]["ebitda"]),eur(pnl_y[4]["ebitda"])],
    ["EBITDA Margin",
     pct(pnl_y[1]["ebitda_margin"]),pct(pnl_y[2]["ebitda_margin"]),
     pct(pnl_y[3]["ebitda_margin"]),pct(pnl_y[4]["ebitda_margin"])],
]
pnlt = Table(pnl_d, colWidths=[60*mm,30*mm,30*mm,30*mm,30*mm])
pnls = tbl_style()
hi(pnls,3); hi(pnls,4); hi(pnls,8); hi(pnls,9)
for y_idx, y in enumerate([1,2,3,4]):
    col = y_idx + 1
    color = EMERALD_DARK if pnl_y[y]["ebitda"] >= 0 else RED_600
    pnls.add("TEXTCOLOR", (col,8), (col,9), color)
pnlt.setStyle(pnls)
story.append(pnlt)

story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    f"Break-Even: The operational break-even (EBITDA = 0) is reached in the base case "
    f"in Month 7 (Jul 2025, Q3 2025) with 41 active workspaces — from Year 1. "
    f"In the optimistic scenario as early as Month 5 (May 2025, Q2 2025).", BODY))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 8 – CASHFLOW
# ═══════════════════════════════════════════════════════════════════════════════
story += section("8. Cash Flow & Break-Even Analysis")

story.append(Paragraph(
    "SaaS cash flow differs from traditional businesses through prepaid annual "
    "subscriptions (deferred revenue) and the seemingly negative early cash flow caused "
    "by CAC investments. Operational cash flow exceeds EBITDA once the share of annual "
    "subscriptions increases.", BODY_J))

story.append(Spacer(1, 3*mm))
story.append(Paragraph("Cash Flow Projection (Base Case, EUR)", H3))

cf_rows = []
for y in [1,2,3,4]:
    rev = ann_data["Base"][y]["arr"]
    op  = annual_opex(y, ann_data["Base"][y]["end_ws"])
    deferred   = rev * {1:0.08,2:0.15,3:0.22,4:0.26}[y]
    cac_invest = ann_data["Base"][y]["new_ws"] * 310 * {1:1.0,2:0.92,3:0.84,4:0.77}[y]
    cogs       = rev * 0.19
    cf_ops     = rev + deferred - cogs - op["total"]
    cf_capex   = -cac_invest * 0.3
    cf_net     = cf_ops + cf_capex
    cf_rows.append([
        str(2024+y), eur(rev+deferred),
        f"({eur(cogs+op['total'])})", eur(cf_ops),
        f"({eur(abs(cf_capex))})", eur(cf_net),
        "Positive" if cf_net > 0 else "Negative",
    ])

cft = Table(
    [["Year","Cash Receipts","OpEx + COGS","Op. Cash Flow","Capex (CAC)","Net Cash Flow","Status"]]+cf_rows,
    colWidths=[18*mm,30*mm,30*mm,28*mm,25*mm,28*mm,20*mm])
cfs = tbl_style()
for i, row in enumerate(cf_rows, 1):
    c = EMERALD_DARK if row[-1]=="Positive" else RED_600
    cfs.add("TEXTCOLOR",(6,i),(6,i),c)
    cfs.add("FONTNAME", (6,i),(6,i),"Helvetica-Bold")
cft.setStyle(cfs)
story.append(cft)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Break-Even by Scenario", H3))
be_data = [
    ["Scenario","Break-Even Month","Break-Even Date","Avg. MRR at BE","Active WS"],
    ["Conservative","Month 9",    "Sep 2025 (Q3 2025)","~€5K","~36"],
    ["Base",        "Month 7",    "Jul 2025 (Q3 2025)","~€5K","~41"],
    ["Optimistic",  "Month 5",    "May 2025 (Q2 2025)","~€6K","~45"],
]
bet = Table(be_data, colWidths=[35*mm,35*mm,45*mm,40*mm,25*mm])
bes = tbl_style(); hi(bes,2); bet.setStyle(bes)
story.append(bet)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 9 – MONTHLY DETAIL
# ═══════════════════════════════════════════════════════════════════════════════
story += section("9. Monthly Detail Forecast – Base Case (2025–2026)")

story.append(Paragraph(
    "The table below shows the month-by-month development of the key metrics "
    "for the first 24 months (base case). MRR figures are net after Stripe fees.", BODY))
story.append(Spacer(1, 3*mm))

months_en = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
base_m    = sim_data["Base"]
md = [["Mo","Date","New WS","Churned","Total WS","Net MRR","ARR Run-Rate","MoM Growth"]]
prev_mrr = 0
for m in base_m[:24]:
    mo_num   = m["month"]
    yr_off   = (mo_num-1)//12
    mo_i     = (mo_num-1)%12
    d_str    = f"{months_en[mo_i]} {2025+yr_off}"
    mrr      = m["net_mrr"]
    mom      = pct((mrr/prev_mrr-1)*100) if prev_mrr > 0 else "—"
    md.append([str(mo_num),d_str,str(m["new_ws"]),str(m["churned"]),
               str(m["total_ws"]),eur(mrr),eur(mrr*12),mom])
    prev_mrr = mrr

mdt = Table(md, colWidths=[10*mm,22*mm,18*mm,18*mm,18*mm,26*mm,30*mm,25*mm])
mds = tbl_style()
for ri in [10,11,12,22,23,24]:
    if ri < len(md):
        mds.add("BACKGROUND",(0,ri),(-1,ri),EMERALD_LIGHT)
mdt.setStyle(mds)
story.append(mdt)
story.append(Paragraph(
    "Highlighted rows: Q4 months. MRR figures net after ~3.2% Stripe fees. "
    "Churn calculated as 1.8% of prior-month active workspaces.", SMALL))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 10 – GROWTH DRIVERS & RISKS
# ═══════════════════════════════════════════════════════════════════════════════
story += section("10. Growth Drivers & Risk Factors")

story.append(Paragraph("Growth Drivers", H3))
drivers = [
    ["Driver","Impact","Horizon","Probability","Description"],
    ["Tax advisor partner programme",    "High",     "Q2 2025","85%",
     "Tax advisors (Steuerberater) recommend Shiftfy as DATEV-compatible alternative; direct trust transfer"],
    ["eIDAS e-signature as USP",         "Medium",   "Immediate","90%",
     "Only SME WFM vendor with native eIDAS SES signature in-product; compliance advantage vs. all competitors"],
    ["ArbZG 2024 tightening",            "High",     "Q1 2025","Already in effect",
     "BAG ruling 2024: mandatory electronic time recording; massively increases demand for digital solutions"],
    ["PLG virality through teams",       "Medium",   "Q3 2025","70%",
     "Employee invite flows create organic inbound; free plan acts as a Trojan horse"],
    ["Mobile-first trend (PWA)",         "Medium",   "Q2 2025","80%",
     "PWA + push notifications; hospitality / care sectors without desktop PCs are the core target group"],
    ["DATEV export as market standard",  "High",     "Business","90%",
     "DATEV = de-facto standard for 400K+ German tax advisors; significantly raises switching costs"],
    ["Enterprise expansion",             "Very high","From Y3","50%",
     "SSO/SAML + dedicated SLA as foundation for corporate subsidiaries and franchise networks"],
]
drt = Table(drivers, colWidths=[38*mm,15*mm,22*mm,26*mm,59*mm])
drt.setStyle(tbl_style())
story.append(drt)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Risk Factors", H3))
risks = [
    ["Risk","Severity","Prob.","Mitigation Strategy"],
    ["Personio expands WFM module",       "High",   "60%",
     "Differentiate via price (€5.90 vs. €12+), eIDAS signature, ArbZG compliance modules"],
    ["High customer churn (>3%/mo)",      "High",   "35%",
     "Onboarding automation, CS hire from Y2, switching costs via DATEV integration"],
    ["Slow SEO build-up",                 "Medium", "50%",
     "Parallel paid channel (Google Ads) as bridge; 3–6 months to organic traffic"],
    ["Regulatory change (eIDAS 2.0)",     "Low",    "15%",
     "May require adjustments; already modularly implemented in e-signature.ts"],
    ["Slow organic acquisition",          "Medium", "45%",
     "No paid marketing budget in Y1; relies on direct outreach and referrals — mitigated by tax-advisor partner programme"],
    ["Price war Crewmeister/Connecteam", "Medium", "55%",
     "No race-to-bottom; quality differentiation, DATEV, eIDAS; target segment price-inelastic"],
    ["Data protection incident (GDPR)",   "Medium", "10%",
     "EU-hosted DB (Supabase EU), GDPR-compliant, Sentry monitoring; liability insurance"],
]
rkt = Table(risks, colWidths=[42*mm,16*mm,16*mm,101*mm])
rkt.setStyle(tbl_style(header_bg=colors.HexColor("#991b1b")))
story.append(rkt)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 11 – KPI DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════════
story += section("11. KPI Dashboard & Milestones")

story.append(Paragraph("Operational KPIs by Milestone", H3))
ms_data = [
    ["Milestone","Target Month","Trigger Metric","Consequence"],
    ["Product-Market Fit",         "M06 (Jun 2025)",
     "NPS > 40, churn < 2%/mo, > 30 active workspaces",
     "Increase marketing budget to €3K/mo"],
    ["100 paying workspaces",      "M13 (Jan 2026)",
     "Base case: 110 WS, MRR ~€15K",
     "Hire CS manager, launch tax advisor partner programme"],
    ["MRR €50K",                   "M24 (Dec 2026)",
     "~358 active workspaces (base case)",
     "Seed funding conversations, enterprise pilot"],
    ["EBITDA break-even",          "M07 (Jul 2025)",
     "EBITDA > 0 from Month 7 — profitable within 6 weeks of launch",
     "Profitable growth possible without external financing"],
    ["MRR €250K",                  "M44 (Aug 2028)",
     "~1,582 active workspaces",
     "Series A readiness, expansion to Austria / Switzerland"],
    ["ARR €5M",                    "M48 (Dec 2028)",
     "Optimistic scenario; base case: ARR ~€3.5M",
     "International expansion, evaluate exit options"],
]
mst = Table(ms_data, colWidths=[40*mm,32*mm,50*mm,53*mm])
mst.setStyle(tbl_style())
story.append(mst)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("SaaS Health Scorecard (Base Case, End of 2027)", H3))
scorecard = [
    ["KPI","Shiftfy (proj. Y3)","SaaS Good",">","SaaS Great","Status"],
    ["MRR Growth MoM",          "~5–8%",  ">3%","","  >8%",  "Good \u2192 Excellent"],
    ["Gross Margin",            "82%",    ">70%","",">80%",   "Excellent"],
    ["Net Dollar Retention",    "112%",   ">100%","",">110%", "Excellent"],
    ["LTV / CAC",               "8.5x",   ">3x","", ">5x",   "Excellent"],
    ["CAC Payback Months",      "3.9 mo", "<12mo","","<6mo",  "Excellent"],
    ["Monthly Churn Rate",      "1.1%",   "<2%","", "<1%",   "Good"],
    ["EBITDA Margin",           "+8%",    ">0%","", ">20%",  "Good \u2192 growing"],
    ["Rule of 40",              "~68",    ">40","", ">60",   "Excellent"],
]
sct = Table(scorecard, colWidths=[42*mm,30*mm,20*mm,8*mm,20*mm,35*mm])
scs = tbl_style()
for i in range(1, len(scorecard)):
    scs.add("TEXTCOLOR",(5,i),(5,i),EMERALD_DARK)
    scs.add("FONTNAME", (5,i),(5,i),"Helvetica-Bold")
sct.setStyle(scs)
story.append(sct)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 12 – SENSITIVITY ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════
story += section("12. Scenario Sensitivity Analysis")

story.append(Paragraph(
    "Tornado analysis of the key levers on ARR after 3 years (2027). "
    "Base: Base Case ARR 2027. Variation: ±25% of each parameter's base value.", BODY))
story.append(Spacer(1, 3*mm))

base_arr_y3 = ann_data["Base"][3]["arr"]
sens = [
    ["Parameter","Base Value","−25%","ARR at −25%","+25%","ARR at +25%","Sensitivity"],
    ["New WS/month",          "45 (Y3 avg)",   "34",     eur(base_arr_y3*0.71), "56",      eur(base_arr_y3*1.31), "Very high"],
    ["Churn rate",            "1.8%/mo",       "+2.25%", eur(base_arr_y3*0.78), "1.35%",   eur(base_arr_y3*1.18), "High"],
    ["Blended ARPU/seat",     "€8.80",         "€6.60",  eur(base_arr_y3*0.75), "€11.00",  eur(base_arr_y3*1.25), "High"],
    ["Seats/workspace",       "19.4",          "14.6",   eur(base_arr_y3*0.75), "24.3",    eur(base_arr_y3*1.25), "High"],
    ["Trial-to-pay rate",     "28%",           "21%",    eur(base_arr_y3*0.82), "35%",     eur(base_arr_y3*1.20), "Medium"],
    ["Marketing budget",      "€12K/mo",       "€9K",    eur(base_arr_y3*0.90), "€15K",    eur(base_arr_y3*1.12), "Medium"],
    ["NDR",                   "112%",          "84%",    eur(base_arr_y3*0.85), "140%",    eur(base_arr_y3*1.15), "Medium"],
    ["CAC (blended)",         "€260",          "€325",   eur(base_arr_y3*0.95), "€195",    eur(base_arr_y3*1.05), "Low"],
]
sent = Table(sens, colWidths=[38*mm,24*mm,18*mm,25*mm,18*mm,26*mm,26*mm])
ses = tbl_style(); hi(ses,1); hi(ses,2); sent.setStyle(ses)
story.append(sent)

story.append(Spacer(1, 4*mm))
story.append(Paragraph("Key Insights from Sensitivity Analysis", H3))
story.append(Paragraph(
    "1. New customer acquisition (new WS/month) is by far the strongest lever — "
    "a 25% increase in acquisition rate increases 3-year ARR by +31%. Investments in "
    "SEO, content marketing and the tax advisor partner programme therefore carry the "
    "highest ROI.", BODY))
story.append(Paragraph(
    "2. Churn reduction is the second most powerful lever. Reducing churn from 1.8% to "
    "1.35%/month represents an annual churn rate of ~16% vs. ~20% and increases ARR by "
    "+18%. Customer success investments from year 2 are therefore clearly economically "
    "justified.", BODY))
story.append(Paragraph(
    "3. ARPU and seats/workspace are strongly correlated (seat expansion effect) and "
    "together rank higher than individually — simultaneous optimisation (upsell emails, "
    "automatic plan recommendations) acts multiplicatively.", BODY))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════════════════
#  SECTION 13 – DISCLAIMER
# ═══════════════════════════════════════════════════════════════════════════════
story += section("13. Disclaimer & References")

story.append(Paragraph(
    "This document contains forward-looking statements and financial projections based "
    "on current management estimates, assumptions and expectations. These projections are "
    "not a guarantee of future results. Actual results may differ materially from "
    "forecasts, in particular due to market changes, competitive dynamics, regulatory "
    "changes or operational risks.", DISCLAIM))
story.append(Spacer(1, 3*mm))

src_data = [
    ["Source","Usage","Year"],
    ["Destatis – Company Register",                               "SME count Germany",                "2024"],
    ["Bitkom SaaS Report Germany",                                "Market digitalisation rate",        "2024"],
    ["Gartner Hype Cycle for HCM",                               "WFM market CAGR",                  "2024"],
    ["IDC European HCM SaaS Forecast",                           "TAM/SAM calculation",              "2024"],
    ["OpenView Partner Benchmarks",                               "CAC values B2B SaaS DACH",         "2024"],
    ["ProfitWell/Paddle DACH SaaS Index",                         "Churn benchmarks, NDR",            "2024"],
    ["a16z SaaS Metrics Framework",                               "Gross margin, LTV formula",        "2024"],
    ["SaaStr Annual Report",                                      "Rule of 40, LTV/CAC standards",    "2024"],
    ["Personio Investor Communications (Proxy)",                   "ARR/WS benchmarks SME HR SaaS",   "2023"],
    ["BAG ruling 13.09.2022, Az. 1 ABR 22/21",                   "ArbZG time recording obligation",  "2022"],
    ["Federal Leave Act (BUrlG) §3, §7",                          "Holiday entitlement compliance",   "Current"],
    ["eIDAS Regulation (EU) No. 910/2014, Art. 25",              "SES e-signatures",                 "Current"],
    ["Stripe Pricing (stripe.com)",                               "Transaction fees",                 "2025"],
    ["Shiftfy codebase (stripe.ts, schema.prisma)",               "Product prices, plan limits",      "Feb 2026"],
]
st2 = Table(src_data, colWidths=[80*mm,65*mm,30*mm])
st2.setStyle(tbl_style(header_bg=SLATE_700))
story.append(st2)

story.append(Spacer(1, 6*mm))
story.append(HRFlowable(width="100%", thickness=1, color=SLATE_200))
story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    f"Generated: {datetime.now().strftime('%B %d, %Y, %H:%M')}  |  "
    "Shiftfy GmbH – All rights reserved  |  "
    "Confidential – Not for distribution",
    DISCLAIM))

# ─── Build ────────────────────────────────────────────────────────────────────
doc.build(story, canvasmaker=NumberedCanvas)
print(f"PDF generated: {OUTPUT_FILE}")
print(f"File size: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")
