# Verarbeitungsverzeichnis (Art. 30 DSGVO)

> **Verantwortlicher:** Bashabsheh Vergabepartner, Inhaber Mohammad Bashabsheh  
> **Anschrift:** c/o VirtualOfficeBerlin, Kolonnenstraße 8, 10827 Berlin  
> **Datenschutz-Ansprechpartner:** Mohammad Bashabsheh — datenschutz@bashabsheh-vergabepartner.de  
> **Software:** Shiftfy (SchichtPlan) — SaaS für Schichtplanung, Zeiterfassung und Personalverwaltung  
> **Stand:** <!-- Datum wird bei Pflege aktualisiert --> Juni 2025

---

## Hinweise zur Nutzung

Dieses Verzeichnis erfüllt die Anforderungen des **Art. 30 Abs. 1 DSGVO** (Verzeichnis des Verantwortlichen). Es ist regelmäßig — mindestens halbjährlich — zu aktualisieren. Jede wesentliche Änderung an Datenmodellen, Auftragsverarbeitern oder Löschfristen muss hier nachgezogen werden.

Abkürzungen:

- **MA** = Mitarbeiter/Beschäftigte
- **AG** = Arbeitgeber/Workspace-Inhaber
- **AV** = Auftragsverarbeiter
- **DPF** = EU-US Data Privacy Framework
- **SCCs** = EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO)

---

## 1. Benutzerverwaltung & Authentifizierung

