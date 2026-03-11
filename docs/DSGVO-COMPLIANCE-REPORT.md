# DSGVO-Compliance-Bericht — Shiftfy (SchichtPlan)

> **Stand:** 09. März 2026
> **Verfasser:** Automatisierter Audit via Lead Software Architect & Datenschutz-Ansprechpartner
> **Commit-Basis:** `main` branch

---

## Zusammenfassung

| Bereich                                | Status           |
| -------------------------------------- | ---------------- |
| 1. GPS & Standort-Purge                | ✅ Implementiert |
| 2. Abwesenheiten — Datenminimierung    | ✅ Implementiert |
| 3. Löschkonzept & Aufbewahrungsfristen | ✅ Implementiert |
| 4. Sicherheit & Infrastruktur          | ✅ Implementiert |
| 5. Verbleibende Empfehlungen           | ⚠️ Kurzfristig   |

---

## 1. GPS- & Standortdaten-Purge

**Status:** ✅ Implementiert

### Technische Umsetzung

#### 1.1 Schema-Migration (`dsgvo_remove_gps_and_location_tracking_fields`)

Alle GPS-Felder wurden aus der Datenbank entfernt:

| Tabelle                | Entfernte Spalten                                                              |
| ---------------------- | ------------------------------------------------------------------------------ |
| `Location`             | `latitude`, `longitude`, `geofenceRadius`                                      |
| `ServiceVisit`         | `checkInLat`, `checkInLng`, `checkOutLat`, `checkOutLng`, `checkInWithinFence` |
| `VisitSignature`       | `signedLat`, `signedLng`                                                       |
| `ServiceVisitAuditLog` | `gpsLat`, `gpsLng`, `gpsAccuracy`, `ipAddress`                                 |

- Bestehende Daten wurden vor dem DROP auf `NULL` gesetzt
- Migration via Supabase MCP angewendet (nicht reversibel)

#### 1.2 Gelöschte Dateien

| Datei                                    | Zweck                                  |
| ---------------------------------------- | -------------------------------------- |
| `src/lib/geofence.ts`                    | Haversine-Berechnung, Geofence-Check   |
| `src/lib/hooks/use-service-gps.ts`       | Client-seitiger GPS-watchPosition-Hook |
| `src/lib/static-map.ts`                  | Statische Kartenbilder für PDFs        |
| `src/__tests__/lib/geofence.test.ts`     | 7 Geofence-Testfälle                   |
| `src/app/api/admin/gps-cleanup/route.ts` | GPS-Daten-Bereinigung (Cron)           |

#### 1.3 Bereinigte Backend-Routen

- **check-in/check-out/signature** — GPS-Parameter aus Audit-Einträgen entfernt
- **visit-audit.ts** — `gpsLat/gpsLng/gpsAccuracy/ipAddress` aus Fingerprint und Checksum entfernt
- **PDF-Route** — GPS-Evidenzblock, Geofence-Badges, statische Karte, `formatDMS()` entfernt
- **Service-Reports** — Geofence-Spalte aus Besuchstabelle entfernt
- **Locations PATCH** — Geo-Feld-Updates entfernt
- **validations.ts** — `updateLocationGeoSchema` bereinigt

#### 1.4 Frontend

- `leistungsnachweis/page.tsx` — GPS-Typen und Geofence-Badge-JSX entfernt
- `service-execution-view.tsx` — GPS-Felder aus Location/Signature-Typen entfernt

#### 1.5 Infrastruktur

- `vercel.json` — GPS-Cleanup-Cron entfernt
- `middleware.ts` — `Permissions-Policy: geolocation=()` (vorher `geolocation=(self)`)

#### 1.6 Bewusst beibehalten

- **`ESignature.ipAddress`** — Nicht GPS-Tracking, sondern rechtlich erforderliche E-Signatur-Dokumentation (eIDAS-Verordnung, §126a BGB). Separate Rechtsgrundlage: Art. 6(1)(c) DSGVO.

### Empfehlung

- `MAPBOX_ACCESS_TOKEN` aus `env.ts` RECOMMENDED-Liste entfernen (Dienst wird nicht mehr genutzt)
- Vercel Blob-Speicher auf verwaiste Kartenbilder prüfen

---

## 2. Abwesenheiten — Datenminimierung (Art. 9 DSGVO)

**Status:** ✅ Implementiert

### Technische Umsetzung

