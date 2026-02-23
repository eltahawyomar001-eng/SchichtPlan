"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ShiftfyMark,
  CalendarIcon,
  SendIcon,
  UsersIcon,
  BarChartIcon,
  CheckCircleIcon,
  ZapIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  StarIcon,
  MenuIcon,
  XIcon,
} from "@/components/icons";
import {
  PlanningIllustration,
  DistributionIllustration,
  DayToDayIllustration,
  ReportingIllustration,
} from "@/components/svgs";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

/**
 * Full Connecteam-style landing page for Shiftfy.
 *
 * Structure:
 * 1. Navbar
 * 2. Hero section
 * 3. Trusted-by bar
 * 4. Four-step feature sections (Planning → Distribution → Day-to-Day → Reporting)
 * 5. Benefits grid
 * 6. FAQ accordion
 * 7. CTA footer
 *
 * All icons/graphics are inline SVG TypeScript components — animation-ready.
 */
export function LandingPage() {
  const t = useTranslations("landing");

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─── */}
      <Navbar />

      {/* ─── Hero ─── */}
      <HeroSection />

      {/* ─── Trusted By ─── */}
      <TrustedByBar />

      {/* ─── 4-Step Feature Flow ─── */}
      <FeatureSection
        step={1}
        label={t("step1Label")}
        title={t("step1Title")}
        description={t("step1Desc")}
        features={[
          t("step1Feature1"),
          t("step1Feature2"),
          t("step1Feature3"),
          t("step1Feature4"),
        ]}
        illustration={<PlanningIllustration />}
        reversed={false}
        t={t}
      />

      <FeatureSection
        step={2}
        label={t("step2Label")}
        title={t("step2Title")}
        description={t("step2Desc")}
        features={[
          t("step2Feature1"),
          t("step2Feature2"),
          t("step2Feature3"),
          t("step2Feature4"),
        ]}
        illustration={<DistributionIllustration />}
        reversed={true}
        t={t}
      />

      <FeatureSection
        step={3}
        label={t("step3Label")}
        title={t("step3Title")}
        description={t("step3Desc")}
        features={[
          t("step3Feature1"),
          t("step3Feature2"),
          t("step3Feature3"),
          t("step3Feature4"),
        ]}
        illustration={<DayToDayIllustration />}
        reversed={false}
        t={t}
      />

      <FeatureSection
        step={4}
        label={t("step4Label")}
        title={t("step4Title")}
        description={t("step4Desc")}
        features={[
          t("step4Feature1"),
          t("step4Feature2"),
          t("step4Feature3"),
          t("step4Feature4"),
        ]}
        illustration={<ReportingIllustration />}
        reversed={true}
        t={t}
      />

      {/* ─── Benefits Grid ─── */}
      <BenefitsSection />

      {/* ─── Pricing ─── */}
      <PricingSection />

      {/* ─── FAQ ─── */}
      <FAQSection />

      {/* ─── CTA Footer ─── */}
      <CTAFooter />

      {/* ─── Footer ─── */}
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Section Components
   ═══════════════════════════════════════════ */

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("landing");

  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/20">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <ShiftfyMark className="w-8 h-8" />
          <span className="font-bold text-lg text-gray-900">
            Shift<span className="text-gradient">fy</span>
          </span>
        </Link>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("navFeatures")}
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("navPricing")}
          </a>
          <a
            href="#benefits"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("navBenefits")}
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("navFaq")}
          </a>
        </div>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("navLogin")}
          </Link>
          <Link
            href="/register"
            className="bg-brand-gradient text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-full hover:shadow-lg hover:shadow-violet-200 transition-all"
          >
            {t("navCta")}
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {mobileOpen ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <div className="px-4 py-3 space-y-1">
            <a
              href="#features"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {t("navFeatures")}
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {t("navPricing")}
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {t("navBenefits")}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {t("navFaq")}
            </a>
            <Link
              href="/login"
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors sm:hidden"
            >
              {t("navLogin")}
            </Link>
            <div className="px-3 py-2">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  const t = useTranslations("landing");

  return (
    <section className="relative pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-36 pb-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-violet-50/60 via-white to-white">
      {/* Subtle decorative elements */}
      <div className="absolute top-20 -left-40 w-[500px] h-[500px] bg-violet-100/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 right-0 w-[400px] h-[400px] bg-purple-100/30 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* ─── Left: Text content ─── */}
          <div className="flex-1 max-w-xl text-center lg:text-left">
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.08]">
              {t("heroTitle")}{" "}
              <span className="text-gradient">{t("heroTitleHighlight")}</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 sm:mt-6 text-base sm:text-lg text-gray-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t("heroSubtitle")}
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <CheckCircleIcon className="w-4 h-4 text-violet-600" />
                {t("heroProof1")}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <CheckCircleIcon className="w-4 h-4 text-violet-600" />
                {t("heroProof2")}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <CheckCircleIcon className="w-4 h-4 text-violet-600" />
                {t("heroProof3")}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                href="/register"
                className="bg-brand-gradient text-white font-semibold px-8 py-4 rounded-full text-base hover:shadow-xl hover:shadow-violet-200 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {t("heroCtaPrimary")}
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <a
                href="#pricing"
                className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors flex items-center gap-1"
              >
                {t("heroCtaSecondary")}
                <ChevronRightIcon className="w-4 h-4" />
              </a>
            </div>

            <p className="mt-3 text-sm text-gray-400 text-center lg:text-left">
              {t("heroCtaSubNote")}
            </p>
          </div>

          {/* ─── Right: App mockup ─── */}
          <div className="flex-1 w-full max-w-[560px] lg:max-w-none">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Inline SVG mockup showing a simplified Shiftfy dashboard */
