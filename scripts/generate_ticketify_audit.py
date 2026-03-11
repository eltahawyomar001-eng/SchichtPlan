#!/usr/bin/env python3
"""
Ticketify Codebase Audit — Professional PDF Report Generator
Generates English and German versions of the comprehensive audit report.

Usage:
    python3 scripts/generate_ticketify_audit.py

Output:
    reports/ticketify_audit_EN.pdf
    reports/ticketify_audit_DE.pdf
"""

import os
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm, cm
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

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(SCRIPT_DIR, "fonts")
REPORTS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# ─── Fonts ────────────────────────────────────────────────────────────────────
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

# ─── Colors ───────────────────────────────────────────────────────────────────
PRIMARY = colors.HexColor("#0F172A")       # slate-900
ACCENT = colors.HexColor("#7C3AED")        # violet-600 (Ticketify brand)
SUCCESS = colors.HexColor("#059669")        # emerald-600
WARNING = colors.HexColor("#D97706")        # amber-600
DANGER = colors.HexColor("#DC2626")         # red-600
LIGHT_BG = colors.HexColor("#F8FAFC")      # slate-50
BORDER = colors.HexColor("#E2E8F0")        # slate-200
TEXT_GRAY = colors.HexColor("#64748B")      # slate-500
WHITE = colors.white

# ─── Styles ───────────────────────────────────────────────────────────────────
def build_styles():
    s = getSampleStyleSheet()
    styles = {}
    styles["title"] = ParagraphStyle(
        "Title", fontName="DejaVu-Bold", fontSize=26, leading=32,
        textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=4 * mm,
    )
    styles["subtitle"] = ParagraphStyle(
        "Subtitle", fontName="DejaVu", fontSize=12, leading=16,
        textColor=TEXT_GRAY, alignment=TA_CENTER, spaceAfter=10 * mm,
    )
    styles["h1"] = ParagraphStyle(
        "H1", fontName="DejaVu-Bold", fontSize=18, leading=24,
        textColor=PRIMARY, spaceBefore=10 * mm, spaceAfter=4 * mm,
    )
    styles["h2"] = ParagraphStyle(
        "H2", fontName="DejaVu-Bold", fontSize=14, leading=18,
        textColor=ACCENT, spaceBefore=7 * mm, spaceAfter=3 * mm,
    )
    styles["h3"] = ParagraphStyle(
        "H3", fontName="DejaVu-Bold", fontSize=11, leading=15,
        textColor=PRIMARY, spaceBefore=4 * mm, spaceAfter=2 * mm,
    )
    styles["body"] = ParagraphStyle(
        "Body", fontName="DejaVu", fontSize=9.5, leading=14,
        textColor=PRIMARY, alignment=TA_JUSTIFY, spaceAfter=2.5 * mm,
    )
    styles["body_bold"] = ParagraphStyle(
        "BodyBold", fontName="DejaVu-Bold", fontSize=9.5, leading=14,
        textColor=PRIMARY, spaceAfter=2.5 * mm,
    )
    styles["bullet"] = ParagraphStyle(
        "Bullet", fontName="DejaVu", fontSize=9.5, leading=14,
        textColor=PRIMARY, leftIndent=12 * mm, bulletIndent=5 * mm,
        spaceAfter=1.5 * mm,
    )
    styles["bullet_bold"] = ParagraphStyle(
        "BulletBold", fontName="DejaVu-Bold", fontSize=9.5, leading=14,
        textColor=PRIMARY, leftIndent=12 * mm, bulletIndent=5 * mm,
        spaceAfter=1.5 * mm,
    )
    styles["small"] = ParagraphStyle(
        "Small", fontName="DejaVu", fontSize=8, leading=11,
        textColor=TEXT_GRAY,
    )
    styles["table_header"] = ParagraphStyle(
        "TH", fontName="DejaVu-Bold", fontSize=9, leading=12,
        textColor=WHITE,
    )
    styles["table_cell"] = ParagraphStyle(
        "TC", fontName="DejaVu", fontSize=8.5, leading=12,
        textColor=PRIMARY,
    )
    styles["table_cell_bold"] = ParagraphStyle(
        "TCB", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
        textColor=PRIMARY,
    )
    styles["severity_critical"] = ParagraphStyle(
        "SevCrit", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
        textColor=DANGER,
    )
    styles["severity_high"] = ParagraphStyle(
        "SevHigh", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
        textColor=WARNING,
    )
    styles["severity_medium"] = ParagraphStyle(
        "SevMed", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
        textColor=colors.HexColor("#2563EB"),
    )
    styles["severity_low"] = ParagraphStyle(
        "SevLow", fontName="DejaVu-Bold", fontSize=8.5, leading=12,
        textColor=SUCCESS,
    )
    styles["footer"] = ParagraphStyle(
        "Footer", fontName="DejaVu", fontSize=7.5, leading=10,
        textColor=TEXT_GRAY, alignment=TA_CENTER,
    )
    return styles

# ─── Report Content (Bilingual) ──────────────────────────────────────────────
def get_content(lang="en"):
    """Return all report content as a dict, keyed by section."""
    if lang == "en":
        return CONTENT_EN
    return CONTENT_DE

