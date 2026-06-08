# Shiftfy UI — Developer Handoff (UI → Backend mapping)

This redesign was built **against the real `prisma/schema.prisma`** so the new UI maps 1:1 onto
the existing API. Field names, enum values, and route keys below match the backend exactly.

## App routes (mirror `sidebar.tsx` navGroups)

**Main:** `dashboard` · `shiftPlan` · `sos` · `zeiterfassung` · `absences` · `shiftSwap` ·
`stempeluhr` · `leistungsnachweis` · `tickets` · `teamCalendar` · `jahresplanung`
**Verwaltung:** `employees` · `departments` · `skills` · `locations` · `compliance` ·
`pruefungssicher` · `betriebsrat` · `shiftTemplates` · `projects` · `clients`
**Auswertung:** `vacationBalance` · `timeAccounts` · `reports` · `payrollExport` · `dataIO` ·
`holidays` · `automationRules`
**Integrationen:** `webhooks` · **Einstellungen:** `settings` · `billing` · `roles`

## Enum values used in the UI (must match Prisma)

| Model             | Field        | Values                                                                                                           |
| ----------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Employee          | contractType | `VOLLZEIT` `TEILZEIT` `MINIJOB` `MIDIJOB`                                                                        |
| Ticket            | status       | `OFFEN` `IN_BEARBEITUNG` `GESCHLOSSEN`                                                                           |
| Ticket            | priority     | `NIEDRIG` `MITTEL` `HOCH` `DRINGEND`                                                                             |
| Ticket            | category     | `SCHICHTPLAN` `ZEITERFASSUNG` `LOHNABRECHNUNG` `TECHNIK` `HR` `QUALITAETSMANGEL` `FEHLENDE_LEISTUNG` `SONSTIGES` |
| ServiceVisit      | status       | `GEPLANT` `EINGECHECKT` `ABGESCHLOSSEN` `STORNIERT`                                                              |
| ServiceReport     | status       | `ENTWURF` `ERSTELLT` `VERSENDET`                                                                                 |
| ShiftPlanApproval | status       | `PENDING` `APPROVED` `REJECTED` `WITHDRAWN`                                                                      |

## Key field names referenced by screens

- **TimeEntry** (`zeiterfassung`): `clockIn` `clockOut` `breakMinutes` `status` `source` (APP/TERMINAL)
- **EmployeeSkill** (`skills`): `certificateNumber` `issuingAuthority` `issuedAt` `expiresAt` `documentUrl`
- **AuditDossier** (`pruefungssicher`): `readinessScore` `passCount` `warnCount` `failCount` `contentHash` `periodStart/End`
- **ShiftPlanApproval** (`betriebsrat`): `title` `periodStart` `periodEnd` `status` + 3-day deadline
- **ServiceReport** (`leistungsnachweis`): `title` `status` `periodStart/End` `totalVisits` `completedVisits`

## Company / legal (real entity — `impressum`, `datenschutz`)

- **Bashabsheh Vergabepartner** — Inhaber Mohammad Bashabsheh
- Kolonnenstraße 8, 10827 Berlin · +49 176 30365636 · info@bashabsheh-vergabepartner.de
- Kleinunternehmer §19 UStG (no VAT) · domain **shiftfy.de**

## Pricing (real — `messages.pricing`)

- **Basic** €2.99/mo (€2.49 annual) · up to 15 employees · 1 location
- **Professional** €4.99/mo (€3.99 annual) · up to 100 employees · 10 locations · DATEV, API
- **Enterprise** custom · unlimited · SSO/SAML (planned)
- **7-day trial**, billed per active user via Stripe.

## Notes

- This is a **visual + interaction reference in HTML/CSS/JS**, not React. Lift tokens
  (`assets/tokens.css`), components (`assets/components.css`), and screen structure.
- Mock data lives in the `screens-*.js` files; replace with real API calls keyed on the
  fields above.
- Both themes (light/dark) and both languages (DE/EN) are fully wired.
