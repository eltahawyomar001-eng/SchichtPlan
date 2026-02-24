import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

export const metadata: Metadata = {
  title: "Preise – Schichtplanung Software ab 0 €",
  description:
    "Shiftfy Preise: Kostenloser Starter-Plan für bis zu 5 Mitarbeiter. Team ab 4,90 €/Mitarbeiter/Monat. Zeiterfassung, Schichtplanung, Lohnexport inklusive.",
  keywords: [
    "Schichtplanung Preise",
    "Zeiterfassung Kosten",
    "Dienstplan Software Preise",
    "kostenlose Schichtplanung",
    "Personalplanung Kosten",
  ],
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Shiftfy Preise – Schichtplanung ab 0 €/Monat",
    description:
      "Kostenlos starten mit bis zu 5 Mitarbeitern. Team- und Business-Pläne für wachsende Unternehmen.",
  },
};

export default async function PricingPage() {
  const t = await getTranslations("pricing");
  const tc = await getTranslations("common");
  const tf = await getTranslations("footer");

  const plans = [
    {
      name: t("free"),
      price: t("freePrice"),
      priceNote: t("freePriceNote"),
      description: t("freeDesc"),
      features: [
        t("featureFree1"),
        t("featureFree2"),
        t("featureFree3"),
        t("featureFree4"),
        t("featureFree5"),
        t("featureFree6"),
      ],
      cta: t("getStarted"),
      href: "/register?plan=starter",
      highlighted: false,
    },
    {
      name: t("pro"),
      price: t("proPrice"),
      priceNote: t("proPriceNote"),
      description: t("proDesc"),
      features: [
        t("featurePro1"),
        t("featurePro2"),
        t("featurePro3"),
        t("featurePro4"),
        t("featurePro5"),
        t("featurePro6"),
      ],
      cta: t("startTrial"),
      href: "/register?plan=team",
      highlighted: true,
    },
    {
      name: t("enterprise"),
      price: t("enterprisePrice"),
      priceNote: t("enterprisePriceNote"),
      description: t("enterpriseDesc"),
      features: [
        t("featureEnt1"),
        t("featureEnt2"),
        t("featureEnt3"),
        t("featureEnt4"),
        t("featureEnt5"),
        t("featureEnt6"),
        t("featureEnt7"),
      ],
      cta: t("startTrial"),
      href: "/register?plan=business",
      highlighted: false,
    },
    {
      name: t("custom"),
      price: t("customPrice"),
      priceNote: t("customPriceNote"),
      description: t("customDesc"),
      features: [
        t("featureCustom1"),
        t("featureCustom2"),
        t("featureCustom3"),
        t("featureCustom4"),
        t("featureCustom5"),
        t("featureCustom6"),
      ],
      cta: t("contactUs"),
      href: "mailto:info@shiftfy.de",
      highlighted: false,
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
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ─── Navbar ─── */}
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
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:inline-flex"
            >
              {tc("home")}
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
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30" />
        <div className="absolute top-32 -left-40 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-0 w-[300px] h-[300px] bg-emerald-100/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-14 pb-10 sm:pt-20 sm:pb-14">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
              <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                {tc("pricing")}
              </span>
              <div className="h-1 w-8 rounded-full bg-brand-gradient" />
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {t("title")}
            </h1>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
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
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-600"
                >
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ─── Plan Cards ─── */}
        <section className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pb-16 sm:pb-20 -mt-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col transition-all duration-200 ${
                  plan.highlighted
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-white shadow-xl shadow-emerald-100/60 lg:-mt-3 lg:pb-10"
                    : "border-gray-200 bg-white shadow-sm hover:shadow-lg hover:border-gray-300"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-md">
                    {t("popular")}
                  </span>
                )}

                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                <p className="mt-1 text-sm text-gray-500 min-h-[40px]">
                  {plan.description}
                </p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-gray-900">
                    {plan.price}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{plan.priceNote}</p>

                <div className="mt-6 h-px bg-gray-100" />

                <ul className="mt-5 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-brand-gradient text-white hover:shadow-lg hover:shadow-emerald-200/50"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ─── "Included in every plan" Section ─── */}
        <section className="border-t border-gray-100 bg-white py-14 sm:py-20">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {t("allPlansInclude")}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {allPlansFeatures.map((feature) => (
                <div
                  key={feature.label}
                  className="flex flex-col items-center text-center p-4 rounded-2xl bg-white border border-gray-100 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                    <feature.Icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Pricing FAQ ─── */}
        <section className="py-14 sm:py-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {t("pricingFaqTitle")}
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border border-gray-200 bg-white overflow-hidden"
                >
                  <summary className="flex items-center justify-between cursor-pointer px-5 sm:px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors text-sm sm:text-base">
                    {faq.q}
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90 shrink-0 ml-4" />
                  </summary>
                  <div className="px-5 sm:px-6 pb-5 text-sm text-gray-500 leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA Section ─── */}
        <section className="pb-16 sm:pb-24">
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
