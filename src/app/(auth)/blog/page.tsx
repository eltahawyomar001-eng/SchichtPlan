import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog – SchichtPlan",
  description:
    "Tipps & Neuigkeiten rund um Schichtplanung, Personalmanagement und Arbeitsrecht.",
};

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

const posts: BlogPost[] = [
  {
    slug: "schichtplanung-best-practices",
    title: "10 Best Practices für die Schichtplanung",
    excerpt:
      "Erfahren Sie, wie Sie Ihren Schichtplan effizient gestalten, Mitarbeiterzufriedenheit steigern und gesetzliche Vorgaben einhalten.",
    date: "2025-01-15",
    readTime: "5 min",
    category: "Planung",
  },
  {
    slug: "arbeitszeitgesetz-2025",
    title: "Arbeitszeitgesetz 2025 – Was Arbeitgeber wissen müssen",
    excerpt:
      "Die wichtigsten Änderungen im Arbeitszeitgesetz und deren Auswirkungen auf Ihre Personalplanung im Überblick.",
    date: "2025-01-10",
    readTime: "7 min",
    category: "Recht",
  },
  {
    slug: "mitarbeiterbindung-schichtarbeit",
    title: "Mitarbeiterbindung in der Schichtarbeit",
    excerpt:
      "Strategien und Tools, um Mitarbeiter in schichtbasierten Betrieben langfristig zu binden und Fluktuation zu senken.",
    date: "2025-01-05",
    readTime: "6 min",
    category: "HR",
  },
  {
    slug: "digitale-stempeluhr-vorteile",
    title: "Digitale Stempeluhr: Vorteile gegenüber Papier",
    excerpt:
      "Warum Unternehmen auf digitale Zeiterfassung umsteigen und wie SchichtPlan die Umstellung erleichtert.",
    date: "2024-12-20",
    readTime: "4 min",
    category: "Technologie",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Planung: "bg-blue-100 text-blue-700",
  Recht: "bg-amber-100 text-amber-700",
  HR: "bg-green-100 text-green-700",
  Technologie: "bg-violet-100 text-violet-700",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
          <Link
            href="/"
            className="text-sm text-violet-600 hover:underline mb-4 inline-block"
          >
            ← Zurück zur Startseite
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Blog</h1>
          <p className="mt-2 text-lg text-gray-600">
            Tipps &amp; Neuigkeiten rund um Schichtplanung, Personalmanagement
            und Arbeitsrecht.
          </p>
        </div>
      </header>

      {/* Posts */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
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
              <Link href={`/blog/${post.slug}`}>
                <h2 className="text-xl font-semibold text-gray-900 hover:text-violet-600 transition-colors">
                  {post.title}
                </h2>
              </Link>
              <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                {post.excerpt}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-block mt-3 text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                Weiterlesen →
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
