import type { Metadata } from "next";
import Link from "next/link";
import {
  ShiftfyMark,
  CheckCircleIcon,
  CalendarIcon,
  ArrowRightIcon,
  UsersIcon,
  ShieldCheckIcon,
  ClockIcon,
} from "@/components/icons";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Schichtplanung Software – Dienstplan online erstellen | Shiftfy",
  description:
    "Schichtplanung Software: Dienstplan online erstellen, Schichten automatisch planen, Schichttausch per Klick. Kostenlos starten. Ideal für Gastronomie, Sicherheitsdienste, Einzelhandel & Pflege.",
  keywords: [
    "Schichtplanung",
    "Schichtplanung Software",
    "Schichtplan erstellen",
    "Dienstplan Software",
    "Dienstplan online",
    "Dienstplan erstellen",
    "Schichtplaner",
    "Personalplanung Software",
    "Schichtplanung kostenlos",
    "Einsatzplanung",
    "Schichtplan App",
    "automatische Schichtplanung",
    "Schichtplanung Gastronomie",
    "Dienstplan Sicherheitsdienst",
  ],
  alternates: {
    canonical: "/schichtplanung-software",
  },
  openGraph: {
    title: "Schichtplanung Software – Dienstplan online erstellen | Shiftfy",
    description:
      "Dienstplan online erstellen mit automatischer Konflikterkennung. Kostenlos starten, DSGVO-konform.",
    url: "https://www.shiftfy.de/schichtplanung-software",
  },
};

const features = [
  {
    title: "Drag-and-Drop Schichtplanung",
    description:
      "Erstellen Sie Schichtpläne intuitiv per Drag-and-Drop. Sehen Sie auf einen Blick, wer wann eingeplant ist — pro Tag, Woche oder Monat.",
    icon: CalendarIcon,
  },
  {
    title: "Automatische Konflikterkennung",
    description:
      "Shiftfy erkennt automatisch Konflikte: Doppelbuchungen, fehlende Ruhezeiten (11-h-Regel) und Überstunden werden sofort markiert.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Schichttausch per Klick",
    description:
      "Mitarbeiter können Schichten direkt in der App untereinander tauschen. Manager genehmigen mit einem Klick — kein Papierkram.",
    icon: UsersIcon,
  },
  {
    title: "Schichtvorlagen",
    description:
      "Wiederkehrende Schichten als Vorlage speichern. Frühschicht, Spätschicht, Nachtschicht — einmal anlegen, immer wieder verwenden.",
    icon: ClockIcon,
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
  "Schichtplan in Minuten statt Stunden erstellen",
  "Automatische Einhaltung des Arbeitszeitgesetzes",
  "Verfügbarkeiten und Wünsche digital erfassen",
  "Qualifikationen und Zertifizierungen berücksichtigen",
  "Push-Benachrichtigungen bei Änderungen",
  "Abwesenheiten und Urlaub direkt im Schichtplan sehen",
  "Multi-Standort-Planung in einem System",
  "Berichte: Auslastung, Stunden, Überstunden pro Mitarbeiter",
];

export default function SchichtplanungPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <BreadcrumbJsonLd
        items={[
          { name: "Startseite", url: "/" },
          {
            name: "Schichtplanung Software",
            url: "/schichtplanung-software",
          },
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
              href="/zeiterfassung-software"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              Zeiterfassung
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
                Schichtplanung Software
              </span>
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Schichtplanung{" "}
              <span className="text-gradient">online & automatisch</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              Erstellen Sie Dienstpläne in Minuten statt Stunden.
              Drag-and-Drop-Planung, automatische Konflikterkennung und
              Schichttausch per Klick — alles in einer App.
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
                Alles für die perfekte Schichtplanung
              </h2>
              <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
                Von der Erstellung über die Veröffentlichung bis zum
                Schichttausch — Shiftfy deckt den gesamten Prozess ab.
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
                Warum Teams Shiftfy für die Schichtplanung wählen
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

        {/* Industries */}
        <section className="py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                Schichtplanung für jede Branche
              </h2>
              <p className="mt-3 text-gray-500">
                Egal ob Gastronomie, Sicherheitsdienst oder Pflege — Shiftfy
                passt sich Ihrem Betrieb an.
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

        {/* Explainer (rich keyword content) */}
        <section className="py-16 sm:py-20 bg-white border-y border-gray-100">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-8">
              Was ist eine Schichtplanung Software?
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 leading-relaxed">
                Eine Schichtplanung Software (auch Dienstplan-Software oder
                Schichtplaner genannt) hilft Unternehmen, Arbeitsschichten
                effizient zu planen, zu verteilen und zu verwalten. Statt
                manueller Excel-Tabellen erledigt eine Software wie Shiftfy die
                Planung automatisch — unter Berücksichtigung von
                Verfügbarkeiten, Qualifikationen, Arbeitszeitgesetz und
                Wunschschichten.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                <strong>Vorteile gegenüber Excel:</strong> Automatische
                Konflikterkennung (Doppelbuchungen, Ruhezeiten), sofortige
                Benachrichtigungen bei Änderungen, integrierter Schichttausch,
                und lückenlose Dokumentation für Audits. Mitarbeiter sehen ihren
                Schichtplan jederzeit mobil.
              </p>
              <p className="text-gray-600 leading-relaxed mt-4">
                <strong>Für wen eignet sich Shiftfy?</strong> Für alle
                Unternehmen mit Schichtarbeit: Gastronomie, Sicherheitsdienste,
                Einzelhandel, Produktion, Pflege, Gebäudereinigung und weitere
                Dienstleistungsbranchen. Der kostenlose Starter-Plan eignet sich
                für Teams bis 5 Mitarbeiter, die bezahlten Pläne für wachsende
                Teams ohne Mitarbeiter-Limit.
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
                  Schichtplanung jetzt digitalisieren
                </h2>
                <p className="mt-4 text-emerald-200 text-lg max-w-xl mx-auto">
                  Kostenlos starten mit bis zu 5 Mitarbeitern — keine
                  Kreditkarte, kein Risiko.
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
                href="/zeiterfassung-software"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-600">
                  Zeiterfassung Software →
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
