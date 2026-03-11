import type { Metadata } from "next";
import Link from "next/link";
import {
  ShiftfyMark,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title:
    "Zeiterfassung Software – Digitale Arbeitszeiterfassung für Teams | Shiftfy",
  description:
    "Zeiterfassung Software für Unternehmen: Stempeluhr-App, GPS-Verifizierung, automatische Pausenberechnung nach ArbZG. DSGVO-konform, kostenlos starten. Ideal für Gastronomie, Sicherheitsdienste & Dienstleister.",
  keywords: [
    "Zeiterfassung",
    "Zeiterfassung Software",
    "Zeiterfassung App",
    "Arbeitszeiterfassung",
    "digitale Zeiterfassung",
    "Zeiterfassung Mitarbeiter",
    "Stempeluhr App",
    "Stempeluhr digital",
    "Zeiterfassung kostenlos",
    "Zeiterfassung DSGVO",
    "Zeiterfassung Pflicht",
    "Arbeitszeit erfassen",
    "Zeiterfassung Gastronomie",
    "Zeiterfassung Sicherheitsdienst",
  ],
  alternates: {
    canonical: "/zeiterfassung-software",
  },
  openGraph: {
    title: "Zeiterfassung Software – Arbeitszeiten digital erfassen | Shiftfy",
    description:
      "Kostenlose Zeiterfassung mit Stempeluhr, GPS & Lohnexport. DSGVO-konform, made in Germany.",
    url: "https://www.shiftfy.de/zeiterfassung-software",
  },
};

const features = [
  {
    title: "Digitale Stempeluhr",
    description:
      "Mitarbeiter stempeln per App ein und aus — mit einem Klick. Funktioniert auf Smartphone, Tablet und Desktop.",
    icon: ClockIcon,
  },
  {
    title: "GPS-Verifizierung",
    description:
      "Optionale GPS-Standort-Erfassung beim Ein- und Ausstempeln. Ideal für dezentrale Teams und Außendienst.",
    icon: SmartphoneIcon,
  },
  {
    title: "Automatische Pausenberechnung",
    description:
      "Pausen werden automatisch nach dem Arbeitszeitgesetz (ArbZG) berechnet: 30 Min. ab 6 h, 45 Min. ab 9 h Arbeitszeit.",
    icon: CheckCircleIcon,
  },
  {
    title: "DSGVO-konform",
    description:
      "Alle Daten auf deutschen/EU-Servern. Vollständige Datenschutz-Dokumentation und Auftragsdatenverarbeitung.",
    icon: ShieldCheckIcon,
  },
];

const useCases = [
  "Gastronomie & Hotels",
  "Sicherheitsdienste",
  "Einzelhandel",
  "Produktion & Logistik",
  "Gebäudereinigung",
  "Pflegedienste",
  "Handwerksbetriebe",
  "Eventmanagement",
];

const benefits = [
  "Echtzeit-Übersicht aller Arbeitszeiten",
  "Automatischer Überstunden-Nachweis",
  "CSV- und DATEV-Lohnexport",
  "Monatsabschluss per Klick",
  "Industrieminuten-Umrechnung (z. B. 7:45 h → 7,75 h)",
  "Lückenloser Audit-Trail für Prüfungen",
  "Mehrstufiger Freigabe-Workflow",
  "Urlaubskonto und Zeitkonto pro Mitarbeiter",
];