# ═══════════════════════════════════════════════════════════════════════════════
#  ENGLISH CONTENT
# ═══════════════════════════════════════════════════════════════════════════════
CONTENT_EN = {
    "title": "Ticketify — Codebase Audit Report",
    "subtitle": "Comprehensive Technical Assessment & Improvement Roadmap",
    "meta_date": "Date",
    "meta_repo": "Repository",
    "meta_author": "Auditor",
    "meta_scope": "Scope",
    "meta_date_val": datetime.now().strftime("%B %d, %Y"),
    "meta_repo_val": "Har-dev61/ticketify",
    "meta_author_val": "Omar Rageh — Full-Stack Engineer",
    "meta_scope_val": "Architecture, Code Quality, DevOps, Security, AI, Performance, UI/UX",

    # ── Executive Summary ──
    "exec_title": "1. Executive Summary",
    "exec_body": (
        "Ticketify is a well-architected AI-powered multi-tenant help-desk SaaS built with "
        "Next.js 15, Prisma, Clerk, and Stripe. The codebase demonstrates strong fundamentals: "
        "strict tenant isolation via organizationId, a clean App Router structure, "
        "SSE-based real-time updates, proper plan gating, and comprehensive documentation.\n\n"
        "However, the audit reveals <b>27 findings across 8 categories</b> that must be addressed "
        "to make the platform production-ready and scalable. Critical gaps exist in "
        "<b>DevOps infrastructure</b> (no Docker, no commit standards, no staging environment), "
        "<b>code quality</b> (693-line monolithic DB module, hardcoded German strings, empty test setup), "
        "<b>false positives</b> (Enterprise plan with no backend, fake social proof), and "
        "<b>performance</b> (in-memory rate limiting and SSE that won't work at scale)."
    ),

    # ── Tech Stack Overview ──
    "stack_title": "2. Technology Stack Overview",
    "stack_items": [
        ("Framework", "Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui"),
        ("Database", "PostgreSQL + Prisma ORM (multi-tenant with organizationId)"),
        ("Auth", "Clerk (organizations, roles: Admin / Agent / Customer)"),
        ("Billing", "Stripe (Free $0 vs Pro $19/mo — checkout + webhook)"),
        ("AI", "OpenAI gpt-4o (AI reply drafts, Instant Solution deflection)"),
        ("Real-time", "SSE (Server-Sent Events) — in-memory broadcast per org"),
        ("Caching", "Upstash Redis (optional) or in-memory fallback"),
        ("Email", "Resend (optional, silent when unconfigured)"),
        ("Error Tracking", "Sentry (optional, wired in client/server/edge)"),
        ("File Storage", "Vercel Blob (attachments, 4 MB limit)"),
        ("Testing", "Vitest (unit) + Playwright (E2E critical flows)"),
        ("CI", "GitHub Actions — lint-and-build + e2e jobs"),
        ("i18n", "next-intl (en/de), locale in URL path"),
    ],

    # ── What's Done Well ──
    "strengths_title": "3. What's Done Well",
    "strengths": [
        ("<b>Multi-tenancy enforcement</b> — Every DB query in organization.ts is scoped by organizationId. "
         "No cross-tenant data leakage is possible through the DB layer."),
        ("<b>Auth architecture</b> — Clerk integration with DB role sync (getCurrentAuth), "
         "auto-provisioning of org/member on first visit, proper middleware protection."),
        ("<b>Plan gating</b> — AI features properly gated behind Pro plan with isPro() checks. "
         "Free plan limits (3 agents, 500 tickets/mo, 30-day history) are enforced."),
        ("<b>Rate limiting</b> — Applied to ticket creation, comments, login, API endpoints, "
         "and AI instant solutions. Prevents abuse at the function level."),
        ("<b>Audit logging</b> — Status changes, assignments, priority changes, and role changes "
         "are logged with cursor pagination and CSV export."),
        ("<b>Real-time updates</b> — SSE-based live updates with presence tracking and typing indicators "
         "for collision avoidance on ticket detail views."),
        ("<b>Documentation</b> — Comprehensive README covering setup, architecture, testing, CI, "
         "data model. Separate ARCHITECTURE.md with folder structure."),
        ("<b>Webhook handling</b> — Stripe webhook with proper signature verification (constructEvent). "
         "Clerk webhook for user deletion cleanup."),
        ("<b>Graceful degradation</b> — Clerk, Redis, Resend, Sentry, and Stripe all work as optional — "
         "the app runs without any external service configured."),
    ],

    # ── Findings ──
    "findings_title": "4. Detailed Findings",

    # Category A: Architecture & Refactoring
    "cat_a_title": "4.1 Architecture & Refactoring",
    "cat_a_items": [
        {
            "id": "A-1", "severity": "HIGH",
            "title": "Monolithic DB Module (organization.ts — 693 lines)",
            "desc": (
                "All tenant-scoped database operations are in a single 693-line file. "
                "This file handles organizations, members, tickets, comments, attachments, "
                "ticket relations, and more — violating the Single Responsibility Principle."
            ),
            "fix": (
                "Split into domain-specific modules: ticket-repository.ts, comment-repository.ts, "
                "member-repository.ts, attachment-repository.ts, etc. Use a Repository pattern "
                "with shared organizationId injection."
            ),
        },
        {
            "id": "A-2", "severity": "MEDIUM",
            "title": "Server Actions Spread Across Route Directories",
            "desc": (
                "Server Actions like ticket CRUD, comments, AI drafts, and settings are defined "
                "inside individual route directories (e.g., dashboard/tickets/[displayId]/actions.ts). "
                "Some actions.ts files exceed 400 lines."
            ),
            "fix": (
                "Extract shared business logic into a service layer (src/lib/services/) and keep "
                "actions.ts files as thin wrappers that validate, delegate to services, and revalidate."
            ),
        },
        {
            "id": "A-3", "severity": "MEDIUM",
            "title": "Duplicate API Route and Server Action Paths",
            "desc": (
                "AI draft generation exists both as a Server Action (generateAIDraftAction) and as "
                "an API route (POST /api/tickets/[id]/ai-draft). This creates inconsistent behavior "
                "and double maintenance."
            ),
            "fix": (
                "Decide on one pattern per feature. For mutations in the dashboard, use Server Actions. "
                "For external/API consumers, use API routes. Remove the duplicate."
            ),
        },
    ],

    # Category B: Code Quality & Clean Code
    "cat_b_title": "4.2 Code Quality & Clean Code",
    "cat_b_items": [
        {
            "id": "B-1", "severity": "HIGH",
            "title": "Hardcoded German Strings in constants.ts",
            "desc": (
                "src/lib/constants.ts contains hardcoded German labels for statuses, priorities, "
                "and roles — despite the app having a full i18n system (next-intl). "
                "A docs/I18N_HARDCODED_STRINGS_REPORT.md acknowledges this issue exists."
            ),
            "fix": (
                "Replace all hardcoded German strings with translation keys using t() from next-intl. "
                "Remove the constants file and use the message files (messages/en.json, messages/de.json) "
                "as the single source of truth."
            ),
        },
        {
            "id": "B-2", "severity": "MEDIUM",
            "title": "Inconsistent Error Messages (Mixed German/English)",
            "desc": (
                "Some Server Actions return hardcoded German error messages "
                '(e.g., "Nicht angemeldet.", "Zu viele Anfragen. Bitte kurz warten.") '
                "while API routes return English errors. This is inconsistent for a bilingual app."
            ),
            "fix": (
                "Use getTranslations() consistently in all Server Actions and API routes. "
                "Standardize error responses to use i18n keys."
            ),
        },
        {
            "id": "B-3", "severity": "LOW",
            "title": "console.error Used Instead of Structured Logging",
            "desc": (
                "Error handling uses raw console.error() with string prefixes like "
                '"[generateAIDraftAction]" or "[health]". No structured logging library.'
            ),
            "fix": (
                "Introduce a lightweight logger (e.g., pino or winston) that outputs structured "
                "JSON logs with severity, context, and timestamps for production observability."
            ),
        },
        {
            "id": "B-4", "severity": "LOW",
            "title": "Empty Test Setup File",
            "desc": (
                "src/test/setup.ts contains only a comment: \"Vitest Setup — wird vor allen Tests ausgeführt.\" "
                "No global mocks, environment variables, or test utilities are configured."
            ),
            "fix": (
                "Set up global test mocks (Prisma, Clerk auth), environment variables, "
                "test database cleanup, and shared test utilities."
            ),
        },
    ],

    # Category C: DevOps & CI/CD
    "cat_c_title": "4.3 DevOps & CI/CD Infrastructure",
    "cat_c_items": [
        {
            "id": "C-1", "severity": "CRITICAL",
            "title": "No Docker or Container Support",
            "desc": (
                "No Dockerfile, no docker-compose.yml. Local development requires manual setup "
                "of PostgreSQL, Node.js, and environment variables. This makes onboarding "
                "slow and environment-specific bugs common."
            ),
            "fix": (
                "Add Dockerfile (multi-stage: build + production) and docker-compose.yml "
                "(app + PostgreSQL + Redis). Create a make dev command for one-command startup."
            ),
        },
        {
            "id": "C-2", "severity": "CRITICAL",
            "title": "No Commit Standards or Pre-commit Hooks",
            "desc": (
                "No husky, no commitlint, no lint-staged, no prettier configuration. "
                "Commits can have arbitrary messages and unformatted code can be pushed."
            ),
            "fix": (
                "Install husky + commitlint (Conventional Commits: feat, fix, chore, etc.) + "
                "lint-staged (ESLint + Prettier on staged files). Add .prettierrc configuration."
            ),
        },
        {
            "id": "C-3", "severity": "HIGH",
            "title": "Basic CI Pipeline — No Type Checking or Coverage",
            "desc": (
                "GitHub Actions CI only runs lint + build + e2e. "
                "No TypeScript type checking (tsc --noEmit), no test coverage enforcement, "
                "no security auditing (npm audit), no bundle size checks."
            ),
            "fix": (
                "Add CI steps: tsc --noEmit, vitest --coverage with threshold, npm audit, "
                "bundle size comparison via next-bundle-analyzer, and PR preview deployments."
            ),
        },
        {
            "id": "C-4", "severity": "HIGH",
            "title": "No Staging / Preview Environment Strategy",
            "desc": (
                "No staging environment, no preview deployments for PRs. "
                "Changes go directly from local development to production."
            ),
            "fix": (
                "Configure Vercel preview deployments per PR, add a staging branch with "
                "its own database, implement branch protection rules on main."
            ),
        },
        {
            "id": "C-5", "severity": "MEDIUM",
            "title": "No Semantic Versioning or Release Process",
            "desc": (
                "No version tags, no CHANGELOG, no release workflow. "
                "It's impossible to track what was deployed when."
            ),
            "fix": (
                "Add semantic-release or changesets for automated versioning, "
                "CHANGELOG generation, and GitHub Releases on merge to main."
            ),
        },
    ],

    # Category D: False Positives & Misleading Features
    "cat_d_title": "4.4 False Positives & Misleading Features",
    "cat_d_items": [
        {
            "id": "D-1", "severity": "HIGH",
            "title": "Enterprise Plan Shown — No Backend Implementation",
            "desc": (
                "The pricing page displays three tiers: Free, Pro ($19/mo), and Enterprise (Custom). "
                "However, the Enterprise plan has zero backend implementation — no plan logic, "
                "no Stripe price, no feature flags. The CTA says 'Contact Sales' but there is "
                "no contact form or sales flow."
            ),
            "fix": (
                "Either remove the Enterprise tier from the pricing page until implemented, "
                "or add a functional contact form that sends to an admin email via Resend."
            ),
        },
        {
            "id": "D-2", "severity": "HIGH",
            "title": "Fake Social Proof on Landing Page",
            "desc": (
                'The SocialProof component displays fabricated company names: "Acme Inc", '
                '"BuildCo", "DataFlow", "Edge Systems", "NextLayer", "Scale Labs". '
                "For a production SaaS, this damages credibility."
            ),
            "fix": (
                "Either remove the social proof section entirely, replace with real testimonials "
                "or beta user logos, or relabel as 'Trusted by teams like yours' with generic "
                "industry icons instead of fake company names."
            ),
        },
        {
            "id": "D-3", "severity": "MEDIUM",
            "title": "Placeholder Social Links in Footer",
            "desc": (
                "Footer links point to generic URLs: github.com, twitter.com, linkedin.com — "
                "not to actual Ticketify accounts."
            ),
            "fix": (
                "Either link to real social accounts or remove the social links section."
            ),
        },
        {
            "id": "D-4", "severity": "MEDIUM",
            "title": "Mock Data Fallback Could Leak to Production",
            "desc": (
                "src/lib/db/mock-data.ts provides getMockTickets() that returns fake tickets "
                "when the database is unavailable. If DB connection fails in production, "
                "users could see fabricated data."
            ),
            "fix": (
                "Remove mock data fallback from production builds, or guard it behind "
                "NODE_ENV === 'development' check. Show a proper error state instead."
            ),
        },
    ],

    # Category E: SaaS Scaling & Performance
    "cat_e_title": "4.5 SaaS Scaling & Performance",
    "cat_e_items": [
        {
            "id": "E-1", "severity": "HIGH",
            "title": "In-Memory Rate Limiting Won't Scale",
            "desc": (
                "Rate limiting uses an in-memory Map per process. On Vercel (serverless), "
                "each invocation is a new process — the rate limiter resets on every cold start. "
                "The code even has a comment acknowledging this: "
                '"Für Produktion mit mehreren Instanzen: Redis o. ä. verwenden."'
            ),
            "fix": (
                "Migrate rate limiting to Upstash Redis (already optional in cache.ts). "
                "Use the @upstash/ratelimit package for proper distributed rate limiting."
            ),
        },
        {
            "id": "E-2", "severity": "HIGH",
            "title": "In-Memory SSE Broadcast Won't Work Multi-Instance",
            "desc": (
                "Real-time events (SSE) and presence use in-memory Maps. On Vercel or any "
                "multi-instance deployment, each instance has its own event store — "
                "events from instance A won't reach clients on instance B."
            ),
            "fix": (
                "Migrate to Redis Pub/Sub or a managed service like Pusher/Ably for cross-instance "
                "event broadcasting. The code already notes this: "
                '"Bei mehreren Server-Instanzen Redis Pub/Sub oder Pusher verwenden."'
            ),
        },
        {
            "id": "E-3", "severity": "MEDIUM",
            "title": "No Database Connection Pooling Configuration",
            "desc": (
                "Prisma client uses default connection settings. In serverless (Vercel), "
                "this can exhaust database connections rapidly."
            ),
            "fix": (
                "Configure Prisma with connection pooling via PgBouncer or Supabase Pooler. "
                "Add connection_limit parameter in the DATABASE_URL."
            ),
        },
        {
            "id": "E-4", "severity": "MEDIUM",
            "title": "No Caching Strategy for Expensive Queries",
            "desc": (
                "Dashboard KPIs are cached (60s TTL) but ticket lists, reports, and agent lookups "
                "hit the database on every request. No React cache() or unstable_cache() usage."
            ),
            "fix": (
                "Implement Next.js caching with unstable_cache() for expensive queries, "
                "add cache invalidation on mutations, and consider ISR for public pages."
            ),
        },
    ],

    # Category F: AI Integration Review
    "cat_f_title": "4.6 AI Integration Review",
    "cat_f_items": [
        {
            "id": "F-1", "severity": "MEDIUM",
            "title": "No AI Cost Tracking or Budget Limits",
            "desc": (
                "AI requests increment a counter (totalAiRequests) but there are no per-org "
                "budget limits, no cost estimation, and no alerting when usage is high. "
                "A single Pro tenant could rack up unlimited OpenAI costs."
            ),
            "fix": (
                "Add monthly AI request limits per plan tier, implement cost estimation based on "
                "token usage, add admin dashboard for AI usage monitoring, and implement "
                "circuit breaker pattern for OpenAI failures."
            ),
        },
        {
            "id": "F-2", "severity": "MEDIUM",
            "title": "Hardcoded AI Model — No Fallback",
            "desc": (
                'Both draft.ts and instant-solution.ts hardcode "gpt-4o" as the model. '
                "No fallback model if gpt-4o is unavailable, no model configuration per org."
            ),
            "fix": (
                "Make the model configurable via environment variable (OPENAI_MODEL). "
                "Add a fallback model (e.g., gpt-4o-mini) and retry logic with exponential backoff."
            ),
        },
        {
            "id": "F-3", "severity": "LOW",
            "title": "Knowledge Base Search Not Fully Utilized",
            "desc": (
                "Instant Solution uses searchKnowledgeBase() for RAG, but the knowledge base "
                "management UI and CRUD operations are minimal. The feature exists in the "
                "backend but is underexposed."
            ),
            "fix": (
                "Build a full Knowledge Base management UI (Admin only): article CRUD, "
                "categorization, import from CSV/Markdown, and usage analytics."
            ),
        },
    ],

    # Category G: Security
    "cat_g_title": "4.7 Security Considerations",
    "cat_g_items": [
        {
            "id": "G-1", "severity": "HIGH",
            "title": "No Security Headers in Middleware",
            "desc": (
                "The middleware handles locale routing and auth protection but does not set "
                "security headers: no CSP, no X-Frame-Options, no X-Content-Type-Options, "
                "no Strict-Transport-Security."
            ),
            "fix": (
                "Add security headers in middleware or next.config.ts headers config: "
                "Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, "
                "Strict-Transport-Security with max-age."
            ),
        },
        {
            "id": "G-2", "severity": "MEDIUM",
            "title": "No Input Sanitization on Rich Text / Comments",
            "desc": (
                "Comments are stored and rendered without explicit XSS sanitization. "
                "While React auto-escapes JSX, any dangerouslySetInnerHTML or Markdown "
                "rendering could be vulnerable."
            ),
            "fix": (
                "Add DOMPurify or similar sanitization for any user-generated content "
                "that is rendered as HTML/Markdown."
            ),
        },
        {
            "id": "G-3", "severity": "MEDIUM",
            "title": "Cron Endpoint Secret in Query String",
            "desc": (
                "The due-reminders cron endpoint accepts the secret via query parameter "
                "(?secret=...) in addition to Bearer token. Query parameters are logged in "
                "server access logs, exposing the secret."
            ),
            "fix": (
                "Remove query string secret support. Only accept the secret via "
                "Authorization: Bearer header as Vercel Cron does by default."
            ),
        },
    ],

    # Category H: UI/UX Improvements
    "cat_h_title": "4.8 UI/UX Improvements",
    "cat_h_items": [
        {
            "id": "H-1", "severity": "MEDIUM",
            "title": "No Loading States / Skeleton UI on Dashboard",
            "desc": (
                "The dashboard and ticket list rely on TanStack Query's isLoading but show "
                "generic spinners. No skeleton UI for progressive loading."
            ),
            "fix": (
                "Add skeleton components (shadcn/ui Skeleton) for ticket lists, dashboard KPIs, "
                "and report charts. Improves perceived performance."
            ),
        },
        {
            "id": "H-2", "severity": "MEDIUM",
            "title": "No Mobile-Optimized Dashboard Layout",
            "desc": (
                "The dashboard sidebar and ticket detail views are not optimized for mobile. "
                "No responsive drawer pattern, no swipe gestures."
            ),
            "fix": (
                "Implement a responsive drawer sidebar (Sheet component), optimize ticket cards "
                "for touch, add pull-to-refresh, and ensure all CTAs have minimum 44px touch targets."
            ),
        },
        {
            "id": "H-3", "severity": "LOW",
            "title": "Static Product Preview on Landing Page",
            "desc": (
                "The landing page product preview (product-preview.tsx) is a static mock. "
                "An interactive demo or video would convert better."
            ),
            "fix": (
                "Replace with an interactive sandbox, embedded Loom video, or animated walkthrough "
                "using Framer Motion."
            ),
        },
    ],

    # ── Severity Summary ──
    "severity_title": "5. Findings Summary by Severity",
    "severity_headers": ["Severity", "Count", "Categories"],
    "severity_rows": [
        ("CRITICAL", "2", "DevOps (no Docker, no commit standards)"),
        ("HIGH", "9", "Architecture, Code Quality, DevOps, False Positives, Scaling, Security"),
        ("MEDIUM", "12", "All categories — substantial but manageable"),
        ("LOW", "4", "Code Quality, AI, UI/UX — nice-to-have improvements"),
    ],
    "severity_total": "Total: 27 findings",

    # ── Milestones ──
    "milestones_title": "6. Implementation Roadmap — 6 Milestones",
    "milestones_subtitle": "Total Budget: $3,000 (6 × $500)",
    "milestones": [
        {
            "id": "M1",
            "title": "DevOps Foundation & Developer Experience",
            "price": "$500",
            "duration": "~1 week",
            "scope": "C-1, C-2, C-5",
            "deliverables": [
                "Dockerfile (multi-stage) + docker-compose.yml (app + PostgreSQL + Redis)",
                "Husky + commitlint (Conventional Commits) + lint-staged (ESLint + Prettier)",
                ".prettierrc + .editorconfig for consistent code formatting",
                "Semantic versioning setup with automated CHANGELOG generation",
                "Updated README with one-command local dev setup (make dev / docker compose up)",
            ],
            "aligns": "Refactoring · Clean Code · SaaS Scaling",
        },
        {
            "id": "M2",
            "title": "CI/CD Pipeline & Deployment Strategy",
            "price": "$500",
            "duration": "~1 week",
            "scope": "C-3, C-4",
            "deliverables": [
                "Enhanced CI: tsc --noEmit, vitest --coverage (80% threshold), npm audit",
                "Vercel preview deployments per PR with environment isolation",
                "Staging branch with dedicated database (branch protection rules on main)",
                "Bundle size monitoring + PR comments with size diff",
                "GitHub branch protection: require CI pass + code review before merge",
            ],
            "aligns": "SaaS Scaling · Performance · Reliability",
        },
        {
            "id": "M3",
            "title": "Architecture Refactoring & Code Quality",
            "price": "$500",
            "duration": "~1.5 weeks",
            "scope": "A-1, A-2, A-3, B-1, B-2, B-3, B-4",
            "deliverables": [
                "Split organization.ts (693 lines) into domain repositories (5-7 files)",
                "Extract service layer from action files (src/lib/services/)",
                "Eliminate duplicate API route / Server Action paths",
                "Migrate all hardcoded German strings to i18n (messages/en.json, messages/de.json)",
                "Standardize error handling with structured logging (pino)",
                "Configure Vitest setup file with global mocks and test utilities",
            ],
            "aligns": "Refactoring · Clean Code · Architecture",
        },
        {
            "id": "M4",
            "title": "False Positives Cleanup & Production Hardening",
            "price": "$500",
            "duration": "~1 week",
            "scope": "D-1, D-2, D-3, D-4, G-1, G-2, G-3",
            "deliverables": [
                "Remove or implement Enterprise plan (contact form → Resend email)",
                "Replace fake social proof with authentic content or generic alternatives",
                "Fix placeholder footer social links",
                "Guard mock data behind NODE_ENV === 'development'",
                "Add security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)",
                "Add input sanitization for user-generated content (DOMPurify)",
                "Remove cron query-string secret — enforce Bearer-only auth",
            ],
            "aligns": "Reliability · Clean Code · Architecture · SaaS Scaling",
        },
        {
            "id": "M5",
            "title": "Performance, Scaling & AI Improvements",
            "price": "$500",
            "duration": "~1.5 weeks",
            "scope": "E-1, E-2, E-3, E-4, F-1, F-2, F-3",
            "deliverables": [
                "Migrate rate limiting to Upstash Redis (@upstash/ratelimit)",
                "Migrate SSE broadcast to Redis Pub/Sub for multi-instance support",
                "Configure Prisma connection pooling (PgBouncer / connection_limit)",
                "Implement Next.js caching (unstable_cache) for expensive queries",
                "Add AI cost tracking, monthly limits per plan, usage dashboard",
                "Make AI model configurable with fallback + retry logic",
                "Expand Knowledge Base management UI (Admin CRUD + import)",
            ],
            "aligns": "Performance · SaaS Scaling · AI Integrations",
        },
        {
            "id": "M6",
            "title": "UI/UX Polish & Feature Completion",
            "price": "$500",
            "duration": "~1 week",
            "scope": "H-1, H-2, H-3",
            "deliverables": [
                "Skeleton loading states for all data-fetching views",
                "Mobile-responsive dashboard (Sheet drawer sidebar, touch-optimized cards)",
                "Interactive landing page product preview (video or animated demo)",
                "Accessibility audit pass (WCAG 2.1 AA — focus states, ARIA labels, color contrast)",
                "Final integration testing + documentation update",
            ],
            "aligns": "UI/UX · New Features · Performance",
        },
    ],

    # ── Milestone Summary Table ──
    "milestones_summary_title": "Milestone Overview",
    "milestones_summary_headers": ["#", "Milestone", "Findings", "Budget", "Timeline"],

    # ── Closing ──
    "closing_title": "7. Conclusion",
    "closing_body": (
        "Ticketify has a solid technical foundation — the multi-tenancy model is sound, "
        "the AI features are well-integrated, and the documentation is above average. "
        "The 27 findings identified in this audit are not architectural flaws but rather "
        "gaps that prevent the platform from being truly production-ready and scalable.\n\n"
        "The 6-milestone roadmap addresses all 27 findings in a logical sequence: "
        "DevOps foundation first (so all subsequent work benefits from CI/CD, Docker, and commit standards), "
        "followed by architecture refactoring, production hardening, performance scaling, "
        "and finally UI/UX polish.\n\n"
        "Each milestone is scoped to approximately one week of focused work, with clear deliverables "
        "and acceptance criteria. The total investment of $3,000 will transform Ticketify from "
        "a well-built MVP into a production-ready, scalable SaaS platform."
    ),
    "footer_text": "Ticketify Audit Report — Confidential — Omar Rageh",
    "page_label": "Page",
}


