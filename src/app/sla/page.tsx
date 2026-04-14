import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "SLA – Service Level Agreement | Shiftfy",
  description:
    "Service Level Agreement (SLA) der Shiftfy Schichtplanungs-Software. Verfügbarkeit, Support-Reaktionszeiten und Datengarantien.",
  alternates: { canonical: "/sla" },
  robots: { index: true, follow: true },
};

export default function SLAPage() {
  const effectiveDate = "01.03.2026";

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900 dark:text-white">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Startseite
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Preise
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Login
            </Link>
            <ThemeToggle />
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Service Level Agreement (SLA)
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">
          Gültig ab: {effectiveDate}
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 1 Geltungsbereich
            </h2>
            <p>
              Dieses Service Level Agreement (SLA) gilt für alle Kunden der
              Shiftfy-Plattform mit einem aktiven Abonnement (Basic,
              Professional oder Enterprise). Es definiert die zugesicherten
              Service-Level für Verfügbarkeit, Performance, Support und
              Datensicherheit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 2 Verfügbarkeit
            </h2>
            <p>
              Shiftfy garantiert eine monatliche Verfügbarkeit von mindestens{" "}
              <strong>99,9 %</strong> für die Kernplattform (API und
              Web-Applikation). Geplante Wartungsfenster (maximal 4 Stunden pro
              Monat, angekündigt mit mindestens 48 Stunden Vorlauf) sind von der
              Verfügbarkeitsberechnung ausgenommen.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Verfügbarkeit
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Max. Ausfallzeit/Monat
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">99,9 %</td>
                    <td className="px-3 py-2">43 Minuten</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">99,5 % (Minimum)</td>
                    <td className="px-3 py-2">3,6 Stunden</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 3 Performance
            </h2>
            <p>
              API-Antwortzeiten (P95) betragen maximal <strong>500 ms</strong>{" "}
              für Standard-Endpunkte und <strong>2.000 ms</strong> für komplexe
              Berechnungen (Auto-Scheduler, Berichte). Die Seitenladung der
              Web-Applikation erfolgt innerhalb von <strong>3 Sekunden</strong>{" "}
              (Lighthouse Performance Score ≥ 90).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 4 Support-Reaktionszeiten
            </h2>
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Schweregrad
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Erste Antwort
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Lösung
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 font-medium">SEV1 – Kritisch</td>
                    <td className="px-3 py-2">&lt; 1 Stunde</td>
                    <td className="px-3 py-2">&lt; 4 Stunden</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 font-medium">SEV2 – Hoch</td>
                    <td className="px-3 py-2">&lt; 4 Stunden</td>
                    <td className="px-3 py-2">&lt; 24 Stunden</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 font-medium">SEV3 – Mittel</td>
                    <td className="px-3 py-2">&lt; 24 Stunden</td>
                    <td className="px-3 py-2">&lt; 72 Stunden</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2 font-medium">SEV4 – Niedrig</td>
                    <td className="px-3 py-2">&lt; 48 Stunden</td>
                    <td className="px-3 py-2">Nächstes Release</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 5 Datensicherheit & Backups
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Tägliche automatische Backups mit Point-in-Time Recovery (PITR)
              </li>
              <li>
                Recovery Point Objective (RPO): <strong>&lt; 5 Minuten</strong>
              </li>
              <li>
                Recovery Time Objective (RTO): <strong>&lt; 1 Stunde</strong>
              </li>
              <li>AES-256 Verschlüsselung für Daten im Ruhezustand</li>
              <li>TLS 1.3 für Daten in Übertragung</li>
              <li>
                DSGVO-konforme Datenverarbeitung (Standort: EU, Frankfurt)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 6 Wartungsfenster
            </h2>
            <p>
              Geplante Wartungsarbeiten werden mindestens{" "}
              <strong>48 Stunden</strong> im Voraus per E-Mail und
              In-App-Benachrichtigung angekündigt. Wartungsfenster finden
              bevorzugt sonntags zwischen 02:00 und 06:00 Uhr MEZ statt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 7 Gutschriften bei SLA-Verletzung
            </h2>
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Verfügbarkeit
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                      Gutschrift
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">99,0 % – 99,9 %</td>
                    <td className="px-3 py-2">10 % der Monatsgebühr</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">95,0 % – 99,0 %</td>
                    <td className="px-3 py-2">25 % der Monatsgebühr</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">&lt; 95,0 %</td>
                    <td className="px-3 py-2">50 % der Monatsgebühr</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Gutschriften müssen innerhalb von 30 Tagen nach dem Vorfall
              schriftlich beantragt werden. Die maximale Gutschrift pro Monat
              beträgt 50 % der monatlichen Abonnementgebühr.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 8 Monitoring & Statusseite
            </h2>
            <p>
              Der aktuelle Systemstatus ist jederzeit unter unserer öffentlichen
              Statusseite einsehbar. Bei Störungen werden Kunden proaktiv per
              E-Mail und In-App-Benachrichtigung informiert.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 9 Ausschlüsse
            </h2>
            <p>Folgende Ereignisse sind vom SLA ausgenommen:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Höhere Gewalt (Naturkatastrophen, Krieg, Pandemie)</li>
              <li>
                Ausfälle durch Drittanbieter (DNS-Provider, CDN, Cloud-Provider)
              </li>
              <li>
                Kundenseitige Konfigurationsfehler (z. B. falsche API-Keys)
              </li>
              <li>Angekündigte Wartungsfenster</li>
              <li>
                DDoS-Angriffe, sofern angemessene Schutzmaßnahmen implementiert
                sind
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              § 10 Kontakt
            </h2>
            <p>
              Bei Fragen zu diesem SLA oder zur Beantragung von Gutschriften
              wenden Sie sich bitte an:{" "}
              <a
                href="mailto:info@bashabsheh-vergabepartner.de"
                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 underline"
              >
                info@bashabsheh-vergabepartner.de
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
          <Link
            href="/impressum"
            className="hover:text-gray-600 dark:hover:text-gray-300"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="hover:text-gray-600 dark:hover:text-gray-300"
          >
            Datenschutz
          </Link>
          <Link
            href="/agb"
            className="hover:text-gray-600 dark:hover:text-gray-300"
          >
            AGB
          </Link>
          <Link
            href="/widerruf"
            className="hover:text-gray-600 dark:hover:text-gray-300"
          >
            Widerruf
          </Link>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            SLA
          </span>
          <Link
            href="/barrierefreiheit"
            className="hover:text-gray-600 dark:hover:text-gray-300"
          >
            Barrierefreiheit
          </Link>
        </div>
      </footer>
    </div>
  );
}
