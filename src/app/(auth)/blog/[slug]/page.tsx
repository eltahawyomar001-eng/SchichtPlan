import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type SVGProps } from "react";
import { getTranslations, getLocale } from "next-intl/server";
import {
  ShiftfyMark,
  ClipboardIcon,
  ScaleIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/icons";

interface BlogPostContent {
  title: string;
  date: string;
  readTime: string;
  categoryKey: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  content: string[];
}

const POSTS: Record<string, BlogPostContent> = {
  "schichtplanung-best-practices": {
    title: "10 Best Practices für die Schichtplanung",
    date: "2026-01-15",
    readTime: "5 min",
    categoryKey: "categoryPlanning",
    Icon: ClipboardIcon,
    content: [
      "Die effiziente Schichtplanung ist eine der größten Herausforderungen im Personalmanagement. Mit den richtigen Strategien und Tools können Sie nicht nur die Produktivität steigern, sondern auch die Zufriedenheit Ihrer Mitarbeiter erhöhen.",
      "1. Frühzeitige Planung: Veröffentlichen Sie Schichtpläne mindestens zwei Wochen im Voraus. Das gibt Ihren Mitarbeitern genügend Zeit, sich darauf einzustellen und eventuelle Konflikte rechtzeitig zu melden.",
      "2. Fairness bei der Verteilung: Achten Sie auf eine gleichmäßige Verteilung von beliebten und unbeliebten Schichten. Rotierende Systeme sorgen dafür, dass niemand dauerhaft benachteiligt wird.",
      "3. Ruhezeiten einhalten: Das Arbeitszeitgesetz schreibt mindestens 11 Stunden Ruhezeit zwischen zwei Schichten vor. Automatisierte Systeme wie Shiftfy prüfen diese Vorgaben automatisch.",
      "4. Qualifikationen berücksichtigen: Stellen Sie sicher, dass in jeder Schicht ausreichend qualifiziertes Personal eingeteilt ist. Taggen Sie Mitarbeiter mit ihren Qualifikationen und Zertifizierungen.",
      "5. Verfügbarkeiten abfragen: Nutzen Sie digitale Tools, um Verfügbarkeiten und Wünsche Ihrer Mitarbeiter zu erfassen. Das reduziert kurzfristige Änderungen und erhöht die Planungssicherheit.",
      "6. Puffer einplanen: Kalkulieren Sie immer einen kleinen Puffer für Krankheitsausfälle oder unerwartete Ereignisse ein. Eine Reserveliste mit Springern hat sich in der Praxis bewährt.",
      "7. Kommunikation: Informieren Sie Ihr Team über Änderungen sofort und über den bevorzugten Kanal – ob Push-Benachrichtigung, E-Mail oder direkte Nachricht.",
      "8. Feedback einholen: Führen Sie regelmäßig Befragungen zur Zufriedenheit mit der Schichtplanung durch. So erkennen Sie Probleme frühzeitig.",
      "9. Digitale Tools nutzen: Ersetzen Sie Excel-Tabellen durch spezialisierte Software wie Shiftfy. Das spart Zeit, vermeidet Fehler und bietet Transparenz für alle Beteiligten.",
      "10. Analyse und Optimierung: Nutzen Sie Berichte und Auswertungen, um Ihre Planung kontinuierlich zu verbessern. Überprüfen Sie regelmäßig Kennzahlen wie Überstunden, Krankheitstage und Mitarbeiterfluktuation.",
    ],
  },
  "arbeitszeitgesetz-2025": {
    title: "Arbeitszeitgesetz 2025 – Was Arbeitgeber wissen müssen",
    date: "2026-01-10",
    readTime: "7 min",
    categoryKey: "categoryLaw",
    Icon: ScaleIcon,
    content: [
      "Das Arbeitszeitgesetz (ArbZG) regelt in Deutschland die zulässigen Arbeitszeiten, Pausen und Ruhezeiten. Für Arbeitgeber, die mit Schichtarbeit planen, ist die Einhaltung dieser Vorschriften besonders wichtig.",
      "Maximale Arbeitszeit: Die werktägliche Arbeitszeit darf 8 Stunden nicht überschreiten. Sie kann auf bis zu 10 Stunden verlängert werden, wenn innerhalb von 6 Kalendermonaten oder 24 Wochen im Durchschnitt 8 Stunden werktäglich nicht überschritten werden.",
      "Ruhepausen: Bei einer Arbeitszeit von mehr als 6 Stunden ist eine Pause von mindestens 30 Minuten vorgeschrieben. Bei mehr als 9 Stunden sind es 45 Minuten. Die Pausen können in Zeitabschnitte von mindestens 15 Minuten aufgeteilt werden.",
      "Ruhezeit: Nach Beendigung der täglichen Arbeitszeit müssen Arbeitnehmer eine ununterbrochene Ruhezeit von mindestens 11 Stunden haben. In bestimmten Branchen (z.B. Gastronomie, Pflege) kann diese auf 10 Stunden verkürzt werden.",
      "Nachtarbeit: Nachtarbeitnehmer haben Anspruch auf eine angemessene Zahl bezahlter freier Tage oder einen angemessenen Zuschlag. Regelmäßige arbeitsmedizinische Untersuchungen sind ebenfalls vorgeschrieben.",
      "Sonn- und Feiertagsruhe: An Sonn- und Feiertagen dürfen Arbeitnehmer grundsätzlich nicht beschäftigt werden. Ausnahmen gelten für bestimmte Branchen wie Gastronomie, Gesundheitswesen und Sicherheitsdienste.",
      "Dokumentationspflicht: Arbeitgeber sind verpflichtet, die über 8 Stunden hinausgehende Arbeitszeit aufzuzeichnen. Mit der EuGH-Rechtsprechung zur Arbeitszeiterfassung wird eine vollständige Dokumentation empfohlen.",
      "Shiftfy unterstützt Sie bei der Einhaltung all dieser Vorschriften mit automatischen Prüfungen, Warnhinweisen und lückenloser Dokumentation.",
    ],
  },
  "mitarbeiterbindung-schichtarbeit": {
    title: "Mitarbeiterbindung in der Schichtarbeit",
    date: "2026-01-05",
    readTime: "6 min",
    categoryKey: "categoryHR",
    Icon: UsersIcon,
    content: [
      "Fluktuation in schichtbasierten Betrieben ist oft höher als in Unternehmen mit regulären Arbeitszeiten. Doch mit den richtigen Maßnahmen können Sie Ihre Mitarbeiter langfristig binden.",
      "Transparente Planung: Nichts frustriert Mitarbeiter mehr als unvorhersehbare Schichtpläne. Sorgen Sie für Transparenz und Planbarkeit. Mit Shiftfy haben alle Mitarbeiter jederzeit Zugriff auf ihren aktuellen Schichtplan.",
      "Wunschschichten ermöglichen: Geben Sie Ihren Mitarbeitern die Möglichkeit, Wunschschichten anzugeben. Ein Algorithmus, der diese Wünsche berücksichtigt, steigert die Zufriedenheit erheblich.",
      "Work-Life-Balance: Achten Sie auf eine gesunde Balance zwischen Arbeits- und Freizeit. Vermeiden Sie zu häufige Wechsel zwischen Früh- und Spätschichten und planen Sie regelmäßige freie Wochenenden ein.",
      "Anerkennung und Wertschätzung: Besonders bei ungünstigen Schichtzeiten ist Wertschätzung wichtig. Ob Zuschläge, kleine Aufmerksamkeiten oder einfach ein Dankeschön – zeigen Sie Ihren Mitarbeitern, dass ihre Arbeit geschätzt wird.",
      "Weiterbildung: Bieten Sie auch Schichtarbeitern Zugang zu Weiterbildungsmaßnahmen. Flexible E-Learning-Formate lassen sich gut in den Schichtbetrieb integrieren.",
      "Gesundheitsmanagement: Schichtarbeit kann die Gesundheit belasten. Investieren Sie in betriebliches Gesundheitsmanagement – von ergonomischen Arbeitsplätzen bis hin zu Sportangeboten.",
      "Digitale Tools als Motivator: Moderne, benutzerfreundliche Tools wie Shiftfy signalisieren Ihren Mitarbeitern, dass Sie in zeitgemäße Lösungen investieren und deren Arbeitsalltag erleichtern möchten.",
    ],
  },
  "digitale-stempeluhr-vorteile": {
    title: "Digitale Stempeluhr: Vorteile gegenüber Papier",
    date: "2026-06-20",
    readTime: "4 min",
    categoryKey: "categoryTech",
    Icon: ClockIcon,
    content: [
      "Die Zeiten der Stechuhr und handschriftlichen Stundenzettel sind vorbei. Digitale Zeiterfassungssysteme bieten zahlreiche Vorteile für Unternehmen jeder Größe.",
      "Genauigkeit: Digitale Systeme erfassen Arbeitszeiten auf die Minute genau. Rundungsfehler, unleserliche Handschriften und nachträgliche Änderungen gehören der Vergangenheit an.",
      "Echtzeit-Überblick: Manager sehen in Echtzeit, wer gerade arbeitet, wer Pause macht und wer abwesend ist. Das erleichtert die Koordination im laufenden Betrieb erheblich.",
      "Automatische Berechnung: Überstunden, Zuschläge und Urlaubstage werden automatisch berechnet. Das spart der Personalabteilung wertvolle Zeit bei der Lohnabrechnung.",
      "GPS-Verifizierung: Mit Shiftfy können Sie optional GPS-Daten bei Ein- und Ausstempeln erfassen. So stellen Sie sicher, dass Mitarbeiter tatsächlich am Einsatzort sind.",
      "Gesetzeskonformität: Die EuGH-Rechtsprechung fordert eine systematische Erfassung der Arbeitszeit. Digitale Systeme erfüllen diese Anforderung automatisch und lückenlos.",
      "Mobile Nutzung: Über die Progressive Web App von Shiftfy können Mitarbeiter direkt vom Smartphone ein- und ausstempeln – ideal für dezentrale Teams und Außendienstmitarbeiter.",
      "Integration: Digitale Zeiterfassung lässt sich nahtlos mit der Schichtplanung, dem Abwesenheitsmanagement und der Lohnbuchhaltung verbinden. Ein durchgängiger Datenfluss eliminiert doppelte Erfassung und reduziert Fehlerquellen.",
    ],
  },
};

const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  categoryPlanning: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  categoryLaw: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  categoryHR: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  categoryTech: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return Object.keys(POSTS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) return { title: "Not found" };
  return {
    title: `${post.title}`,
    description: post.content[0]?.slice(0, 160),
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.content[0]?.slice(0, 160),
      type: "article",
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) notFound();

  const t = await getTranslations("blog");
  const tc = await getTranslations("common");
  const tf = await getTranslations("footer");
  const locale = await getLocale();
  const allSlugs = Object.keys(POSTS);

  const category = t(post.categoryKey as Parameters<typeof t>[0]);

  const relatedPosts = allSlugs
    .filter((s) => s !== slug)
    .slice(0, 3)
    .map((s) => ({
      slug: s,
      ...POSTS[s],
      category: t(POSTS[s].categoryKey as Parameters<typeof t>[0]),
    }));

  const style = CATEGORY_STYLES[post.categoryKey] ?? {
    bg: "bg-gray-50",
    text: "text-gray-700",
    dot: "bg-gray-400",
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
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
              href="/blog"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t("allArticles")}
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              {tc("pricing")}
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              {tc("login")}
            </Link>
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              {tc("startFree")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Article Hero */}
      <header className="relative overflow-hidden bg-white border-b border-gray-200/60">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-white to-transparent" />
        <div className="relative max-w-3xl mx-auto px-5 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-14 sm:pb-10">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors mb-6 sm:hidden"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("backToBlog")}
          </Link>

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {category}
            </span>
            <span className="text-sm text-gray-400">
              {new Date(post.date).toLocaleDateString(
                locale === "en" ? "en-GB" : "de-DE",
                {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                },
              )}
            </span>
            <span className="text-sm text-gray-400">
              · {post.readTime} {t("readTime")}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            {post.content[0]}
          </p>
        </div>
      </header>

      {/* Article Content */}
      <main className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8 py-10 sm:py-14">
        <article className="space-y-0">
          {post.content.slice(1).map((paragraph, i) => {
            const numberMatch = paragraph.match(/^(\d+)\.\s+(.+?):\s+(.*)/);

            if (numberMatch) {
              return (
                <div key={i} className="pt-8 first:pt-0">
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center justify-center mt-0.5">
                      {numberMatch[1]}
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-2">
                        {numberMatch[2]}
                      </h2>
                      <p className="text-gray-600 leading-relaxed">
                        {numberMatch[3]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            const headerMatch = paragraph.match(/^(.+?):\s+(.*)/);

            if (headerMatch) {
              return (
                <div key={i} className="pt-8 first:pt-0">
                  <h2 className="text-lg font-bold text-gray-900 mb-2">
                    {headerMatch[1]}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    {headerMatch[2]}
                  </p>
                </div>
              );
            }

            return (
              <p
                key={i}
                className="pt-6 first:pt-0 text-gray-600 leading-relaxed"
              >
                {paragraph}
              </p>
            );
          })}
        </article>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-14 pt-10 border-t border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {t("relatedArticles")}
            </h2>
            <div className="grid sm:grid-cols-3 gap-5">
              {relatedPosts.map((related) => {
                const rStyle = CATEGORY_STYLES[related.categoryKey] ?? {
                  bg: "bg-gray-50",
                  text: "text-gray-700",
                  dot: "bg-gray-400",
                };
                return (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group block"
                  >
                    <article className="h-full rounded-xl border border-gray-200/80 bg-white p-5 hover:shadow-lg hover:border-emerald-200/60 transition-all duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <related.Icon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${rStyle.bg} ${rStyle.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${rStyle.dot}`}
                          />
                          {related.category}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-snug text-sm">
                        {related.title}
                      </h3>
                      <p className="mt-2 text-xs text-gray-400">
                        {related.readTime} {t("readTime")}
                      </p>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer CTA */}
      <section className="border-t border-gray-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t("ctaTitle")}
          </h2>
          <p className="mt-3 text-gray-600 max-w-lg mx-auto">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="bg-brand-gradient text-white font-semibold px-6 py-3 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              {tc("startFree")}
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-3"
            >
              {tc("viewPricing")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900">Shiftfy</span>
          </div>
          <p className="text-sm text-gray-400 text-center">
            © {new Date().getFullYear()} Shiftfy. {tf("copyright")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 transition-colors"
            >
              {tf("privacy")}
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 transition-colors"
            >
              {tf("imprint")}
            </Link>
            <Link href="/agb" className="hover:text-gray-600 transition-colors">
              {tf("terms")}
            </Link>
            <Link
              href="/widerruf"
              className="hover:text-gray-600 transition-colors"
            >
              {tf("revocation")}
            </Link>
            <Link
              href="/barrierefreiheit"
              className="hover:text-gray-600 transition-colors"
            >
              {tf("accessibility")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
