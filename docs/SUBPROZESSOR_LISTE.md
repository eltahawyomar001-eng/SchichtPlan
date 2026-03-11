# Subprozessor-Liste & AV-Vertragsstatus (Art. 28 DSGVO)

> **Verantwortlicher:** Bashabsheh Vergabepartner, Inhaber Mohammad Bashabsheh  
> **Software:** Shiftfy (SchichtPlan)  
> **Stand:** Juni 2025

---

## 1. Übersicht Auftragsverarbeiter

Gemäß Art. 28 Abs. 1 DSGVO darf der Verantwortliche nur mit Auftragsverarbeitern zusammenarbeiten, die hinreichende Garantien dafür bieten, dass die Verarbeitung im Einklang mit der DSGVO erfolgt. Nachfolgend sind alle Subprozessoren aufgeführt, die im Rahmen des Betriebs von Shiftfy personenbezogene Daten verarbeiten.

---

## 2. Subprozessor-Verzeichnis

### 2.1 Vercel Inc. — Hosting & Infrastruktur

| Feld                        | Detail                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firmensitz**              | San Francisco, CA, USA                                                                                                                                |
| **Server-Standort**         | EU (Frankfurt am Main, AWS eu-central-1)                                                                                                              |
| **Verarbeitungszweck**      | Hosting der Webanwendung (Serverless Functions, Edge Network, Static Assets), Vercel Blob (Dateispeicher für Profilbilder, Export-PDFs, Chat-Anhänge) |
| **Verarbeitete Datenarten** | HTTP-Anfragen (IP-Adresse, User-Agent, URL), Application Payloads, hochgeladene Dateien                                                               |
| **DPA/AVV-Status**          | ✅ Vercel Standard Data Processing Addendum (DPA) — automatisch Bestandteil der Nutzungsbedingungen                                                   |
| **Transfergarantie**        | EU-US Data Privacy Framework (Angemessenheitsbeschluss, Art. 45 DSGVO, 10.07.2023) + EU-Standardvertragsklauseln (SCCs, Art. 46 Abs. 2 lit. c DSGVO)  |
| **Datenschutzerklärung**    | https://vercel.com/legal/privacy-policy                                                                                                               |
| **DPA-Link**                | https://vercel.com/legal/dpa                                                                                                                          |
| **Anmerkungen**             | Datenverarbeitung primär in EU. USA-Zugriff nur bei Support-/Wartungszugriffen möglich.                                                               |

---

### 2.2 Supabase Inc. — Datenbank

| Feld                        | Detail                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Firmensitz**              | San Francisco, CA, USA                                                                                                                                             |
| **Server-Standort**         | EU (Frankfurt am Main, AWS eu-central-1)                                                                                                                           |
| **Verarbeitungszweck**      | PostgreSQL-Datenbankhosting, alle persistenten Anwendungsdaten                                                                                                     |
| **Verarbeitete Datenarten** | Sämtliche in der Datenbank gespeicherten personenbezogenen Daten (Nutzerkonten, Mitarbeiterdaten, Zeiteinträge, Abwesenheiten, Audit-Logs, E-Signaturen etc.)      |
| **DPA/AVV-Status**          | ✅ Supabase Standard Data Processing Agreement                                                                                                                     |
| **Transfergarantie**        | EU-US Data Privacy Framework + SCCs. Alle Datenbankdaten werden ausschließlich in der EU verarbeitet und gespeichert. Administrativer Zugriff aus den USA möglich. |
| **Datenschutzerklärung**    | https://supabase.com/privacy                                                                                                                                       |
| **DPA-Link**                | https://supabase.com/legal/dpa                                                                                                                                     |
| **Anmerkungen**             | Row Level Security (RLS) aktiviert. Verschlüsselung at-rest und in-transit.                                                                                        |

---

### 2.3 Stripe, Inc. — Zahlungsabwicklung

