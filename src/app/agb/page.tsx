import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";

export const metadata: Metadata = {
  title: "AGB – Allgemeine Geschäftsbedingungen",
  description:
    "Allgemeine Geschäftsbedingungen der Shiftfy Schichtplanungs-Software.",
  alternates: { canonical: "/agb" },
  robots: { index: true, follow: true },
};

export default function AGBPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Allgemeine Geschäftsbedingungen (AGB)
        </h1>

        <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 1 Geltungsbereich
            </h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der
              webbasierten Schichtplanungssoftware Shiftfy. Mit der
              Registrierung und Nutzung des Dienstes erkennen Sie diese AGB an.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 2 Leistungsbeschreibung
            </h2>
            <p>
              Shiftfy stellt eine webbasierte Plattform zur Schichtplanung,
              Zeiterfassung und Personalverwaltung bereit. Der genaue
              Funktionsumfang ergibt sich aus der aktuellen Produktbeschreibung
              auf der Website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 3 Registrierung und Nutzerkonto
            </h2>
            <p>
              Für die Nutzung von Shiftfy ist eine Registrierung erforderlich.
              Sie sind verpflichtet, wahrheitsgemäße Angaben zu machen und Ihre
              Zugangsdaten vertraulich zu behandeln. Sie haften für alle
              Aktivitäten, die unter Ihrem Konto stattfinden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 4 Verfügbarkeit
            </h2>
            <p>
              Wir bemühen uns um eine möglichst hohe Verfügbarkeit des Dienstes.
              Eine Verfügbarkeit von 100% kann technisch nicht gewährleistet
              werden. Wartungsarbeiten werden nach Möglichkeit vorab
              angekündigt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 5 Datenschutz
            </h2>
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
              <Link
                href="/datenschutz"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Datenschutzerklärung
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 6 Haftung
            </h2>
            <p>
              Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit. Bei
              leichter Fahrlässigkeit haften wir nur bei Verletzung wesentlicher
              Vertragspflichten und begrenzt auf den vorhersehbaren,
              vertragstypischen Schaden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 7 Kündigung
            </h2>
            <p>
              Sie können Ihr Konto jederzeit löschen. Mit der Löschung werden
              alle Ihre Daten unwiderruflich entfernt. Wir behalten uns das
              Recht vor, Konten bei Verstoß gegen diese AGB zu sperren.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 8 Widerrufsrecht
            </h2>
            <p>
              Verbrauchern steht ein gesetzliches Widerrufsrecht gemäß
              §§&nbsp;312b–312h, 355–357 BGB zu. Die vollständige
              Widerrufsbelehrung einschließlich des Muster-Widerrufsformulars
              finden Sie auf unserer{" "}
              <Link
                href="/widerruf"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                Widerrufsbelehrung
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 9 Änderungen der AGB
            </h2>
            <p>
              Wir behalten uns vor, diese AGB zu ändern. Über wesentliche
              Änderungen werden Sie per E-Mail informiert. Wesentliche
              Änderungen bedürfen Ihrer ausdrücklichen Zustimmung; diese kann
              elektronisch (z.&nbsp;B. per Bestätigungs-Button) erfolgen.
              Stimmen Sie den geänderten AGB nicht zu, haben Sie das Recht, den
              Vertrag zum Zeitpunkt des Inkrafttretens der Änderung zu kündigen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 10 Online-Streitbeilegung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              . Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
              teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 11 Schlussbestimmungen
            </h2>
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand
              ist, soweit gesetzlich zulässig, der Sitz des Anbieters. Sollten
              einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die
              Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link
            href="/"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            &larr; Zurück zur Startseite
          </Link>
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
