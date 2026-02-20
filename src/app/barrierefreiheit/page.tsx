import Link from "next/link";
import { SchichtPlanMark } from "@/components/icons";

export default function BarrierefreiheitPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <SchichtPlanMark className="h-7 w-7" />
            <span className="text-lg font-bold text-gray-900">
              Schicht<span className="text-gradient">Plan</span>
            </span>
          </Link>
        </div>
      </header>

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
              SchichtPlan, erreichbar unter <strong>schichtplan.plan</strong>.
              Wir sind bestrebt, unsere Webanwendung im Einklang mit dem{" "}
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
                href="mailto:kontakt@schichtplan.plan"
                className="text-violet-600 hover:text-violet-700 underline"
              >
                kontakt@schichtplan.plan
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
              wenden. Für Hessen ist die zuständige Überwachungsstelle:
            </p>
            <p className="mt-2">
              Hessisches Ministerium für Soziales und Integration
              <br />
              Durchsetzungsstelle für digitale Barrierefreiheit
              <br />
              Sonnenberger Straße 2/2a
              <br />
              65193 Wiesbaden
            </p>
          </section>

          {/* 6. Technische Informationen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              6. Technische Informationen
            </h2>
            <p>
              SchichtPlan ist eine webbasierte Anwendung und funktioniert in
              allen modernen Browsern (Chrome, Firefox, Safari, Edge). Die
              Anwendung ist responsive und kann auf Desktop, Tablet und
              Mobilgeräten genutzt werden.
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

        <div className="mt-12 pt-6 border-t border-gray-200 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
