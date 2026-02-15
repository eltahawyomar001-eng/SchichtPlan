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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Datenschutzerklärung
        </h1>

        <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
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
              [Ihr vollständiger Name / Firmenname]
              <br />
              [Straße und Hausnummer]
              <br />
              [PLZ und Ort]
              <br />
              E-Mail: kontakt@schichtplan.plan
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              3. Datenerfassung auf dieser Website
            </h2>
            <h3 className="text-base font-medium text-gray-800 mb-1">
              Welche Daten werden erfasst?
            </h3>
            <p>
              Wir erheben personenbezogene Daten, die Sie uns bewusst mitteilen,
              z.B. bei der Registrierung (Name, E-Mail-Adresse, Firmenname) und
              bei der Nutzung der Anwendung (Schichtdaten, Arbeitszeiten,
              Abwesenheiten).
            </p>
            <h3 className="text-base font-medium text-gray-800 mt-4 mb-1">
              Wofür werden Ihre Daten genutzt?
            </h3>
            <p>
              Die Daten werden ausschließlich zur Bereitstellung der
              Schichtplanungsfunktionen erhoben. Ein Teil der Daten wird
              benötigt, um eine fehlerfreie Bereitstellung der Website zu
              gewährleisten.
            </p>
            <h3 className="text-base font-medium text-gray-800 mt-4 mb-1">
              Welche Rechte haben Sie bezüglich Ihrer Daten?
            </h3>
            <p>
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung
              und Einschränkung der Verarbeitung Ihrer personenbezogenen Daten.
              Hierzu können Sie sich jederzeit an uns wenden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              4. Hosting
            </h2>
            <p>
              Diese Website wird bei Vercel Inc. gehostet. Die Server befinden
              sich in der EU (Frankfurt). Details finden Sie in der
              Datenschutzerklärung von Vercel:{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                vercel.com/legal/privacy-policy
              </a>
              .
            </p>
            <p className="mt-2">
              Die Datenbank wird bei Supabase (PostgreSQL) betrieben. Supabase
              verarbeitet Daten gemäß der DSGVO. Details:{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                supabase.com/privacy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              5. E-Mail-Benachrichtigungen
            </h2>
            <p>
              Wir verwenden Resend zum Versand von System-E-Mails (z.B.
              Schichtbenachrichtigungen, Abwesenheitsgenehmigungen). Sie können
              E-Mail-Benachrichtigungen jederzeit in Ihren Einstellungen
              deaktivieren.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              6. Cookies
            </h2>
            <p>
              Diese Website verwendet ausschließlich technisch notwendige
              Cookies (Session-Cookie für die Authentifizierung,
              Spracheinstellung). Es werden keine Tracking- oder
              Marketing-Cookies eingesetzt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              7. Ihre Rechte (DSGVO)
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
              <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
              <li>Recht auf Löschung (Art. 17 DSGVO)</li>
              <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Recht auf Widerspruch (Art. 21 DSGVO)</li>
            </ul>
            <p className="mt-2">
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:
              kontakt@schichtplan.plan
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
