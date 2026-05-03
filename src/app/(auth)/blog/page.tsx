import { Metadata } from "next";
import Link from "next/link";
import { type SVGProps } from "react";
import { getTranslations, getLocale } from "next-intl/server";
import {
  ShiftfyMark,
  ClipboardIcon,
  ScaleIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";
import BlogContent from "./BlogContent";

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
  titleKey: string;
  excerptKey: string;
  date: string;
  readTime: string;
  categoryKey: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
}

const postDefs: BlogPost[] = [
  {
    slug: "schichtplanung-best-practices",
    titleKey: "post1Title",
    excerptKey: "post1Excerpt",
    date: "2026-01-15",
    readTime: "5 min",
    categoryKey: "categoryPlanning",
    Icon: ClipboardIcon,
  },
  {
    slug: "arbeitszeitgesetz-2025",
    titleKey: "post2Title",
    excerptKey: "post2Excerpt",
    date: "2026-01-10",
    readTime: "7 min",
    categoryKey: "categoryLaw",
    Icon: ScaleIcon,
  },
  {
    slug: "mitarbeiterbindung-schichtarbeit",
    titleKey: "post3Title",
    excerptKey: "post3Excerpt",
    date: "2026-01-05",
    readTime: "6 min",
    categoryKey: "categoryHR",
    Icon: UsersIcon,
  },
  {
    slug: "digitale-stempeluhr-vorteile",
    titleKey: "post4Title",
    excerptKey: "post4Excerpt",
    date: "2026-06-20",
    readTime: "4 min",
    categoryKey: "categoryTech",
    Icon: ClockIcon,
  },
];

export default async function BlogPage() {
  const t = await getTranslations("blog");
  const tc = await getTranslations("common");
  const tf = await getTranslations("footer");
  const locale = await getLocale();

  const posts = postDefs.map((p) => ({
    ...p,
    title: t(p.titleKey as Parameters<typeof t>[0]),
    excerpt: t(p.excerptKey as Parameters<typeof t>[0]),
    category: t(p.categoryKey as Parameters<typeof t>[0]),
    formattedDate: formatDate(p.date, locale),
  }));

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
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
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              {t("backToHome")}
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              {tc("pricing")}
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              {tc("login")}
            </Link>
            <ThemeToggle />
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              {tc("startFree")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-gray-950 dark:to-emerald-950/20" />
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
        <BlogContent
          posts={posts}
          strings={{
            readMore: t("readMore"),
            readTime: t("readTime"),
            filterAll: t("filterAll"),
            filterLabel: t("filterLabel"),
            inlineCtaTitle: t("inlineCtaTitle"),
            inlineCtaButton: t("inlineCtaButton"),
            startFree: tc("startFree"),
          }}
        />
      </main>

      {/* Footer CTA */}
      <section className="border-t border-gray-200/60 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
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

      <footer className="border-t border-gray-100 dark:border-gray-800 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              Shiftfy
            </span>
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
            <Link href="/sla" className="hover:text-gray-600 transition-colors">
              SLA
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(
    locale === "en" ? "en-GB" : "de-DE",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}
