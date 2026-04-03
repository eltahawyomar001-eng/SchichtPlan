# Shiftfy iOS App — Technical Plan

> **Version:** 1.0  
> **Date:** 2025-07-15  
> **Author:** Engineering  
> **Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Analysis — Crewmeister Benchmark](#2-competitive-analysis)
3. [Architecture Decision](#3-architecture-decision)
4. [Apple HIG Compliance](#4-apple-hig-compliance)
5. [Information Architecture & Navigation](#5-information-architecture--navigation)
6. [Screen-by-Screen Specifications](#6-screen-by-screen-specifications)
7. [API Consumption Layer](#7-api-consumption-layer)
8. [Authentication & Biometrics](#8-authentication--biometrics)
9. [Push Notifications (APNs)](#9-push-notifications-apns)
10. [Offline-First Architecture](#10-offline-first-architecture)
11. [Xcode Project Structure](#11-xcode-project-structure)
12. [Privacy & DSGVO Compliance](#12-privacy--dsgvo-compliance)
13. [Testing Strategy](#13-testing-strategy)
14. [App Store Submission Checklist](#14-app-store-submission-checklist)
15. [Milestones & Timeline](#15-milestones--timeline)

---

## 1. Executive Summary

Shiftfy iOS is a **native Swift/SwiftUI** application targeting employees and managers in the German shift-work market. It connects to the existing Shiftfy Next.js backend via REST APIs and provides:

- **One-tap clock-in/out** with elapsed timer
- **Shift plan** with weekly/monthly views
- **Absence requests** with approval workflow
- **Team messaging** (channels + DMs)
- **Push notifications** for shift changes, approvals, and reminders
- **Biometric auth** (Face ID / Touch ID) for fast, secure login
- **Offline-first** design with automatic sync on reconnect

The app must feel **indistinguishable from a first-party Apple app** — no web wrappers, no generic cross-platform UI. Every interaction uses native iOS patterns, SF Symbols, San Francisco typography, and respects the Human Interface Guidelines.

**Minimum deployment target:** iOS 17.0  
**Languages:** Swift 6, SwiftUI  
**Backend:** Existing Next.js REST API at `api.shiftfy.de`

---

## 2. Competitive Analysis

### 2.1 Crewmeister (by ATOSS Aloud GmbH)

| Attribute    | Detail                 |
| ------------ | ---------------------- |
| App Store ID | `id6476493521`         |
| Version      | 2.0.0                  |
| Rating       | 4.1★ (55 reviews)      |
| Size         | ~45 MB                 |
| Min iOS      | 16.0                   |
| Plans        | Go (free) → Easy → Pro |

**Core Features:**

- One-click time clock (Stempeluhr mit Ein-Klick-Stempeln)
- Offline-capable with auto-sync when online
- GPS location tracking (Standortermittlung) — _we intentionally omit this for DSGVO_
- Project time tracking (Projektzeiterfassung)
- Shift plan with push notifications for new/changed shifts
- Absence & vacation management
- Monthly overview (Monatsübersicht)
- Stamp reminders (Stempel-Erinnerungen)
- Break time tracking
- Overtime tracking (Überstundenerfassung)

### 2.2 Shiftfy Competitive Advantages

| Feature            | Crewmeister              | Shiftfy                                           |
| ------------------ | ------------------------ | ------------------------------------------------- |
| Time clock         | ✅ One-click             | ✅ One-tap + elapsed timer                        |
| Shift plan         | ✅ Read-only (employees) | ✅ Read + shift swap requests                     |
| Absence management | ✅ Basic                 | ✅ 7 categories + e-signatures                    |
| GPS tracking       | ✅ (privacy concern)     | ❌ Intentionally omitted (DSGVO)                  |
| Team messaging     | ❌ None                  | ✅ Channels + DMs + typing indicators             |
| Shift swaps        | ❌ Not available         | ✅ Full swap flow with approval                   |
| Service visits     | ❌ Not available         | ✅ Check-in/out + signatures + PDF reports        |
| Biometric auth     | ❌ Standard login        | ✅ Face ID / Touch ID                             |
| Dark Mode          | ⚠️ Partial               | ✅ Full system-aware Dark Mode                    |
| Offline sync       | ✅ Basic                 | ✅ IndexedDB-style queue with conflict resolution |
| Multi-language     | 🇩🇪 German only           | 🇩🇪🇬🇧 German + English                             |
| Vacation balance   | ✅ Basic                 | ✅ Full Urlaubskonto with carry-over              |
| Automation         | ❌ None                  | ✅ Break reminders, overtime alerts, payroll lock |

### 2.3 Opportunity Gaps

1. **No competitor offers in-app team messaging** — this is our killer feature
2. **Shift swaps** are table stakes in hospitality/retail; Crewmeister lacks them
3. **Service visit tracking** with digital signatures serves field service companies
4. **DSGVO-first privacy** (no GPS) is a selling point in the German market

---

## 3. Architecture Decision

### 3.1 Why Native Swift/SwiftUI (Not Capacitor/React Native)

| Criteria              | Capacitor                 | React Native          | Native SwiftUI                       |
| --------------------- | ------------------------- | --------------------- | ------------------------------------ |
| Native feel           | ⚠️ Web in WebView         | ⚠️ Bridge overhead    | ✅ True native                       |
| Face ID/Touch ID      | ⚠️ Plugin-dependent       | ⚠️ Plugin-dependent   | ✅ First-class `LocalAuthentication` |
| APNs integration      | ⚠️ Plugin-dependent       | ⚠️ Plugin-dependent   | ✅ `UserNotifications` framework     |
| SF Symbols            | ❌ Not available          | ⚠️ Partial            | ✅ Full catalog                      |
| Dynamic Type          | ❌ Manual                 | ⚠️ Partial            | ✅ Automatic                         |
| App Store review      | ⚠️ WebView rejection risk | ✅ Generally accepted | ✅ Always accepted                   |
| Performance           | ⚠️ JS bridge latency      | ⚠️ Bridge overhead    | ✅ Metal-accelerated                 |
| Code sharing with web | ✅ Same React codebase    | ⚠️ Partial            | ❌ Separate codebase                 |
| Maintenance           | ⚠️ Plugin compatibility   | ⚠️ Version churn      | ✅ Apple-maintained                  |

**Decision: Native SwiftUI.**

The user requirement is explicit: _"The app must feel like a native iOS application, not a web wrapper."_ SwiftUI gives us:

- Zero-cost integration with iOS system features (widgets, Live Activities, Shortcuts)
- Guaranteed App Store approval
- Future-proof for visionOS / watchOS expansion
- True 120fps animations on ProMotion displays

### 3.2 High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Shiftfy iOS App                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   Views   │  │ViewModels│  │  Models  │  │ Services│ │
│  │ (SwiftUI) │──│ (@Observable)│──│ (Codable)│──│(Network)│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                   │      │
│  ┌──────────────────────────────────────────────── │ ──┐ │
│  │              Persistence Layer                  │   │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────┐ │   │ │
│  │  │ SwiftData │  │ Keychain     │  │ UserDef  │ │   │ │
│  │  │ (offline) │  │ (tokens/bio) │  │ (prefs)  │ │   │ │
│  │  └──────────┘  └──────────────┘  └──────────┘ │   │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                                │
│                    ┌────┴────┐                           │
│                    │  APNs   │                           │
│                    │ Service │                           │
│                    └────┬────┘                           │
└─────────────────────────┼────────────────────────────────┘
                          │  HTTPS (TLS 1.3)
                          ▼
              ┌───────────────────────┐
              │  Shiftfy Next.js API  │
              │  api.shiftfy.de       │
              │  (NextAuth JWT)       │
              └───────────────────────┘
```

### 3.3 Module Breakdown

| Module              | Responsibility                                         |
| ------------------- | ------------------------------------------------------ |
| `ShiftyApp`         | App entry point, `@main`, scene configuration          |
| `Core/Networking`   | `APIClient`, request/response pipeline, JWT management |
| `Core/Auth`         | Login flow, biometric unlock, token refresh, 2FA       |
| `Core/Persistence`  | SwiftData models, offline mutation queue, sync engine  |
| `Core/Push`         | APNs registration, notification handling, deep links   |
| `Features/Clock`    | Stempeluhr — clock-in/out, break, elapsed timer        |
| `Features/Shifts`   | Shift list, week/month views, shift detail             |
| `Features/Absences` | Request form, status list, approval (managers)         |
| `Features/Messages` | Channel list, message thread, typing indicators        |
| `Features/More`     | Profile, settings, vacation balance, availability      |

---

## 4. Apple HIG Compliance

### 4.1 Typography

- **System font:** San Francisco (automatic with SwiftUI `Font.system()`)
- **Dynamic Type:** All text uses `.font(.body)`, `.font(.headline)`, etc.  
  Never hardcode point sizes. Use `@ScaledMetric` for custom spacing.
- **Minimum body:** 17pt (iOS default)
- **Hierarchy:** `.largeTitle` → `.title` → `.headline` → `.body` → `.caption`

### 4.2 Iconography — SF Symbols

Every icon in the app uses SF Symbols (no custom PNGs):

| Function      | SF Symbol                                | Variant            |
| ------------- | ---------------------------------------- | ------------------ |
| Clock In      | `play.circle.fill`                       | Filled when active |
| Clock Out     | `stop.circle.fill`                       | —                  |
| Break         | `cup.and.saucer.fill`                    | —                  |
| Shifts        | `calendar` / `calendar.fill`             | Tab icon           |
| Absences      | `airplane.departure` / `airplane`        | —                  |
| Messages      | `bubble.left.and.bubble.right` / `.fill` | Badge count        |
| More          | `ellipsis.circle` / `.fill`              | —                  |
| Clock tab     | `clock` / `clock.fill`                   | Tab icon           |
| Notifications | `bell` / `bell.fill`                     | Badge              |
| Profile       | `person.circle` / `.fill`                | —                  |
| Settings      | `gearshape` / `.fill`                    | —                  |
| Vacation      | `sun.max` / `.fill`                      | —                  |
| Sick leave    | `cross.case` / `.fill`                   | —                  |
| Swap          | `arrow.triangle.2.circlepath`            | —                  |
| Check mark    | `checkmark.circle.fill`                  | Approval           |
| Reject        | `xmark.circle.fill`                      | Rejection          |
| Offline       | `wifi.slash`                             | Status bar         |
| Sync          | `arrow.triangle.2.circlepath.circle`     | Syncing animation  |

### 4.3 Color System

```swift
extension Color {
    // Brand
    static let shiftyPrimary = Color("ShiftyEmerald")     // #059669
    static let shiftyPrimaryLight = Color("ShiftyEmeraldLight") // #34D399

    // Semantic (auto-adapt light/dark)
    static let shiftyBackground = Color(.systemBackground)
    static let shiftyGroupedBackground = Color(.systemGroupedBackground)
    static let shiftyLabel = Color(.label)
    static let shiftySecondaryLabel = Color(.secondaryLabel)

    // Status
    static let shiftySuccess = Color.green
    static let shiftyWarning = Color.orange
    static let shiftyError = Color.red
    static let shiftyPending = Color.yellow
}
```

- **Dark Mode:** Fully automatic via system colors + asset catalog variants
- **Tint color:** Emerald green `#059669` (matches web app)
- **Accent color:** Set in asset catalog, applied globally

### 4.4 Layout & Thumb Zone

```
┌─────────────────────────┐
│                         │  ← Status bar
│     Navigation Bar      │  ← Title + actions
│─────────────────────────│
│                         │
│                         │
│     Content Area        │  ← Scrollable content
│     (top 70%)           │     Lists, forms, info
│                         │
│                         │
│─────────────────────────│
│                         │
│   PRIMARY ACTIONS       │  ← Bottom 30% — thumb zone
│   (Clock In/Out button) │     Primary CTA, action sheets
│                         │
│─────────────────────────│
│     Tab Bar             │  ← UITabBar (always visible)
└─────────────────────────┘
```

**Rules:**

- Primary CTA buttons always in bottom 30% (thumb zone)
- No hamburger menus — use Tab Bar + push navigation
- Swipe gestures: swipe-left on list items for destructive actions, swipe-right for primary actions
- Pull-to-refresh on all list views
- Long-press for context menus (`.contextMenu`)

### 4.5 Animations & Haptics

- **Transitions:** `.spring(response: 0.35, dampingFraction: 0.85)` for UI state changes
- **Haptics:**
  - `.impact(.light)` — tab switches
  - `.impact(.medium)` — button presses
  - `.notification(.success)` — clock in/out confirmation
  - `.notification(.error)` — validation errors
  - `.selection` — list item selection
- **Loading states:** `ProgressView()` with `.tint(.shiftyPrimary)` — never block UI

### 4.6 Accessibility

- All interactive elements have `.accessibilityLabel()` and `.accessibilityHint()`
- VoiceOver: Full support with custom rotor actions for shift lists
- Reduce Motion: Respect `UIAccessibility.isReduceMotionEnabled` — disable spring animations
- Bold Text: Automatic via Dynamic Type
- Button shapes: Respect `UIAccessibility.buttonShapesEnabled`

---

## 5. Information Architecture & Navigation

### 5.1 Tab Bar Structure

```
┌──────────────────────────────────────────────────────────┐
│  🕐 Stempeluhr  │  📅 Schichten  │  💬 Chat  │  •••  Mehr │
│    (Clock)      │   (Shifts)     │ (Messages)│   (More)  │
└──────────────────────────────────────────────────────────┘
```

**4 tabs** (matches PWA bottom nav, optimized for one-hand use):

| Tab | SF Symbol                                  | Label (DE) | Label (EN) | Primary Screen               |
| --- | ------------------------------------------ | ---------- | ---------- | ---------------------------- |
| 1   | `clock` / `clock.fill`                     | Stempeluhr | Time Clock | Clock-in/out + elapsed timer |
| 2   | `calendar` / `calendar.fill`               | Schichten  | Shifts     | Weekly shift list            |
| 3   | `bubble.left.and.bubble.right` / `.fill`   | Chat       | Chat       | Channel list                 |
| 4   | `ellipsis.circle` / `ellipsis.circle.fill` | Mehr       | More       | Settings hub                 |

**Badge behavior:**

- Tab 3 (Chat): Unread message count badge
- Tab 4 (More): Red dot when pending notifications exist

### 5.2 Navigation Stack per Tab

```
Tab 1: Stempeluhr
  └── ClockView (main clock interface)
       ├── [Manager] → TeamStatusView (team clock status)
       └── [All] → TimeEntryDetailView (past entries)

Tab 2: Schichten
  └── ShiftListView (weekly view, pull-to-refresh)
       ├── ShiftDetailView (shift info, notes)
       ├── ShiftSwapRequestView (request swap)
       ├── AbsenceListView (my absences)
       │    └── AbsenceRequestView (new request form)
       └── [Manager] → ShiftCreateView (create/edit shift)

Tab 3: Chat
  └── ChannelListView (all channels)
       └── MessageThreadView (messages in channel)
            └── ChannelInfoView (members, settings)

Tab 4: Mehr
  └── MoreMenuView (grouped list)
       ├── ProfileView (name, email, photo)
       ├── VacationBalanceView (Urlaubskonto)
       ├── AvailabilityView (weekly availability)
       ├── NotificationSettingsView (preferences)
       ├── AppearanceView (dark mode toggle)
       ├── LanguageView (DE/EN switch)
       ├── SecurityView (biometric toggle, 2FA)
       ├── AboutView (version, legal)
       └── LogoutAction
```

### 5.3 Manager vs Employee Views

The app dynamically shows/hides features based on `SessionUser.role`:

| Feature             | EMPLOYEE | MANAGER           | ADMIN  | OWNER  |
| ------------------- | -------- | ----------------- | ------ | ------ |
| Clock in/out        | ✅ Own   | ✅ Own            | ✅ Own | ✅ Own |
| View team status    | ❌       | ✅                | ✅     | ✅     |
| View own shifts     | ✅       | ✅                | ✅     | ✅     |
| Create/edit shifts  | ❌       | ✅                | ✅     | ✅     |
| Request absence     | ✅       | ✅                | ✅     | ✅     |
| Approve absences    | ❌       | ✅                | ✅     | ✅     |
| Approve shift swaps | ❌       | ✅                | ✅     | ✅     |
| View all employees  | ❌       | ✅ (own location) | ✅     | ✅     |
| Chat                | ✅       | ✅                | ✅     | ✅     |

---

## 6. Screen-by-Screen Specifications

### 6.1 Login Screen

```
┌─────────────────────────┐
│                         │
│      [Shiftfy Logo]     │
│                         │
│  ┌───────────────────┐  │
│  │ E-Mail            │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ Passwort     👁   │  │
│  └───────────────────┘  │
│                         │
│  [  Anmelden  ]  ← emerald, full-width
│                         │
│  ── oder ──             │
│                         │
│  [G] Mit Google         │
│  [M] Mit Microsoft      │
│                         │
│  Passwort vergessen?    │
│                         │
│                         │
│  ┌─────────────────┐   │
│  │  🔐 Face ID     │   │  ← After first login
│  └─────────────────┘   │
└─────────────────────────┘
```

**Behavior:**

- Email field: `.textContentType(.emailAddress)`, `.keyboardType(.emailAddress)`
- Password field: `.textContentType(.password)`, secure toggle
- On success: Store JWT in Keychain, redirect to Tab 1
- Face ID button: Shown after first successful login, retrieves JWT from Keychain
- 2FA flow: If user has TOTP enabled, show 6-digit code input after credentials
- Error states: Inline red text below fields, shake animation on failure

### 6.2 Stempeluhr (Clock) — Tab 1

This is the **hero screen** — the first thing employees see.

```
┌─────────────────────────┐
│ Stempeluhr        🔔 3  │  ← Nav bar + notification bell w/ badge
│─────────────────────────│
│                         │
│      Guten Morgen,      │
│      Omar! 👋           │
│                         │
│   ┌─────────────────┐   │
│   │                 │   │
│   │    02:34:17      │   │  ← Elapsed timer (large, monospaced)
│   │                 │   │
│   │   Seit 08:30     │   │  ← Clock-in time
│   └─────────────────┘   │
│                         │
│   Heute: Mo, 15.07.2025 │
│   Standort: Berlin HQ   │
│                         │
│─────────────────────────│  ← Bottom 30% (thumb zone)
│                         │
│   ┌─────────────────┐   │
│   │                 │   │
│   │  ☕ PAUSE        │   │  ← Secondary action (outline)
│   │                 │   │
│   └─────────────────┘   │
│                         │
│   ┌─────────────────┐   │
│   │                 │   │
│   │  ⏹ AUSSTEMPELN  │   │  ← Primary CTA (filled emerald, 56pt)
│   │                 │   │
│   └─────────────────┘   │
│                         │
│ 🕐 Stempeluhr │📅│💬│•••│  ← Tab bar
└─────────────────────────┘
```

**States:**

| State     | Primary Button        | Secondary          | Timer     |
| --------- | --------------------- | ------------------ | --------- |
| `idle`    | ▶ EINSTEMPELN (green) | —                  | —         |
| `working` | ⏹ AUSSTEMPELN (red)   | ☕ PAUSE (outline) | Running ↑ |
| `break`   | ▶ WEITER (green)      | —                  | Paused    |

**Implementation Notes:**

- Timer uses `TimelineView(.periodic(from: .now, by: 1))` for battery-efficient updates
- Clock-in/out calls `POST /api/time-entries/clock` with `{ action, timezone }`
- Haptic `.notification(.success)` on successful clock action
- Manager section: Collapsible `DisclosureGroup` showing team clock status from `GET /api/time-entries/clock/team`

### 6.3 Schichten (Shifts) — Tab 2

```
┌─────────────────────────┐
│ Schichten    [Woche ▾]  │  ← Segmented control: Woche/Monat
│─────────────────────────│
│ ◀  KW 29 · 14.–20. Jul ▶│  ← Week navigator
│─────────────────────────│
│                         │
│ Mo 14.07                │
│ ┌───────────────────┐   │
│ │ 🟢 08:00 – 16:00  │   │
│ │ Berlin HQ · Kasse  │   │
│ │ Notiz: Einarbeitung│   │
│ └───────────────────┘   │
│                         │
│ Di 15.07                │
│ ┌───────────────────┐   │
│ │ 🟡 14:00 – 22:00  │   │
│ │ Berlin HQ · Lager  │   │  ← Swipe left: Tausch anfragen
│ └───────────────────┘   │
│                         │
│ Mi 16.07                │
│ ┌───────────────────┐   │
│ │ 🔴 Frei            │   │
│ └───────────────────┘   │
│                         │
│ Do 17.07 ...            │
│                         │
│ 🕐│ 📅 Schichten │💬│•••│
└─────────────────────────┘
```

**Interactions:**

- Pull-to-refresh: `GET /api/shifts?weekStart=...&weekEnd=...&employeeId=...`
- Tap on shift card → `ShiftDetailView` (full details, notes, assigned employees)
- Swipe left on shift → Context action: "Tausch anfragen" (request swap) → `POST /api/shift-swaps`
- Week navigation: `< >` buttons with swipe gesture between weeks
- Segmented control: Week view (default) / Month view (calendar grid)
- Color dots: 🟢 Confirmed, 🟡 Pending, 🔴 Day off / empty, 🔵 Open shift (claimable)

**Manager additions:**

- FAB (`.toolbar { ToolbarItem(.bottomBar) }`) for "Schicht erstellen"
- Long-press on shift → Edit / Delete context menu
- Filter by employee / location

### 6.4 Abwesenheiten (Absences) — Accessed from Shifts Tab or More

```
┌─────────────────────────┐
│ ◀ Abwesenheiten    [+]  │  ← Back + create new
│─────────────────────────│
│                         │
│ Ausstehend              │
│ ┌───────────────────┐   │
│ │ 🟡 Urlaub          │   │
│ │ 21.–25. Jul 2025   │   │
│ │ 5 Tage · Eingereicht│   │  ← Swipe: Stornieren
│ └───────────────────┘   │
│                         │
│ Genehmigt               │
│ ┌───────────────────┐   │
│ │ 🟢 Urlaub          │   │
│ │ 04.–08. Aug 2025   │   │
│ │ 5 Tage · Genehmigt │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 🟢 Sonderurlaub    │   │
│ │ 01. Sep 2025       │   │
│ │ 1 Tag · Genehmigt  │   │
│ └───────────────────┘   │
│                         │
│ Abgelehnt               │
│ ┌───────────────────┐   │
│ │ 🔴 Urlaub          │   │
│ │ 14.–16. Jul 2025   │   │
│ │ Grund: Unterbesetzt│   │
│ └───────────────────┘   │
└─────────────────────────┘
```

**New Absence Request (sheet):**

```
┌─────────────────────────┐
│ Abwesenheit beantragen  │  ← Sheet title
│─────────────────────────│
│                         │
│ Kategorie               │
│ [Urlaub             ▾]  │  ← Picker (7 categories)
│                         │
│ Von          Bis        │
│ [15.07.2025] [19.07.2025]│ ← DatePicker
│                         │
│ Anmerkung (optional)    │
│ ┌───────────────────┐   │
│ │                   │   │
│ └───────────────────┘   │
│                         │
│ Resturlaub: 12 Tage     │  ← Dynamic from vacation balance
│                         │
│─────────────────────────│
│                         │
│ [  Antrag senden  ]     │  ← POST /api/absences
│                         │
└─────────────────────────┘
```

**Categories (mapped from Prisma enum):**

| Enum Value     | SF Symbol                       | Label (DE)   |
| -------------- | ------------------------------- | ------------ |
| `URLAUB`       | `sun.max.fill`                  | Urlaub       |
| `KRANK`        | `cross.case.fill`               | Krank        |
| `ELTERNZEIT`   | `figure.and.child.holdinghands` | Elternzeit   |
| `SONDERURLAUB` | `star.fill`                     | Sonderurlaub |
| `UNBEZAHLT`    | `banknote`                      | Unbezahlt    |
| `FORTBILDUNG`  | `book.fill`                     | Fortbildung  |
| `SONSTIGES`    | `ellipsis.circle.fill`          | Sonstiges    |

**Manager additions:**

- Segmented control: "Meine" / "Alle" (My / All)
- Swipe-right on pending: ✅ Genehmigen (approve) → `PATCH /api/absences/:id { status: "GENEHMIGT" }`
- Swipe-left on pending: ❌ Ablehnen (reject) → `PATCH /api/absences/:id { status: "ABGELEHNT" }`

### 6.5 Chat — Tab 3

```
┌─────────────────────────┐
│ Chat              [✏️]  │  ← Compose new channel
│─────────────────────────│
│ 🔍 Suchen               │  ← Search bar
│─────────────────────────│
│                         │
│ ┌───────────────────┐   │
│ │ 👤 #allgemein      │   │
│ │ Lisa: Schicht get.. │   │
│ │             14:32  🔵│  ← Unread indicator
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 👤 #berlin-team    │   │
│ │ Du: Wird gemacht!  │   │
│ │             13:10   │   │
│ └───────────────────┘   │
│ ┌───────────────────┐   │
│ │ 👤 #schichtplan    │   │
│ │ Omar: Kann jemand..│   │
│ │             12:45  🔵│   │
│ └───────────────────┘   │
│                         │
│ 🕐│📅│ 💬 Chat │•••    │
└─────────────────────────┘
```

**Message Thread:**

- Standard `List` with messages, reversed (newest at bottom)
- Typing indicator: "Lisa tippt..." with animated dots
- Message input: `TextField` with send button in thumb zone
- Read receipts: Subtle "Gelesen" label on sent messages
- Pin messages: Long-press → "Anpinnen" context menu action
- Pull-to-load older messages (pagination)

**API Endpoints:**

- `GET /api/chat/channels` — list channels
- `POST /api/chat/channels` — create channel
- `GET /api/chat/channels/:id/messages?limit=50&before=...` — paginated messages
- `POST /api/chat/channels/:id/messages` — send message
- `POST /api/chat/channels/:id/typing` — typing indicator
- `GET /api/chat/channels/:id/read-receipts` — read status

### 6.6 Mehr (More) — Tab 4

```
┌─────────────────────────┐
│ Mehr                    │
│─────────────────────────│
│                         │
│ ┌───────────────────┐   │
│ │ 👤 Omar Rageh      │   │  ← Profile header
│ │    omar@shiftfy.de │   │
│ │    Admin · Berlin  │   │
│ └───────────────────┘   │
│                         │
│ ARBEITSZEIT             │  ← Section header
│ ┌───────────────────┐   │
│ │ 📋 Zeiteinträge    │▶ │  ← Time entries list
│ │ ✈️ Abwesenheiten   │▶ │  ← Absences
│ │ ☀️ Urlaubskonto    │▶ │  ← Vacation balance
│ │ 📊 Verfügbarkeiten│▶ │  ← Availability
│ └───────────────────┘   │
│                         │
│ EINSTELLUNGEN           │
│ ┌───────────────────┐   │
│ │ 🔔 Benachrichtigungen│▶│
│ │ 🌙 Erscheinungsbild│▶ │  ← Dark/Light/System
│ │ 🌐 Sprache        │▶ │  ← DE / EN
│ │ 🔐 Sicherheit     │▶ │  ← Biometric, 2FA
│ └───────────────────┘   │
│                         │
│ INFO                    │
│ ┌───────────────────┐   │
│ │ ℹ️ Über Shiftfy    │▶ │
│ │ 📄 Datenschutz     │▶ │
│ │ 📄 AGB             │▶ │
│ └───────────────────┘   │
│                         │
│ [  Abmelden  ]          │  ← Destructive, red text
│                         │
│ 🕐│📅│💬│ ••• Mehr     │
└─────────────────────────┘
```

**Implementation:** Standard `List` with `Section` groups, `NavigationLink` for each row, SF Symbols for icons.

---

## 7. API Consumption Layer

### 7.1 API Client Architecture

```swift
// Core/Networking/APIClient.swift

actor APIClient {
    static let shared = APIClient()

    private let baseURL = URL(string: "https://api.shiftfy.de")!
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // JWT stored in Keychain
    private var accessToken: String? {
        get { KeychainService.shared.get("accessToken") }
        set { KeychainService.shared.set(newValue, for: "accessToken") }
    }

    func request<T: Decodable>(
        _ endpoint: Endpoint,
        type: T.Type
    ) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: endpoint.path))
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return try decoder.decode(T.self, from: data)
        case 401:
            // Token expired — attempt refresh, then retry once
            try await refreshToken()
            return try await request(endpoint, type: type)
        case 403:
            throw APIError.forbidden
        default:
            let error = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.server(httpResponse.statusCode, error?.error)
        }
    }
}
```

### 7.2 Endpoint Catalog — iOS-Relevant Routes

#### Authentication & Session

| Method | Path                             | iOS Usage                          |
| ------ | -------------------------------- | ---------------------------------- |
| `POST` | `/api/auth/callback/credentials` | Email/password login (NextAuth)    |
| `POST` | `/api/auth/pre-login`            | Check if 2FA required before login |
| `GET`  | `/api/auth/two-factor`           | Get 2FA setup status               |
| `POST` | `/api/auth/two-factor`           | Verify 2FA TOTP code               |
| `GET`  | `/api/auth/session`              | Refresh session / get current user |

#### Time Clock (Stempeluhr)

| Method | Path                           | iOS Usage                                    |
| ------ | ------------------------------ | -------------------------------------------- |
| `POST` | `/api/time-entries/clock`      | Clock in / out / break start / break end     |
| `GET`  | `/api/time-entries/clock`      | Get current clock state (idle/working/break) |
| `GET`  | `/api/time-entries/clock/team` | Manager: team clock statuses                 |

#### Time Entries

| Method   | Path                           | iOS Usage                                       |
| -------- | ------------------------------ | ----------------------------------------------- |
| `GET`    | `/api/time-entries`            | List time entries (paginated, filtered by date) |
| `POST`   | `/api/time-entries`            | Manual time entry creation                      |
| `GET`    | `/api/time-entries/:id`        | Time entry detail                               |
| `PATCH`  | `/api/time-entries/:id`        | Edit time entry                                 |
| `DELETE` | `/api/time-entries/:id`        | Delete time entry                               |
| `POST`   | `/api/time-entries/:id/status` | Manager: approve/reject time entry              |
| `GET`    | `/api/time-entries/export`     | Export time entries (CSV)                       |

#### Shifts

| Method   | Path                      | iOS Usage                                 |
| -------- | ------------------------- | ----------------------------------------- |
| `GET`    | `/api/shifts`             | List shifts (by week, employee, location) |
| `POST`   | `/api/shifts`             | Manager: create shift                     |
| `PATCH`  | `/api/shifts/:id`         | Manager: update shift                     |
| `DELETE` | `/api/shifts/:id`         | Manager: delete shift                     |
| `POST`   | `/api/shifts/:id/claim`   | Employee: claim open shift                |
| `POST`   | `/api/shifts/:id/confirm` | Employee: confirm assigned shift          |

#### Shift Swaps

| Method  | Path                   | iOS Usage                 |
| ------- | ---------------------- | ------------------------- |
| `GET`   | `/api/shift-swaps`     | List swap requests        |
| `POST`  | `/api/shift-swaps`     | Create swap request       |
| `PATCH` | `/api/shift-swaps/:id` | Accept/reject/cancel swap |

#### Absences

| Method   | Path                | iOS Usage                               |
| -------- | ------------------- | --------------------------------------- |
| `GET`    | `/api/absences`     | List absences (own or all for managers) |
| `POST`   | `/api/absences`     | Create absence request                  |
| `PATCH`  | `/api/absences/:id` | Approve/reject/cancel absence           |
| `DELETE` | `/api/absences/:id` | Delete absence (draft only)             |

#### Chat / Messaging

| Method   | Path                                         | iOS Usage                |
| -------- | -------------------------------------------- | ------------------------ |
| `GET`    | `/api/chat/channels`                         | List all channels        |
| `POST`   | `/api/chat/channels`                         | Create channel           |
| `GET`    | `/api/chat/channels/:id/messages`            | Get messages (paginated) |
| `POST`   | `/api/chat/channels/:id/messages`            | Send message             |
| `POST`   | `/api/chat/channels/:id/members`             | Add member to channel    |
| `DELETE` | `/api/chat/channels/:id/members`             | Remove member            |
| `POST`   | `/api/chat/channels/:id/typing`              | Send typing indicator    |
| `GET`    | `/api/chat/channels/:id/typing`              | Get who's typing         |
| `GET`    | `/api/chat/channels/:id/read-receipts`       | Get read receipts        |
| `POST`   | `/api/chat/channels/:id/messages/:msgId/pin` | Pin/unpin message        |

#### Notifications

| Method   | Path                            | iOS Usage                      |
| -------- | ------------------------------- | ------------------------------ |
| `GET`    | `/api/notifications`            | List notifications (paginated) |
| `PATCH`  | `/api/notifications`            | Mark as read (single or all)   |
| `GET`    | `/api/notifications/status`     | Unread count (for badge)       |
| `POST`   | `/api/push-subscriptions`       | Register APNs device token     |
| `DELETE` | `/api/push-subscriptions`       | Remove device token            |
| `GET`    | `/api/notification-preferences` | Get notification settings      |
| `PUT`    | `/api/notification-preferences` | Update notification settings   |

#### Profile & Settings

| Method   | Path                  | iOS Usage                    |
| -------- | --------------------- | ---------------------------- |
| `PATCH`  | `/api/profile`        | Update profile (name, etc.)  |
| `DELETE` | `/api/profile`        | Delete account (DSGVO)       |
| `GET`    | `/api/profile/export` | Export personal data (DSGVO) |
| `GET`    | `/api/workspace`      | Get workspace info           |

#### Supporting Data

| Method | Path                     | iOS Usage                     |
| ------ | ------------------------ | ----------------------------- |
| `GET`  | `/api/employees`         | List employees (for managers) |
| `GET`  | `/api/employees/:id`     | Employee detail               |
| `GET`  | `/api/locations`         | List locations                |
| `GET`  | `/api/departments`       | List departments              |
| `GET`  | `/api/vacation-balances` | Get vacation balance          |
| `GET`  | `/api/availability`      | Get availability settings     |
| `POST` | `/api/availability`      | Update availability           |
| `GET`  | `/api/skills`            | List skills/qualifications    |

### 7.3 Backend Modifications Required

The existing API uses cookie-based NextAuth sessions. For iOS native, we need:

#### Option A: JWT Bearer Token Support (Recommended)

Add a new auth endpoint that returns a JWT directly:

```
POST /api/auth/mobile/login
Body: { email, password, totpCode? }
Response: { token: "eyJ...", user: SessionUser, expiresAt: "..." }

POST /api/auth/mobile/refresh
Header: Authorization: Bearer <token>
Response: { token: "eyJ...", expiresAt: "..." }
```

Modify the existing auth middleware to accept `Authorization: Bearer <token>` in addition to cookies. The JWT payload matches the existing `SessionUser` interface:

```typescript
interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string; // "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE"
  workspaceId: string;
  workspaceName?: string;
  employeeId?: string;
  onboardingCompleted?: boolean;
}
```

#### Option B: Cookie Forwarding

Use the existing NextAuth CSRF + session cookie flow by having the iOS app manage cookies in a `HTTPCookieStorage`. Less clean but requires zero backend changes.

**Recommendation:** Option A — it's cleaner for native apps and enables Keychain storage of a single token string.

### 7.4 Push Subscription Adaptation

The existing `POST /api/push-subscriptions` route stores Web Push subscriptions (endpoint + p256dh + auth keys). For APNs, we need to add a new field:

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String

  // Web Push fields (existing)
  endpoint  String?
  p256dh    String?
  auth      String?

  // APNs fields (new)
  apnsToken String?   // APNs device token (hex string)
  platform  String    @default("web") // "web" | "ios" | "android"

  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId, endpoint])
  @@unique([userId, apnsToken])
}
```

Server-side notification dispatch checks `platform` and routes to Web Push API or APNs accordingly.

---

## 8. Authentication & Biometrics

### 8.1 Login Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Launch App  │────▶│ Has Keychain │─Yes─▶│ Biometric   │
│             │     │   Token?     │     │ Prompt      │
└─────────────┘     └──────────────┘     └──────┬──────┘
                           │                     │
                          No                  Success/Fail
                           │                     │
                           ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │ Login Screen │     │ Validate    │
                    │ (email/pass) │     │ JWT Expiry  │
                    └──────┬──────┘     └──────┬──────┘
                           │                    │
                        Success              Valid?
                           │                 │    │
                           ▼               Yes    No
                    ┌──────────────┐        │     │
                    │ 2FA Required?│        │     ▼
                    └──────┬──────┘        │  ┌───────┐
                       Yes │ No            │  │Refresh│
                           │  │            │  │ Token │
                           ▼  │            │  └───┬───┘
                    ┌────────┐ │           │      │
                    │TOTP    │ │           │   Success?
                    │Input   │ │           │   │    │
                    └───┬────┘ │           │  Yes   No
                        │      │           │   │    │
                        ▼      ▼           ▼   │    ▼
                    ┌──────────────────────────┐│┌──────┐
                    │  Store JWT in Keychain   │││Login │
                    │  Enable Biometric Unlock ││└──────┘
                    │  → Main App (Tab 1)      ││
                    └──────────────────────────┘│
                              ▲                 │
                              └─────────────────┘
```

### 8.2 Biometric Implementation

```swift
// Core/Auth/BiometricService.swift

import LocalAuthentication

actor BiometricService {
    static let shared = BiometricService()

    enum BiometricType {
        case faceID, touchID, none
    }

    var availableBiometric: BiometricType {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }

        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        default: return .none
        }
    }

    func authenticate() async throws -> Bool {
        let context = LAContext()
        context.localizedReason = "Melden Sie sich bei Shiftfy an"
        context.localizedCancelTitle = "Abbrechen"

        return try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Schnelle Anmeldung mit \(biometricName)"
        )
    }

    private var biometricName: String {
        switch availableBiometric {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .none: return "Biometrie"
        }
    }
}
```

### 8.3 Keychain Storage

```swift
// Core/Auth/KeychainService.swift

import Security

final class KeychainService {
    static let shared = KeychainService()

    private let service = "de.shiftfy.ios"

    func set(_ value: String?, for key: String) {
        guard let data = value?.data(using: .utf8) else {
            delete(key)
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)

        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

**Stored Keychain Items:**

| Key                | Value                | Access Control                   |
| ------------------ | -------------------- | -------------------------------- |
| `accessToken`      | JWT string           | `whenUnlockedThisDeviceOnly`     |
| `refreshToken`     | Refresh token string | `whenUnlockedThisDeviceOnly`     |
| `biometricEnabled` | `"true"` / `"false"` | `whenUnlockedThisDeviceOnly`     |
| `lastUserEmail`    | Email for pre-fill   | `afterFirstUnlockThisDeviceOnly` |

### 8.4 Info.plist Privacy Keys

```xml
<key>NSFaceIDUsageDescription</key>
<string>Shiftfy verwendet Face ID für eine schnelle und sichere Anmeldung.</string>
```

---

## 9. Push Notifications (APNs)

### 9.1 Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
│  Shiftfy API │───▶│  APNs Provider   │───▶│  Apple APNs    │
│  (Next.js)   │    │  (server-side)   │    │  Servers       │
└──────────────┘    └──────────────────┘    └───────┬────────┘
                                                     │
                                                     ▼
                                            ┌────────────────┐
                                            │  iOS Device    │
                                            │  Shiftfy App   │
                                            └────────────────┘
```

### 9.2 iOS Client Registration

```swift
// Core/Push/PushNotificationService.swift

import UserNotifications
import UIKit

class PushNotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationService()

    func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self

        do {
            let granted = try await center.requestAuthorization(
                options: [.alert, .badge, .sound, .provisional]
            )

            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }

            return granted
        } catch {
            return false
        }
    }

    // Called when APNs assigns a device token
    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        Task {
            try await APIClient.shared.request(
                .registerPushToken(token: token, platform: "ios"),
                type: EmptyResponse.self
            )
        }
    }

    // Handle notification when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .badge, .sound]
    }

    // Handle notification tap → deep link
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo

        guard let type = userInfo["type"] as? String else { return }

        switch type {
        case "shift_assigned":
            DeepLinkRouter.shared.navigate(to: .shiftDetail(id: userInfo["shiftId"] as? String ?? ""))
        case "absence_approved", "absence_rejected":
            DeepLinkRouter.shared.navigate(to: .absenceDetail(id: userInfo["absenceId"] as? String ?? ""))
        case "swap_request":
            DeepLinkRouter.shared.navigate(to: .shiftSwapDetail(id: userInfo["swapId"] as? String ?? ""))
        case "chat_message":
            DeepLinkRouter.shared.navigate(to: .chatChannel(id: userInfo["channelId"] as? String ?? ""))
        case "clock_reminder":
            DeepLinkRouter.shared.navigate(to: .clock)
        default:
            DeepLinkRouter.shared.navigate(to: .notifications)
        }
    }
}
```

### 9.3 Notification Types

| Type                  | Trigger                        | Title (DE)                     | Body Example                                         |
| --------------------- | ------------------------------ | ------------------------------ | ---------------------------------------------------- |
| `shift_assigned`      | New shift created for employee | Neue Schicht                   | Mo 14.07 · 08:00–16:00 · Berlin HQ                   |
| `shift_changed`       | Shift time/location updated    | Schicht geändert               | Deine Schicht am Mo wurde auf 09:00–17:00 verschoben |
| `shift_cancelled`     | Shift deleted                  | Schicht abgesagt               | Deine Schicht am Mo 14.07 wurde abgesagt             |
| `absence_approved`    | Absence request approved       | Urlaub genehmigt ✅            | Dein Urlaubsantrag vom 21.–25.07 wurde genehmigt     |
| `absence_rejected`    | Absence request rejected       | Urlaub abgelehnt ❌            | Dein Urlaubsantrag vom 21.–25.07 wurde abgelehnt     |
| `swap_request`        | Someone wants to swap          | Tausch-Anfrage                 | Lisa möchte ihre Schicht am Di mit dir tauschen      |
| `swap_approved`       | Manager approved swap          | Tausch genehmigt ✅            | Dein Schichttausch mit Lisa wurde genehmigt          |
| `chat_message`        | New message in channel         | Neue Nachricht                 | Lisa in #allgemein: Schicht getauscht?               |
| `clock_reminder`      | Shift starts in 15 min         | Einstempeln nicht vergessen ⏰ | Deine Schicht beginnt um 08:00                       |
| `time_entry_approved` | Manager approved time entry    | Zeiteintrag genehmigt ✅       | Dein Zeiteintrag vom 14.07 wurde genehmigt           |

### 9.4 Server-Side APNs Integration

Add to the backend (`src/lib/notifications/apns.ts`):

```typescript
import apn from "@parse/node-apn";

const apnProvider = new apn.Provider({
  token: {
    key: process.env.APNS_KEY_PATH!, // .p8 file
    keyId: process.env.APNS_KEY_ID!, // 10-char key ID
    teamId: process.env.APPLE_TEAM_ID!, // Apple Developer Team ID
  },
  production: process.env.NODE_ENV === "production",
});

export async function sendAPNs(
  deviceToken: string,
  notification: {
    title: string;
    body: string;
    badge?: number;
    data?: Record<string, string>;
  },
) {
  const note = new apn.Notification();
  note.alert = { title: notification.title, body: notification.body };
  note.badge = notification.badge ?? 0;
  note.sound = "default";
  note.topic = "de.shiftfy.ios"; // Bundle ID
  note.payload = notification.data ?? {};

  return apnProvider.send(note, deviceToken);
}
```

### 9.5 Notification Categories & Actions

```swift
// Register interactive notification categories
let approveAction = UNNotificationAction(
    identifier: "APPROVE",
    title: "Genehmigen ✅",
    options: .authenticationRequired
)

let rejectAction = UNNotificationAction(
    identifier: "REJECT",
    title: "Ablehnen ❌",
    options: [.destructive, .authenticationRequired]
)

let absenceCategory = UNNotificationCategory(
    identifier: "ABSENCE_REQUEST",
    actions: [approveAction, rejectAction],
    intentIdentifiers: [],
    options: .customDismissAction
)

UNUserNotificationCenter.current().setNotificationCategories([absenceCategory])
```

This allows managers to approve/reject absence requests directly from the notification banner without opening the app.

---

## 10. Offline-First Architecture

### 10.1 Strategy

| Data Type     | Offline Strategy                | Sync Direction  |
| ------------- | ------------------------------- | --------------- |
| Shifts        | Cache on fetch, serve stale     | Server → Client |
| Time entries  | Cache + mutation queue          | Bidirectional   |
| Clock state   | Local state + sync on reconnect | Client → Server |
| Absences      | Cache on fetch                  | Server → Client |
| Chat messages | Cache recent, queue outgoing    | Bidirectional   |
| Notifications | Cache on fetch                  | Server → Client |

### 10.2 SwiftData Models (Offline Cache)

```swift
import SwiftData

@Model
class CachedShift {
    @Attribute(.unique) var id: String
    var employeeId: String
    var startTime: Date
    var endTime: Date
    var locationName: String?
    var status: String  // "SCHEDULED" | "CONFIRMED" | "COMPLETED"
    var notes: String?
    var lastSynced: Date

    init(from shift: APIShift) {
        self.id = shift.id
        self.employeeId = shift.employeeId
        self.startTime = shift.startTime
        self.endTime = shift.endTime
        self.locationName = shift.location?.name
        self.status = shift.status
        self.notes = shift.notes
        self.lastSynced = Date()
    }
}

@Model
class PendingMutation {
    @Attribute(.unique) var idempotencyKey: String
    var endpoint: String        // "/api/time-entries/clock"
    var method: String          // "POST"
    var body: Data?             // JSON body
    var createdAt: Date
    var retryCount: Int = 0
    var lastError: String?

    init(endpoint: String, method: String, body: Data?) {
        self.idempotencyKey = UUID().uuidString
        self.endpoint = endpoint
        self.method = method
        self.body = body
        self.createdAt = Date()
    }
}
```

### 10.3 Sync Engine

```swift
// Core/Persistence/SyncEngine.swift

@Observable
class SyncEngine {
    var isSyncing = false
    var pendingCount = 0

    private let modelContext: ModelContext
    private let apiClient = APIClient.shared

    func enqueueMutation(endpoint: String, method: String, body: Encodable?) async {
        let mutation = PendingMutation(
            endpoint: endpoint,
            method: method,
            body: try? JSONEncoder().encode(body)
        )
        modelContext.insert(mutation)
        try? modelContext.save()
        pendingCount += 1

        // Attempt immediate sync
        await processQueue()
    }

    func processQueue() async {
        guard !isSyncing else { return }
        guard NetworkMonitor.shared.isConnected else { return }

        isSyncing = true
        defer { isSyncing = false }

        let mutations = try? modelContext.fetch(
            FetchDescriptor<PendingMutation>(
                sortBy: [SortDescriptor(\.createdAt)]
            )
        )

        for mutation in mutations ?? [] {
            do {
                try await apiClient.rawRequest(
                    path: mutation.endpoint,
                    method: mutation.method,
                    body: mutation.body,
                    idempotencyKey: mutation.idempotencyKey
                )
                modelContext.delete(mutation)
                pendingCount -= 1
            } catch {
                mutation.retryCount += 1
                mutation.lastError = error.localizedDescription

                if mutation.retryCount >= 5 {
                    // Move to dead-letter queue
                    mutation.lastError = "Max retries exceeded: \(error.localizedDescription)"
                }
            }
        }

        try? modelContext.save()
    }
}
```

### 10.4 Network Monitor

```swift
import Network

@Observable
class NetworkMonitor {
    static let shared = NetworkMonitor()

    var isConnected = true
    var connectionType: NWInterface.InterfaceType?

    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type

                if path.status == .satisfied {
                    await SyncEngine.shared.processQueue()
                }
            }
        }
        monitor.start(queue: .global(qos: .utility))
    }
}
```

### 10.5 Offline UI Indicator

When offline, show a subtle banner below the navigation bar:

```swift
struct OfflineBanner: View {
    @Environment(NetworkMonitor.self) var network

    var body: some View {
        if !network.isConnected {
            HStack {
                Image(systemName: "wifi.slash")
                Text("Offline – Änderungen werden gespeichert")
                    .font(.caption)
            }
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(.ultraThinMaterial)
            .foregroundStyle(.secondary)
        }
    }
}
```

---

## 11. Xcode Project Structure

### 11.1 Directory Layout

```
Shiftfy/
├── Shiftfy.xcodeproj
├── Shiftfy/
│   ├── ShiftyApp.swift                    # @main entry point
│   ├── ContentView.swift                  # Root TabView
│   ├── Info.plist
│   │
│   ├── Core/
│   │   ├── Networking/
│   │   │   ├── APIClient.swift            # Central HTTP client
│   │   │   ├── Endpoint.swift             # Route definitions
│   │   │   ├── APIError.swift             # Error types
│   │   │   └── APIModels.swift            # Codable response types
│   │   │
│   │   ├── Auth/
│   │   │   ├── AuthManager.swift          # Login/logout state machine
│   │   │   ├── BiometricService.swift     # Face ID / Touch ID
│   │   │   ├── KeychainService.swift      # Secure token storage
│   │   │   └── TwoFactorView.swift        # TOTP input screen
│   │   │
│   │   ├── Persistence/
│   │   │   ├── SwiftDataModels.swift      # @Model definitions
│   │   │   ├── SyncEngine.swift           # Offline mutation queue
│   │   │   └── CachePolicy.swift          # TTL / staleness rules
│   │   │
│   │   ├── Push/
│   │   │   ├── PushNotificationService.swift
│   │   │   └── DeepLinkRouter.swift       # Notification → screen
│   │   │
│   │   └── Utilities/
│   │       ├── NetworkMonitor.swift
│   │       ├── HapticManager.swift
│   │       ├── DateFormatters.swift        # German locale formatters
│   │       └── Localization.swift          # DE/EN string management
│   │
│   ├── Features/
│   │   ├── Clock/
│   │   │   ├── ClockView.swift            # Main Stempeluhr screen
│   │   │   ├── ClockViewModel.swift       # Timer logic, API calls
│   │   │   ├── TeamStatusView.swift       # Manager: team overview
│   │   │   └── ElapsedTimerView.swift     # Animated timer display
│   │   │
│   │   ├── Shifts/
│   │   │   ├── ShiftListView.swift        # Weekly shift list
│   │   │   ├── ShiftMonthView.swift       # Monthly calendar grid
│   │   │   ├── ShiftDetailView.swift      # Single shift detail
│   │   │   ├── ShiftViewModel.swift       # Data loading
│   │   │   ├── ShiftSwapView.swift        # Swap request flow
│   │   │   └── ShiftCreateView.swift      # Manager: create/edit
│   │   │
│   │   ├── Absences/
│   │   │   ├── AbsenceListView.swift      # Absence list (grouped)
│   │   │   ├── AbsenceRequestView.swift   # New request sheet
│   │   │   ├── AbsenceViewModel.swift     # CRUD logic
│   │   │   └── AbsenceApprovalView.swift  # Manager: approve/reject
│   │   │
│   │   ├── Messages/
│   │   │   ├── ChannelListView.swift      # Channel list
│   │   │   ├── MessageThreadView.swift    # Message thread
│   │   │   ├── MessageInputView.swift     # Compose bar
│   │   │   ├── ChatViewModel.swift        # WebSocket? Polling?
│   │   │   └── ChannelInfoView.swift      # Members, settings
│   │   │
│   │   └── More/
│   │       ├── MoreMenuView.swift         # Settings hub
│   │       ├── ProfileView.swift          # Edit profile
│   │       ├── VacationBalanceView.swift   # Urlaubskonto
│   │       ├── AvailabilityView.swift     # Weekly availability
│   │       ├── NotificationSettingsView.swift
│   │       ├── SecurityView.swift         # Biometric toggle, 2FA
│   │       └── AboutView.swift            # Version, legal links
│   │
│   ├── Components/
│   │   ├── ShiftyButton.swift             # Primary/secondary button
│   │   ├── ShiftyCard.swift               # Rounded card container
│   │   ├── StatusBadge.swift              # Colored status pill
│   │   ├── EmptyStateView.swift           # No data illustration
│   │   ├── OfflineBanner.swift            # Offline indicator
│   │   └── LoadingOverlay.swift           # Full-screen spinner
│   │
│   ├── Resources/
│   │   ├── Assets.xcassets/               # Colors, app icon
│   │   ├── Localizable.xcstrings          # DE/EN strings
│   │   └── Preview Content/
│   │
│   └── Extensions/
│       ├── Date+Formatting.swift
│       ├── Color+Shiftfy.swift
│       └── View+Haptics.swift
│
├── ShiftyTests/
│   ├── NetworkingTests/
│   ├── AuthTests/
│   ├── ViewModelTests/
│   └── SyncEngineTests/
│
├── ShiftyUITests/
│   ├── ClockFlowTests.swift
│   ├── LoginFlowTests.swift
│   └── ShiftListTests.swift
│
└── ShiftyWidgets/                         # Future: Home Screen widgets
    ├── ClockWidget.swift                  # Show elapsed time
    └── NextShiftWidget.swift              # Show next shift
```

### 11.2 Xcode Configuration

| Setting                | Value                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| Bundle ID              | `de.shiftfy.ios`                                                              |
| Deployment Target      | iOS 17.0                                                                      |
| Swift Version          | 6.0                                                                           |
| Supported Orientations | Portrait only (iPhone)                                                        |
| Capabilities           | Push Notifications, Keychain Sharing, Background Modes (remote-notifications) |
| App Category           | Business                                                                      |
| Primary Language       | German                                                                        |
| App Transport Security | Default (HTTPS only)                                                          |

### 11.3 Dependencies (Swift Package Manager)

| Package                 | Purpose                              | Version |
| ----------------------- | ------------------------------------ | ------- |
| _None required for MVP_ | SwiftUI + Foundation cover all needs | —       |

The goal is **zero external dependencies** for the MVP. SwiftUI, SwiftData, `LocalAuthentication`, `UserNotifications`, `Network`, and `Security` frameworks cover all requirements. This keeps the app lightweight and avoids version-churn maintenance.

---

## 12. Privacy & DSGVO Compliance

### 12.1 Data Collection Summary

| Data Type           | Collected | Purpose                  | Stored Where        |
| ------------------- | --------- | ------------------------ | ------------------- |
| Email + Name        | ✅        | Account & authentication | Server (PostgreSQL) |
| Clock times         | ✅        | Time tracking            | Server (PostgreSQL) |
| Shift assignments   | ✅        | Workforce scheduling     | Server (PostgreSQL) |
| Absence dates       | ✅        | Leave management         | Server (PostgreSQL) |
| Chat messages       | ✅        | Team communication       | Server (PostgreSQL) |
| Device token (APNs) | ✅        | Push notifications       | Server (PostgreSQL) |
| GPS location        | ❌        | **Not collected**        | —                   |
| Contacts            | ❌        | **Not accessed**         | —                   |
| Photos              | ❌        | **Not accessed**         | —                   |
| Health data         | ❌        | **Not accessed**         | —                   |
| Tracking / IDFA     | ❌        | **Not collected**        | —                   |

### 12.2 App Privacy Nutrition Label (App Store)

```
Data Used to Track You: None
Data Linked to You:
  - Contact Info (email, name)
  - Identifiers (user ID)
Data Not Linked to You:
  - Usage Data (crash logs via Sentry)
  - Diagnostics
```

### 12.3 DSGVO User Rights (implemented)

| Right                     | Implementation               | API Endpoint              |
| ------------------------- | ---------------------------- | ------------------------- |
| Right to access           | Export personal data as JSON | `GET /api/profile/export` |
| Right to deletion         | Delete account + anonymize   | `DELETE /api/profile`     |
| Right to rectification    | Edit profile data            | `PATCH /api/profile`      |
| Right to data portability | JSON export                  | `GET /api/profile/export` |

### 12.4 Info.plist Privacy Declarations

```xml
<!-- Only Face ID — no camera, location, contacts, etc. -->
<key>NSFaceIDUsageDescription</key>
<string>Shiftfy verwendet Face ID für eine schnelle und sichere Anmeldung.</string>

<!-- No other privacy keys needed — we don't access location, camera, etc. -->
```

### 12.5 App Tracking Transparency

**Not required.** We do not use IDFA, advertising identifiers, or any cross-app tracking. The ATT prompt is not shown.

---

## 13. Testing Strategy

### 13.1 Unit Tests (`ShiftyTests/`)

| Target             | Test Coverage                                                |
| ------------------ | ------------------------------------------------------------ |
| `APIClient`        | Request building, error handling, JWT injection, retry logic |
| `AuthManager`      | Login flow, token refresh, 2FA flow, logout cleanup          |
| `BiometricService` | Mock LAContext, permission states                            |
| `SyncEngine`       | Enqueue mutation, process queue, retry logic, max retries    |
| `ClockViewModel`   | State transitions (idle→working→break→idle), timer accuracy  |
| `ShiftViewModel`   | Date filtering, week navigation, cache hits                  |
| `AbsenceViewModel` | Category mapping, validation, approval logic                 |
| `DateFormatters`   | German locale formatting, timezone handling                  |

### 13.2 UI Tests (`ShiftyUITests/`)

| Flow            | Steps                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Login           | Enter email → password → tap Anmelden → verify Tab Bar appears               |
| Clock In/Out    | Tap Einstempeln → verify timer starts → tap Ausstempeln → verify timer stops |
| Request Absence | Tab 2 → Abwesenheiten → + → fill form → submit → verify in list              |
| Shift Swap      | Tab 2 → swipe shift → Tausch anfragen → confirm → verify pending             |
| Chat            | Tab 3 → select channel → type message → send → verify appears                |
| Biometric Login | Kill app → relaunch → Face ID prompt → verify auto-login                     |

### 13.3 Test Infrastructure

```swift
// Mock API Client for unit tests
class MockAPIClient: APIClientProtocol {
    var stubbedResponses: [String: Any] = [:]
    var recordedRequests: [Endpoint] = []

    func request<T: Decodable>(_ endpoint: Endpoint, type: T.Type) async throws -> T {
        recordedRequests.append(endpoint)
        guard let response = stubbedResponses[endpoint.path] as? T else {
            throw APIError.notFound
        }
        return response
    }
}
```

---

## 14. App Store Submission Checklist

### 14.1 Pre-Submission

- [ ] Bundle ID registered in Apple Developer portal (`de.shiftfy.ios`)
- [ ] APNs key (.p8) generated and configured
- [ ] App icons (1024×1024 + all @2x/@3x variants) in Asset Catalog
- [ ] Launch screen (SwiftUI-based, no XIB)
- [ ] App Privacy labels completed in App Store Connect
- [ ] Screenshots (6.7" iPhone 15 Pro Max, 6.1" iPhone 15, 5.5" iPhone 8 Plus)
- [ ] German + English App Store description
- [ ] DSGVO / Privacy Policy URL configured
- [ ] TestFlight internal testing complete
- [ ] TestFlight external beta (50+ testers, 2 weeks)

### 14.2 App Store Metadata

| Field       | German                                                                                            | English                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| App Name    | Shiftfy — Schichtplaner                                                                           | Shiftfy — Shift Planner                                                        |
| Subtitle    | Schichtplan · Stempeluhr · Team                                                                   | Shift Plan · Time Clock · Team                                                 |
| Category    | Business                                                                                          | Business                                                                       |
| Keywords    | Schichtplan, Stempeluhr, Zeiterfassung, Dienstplan, Arbeitszeiterfassung, Personalplanung, Urlaub | Shift plan, time clock, time tracking, roster, scheduling, workforce, employee |
| Support URL | https://shiftfy.de/hilfe                                                                          | https://shiftfy.de/help                                                        |
| Privacy URL | https://shiftfy.de/datenschutz                                                                    | https://shiftfy.de/datenschutz                                                 |

### 14.3 Review Guidelines Compliance

| Guideline                   | Status | Notes                               |
| --------------------------- | ------ | ----------------------------------- |
| 4.0 Design                  | ✅     | Native SwiftUI, HIG-compliant       |
| 4.1 Copycats                | ✅     | Original design, own brand          |
| 4.2 Minimum Functionality   | ✅     | Full-featured SaaS app              |
| 5.1.1 Data Collection       | ✅     | Minimal, no tracking                |
| 5.1.2 Data Use              | ✅     | Only for app functionality          |
| 3.1.1 In-App Purchase       | N/A    | Subscriptions via web only (Stripe) |
| 2.1 Performance             | ✅     | Native, no web views                |
| 2.5.1 Software Requirements | ✅     | Uses only public APIs               |

---

## 15. Milestones & Timeline

### Phase 1 — Foundation (Weeks 1–3)

| Week | Deliverable                                                                                  |
| ---- | -------------------------------------------------------------------------------------------- |
| 1    | Xcode project setup, APIClient, KeychainService, Login screen, Bearer token backend endpoint |
| 2    | BiometricService (Face ID/Touch ID), 2FA flow, AuthManager state machine                     |
| 3    | Tab bar shell, NetworkMonitor, OfflineBanner, SwiftData schema, basic navigation             |

### Phase 2 — Core Features (Weeks 4–7)

| Week | Deliverable                                                               |
| ---- | ------------------------------------------------------------------------- |
| 4    | **Stempeluhr** — Clock in/out/break, elapsed timer, haptic feedback       |
| 5    | **Stempeluhr** — Team status (managers), offline clock-in with sync queue |
| 6    | **Schichten** — Shift list (week view), pull-to-refresh, shift detail     |
| 7    | **Schichten** — Month view, shift swap request flow                       |

### Phase 3 — Communication & Absences (Weeks 8–10)

| Week | Deliverable                                                   |
| ---- | ------------------------------------------------------------- |
| 8    | **Abwesenheiten** — Request form, list view, manager approval |
| 9    | **Chat** — Channel list, message thread, send/receive         |
| 10   | **Chat** — Typing indicators, read receipts, pin messages     |

### Phase 4 — Push & Settings (Weeks 11–12)

| Week | Deliverable                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------ |
| 11   | **APNs** — Server-side integration, device token registration, notification handling, deep links |
| 12   | **Mehr** tab — Profile, vacation balance, notification preferences, security settings, about     |

### Phase 5 — Polish & Ship (Weeks 13–15)

| Week | Deliverable                                                             |
| ---- | ----------------------------------------------------------------------- |
| 13   | Offline sync hardening, error states, empty states, accessibility audit |
| 14   | UI polish, animations, Dark Mode testing, localization QA (DE/EN)       |
| 15   | TestFlight beta, crash monitoring (Sentry), App Store submission        |

### Total: ~15 weeks (3.5 months) to App Store

---

## Appendix A: Backend Changes Required

| Change                                                     | Priority | Effort  |
| ---------------------------------------------------------- | -------- | ------- |
| `POST /api/auth/mobile/login` — JWT bearer login           | P0       | 1 day   |
| `POST /api/auth/mobile/refresh` — Token refresh            | P0       | 0.5 day |
| Accept `Authorization: Bearer` header in middleware        | P0       | 0.5 day |
| Add `apnsToken` + `platform` to PushSubscription model     | P1       | 0.5 day |
| APNs provider service (`@parse/node-apn`)                  | P1       | 1 day   |
| Notification dispatch router (web push vs APNs)            | P1       | 1 day   |
| Add `Idempotency-Key` header support for offline mutations | P2       | 1 day   |
| Rate limiting adjustments for mobile client                | P2       | 0.5 day |

**Total backend effort:** ~6 days

## Appendix B: Future Enhancements (Post-MVP)

| Feature                 | Description                                            | Priority |
| ----------------------- | ------------------------------------------------------ | -------- |
| **Home Screen Widgets** | Elapsed clock time + next shift (WidgetKit)            | High     |
| **Live Activities**     | Show active clock session on Lock Screen (ActivityKit) | High     |
| **Apple Watch**         | Clock in/out from wrist (watchOS companion)            | Medium   |
| **Shortcuts**           | "Hey Siri, stempel mich ein" (App Intents)             | Medium   |
| **iCalendar Sync**      | Shift sync to Apple Calendar via `GET /api/ical`       | Medium   |
| **iPad Support**        | Split view layout for managers                         | Low      |
| **visionOS**            | Spatial shift planning (future)                        | Low      |

---

_End of document._