| Feld                          | Detail                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Firmensitz**                | San Francisco, CA, USA                                                                                                                  |
| **Europäische Niederlassung** | Stripe Payments Europe, Ltd. (Dublin, Irland)                                                                                           |
| **Server-Standort**           | EU (Dublin) + USA                                                                                                                       |
| **Verarbeitungszweck**        | Abonnement-Verwaltung, Zahlungsabwicklung (Kreditkarte, SEPA-Lastschrift)                                                               |
| **Verarbeitete Datenarten**   | Stripe Customer ID, Subscription ID, Zahlungsstatus, Abrechnungszeitraum. **Kartennummern werden nie auf Shiftfy-Servern gespeichert.** |
| **DPA/AVV-Status**            | ✅ Stripe Data Processing Agreement                                                                                                     |
| **Transfergarantie**          | EU-US Data Privacy Framework + SCCs. PCI DSS Level 1 zertifiziert.                                                                      |
| **Datenschutzerklärung**      | https://stripe.com/de/privacy                                                                                                           |
| **DPA-Link**                  | https://stripe.com/de/legal/dpa                                                                                                         |
| **Anmerkungen**               | Europäische Zahlungsverarbeitung über Dublin. Stripe fungiert teilweise als eigenständiger Verantwortlicher (Betrugsprävention).        |

---

### 2.4 Resend Inc. — E-Mail-Versand

| Feld                        | Detail                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Firmensitz**              | San Francisco, CA, USA                                                                                                           |
| **Server-Standort**         | USA                                                                                                                              |
| **Verarbeitungszweck**      | Versand von System-E-Mails (Verifizierung, Passwort-Reset, Schichtbenachrichtigungen, Abwesenheitsgenehmigungen, Einladungen)    |
| **Verarbeitete Datenarten** | Empfänger-E-Mail-Adresse, E-Mail-Betreff, E-Mail-Inhalt (Benachrichtigungstext)                                                  |
| **DPA/AVV-Status**          | ✅ Resend Standard Data Processing Agreement                                                                                     |
| **Transfergarantie**        | EU-Standardvertragsklauseln (SCCs, Art. 46 Abs. 2 lit. c DSGVO)                                                                  |
| **Datenschutzerklärung**    | https://resend.com/legal/privacy-policy                                                                                          |
| **DPA-Link**                | https://resend.com/legal/dpa                                                                                                     |
| **Anmerkungen**             | E-Mail-Inhalte werden in den USA verarbeitet. Nutzer kann E-Mail-Benachrichtigungen jederzeit in den Einstellungen deaktivieren. |

---

### 2.5 Functional Software, Inc. (Sentry) — Fehlerüberwachung