# ═══════════════════════════════════════════════════════════════════════════════
#  GERMAN CONTENT
# ═══════════════════════════════════════════════════════════════════════════════
CONTENT_DE = {
    "title": "Ticketify — Codebase-Audit-Bericht",
    "subtitle": "Umfassende technische Bewertung & Verbesserungs-Roadmap",
    "meta_date": "Datum",
    "meta_repo": "Repository",
    "meta_author": "Auditor",
    "meta_scope": "Umfang",
    "meta_date_val": datetime.now().strftime("%d. %B %Y"),
    "meta_repo_val": "Har-dev61/ticketify",
    "meta_author_val": "Omar Rageh — Full-Stack-Engineer",
    "meta_scope_val": "Architektur, Code-Qualität, DevOps, Sicherheit, KI, Performance, UI/UX",

    # ── Executive Summary ──
    "exec_title": "1. Zusammenfassung",
    "exec_body": (
        "Ticketify ist eine gut aufgebaute, KI-gestützte Multi-Tenant-Help-Desk-SaaS-Plattform, "
        "gebaut mit Next.js 15, Prisma, Clerk und Stripe. Die Codebasis zeigt starke Grundlagen: "
        "strikte Mandanten-Isolation über organizationId, eine saubere App-Router-Struktur, "
        "SSE-basierte Echtzeit-Updates, korrekte Plan-Gating-Logik und umfassende Dokumentation.\n\n"
        "Die Prüfung zeigt jedoch <b>27 Befunde in 8 Kategorien</b>, die behoben werden müssen, "
        "um die Plattform produktionsreif und skalierbar zu machen. Kritische Lücken bestehen bei "
        "<b>DevOps-Infrastruktur</b> (kein Docker, keine Commit-Standards, keine Staging-Umgebung), "
        "<b>Code-Qualität</b> (693-Zeilen monolithisches DB-Modul, fest codierte deutsche Strings, leeres Test-Setup), "
        "<b>Falschen Positiven</b> (Enterprise-Plan ohne Backend, gefälschte Social Proofs) und "
        "<b>Performance</b> (In-Memory Rate-Limiting und SSE, die nicht skalieren)."
    ),

    # ── Tech Stack ──
    "stack_title": "2. Technologie-Stack Übersicht",
    "stack_items": [
        ("Framework", "Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui"),
        ("Datenbank", "PostgreSQL + Prisma ORM (Multi-Tenant mit organizationId)"),
        ("Auth", "Clerk (Organisationen, Rollen: Admin / Agent / Customer)"),
        ("Abrechnung", "Stripe (Free $0 vs Pro $19/Monat — Checkout + Webhook)"),
        ("KI", "OpenAI gpt-4o (KI-Antwortvorschläge, Instant-Solution-Deflection)"),
        ("Echtzeit", "SSE (Server-Sent Events) — In-Memory-Broadcast pro Org"),
        ("Caching", "Upstash Redis (optional) oder In-Memory-Fallback"),
        ("E-Mail", "Resend (optional, still wenn nicht konfiguriert)"),
        ("Fehler-Tracking", "Sentry (optional, in Client/Server/Edge verdrahtet)"),
        ("Dateispeicher", "Vercel Blob (Anhänge, 4 MB Limit)"),
        ("Testing", "Vitest (Unit) + Playwright (E2E kritische Flows)"),
        ("CI", "GitHub Actions — lint-and-build + e2e Jobs"),
        ("i18n", "next-intl (en/de), Locale im URL-Pfad"),
    ],

    # ── Stärken ──
    "strengths_title": "3. Was gut gemacht ist",
    "strengths": [
        ("<b>Multi-Tenancy-Durchsetzung</b> — Jede DB-Abfrage in organization.ts ist nach organizationId gefiltert. "
         "Kein mandantenübergreifender Datenzugriff über die DB-Schicht möglich."),
        ("<b>Auth-Architektur</b> — Clerk-Integration mit DB-Rollen-Sync (getCurrentAuth), "
         "automatische Bereitstellung von Org/Member beim ersten Besuch, korrekte Middleware-Absicherung."),
        ("<b>Plan-Gating</b> — KI-Features korrekt hinter dem Pro-Plan mit isPro()-Prüfungen geschützt. "
         "Free-Plan-Limits (3 Agents, 500 Tickets/Monat, 30-Tage-Historie) werden durchgesetzt."),
        ("<b>Rate-Limiting</b> — Angewandt auf Ticket-Erstellung, Kommentare, Login, API-Endpunkte "
         "und KI-Instant-Solutions. Verhindert Missbrauch auf Funktionsebene."),
        ("<b>Audit-Logging</b> — Status-, Zuweisungs-, Prioritäts- und Rollenänderungen werden "
         "mit Cursor-Paginierung und CSV-Export protokolliert."),
        ("<b>Echtzeit-Updates</b> — SSE-basierte Live-Updates mit Presence-Tracking und Tipp-Indikatoren "
         "zur Kollisionsvermeidung auf Ticket-Detailseiten."),
        ("<b>Dokumentation</b> — Umfassendes README zu Setup, Architektur, Testing, CI, Datenmodell. "
         "Separate ARCHITECTURE.md mit Ordnerstruktur."),
        ("<b>Webhook-Verarbeitung</b> — Stripe-Webhook mit korrekter Signaturprüfung (constructEvent). "
         "Clerk-Webhook für Benutzer-Löschung."),
        ("<b>Graceful Degradation</b> — Clerk, Redis, Resend, Sentry und Stripe funktionieren alle optional — "
         "die App läuft ohne einen einzigen externen Dienst."),
    ],

    # ── Findings ──
    "findings_title": "4. Detaillierte Befunde",

    "cat_a_title": "4.1 Architektur & Refactoring",
    "cat_a_items": [
        {
            "id": "A-1", "severity": "HIGH",
            "title": "Monolithisches DB-Modul (organization.ts — 693 Zeilen)",
            "desc": (
                "Alle mandanten-bezogenen DB-Operationen befinden sich in einer einzigen 693-Zeilen-Datei. "
                "Diese Datei verwaltet Organisationen, Mitglieder, Tickets, Kommentare, Anhänge "
                "und Ticket-Verknüpfungen — ein Verstoß gegen das Single-Responsibility-Prinzip."
            ),
            "fix": (
                "Aufteilen in domänenspezifische Module: ticket-repository.ts, comment-repository.ts, "
                "member-repository.ts, attachment-repository.ts usw. Repository-Pattern mit "
                "gemeinsamer organizationId-Injektion."
            ),
        },
        {
            "id": "A-2", "severity": "MEDIUM",
            "title": "Server Actions verteilt auf Route-Verzeichnisse",
            "desc": (
                "Server Actions wie Ticket-CRUD, Kommentare, KI-Entwürfe und Einstellungen sind "
                "in einzelnen Route-Verzeichnissen definiert (z. B. dashboard/tickets/[displayId]/actions.ts). "
                "Manche actions.ts-Dateien überschreiten 400 Zeilen."
            ),
            "fix": (
                "Gemeinsame Geschäftslogik in einen Service-Layer extrahieren (src/lib/services/). "
                "actions.ts-Dateien als dünne Wrapper belassen, die validieren, delegieren und revalidieren."
            ),
        },
        {
            "id": "A-3", "severity": "MEDIUM",
            "title": "Doppelte API-Route und Server-Action-Pfade",
            "desc": (
                "KI-Entwurfsgenerierung existiert sowohl als Server Action (generateAIDraftAction) als auch als "
                "API-Route (POST /api/tickets/[id]/ai-draft). Dies führt zu inkonsistentem Verhalten "
                "und doppelter Wartung."
            ),
            "fix": (
                "Ein Muster pro Feature festlegen. Für Mutationen im Dashboard: Server Actions. "
                "Für externe/API-Konsumenten: API-Routes. Duplikat entfernen."
            ),
        },
    ],

    "cat_b_title": "4.2 Code-Qualität & Clean Code",
    "cat_b_items": [
        {
            "id": "B-1", "severity": "HIGH",
            "title": "Fest codierte deutsche Strings in constants.ts",
            "desc": (
                "src/lib/constants.ts enthält fest codierte deutsche Labels für Status, Prioritäten "
                "und Rollen — obwohl die App ein vollständiges i18n-System (next-intl) hat. "
                "Eine docs/I18N_HARDCODED_STRINGS_REPORT.md bestätigt dieses Problem."
            ),
            "fix": (
                "Alle fest codierten Strings durch Übersetzungsschlüssel mit t() aus next-intl ersetzen. "
                "Constants-Datei entfernen und Nachrichtendateien (messages/en.json, messages/de.json) "
                "als einzige Quelle der Wahrheit verwenden."
            ),
        },
        {
            "id": "B-2", "severity": "MEDIUM",
            "title": "Inkonsistente Fehlermeldungen (gemischt Deutsch/Englisch)",
            "desc": (
                "Einige Server Actions geben fest codierte deutsche Fehlermeldungen zurück "
                '(z. B. „Nicht angemeldet.", „Zu viele Anfragen. Bitte kurz warten."), '
                "während API-Routes englische Fehler zurückgeben."
            ),
            "fix": (
                "getTranslations() konsistent in allen Server Actions und API-Routes verwenden. "
                "Fehlerantworten mit i18n-Schlüsseln standardisieren."
            ),
        },
        {
            "id": "B-3", "severity": "LOW",
            "title": "console.error statt strukturiertes Logging",
            "desc": (
                "Fehlerbehandlung verwendet raw console.error() mit String-Präfixen wie "
                '"[generateAIDraftAction]" oder "[health]". Keine strukturierte Logging-Bibliothek.'
            ),
            "fix": (
                "Leichtgewichtigen Logger (z. B. pino oder winston) einführen, der strukturiertes "
                "JSON mit Severity, Kontext und Zeitstempeln für Produktions-Observability ausgibt."
            ),
        },
        {
            "id": "B-4", "severity": "LOW",
            "title": "Leere Test-Setup-Datei",
            "desc": (
                "src/test/setup.ts enthält nur einen Kommentar. "
                "Keine globalen Mocks, Umgebungsvariablen oder Test-Utilities konfiguriert."
            ),
            "fix": (
                "Globale Test-Mocks (Prisma, Clerk Auth), Umgebungsvariablen, "
                "Test-Datenbank-Bereinigung und gemeinsame Test-Utilities einrichten."
            ),
        },
    ],

    "cat_c_title": "4.3 DevOps & CI/CD-Infrastruktur",
    "cat_c_items": [
        {
            "id": "C-1", "severity": "CRITICAL",
            "title": "Kein Docker oder Container-Support",
            "desc": (
                "Kein Dockerfile, kein docker-compose.yml. Lokale Entwicklung erfordert manuelle Einrichtung "
                "von PostgreSQL, Node.js und Umgebungsvariablen. Onboarding ist langsam und "
                "umgebungsspezifische Fehler häufig."
            ),
            "fix": (
                "Dockerfile (multi-stage: Build + Production) und docker-compose.yml "
                "(App + PostgreSQL + Redis) hinzufügen. make dev Befehl für Ein-Befehls-Start erstellen."
            ),
        },
        {
            "id": "C-2", "severity": "CRITICAL",
            "title": "Keine Commit-Standards oder Pre-Commit-Hooks",
            "desc": (
                "Kein husky, kein commitlint, kein lint-staged, keine Prettier-Konfiguration. "
                "Commits können beliebige Nachrichten haben und unformatierter Code kann gepusht werden."
            ),
            "fix": (
                "Husky + commitlint (Conventional Commits: feat, fix, chore usw.) + "
                "lint-staged (ESLint + Prettier auf gestagten Dateien) installieren. "
                ".prettierrc-Konfiguration hinzufügen."
            ),
        },
        {
            "id": "C-3", "severity": "HIGH",
            "title": "Einfache CI-Pipeline — Kein Type-Checking oder Coverage",
            "desc": (
                "GitHub Actions CI führt nur lint + build + e2e aus. "
                "Kein TypeScript Type-Checking (tsc --noEmit), keine Test-Coverage-Durchsetzung, "
                "kein Security-Auditing (npm audit), keine Bundle-Size-Prüfungen."
            ),
            "fix": (
                "CI-Schritte hinzufügen: tsc --noEmit, vitest --coverage mit Schwellenwert, npm audit, "
                "Bundle-Size-Vergleich via next-bundle-analyzer und PR-Preview-Deployments."
            ),
        },
        {
            "id": "C-4", "severity": "HIGH",
            "title": "Keine Staging- / Preview-Umgebungs-Strategie",
            "desc": (
                "Keine Staging-Umgebung, keine Preview-Deployments für PRs. "
                "Änderungen gehen direkt von lokaler Entwicklung in die Produktion."
            ),
            "fix": (
                "Vercel Preview-Deployments pro PR konfigurieren, Staging-Branch mit "
                "eigener Datenbank hinzufügen, Branch-Protection-Rules auf main implementieren."
            ),
        },
        {
            "id": "C-5", "severity": "MEDIUM",
            "title": "Keine semantische Versionierung oder Release-Prozess",
            "desc": (
                "Keine Versions-Tags, kein CHANGELOG, kein Release-Workflow. "
                "Unmöglich nachzuverfolgen, was wann deployt wurde."
            ),
            "fix": (
                "semantic-release oder changesets für automatisierte Versionierung, "
                "CHANGELOG-Generierung und GitHub Releases bei Merge in main hinzufügen."
            ),
        },
    ],

    "cat_d_title": "4.4 Falsche Positive & Irreführende Features",
    "cat_d_items": [
        {
            "id": "D-1", "severity": "HIGH",
            "title": "Enterprise-Plan angezeigt — Keine Backend-Implementierung",
            "desc": (
                "Die Preisseite zeigt drei Stufen: Free, Pro ($19/Monat) und Enterprise (Custom). "
                "Der Enterprise-Plan hat jedoch null Backend-Implementierung — keine Plan-Logik, "
                "kein Stripe-Preis, keine Feature-Flags. Der CTA sagt 'Kontakt aufnehmen', aber es gibt "
                "kein Kontaktformular und keinen Vertriebsfluss."
            ),
            "fix": (
                "Enterprise-Stufe von der Preisseite entfernen bis implementiert, "
                "oder funktionales Kontaktformular hinzufügen, das per Resend an Admin-E-Mail sendet."
            ),
        },
        {
            "id": "D-2", "severity": "HIGH",
            "title": "Gefälschte Social Proofs auf der Landing Page",
            "desc": (
                'Die SocialProof-Komponente zeigt erfundene Firmennamen: „Acme Inc", '
                '„BuildCo", „DataFlow", „Edge Systems", „NextLayer", „Scale Labs". '
                "Für ein Produktions-SaaS schadet dies der Glaubwürdigkeit."
            ),
            "fix": (
                "Social-Proof-Sektion komplett entfernen, durch echte Testimonials "
                "oder Beta-Nutzer-Logos ersetzen, oder als 'Von Teams wie Ihrem vertraut' "
                "mit generischen Branchen-Icons umbeschriften."
            ),
        },
        {
            "id": "D-3", "severity": "MEDIUM",
            "title": "Platzhalter-Social-Links im Footer",
            "desc": (
                "Footer-Links zeigen auf generische URLs: github.com, twitter.com, linkedin.com — "
                "nicht auf tatsächliche Ticketify-Accounts."
            ),
            "fix": "Entweder auf echte Social-Accounts verlinken oder Social-Links-Sektion entfernen.",
        },
        {
            "id": "D-4", "severity": "MEDIUM",
            "title": "Mock-Daten-Fallback könnte in Produktion auftauchen",
            "desc": (
                "src/lib/db/mock-data.ts stellt getMockTickets() bereit, die gefälschte Tickets zurückgibt, "
                "wenn die Datenbank nicht verfügbar ist. Wenn die DB-Verbindung in Produktion fehlschlägt, "
                "könnten Nutzer fabrizierte Daten sehen."
            ),
            "fix": (
                "Mock-Daten-Fallback aus Production-Builds entfernen oder hinter "
                "NODE_ENV === 'development' absichern. Stattdessen korrekten Fehlerzustand anzeigen."
            ),
        },
    ],

    "cat_e_title": "4.5 SaaS-Skalierung & Performance",
    "cat_e_items": [
        {
            "id": "E-1", "severity": "HIGH",
            "title": "In-Memory Rate-Limiting skaliert nicht",
            "desc": (
                "Rate-Limiting verwendet eine In-Memory Map pro Prozess. Auf Vercel (serverless) "
                "ist jeder Aufruf ein neuer Prozess \u2014 das Rate-Limit wird bei jedem Cold Start zur\u00fcckgesetzt. "
                "Der Code hat sogar einen Kommentar dazu: "
                "\u201eFür Produktion mit mehreren Instanzen: Redis o. \u00e4. verwenden.\u201c"
            ),
            "fix": (
                "Rate-Limiting auf Upstash Redis migrieren (bereits optional in cache.ts). "
                "@upstash/ratelimit Paket für verteiltes Rate-Limiting verwenden."
            ),
        },
        {
            "id": "E-2", "severity": "HIGH",
            "title": "In-Memory SSE-Broadcast funktioniert nicht multi-instanzfähig",
            "desc": (
                "Echtzeit-Events (SSE) und Presence verwenden In-Memory Maps. Auf Vercel oder bei "
                "jeder Multi-Instanz-Bereitstellung hat jede Instanz ihren eigenen Event-Store — "
                "Events von Instanz A erreichen Clients auf Instanz B nicht."
            ),
            "fix": (
                "Auf Redis Pub/Sub oder verwalteten Dienst wie Pusher/Ably für instanzübergreifendes "
                "Event-Broadcasting migrieren."
            ),
        },
        {
            "id": "E-3", "severity": "MEDIUM",
            "title": "Keine Datenbank-Connection-Pooling-Konfiguration",
            "desc": (
                "Prisma-Client verwendet Standard-Verbindungseinstellungen. In serverless (Vercel) "
                "können Datenbankverbindungen schnell erschöpft werden."
            ),
            "fix": (
                "Prisma mit Connection-Pooling via PgBouncer oder Supabase Pooler konfigurieren. "
                "connection_limit-Parameter in DATABASE_URL hinzufügen."
            ),
        },
        {
            "id": "E-4", "severity": "MEDIUM",
            "title": "Keine Caching-Strategie für aufwändige Abfragen",
            "desc": (
                "Dashboard-KPIs werden gecacht (60s TTL), aber Ticket-Listen, Reports und "
                "Agent-Abfragen treffen bei jeder Anfrage die Datenbank."
            ),
            "fix": (
                "Next.js-Caching mit unstable_cache() für aufwändige Abfragen implementieren, "
                "Cache-Invalidierung bei Mutationen hinzufügen."
            ),
        },
    ],

    "cat_f_title": "4.6 KI-Integrations-Review",
    "cat_f_items": [
        {
            "id": "F-1", "severity": "MEDIUM",
            "title": "Keine KI-Kostenerfassung oder Budget-Limits",
            "desc": (
                "KI-Anfragen inkrementieren einen Zähler (totalAiRequests), aber es gibt keine "
                "org-bezogenen Budget-Limits, keine Kostenschätzung und keine Warnungen bei hoher Nutzung."
            ),
            "fix": (
                "Monatliche KI-Anfragelimits pro Plan-Stufe hinzufügen, Kostenschätzung basierend auf "
                "Token-Nutzung implementieren, Admin-Dashboard für KI-Nutzungsüberwachung und "
                "Circuit-Breaker-Pattern für OpenAI-Ausfälle."
            ),
        },
        {
            "id": "F-2", "severity": "MEDIUM",
            "title": "Fest codiertes KI-Modell — Kein Fallback",
            "desc": (
                'Sowohl draft.ts als auch instant-solution.ts haben "gpt-4o" fest codiert. '
                "Kein Fallback-Modell wenn gpt-4o nicht verfügbar, keine Modell-Konfiguration pro Org."
            ),
            "fix": (
                "Modell über Umgebungsvariable konfigurierbar machen (OPENAI_MODEL). "
                "Fallback-Modell (z. B. gpt-4o-mini) und Retry-Logik mit exponentiellem Backoff."
            ),
        },
        {
            "id": "F-3", "severity": "LOW",
            "title": "Wissensdatenbank-Suche nicht voll genutzt",
            "desc": (
                "Instant Solution nutzt searchKnowledgeBase() für RAG, aber die Wissensdatenbank-"
                "Verwaltungs-UI und CRUD-Operationen sind minimal."
            ),
            "fix": (
                "Vollständige Wissensdatenbank-Verwaltungs-UI (nur Admin) erstellen: Artikel-CRUD, "
                "Kategorisierung, Import aus CSV/Markdown und Nutzungsanalysen."
            ),
        },
    ],

    "cat_g_title": "4.7 Sicherheitsaspekte",
    "cat_g_items": [
        {
            "id": "G-1", "severity": "HIGH",
            "title": "Keine Security-Header in Middleware",
            "desc": (
                "Die Middleware verwaltet Locale-Routing und Auth-Schutz, setzt aber keine "
                "Security-Header: kein CSP, kein X-Frame-Options, kein X-Content-Type-Options, "
                "kein Strict-Transport-Security."
            ),
            "fix": (
                "Security-Header in Middleware oder next.config.ts hinzufügen: "
                "Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, "
                "Strict-Transport-Security mit max-age."
            ),
        },
        {
            "id": "G-2", "severity": "MEDIUM",
            "title": "Keine Input-Sanitierung bei Rich-Text / Kommentaren",
            "desc": (
                "Kommentare werden ohne explizite XSS-Sanitierung gespeichert und gerendert. "
                "Obwohl React JSX automatisch escaped, könnte jedes dangerouslySetInnerHTML "
                "oder Markdown-Rendering anfällig sein."
            ),
            "fix": "DOMPurify oder ähnliche Sanitierung für nutzergenerierte Inhalte hinzufügen.",
        },
        {
            "id": "G-3", "severity": "MEDIUM",
            "title": "Cron-Endpoint-Secret im Query-String",
            "desc": (
                "Der Due-Reminders-Cron-Endpoint akzeptiert das Secret über Query-Parameter "
                "(?secret=...) zusätzlich zum Bearer-Token. Query-Parameter werden in "
                "Server-Zugriffslogs protokolliert und legen das Secret offen."
            ),
            "fix": (
                "Query-String-Secret-Unterstützung entfernen. Nur Secret über "
                "Authorization: Bearer-Header akzeptieren."
            ),
        },
    ],

    "cat_h_title": "4.8 UI/UX-Verbesserungen",
    "cat_h_items": [
        {
            "id": "H-1", "severity": "MEDIUM",
            "title": "Keine Loading-States / Skeleton-UI im Dashboard",
            "desc": (
                "Dashboard und Ticket-Liste verlassen sich auf TanStack Querys isLoading, "
                "zeigen aber generische Spinner. Keine Skeleton-UI für progressives Laden."
            ),
            "fix": (
                "Skeleton-Komponenten (shadcn/ui Skeleton) für Ticket-Listen, Dashboard-KPIs "
                "und Report-Charts hinzufügen."
            ),
        },
        {
            "id": "H-2", "severity": "MEDIUM",
            "title": "Kein mobiloptimiertes Dashboard-Layout",
            "desc": (
                "Die Dashboard-Sidebar und Ticket-Detailansichten sind nicht für mobile Geräte optimiert. "
                "Kein responsives Drawer-Pattern, keine Wisch-Gesten."
            ),
            "fix": (
                "Responsive Drawer-Sidebar (Sheet-Komponente) implementieren, Ticket-Karten "
                "für Touch optimieren, Pull-to-Refresh hinzufügen und alle CTAs mit "
                "mindestens 44px Touch-Targets sicherstellen."
            ),
        },
        {
            "id": "H-3", "severity": "LOW",
            "title": "Statische Produktvorschau auf Landing Page",
            "desc": (
                "Die Landing-Page-Produktvorschau (product-preview.tsx) ist ein statisches Mock. "
                "Eine interaktive Demo oder ein Video würde besser konvertieren."
            ),
            "fix": (
                "Durch interaktive Sandbox, eingebettetes Loom-Video oder animierten Walkthrough "
                "mit Framer Motion ersetzen."
            ),
        },
    ],

    # ── Severity Summary ──
    "severity_title": "5. Befundübersicht nach Schweregrad",
    "severity_headers": ["Schweregrad", "Anzahl", "Kategorien"],
    "severity_rows": [
        ("CRITICAL", "2", "DevOps (kein Docker, keine Commit-Standards)"),
        ("HIGH", "9", "Architektur, Code-Qualität, DevOps, Falsche Positive, Skalierung, Sicherheit"),
        ("MEDIUM", "12", "Alle Kategorien — erheblich aber beherrschbar"),
        ("LOW", "4", "Code-Qualität, KI, UI/UX — Nice-to-have Verbesserungen"),
    ],
    "severity_total": "Gesamt: 27 Befunde",

    # ── Milestones ──
    "milestones_title": "6. Implementierungs-Roadmap — 6 Meilensteine",
    "milestones_subtitle": "Gesamtbudget: $3.000 (6 × $500)",
    "milestones": [
        {
            "id": "M1",
            "title": "DevOps-Grundlage & Developer Experience",
            "price": "$500",
            "duration": "~1 Woche",
            "scope": "C-1, C-2, C-5",
            "deliverables": [
                "Dockerfile (multi-stage) + docker-compose.yml (App + PostgreSQL + Redis)",
                "Husky + commitlint (Conventional Commits) + lint-staged (ESLint + Prettier)",
                ".prettierrc + .editorconfig für konsistente Code-Formatierung",
                "Semantische Versionierung mit automatischer CHANGELOG-Generierung",
                "Aktualisiertes README mit Ein-Befehls-Setup (make dev / docker compose up)",
            ],
            "aligns": "Refactoring · Clean Code · SaaS-Skalierung",
        },
        {
            "id": "M2",
            "title": "CI/CD-Pipeline & Deployment-Strategie",
            "price": "$500",
            "duration": "~1 Woche",
            "scope": "C-3, C-4",
            "deliverables": [
                "Erweiterte CI: tsc --noEmit, vitest --coverage (80%-Schwelle), npm audit",
                "Vercel Preview-Deployments pro PR mit Umgebungsisolation",
                "Staging-Branch mit dedizierter Datenbank (Branch-Protection-Rules auf main)",
                "Bundle-Size-Monitoring + PR-Kommentare mit Größenvergleich",
                "GitHub Branch-Protection: CI-Pass + Code-Review vor Merge erforderlich",
            ],
            "aligns": "SaaS-Skalierung · Performance · Zuverlässigkeit",
        },
        {
            "id": "M3",
            "title": "Architektur-Refactoring & Code-Qualität",
            "price": "$500",
            "duration": "~1,5 Wochen",
            "scope": "A-1, A-2, A-3, B-1, B-2, B-3, B-4",
            "deliverables": [
                "organization.ts (693 Zeilen) in Domänen-Repositories aufteilen (5-7 Dateien)",
                "Service-Layer aus Action-Dateien extrahieren (src/lib/services/)",
                "Doppelte API-Route / Server-Action-Pfade eliminieren",
                "Alle fest codierten Strings zu i18n migrieren (messages/en.json, messages/de.json)",
                "Fehlerbehandlung mit strukturiertem Logging (pino) standardisieren",
                "Vitest-Setup mit globalen Mocks und Test-Utilities konfigurieren",
            ],
            "aligns": "Refactoring · Clean Code · Architektur",
        },
        {
            "id": "M4",
            "title": "Falsche-Positive-Bereinigung & Produktions-Härtung",
            "price": "$500",
            "duration": "~1 Woche",
            "scope": "D-1, D-2, D-3, D-4, G-1, G-2, G-3",
            "deliverables": [
                "Enterprise-Plan entfernen oder implementieren (Kontaktformular → Resend E-Mail)",
                "Gefälschte Social Proofs durch authentische Inhalte ersetzen",
                "Platzhalter-Footer-Social-Links korrigieren",
                "Mock-Daten hinter NODE_ENV === 'development' absichern",
                "Security-Header hinzufügen (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)",
                "Input-Sanitierung für nutzergenerierte Inhalte (DOMPurify) hinzufügen",
                "Cron Query-String-Secret entfernen — nur Bearer-Auth erzwingen",
            ],
            "aligns": "Zuverlässigkeit · Clean Code · Architektur · SaaS-Skalierung",
        },
        {
            "id": "M5",
            "title": "Performance, Skalierung & KI-Verbesserungen",
            "price": "$500",
            "duration": "~1,5 Wochen",
            "scope": "E-1, E-2, E-3, E-4, F-1, F-2, F-3",
            "deliverables": [
                "Rate-Limiting auf Upstash Redis migrieren (@upstash/ratelimit)",
                "SSE-Broadcast auf Redis Pub/Sub für Multi-Instanz-Support migrieren",
                "Prisma Connection-Pooling konfigurieren (PgBouncer / connection_limit)",
                "Next.js-Caching (unstable_cache) für aufwändige Abfragen implementieren",
                "KI-Kostenerfassung, monatliche Limits pro Plan, Nutzungs-Dashboard",
                "KI-Modell konfigurierbar machen mit Fallback + Retry-Logik",
                "Wissensdatenbank-Verwaltungs-UI erweitern (Admin-CRUD + Import)",
            ],
            "aligns": "Performance · SaaS-Skalierung · KI-Integrationen",
        },
        {
            "id": "M6",
            "title": "UI/UX-Feinschliff & Feature-Vervollständigung",
            "price": "$500",
            "duration": "~1 Woche",
            "scope": "H-1, H-2, H-3",
            "deliverables": [
                "Skeleton-Loading-States für alle Daten-abrufenden Ansichten",
                "Mobilresponsives Dashboard (Sheet-Drawer-Sidebar, touch-optimierte Karten)",
                "Interaktive Landing-Page-Produktvorschau (Video oder animierte Demo)",
                "Barrierefreiheits-Prüfung (WCAG 2.1 AA — Fokuszustände, ARIA-Labels, Farbkontrast)",
                "Abschließende Integrationstests + Dokumentations-Aktualisierung",
            ],
            "aligns": "UI/UX · Neue Features · Performance",
        },
    ],

    "milestones_summary_title": "Meilenstein-Übersicht",
    "milestones_summary_headers": ["#", "Meilenstein", "Befunde", "Budget", "Zeitraum"],

    # ── Closing ──
    "closing_title": "7. Fazit",
    "closing_body": (
        "Ticketify hat ein solides technisches Fundament — das Multi-Tenancy-Modell ist robust, "
        "die KI-Features sind gut integriert, und die Dokumentation ist überdurchschnittlich. "
        "Die 27 identifizierten Befunde sind keine architektonischen Mängel, sondern Lücken, "
        "die die Plattform daran hindern, wirklich produktionsreif und skalierbar zu sein.\n\n"
        "Die 6-Meilenstein-Roadmap adressiert alle 27 Befunde in logischer Reihenfolge: "
        "DevOps-Grundlage zuerst (damit alle nachfolgenden Arbeiten von CI/CD, Docker und Commit-Standards profitieren), "
        "gefolgt von Architektur-Refactoring, Produktions-Härtung, Performance-Skalierung "
        "und abschließend UI/UX-Feinschliff.\n\n"
        "Jeder Meilenstein ist auf ungefähr eine Woche fokussierte Arbeit ausgelegt, mit klaren Lieferobjekten "
        "und Abnahmekriterien. Die Gesamtinvestition von $3.000 wird Ticketify von "
        "einem gut gebauten MVP in eine produktionsreife, skalierbare SaaS-Plattform verwandeln."
    ),
    "footer_text": "Ticketify Audit-Bericht — Vertraulich — Omar Rageh",
    "page_label": "Seite",
}


