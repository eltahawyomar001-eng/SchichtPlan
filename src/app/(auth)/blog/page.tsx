import { Metadata } from "next";
import Link from "next/link";
import { type SVGProps } from "react";
import { getTranslations } from "next-intl/server";
import {
  ShiftfyMark,
  ClipboardIcon,
  ScaleIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Blog – Tipps zu Zeiterfassung, Schichtplanung & Arbeitsrecht",
  description:
    "Tipps & Neuigkeiten rund um Zeiterfassung, Schichtplanung, Personalmanagement und Arbeitsrecht in Deutschland. Praxiswissen für Arbeitgeber.",
  keywords: [
    "Zeiterfassung Pflicht Deutschland",
    "Schichtplanung Tipps",
    "Arbeitsrecht Schichtarbeit",
    "Personalmanagement Blog",
    "Arbeitszeitgesetz",
    "Dienstplan Tipps",
  ],
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Shiftfy Blog – Wissen für Schichtplaner",
    description:
      "Praxiswissen zu Zeiterfassung, Schichtplanung und Arbeitsrecht.",
  },
};

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
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
    Icon: ClipboardIcon,
  },
  {
    slug: "arbeitszeitgesetz-2025",
    title: "Arbeitszeitgesetz 2025 – Was Arbeitgeber wissen müssen",
    excerpt:
      "Die wichtigsten Änderungen im Arbeitszeitgesetz und deren Auswirkungen auf Ihre Personalplanung im Überblick.",
    date: "2025-01-10",
    readTime: "7 min",
    category: "Recht",
    Icon: ScaleIcon,
  },
  {
    slug: "mitarbeiterbindung-schichtarbeit",
    title: "Mitarbeiterbindung in der Schichtarbeit",
    excerpt:
      "Strategien und Tools, um Mitarbeiter in schichtbasierten Betrieben langfristig zu binden und Fluktuation zu senken.",
    date: "2025-01-05",
    readTime: "6 min",
    category: "HR",
    Icon: UsersIcon,
  },
  {
    slug: "digitale-stempeluhr-vorteile",
    title: "Digitale Stempeluhr: Vorteile gegenüber Papier",
    excerpt:
      "Warum Unternehmen auf digitale Zeiterfassung umsteigen und wie Shiftfy die Umstellung erleichtert.",
    date: "2024-12-20",
    readTime: "4 min",
    category: "Technologie",
    Icon: ClockIcon,
  },
];

const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string; iconBg: string }
> = {
  Planung: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    iconBg: "from-emerald-500 to-emerald-600",
  },
  Recht: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    iconBg: "from-amber-500 to-amber-600",
  },
  HR: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-sky-500",
    iconBg: "from-sky-500 to-sky-600",
  },
  Technologie: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    iconBg: "from-violet-500 to-violet-600",
  },
};

export default async function BlogPage() {
  const t = await getTranslations("blog");

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="w-7 h-7" />
            <span className="font-bold text-base text-gray-900">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              {t("backToHome")}
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
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
              Blog
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight max-w-2xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl leading-relaxed">
            {t("subtitle")}
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 pb-16 sm:pb-24">
        {/* Featured Article */}
        <Link href={`/blog/${featured.slug}`} className="group block -mt-2">
          <article className="relative rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-200/60 transition-all duration-300">
            <div className="grid md:grid-cols-5">
              <div
                className={`md:col-span-2 bg-gradient-to-br ${CATEGORY_STYLES[featured.category]?.iconBg ?? "from-emerald-500 to-emerald-600"} flex items-center justify-center p-10 sm:p-14`}
              >
                <featured.Icon className="w-16 h-16 sm:w-20 sm:h-20 text-white drop-shadow-sm" />
              </div>
              <div className="md:col-span-3 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <CategoryBadge category={featured.category} />
                  <span className="text-sm text-gray-400">
                    {formatDate(featured.date)}
                  </span>
                  <span className="text-sm text-gray-400">
                    · {featured.readTime} {t("readTime")}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-snug">
                  {featured.title}
                </h2>
                <p className="mt-3 text-gray-600 leading-relaxed line-clamp-3">
                  {featured.excerpt}
                </p>
                <div className="mt-5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 group-hover:gap-2.5 transition-all">
                    {t("readMore")}
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </article>
        </Link>

        {/* Articles Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {rest.map((post) => {
            const catStyle = CATEGORY_STYLES[post.category];
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block"
              >
                <article className="h-full rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-200/60 transition-all duration-300 flex flex-col">
                  <div className="h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center group-hover:from-emerald-50 group-hover:to-emerald-100/50 transition-colors duration-300">
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${catStyle?.iconBg ?? "from-gray-500 to-gray-600"} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                    >
                      <post.Icon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <CategoryBadge category={post.category} />
                      <span className="text-xs text-gray-400">
                        {formatDate(post.date)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {post.readTime} {t("readTime")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 group-hover:gap-2 transition-all">
                        {t("readMore")}
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Footer CTA */}
      <section className="border-t border-gray-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Bereit für effiziente Schichtplanung?
          </h2>
          <p className="mt-3 text-gray-600 max-w-lg mx-auto">
            Starten Sie kostenlos mit bis zu 5 Mitarbeitern – keine Kreditkarte
            nötig.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="bg-brand-gradient text-white font-semibold px-6 py-3 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              Kostenlos starten
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-4 py-3"
            >
              Preise ansehen →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? {
    bg: "bg-gray-50",
    text: "text-gray-700",
    dot: "bg-gray-400",
    iconBg: "from-gray-500 to-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {category}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
