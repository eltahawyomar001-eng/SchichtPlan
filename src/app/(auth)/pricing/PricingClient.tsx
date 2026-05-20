"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ShiftfyMark,
  CheckCircleIcon,
  ChevronRightIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  CalendarUsersIcon,
  SmartphoneIcon,
  DatabaseIcon,
} from "@/components/icons";

export default function PricingClient() {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const tf = useTranslations("footer");

  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: t("basic"),
      basePrice: annual ? t("basicAnnualBase") : t("basicMonthlyBase"),
      perUser: annual ? t("basicPerUserAnnual") : t("basicPerUserMonthly"),
      description: t("basicDesc"),
      features: [
        t("featureBasic1"),
        t("featureBasic2"),
        t("featureBasic3"),
        t("featureBasic4"),
        t("featureBasic5"),
        t("featureBasic6"),
      ],
      cta: t("startTrial"),
      href: `/register?plan=basic&billing=${annual ? "annual" : "monthly"}`,
      highlighted: false,
      isEnterprise: false,
    },
    {
      name: t("professional"),
      basePrice: annual
        ? t("professionalAnnualBase")
        : t("professionalMonthlyBase"),
      perUser: annual
        ? t("professionalPerUserAnnual")
        : t("professionalPerUserMonthly"),
      description: t("professionalDesc"),
      features: [
        t("featurePro1"),
        t("featurePro2"),
        t("featurePro3"),
        t("featurePro4"),
        t("featurePro5"),
        t("featurePro6"),
        t("featurePro7"),
        t("featurePro8"),
        t("featurePro9"),
        t("featurePro10"),
      ],
      cta: t("startTrial"),
      href: `/register?plan=professional&billing=${annual ? "annual" : "monthly"}`,
      highlighted: true,
      isEnterprise: false,
    },
    {
      name: t("enterprise"),
      basePrice: t("enterpriseCustom"),
      perUser: null,
      description: t("enterpriseDesc"),
      features: [
        t("featureEnt1"),
        t("featureEnt2"),
        t("featureEnt3"),
        t("featureEnt4"),
        t("featureEnt5"),
        t("featureEnt6"),
        t("featureEnt7"),
        t("featureEnt8"),
      ],
      cta: t("contactSales"),
      href: "mailto:info@bashabsheh-vergabepartner.de?subject=Enterprise%20Plan%20Anfrage",
      highlighted: false,
      isEnterprise: true,
    },
  ];

  const allPlansFeatures = [
    { Icon: CalendarIcon, label: t("allPlansFeature1") },
    { Icon: ClockIcon, label: t("allPlansFeature2") },
    { Icon: UsersIcon, label: t("allPlansFeature3") },
    { Icon: CalendarUsersIcon, label: t("allPlansFeature4") },
    { Icon: SmartphoneIcon, label: t("allPlansFeature5") },
    { Icon: DatabaseIcon, label: t("allPlansFeature6") },
  ];

  const faqs = [
    { q: t("pricingFaq1Q"), a: t("pricingFaq1A") },
    { q: t("pricingFaq2Q"), a: t("pricingFaq2A") },
    { q: t("pricingFaq3Q"), a: t("pricingFaq3A") },
    { q: t("pricingFaq4Q"), a: t("pricingFaq4A") },
    { q: t("pricingFaq5Q"), a: t("pricingFaq5A") },
    { q: t("pricingFaq6Q"), a: t("pricingFaq6A") },
  ];

  const compareRows: {
    feature: string;
    basic: boolean;
    pro: boolean;
    enterprise: boolean;
  }[] = [
    { feature: t("compareFeature1"), basic: true, pro: true, enterprise: true },
    { feature: t("compareFeature2"), basic: true, pro: true, enterprise: true },
    { feature: t("compareFeature3"), basic: true, pro: true, enterprise: true },
    { feature: t("compareFeature4"), basic: true, pro: true, enterprise: true },
    { feature: t("compareFeature5"), basic: true, pro: true, enterprise: true },
    {
      feature: t("compareFeature6"),
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: t("compareFeature7"),
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: t("compareFeature8"),
      basic: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: t("compareFeature9"),
      basic: false,
      pro: false,
      enterprise: true,
    },
    {
      feature: t("compareFeature10"),
      basic: false,
      pro: false,
      enterprise: true,
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="w-7 h-7" />
            <span className="font-bold text-base text-gray-900 dark:text-white">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/#features"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden md:inline-flex"
            >
              {tc("features")}
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hidden md:inline-flex"
            >
              {tc("pricing")}
            </Link>
            <Link
              href="/blog"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden md:inline-flex"
            >
              Blog
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline-flex"
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

      {/* ─── Hero Section ─── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 dark:from-emerald-950/40 dark:via-gray-950 dark:to-emerald-950/20" />
        <div className="absolute top-32 -left-40 w-[400px] h-[400px] bg-emerald-100/30 dark:bg-emerald-900/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-0 w-[300px] h-[300px] bg-emerald-100/20 dark:bg-emerald-900/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-14">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {tc("pricing")}
              </span>
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
              {t("title")}
            </h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
              {t("subtitle")}
            </p>

            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {[
                t("trustBadge1"),
                t("trustBadge2"),
                t("trustBadge3"),
                t("trustBadge4"),
              ].map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {badge}
                </div>
              ))}
            </div>

            {/* ─── Billing Toggle ─── */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-gray-100 dark:bg-gray-800 p-1">
              <button
                onClick={() => setAnnual(false)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  !annual
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t("billingMonthly")}
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  annual
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t("billingAnnual")}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ─── ROI Calculator Callout ─── */}
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 pt-10 sm:pt-12">
          <Link
            href="/ersparnisrechner"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <span>{t("roiCalcBanner")}</span>
          </Link>
        </div>

        {/* ─── Plan Cards ─── */}
        <section className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-8 sm:pb-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col transition-all duration-200 ${
                  plan.highlighted
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-gray-800 shadow-xl shadow-emerald-100/60 dark:shadow-emerald-900/30 lg:-mt-3 lg:pb-10"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-md">
                    {t("popular")}
                  </span>
                )}

                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 min-h-[40px]">
                  {plan.description}
                </p>

                <div className="mt-5">
                  {plan.isEnterprise ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                          {plan.basePrice}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t("enterprisePriceNote")}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                          {plan.basePrice}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t("perUserMonth")} ·{" "}
                        {annual ? t("billedAnnually") : t("billedMonthly")}
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-6 h-px bg-gray-100 dark:bg-gray-700" />

                <ul className="mt-5 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-brand-gradient text-white hover:shadow-lg hover:shadow-emerald-200/50"
                      : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ─── No Setup Fees Callout ─── */}
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 pb-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            ✓ {t("noSetupFees")}
          </p>
        </div>

        {/* ─── Plan Comparison Table ─── */}
        <section className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8 pb-16 sm:pb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              {t("compareTitle")}
            </h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="py-4 px-5 text-left font-semibold text-gray-500 dark:text-gray-400 w-1/2" />
                  <th className="py-4 px-4 text-center font-bold text-gray-900 dark:text-white">
                    {t("compareBasic")}
                  </th>
                  <th className="py-4 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                    {t("comparePro")}
                  </th>
                  <th className="py-4 px-4 text-center font-bold text-gray-900 dark:text-white">
                    {t("compareEnterprise")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={
                      i % 2 === 0
                        ? "bg-gray-50/50 dark:bg-gray-800/50"
                        : "bg-white dark:bg-gray-900"
                    }
                  >
                    <td className="py-3 px-5 font-medium text-gray-700 dark:text-gray-200">
                      {row.feature}
                    </td>
                    <td className="py-3 px-4 text-center text-base">
                      {row.basic ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-base">
                      {row.pro ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-base">
                      {row.enterprise ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── "Included in every plan" Section ─── */}
        <section className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-14 sm:py-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                {t("allPlansInclude")}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {allPlansFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="flex flex-col items-center text-center p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                    <feature.Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing FAQ ─── */}
        <section className="py-14 sm:py-20 bg-gray-50/50 dark:bg-gray-950">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                {t("pricingFaqTitle")}
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                >
                  <summary className="flex items-center justify-between cursor-pointer px-5 sm:px-6 py-4 text-left font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm sm:text-base">
                    {faq.q}
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform group-open:rotate-90 shrink-0 ml-4" />
                  </summary>
                  <div className="px-5 sm:px-6 pb-5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA Section ─── */}
        <section className="pb-16 sm:pb-24 bg-gray-50/50 dark:bg-gray-950">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 p-8 sm:p-12 md:p-16 text-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />

              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  {t("pricingCtaTitle")}
                </h2>
                <p className="mt-4 text-emerald-200 text-lg max-w-xl mx-auto">
                  {t("pricingCtaSubtitle")}
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/register"
                    className="bg-white text-emerald-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {t("getStarted")}
                    <ArrowRightIcon className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-white">
              Shiftfy
            </span>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
            © {new Date().getFullYear()} Shiftfy. {tf("copyright")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-gray-500">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {tf("privacy")}
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {tf("imprint")}
            </Link>
            <Link
              href="/agb"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {tf("terms")}
            </Link>
            <Link
              href="/widerruf"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {tf("revocation")}
            </Link>
            <Link
              href="/barrierefreiheit"
              className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {tf("accessibility")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
