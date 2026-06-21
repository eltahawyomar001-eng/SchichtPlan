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
import ThemeToggle from "@/components/ui/theme-toggle";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title:
    "Schichtplanung Sicherheitsdienst – Dienstplan & Zeiterfassung | Shiftfy",
  description:
    "Schichtplanung für Sicherheitsdienste: Dienstpläne für Objektschutz & Wachdienst erstellen, §34a-Qualifikationen prüfen, Nachtzuschläge automatisch berechnen, Zeiterfassung per App. 14 Tage testen, DSGVO-konform.",
  keywords: [
    "Schichtplanung Sicherheitsdienst",
    "Schichtplan Sicherheitsdienst",
    "Dienstplan Sicherheitsdienst",
    "Zeiterfassung Sicherheitsdienst",
    "Dienstplan Wachdienst",
    "Schichtplanung Objektschutz",
    "Personalplanung Sicherheitsdienst",
    "Einsatzplanung Sicherheitsdienst",
    "Sicherheitsdienst Software",
    "§34a Qualifikation Nachweis",
    "Nachtzuschlag berechnen Sicherheitsdienst",
  ],
  alternates: {
    canonical: "/schichtplanung-sicherheitsdienst",
  },
  openGraph: {
    title: "Schichtplanung Sicherheitsdienst – Dienstplan & Zeiterfassung",
    description:
      "Dienstpläne für Objektschutz & Wachdienst, §34a-Qualifikationen, Nacht- & Feiertagszuschläge automatisch. 14 Tage testen.",
    url: "https://www.shiftfy.de/schichtplanung-sicherheitsdienst",
  },
};

const features = [
  {
    title: "24/7-Dienstpläne für Objektschutz",
    description:
      "Planen Sie Früh-, Spät- und Nachtschichten über mehrere Objekte und Standorte hinweg — lückenlose Besetzung rund um die Uhr per Drag-and-Drop.",
    icon: CalendarIcon,
  },
  {
    title: "§34a-Qualifikationen automatisch prüfen",
    description:
      "Hinterlegen Sie Sachkundeprüfung §34a, Unterrichtungsnachweis und Zertifikate je Mitarbeiter. Shiftfy plant nur Personal ein, das für das Objekt qualifiziert ist.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Nacht-, Sonn- & Feiertagszuschläge",
    description:
      "Zuschläge für Nacht-, Sonn- und Feiertagsarbeit werden automatisch erfasst und berechnet — direkt aus den geleisteten Schichten für den Lohnexport.",
    icon: ClockIcon,
  },
  {
    title: "Mobile Zeiterfassung im Einsatz",
    description:
      "Wachpersonal stempelt per App oder QR-Code am Objekt ein und aus. Ist-Zeiten fließen automatisch in die Lohnabrechnung — kein Papier, keine Excel-Listen.",
    icon: UsersIcon,
  },
];

const benefits = [
  "Mehrere Objekte und Auftraggeber in einem Dienstplan verwalten",
  "Arbeitszeitgesetz & Ruhezeiten (11-Stunden-Regel) automatisch einhalten",
  "Qualifikationen & Sachkundenachweise pro Einsatz prüfen",
  "Nacht-, Sonn- und Feiertagszuschläge automatisch berechnen",
  "Kurzfristige Ausfälle per SOS-Funktion schnell nachbesetzen",
  "Zeiterfassung per App oder QR-Code direkt am Objekt",
  "Lückenlose Dokumentation für Auftraggeber & Audits",
  "DSGVO-konform, Server in der EU",
];

const faqs = [
  {
    q: "Ist Shiftfy für kleine und große Sicherheitsdienste geeignet?",
    a: "Ja. Shiftfy skaliert vom Ein-Objekt-Wachdienst bis zum überregionalen Sicherheitsunternehmen mit mehreren Niederlassungen. Die Abrechnung erfolgt pro Nutzer und Monat, Sie zahlen nur für aktive Mitarbeiter.",
  },
  {
    q: "Werden §34a-Nachweise berücksichtigt?",
    a: "Ja. Sie hinterlegen pro Mitarbeiter Qualifikationen wie die Sachkundeprüfung §34a, Unterrichtungsnachweise und Ablaufdaten. Shiftfy warnt vor ablaufenden Nachweisen und verhindert die Einplanung nicht qualifizierter Kräfte.",
  },
  {
    q: "Können Nacht- und Feiertagszuschläge automatisch berechnet werden?",
    a: "Ja. Zuschläge für Nacht-, Sonn- und Feiertagsarbeit werden automatisch aus den geleisteten Schichten ermittelt und stehen für DATEV- und Lohnexport bereit.",
  },
];