#### 2.1 Schema-Migration (`dsgvo_remove_absence_reason_and_document`)

| Tabelle          | Entfernte Spalten      | Begründung                                            |
| ---------------- | ---------------------- | ----------------------------------------------------- |
| `AbsenceRequest` | `reason` (Text)        | Freitextfeld kann Gesundheitsdaten enthalten (Art. 9) |
| `AbsenceRequest` | `documentUrl` (String) | Ärztliche Atteste = besondere Datenkategorien         |

- Bestehende Daten vor DROP auf `NULL` gesetzt

#### 2.2 API-Änderungen

- **POST /api/absences** — Akzeptiert kein `reason` oder `documentUrl` mehr
- **PATCH /api/absences/[id]** — `documentUrl`-Update-Logik vollständig entfernt
- **GET /api/absences** — Neue Kategorie-Maskierung: Nicht-Management-Nutzer sehen für fremde Abwesenheiten nur `"ABWESEND"` statt spezifischer Kategorie (KRANK, URLAUB etc.)
- **GET /api/annual-planning** — `reason` aus Select entfernt
- **DELETE /api/absences/upload** — Gesamte Upload-Route gelöscht

#### 2.3 Frontend

- Typ `AbsenceRequest` — `reason` und `documentUrl` Felder entfernt
- Formular — Bemerkung-Textarea und Dokumenten-Upload komplett entfernt
- Abwesenheitsliste — Anzeige von `reason` und Dokumenten-Link entfernt
- `PaperclipIcon`-Import entfernt
- i18n-Schlüssel bereinigt (`de.json`, `en.json`): 10 überflüssige Übersetzungen entfernt

### Empfehlung

- Vercel Blob-Speicher: Vorhandene Dateien unter `absences/*` via Blob-API löschen
- `reviewNote` auf Manager-Ansicht beschränken (derzeit nur bei nicht-AUSSTEHEND angezeigt — bereits korrekt)

---

## 3. Löschkonzept (Art. 5(1)(e) — Speicherbegrenzung)

**Status:** ✅ Implementiert

### 3.1 Automatische Datenbereinigung

**Neuer Endpunkt:** `POST/GET /api/admin/data-retention`
**Cron:** Sonntags 04:30 UTC (`vercel.json`)
**Manuelle Ausführung:** Nur OWNER/ADMIN

| Datentyp                   | Aufbewahrung | Rechtsgrundlage                       |
| -------------------------- | ------------ | ------------------------------------- |
| `VerificationToken`        | 7 Tage       | Keine gesetzl. Aufbewahrungspflicht   |
| `PasswordResetToken`       | 7 Tage       | Keine gesetzl. Aufbewahrungspflicht   |
| `Session`                  | 30 Tage      | Art. 6(1)(b) — abgelaufene Sessions   |
| `Invitation` (abgelaufen)  | 30 Tage      | Keine gesetzl. Aufbewahrungspflicht   |
| `Notification`             | 90 Tage      | Keine gesetzl. Aufbewahrungspflicht   |
| `ExportJob`                | 90 Tage      | Keine gesetzl. Aufbewahrungspflicht   |
| `AutoFillLog`              | 90 Tage      | Keine gesetzl. Aufbewahrungspflicht   |
| `ManagerAlert` (bestätigt) | 90 Tage      | Keine gesetzl. Aufbewahrungspflicht   |
| `AutoScheduleRun`          | 180 Tage     | Keine gesetzl. Aufbewahrungspflicht   |
| `PushSubscription`         | 180 Tage     | Keine gesetzl. Aufbewahrungspflicht   |
| `AuditLog`                 | 365 Tage     | Art. 6(1)(f) — berechtigtes Interesse |
| `ChatMessage`              | 365 Tage     | Keine gesetzl. Aufbewahrungspflicht   |
| `ESignature`               | **10 Jahre** | §147 AO, eIDAS-Verordnung             |
| `ServiceVisitAuditLog`     | **10 Jahre** | §147 AO — Handels-/Steuerrecht        |
| `TimeEntryAudit`           | **10 Jahre** | §147 AO — Lohnbuchhaltung             |

### 3.2 Nuclear Option (Art. 17 & Art. 28)

**Neuer Endpunkt:** `DELETE /api/admin/workspace-wipe`

