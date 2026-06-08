import type { ComponentType } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ShiftfyMark,
  CheckCircleIcon,
  ArrowRightIcon,
} from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

type IconType = ComponentType<{ className?: string }>;

export interface SeoLandingPageProps {
  /** Small uppercase badge above the H1, e.g. "Für die Gastronomie". */
  segmentLabel: string;
  /** H1 is rendered as `${titleLead} <gradient>${titleHighlight}</gradient>`. */
  titleLead: string;
  titleHighlight: string;
  subtitle: string;
  /** Breadcrumb leaf (name + absolute path, e.g. "/schichtplanung-gastronomie"). */
  breadcrumb: { name: string; path: string };
  /** Contextual nav link shown left of "Preise". */
  navLink: { href: string; label: string };
  featuresHeading: string;
  featuresIntro: string;
  features: { title: string; description: string; icon: IconType }[];
  benefitsHeading: string;
  benefits: string[];
  explainerHeading: string;
  /** Paragraphs; optional bold `lead` is prefixed in <strong>. */
  explainer: { lead?: string; text: string }[];
  faqs: { q: string; a: string }[];
  ctaHeading: string;
  /** Optional override; defaults to the shared translated trial line. */
  ctaSubtitle?: string;
  related: { href: string; label: string }[];
}

/**
 * Shared, server-rendered SEO/marketing landing page. Keeps every keyword and
 * industry page visually consistent with /schichtplanung-software while staying
 * DRY — each page file just supplies data. Emits Breadcrumb + FAQPage
 * structured data for rich results.
 */
export default async function SeoLandingPage({
  segmentLabel,
  titleLead,
  titleHighlight,
  subtitle,
  breadcrumb,
  navLink,
  featuresHeading,
  featuresIntro,
  features,
  benefitsHeading,
  benefits,
  explainerHeading,
  explainer,
  faqs,
  ctaHeading,
  ctaSubtitle,
  related,
}: SeoLandingPageProps) {
  const t = await getTranslations("seoCommon");
  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950">
      <BreadcrumbJsonLd
        items={[
          { name: t("home"), url: "/" },
          { name: breadcrumb.name, url: breadcrumb.path },
        ]}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      )}

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
              href={navLink.href}
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              {navLink.label}
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              {t("pricing")}
            </Link>
            <ThemeToggle />
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              {t("tryFree")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-gray-950 dark:to-emerald-950/20" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
              <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                {segmentLabel}
              </span>
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
              {titleLead}{" "}
              <span className="text-gradient">{titleHighlight}</span>
            </h1>
            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              {subtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand-gradient text-white font-bold px-8 py-3.5 rounded-full hover:shadow-xl hover:shadow-emerald-200/50 transition-all flex items-center gap-2"
              >
                {t("tryFree")}
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-8 py-3.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                {t("pricingView")}
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">{t("trialLine")}</p>
          </div>
        </div>
      </header>

      <main>
        {/* Features */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                {featuresHeading}
              </h2>
              <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
                {featuresIntro}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <f.icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {f.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 sm:py-20 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                {benefitsHeading}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((b) => (
                <div key={b} className="flex items-start gap-3 py-3">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Explainer (rich keyword content) */}
        <section className="py-16 sm:py-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-8">
              {explainerHeading}
            </h2>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              {explainer.map((p, i) => (
                <p
                  key={i}
                  className={`text-gray-600 dark:text-gray-300 leading-relaxed${i > 0 ? " mt-4" : ""}`}
                >
                  {p.lead ? <strong>{p.lead} </strong> : null}
                  {p.text}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section className="py-16 sm:py-20 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
            <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-8">
                {t("faqHeading")}
              </h2>
              <div className="space-y-6">
                {faqs.map((f) => (
                  <div key={f.q}>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {f.q}
                    </h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-300 leading-relaxed">
                      {f.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 p-8 sm:p-12 md:p-16 text-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full pointer-events-none" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  {ctaHeading}
                </h2>
                <p className="mt-4 text-emerald-200 text-lg max-w-xl mx-auto">
                  {ctaSubtitle ?? t("ctaSubtitleDefault")}
                </p>
                <div className="mt-8">
                  <Link
                    href="/register"
                    className="bg-white text-emerald-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all inline-flex items-center gap-2"
                  >
                    {t("tryFree")}
                    <ArrowRightIcon className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Internal Links */}
        <section className="pb-16">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              {t("discoverMore")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all group"
                >
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-emerald-600">
                    {r.label} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              Shiftfy
            </span>
          </div>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Shiftfy. Alle Rechte vorbehalten.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 transition-colors"
            >
              {t("datenschutz")}
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 transition-colors"
            >
              {t("impressum")}
            </Link>
            <Link href="/agb" className="hover:text-gray-600 transition-colors">
              {t("agb")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