function HeroMockup() {
  const t = useTranslations("landing");
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const shifts = [
    { name: "Anna M.", shifts: [1, 1, 0, 1, 1, 0, 0], color: "#7C3AED" },
    { name: "Lukas B.", shifts: [0, 1, 1, 1, 0, 1, 0], color: "#6D28D9" },
    { name: "Sara K.", shifts: [1, 0, 1, 0, 1, 1, 0], color: "#8B5CF6" },
    { name: "Tom W.", shifts: [0, 0, 1, 1, 1, 0, 1], color: "#A78BFA" },
  ];

  return (
    <div className="relative">
      {/* Glow behind */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-200/50 to-purple-200/30 rounded-3xl blur-2xl scale-105" />

      {/* Main card */}
      <div className="relative rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-violet-100/50 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-medium text-gray-400">
              {t("heroMockupTitle")}
            </span>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 sm:p-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-violet-50 p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-violet-700">
                24
              </div>
              <div className="text-[10px] sm:text-xs text-violet-500 font-medium mt-0.5">
                {t("heroMockupShifts")}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                12
              </div>
              <div className="text-[10px] sm:text-xs text-emerald-500 font-medium mt-0.5">
                {t("heroMockupEmployees")}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-amber-600">
                98%
              </div>
              <div className="text-[10px] sm:text-xs text-amber-500 font-medium mt-0.5">
                {t("heroMockupCoverage")}
              </div>
            </div>
          </div>

          {/* Mini schedule grid */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-8 bg-gray-50 text-[10px] sm:text-xs font-semibold text-gray-500">
              <div className="px-2 sm:px-3 py-2">{t("heroMockupTeam")}</div>
              {days.map((d) => (
                <div key={d} className="px-1 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            {/* Rows */}
            {shifts.map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-8 border-t border-gray-50 items-center"
              >
                <div className="px-2 sm:px-3 py-2.5 text-xs font-medium text-gray-700 truncate">
                  {row.name}
                </div>
                {row.shifts.map((s, i) => (
                  <div key={i} className="px-1 py-2 flex justify-center">
                    {s ? (
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${row.color}18` }}
                      >
                        <div
                          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 sm:w-7 sm:h-7" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating notification card */}
      <div className="absolute -bottom-4 left-0 sm:-left-6 rounded-xl bg-white border border-gray-200 shadow-lg shadow-violet-100/40 px-4 py-3 flex items-center gap-3 max-w-[220px]">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-900">
            {t("heroMockupNotifTitle")}
          </div>
          <div className="text-[10px] text-gray-400">
            {t("heroMockupNotifDesc")}
          </div>
        </div>
      </div>

      {/* Floating stat badge */}
      <div className="absolute -top-3 right-0 sm:-right-5 rounded-xl bg-white border border-gray-200 shadow-lg shadow-violet-100/40 px-4 py-2.5 text-center">
        <div className="text-lg font-bold text-violet-700">98%</div>
        <div className="text-[10px] font-medium text-gray-400">
          {t("heroMockupCoverage")}
        </div>
      </div>
    </div>
  );
}

function TrustedByBar() {
  const t = useTranslations("landing");
  // Placeholder logos rendered as SVG text for now
  const companies = [
    "Backwerk",
    "Café Milano",
    "GastroHaus",
    "ShiftPro",
    "TeamServe",
  ];

  return (
    <section className="py-10 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
          {t("trustedBy")}
        </p>
        <div className="flex items-center justify-center gap-6 sm:gap-12 flex-wrap opacity-40">
          {companies.map((name) => (
            <span
              key={name}
              className="text-xl font-bold text-gray-400 tracking-tight"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection({
  step,
  label,
  title,
  description,
  features,
  illustration,
  reversed,
  t,
}: {
  step: number;
  label: string;
  title: string;
  description: string;
  features: string[];
  illustration: React.ReactNode;
  reversed: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const stepIcons = [CalendarIcon, SendIcon, UsersIcon, BarChartIcon];
  const StepIcon = stepIcons[step - 1];

  return (
    <section
      id={step === 1 ? "features" : undefined}
      className={`py-12 sm:py-20 ${step % 2 === 0 ? "bg-section-alt" : ""}`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div
          className={`flex flex-col ${
            reversed ? "lg:flex-row-reverse" : "lg:flex-row"
          } items-center gap-10 lg:gap-16`}
        >
          {/* Text */}
          <div className="flex-1 max-w-lg">
            {/* Step badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider mb-4">
              <StepIcon className="w-3.5 h-3.5" />
              {t("step")} {step} — {label}
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
              {title}
            </h2>
            <p className="mt-4 text-gray-500 leading-relaxed">{description}</p>

            {/* Feature checklist */}
            <ul className="mt-6 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Illustration */}
          <div className="flex-1 w-full max-w-[520px]">{illustration}</div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const t = useTranslations("landing");
  const tp = useTranslations("pricing");

  const plans = [
    {
      name: tp("free"),
      price: tp("freePrice"),
      priceNote: tp("freePriceNote"),
      description: tp("freeDesc"),
      features: [
        tp("featureFree1"),
        tp("featureFree2"),
        tp("featureFree3"),
        tp("featureFree4"),
        tp("featureFree5"),
        tp("featureFree6"),
      ],
      cta: tp("getStarted"),
      href: "/register",
      highlighted: false,
    },
    {
      name: tp("pro"),
      price: tp("proPrice"),
      priceNote: tp("proPriceNote"),
      description: tp("proDesc"),
      features: [
        tp("featurePro1"),
        tp("featurePro2"),
        tp("featurePro3"),
        tp("featurePro4"),
        tp("featurePro5"),
        tp("featurePro6"),
      ],
      cta: tp("startTrial"),
      href: "/register",
      highlighted: true,
    },
    {
      name: tp("enterprise"),
      price: tp("enterprisePrice"),
      priceNote: tp("enterprisePriceNote"),
      description: tp("enterpriseDesc"),
      features: [
        tp("featureEnt1"),
        tp("featureEnt2"),
        tp("featureEnt3"),
        tp("featureEnt4"),
        tp("featureEnt5"),
        tp("featureEnt6"),
        tp("featureEnt7"),
      ],
      cta: tp("startTrial"),
      href: "/register",
      highlighted: false,
    },
    {
      name: tp("custom"),
      price: tp("customPrice"),
      priceNote: tp("customPriceNote"),
      description: tp("customDesc"),
      features: [
        tp("featureCustom1"),
        tp("featureCustom2"),
        tp("featureCustom3"),
        tp("featureCustom4"),
        tp("featureCustom5"),
        tp("featureCustom6"),
      ],
      cta: tp("contactUs"),
      href: "mailto:info@shiftfy.de",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("pricingTitle")}
          </h2>
          <p className="mt-4 text-gray-500">{t("pricingSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 flex flex-col transition-shadow ${
                plan.highlighted
                  ? "border-violet-500 ring-2 ring-violet-500 bg-white shadow-lg shadow-violet-100/50"
                  : "border-gray-200 bg-white shadow-sm hover:shadow-md"
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block self-start rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 mb-4">
                  {tp("popular")}
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">
                  {plan.price}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{plan.priceNote}</p>
              <p className="mt-3 text-sm text-gray-600">{plan.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircleIcon className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                    <span className="text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-brand-gradient text-white hover:shadow-lg hover:shadow-violet-200"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  const t = useTranslations("landing");

  const benefits = [
    {
      icon: ZapIcon,
      title: t("benefit1Title"),
      desc: t("benefit1Desc"),
    },
    {
      icon: UsersIcon,
      title: t("benefit2Title"),
      desc: t("benefit2Desc"),
    },
    {
      icon: ShieldCheckIcon,
      title: t("benefit3Title"),
      desc: t("benefit3Desc"),
    },
    {
      icon: BarChartIcon,
      title: t("benefit4Title"),
      desc: t("benefit4Desc"),
    },
    {
      icon: CalendarIcon,
      title: t("benefit5Title"),
      desc: t("benefit5Desc"),
    },
    {
      icon: StarIcon,
      title: t("benefit6Title"),
      desc: t("benefit6Desc"),
    },
  ];

  return (
    <section id="benefits" className="py-12 sm:py-20 bg-hero-gradient bg-grid">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("benefitsTitle")}{" "}
            <span className="text-gradient">{t("benefitsTitleBrand")}</span>{" "}
            {t("benefitsTitleEnd")}
          </h2>
          <p className="mt-4 text-gray-500">{t("benefitsSubtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl bg-white border border-gray-100 shadow-[0px_4px_24px_0px_rgba(124,58,237,0.06)] p-4 sm:p-6 hover:shadow-[0px_8px_32px_0px_rgba(124,58,237,0.12)] transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center mb-4">
                <b.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">{b.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const t = useTranslations("landing");

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
  ];

  return (
    <section id="faq" className="py-12 sm:py-20">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("faqTitle")}
          </h2>
          <p className="mt-4 text-gray-500">{t("faqSubtitle")}</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-gray-200 bg-white overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-4 sm:px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors text-sm sm:text-base">
                {faq.q}
                <ChevronRightIcon className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90 shrink-0" />
              </summary>
              <div className="px-4 sm:px-6 pb-5 text-sm text-gray-500 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTAFooter() {
  const t = useTranslations("landing");

  return (
    <section className="py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 p-8 sm:p-12 md:p-16 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full" />

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              {t("ctaTitle")}
            </h2>
            <p className="mt-4 text-violet-200 text-lg max-w-xl mx-auto">
              {t("ctaSubtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-white text-violet-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                {t("ctaButton")}
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslations("landing");

  return (
    <footer className="border-t border-gray-100 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
        <div className="flex items-center gap-2">
          <ShiftfyMark className="w-6 h-6" />
          <span className="font-bold text-sm text-gray-900">Shiftfy</span>
        </div>
        <p className="text-sm text-gray-400 text-center">
          © {new Date().getFullYear()} Shiftfy. {t("footerRights")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
          <Link
            href="/datenschutz"
            className="hover:text-gray-600 transition-colors"
          >
            {t("footerPrivacy")}
          </Link>
          <Link
            href="/impressum"
            className="hover:text-gray-600 transition-colors"
          >
            {t("footerImprint")}
          </Link>
          <Link href="/agb" className="hover:text-gray-600 transition-colors">
            {t("footerTerms")}
          </Link>
          <Link
            href="/widerruf"
            className="hover:text-gray-600 transition-colors"
          >
            {t("footerWithdrawal")}
          </Link>
          <Link
            href="/barrierefreiheit"
            className="hover:text-gray-600 transition-colors"
          >
            {t("footerAccessibility")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