- Nur durch Workspace-OWNER auslösbar
- Explizite Bestätigung erforderlich: `{ "confirm": "DELETE-<workspaceId>" }`
- Löscht den gesamten Workspace via Prisma `onDelete: Cascade`
- Alle Kinder-Tabellen werden kaskadierend gelöscht
- **Irreversibel** — kein Undo
- Stripe-Abo muss separat über Kundenportal gekündigt werden

### 3.3 Nicht automatisch gelöschte Daten

| Datentyp                         | Grund                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| `Employee`, `Shift`, `TimeEntry` | Aktive Geschäftsdaten — Löschung via Employee-Deaktivierung |
| `AbsenceRequest`                 | Urlaubsplanung — aktive Geschäftslogik                      |
| `MonthClose`                     | Lohnbuchhaltung — §147 AO (10 Jahre)                        |
| `Subscription`                   | Stripe-Vertragsdaten — Vertragslaufzeit                     |

### Empfehlung

- Anonymisierungsoption für Ex-Mitarbeiter (Art. 17(3)(b) — Arbeitsrecht): Personenbezogene Daten durch Platzhalter ersetzen, statistische Daten behalten
- DSGVO-Export-Funktion (Art. 15/20) für Mitarbeiterdaten implementieren

---

## 4. Sicherheit & Infrastruktur

**Status:** ✅ Implementiert

### 4.1 Transport & Verschlüsselung

| Maßnahme               | Status | Details                                                                   |
| ---------------------- | ------ | ------------------------------------------------------------------------- |
| HTTPS/TLS              | ✅     | Vercel erzwingt TLS — kein HTTP möglich                                   |
| HSTS                   | ✅     | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| CSP                    | ✅     | Per-Request Nonce, `script-src 'nonce-…' 'strict-dynamic'`                |
| X-Frame-Options        | ✅     | `DENY` — kein Embedding möglich                                           |
| X-Content-Type-Options | ✅     | `nosniff`                                                                 |
| Referrer-Policy        | ✅     | `strict-origin-when-cross-origin`                                         |
| Permissions-Policy     | ✅     | `camera=(), microphone=(), geolocation=(), interest-cohort=()`            |

### 4.2 Authentifizierung & Autorisierung

| Maßnahme            | Status | Details                                                    |
| ------------------- | ------ | ---------------------------------------------------------- |
| Session-Mgmt        | ✅     | NextAuth 4 mit JWT-Sessions                                |
| RBAC                | ✅     | 4-Rollen-Hierarchie: OWNER > ADMIN > MANAGER > EMPLOYEE    |
| Permissions-Matrix  | ✅     | 25+ Ressourcen × 5 Aktionen, zentral in `authorization.ts` |
| Workspace-Isolation | ✅     | Jede DB-Abfrage filtert nach `workspaceId`                 |

### 4.3 Rate Limiting

| Endpunkt    | Limit      | Implementierung              |
| ----------- | ---------- | ---------------------------- |
| Auth-Routen | 10 Req/60s | Upstash Redis Sliding Window |
| API-Routen  | 60 Req/60s | Upstash Redis Sliding Window |
| IP-basiert  | ✅         | `x-forwarded-for` Header     |

### 4.4 Monitoring & Fehlerbehandlung

| Dienst                  | DSGVO-Konformität | Details                                                           |
| ----------------------- | ----------------- | ----------------------------------------------------------------- |
| Sentry (Error)          | ✅ Art. 6(1)(f)   | Fehler-Monitoring unter berechtigtem Interesse                    |
| Sentry (Replay/Tracing) | ✅ Art. 6(1)(a)   | Nur nach Cookie-Consent (`analytics`) aktiviert                   |
| Logging                 | ✅                | Strukturiertes Logging via `src/lib/logger.ts`, keine PII in Logs |

### 4.5 Drittanbieter-Dienste

| Dienst      | Zweck                     | DPA vorhanden?                         |
| ----------- | ------------------------- | -------------------------------------- |
| Vercel      | Hosting, Serverless, Edge | ✅ Standard-DPA                        |
| Supabase    | PostgreSQL-Datenbank      | ✅ Standard-DPA (EU Region: eu-west-1) |
| Stripe      | Abrechnung                | ✅ Standard-DPA                        |
| Upstash     | Redis Rate-Limiting       | ✅ Standard-DPA (EU Region)            |
| Sentry      | Error-Monitoring          | ✅ Standard-DPA                        |
| Vercel Blob | Datei-Speicher            | ✅ Teil des Vercel-DPA                 |

### 4.6 Cron-Jobs (Automatisierung)