# ═══════════════════════════════════════════════════════════════════════════════
#  PDF BUILDER
# ═══════════════════════════════════════════════════════════════════════════════

def severity_style(styles, sev):
    key = {"CRITICAL": "severity_critical", "HIGH": "severity_high",
           "MEDIUM": "severity_medium", "LOW": "severity_low"}.get(sev, "table_cell")
    return styles[key]


def build_finding_table(styles, items):
    """Build a table of findings for one category."""
    col_widths = [28, 48, 150, 130]  # ID, Severity, Issue, Resolution
    header_data = [
        Paragraph("ID", styles["table_header"]),
        Paragraph("Sev.", styles["table_header"]),
        Paragraph("Finding", styles["table_header"]),
        Paragraph("Resolution", styles["table_header"]),
    ]
    rows = [header_data]
    for item in items:
        fix_text = item["fix"] if isinstance(item["fix"], str) else item["fix"]
        rows.append([
            Paragraph(item["id"], styles["table_cell_bold"]),
            Paragraph(item["severity"], severity_style(styles, item["severity"])),
            Paragraph(f'<b>{item["title"]}</b><br/><br/>{item["desc"]}', styles["table_cell"]),
            Paragraph(fix_text, styles["table_cell"]),
        ])

    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def build_milestone_block(styles, m):
    """Build formatted paragraphs for one milestone."""
    elems = []
    elems.append(Paragraph(
        f'<b>{m["id"]} — {m["title"]}</b>  |  {m["price"]}  |  {m["duration"]}',
        styles["h3"]
    ))
    elems.append(Paragraph(f'<i>Findings addressed: {m["scope"]}</i>', styles["small"]))
    elems.append(Spacer(1, 2 * mm))
    for d in m["deliverables"]:
        elems.append(Paragraph(f"• {d}", styles["bullet"]))
    elems.append(Paragraph(
        f'<i>Aligns with: {m["aligns"]}</i>', styles["small"]
    ))
    elems.append(Spacer(1, 3 * mm))
    elems.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    return elems


