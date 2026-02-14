"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  SchichtPlanMark,
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

/**
 * Full Connecteam-style landing page for SchichtPlan.
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <SchichtPlanMark className="w-8 h-8" />
          <span className="font-bold text-lg text-gray-900">
            Schicht<span className="text-gradient">Plan</span>
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
        <div className="flex items-center gap-3">
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
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md">
          <div className="px-4 py-3 space-y-1">
            <a
              href="#features"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {t("navFeatures")}
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
          </div>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  const t = useTranslations("landing");

  return (
    <section className="relative pt-24 sm:pt-32 pb-14 sm:pb-20 bg-hero-gradient bg-grid overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
          <ZapIcon className="w-4 h-4" />
          {t("heroBadge")}
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 max-w-4xl mx-auto leading-[1.1]">
          {t("heroTitle")}{" "}
          <span className="text-gradient">{t("heroTitleHighlight")}</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          {t("heroSubtitle")}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            href="/register"
            className="bg-brand-gradient text-white font-semibold px-8 py-3.5 rounded-full text-base hover:shadow-xl hover:shadow-violet-200 transition-all flex items-center gap-2"
          >
            {t("heroCtaPrimary")}
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 text-gray-600 font-medium hover:text-gray-900 transition-colors"
          >
            {t("heroCtaSecondary")}
            <ChevronRightIcon className="w-4 h-4" />
          </a>
        </div>

        {/* Social proof */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            {t("heroProof1")}
          </div>
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            {t("heroProof2")}
          </div>
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            {t("heroProof3")}
          </div>
        </div>
      </div>
    </section>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
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
    <footer className="border-t border-gray-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <SchichtPlanMark className="w-6 h-6" />
          <span className="font-bold text-sm text-gray-900">SchichtPlan</span>
        </div>
        <p className="text-sm text-gray-400">
          © {new Date().getFullYear()} SchichtPlan. {t("footerRights")}
        </p>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <a href="#" className="hover:text-gray-600 transition-colors">
            {t("footerPrivacy")}
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            {t("footerImprint")}
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            {t("footerTerms")}
          </a>
        </div>
      </div>
    </footer>
  );
}
