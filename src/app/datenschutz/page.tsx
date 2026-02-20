import Link from "next/link";
import { SchichtPlanMark } from "@/components/icons";

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <SchichtPlanMark className="h-7 w-7" />
            <span className="text-lg font-bold text-gray-900">
              Schicht<span className="text-gradient">Plan</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Datenschutzerklärung
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Stand:{" "}
          {new Date().toLocaleDateString("de-DE", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
          {/* 1. Datenschutz auf einen Blick */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              1. Datenschutz auf einen Blick
            </h2>
            <p>
              Die folgenden Hinweise geben einen einfachen Überblick darüber,
              was mit Ihren personenbezogenen Daten passiert, wenn Sie diese
              Website besuchen. Personenbezogene Daten sind alle Daten, mit
              denen Sie persönlich identifiziert werden können.
            </p>
          </section>

          {/* 2. Verantwortliche Stelle */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              2. Verantwortliche Stelle
            </h2>
            <p>
              Die verantwortliche Stelle für die Datenverarbeitung auf dieser
              Website ist:
            </p>
            <p>
              SchichtPlan
              <br />
              Omar Rageh
              <br />
              Fulda, Deutschland
              <br />
              E-Mail: kontakt@schichtplan.plan
            </p>
            <p className="mt-2">
              Verantwortliche Stelle ist die natürliche oder juristische Person,
              die allein oder gemeinsam mit anderen über die Zwecke und Mittel
              der Verarbeitung von personenbezogenen Daten entscheidet.
            </p>
          </section>

          {/* 3. Rechtsgrundlage (Art. 6 DSGVO) */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              3. Rechtsgrundlage der Datenverarbeitung
            </h2>
            <p>
              Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf
              Grundlage der folgenden Rechtsgrundlagen:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung):</strong>{" "}
                Registrierung und Nutzung der Anwendung — Sie stimmen bei der
                Registrierung der Datenschutzerklärung und den AGB aktiv zu.
              </li>
              <li>
                <strong>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung):</strong>{" "}
                Bereitstellung der Schichtplanungsfunktionen,
                Arbeitszeiterfassung, Abwesenheitsverwaltung und sonstige
                vertraglich vereinbarte Leistungen.
              </li>
              <li>
                <strong>
                  Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse):
                </strong>{" "}
                Sicherheit der Anwendung, Missbrauchsprävention und technische
                Betriebsführung (z.B. Session-Cookies, Fehler-Logging).
              </li>
            </ul>
          </section>

          {/* 4. Datenerfassung */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              4. Datenerfassung auf dieser Website
            </h2>
            <h3 className="text-base font-medium text-gray-800 mb-1">
              Welche Daten werden erfasst?
            </h3>
            <p>
              Wir erheben personenbezogene Daten, die Sie uns bewusst mitteilen:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Bei der Registrierung: Name, E-Mail-Adresse, Firmenname,
                Passwort (gehasht gespeichert)
              </li>
              <li>
                Bei der Nutzung: Schichtdaten, Arbeitszeiten, Abwesenheiten,
                Verfügbarkeiten
              </li>
              <li>
                Mitarbeiterprofile: Name, E-Mail, Telefon, Position, Stundensatz
                (durch Arbeitgeber/Manager angelegt)
              </li>
            </ul>
            <h3 className="text-base font-medium text-gray-800 mt-4 mb-1">
              Wofür werden Ihre Daten genutzt?
            </h3>
            <p>
              Die Daten werden ausschließlich zur Bereitstellung der
              Schichtplanungsfunktionen erhoben. Ein Teil der Daten wird
              benötigt, um eine fehlerfreie Bereitstellung der Website zu
              gewährleisten.
            </p>
          </section>

          {/* 5. Datenspeicherung und -löschung */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              5. Datenspeicherung und Aufbewahrungsfristen
            </h2>
            <p>
              Ihre Daten werden so lange gespeichert, wie Ihr Benutzerkonto
              aktiv ist und zur Bereitstellung des Dienstes benötigt wird.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Kontodaten:</strong> Bis zur Löschung Ihres Kontos
                (jederzeit in den Einstellungen möglich).
              </li>
              <li>
                <strong>Arbeitszeitdaten:</strong> Gemäß gesetzlicher
                Aufbewahrungspflichten (§ 16 Abs. 2 ArbZG: 2 Jahre nach
                Erfassung).
              </li>
              <li>
                <strong>Server-Logs:</strong> Automatische Löschung nach 30
                Tagen.
              </li>
            </ul>
            <p className="mt-2">
              Nach Löschung Ihres Kontos werden alle personenbezogenen Daten
              innerhalb von 30 Tagen unwiderruflich gelöscht, sofern keine
              gesetzlichen Aufbewahrungspflichten bestehen.
            </p>
          </section>

          {/* 6. Hosting & Auftragsverarbeiter */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              6. Hosting und Auftragsverarbeiter
            </h2>
            <p>
              Wir setzen folgende Dienstleister ein, mit denen
              Auftragsverarbeitungsverträge (AVV) gemäß Art. 28 DSGVO bestehen:
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              a) Vercel Inc. — Hosting
            </h3>
            <p>
              Server-Standort: EU (Frankfurt am Main). Vercel verarbeitet Daten
              gemäß der DSGVO und EU-US Data Privacy Framework.{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                Datenschutzerklärung von Vercel
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              b) Supabase Inc. — Datenbank (PostgreSQL)
            </h3>
            <p>
              Server-Standort: EU. Supabase verarbeitet Daten gemäß der DSGVO.{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                Datenschutzerklärung von Supabase
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              c) Resend Inc. — E-Mail-Versand
            </h3>
            <p>
              Versand von System-E-Mails (Schichtbenachrichtigungen,
              Abwesenheitsgenehmigungen). Sie können E-Mail-Benachrichtigungen
              jederzeit in Ihren Einstellungen deaktivieren.{" "}
              <a
                href="https://resend.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                Datenschutzerklärung von Resend
              </a>
              .
            </p>
          </section>

          {/* 7. Cookies */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              7. Cookies
            </h2>
            <p>
              Diese Website verwendet ausschließlich technisch notwendige
              Cookies:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Session-Cookie:</strong> Für die Authentifizierung (wird
                beim Abmelden oder nach Ablauf automatisch gelöscht).
              </li>
              <li>
                <strong>Spracheinstellung:</strong> Speichert Ihre bevorzugte
                Sprache (Deutsch/Englisch).
              </li>
            </ul>
            <p className="mt-2">
              Es werden <strong>keine</strong> Tracking-, Analyse- oder
              Marketing-Cookies eingesetzt. Ein Cookie-Banner ist daher nicht
              erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
          </section>

          {/* 8. Ihre Rechte */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              8. Ihre Rechte (DSGVO)
            </h2>
            <p>
              Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Recht auf Auskunft (Art. 15 DSGVO):</strong> Sie können
                jederzeit Auskunft über Ihre gespeicherten Daten verlangen.
              </li>
              <li>
                <strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong>{" "}
                Unrichtige Daten können Sie in Ihren Einstellungen selbst
                korrigieren.
              </li>
              <li>
                <strong>Recht auf Löschung (Art. 17 DSGVO):</strong> Sie können
                Ihr Konto jederzeit in den Einstellungen löschen. Alle Daten
                werden unwiderruflich entfernt.
              </li>
              <li>
                <strong>
                  Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO):
                </strong>{" "}
                Kontaktieren Sie uns, um die Verarbeitung einzuschränken.
              </li>
              <li>
                <strong>Recht auf Datenübertragbarkeit (Art. 20 DSGVO):</strong>{" "}
                Sie können Ihre Daten jederzeit als JSON-Datei in den
                Einstellungen exportieren.
              </li>
              <li>
                <strong>Recht auf Widerspruch (Art. 21 DSGVO):</strong> Sie
                können der Verarbeitung jederzeit widersprechen.
              </li>
              <li>
                <strong>Recht auf Widerruf der Einwilligung:</strong> Sie können
                Ihre Einwilligung jederzeit widerrufen — die Rechtmäßigkeit der
                bis zum Widerruf erfolgten Verarbeitung bleibt davon unberührt.
              </li>
            </ul>
          </section>

          {/* 9. Beschwerderecht */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              9. Beschwerderecht bei einer Aufsichtsbehörde
            </h2>
            <p>
              Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen
              die DSGVO verstößt, haben Sie das Recht, sich bei einer
              Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO).
            </p>
            <p className="mt-2">
              Zuständige Aufsichtsbehörde:
              <br />
              Der Hessische Beauftragte für Datenschutz und Informationsfreiheit
              <br />
              Postfach 3163, 65021 Wiesbaden
              <br />
              Telefon: +49 611 1408-0
              <br />
              E-Mail: poststelle@datenschutz.hessen.de
              <br />
              <a
                href="https://datenschutz.hessen.de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                datenschutz.hessen.de
              </a>
            </p>
          </section>

          {/* 10. Kontakt */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              10. Kontakt für Datenschutzfragen
            </h2>
            <p>
              Zur Ausübung Ihrer Rechte oder bei Fragen zum Datenschutz wenden
              Sie sich bitte an:
            </p>
            <p className="mt-2">E-Mail: kontakt@schichtplan.plan</p>
            <p className="mt-1 text-xs text-gray-500">
              Wir werden Ihr Anliegen schnellstmöglich, spätestens innerhalb
              eines Monats (Art. 12 Abs. 3 DSGVO), bearbeiten.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link
            href="/"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            &larr; Zurück zur Startseite
          </Link>
        </div>
      </main>
    </div>
  );
}