def build_pdf(lang="en"):
    c = get_content(lang)
    styles = build_styles()
    filename = os.path.join(REPORTS_DIR, f"ticketify_audit_{lang.upper()}.pdf")

    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # Footer
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("DejaVu", 7.5)
        canvas.setFillColor(TEXT_GRAY)
        w, h = A4
        canvas.drawCentredString(
            w / 2, 10 * mm,
            f'{c["footer_text"]}  —  {c["page_label"]} {doc.page}'
        )
        canvas.restoreState()

    story = []

    # ── COVER ──
    story.append(Spacer(1, 35 * mm))
    story.append(HRFlowable(width="60%", thickness=2, color=ACCENT))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(c["title"], styles["title"]))
    story.append(Paragraph(c["subtitle"], styles["subtitle"]))
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="60%", thickness=2, color=ACCENT))
    story.append(Spacer(1, 15 * mm))

    # Meta table
    meta_data = [
        [Paragraph(f'<b>{c["meta_date"]}:</b>', styles["body"]),
         Paragraph(c["meta_date_val"], styles["body"])],
        [Paragraph(f'<b>{c["meta_repo"]}:</b>', styles["body"]),
         Paragraph(c["meta_repo_val"], styles["body"])],
        [Paragraph(f'<b>{c["meta_author"]}:</b>', styles["body"]),
         Paragraph(c["meta_author_val"], styles["body"])],
        [Paragraph(f'<b>{c["meta_scope"]}:</b>', styles["body"]),
         Paragraph(c["meta_scope_val"], styles["body"])],
    ]
    meta_table = Table(meta_data, colWidths=[80, 300])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_table)
    story.append(PageBreak())

    # ── EXECUTIVE SUMMARY ──
    story.append(Paragraph(c["exec_title"], styles["h1"]))
    for para in c["exec_body"].split("\n\n"):
        story.append(Paragraph(para, styles["body"]))
    story.append(PageBreak())

    # ── TECH STACK ──
    story.append(Paragraph(c["stack_title"], styles["h1"]))
    stack_rows = [[
        Paragraph("<b>Component</b>" if lang == "en" else "<b>Komponente</b>", styles["table_header"]),
        Paragraph("<b>Technology</b>" if lang == "en" else "<b>Technologie</b>", styles["table_header"]),
    ]]
    for label, tech in c["stack_items"]:
        stack_rows.append([
            Paragraph(f"<b>{label}</b>", styles["table_cell_bold"]),
            Paragraph(tech, styles["table_cell"]),
        ])
    stack_table = Table(stack_rows, colWidths=[100, 260])
    stack_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(stack_table)

    # ── STRENGTHS ──
    story.append(Paragraph(c["strengths_title"], styles["h1"]))
    for s in c["strengths"]:
        story.append(Paragraph(f"✓ {s}", styles["bullet"]))

    story.append(PageBreak())

    # ── FINDINGS ──
    story.append(Paragraph(c["findings_title"], styles["h1"]))

    for cat_key in ["cat_a", "cat_b", "cat_c", "cat_d", "cat_e", "cat_f", "cat_g", "cat_h"]:
        story.append(Paragraph(c[f"{cat_key}_title"], styles["h2"]))
        story.append(build_finding_table(styles, c[f"{cat_key}_items"]))
        story.append(Spacer(1, 4 * mm))

    story.append(PageBreak())

    # ── SEVERITY SUMMARY ──
    story.append(Paragraph(c["severity_title"], styles["h1"]))
    sev_header = [Paragraph(h, styles["table_header"]) for h in c["severity_headers"]]
    sev_rows = [sev_header]
    for sev, count, cats in c["severity_rows"]:
        sev_rows.append([
            Paragraph(sev, severity_style(styles, sev)),
            Paragraph(count, styles["table_cell_bold"]),
            Paragraph(cats, styles["table_cell"]),
        ])
    sev_table = Table(sev_rows, colWidths=[80, 50, 230])
    sev_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sev_table)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(f'<b>{c["severity_total"]}</b>', styles["body_bold"]))

    story.append(PageBreak())

    # ── MILESTONES ──
    story.append(Paragraph(c["milestones_title"], styles["h1"]))
    story.append(Paragraph(c["milestones_subtitle"], styles["body_bold"]))
    story.append(Spacer(1, 4 * mm))

    for m in c["milestones"]:
        block = build_milestone_block(styles, m)
        story.append(KeepTogether(block))

    story.append(Spacer(1, 5 * mm))

    # Milestone summary table
    story.append(Paragraph(c["milestones_summary_title"], styles["h2"]))
    ms_header = [Paragraph(h, styles["table_header"]) for h in c["milestones_summary_headers"]]
    ms_rows = [ms_header]
    for m in c["milestones"]:
        ms_rows.append([
            Paragraph(m["id"], styles["table_cell_bold"]),
            Paragraph(m["title"], styles["table_cell"]),
            Paragraph(m["scope"], styles["table_cell"]),
            Paragraph(m["price"], styles["table_cell_bold"]),
            Paragraph(m["duration"], styles["table_cell"]),
        ])
    # Total row
    total_label = "Total" if lang == "en" else "Gesamt"
    total_duration = "~7 weeks" if lang == "en" else "~7 Wochen"
    ms_rows.append([
        Paragraph("", styles["table_cell"]),
        Paragraph(f"<b>{total_label}</b>", styles["table_cell_bold"]),
        Paragraph("27 findings", styles["table_cell"]) if lang == "en" else Paragraph("27 Befunde", styles["table_cell"]),
        Paragraph("<b>$3,000</b>", styles["table_cell_bold"]),
        Paragraph(total_duration, styles["table_cell"]),
    ])
    ms_table = Table(ms_rows, colWidths=[30, 150, 70, 50, 60])
    ms_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EDE9FE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ms_table)

    story.append(PageBreak())

    # ── CLOSING ──
    story.append(Paragraph(c["closing_title"], styles["h1"]))
    for para in c["closing_body"].split("\n\n"):
        story.append(Paragraph(para, styles["body"]))

    # Build
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return filename


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  Ticketify Codebase Audit — PDF Report Generator")
    print("=" * 60)
    print()

    en_path = build_pdf("en")
    print(f"  ✓  English report: {en_path}")

    de_path = build_pdf("de")
    print(f"  ✓  German report:  {de_path}")

    print()
    print("  Done! Both reports generated successfully.")
    print("=" * 60)
