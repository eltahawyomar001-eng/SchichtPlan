# Shiftfy Design System (redesign)

Step 0 of the UI re-skin: the token layer + shared primitives that every
later page composes. This is a **visual** system — no behavior, routes, copy,
or data shapes change. Source of truth for the look is `shiftfy/` (the static
prototype) and `shiftfy/HANDOFF.md` (the UI→backend map).

## How styling flows

The app is **Tailwind v4** with class-based dark mode
(`@custom-variant dark (&:where(.dark, .dark *))`, the `.dark` class on
`<html>`). Components style themselves with **Tailwind utility classes**, not
raw `var(--token)` — the tokens live in `src/app/globals.css` and are exposed
to utilities through the `@theme inline { … }` block.

Two layers of tokens live in `:root` / `:root.dark`:

1. **Semantic color tokens** (`--background`, `--surface`, `--foreground`, …) —
   wired into utilities via `@theme`, so `bg-surface`, `text-foreground`,
   `border-border` etc. resolve to them. **Re-skin by changing token values.**
2. **Structural scale tokens** (`--s-*` spacing, `--r-*` radius, `--t-*` type,
   `--sh-*` shadow, `--e-*`/`--d-*` motion) — consumed via arbitrary utilities
   like `rounded-[var(--r-md)]`, `shadow-[var(--sh-sm)]`,
   `duration-[var(--d-fast)]`. This matches the app's pre-existing idiom
   (e.g. `shadow-[var(--shadow-sm)]`).

## Token reference

### Decisions baked in (2026-06)

