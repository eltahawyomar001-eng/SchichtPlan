import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description:
    "Datenschutzerklärung der Shiftfy Software. Informationen zum Umgang mit personenbezogenen Daten gemäß DSGVO.",
  alternates: { canonical: "/datenschutz" },
  robots: { index: true, follow: true },
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Startseite
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Preise
            </Link>
            <Link
              href="/blog"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Blog
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </nav>

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
              Bashabsheh Vergabepartner
              <br />
              Inhaber: Mohammad Bashabsheh
              <br />
              c/o VirtualOfficeBerlin
              <br />
              Kolonnenstraße 8
              <br />
              10827 Berlin, Deutschland
              <br />
              Telefon: +49 176 30365636
              <br />
              E-Mail: info@bashabsheh-vergabepartner.de
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
              <li>
                Digitale Unterschriften: Base64-codierte Signaturbilder,
                kryptographisch mit Zeitstempel und Besuchs-ID verknüpft
                (SHA-256-Hash)
              </li>
              <li>
                Geräte-Informationen: User-Agent, Geräte-ID (anonymisiert) — zur
                Sicherheit und Revisionssicherheit der Audit-Logs
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
              Sitz: San Francisco, USA. Server-Standort: EU (Frankfurt am Main).
              Datenübermittlung in die USA kann bei Support-/Wartungszugriffen
              erfolgen. Transfergarantie: EU-US Data Privacy Framework
              (Angemessenheitsbeschluss der EU-Kommission vom 10.07.2023, Art.
              45 DSGVO) sowie ergänzend EU-Standardvertragsklauseln (SCCs, Art.
              46 Abs. 2 lit. c DSGVO).{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung von Vercel
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              b) Supabase Inc. — Datenbank (PostgreSQL)
            </h3>
            <p>
              Sitz: San Francisco, USA. Server-Standort: EU (Frankfurt am Main,
              AWS eu-central-1). Alle Datenbankdaten werden ausschließlich in
              der EU verarbeitet und gespeichert. Administrativer Zugriff aus
              den USA möglich. Transfergarantie: EU-US Data Privacy Framework
              sowie EU-Standardvertragsklauseln (SCCs).{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung von Supabase
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              c) Resend Inc. — E-Mail-Versand
            </h3>
            <p>
              Sitz: San Francisco, USA. Versand von System-E-Mails
              (Schichtbenachrichtigungen, Abwesenheitsgenehmigungen,
              Verifizierung). E-Mail-Inhalte werden in den USA verarbeitet.
              Transfergarantie: EU-Standardvertragsklauseln (SCCs, Art. 46 Abs.
              2 lit. c DSGVO). Sie können E-Mail-Benachrichtigungen jederzeit in
              Ihren Einstellungen deaktivieren.{" "}
              <a
                href="https://resend.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung von Resend
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              d) Stripe, Inc. — Zahlungsabwicklung
            </h3>
            <p>
              Sitz: San Francisco, USA. Europäische Verarbeitung über Stripe
              Payments Europe, Ltd. (Dublin, Irland). Abwicklung von
              Abonnement-Zahlungen (Kreditkarte, SEPA-Lastschrift).
              Kartennummern werden nie auf unseren Servern gespeichert.
              Transfergarantie: EU-US Data Privacy Framework
              (Angemessenheitsbeschluss, Art. 45 DSGVO) sowie
              EU-Standardvertragsklauseln (SCCs). Stripe ist PCI DSS Level 1
              zertifiziert.{" "}
              <a
                href="https://stripe.com/de/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung von Stripe
              </a>
              .
            </p>

            <h3 className="text-base font-medium text-gray-800 mt-3 mb-1">
              e) Sentry (Functional Software, Inc.) — Fehlerüberwachung
            </h3>
            <p>
              Sitz: San Francisco, USA. Server-Standort: EU (Frankfurt am Main).
              Erfassung von Anwendungsfehlern zur Qualitätssicherung. Es werden
              technische Daten (Fehlermeldungen, Browser, Betriebssystem)
              übermittelt — keine personenbezogenen Inhalte. Transfergarantie:
              EU-US Data Privacy Framework sowie EU-Standardvertragsklauseln
              (SCCs). Die Aktivierung erfolgt nur mit Ihrer Einwilligung über
              den Cookie-Banner (Art. 6 Abs. 1 lit. a DSGVO).{" "}
              <a
                href="https://sentry.io/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung von Sentry
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
              Technisch notwendige Cookies (Session, Spracheinstellung) werden
              ohne Einwilligung gesetzt (§ 25 Abs. 2 Nr. 2 TDDDG). Für optionale
              Analyse-Cookies (z. B. Sentry Fehlerüberwachung) holen wir Ihre
              ausdrückliche Einwilligung über unseren Cookie-Banner ein (Art. 6
              Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Sie können Ihre
              Einstellungen jederzeit über den Link
              &quot;Cookie-Einstellungen&quot; in der Fußzeile ändern.
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
              Berliner Beauftragte für Datenschutz und Informationsfreiheit
              <br />
              Friedrichstr. 219
              <br />
              10969 Berlin
              <br />
              Telefon: +49 30 13889-0
              <br />
              E-Mail: mailbox@datenschutz-berlin.de
              <br />
              <a
                href="https://www.datenschutz-berlin.de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                www.datenschutz-berlin.de
              </a>
            </p>
          </section>

          {/* 10. Datenschutz-Ansprechpartner */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              10. Datenschutz-Ansprechpartner
            </h2>
            <p>
              Für Fragen zur Verarbeitung Ihrer personenbezogenen Daten oder zur
              Ausübung Ihrer Betroffenenrechte steht Ihnen unser freiwilliger
              Datenschutz-Ansprechpartner zur Verfügung:
            </p>
            <p className="mt-2">
              Mohammad Bashabsheh
              <br />
              Bashabsheh Vergabepartner
              <br />
              Kolonnenstraße 8, 10827 Berlin
              <br />
              E-Mail:{" "}
              <a
                href="mailto:datenschutz@bashabsheh-vergabepartner.de"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                datenschutz@bashabsheh-vergabepartner.de
              </a>
              <br />
              Telefon: +49 176 30365636
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Hinweis: Eine formelle Benennung eines Datenschutzbeauftragten
              gemäß Art.&nbsp;37 DSGVO i.&nbsp;V.&nbsp;m. §&nbsp;38 BDSG
              erfolgt, sobald die gesetzlichen Voraussetzungen (insbesondere die
              Beschäftigtenschwelle oder eine Kerntätigkeit in umfangreicher
              regelmäßiger und systematischer Überwachung) vorliegen.
            </p>
          </section>

          {/* 11. Kontakt */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              11. Kontakt für Datenschutzfragen
            </h2>
            <p>
              Zur Ausübung Ihrer Rechte oder bei Fragen zum Datenschutz wenden
              Sie sich bitte an:
            </p>
            <p className="mt-2">
              Bashabsheh Vergabepartner
              <br />
              Mohammad Bashabsheh
              <br />
              Kolonnenstraße 8, 10827 Berlin
              <br />
              E-Mail: info@bashabsheh-vergabepartner.de
              <br />
              Telefon: +49 176 30365636
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Wir werden Ihr Anliegen schnellstmöglich, spätestens innerhalb
              eines Monats (Art. 12 Abs. 3 DSGVO), bearbeiten.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900">Shiftfy</span>
          </div>
          <p className="text-sm text-gray-400 text-center">
            © {new Date().getFullYear()} Shiftfy. Alle Rechte vorbehalten.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 transition-colors"
            >
              Datenschutz
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 transition-colors"
            >
              Impressum
            </Link>
            <Link href="/agb" className="hover:text-gray-600 transition-colors">
              AGB
            </Link>
            <Link
              href="/widerruf"
              className="hover:text-gray-600 transition-colors"
            >
              Widerruf
            </Link>
            <Link
              href="/barrierefreiheit"
              className="hover:text-gray-600 transition-colors"
            >
              Barrierefreiheit
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