export default function ZeiterfassungPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <BreadcrumbJsonLd
        items={[
          { name: "Startseite", url: "/" },
          { name: "Zeiterfassung Software", url: "/zeiterfassung-software" },
        ]}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="w-7 h-7" />
            <span className="font-bold text-base text-gray-900">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/schichtplanung-software"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Schichtplanung
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Preise
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Anmelden
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

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
              <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                Zeiterfassung Software
              </span>
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Digitale Zeiterfassung{" "}
              <span className="text-gradient">für Ihr Team</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              Arbeitszeiten erfassen, Pausen automatisch berechnen, GPS-Standort
              dokumentieren — und per Klick zur Lohnabrechnung exportieren.
              DSGVO-konform und rechtssicher.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand-gradient text-white font-bold px-8 py-3.5 rounded-full hover:shadow-xl hover:shadow-emerald-200/50 transition-all flex items-center gap-2"
              >
                Kostenlos starten
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="border border-gray-300 text-gray-700 font-semibold px-8 py-3.5 rounded-full hover:bg-gray-50 transition-all"
              >
                Preise ansehen
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">
              Kostenloser Starter-Plan · Keine Kreditkarte · DSGVO-konform
            </p>
          </div>
        </div>
      </header>

      <main>
        {/* Features */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                Zeiterfassung, die wirklich funktioniert
              </h2>
              <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
                Von der Stempeluhr bis zum Lohnexport — alles in einer App,
                konform mit dem Arbeitszeitgesetz.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <f.icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {f.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 sm:py-20 bg-white border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                Vorteile der digitalen Zeiterfassung mit Shiftfy
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((b) => (
                <div key={b} className="flex items-start gap-3 py-3">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-gray-700">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases / Industries */}
        <section className="py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                Zeiterfassung für jede Branche
              </h2>
              <p className="mt-3 text-gray-500">
                Ob Gastronomie, Sicherheitsdienst oder Handwerk — Shiftfy passt
                sich an Ihren Betrieb an.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {useCases.map((uc) => (
                <div
                  key={uc}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm font-medium text-gray-700"
                >
                  {uc}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Arbeitszeitgesetz Section (rich keyword content) */}
        <section className="py-16 sm:py-20 bg-white border-y border-gray-100">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-8">
              Zeiterfassung Pflicht: Was das Arbeitszeitgesetz vorschreibt
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 leading-relaxed">
                Seit dem BAG-Urteil vom September 2022 sind Arbeitgeber in
                Deutschland verpflichtet, die Arbeitszeiten ihrer Mitarbeiter
                systematisch zu erfassen. Das Arbeitszeitgesetz (ArbZG) regelt
                maximale Arbeitszeiten, Pausenregelungen und Ruhezeiten. Mit
                einer digitalen Zeiterfassung wie Shiftfy erfüllen Sie alle
                gesetzlichen Anforderungen automatisch.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                <strong>Maximale Arbeitszeit:</strong> 8 Stunden pro Werktag,
                erweiterbar auf 10 Stunden bei Ausgleich innerhalb von 6
                Monaten. <strong>Ruhezeit:</strong> Mindestens 11 Stunden
                zwischen zwei Arbeitstagen. <strong>Pausen:</strong> 30 Minuten
                ab 6 Stunden, 45 Minuten ab 9 Stunden Arbeitszeit.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                Shiftfy prüft all diese Vorschriften automatisch bei jeder
                Zeitbuchung und warnt bei Verstößen. Der lückenlose Audit-Trail
                dokumentiert jede Änderung — ideal für Betriebsprüfungen und
                Nachweispflichten.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 p-8 sm:p-12 md:p-16 text-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full pointer-events-none" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  Zeiterfassung jetzt digitalisieren
                </h2>
                <p className="mt-4 text-emerald-200 text-lg max-w-xl mx-auto">
                  Kostenlos starten mit bis zu 5 Mitarbeitern — keine
                  Kreditkarte, kein Risiko, DSGVO-konform.
                </p>
                <div className="mt-8">
                  <Link
                    href="/register"
                    className="bg-white text-emerald-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all inline-flex items-center gap-2"
                  >
                    Kostenlos starten
                    <ArrowRightIcon className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Internal Links */}
        <section className="pb-16">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Mehr entdecken
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/schichtplanung-software"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600">
                  Schichtplanung Software →
                </span>
              </Link>
              <Link
                href="/blog"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600">
                  Blog: Tipps & Arbeitsrecht →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600">
                  Preise vergleichen →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900">Shiftfy</span>
          </div>
          <p className="text-sm text-gray-400">
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
          </div>
        </div>
      </footer>
    </div>
  );
}
