# MASTER PROMPT — Migrate Shiftfy's UI to the new design system

> Paste everything below the line into Claude Code, running inside the `schichtplan` repo
> with the new-UI reference files available (see "What you have access to").

---

## ROLE

You are a senior frontend engineer performing a **UI-only re-skin** of an existing,
production Next.js + next-intl + Prisma app called **Shiftfy** (German shift-planning SaaS).
A complete, approved visual redesign already exists as a **static HTML/CSS/JS reference
prototype**. Your job is to port that look-and-feel onto the real React app **without
changing any behavior, data, routes, or copy**.

This is a re-paint, not a rebuild. The house stays; only the paint and layout change.

---

## NON-NEGOTIABLE CONSTRAINTS

1. **100% ELEMENT PARITY** — Do not remove, merge, or simplify any input, button, link,
   table column, nav item, tab, filter, badge, or interactive control that exists today.
   If a form has 5 steps, it still has 5 steps. If there is a DATEV export button, it stays
   and stays prominent.
2. **ZERO CONTENT LOSS** — Every string, label, helper text, blog word, and table header
   stays exactly as written. Never invent copy, never use Lorem Ipsum, never summarize.
   All text continues to come from the existing **next-intl message catalogs**
   (`messages/de.json`, `messages/en.json`) via `useTranslations()` — do NOT hardcode text.
3. **FUNCTIONAL INTEGRITY** — Routes, server actions, API calls, data fetching, form
   submit handlers, validation, auth, and role gating are untouched. The redesign changes
   markup and styling only.
4. **ONLY UPGRADE THE VISUALS** — spacing, typography, color, alignment, component styling,
   states, and responsive layout. Behavior is frozen.
5. **NO BACKEND DRIFT** — Field names, enum values, and prop shapes must keep matching
   Prisma/the API. The reference UI was built against `prisma/schema.prisma` on purpose;
   see `HANDOFF.md` for the exact map. If a redesign detail would require a schema or API
   change, STOP and ask — do not change the backend.

---

## WHAT YOU HAVE ACCESS TO

**The reference prototype** (static, framework-free — read it to learn the target design):

- `Shiftfy Redesign.html` — the full in-app product (all screens, both roles, DE/EN, light/dark)
- `Shiftfy Website.html` — the public marketing site + auth funnel
- `assets/tokens.css` — **the design system source of truth**: color, spacing, type,
  radius, shadow, motion tokens (light + dark)
- `assets/components.css` — every component: buttons, cards, badges, inputs, tables,
  sidebar, topbar, bottom-sheet, tabs, KPIs, progress, skeletons, etc.
- `assets/marketing.css` — marketing-site components (hero, pricing, FAQ, footer, auth)
- `assets/*.js` — screen markup + interaction patterns (mock data; ignore the data, copy
  the structure and class names)
- `HANDOFF.md` — UI→backend mapping: route keys, enum values, model field names, legal
  entity, pricing. **Read this first.**

**The real app** — the `schichtplan` repo you are running in. Treat the existing
components, `messages/*.json`, `prisma/schema.prisma`, server actions, and route structure
as the immovable substrate.

---

## STEP 0 — LEARN THE DESIGN SYSTEM (do this before touching any page)

1. Read `HANDOFF.md` end to end.
2. Read `assets/tokens.css` and port every token into the app's styling layer **once**:
   - If the app uses Tailwind: map tokens into `tailwind.config` theme (colors, spacing,
     borderRadius, boxShadow, fontFamily) + a small `globals.css` `:root`/`.dark` block for
     anything not expressible as a utility. Reuse the exact values.
   - If the app uses CSS variables already: replace their values with these.
   - Keep the **`.dark` class strategy** exactly as in the prototype (class on `<html>`).
3. Read `assets/components.css` and build a **shared component primitives** layer
   (Button, Card, Badge, Input, Select, Table, KPI, Sheet/Dialog, Tabs, SegmentedControl,
   ProgressBar, Avatar, Toast, EmptyState) that reproduces those classes/states. Match
   default / hover / active / focus / disabled for every interactive primitive.
4. Produce a short `DESIGN_SYSTEM.md` documenting the tokens + primitives you created, so
   the rest of the migration just composes them.

Do not start re-skinning pages until the token layer + primitives exist and render.

---

## STEP 1 — AUDIT EACH PAGE BEFORE YOU TOUCH IT

For the page you're about to migrate, output a short **parity checklist** by reading the
CURRENT React source:

- every heading/paragraph (with its i18n key)
- every form field + label + validation
- every button / link / CTA (with its handler)
- every table column header
- every nav/tab/filter/badge
- the data it loads and the actions it calls

Then map each item to its counterpart in the reference prototype's version of that screen.
You may only proceed when every current item has a target style. If the prototype is missing
an element that exists in the real app, **keep the real element** and style it with the
design system — never drop it.

---

## STEP 2 — RE-SKIN, PAGE BY PAGE

Migrate in this order (highest traffic first). After each page: typecheck, run the app,
confirm the page renders and its actions still fire, then move on.

1. App shell — sidebar, topbar, mobile bottom-tabs, role switch, DE/EN, light/dark
2. Dashboard (manager + employee variants)
3. Schichtplan (Tag/Woche/Monat)
4. Stempeluhr · Zeiterfassung
5. Mitarbeiter (list + detail page)
6. Abwesenheiten · Schichttausch · SOS
7. Berichte (charts, donuts, DATEV export)
8. Leistungsnachweis · Compliance · Prüfungssicher · Betriebsrat · Qualifikationen ·
   Abteilungen · Jahresplanung
9. Remaining management/tracking/integration/settings routes
10. Public marketing site + auth funnel (from `Shiftfy Website.html`)

For each page:

- Replace markup + classes with the design-system primitives and the prototype's layout.
- Keep every `useTranslations()` call and message key. Keep every `<form>`, action, and
  handler wired exactly as before.
- Preserve role gating (the prototype mirrors it: management vs employee views).
- Match the prototype's responsive behavior (mobile-first; tables scroll; the week grid
  collapses to a day-strip on mobile; sheets dock to the bottom on mobile and center as
  dialogs on desktop).

---

## GUARDRAILS

- **Never** edit `prisma/schema.prisma`, migrations, server actions' logic, or API contracts.
- **Never** rename or delete an i18n key; if you need a new label, add it to BOTH
  `messages/de.json` and `messages/en.json` and ask first.
- **Never** hardcode German or English strings in components.
- Preserve all `data-testid`, `name`, `id`, and form field names (backend depends on them).
- Keep enum string values exactly (see `HANDOFF.md`) — e.g. Ticket status stays
  `OFFEN`/`IN_BEARBEITUNG`/`GESCHLOSSEN`, ServiceVisit stays
  `GEPLANT`/`EINGECHECKT`/`ABGESCHLOSSEN`/`STORNIERT`.
- If anything in the redesign seems to require a behavior/data change, **stop and ask**
  with the specific tradeoff. Visual-only is the contract.
- Work in small PRs (one page or one primitive group each) so parity is reviewable.

---

## DEFINITION OF DONE (per page)

- Visual parity with the reference prototype (tokens, spacing, states, responsive).
- 100% of the original elements + copy present and functional.
- DE/EN both render from the message catalog; light + dark both correct.
- No TypeScript errors, no console errors, no broken handlers or actions.
- Role gating intact.

Acknowledge this brief, then begin with **Step 0** and show me the `DESIGN_SYSTEM.md` plus
the token layer before re-skinning any page.