- **Sidebar stays dark slate** (we override the prototype's white sidebar);
  deepened to `#0d1117` in dark to sit on the obsidian canvas.
- **Dark theme is "obsidian"** — bluish-tinted (`#0a0d12` / `#12161d`), not the
  old neutral black.
- **Token naming**: existing names kept; prototype **values** adopted at the
  collision points; new tokens added. Lowest blast radius.

### Color / surface / text

| Token                | Light                 | Dark                   | Utility                 |
| -------------------- | --------------------- | ---------------------- | ----------------------- |
| `--background`       | `#f4f6f9`             | `#0a0d12`              | `bg-background`         |
| `--surface`          | `#ffffff`             | `#12161d`              | `bg-surface`            |
| `--surface-2`        | `#f8fafc`             | `#161b23`              | `bg-surface-2`          |
| `--surface-hover`    | `#f1f5f9`             | `#1b212b`              | `bg-surface-hover`      |
| `--elevated`         | `#ffffff`             | `#171c25`              | `bg-elevated`           |
| `--foreground`       | `#0f172a`             | `#f1f5f9`              | `text-foreground`       |
| `--muted-foreground` | `#475569`             | `#9aa6b6`              | `text-muted-foreground` |
| `--text-3`           | `#94a3b8`             | `#5e6b7e`              | `text-text-3`           |
| `--border`           | `#e7ecf2`             | `#232a35`              | `border-border`         |
| `--border-strong`    | `#d8dfe8`             | `#2c3543`              | `border-border-strong`  |
| `--ring`             | `#059669`             | `#10b981`              | `ring-ring`             |
| `--ring-soft`        | `rgba(5,150,105,.35)` | `rgba(16,185,129,.45)` | `ring-ring-soft`        |

**Brand** — emerald ramp `--brand-50…900` (unchanged, identical to prototype),
exposed as `bg-brand-600`, `text-brand-400`, … plus aliases `--brand`
(=600), `--brand-strong` (=700), `--on-brand` (#fff).

**Cool neutrals** — `--n-0…900` (`bg-n-100`, `border-n-200`, …) for chrome
that shouldn't track the semantic surface tokens.

**Semantic status** (soft fill + solid text). Note **info moved green→blue**:

|         | solid     | soft fill        | utilities                          |
| ------- | --------- | ---------------- | ---------------------------------- |
| success | `#059669` | `--success-soft` | `text-success` / `bg-success-soft` |
| warning | `#d97706` | `--warning-soft` | `text-warning` / `bg-warning-soft` |
| danger  | `#dc2626` | `--danger-soft`  | `text-danger` / `bg-danger-soft`   |
| info    | `#2563eb` | `--info-soft`    | `text-info` / `bg-info-soft`       |

(`--destructive` / `--*-light` are kept as back-compat aliases.)

### Scale tokens (consumed via `var()` in arbitrary utilities)

- **Spacing** `--s-1…10` = 4/8/12/16/20/24/32/40/48/64 px (strict 4pt grid).
  Card padding `--pad-card` 20 / `--pad-card-lg` 24, card gap `--gap-card` 16.
- **Radius** `--r-xs` 8 · `--r-sm` 10 · `--r-md` 14 · `--r-lg` 18 · `--r-xl` 24 ·
  `--r-full`.
- **Type** `--t-xs` 12 … `--t-base` 14 … `--t-3xl` 30 … `--t-5xl` 48 (fixed px).
- **Shadow** `--sh-xs…xl` (soft, layered) + `--sh-brand` (emerald glow) +
  `--ring-focus` (3px focus ring).
- **Motion** `--e-out`, `--e-spring`; `--d-fast` 130 / `--d-base` 220 /
  `--d-slow` 360 ms.

### Fonts (`next/font`, in `src/app/layout.tsx`)

| Var                               | Family      | Use                    |
| --------------------------------- | ----------- | ---------------------- |
| `--font-inter` / `font-sans`      | Inter       | body / UI              |
| `--font-inter-tight` / `font-num` | Inter Tight | numbers, KPIs (`.num`) |
| `--font-geist-mono` / `font-mono` | Geist Mono  | codes/IDs (`.mono`)    |

Helper classes `.num` and `.mono` apply the right family + `tabular-nums`.

## Primitives

### Restyled to tokens (API unchanged)

`src/components/ui/`: **Button** (variants default/destructive/outline/
secondary/ghost/link; sizes default/sm/lg/icon), **Card** (+ Header/Title/
Description/Content/Footer), **Badge** (default/success/info/warning/
destructive/outline), **Input**. These now read from the semantic tokens, so
light/dark + the new palette apply automatically wherever they're used.

> Migration note: their variant names, props, and `displayName`s are
> unchanged — existing usages keep working; only the rendered styling moved.

### New primitives

| File                    | Component          | Prototype class | Purpose                                                                      |
| ----------------------- | ------------------ | --------------- | ---------------------------------------------------------------------------- |
| `segmented-control.tsx` | `SegmentedControl` | `.segmented`    | Tag/Woche/Monat-style single-select toggle (radiogroup, keyboard-accessible) |
| `kpi.tsx`               | `Kpi`              | `.kpi`          | Dashboard metric tile (tinted icon, label, tabular value, trend)             |
| `list-row.tsx`          | `ListRow`          | `.row`          | Standard tappable list item (leading / title+subtitle / trailing / chevron)  |
| `progress-bar.tsx`      | `ProgressBar`      | `.track`        | Thin determinate progress with ARIA semantics + semantic tones               |

### Deferred to their page steps (not generic primitives)

- **Dock** (mobile bottom-tab nav) — built with the **app-shell** migration.
- **Stempeluhr widgets** (`.clock-face`, `.punch-btn`, `.punch-quick`,
  `.punch-pop`, `.live-dot`) — built with the **Stempeluhr** page, where their
  state/interaction lives.
- **Charts** — keep `recharts`; restyle palette to brand/semantic tokens per
  chart as those pages are migrated.

## Conventions for page re-skins (later steps)

- Compose the primitives above; reach for raw token utilities
  (`bg-surface`, `rounded-[var(--r-md)]`, `text-[var(--t-sm)]`) over hardcoded
  Tailwind palette classes (`bg-white`, `text-gray-500`, `rounded-xl`).
- Never hardcode strings — keep `useTranslations()` + the `messages/*.json`
  keys. Never touch `name`/`id`/`data-testid`, enum values, routes, or handlers.
- One page (or one primitive group) per PR so parity stays reviewable.
