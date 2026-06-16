import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Auftragsverarbeitungsvertrag (AVV)",
  description:
    "Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO zwischen dem Kunden (Verantwortlicher) und Shiftfy (Auftragsverarbeiter).",
  alternates: { canonical: "/avv" },
  robots: { index: true, follow: true },
};

export default function AvvPage() {
  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800 print:hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900 dark:text-zinc-100">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/datenschutz"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Datenschutz
            </Link>
            <Link
              href="/agb"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              AGB
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-2">
          Auftragsverarbeitungsvertrag (AVV)
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">
          gemäß Art. 28 DSGVO
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
          <section>
            <p>
              Dieser Auftragsverarbeitungsvertrag (nachfolgend
              &bdquo;Vertrag&ldquo;) konkretisiert die datenschutzrechtlichen
              Verpflichtungen der Vertragsparteien, die sich aus der Nutzung der
              Software &bdquo;Shiftfy&ldquo; ergeben. Er gilt zwischen dem
              Kunden, der Shiftfy im Rahmen seiner geschäftlichen Tätigkeit
              nutzt, als <strong>Verantwortlichem</strong> (Art. 4 Nr. 7 DSGVO)
              und dem Anbieter als <strong>Auftragsverarbeiter</strong> (Art. 4
              Nr. 8 DSGVO). Mit Abschluss der Registrierung und Bestätigung der
              Vertragsdokumente wird dieser Vertrag wirksam abgeschlossen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 1 Auftragsverarbeiter (Anbieter)
            </h2>
            <p>
              Bashabsheh Vergabepartner
              <br />
              Inhaber: Mohammad Bashabsheh
              <br />
              Kolonnenstraße 8, 10827 Berlin, Deutschland
              <br />
              E-Mail: info@bashabsheh-vergabepartner.de
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 2 Gegenstand und Dauer des Auftrags
            </h2>
            <p>
              Gegenstand des Auftrags ist die Verarbeitung personenbezogener
              Daten durch den Auftragsverarbeiter im Rahmen der Bereitstellung
              der Software-as-a-Service-Lösung Shiftfy (Personaleinsatz-,
              Schicht- und Zeiterfassungsplanung sowie damit verbundene
              Funktionen). Die Verarbeitung erfolgt ausschließlich auf Grundlage
              dieses Vertrags und der dokumentierten Weisungen des
              Verantwortlichen. Die Dauer des Auftrags entspricht der Laufzeit
              des zugrunde liegenden Hauptvertrags (Nutzungsvertrag /
              Abonnement).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 3 Art, Zweck und Umfang der Verarbeitung
            </h2>
            <p>
              Die Verarbeitung umfasst das Erheben, Erfassen, Organisieren,
              Speichern, Anpassen, Auslesen, Übermitteln, Einschränken und
              Löschen personenbezogener Daten zum Zweck der Erbringung der
              vertraglich vereinbarten Leistungen. Eine Verarbeitung der Daten
              zu eigenen Zwecken des Auftragsverarbeiters findet nicht statt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 4 Kategorien betroffener Personen und Daten
            </h2>
            <p>
              <strong>Betroffene Personen:</strong> Beschäftigte, Mitarbeitende,
              Bewerber sowie sonstige vom Verantwortlichen im System erfasste
              Personen.
            </p>
            <p className="mt-2">
              <strong>Datenkategorien:</strong> Stammdaten (Name, Kontaktdaten),
              Beschäftigungsdaten (Rolle, Qualifikationen, Vertragsdaten),
              Arbeits- und Pausenzeiten, Schicht- und Abwesenheitsdaten,
              Lohn-/Vergütungsdaten sowie ggf. weitere vom Verantwortlichen
              eingegebene Daten.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 5 Weisungsrecht des Verantwortlichen
            </h2>
            <p>
              Der Auftragsverarbeiter verarbeitet personenbezogene Daten
              ausschließlich auf dokumentierte Weisung des Verantwortlichen,
              einschließlich der Nutzung der über die Software bereitgestellten
              Funktionen und Einstellungen. Ist der Auftragsverarbeiter der
              Auffassung, dass eine Weisung gegen datenschutzrechtliche
              Vorschriften verstößt, informiert er den Verantwortlichen
              unverzüglich.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 6 Pflichten des Auftragsverarbeiters (Art. 28 Abs. 3 DSGVO)
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Verarbeitung nur gemäß dokumentierter Weisung, auch hinsichtlich
                Drittlandübermittlungen (lit. a).
              </li>
              <li>
                Verpflichtung der zur Verarbeitung befugten Personen zur
                Vertraulichkeit (lit. b).
              </li>
              <li>
                Ergreifen der erforderlichen technischen und organisatorischen
                Maßnahmen nach Art. 32 DSGVO (lit. c, siehe § 8).
              </li>
              <li>
                Einsatz weiterer Auftragsverarbeiter nur unter den Bedingungen
                des § 7 (lit. d).
              </li>
              <li>
                Unterstützung des Verantwortlichen bei Betroffenenrechten (lit.
                e) sowie bei den Pflichten nach Art. 32–36 DSGVO (lit. f).
              </li>
              <li>
                Löschung oder Rückgabe aller Daten nach Beendigung (lit. g,
                siehe § 9).
              </li>
              <li>
                Bereitstellung aller erforderlichen Informationen zum Nachweis
                der Einhaltung und Ermöglichung von Überprüfungen (lit. h, siehe
                § 10).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 7 Unterauftragsverarbeiter
            </h2>
            <p>
              Der Verantwortliche erteilt seine allgemeine Genehmigung zum
              Einsatz der in der Anlage aufgeführten Unterauftragsverarbeiter.
              Der Auftragsverarbeiter informiert den Verantwortlichen über
              beabsichtigte Änderungen (Aufnahme oder Ersetzung) und räumt ihm
              die Möglichkeit zum Widerspruch ein. Mit jedem
              Unterauftragsverarbeiter werden Verträge geschlossen, die ein dem
              vorliegenden Vertrag entsprechendes Datenschutzniveau
              gewährleisten (Art. 28 Abs. 4 DSGVO). Eine aktuelle Liste ist in
              der
              <Link
                href="/datenschutz"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                {" "}
                Datenschutzerklärung
              </Link>{" "}
              sowie in der Anlage zu diesem Vertrag enthalten.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 8 Technische und organisatorische Maßnahmen (Art. 32 DSGVO)
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Verschlüsselung der Datenübertragung (TLS) und Daten im
                Ruhezustand.
              </li>
              <li>
                Datenhaltung in Rechenzentren innerhalb der EU (Frankfurt am
                Main).
              </li>
              <li>
                Rollen- und rechtebasierte Zugriffskontrolle, mandantengetrennte
                Datenhaltung pro Workspace.
              </li>
              <li>
                Authentifizierung mit gehashten Passwörtern, Rate Limiting.
              </li>
              <li>Revisionssichere Protokollierung (Audit-Logs).</li>
              <li>Regelmäßige Backups sowie Wiederherstellungsverfahren.</li>
              <li>
                Verfahren zur regelmäßigen Überprüfung und Bewertung der
                Maßnahmen.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 9 Löschung und Rückgabe nach Beendigung
            </h2>
            <p>
              Nach Abschluss der Erbringung der Verarbeitungsleistungen löscht
              der Auftragsverarbeiter nach Wahl des Verantwortlichen sämtliche
              personenbezogenen Daten oder gibt sie zurück, sofern nicht eine
              gesetzliche Aufbewahrungspflicht besteht. Der Verantwortliche kann
              die vollständige Löschung seines Workspace jederzeit über die
              Anwendung anstoßen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 10 Kontroll- und Auditrechte
            </h2>
            <p>
              Der Verantwortliche ist berechtigt, sich von der Einhaltung der
              technischen und organisatorischen Maßnahmen zu überzeugen. Der
              Auftragsverarbeiter stellt hierzu die erforderlichen Informationen
              bereit und ermöglicht angemessene Überprüfungen, auch durch einen
              vom Verantwortlichen beauftragten Prüfer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              § 11 Meldung von Datenschutzverletzungen
            </h2>
            <p>
              Der Auftragsverarbeiter unterstützt den Verantwortlichen bei der
              Einhaltung der Pflichten nach Art. 33 und 34 DSGVO und meldet ihm
              Verletzungen des Schutzes personenbezogener Daten unverzüglich
              nach Bekanntwerden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              Anlage: Unterauftragsverarbeiter
            </h2>
            <p>
              Die jeweils aktuelle und vollständige Liste der eingesetzten
              Unterauftragsverarbeiter — einschließlich Sitz, Zweck und
              Transfergarantien (EU-US Data Privacy Framework bzw.
              EU-Standardvertragsklauseln) — ist in Abschnitt 6 der{" "}
              <Link
                href="/datenschutz"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung
              </Link>{" "}
              dokumentiert. Sie umfasst u. a. Vercel (Hosting / Dateispeicher),
              Supabase (Datenbank, EU), Resend (E-Mail), Stripe (Zahlungen),
              Sentry (Fehlerüberwachung), Upstash (Rate Limiting) sowie — für
              die optionale Stundenzettel-Erkennung — Anthropic und OpenAI
              (KI-Texterkennung).
            </p>
          </section>

          <p className="text-xs text-gray-400 dark:text-zinc-500 pt-4">
            Stand:{" "}
            {new Date().toLocaleDateString("de-DE", {
              year: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-100 dark:border-zinc-800 py-10 print:hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
              Shiftfy
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-zinc-500">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Datenschutz
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Impressum
            </Link>
            <Link
              href="/agb"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              AGB
            </Link>
            <Link
              href="/avv"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              AVV
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