| Feld                       | Inhalt                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Verarbeitungstätigkeit** | Registrierung, Anmeldung, Sitzungsverwaltung und Zwei-Faktor-Authentifizierung                               |
| **Zweck**                  | Bereitstellung des SaaS-Dienstes, Zugriffskontrolle, Accountsicherheit                                       |
| **Betroffene Personen**    | Alle registrierten Nutzer (AG, Manager, MA)                                                                  |
| **Datenkategorien**        | Name, E-Mail, Telefon, Passwort-Hash, Profilbild-URL, Rolle, 2FA-Secret (verschlüsselt), Consent-Zeitstempel |
| **Datenmodelle**           | `User`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`                                      |
| **Empfänger / AV**         | Supabase (DB), Vercel (Hosting), Resend (Verifizierungs-E-Mail)                                              |
| **Drittlandtransfer**      | USA — DPF + SCCs (Vercel, Supabase); USA — SCCs (Resend)                                                     |
| **Löschfrist**             | Kontodaten: bis Löschung durch Nutzer; Sessions: 30 Tage nach Ablauf; Tokens: 7 Tage nach Ablauf             |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO (Vertragserfüllung), Art. 6 (1)(f) (Accountsicherheit)                                   |
| **TOM-Verweis**            | Passwort-Hashing (bcrypt), JWT-Sessions, HSTS, CSP mit Nonce, Rate Limiting (10 Req/60s Auth)                |

---

## 2. Workspace- & Organisationsverwaltung

| Feld                       | Inhalt                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Erstellung und Verwaltung von Workspaces (Mandanten), Einladungen, Rollensteuerung      |
| **Zweck**                  | Multi-Mandanten-Isolation, Organisationsstruktur, Team-Onboarding                       |
| **Betroffene Personen**    | Workspace-Inhaber, eingeladene Nutzer                                                   |
| **Datenkategorien**        | Firmenname, Slug, Branche, Bundesland, Einladungs-E-Mail, Token, Rolle                  |
| **Datenmodelle**           | `Workspace`, `Invitation`                                                               |
| **Empfänger / AV**         | Supabase (DB), Resend (Einladungs-E-Mail)                                               |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                             |
| **Löschfrist**             | Workspace: bis Löschung durch Owner (Nuclear Option); Einladungen: 30 Tage nach Ablauf  |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO                                                                     |
| **TOM-Verweis**            | Workspace-Isolation (jede DB-Abfrage filtert `workspaceId`), RBAC (4-Rollen-Hierarchie) |

---

## 3. Personalverwaltung (Employee)

| Feld                       | Inhalt                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Anlage und Pflege von Mitarbeiterstammdaten, Qualifikationen, Abteilungszuordnung                                                         |
| **Zweck**                  | Schichtplanung, Arbeitszeitverwaltung, Lohnabrechnung                                                                                     |
| **Betroffene Personen**    | Beschäftigte des Workspace-Inhabers                                                                                                       |
| **Datenkategorien**        | Name, E-Mail, Telefon, Position, Stundensatz, Wochenstunden, Vertragsart, Abteilung, Qualifikationen, Aktivstatus                         |
| **Datenmodelle**           | `Employee`, `Department`, `Location`, `Skill`, `EmployeeSkill`                                                                            |
| **Empfänger / AV**         | Supabase (DB)                                                                                                                             |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                                                               |
| **Löschfrist**             | Aktive Geschäftsdaten — Löschung über Employee-Deaktivierung oder Workspace-Löschung. Empfehlung: Anonymisierung für Ex-MA nach Austritt. |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO (Arbeitsvertrag/SaaS-Vertrag)                                                                                         |
| **TOM-Verweis**            | Rollenbasierte Zugriffskontrolle, EMPLOYEE sieht nur eigene Daten                                                                         |

---

## 4. Schichtplanung

| Feld                       | Inhalt                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Erstellung, Zuweisung und Verwaltung von Schichten, Vorlagen und Feiertagen               |
| **Zweck**                  | Dienstplangestaltung, Arbeitszeitdokumentation                                            |
| **Betroffene Personen**    | Beschäftigte                                                                              |
| **Datenkategorien**        | Schichtdatum, Start-/Endzeit, Zuschlagsprozent, Notizen, Status, Zuordnung zu MA/Standort |
| **Datenmodelle**           | `Shift`, `ShiftTemplate`, `PublicHoliday`, `StaffingRequirement`                          |
| **Empfänger / AV**         | Supabase (DB)                                                                             |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                               |
| **Löschfrist**             | Aktive Geschäftsdaten; historische Schichten: gemäß §16(2) ArbZG 2 Jahre                  |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO                                                                       |
| **TOM-Verweis**            | Workspace-Isolation, Soft-Delete (deletedAt)                                              |

---

## 5. Zeiterfassung & Stempeluhr

| Feld                       | Inhalt                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Verarbeitungstätigkeit** | Erfassung von Arbeitszeiten (manuell und Live-Clock), Pausen, Audit-Trail                              |
| **Zweck**                  | Arbeitszeitdokumentation gem. §3 ArbZG, Lohnabrechnung, Compliance                                     |
| **Betroffene Personen**    | Beschäftigte                                                                                           |
| **Datenkategorien**        | Datum, Start-/Endzeit, Pausenzeiten, Brutto-/Nettominuten, Status, Bemerkungen, Stempeluhr-Zeitstempel |
| **Datenmodelle**           | `TimeEntry`, `TimeEntryAudit`, `TimeAccount`, `MonthClose`                                             |
| **Empfänger / AV**         | Supabase (DB)                                                                                          |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                            |
| **Löschfrist**             | TimeEntryAudit: 10 Jahre (§147 AO); MonthClose: 10 Jahre (§147 AO); TimeEntry: aktive Geschäftsdaten   |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO, Art. 6 (1)(c) DSGVO (§3 ArbZG Aufzeichnungspflicht)                               |
| **TOM-Verweis**            | Audit-Trail mit Bearbeiter-ID, Statusmaschine (ENTWURF→BESTAETIGT), Month-Close-Sperre                 |

---

## 6. Abwesenheitsverwaltung & Urlaubskonto

| Feld                       | Inhalt                                                                                                                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Antragstellung, Genehmigung und Verwaltung von Abwesenheiten, Urlaubssalden                                                                                                                                                                                                      |
| **Zweck**                  | Urlaubsplanung, Abwesenheitsübersicht, Arbeitszeitdokumentation                                                                                                                                                                                                                  |
| **Betroffene Personen**    | Beschäftigte                                                                                                                                                                                                                                                                     |
| **Datenkategorien**        | Kategorie (Urlaub, Krank etc.), Zeitraum, Halbtage, Gesamttage, Status, Prüfvermerk. **Keine Freitextbegründungen, keine Attest-Uploads** (Art. 9 DSGVO — Datenminimierung umgesetzt). Kategorie wird für Nicht-Management-Nutzer bei fremden Einträgen maskiert (→ „ABWESEND"). |
| **Datenmodelle**           | `AbsenceRequest`, `VacationBalance`                                                                                                                                                                                                                                              |
| **Empfänger / AV**         | Supabase (DB)                                                                                                                                                                                                                                                                    |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                                                                                                                                                                                                      |
| **Löschfrist**             | Aktive Geschäftsdaten — Löschung über Workspace-Löschung                                                                                                                                                                                                                         |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO                                                                                                                                                                                                                                                              |
| **TOM-Verweis**            | Kategorie-Maskierung (EMPLOYEE sieht fremde Abwesenheiten nur als „ABWESEND"), RBAC                                                                                                                                                                                              |

---

## 7. Verfügbarkeiten & Schichttausch

| Feld                       | Inhalt                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Pflege von Verfügbarkeiten, Schichtänderungs- und Tausch-Anträge                                                  |
| **Zweck**                  | Flexible Dienstplangestaltung, Mitarbeiterwünsche berücksichtigen                                                 |
| **Betroffene Personen**    | Beschäftigte                                                                                                      |
| **Datenkategorien**        | Wochentag, Zeitfenster, Typ (verfügbar/bevorzugt/nicht verfügbar), Gültigkeitszeitraum, Antragsstatus, Begründung |
| **Datenmodelle**           | `Availability`, `ShiftChangeRequest`, `ShiftSwapRequest`                                                          |
| **Empfänger / AV**         | Supabase (DB)                                                                                                     |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                                       |
| **Löschfrist**             | Aktive Geschäftsdaten                                                                                             |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO                                                                                               |
| **TOM-Verweis**            | RBAC, EMPLOYEE sieht nur eigene Verfügbarkeiten                                                                   |

---

## 8. Digitaler Leistungsnachweis (Service Visits)

| Feld                       | Inhalt                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Dokumentation von Vor-Ort-Besuchen mit Check-in/-out, digitaler Unterschrift, Audit-Trail                                                                                   |
| **Zweck**                  | Revisionssicherer Leistungsnachweis für Kundenabrechnung (§147 AO)                                                                                                          |
| **Betroffene Personen**    | Beschäftigte, Unterzeichner beim Kunden (z. B. Filialleiter)                                                                                                                |
| **Datenkategorien**        | Besuchsdatum, Check-in/-out-Zeitstempel, Notizen, Signatur (Base64-PNG), Signatur-Hash (SHA-256), Unterzeichner-Name/Rolle, Geräte-ID (anonymisiert), User-Agent, Prüfsumme |
| **Datenmodelle**           | `ServiceVisit`, `VisitSignature`, `ServiceReport`, `ServiceVisitAuditLog`                                                                                                   |
| **Empfänger / AV**         | Supabase (DB), Vercel Blob (PDF-Speicher)                                                                                                                                   |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                                                                                                 |
| **Löschfrist**             | ServiceVisitAuditLog + VisitSignature: 10 Jahre (§147 AO, eIDAS); ServiceReport-PDFs: aktive Geschäftsdaten                                                                 |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO, Art. 6 (1)(c) DSGVO (§147 AO Aufbewahrungspflicht)                                                                                                     |
| **TOM-Verweis**            | SHA-256-Prüfsumme pro Audit-Eintrag (Tamper-Evidence), kein GPS (DSGVO-Purge umgesetzt)                                                                                     |

---

## 9. E-Signaturen

| Feld                       | Inhalt                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Erfassung einfacher elektronischer Signaturen bei Genehmigungshandlungen (Abwesenheit, Zeitbestätigung)                                                    |
| **Zweck**                  | Rechtssichere Dokumentation von Genehmigungsentscheidungen (eIDAS Art. 25, §126a BGB)                                                                      |
| **Betroffene Personen**    | Genehmigende Nutzer (Manager, Admin, Owner)                                                                                                                |
| **Datenkategorien**        | Handlung, Entitätstyp/-ID, Unterzeichner (Name, E-Mail, Rolle — denormalisiert), SHA-256-Hash, IP-Adresse, User-Agent, Einwilligungserklärung, Zeitstempel |
| **Datenmodelle**           | `ESignature`                                                                                                                                               |
| **Empfänger / AV**         | Supabase (DB)                                                                                                                                              |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                                                                                |
| **Löschfrist**             | 10 Jahre (§147 AO, eIDAS-Verordnung)                                                                                                                       |
| **Rechtsgrundlage**        | Art. 6 (1)(c) DSGVO (gesetzliche Verpflichtung — eIDAS, §126a BGB, §147 AO)                                                                                |
| **TOM-Verweis**            | SHA-256-Hash bindet Handlung, Entität, Zeitstempel und Unterzeichner kryptographisch                                                                       |

---

## 10. Benachrichtigungen & Push

| Feld                       | Inhalt                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | In-App-Benachrichtigungen, E-Mail-Benachrichtigungen, Web-Push-Nachrichten                                                  |
| **Zweck**                  | Rechtzeitige Information über Schichtänderungen, Genehmigungen, Anträge                                                     |
| **Betroffene Personen**    | Alle Nutzer                                                                                                                 |
| **Datenkategorien**        | Typ, Titel, Nachrichtentext, Link, Lesestatus; Push: Endpoint-URL, Verschlüsselungsschlüssel (p256dh, auth)                 |
| **Datenmodelle**           | `Notification`, `NotificationPreference`, `PushSubscription`                                                                |
| **Empfänger / AV**         | Supabase (DB), Resend (E-Mail), Browser Push Service (Web Push Protocol)                                                    |
| **Drittlandtransfer**      | Siehe Nr. 1; Push-Dienst abhängig vom Browser-Hersteller (Google FCM für Chrome, Mozilla Push für Firefox, APNs für Safari) |
| **Löschfrist**             | Notifications: 90 Tage; PushSubscriptions: 180 Tage                                                                         |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO (vertragswesentlicher Benachrichtigungsdienst)                                                          |
| **TOM-Verweis**            | Nutzer kann E-Mail-/Push-Benachrichtigungen pro Kanal in den Einstellungen deaktivieren                                     |

---

## 11. Abrechnung & Subscription

| Feld                       | Inhalt                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Verwaltung von Abonnements, Zahlungsabwicklung, Nutzungsmessung (Seats, PDFs, Storage)                           |
| **Zweck**                  | Abrechnung des SaaS-Dienstes, Plan-Gating                                                                        |
| **Betroffene Personen**    | Workspace-Inhaber (Zahlungspflichtige)                                                                           |
| **Datenkategorien**        | Plan, Status, Stripe Customer/Subscription-ID, Abrechnungszeitraum, Seat-Count, PDF-/Speicherverbrauch           |
| **Datenmodelle**           | `Subscription`, `WorkspaceUsage`                                                                                 |
| **Empfänger / AV**         | Stripe (Zahlungsabwicklung), Supabase (DB)                                                                       |
| **Drittlandtransfer**      | Stripe: EU (Dublin) + USA — DPF + SCCs; PCI DSS Level 1. Kartendaten werden nie auf eigenen Servern gespeichert. |
| **Löschfrist**             | Vertragslaufzeit + gesetzliche Aufbewahrungspflichten (§147 AO bei Rechnungsdaten: 10 Jahre)                     |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO (Vertragserfüllung)                                                                          |
| **TOM-Verweis**            | Stripe PCI DSS Level 1, keine Kartenspeicherung auf Shiftfy-Servern                                              |

---

## 12. Projekte & Kunden

| Feld                       | Inhalt                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------ |
| **Verarbeitungstätigkeit** | Verwaltung von Kunden-/Auftraggeberdaten, Projektzuordnung, Budgetierung             |
| **Zweck**                  | Projektzeiterfassung, Kostenstellenzuordnung                                         |
| **Betroffene Personen**    | Kunden/Auftraggeber (jur. Personen), Beschäftigte (als Projektmitglieder)            |
| **Datenkategorien**        | Firmenname, E-Mail, Telefon, Adresse, Notizen, Projektstatus, Stunden-/Kostenansätze |
| **Datenmodelle**           | `Client`, `Project`, `ProjectMember`                                                 |
| **Empfänger / AV**         | Supabase (DB)                                                                        |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                          |
| **Löschfrist**             | Aktive Geschäftsdaten                                                                |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO                                                                  |
| **TOM-Verweis**            | Workspace-Isolation                                                                  |

---

## 13. Team-Chat

| Feld                       | Inhalt                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Interne Team-Kommunikation über Gruppenchats, Direkt-Nachrichten, Threads                                   |
| **Zweck**                  | Betriebliche Kommunikation, Schichtabsprachen                                                               |
| **Betroffene Personen**    | Alle Nutzer eines Workspace                                                                                 |
| **Datenkategorien**        | Nachrichtentext, Absendername, Reaktionen (Emoji), Dateianhänge (Name, URL, MIME-Typ, Größe), Anpinn-Status |
| **Datenmodelle**           | `ChatChannel`, `ChatChannelMember`, `ChatMessage`, `ChatReaction`, `ChatAttachment`                         |
| **Empfänger / AV**         | Supabase (DB), Vercel Blob (Anhänge)                                                                        |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                                 |
| **Löschfrist**             | ChatMessages: 365 Tage; ChatAttachments: zusammen mit der Nachricht                                         |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO, Art. 6 (1)(f) DSGVO (berechtigtes Interesse an betrieblicher Kommunikation)            |
| **TOM-Verweis**            | Workspace-Isolation, Soft-Delete (deletedAt), Kanal-Mitgliedschaft                                          |

---

## 14. Automatisierung & Auto-Scheduling

| Feld                       | Inhalt                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Automatische Schichtplanung, Auto-Fill bei Ausfällen, Regelbasierte Automatisierung, Manager-Alerts       |
| **Zweck**                  | Effiziente Schichtbesetzung, Compliance-Prüfung (§3 ArbZG, §12 TzBfG)                                     |
| **Betroffene Personen**    | Beschäftigte                                                                                              |
| **Datenkategorien**        | Planungslauf-Konfiguration, Zuweisungen (JSON), Fairness-Score, Compliance-Checks, Alert-Typ/-Schweregrad |
| **Datenmodelle**           | `AutoScheduleRun`, `AutoFillLog`, `ManagerAlert`, `AutomationRule`, `AutomationSetting`                   |
| **Empfänger / AV**         | Supabase (DB)                                                                                             |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                               |
| **Löschfrist**             | AutoScheduleRun: 180 Tage; AutoFillLog: 90 Tage; ManagerAlert (bestätigt): 90 Tage                        |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO, Art. 6 (1)(f) DSGVO (betriebliche Notwendigkeit)                                     |
| **TOM-Verweis**            | Audit-Trail über AutoFillLog, Compliance-Checks vor Zuweisung                                             |

---

## 15. Audit-Logging

| Feld                       | Inhalt                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Protokollierung aller sicherheitsrelevanten Aktionen (Erstellen, Ändern, Löschen, Genehmigen)  |
| **Zweck**                  | Revisionssicherheit, Missbrauchserkennung, Nachvollziehbarkeit                                 |
| **Betroffene Personen**    | Alle Nutzer (als Handelnde)                                                                    |
| **Datenkategorien**        | Aktion, Entitätstyp/-ID, Nutzer-ID, E-Mail (denormalisiert), Änderungen (JSON-Diff), Metadaten |
| **Datenmodelle**           | `AuditLog`                                                                                     |
| **Empfänger / AV**         | Supabase (DB)                                                                                  |
| **Drittlandtransfer**      | Siehe Nr. 1                                                                                    |
| **Löschfrist**             | 365 Tage                                                                                       |
| **Rechtsgrundlage**        | Art. 6 (1)(f) DSGVO (berechtigtes Interesse an Revisionssicherheit)                            |
| **TOM-Verweis**            | Automatisierte Löschung via Data-Retention-Cron                                                |

---

## 16. Datenexport & Webhooks

| Feld                       | Inhalt                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Export von Lohn-/Zeitdaten (PDF, CSV), iCal-Feed, Webhook-Benachrichtigungen an Drittsysteme |
| **Zweck**                  | Lohnbuchhaltung, Kalenderintegration, Systemintegration                                      |
| **Betroffene Personen**    | Beschäftigte (deren Daten exportiert werden), Workspace-Administratoren                      |
| **Datenkategorien**        | Export-Format, Datei-URL, Status; Webhook: URL, Secret, Events; iCal: Token, Label           |
| **Datenmodelle**           | `ExportJob`, `WebhookEndpoint`, `ICalToken`                                                  |
| **Empfänger / AV**         | Supabase (DB), Vercel Blob (Export-Dateien), Webhook-Empfänger (vom Kunden konfiguriert)     |
| **Drittlandtransfer**      | Webhook-Empfänger liegen in der Verantwortung des Workspace-Inhabers                         |
| **Löschfrist**             | ExportJobs: 90 Tage; ICalToken/WebhookEndpoint: bis Löschung durch Nutzer                    |
| **Rechtsgrundlage**        | Art. 6 (1)(b) DSGVO                                                                          |
| **TOM-Verweis**            | Webhook-Secret für HMAC-Signatur, iCal-Token als Bearer-Token                                |

---

## 17. Fehlerüberwachung (Sentry)

| Feld                       | Inhalt                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Erfassung von Laufzeitfehlern, optional: Session-Replay und Performance-Tracing                                                                                             |
| **Zweck**                  | Qualitätssicherung, Fehlerbehebung                                                                                                                                          |
| **Betroffene Personen**    | Alle Website-Besucher / Nutzer                                                                                                                                              |
| **Datenkategorien**        | Error-Monitoring (ohne Consent): Fehlermeldung, Stack-Trace, Browser, OS — keine PII. Session-Replay + Tracing (nur mit Consent): Nutzerinteraktionen, Performance-Metriken |
| **Datenmodelle**           | Keine eigenen DB-Modelle — Daten werden direkt an Sentry übermittelt                                                                                                        |
| **Empfänger / AV**         | Sentry (Functional Software, Inc.)                                                                                                                                          |
| **Drittlandtransfer**      | USA — DPF + SCCs; Server: EU (Frankfurt am Main)                                                                                                                            |
| **Löschfrist**             | Gemäß Sentry-Konfiguration (Standard: 90 Tage)                                                                                                                              |
| **Rechtsgrundlage**        | Error-Monitoring: Art. 6 (1)(f) DSGVO (berechtigtes Interesse). Replay/Tracing: Art. 6 (1)(a) DSGVO (Einwilligung via Cookie-Banner)                                        |
| **TOM-Verweis**            | Consent-Gate: `sentry.client.config.ts` prüft `analytics`-Consent bevor Replay/Tracing aktiviert wird                                                                       |

---

## 18. Rate Limiting (Upstash Redis)

| Feld                       | Inhalt                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | IP-basiertes Rate Limiting zum Schutz der API-Endpunkte           |
| **Zweck**                  | Missbrauchsprävention, DDoS-Schutz                                |
| **Betroffene Personen**    | Alle API-Nutzer / Website-Besucher                                |
| **Datenkategorien**        | Gehashte IP-Adresse, Anfragezähler (kurzlebig, TTL 60 Sekunden)   |
| **Datenmodelle**           | Keine eigenen DB-Modelle — Daten in Upstash Redis                 |
| **Empfänger / AV**         | Upstash, Inc.                                                     |
| **Drittlandtransfer**      | USA (Firmensitz) — SCCs; Server: EU (Frankfurt, AWS eu-central-1) |
| **Löschfrist**             | Automatisch nach 60 Sekunden (Redis TTL)                          |
| **Rechtsgrundlage**        | Art. 6 (1)(f) DSGVO (berechtigtes Interesse an Sicherheit)        |
| **TOM-Verweis**            | IP-Adressen werden gehasht, keine Klartextspeicherung             |

---

## 19. Cookie-Verwaltung

| Feld                       | Inhalt                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verarbeitungstätigkeit** | Setzen und Verwaltung von Cookies, Einholung der Einwilligung                                                                                                                                       |
| **Zweck**                  | Session-Management, Sprachpräferenz, Consent-Dokumentation                                                                                                                                          |
| **Betroffene Personen**    | Alle Website-Besucher                                                                                                                                                                               |
| **Datenkategorien**        | Session-Cookie (technisch notwendig), Locale-Cookie (technisch notwendig), Consent-Cookie (Einwilligungsstatus mit Zeitstempel und Version)                                                         |
| **Datenmodelle**           | Keine DB-Modelle — Cookies im Browser; Consent zusätzlich in localStorage                                                                                                                           |
| **Empfänger / AV**         | Keine Weitergabe (First-Party-Cookies)                                                                                                                                                              |
| **Drittlandtransfer**      | Keiner                                                                                                                                                                                              |
| **Löschfrist**             | Session: bis Abmeldung/Ablauf; Consent: 365 Tage; Locale: bis Löschung durch Nutzer                                                                                                                 |
| **Rechtsgrundlage**        | Technisch notwendige Cookies: §25 Abs. 2 Nr. 2 TDDDG (keine Einwilligung nötig). Optionale Cookies (Sentry Replay/Tracing): Art. 6 (1)(a) DSGVO + §25 Abs. 1 TDDDG (Einwilligung via Cookie-Banner) |
| **TOM-Verweis**            | `Secure`-Flag, `SameSite=Lax`, Cookie-Banner mit drei Optionen (Alle akzeptieren / Nur Notwendige / Einstellungen)                                                                                  |

---

## Auftragsverarbeiter-Übersicht (Art. 28 DSGVO)

| #   | Dienstleister                      | Sitz               | Server-Standort                  | Zweck                                    | DPA/AVV         | Transfergarantie            |
| --- | ---------------------------------- | ------------------ | -------------------------------- | ---------------------------------------- | --------------- | --------------------------- |
| 1   | Vercel Inc.                        | San Francisco, USA | EU (Frankfurt)                   | Hosting, Serverless, Edge, Blob-Speicher | ✅ Standard-DPA | DPF + SCCs                  |
| 2   | Supabase Inc.                      | San Francisco, USA | EU (Frankfurt, AWS eu-central-1) | PostgreSQL-Datenbank                     | ✅ Standard-DPA | DPF + SCCs                  |
| 3   | Stripe, Inc.                       | San Francisco, USA | EU (Dublin, Irland)              | Zahlungsabwicklung                       | ✅ Standard-DPA | DPF + SCCs; PCI DSS Level 1 |
| 4   | Resend Inc.                        | San Francisco, USA | USA                              | E-Mail-Versand (System-E-Mails)          | ✅ Standard-DPA | SCCs                        |
| 5   | Functional Software, Inc. (Sentry) | San Francisco, USA | EU (Frankfurt)                   | Fehlerüberwachung, Session-Replay        | ✅ Standard-DPA | DPF + SCCs                  |
| 6   | Upstash, Inc.                      | San Francisco, USA | EU (Frankfurt, AWS eu-central-1) | Redis Rate-Limiting                      | ✅ Standard-DPA | SCCs                        |

---

## Technisch-Organisatorische Maßnahmen (TOM) — Übersicht

| Kategorie               | Maßnahme                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Verschlüsselung**     | TLS/HTTPS erzwungen (Vercel), HSTS mit Preload, Passwort-Hashing (bcrypt)                 |
| **Zugriffskontrolle**   | 4-Rollen-RBAC (OWNER > ADMIN > MANAGER > EMPLOYEE), 25+ Ressourcen × 5 Aktionen           |
| **Mandanten-Isolation** | Jede DB-Abfrage filtert nach `workspaceId`                                                |
| **Content Security**    | CSP mit Per-Request-Nonce, X-Frame-Options: DENY, X-Content-Type-Options: nosniff         |
| **Rate Limiting**       | Auth: 10 Req/60s, API: 60 Req/60s (Upstash Redis Sliding Window)                          |
| **Permissions-Policy**  | `camera=(), microphone=(), geolocation=(), interest-cohort=()`                            |
| **Audit-Trail**         | AuditLog für alle CRUD-Operationen, ServiceVisitAuditLog mit SHA-256-Prüfsumme            |
| **Datenminimierung**    | GPS-Felder entfernt (Leistungsnachweis), Abwesenheits-Begründung/Attest entfernt          |
| **Löschkonzept**        | Automatische Datenbereinigung (wöchentlicher Cron), Nuclear Option für Workspace-Löschung |
| **Consent-Management**  | Cookie-Banner mit granularer Kategorie-Steuerung, Sentry Replay/Tracing consent-gated     |
| **Monitoring**          | Sentry Error-Monitoring (Art. 6(1)(f)), strukturiertes Logging ohne PII                   |

---

_Dieses Verzeichnis ist vertraulich und wird der Aufsichtsbehörde auf Anfrage gemäß Art. 30 Abs. 4 DSGVO vorgelegt._
