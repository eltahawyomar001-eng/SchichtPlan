import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface BlogPostContent {
  title: string;
  date: string;
  readTime: string;
  category: string;
  content: string[];
}

const POSTS: Record<string, BlogPostContent> = {
  "schichtplanung-best-practices": {
    title: "10 Best Practices für die Schichtplanung",
    date: "2025-01-15",
    readTime: "5 min",
    category: "Planung",
    content: [
      "Die effiziente Schichtplanung ist eine der größten Herausforderungen im Personalmanagement. Mit den richtigen Strategien und Tools können Sie nicht nur die Produktivität steigern, sondern auch die Zufriedenheit Ihrer Mitarbeiter erhöhen.",
      "1. Frühzeitige Planung: Veröffentlichen Sie Schichtpläne mindestens zwei Wochen im Voraus. Das gibt Ihren Mitarbeitern genügend Zeit, sich darauf einzustellen und eventuelle Konflikte rechtzeitig zu melden.",
      "2. Fairness bei der Verteilung: Achten Sie auf eine gleichmäßige Verteilung von beliebten und unbeliebten Schichten. Rotierende Systeme sorgen dafür, dass niemand dauerhaft benachteiligt wird.",
      "3. Ruhezeiten einhalten: Das Arbeitszeitgesetz schreibt mindestens 11 Stunden Ruhezeit zwischen zwei Schichten vor. Automatisierte Systeme wie SchichtPlan prüfen diese Vorgaben automatisch.",
      "4. Qualifikationen berücksichtigen: Stellen Sie sicher, dass in jeder Schicht ausreichend qualifiziertes Personal eingeteilt ist. Taggen Sie Mitarbeiter mit ihren Qualifikationen und Zertifizierungen.",
      "5. Verfügbarkeiten abfragen: Nutzen Sie digitale Tools, um Verfügbarkeiten und Wünsche Ihrer Mitarbeiter zu erfassen. Das reduziert kurzfristige Änderungen und erhöht die Planungssicherheit.",
      "6. Puffer einplanen: Kalkulieren Sie immer einen kleinen Puffer für Krankheitsausfälle oder unerwartete Ereignisse ein. Eine Reserveliste mit Springern hat sich in der Praxis bewährt.",
      "7. Kommunikation: Informieren Sie Ihr Team über Änderungen sofort und über den bevorzugten Kanal – ob Push-Benachrichtigung, E-Mail oder direkte Nachricht.",
      "8. Feedback einholen: Führen Sie regelmäßig Befragungen zur Zufriedenheit mit der Schichtplanung durch. So erkennen Sie Probleme frühzeitig.",
      "9. Digitale Tools nutzen: Ersetzen Sie Excel-Tabellen durch spezialisierte Software wie SchichtPlan. Das spart Zeit, vermeidet Fehler und bietet Transparenz für alle Beteiligten.",
      "10. Analyse und Optimierung: Nutzen Sie Berichte und Auswertungen, um Ihre Planung kontinuierlich zu verbessern. Überprüfen Sie regelmäßig Kennzahlen wie Überstunden, Krankheitstage und Mitarbeiterfluktuation.",
    ],
  },
  "arbeitszeitgesetz-2025": {
    title: "Arbeitszeitgesetz 2025 – Was Arbeitgeber wissen müssen",
    date: "2025-01-10",
    readTime: "7 min",
    category: "Recht",
    content: [
      "Das Arbeitszeitgesetz (ArbZG) regelt in Deutschland die zulässigen Arbeitszeiten, Pausen und Ruhezeiten. Für Arbeitgeber, die mit Schichtarbeit planen, ist die Einhaltung dieser Vorschriften besonders wichtig.",
      "Maximale Arbeitszeit: Die werktägliche Arbeitszeit darf 8 Stunden nicht überschreiten. Sie kann auf bis zu 10 Stunden verlängert werden, wenn innerhalb von 6 Kalendermonaten oder 24 Wochen im Durchschnitt 8 Stunden werktäglich nicht überschritten werden.",
      "Ruhepausen: Bei einer Arbeitszeit von mehr als 6 Stunden ist eine Pause von mindestens 30 Minuten vorgeschrieben. Bei mehr als 9 Stunden sind es 45 Minuten. Die Pausen können in Zeitabschnitte von mindestens 15 Minuten aufgeteilt werden.",
      "Ruhezeit: Nach Beendigung der täglichen Arbeitszeit müssen Arbeitnehmer eine ununterbrochene Ruhezeit von mindestens 11 Stunden haben. In bestimmten Branchen (z.B. Gastronomie, Pflege) kann diese auf 10 Stunden verkürzt werden.",
      "Nachtarbeit: Nachtarbeitnehmer haben Anspruch auf eine angemessene Zahl bezahlter freier Tage oder einen angemessenen Zuschlag. Regelmäßige arbeitsmedizinische Untersuchungen sind ebenfalls vorgeschrieben.",
      "Sonn- und Feiertagsruhe: An Sonn- und Feiertagen dürfen Arbeitnehmer grundsätzlich nicht beschäftigt werden. Ausnahmen gelten für bestimmte Branchen wie Gastronomie, Gesundheitswesen und Sicherheitsdienste.",
      "Dokumentationspflicht: Arbeitgeber sind verpflichtet, die über 8 Stunden hinausgehende Arbeitszeit aufzuzeichnen. Mit der EuGH-Rechtsprechung zur Arbeitszeiterfassung wird eine vollständige Dokumentation empfohlen.",
      "SchichtPlan unterstützt Sie bei der Einhaltung all dieser Vorschriften mit automatischen Prüfungen, Warnhinweisen und lückenloser Dokumentation.",
    ],
  },
  "mitarbeiterbindung-schichtarbeit": {
    title: "Mitarbeiterbindung in der Schichtarbeit",
    date: "2025-01-05",
    readTime: "6 min",
    category: "HR",
    content: [
      "Fluktuation in schichtbasierten Betrieben ist oft höher als in Unternehmen mit regulären Arbeitszeiten. Doch mit den richtigen Maßnahmen können Sie Ihre Mitarbeiter langfristig binden.",
      "Transparente Planung: Nichts frustriert Mitarbeiter mehr als unvorhersehbare Schichtpläne. Sorgen Sie für Transparenz und Planbarkeit. Mit SchichtPlan haben alle Mitarbeiter jederzeit Zugriff auf ihren aktuellen Schichtplan.",
      "Wunschschichten ermöglichen: Geben Sie Ihren Mitarbeitern die Möglichkeit, Wunschschichten anzugeben. Ein Algorithmus, der diese Wünsche berücksichtigt, steigert die Zufriedenheit erheblich.",
      "Work-Life-Balance: Achten Sie auf eine gesunde Balance zwischen Arbeits- und Freizeit. Vermeiden Sie zu häufige Wechsel zwischen Früh- und Spätschichten und planen Sie regelmäßige freie Wochenenden ein.",
      "Anerkennung und Wertschätzung: Besonders bei ungünstigen Schichtzeiten ist Wertschätzung wichtig. Ob Zuschläge, kleine Aufmerksamkeiten oder einfach ein Dankeschön – zeigen Sie Ihren Mitarbeitern, dass ihre Arbeit geschätzt wird.",
      "Weiterbildung: Bieten Sie auch Schichtarbeitern Zugang zu Weiterbildungsmaßnahmen. Flexible E-Learning-Formate lassen sich gut in den Schichtbetrieb integrieren.",
      "Gesundheitsmanagement: Schichtarbeit kann die Gesundheit belasten. Investieren Sie in betriebliches Gesundheitsmanagement – von ergonomischen Arbeitsplätzen bis hin zu Sportangeboten.",
      "Digitale Tools als Motivator: Moderne, benutzerfreundliche Tools wie SchichtPlan signalisieren Ihren Mitarbeitern, dass Sie in zeitgemäße Lösungen investieren und deren Arbeitsalltag erleichtern möchten.",
    ],
  },
  "digitale-stempeluhr-vorteile": {
    title: "Digitale Stempeluhr: Vorteile gegenüber Papier",
    date: "2024-12-20",
    readTime: "4 min",
    category: "Technologie",
    content: [
      "Die Zeiten der Stechuhr und handschriftlichen Stundenzettel sind vorbei. Digitale Zeiterfassungssysteme bieten zahlreiche Vorteile für Unternehmen jeder Größe.",
      "Genauigkeit: Digitale Systeme erfassen Arbeitszeiten auf die Minute genau. Rundungsfehler, unleserliche Handschriften und nachträgliche Änderungen gehören der Vergangenheit an.",
      "Echtzeit-Überblick: Manager sehen in Echtzeit, wer gerade arbeitet, wer Pause macht und wer abwesend ist. Das erleichtert die Koordination im laufenden Betrieb erheblich.",
      "Automatische Berechnung: Überstunden, Zuschläge und Urlaubstage werden automatisch berechnet. Das spart der Personalabteilung wertvolle Zeit bei der Lohnabrechnung.",
      "GPS-Verifizierung: Mit SchichtPlan können Sie optional GPS-Daten bei Ein- und Ausstempeln erfassen. So stellen Sie sicher, dass Mitarbeiter tatsächlich am Einsatzort sind.",
      "Gesetzeskonformität: Die EuGH-Rechtsprechung fordert eine systematische Erfassung der Arbeitszeit. Digitale Systeme erfüllen diese Anforderung automatisch und lückenlos.",
      "Mobile Nutzung: Über die Progressive Web App von SchichtPlan können Mitarbeiter direkt vom Smartphone ein- und ausstempeln – ideal für dezentrale Teams und Außendienstmitarbeiter.",
      "Integration: Digitale Zeiterfassung lässt sich nahtlos mit der Schichtplanung, dem Abwesenheitsmanagement und der Lohnbuchhaltung verbinden. Ein durchgängiger Datenfluss eliminiert doppelte Erfassung und reduziert Fehlerquellen.",
    ],
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
  if (!post) return { title: "Nicht gefunden" };
  return {
    title: `${post.title} – SchichtPlan Blog`,
    description: post.content[0]?.slice(0, 160),
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) notFound();

  const CATEGORY_COLORS: Record<string, string> = {
    Planung: "bg-blue-100 text-blue-700",
    Recht: "bg-amber-100 text-amber-700",
    HR: "bg-green-100 text-green-700",
    Technologie: "bg-violet-100 text-violet-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
          <Link
            href="/blog"
            className="text-sm text-violet-600 hover:underline mb-4 inline-block"
          >
            ← Alle Artikel
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-700"}`}
            >
              {post.category}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(post.date).toLocaleDateString("de-DE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="text-xs text-gray-400">
              · {post.readTime} Lesezeit
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {post.title}
          </h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <article className="space-y-4">
          {post.content.map((p, i) => (
            <p key={i} className="text-gray-700 leading-relaxed text-base">
              {p}
            </p>
          ))}
        </article>
        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link
            href="/blog"
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            ← Zurück zum Blog
          </Link>
        </div>
      </main>
    </div>
  );
}
