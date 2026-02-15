import Link from "next/link";
import { SchichtPlanMark } from "@/components/icons";

export default function AGBPage() {
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
              webbasierten Schichtplanungssoftware SchichtPlan. Mit der
              Registrierung und Nutzung des Dienstes erkennen Sie diese AGB an.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 2 Leistungsbeschreibung
            </h2>
            <p>
              SchichtPlan stellt eine webbasierte Plattform zur Schichtplanung,
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
              Für die Nutzung von SchichtPlan ist eine Registrierung
              erforderlich. Sie sind verpflichtet, wahrheitsgemäße Angaben zu
              machen und Ihre Zugangsdaten vertraulich zu behandeln. Sie haften
              für alle Aktivitäten, die unter Ihrem Konto stattfinden.
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
                className="text-violet-600 hover:text-violet-700 underline"
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
              § 8 Änderungen der AGB
            </h2>
            <p>
              Wir behalten uns vor, diese AGB jederzeit zu ändern. Änderungen
              werden Ihnen per E-Mail mitgeteilt. Widersprechen Sie nicht
              innerhalb von 30 Tagen, gelten die neuen AGB als akzeptiert.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              § 9 Schlussbestimmungen
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
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            &larr; Zurück zur Startseite
          </Link>
        </div>
      </main>
    </div>
  );
}