| Job                        | Zeitplan            | Authentifizierung |
| -------------------------- | ------------------- | ----------------- |
| Time-Entry-Generierung     | Täglich 02:00       | `CRON_SECRET`     |
| Überstunden-Check          | Montags 03:00       | `CRON_SECRET`     |
| Gehaltsabschluss           | 1. des Monats 04:00 | `CRON_SECRET`     |
| Pausen-Erinnerung          | Alle 15 Min         | `CRON_SECRET`     |
| **Datenbereinigung (NEU)** | **Sonntags 04:30**  | **`CRON_SECRET`** |

### Empfehlung

- Cookie-Banner-Implementierung überprüfen (bereits vorhanden: `cookie-banner.tsx`)
- Datenschutzerklärung auf Aktualität prüfen (Route: `/datenschutz`)

---

## 5. Änderungsprotokoll dieser Audit-Runde

### Gelöschte Dateien (6)

1. `src/lib/geofence.ts`
2. `src/lib/hooks/use-service-gps.ts`
3. `src/lib/static-map.ts`
4. `src/__tests__/lib/geofence.test.ts`
5. `src/app/api/admin/gps-cleanup/route.ts`
6. `src/app/api/absences/upload/route.ts`

### Neue Dateien (2)

1. `src/app/api/admin/data-retention/route.ts` — Automatische Datenbereinigung
2. `src/app/api/admin/workspace-wipe/route.ts` — Nuclear Option (Art. 17/28)

### Geänderte Dateien (16)

1. `prisma/schema.prisma` — 2 Migrationen (GPS-Felder + Absence reason/documentUrl)
2. `src/lib/visit-audit.ts` — GPS aus Checksum/Fingerprint entfernt
3. `src/app/api/service-visits/[id]/check-in/route.ts`
4. `src/app/api/service-visits/[id]/check-out/route.ts`
5. `src/app/api/service-visits/[id]/signature/route.ts`
6. `src/app/api/service-visits/[id]/route.ts`
7. `src/app/api/service-visits/[id]/pdf/route.ts`
8. `src/app/api/service-reports/[id]/generate/route.ts`
9. `src/app/api/locations/[id]/route.ts`
10. `src/lib/validations.ts`
11. `src/app/api/absences/route.ts` — reason/documentUrl entfernt, Kategorie-Maskierung
12. `src/app/api/absences/[id]/route.ts` — documentUrl-Update entfernt
13. `src/app/api/annual-planning/route.ts` — reason aus Select entfernt
14. `src/app/(dashboard)/abwesenheiten/page.tsx` — UI komplett bereinigt
15. `src/app/(dashboard)/leistungsnachweis/page.tsx` — GPS-UI entfernt
16. `src/components/service-execution/service-execution-view.tsx` — GPS-Typen entfernt
17. `src/middleware.ts` — `geolocation=()`
18. `vercel.json` — GPS-Cron entfernt, Retention-Cron hinzugefügt
19. `messages/de.json` — Upload/Reason-i18n-Schlüssel entfernt
20. `messages/en.json` — Upload/Reason-i18n-Schlüssel entfernt

### Supabase-Migrationen (2)

1. `dsgvo_remove_gps_and_location_tracking_fields`
2. `dsgvo_remove_absence_reason_and_document`

### Testergebnisse

- **226/226 Tests bestanden** (7 Geofence-Tests entfernt, Rest stabil)
- Keine Kompilierungsfehler

---

## Offene Empfehlungen (Kurzfristig)

| #   | Maßnahme                                     | Priorität | Aufwand |
| --- | -------------------------------------------- | --------- | ------- |
| 1   | MAPBOX_ACCESS_TOKEN aus env.ts entfernen     | Niedrig   | 5 Min   |
| 2   | Vercel Blob: `absences/*` Dateien löschen    | Mittel    | 30 Min  |
| 3   | Art. 15/20 Datenexport-Funktion              | Mittel    | 4–8 Std |
| 4   | Ex-Mitarbeiter-Anonymisierung                | Mittel    | 4–8 Std |
| 5   | Datenschutzerklärung aktualisieren           | Mittel    | 1 Std   |
| 6   | Verarbeitungsverzeichnis (Art. 30) erstellen | Hoch      | 2–4 Std |

---

_Dieser Bericht wurde automatisiert erstellt und sollte durch den Datenschutz-Ansprechpartner geprüft werden._
