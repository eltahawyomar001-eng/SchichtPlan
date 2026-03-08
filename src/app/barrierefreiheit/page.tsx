import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";

export const metadata: Metadata = {
  title: "Barrierefreiheit",
  description:
    "Erklärung zur Barrierefreiheit der Shiftfy Software gemäß BITV 2.0.",
  alternates: { canonical: "/barrierefreiheit" },
  robots: { index: true, follow: true },
};

export default function BarrierefreiheitPage() {
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
          Erklärung zur Barrierefreiheit
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
          {/* 1. Geltungsbereich */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              1. Geltungsbereich
            </h2>
            <p>
              Diese Erklärung zur Barrierefreiheit gilt für die Webanwendung
              Shiftfy, erreichbar unter <strong>shiftfy.de</strong>. Wir sind
              bestrebt, unsere Webanwendung im Einklang mit dem{" "}
              <strong>Barrierefreiheitsstärkungsgesetz (BFSG)</strong> sowie der{" "}
              <strong>Europäischen Norm EN 301 549</strong> und den{" "}
              <strong>
                Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
              </strong>{" "}
              barrierefrei zugänglich zu machen.
            </p>
          </section>

          {/* 2. Stand der Barrierefreiheit */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              2. Stand der Barrierefreiheit
            </h2>
            <p>
              Die Webanwendung ist <strong>teilweise barrierefrei</strong>. Wir
              arbeiten kontinuierlich daran, die Barrierefreiheit zu verbessern.
            </p>
            <p className="mt-2">
              <strong>Bereits umgesetzte Maßnahmen:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Semantisches HTML mit korrekter Überschriftenhierarchie</li>
              <li>
                ARIA-Attribute auf interaktiven Elementen und Icons (
                <code>aria-label</code>, <code>aria-hidden</code>,{" "}
                <code>role</code>)
              </li>
              <li>
                Formulare mit verknüpften Labels (<code>htmlFor</code> /{" "}
                <code>for</code>)
              </li>
              <li>
                Sichtbare Fokusanzeige (<code>focus-visible</code>) auf allen
                interaktiven Elementen
              </li>
              <li>Skip-to-Content-Link für die Tastaturnavigation</li>
              <li>
                Dynamisches <code>lang</code>-Attribut auf{" "}
                <code>&lt;html&gt;</code> entsprechend der gewählten Sprache
              </li>
              <li>Ausreichende Farbkontraste für Texte und Bedienelemente</li>
              <li>Responsive Design für alle Bildschirmgrößen</li>
            </ul>
          </section>

          {/* 3. Bekannte Einschränkungen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              3. Bekannte Einschränkungen
            </h2>
            <p>
              Folgende Bereiche sind derzeit nicht vollständig barrierefrei:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Einzelne komplexe Tabellenansichten (Schichtplan-Kalender) sind
                möglicherweise für Screenreader nicht optimal aufbereitet. Wir
                arbeiten an einer Verbesserung.
              </li>
              <li>
                Einige Animationen berücksichtigen die{" "}
                <code>prefers-reduced-motion</code>-Einstellung noch nicht
                vollständig.
              </li>
            </ul>
          </section>

          {/* 4. Feedback & Kontakt */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              4. Feedback und Kontakt
            </h2>
            <p>
              Wenn Sie Barrieren feststellen, Fragen zur Barrierefreiheit haben
              oder Verbesserungsvorschläge mitteilen möchten, wenden Sie sich
              bitte an uns:
            </p>
            <p className="mt-2">
              E-Mail:{" "}
              <a
                href="mailto:info@bashabsheh-vergabepartner.de"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                info@bashabsheh-vergabepartner.de
              </a>
            </p>
            <p className="mt-2">
              Wir werden versuchen, Ihr Anliegen innerhalb von 14 Tagen zu
              beantworten und, sofern möglich, die gemeldete Barriere zeitnah zu
              beheben.
            </p>
          </section>

          {/* 5. Durchsetzungsverfahren */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              5. Durchsetzungsverfahren
            </h2>
            <p>
              Sollte eine Anfrage an uns nicht zufriedenstellend beantwortet
              werden, können Sie sich an die zuständige Durchsetzungsstelle
              wenden. Für Berlin ist die zuständige Überwachungsstelle:
            </p>
            <p className="mt-2">
              Landesamt für Arbeitsschutz, Gesundheitsschutz und technische
              Sicherheit Berlin (LAGetSi)
              <br />
              Turmstraße 21, Haus N
              <br />
              10559 Berlin
              <br />
              E-Mail:{" "}
              <a
                href="mailto:info@lagetsi.berlin.de"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                info@lagetsi.berlin.de
              </a>
              <br />
              <a
                href="https://www.berlin.de/lagetsi/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                www.berlin.de/lagetsi
              </a>
            </p>
          </section>

          {/* 6. Technische Informationen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              6. Technische Informationen
            </h2>
            <p>
              Shiftfy ist eine webbasierte Anwendung und funktioniert in allen
              modernen Browsern (Chrome, Firefox, Safari, Edge). Die Anwendung
              ist responsive und kann auf Desktop, Tablet und Mobilgeräten
              genutzt werden.
            </p>
            <p className="mt-2">
              Für die bestmögliche Nutzung mit assistiven Technologien empfehlen
              wir aktuelle Versionen von Screenreadern wie NVDA, JAWS oder
              VoiceOver.
            </p>
          </section>

          {/* 7. Rechtsgrundlagen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              7. Rechtsgrundlagen
            </h2>
            <p>
              Diese Erklärung wurde auf Grundlage der folgenden Vorschriften
              erstellt:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Barrierefreiheitsstärkungsgesetz (BFSG) — in Kraft seit dem 28.
                Juni 2025
              </li>
              <li>EU-Richtlinie 2019/882 (European Accessibility Act)</li>
              <li>
                EN 301 549 V3.2.1 (Europäische Norm für digitale
                Barrierefreiheit)
              </li>
              <li>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</li>
            </ul>
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