export default function SchichtplanungSicherheitsdienstPage() {
  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950">
      <BreadcrumbJsonLd
        items={[
          { name: "Startseite", url: "/" },
          {
            name: "Schichtplanung Sicherheitsdienst",
            url: "/schichtplanung-sicherheitsdienst",
          },
        ]}
      />
      {/* FAQ structured data for rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="w-7 h-7" />
            <span className="font-bold text-base text-gray-900 dark:text-white">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/schichtplanung-software"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Schichtplanung
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Preise
            </Link>
            <ThemeToggle />
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              14 Tage testen
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-gray-950 dark:to-emerald-950/20" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
              <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                Für Sicherheitsdienste
              </span>
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
              Schichtplanung & Zeiterfassung für{" "}
              <span className="text-gradient">Sicherheitsdienste</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              Dienstpläne für Objektschutz und Wachdienst erstellen,
              §34a-Qualifikationen prüfen, Nacht- und Feiertagszuschläge
              automatisch berechnen — und die Arbeitszeit per App direkt am
              Objekt erfassen.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand-gradient text-white font-bold px-8 py-3.5 rounded-full hover:shadow-xl hover:shadow-emerald-200/50 transition-all flex items-center gap-2"
              >
                14 Tage testen
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-8 py-3.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                Preise ansehen
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">
              14 Tage Testphase · Jederzeit kündbar · DSGVO-konform · Server in
              der EU
            </p>
          </div>
        </div>
      </header>

      <main>
        {/* Features */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                Speziell für den Wach- und Sicherheitsbereich
              </h2>
              <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
                Von der 24/7-Objektbesetzung bis zur Zuschlagsberechnung —
                Shiftfy bildet die Anforderungen von Sicherheitsdiensten ab.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <f.icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
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
        <section className="py-16 sm:py-20 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                Warum Sicherheitsdienste Shiftfy nutzen
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((b) => (
                <div key={b} className="flex items-start gap-3 py-3">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Explainer (rich keyword content) */}
        <section className="py-16 sm:py-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-8">
              Dienstplan-Software für den Sicherheitsdienst
            </h2>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Die Schichtplanung im Sicherheitsdienst ist besonders
                anspruchsvoll: Objekte müssen rund um die Uhr besetzt sein,
                Mitarbeiter brauchen gültige Qualifikationen wie die
                Sachkundeprüfung nach §34a GewO, und Nacht-, Sonn- sowie
                Feiertagszuschläge müssen korrekt abgerechnet werden. Shiftfy
                übernimmt diese Aufgaben automatisch — statt fehleranfälliger
                Excel-Dienstpläne.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Objektbezogene Einsatzplanung:</strong> Planen Sie
                Wachpersonal pro Objekt und Auftraggeber, erkennen Sie
                Doppelbuchungen und Unterbesetzungen sofort und reagieren Sie
                bei Ausfällen mit der SOS-Funktion in Minuten.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Zeiterfassung & Lohn:</strong> Mitarbeiter erfassen ihre
                Arbeitszeit per App oder QR-Code direkt am Einsatzort. Zuschläge
                und Ist-Zeiten fließen automatisch in den DATEV- und Lohnexport
                — eine lückenlose Grundlage für Abrechnung und
                Auftraggeber-Nachweise.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-20 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-8">
              Häufige Fragen
            </h2>
            <div className="space-y-6">
              {faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {f.q}
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 leading-relaxed">
                    {f.a}
                  </p>
                </div>
              ))}
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
                  Dienstplanung für Ihren Sicherheitsdienst digitalisieren
                </h2>
                <p className="mt-4 text-emerald-200 text-lg max-w-xl mx-auto">
                  14 Tage testen — danach ab 2,99 €/Nutzer/Monat. Jederzeit
                  kündbar.
                </p>
                <div className="mt-8">
                  <Link
                    href="/register"
                    className="bg-white text-emerald-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all inline-flex items-center gap-2"
                  >
                    14 Tage testen
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Mehr entdecken
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/schichtplanung-software"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-emerald-600">
                  Schichtplanung Software →
                </span>
              </Link>
              <Link
                href="/zeiterfassung-logistik"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-emerald-600">
                  Zeiterfassung Logistik →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-emerald-600">
                  Preise vergleichen →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              Shiftfy
            </span>
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