| Feld                        | Detail                                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firmensitz**              | San Francisco, CA, USA                                                                                                                                                                                                                             |
| **Server-Standort**         | EU (Frankfurt am Main)                                                                                                                                                                                                                             |
| **Verarbeitungszweck**      | Error-Monitoring (Laufzeitfehler), optional: Session-Replay und Performance-Tracing                                                                                                                                                                |
| **Verarbeitete Datenarten** | Fehlermeldungen, Stack-Traces, Browser, Betriebssystem, Performance-Metriken. **Keine personenbezogenen Inhalte.** Session-Replay nur mit expliziter Einwilligung.                                                                                 |
| **DPA/AVV-Status**          | ✅ Sentry Data Processing Addendum                                                                                                                                                                                                                 |
| **Transfergarantie**        | EU-US Data Privacy Framework + SCCs                                                                                                                                                                                                                |
| **Datenschutzerklärung**    | https://sentry.io/privacy/                                                                                                                                                                                                                         |
| **DPA-Link**                | https://sentry.io/legal/dpa/                                                                                                                                                                                                                       |
| **Anmerkungen**             | Error-Monitoring: Art. 6 (1)(f) DSGVO (berechtigtes Interesse, ohne Einwilligung). Session-Replay + Tracing: Art. 6 (1)(a) DSGVO (nur nach Cookie-Consent „Analytics"). Implementierung in `sentry.client.config.ts` mit dynamischem Consent-Gate. |

---

### 2.6 Upstash, Inc. — Rate Limiting (Redis)

| Feld                        | Detail                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firmensitz**              | San Francisco, CA, USA                                                                                                                      |
| **Server-Standort**         | EU (Frankfurt am Main, AWS eu-central-1)                                                                                                    |
| **Verarbeitungszweck**      | IP-basiertes Rate Limiting zum Schutz der API-Endpunkte                                                                                     |
| **Verarbeitete Datenarten** | Gehashte IP-Adressen mit kurzlebigen Zählern. **Keine personenbezogenen Inhalte.**                                                          |
| **DPA/AVV-Status**          | ✅ Upstash Standard Data Processing Agreement                                                                                               |
| **Transfergarantie**        | EU-Standardvertragsklauseln (SCCs, Art. 46 Abs. 2 lit. c DSGVO)                                                                             |
| **Datenschutzerklärung**    | https://upstash.com/trust/privacy.pdf                                                                                                       |
| **DPA-Link**                | Bestandteil der Nutzungsbedingungen                                                                                                         |
| **Anmerkungen**             | TTL: 60 Sekunden — Daten werden automatisch gelöscht. Art. 6 (1)(f) DSGVO (berechtigtes Interesse an Sicherheit und Missbrauchsprävention). |

---

## 3. Pflichten des Verantwortlichen

Gemäß Art. 28 DSGVO hat der Verantwortliche folgende Pflichten:

1. **Sorgfältige Auswahl** — Alle oben genannten Auftragsverarbeiter wurden hinsichtlich ihrer technisch-organisatorischen Maßnahmen (TOMs) geprüft.
2. **Schriftliche Vereinbarung** — Mit allen Auftragsverarbeitern bestehen DPAs/AVVs (Standard-DPAs der jeweiligen Anbieter).
3. **Kontrollrechte** — Audit-Rechte sind in den Standard-DPAs verankert.
4. **Unterrichtungspflicht bei Subprozessor-Wechsel** — Alle Anbieter informieren über Änderungen ihrer Subprozessoren.
5. **Weisungsgebundenheit** — Auftragsverarbeiter verarbeiten Daten nur auf dokumentierte Weisung des Verantwortlichen.

---

## 4. Freelancer / Entwickler-Zugriff

| Feld                       | Detail                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Rolle**                  | Lead Software Architect & Datenschutz-Ansprechpartner                                                                            |
| **Zugriff**                | Vollzugriff auf Quellcode (GitHub), Supabase-Dashboard, Vercel-Dashboard, Sentry-Dashboard                                       |
| **Vertragliche Grundlage** | Vertraulichkeitsvereinbarung (NDA) + Verpflichtung auf das Datengeheimnis gem. Art. 28 Abs. 3 lit. b DSGVO                       |
| **Verarbeitungsort**       | EU (Deutschland)                                                                                                                 |
| **Maßnahmen**              | Zugriff nur über verschlüsselte Verbindungen (HTTPS, SSH), 2FA für alle Dienste, kein lokaler Datenspeicher von Produktionsdaten |

### Handlungsempfehlung

Sofern der Entwickler als weisungsgebundener Auftragnehmer (Freelancer) tätig ist, sollte ein **Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO** mit folgendem Mindestinhalt geschlossen werden:

- Gegenstand und Dauer der Verarbeitung
- Art und Zweck der Verarbeitung
- Art der personenbezogenen Daten und Kategorien betroffener Personen
- Pflichten und Rechte des Verantwortlichen
- Technisch-organisatorische Maßnahmen (TOMs)
- Untervergabe-Regelung
- Löschung/Rückgabe nach Auftragsende
- Kontroll- und Weisungsrechte

> **Hinweis:** Ist der Entwickler hingegen in die Organisation des Verantwortlichen eingebunden (arbeitnehmerähnlich), genügt eine **Verpflichtung auf das Datengeheimnis** gemäß Art. 29 DSGVO i. V. m. §26 BDSG.

---

## 5. Änderungsprotokoll

| Datum     | Änderung                                               |
| --------- | ------------------------------------------------------ |
| Juni 2025 | Erstfassung — alle aktiven Subprozessoren dokumentiert |

---

_Dieses Dokument ist Bestandteil der DSGVO-Dokumentation und wird der Aufsichtsbehörde auf Anfrage vorgelegt._
