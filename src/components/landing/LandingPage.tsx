"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ShiftfyMark,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ZapIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  MenuIcon,
  XIcon,
  DownloadIcon,
  SwapIcon,
  TemplateIcon,
  AwardIcon,
  BarChartIcon,
  SettingsIcon,
  CalendarUsersIcon,
  FlagIcon,
  BuildingIcon,
  BriefcaseIcon,
  PalmtreeIcon,
  SmartphoneIcon,
  TabletIcon,
  MonitorIcon,
  HeadsetIcon,
  StarIcon,
  QuoteIcon,
} from "@/components/icons";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CookieSettingsButton } from "@/components/cookie-banner";

/**
 * Full landing page for Shiftfy — Clockify-inspired redesign.
 *
 * Structure:
 * 1. Navbar
 * 2. Hero section with social proof stats
 * 3. Social proof (industry logos, testimonials, before/after comparison)
 * 4. Interactive feature tabs (Zeiterfassung / Schichtplanung / Abwesenheiten / Berichte)
 * 5. Benefits grid
 * 6. App showcase (PWA on all devices)
 * 7. Integrations (DATEV, Lexware, sevdesk, SAP, Personio, Sage)
 * 8. Trust / Security section
 * 8. Pricing
 * 9. FAQ
 * 10. CTA footer
 * 11. Mega-footer
 */
export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-white dark:bg-zinc-950">
      {/* Skip-to-content link (BFSG/WCAG 2.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        Zum Inhalt springen
      </a>

      <Navbar />

      <main id="main-content">
        <HeroSection />
        <FeatureTabsSection />
        <BenefitsSection />
        <AppShowcaseSection />
        <TrustSection />
        <PricingSection />
        <FAQSection />
        <CTAFooter />
      </main>

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
    <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/20 dark:border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <ShiftfyMark className="w-8 h-8" />
          <span className="font-bold text-lg text-gray-900 dark:text-zinc-100">
            Shift<span className="text-gradient">fy</span>
          </span>
        </Link>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t("navFeatures")}
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t("navPricing")}
          </a>
          <a
            href="#benefits"
            className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t("navBenefits")}
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t("navFaq")}
          </a>
          <Link
            href="/blog"
            className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t("navBlog")}
          </Link>
        </div>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          >
            {t("navLogin")}
          </Link>
          <Link
            href="/register"
            className="bg-brand-gradient text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200 transition-all"
          >
            {t("navCta")}
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={mobileOpen}
            className="md:hidden rounded-lg p-2 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
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
        <div className="md:hidden border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
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
              href="/blog"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {t("navBlog")}
            </Link>
            <Link
              href="/login"
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors sm:hidden"
            >
              {t("navLogin")}
            </Link>
            <div className="px-3 py-2 flex items-center gap-3">
              <LanguageSwitcher />
              <ThemeToggle />
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
    <section className="relative pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-36 pb-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950">
      {/* Decorative blurs — hidden on mobile to avoid iOS Safari clipping bug */}
      <div className="absolute top-32 -left-40 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl pointer-events-none hidden sm:block" />
      <div className="absolute -bottom-20 right-0 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-3xl pointer-events-none hidden sm:block" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left: Text */}
          <div className="flex-1 max-w-xl text-center lg:text-left">
            {/* Rating badge — verifiable claim */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 mb-5">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {t("heroBadge")}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.08]">
              {t("heroTitle")}{" "}
              <span className="text-gradient">{t("heroTitleHighlight")}</span>
            </h1>

            <p className="mt-5 sm:mt-6 text-base sm:text-lg text-gray-500 leading-relaxed max-w-lg mx-auto lg:mx-0">
              {t("heroSubtitle")}
            </p>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
              {(["heroProof1", "heroProof2", "heroProof3"] as const).map(
                (key) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700"
                  >
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                    {t(key)}
                  </div>
                ),
              )}
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                href="/register"
                className="bg-brand-gradient text-white font-semibold px-8 py-4 rounded-full text-base hover:shadow-xl hover:shadow-emerald-200 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {t("heroCtaPrimary")}
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <a
                href="#pricing"
                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1"
              >
                {t("heroCtaSecondary")}
                <ChevronRightIcon className="w-4 h-4" />
              </a>
            </div>
            <p className="mt-3 text-sm text-gray-400 text-center lg:text-left">
              {t("heroCtaSubNote")}
            </p>
          </div>

          {/* Right: App mockup */}
          <div className="flex-1 w-full max-w-[560px] lg:max-w-none">
            <HeroMockup />
          </div>
        </div>

        {/* Feature highlights bar */}
        <div className="mt-14 sm:mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {t("heroHighlight1")}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t("heroHighlight1Desc")}
            </div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ZapIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {t("heroHighlight2")}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t("heroHighlight2Desc")}
            </div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <SmartphoneIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {t("heroHighlight3")}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t("heroHighlight3Desc")}
            </div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DownloadIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {t("heroHighlight4")}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t("heroHighlight4Desc")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Inline SVG mockup showing a simplified Shiftfy time-tracking dashboard */
function HeroMockup() {
  const t = useTranslations("landing");

  const entries = [
    { name: "Anna M.", time: "08:00 – 16:30", net: "7h 45m", status: "✓" },
    { name: "Lukas B.", time: "09:15 – …", net: "live", status: "●" },
    { name: "Sara K.", time: "06:00 – 14:00", net: "7h 30m", status: "✓" },
    { name: "Tom W.", time: "—", net: "—", status: "○" },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-200/50 to-emerald-200/30 rounded-3xl blur-2xl scale-105" />

      <div className="relative rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-emerald-100/50 overflow-hidden">
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

        <div className="p-4 sm:p-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-700">
                16
              </div>
              <div className="text-[10px] sm:text-xs text-emerald-500 font-medium mt-0.5">
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

          {/* Time tracking table */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] bg-gray-50 text-[10px] sm:text-xs font-semibold text-gray-500">
              <div className="px-2 sm:px-3 py-2">{t("heroMockupTeam")}</div>
              <div className="px-2 sm:px-3 py-2 text-center">Zeit</div>
              <div className="px-2 sm:px-3 py-2 text-center">Netto</div>
              <div className="px-2 sm:px-3 py-2 text-center w-8" />
            </div>
            {entries.map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[1fr_auto_auto_auto] border-t border-gray-50 items-center"
              >
                <div className="px-2 sm:px-3 py-2.5 text-xs font-medium text-gray-700 truncate">
                  {row.name}
                </div>
                <div className="px-2 sm:px-3 py-2.5 text-xs text-gray-500 text-center whitespace-nowrap">
                  {row.time}
                </div>
                <div
                  className={`px-2 sm:px-3 py-2.5 text-xs font-semibold text-center whitespace-nowrap ${row.net === "live" ? "text-emerald-600" : "text-gray-700"}`}
                >
                  {row.net === "live" ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      4h 12m
                    </span>
                  ) : (
                    row.net
                  )}
                </div>
                <div className="px-2 sm:px-3 py-2.5 text-center text-xs w-8">
                  {row.status === "✓" ? (
                    <span className="text-emerald-500">✓</span>
                  ) : row.status === "●" ? (
                    <span className="text-emerald-500">●</span>
                  ) : (
                    <span className="text-gray-300">○</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating notification card */}
      <div className="absolute -bottom-4 left-0 sm:-left-6 rounded-xl bg-white border border-gray-200 shadow-lg shadow-emerald-100/40 px-4 py-3 flex items-center gap-3 max-w-[220px]">
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
      <div className="absolute -top-3 right-0 sm:-right-5 rounded-xl bg-white border border-gray-200 shadow-lg shadow-emerald-100/40 px-4 py-2.5 text-center">
        <div className="text-lg font-bold text-emerald-700">98%</div>
        <div className="text-[10px] font-medium text-gray-400">
          {t("heroMockupCoverage")}
        </div>
      </div>
    </div>
  );
}

/* ─── Social Proof Section ─── */
function SocialProofSection() {
  const t = useTranslations("landing");

  const industries = [
    { key: "socialProofIndustry1" as const, icon: BriefcaseIcon },
    { key: "socialProofIndustry2" as const, icon: BuildingIcon },
    { key: "socialProofIndustry3" as const, icon: HeadsetIcon },
    { key: "socialProofIndustry4" as const, icon: SettingsIcon },
    { key: "socialProofIndustry5" as const, icon: SwapIcon },
    { key: "socialProofIndustry6" as const, icon: PalmtreeIcon },
  ];

  const testimonials = [
    {
      name: t("testimonial1Name"),
      role: t("testimonial1Role"),
      company: t("testimonial1Company"),
      text: t("testimonial1Text"),
      initials: "MK",
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      name: t("testimonial2Name"),
      role: t("testimonial2Role"),
      company: t("testimonial2Company"),
      text: t("testimonial2Text"),
      initials: "TR",
      color: "bg-blue-100 text-blue-700",
    },
    {
      name: t("testimonial3Name"),
      role: t("testimonial3Role"),
      company: t("testimonial3Company"),
      text: t("testimonial3Text"),
      initials: "LM",
      color: "bg-amber-100 text-amber-700",
    },
  ];

  const beforeItems = [
    t("comparisonBefore1"),
    t("comparisonBefore2"),
    t("comparisonBefore3"),
    t("comparisonBefore4"),
  ];
  const afterItems = [
    t("comparisonAfter1"),
    t("comparisonAfter2"),
    t("comparisonAfter3"),
    t("comparisonAfter4"),
  ];

  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        {/* ── Industry logo bar ── */}
        <div className="text-center mb-14 sm:mb-20">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">
            {t("socialProofTitle")}
          </p>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            {t("socialProofSubtitle")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {industries.map((ind) => {
              const Icon = ind.icon;
              return (
                <div
                  key={ind.key}
                  className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{t(ind.key)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Testimonials ── */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 sm:mb-20">
          {testimonials.map((item) => (
            <div
              key={item.initials}
              className="rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon
                    key={i}
                    className="w-4 h-4 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <div className="relative mb-5">
                <QuoteIcon className="absolute -top-1 -left-1 w-6 h-6 text-emerald-100" />
                <p className="text-sm text-gray-600 leading-relaxed pl-5">
                  &ldquo;{item.text}&rdquo;
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${item.color}`}
                >
                  {item.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.role} · {item.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Before / After comparison ── */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-10">
            {t("comparisonTitle")}
          </h3>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Before */}
            <div className="rounded-3xl border border-red-100 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <XIcon className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm font-bold text-red-600">
                  {t("comparisonWithout")}
                </span>
              </div>
              <ul className="space-y-3">
                {beforeItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <XIcon className="w-3 h-3 text-red-400" />
                    </span>
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm font-bold text-emerald-700">
                  {t("comparisonWith")}
                </span>
              </div>
              <ul className="space-y-3">
                {afterItems.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircleIcon className="w-3 h-3 text-emerald-600" />
                    </span>
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Interactive Feature Tabs Section (Clockify-style) ─── */
function FeatureTabsSection() {
  const t = useTranslations("landing");
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: t("featureTab1"),
      icon: ClockIcon,
      title: t("featureTab1Title"),
      desc: t("featureTab1Desc"),
      bullets: [
        t("featureTab1Bullet1"),
        t("featureTab1Bullet2"),
        t("featureTab1Bullet3"),
        t("featureTab1Bullet4"),
      ],
    },
    {
      label: t("featureTab2"),
      icon: CalendarIcon,
      title: t("featureTab2Title"),
      desc: t("featureTab2Desc"),
      bullets: [
        t("featureTab2Bullet1"),
        t("featureTab2Bullet2"),
        t("featureTab2Bullet3"),
        t("featureTab2Bullet4"),
      ],
    },
    {
      label: t("featureTab3"),
      icon: CalendarUsersIcon,
      title: t("featureTab3Title"),
      desc: t("featureTab3Desc"),
      bullets: [
        t("featureTab3Bullet1"),
        t("featureTab3Bullet2"),
        t("featureTab3Bullet3"),
        t("featureTab3Bullet4"),
      ],
    },
    {
      label: t("featureTab4"),
      icon: BarChartIcon,
      title: t("featureTab4Title"),
      desc: t("featureTab4Desc"),
      bullets: [
        t("featureTab4Bullet1"),
        t("featureTab4Bullet2"),
        t("featureTab4Bullet3"),
        t("featureTab4Bullet4"),
      ],
    },
  ];

  const active = tabs[activeTab];

  return (
    <section id="features" className="py-16 sm:py-24 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("featureTabsTitle")}
          </h2>
          <p className="mt-4 text-gray-500">{t("featureTabsSubtitle")}</p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex flex-wrap justify-center gap-2 rounded-2xl bg-gray-100 dark:bg-zinc-800 p-1.5">
            {tabs.map((tab, i) => {
              const Icon = tab.icon;
              return (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-sm font-semibold transition-all ${
                    activeTab === i
                      ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm"
                      : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left: Text */}
          <div className="flex-1 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
              <active.icon className="w-3.5 h-3.5" />
              {active.label}
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {active.title}
            </h3>
            <p className="mt-4 text-gray-500 leading-relaxed">{active.desc}</p>

            <ul className="mt-6 space-y-3">
              {active.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="text-sm text-gray-700">{b}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 bg-brand-gradient text-white font-semibold px-6 py-3 rounded-full text-sm hover:shadow-lg hover:shadow-emerald-200 transition-all"
            >
              {t("heroCtaPrimary")}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>

          {/* Right: Feature mockup */}
          <div className="flex-1 w-full max-w-[540px]">
            <FeatureTabMockup tab={activeTab} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** App-like mockup for each feature tab */
function FeatureTabMockup({ tab }: { tab: number }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-200/40 to-emerald-100/20 rounded-3xl blur-2xl scale-105" />

      <div className="relative rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-emerald-100/50 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-4 rounded-md bg-white border border-gray-200 px-3 py-1">
            <span className="text-xs text-gray-400">app.shiftfy.de</span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {tab === 0 && <TimeTrackingMockup />}
          {tab === 1 && <ShiftPlanMockup />}
          {tab === 2 && <AbsenceMockup />}
          {tab === 3 && <ReportsMockup />}
        </div>
      </div>
    </div>
  );
}

function TimeTrackingMockup() {
  const t = useTranslations("landing");
  const rows = [
    {
      name: t("featureTabMockup1Name1"),
      time: t("featureTabMockup1Time1"),
      active: true,
    },
    {
      name: t("featureTabMockup1Name2"),
      time: t("featureTabMockup1Time2"),
      active: false,
    },
    {
      name: t("featureTabMockup1Name3"),
      time: t("featureTabMockup1Time3"),
      active: true,
    },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900">
          {t("featureTabMockup1Title")}
        </h4>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          {t("featureTabMockup1Hours")}
        </span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                {r.name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {r.name}
                </div>
                <div className="text-xs text-gray-400">{r.time}</div>
              </div>
            </div>
            {r.active && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {t("featureTabMockup1Active")}
              </span>
            )}
            {!r.active && (
              <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftPlanMockup() {
  const t = useTranslations("landing");
  const days = ["Mo", "Di", "Mi", "Do", "Fr"];
  const shifts = [
    {
      label: t("featureTabMockup2Early"),
      color: "bg-emerald-100 text-emerald-700",
    },
    { label: t("featureTabMockup2Late"), color: "bg-amber-100 text-amber-700" },
    {
      label: t("featureTabMockup2Night"),
      color: "bg-indigo-100 text-indigo-700",
    },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900">
          {t("featureTabMockup2Title")}
        </h4>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          {t("featureTabMockup2Covered")}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-400 pb-1"
          >
            {day}
          </div>
        ))}
        {days.map((day, di) =>
          shifts.map((s, si) => (
            <div
              key={`${day}-${si}`}
              className={`rounded-lg p-1.5 text-center text-[10px] font-semibold ${s.color} ${di === 2 && si === 1 ? "ring-2 ring-emerald-500 ring-offset-1" : ""}`}
            >
              {s.label}
            </div>
          )),
        )}
      </div>
    </div>
  );
}

function AbsenceMockup() {
  const t = useTranslations("landing");
  const items = [
    {
      name: "Anna M.",
      type: t("featureTabMockup3Vacation"),
      status: t("featureTabMockup3Approved"),
      statusColor: "text-emerald-600 bg-emerald-50",
    },
    {
      name: "Ben K.",
      type: t("featureTabMockup3Sick"),
      status: t("featureTabMockup3Approved"),
      statusColor: "text-emerald-600 bg-emerald-50",
    },
    {
      name: "Clara S.",
      type: t("featureTabMockup3Vacation"),
      status: t("featureTabMockup3Pending"),
      statusColor: "text-amber-600 bg-amber-50",
    },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900">
          {t("featureTabMockup3Title")}
        </h4>
      </div>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                {item.name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {item.name}
                </div>
                <div className="text-xs text-gray-400">{item.type}</div>
              </div>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${item.statusColor}`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsMockup() {
  const t = useTranslations("landing");
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900">
          {t("featureTabMockup4Title")}
        </h4>
        <button className="text-xs font-semibold text-white bg-emerald-600 px-3 py-1.5 rounded-lg">
          {t("featureTabMockup4Export")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">1.247 h</div>
          <div className="text-xs text-emerald-500 mt-1">
            {t("featureTabMockup4Total")}
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">+42 h</div>
          <div className="text-xs text-amber-500 mt-1">
            {t("featureTabMockup4Overtime")}
          </div>
        </div>
      </div>
      {/* Mini bar chart */}
      <div className="flex items-end gap-1.5 h-20 px-2">
        {[65, 80, 55, 90, 70, 85, 45, 95, 75, 60, 88, 72].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400 transition-all"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function PricingSection() {
  const t = useTranslations("landing");
  const tp = useTranslations("pricing");
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: tp("basic"),
      basePrice: annual ? tp("basicAnnualBase") : tp("basicMonthlyBase"),
      perUser: annual ? tp("basicPerUserAnnual") : tp("basicPerUserMonthly"),
      description: tp("basicDesc"),
      features: [
        tp("featureBasic1"),
        tp("featureBasic2"),
        tp("featureBasic3"),
        tp("featureBasic4"),
        tp("featureBasic5"),
        tp("featureBasic6"),
        tp("featureBasic7"),
      ],
      cta: tp("startTrial"),
      href: `/register?plan=basic&billing=${annual ? "annual" : "monthly"}`,
      highlighted: false,
      isEnterprise: false,
    },
    {
      name: tp("professional"),
      basePrice: annual
        ? tp("professionalAnnualBase")
        : tp("professionalMonthlyBase"),
      perUser: annual
        ? tp("professionalPerUserAnnual")
        : tp("professionalPerUserMonthly"),
      description: tp("professionalDesc"),
      features: [
        tp("featurePro1"),
        tp("featurePro2"),
        tp("featurePro3"),
        tp("featurePro4"),
        tp("featurePro5"),
        tp("featurePro6"),
        tp("featurePro7"),
        tp("featurePro8"),
        tp("featurePro9"),
        tp("featurePro10"),
      ],
      cta: tp("startTrial"),
      href: `/register?plan=professional&billing=${annual ? "annual" : "monthly"}`,
      highlighted: true,
      isEnterprise: false,
    },
    {
      name: tp("enterprise"),
      basePrice: tp("enterpriseCustom"),
      perUser: null,
      description: tp("enterpriseDesc"),
      features: [
        tp("featureEnt1"),
        tp("featureEnt2"),
        tp("featureEnt3"),
        tp("featureEnt4"),
        tp("featureEnt5"),
        tp("featureEnt6"),
        tp("featureEnt7"),
        tp("featureEnt8"),
      ],
      cta: tp("contactSales"),
      href: "mailto:info@bashabsheh-vergabepartner.de?subject=Enterprise%20Plan%20Anfrage",
      highlighted: false,
      isEnterprise: true,
    },
  ];

  return (
    <section id="pricing" className="py-12 sm:py-20 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("pricingTitle")}
          </h2>
          <p className="mt-4 text-gray-500">{t("pricingSubtitle")}</p>

          {/* ─── Billing Toggle ─── */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-gray-100 dark:bg-zinc-800 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                !annual
                  ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
            >
              {tp("billingMonthly")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                annual
                  ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
            >
              {tp("billingAnnual")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border p-6 flex flex-col transition-shadow ${
                plan.highlighted
                  ? "border-emerald-500 ring-2 ring-emerald-500 bg-white dark:bg-zinc-900 shadow-lg shadow-emerald-100/50 dark:shadow-emerald-950/30"
                  : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md"
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
                  {tp("popular")}
                </span>
              )}
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-4">
                {plan.isEnterprise ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-gray-900">
                        {plan.basePrice}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {tp("enterprisePriceNote")}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-gray-900">
                        {plan.basePrice}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {tp("perUserMonth")} ·{" "}
                      {annual ? tp("billedAnnually") : tp("billedMonthly")}
                    </p>
                  </>
                )}
              </div>
              <p className="mt-3 text-sm text-gray-600">{plan.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-brand-gradient text-white hover:shadow-lg hover:shadow-emerald-200"
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
      icon: ClockIcon,
      title: t("benefit1Title"),
      desc: t("benefit1Desc"),
    },
    {
      icon: BarChartIcon,
      title: t("benefit7Title"),
      desc: t("benefit7Desc"),
      highlight: true,
    },
    {
      icon: CheckCircleIcon,
      title: t("benefit2Title"),
      desc: t("benefit2Desc"),
    },
    {
      icon: ShieldCheckIcon,
      title: t("benefit3Title"),
      desc: t("benefit3Desc"),
    },
    {
      icon: DownloadIcon,
      title: t("benefit4Title"),
      desc: t("benefit4Desc"),
    },
    {
      icon: CalendarIcon,
      title: t("benefit5Title"),
      desc: t("benefit5Desc"),
    },
    {
      icon: TemplateIcon,
      title: t("benefit8Title"),
      desc: t("benefit8Desc"),
    },
    {
      icon: SwapIcon,
      title: t("benefit9Title"),
      desc: t("benefit9Desc"),
    },
    {
      icon: AwardIcon,
      title: t("benefit10Title"),
      desc: t("benefit10Desc"),
    },
    {
      icon: SettingsIcon,
      title: t("benefit11Title"),
      desc: t("benefit11Desc"),
    },
    {
      icon: CalendarUsersIcon,
      title: t("benefit12Title"),
      desc: t("benefit12Desc"),
    },
    {
      icon: PalmtreeIcon,
      title: t("benefit13Title"),
      desc: t("benefit13Desc"),
    },
    {
      icon: BuildingIcon,
      title: t("benefit14Title"),
      desc: t("benefit14Desc"),
    },
    {
      icon: BriefcaseIcon,
      title: t("benefit15Title"),
      desc: t("benefit15Desc"),
    },
    {
      icon: FlagIcon,
      title: t("benefit16Title"),
      desc: t("benefit16Desc"),
    },
    {
      icon: ZapIcon,
      title: t("benefit6Title"),
      desc: t("benefit6Desc"),
    },
  ];

  return (
    <section
      id="benefits"
      className="py-12 sm:py-20 bg-hero-gradient dark:bg-zinc-900 bg-grid"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("benefitsTitle")}{" "}
            <span className="text-gradient">{t("benefitsTitleBrand")}</span>{" "}
            {t("benefitsTitleEnd")}
          </h2>
          <p className="mt-4 text-gray-500">{t("benefitsSubtitle")}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b) => (
            <div
              key={b.title}
              className={`rounded-3xl border p-4 sm:p-5 hover:shadow-[0px_8px_32px_0px_rgba(37,99,235,0.12)] transition-all duration-300 ${
                b.highlight
                  ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 shadow-md ring-1 ring-emerald-200/50 dark:ring-emerald-700/30"
                  : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800 shadow-[0px_4px_24px_0px_rgba(37,99,235,0.06)]"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                  b.highlight ? "bg-emerald-600" : "bg-emerald-50"
                }`}
              >
                <b.icon
                  className={`w-5 h-5 ${b.highlight ? "text-white" : ""}`}
                />
              </div>
              <h3 className="font-bold text-gray-900">{b.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
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
    <section id="faq" className="py-12 sm:py-20 dark:bg-zinc-950">
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
              className="group rounded-3xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
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
    <section className="py-12 sm:py-20 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 p-8 sm:p-12 md:p-16 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full" />

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              {t("ctaTitle")}
            </h2>
            <p className="mt-4 text-emerald-200 text-lg max-w-xl mx-auto">
              {t("ctaSubtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-white text-emerald-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
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

function AppShowcaseSection() {
  const t = useTranslations("landing");

  const devices = [
    {
      icon: MonitorIcon,
      title: t("appShowcaseDesktop"),
      desc: t("appShowcaseDesktopDesc"),
    },
    {
      icon: SmartphoneIcon,
      title: t("appShowcaseMobile"),
      desc: t("appShowcaseMobileDesc"),
    },
    {
      icon: TabletIcon,
      title: t("appShowcaseTablet"),
      desc: t("appShowcaseTabletDesc"),
    },
  ];

  const badges = [t("appShowcaseInstant"), t("appShowcaseNoInstall")];

  return (
    <section className="py-16 sm:py-24 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("appShowcaseTitle")}
          </h2>
          <p className="mt-4 text-gray-500">{t("appShowcaseSubtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {devices.map((d) => {
            const Icon = d.icon;
            return (
              <div
                key={d.title}
                className="rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{d.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{d.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {badges.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700"
            >
              <CheckCircleIcon className="w-4 h-4" />
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const t = useTranslations("landing");

  const stats = [
    {
      icon: ShieldCheckIcon,
      value: t("trustStat1Value"),
      label: t("trustStat1Label"),
      desc: t("trustStat1Desc"),
    },
    {
      icon: ZapIcon,
      value: t("trustStat2Value"),
      label: t("trustStat2Label"),
      desc: t("trustStat2Desc"),
    },
    {
      icon: ShieldCheckIcon,
      value: t("trustStat4Value"),
      label: t("trustStat4Label"),
      desc: t("trustStat4Desc"),
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-950">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            {t("trustTitle")}
          </h2>
          <p className="mt-4 text-gray-500">{t("trustSubtitle")}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-3xl font-extrabold text-gray-900">
                  {s.value}
                </div>
                <div className="text-sm font-semibold text-emerald-600 mt-1">
                  {s.label}
                </div>
                <p className="mt-2 text-xs text-gray-400">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslations("landing");

  return (
    <footer className="border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 pt-12 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        {/* Mega-footer grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <ShiftfyMark className="w-7 h-7" />
              <span className="font-bold text-gray-900">Shiftfy</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("heroSubtitle").slice(0, 100)}…
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
              {t("footerProduct")}
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerFeatures")}
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("navPricing")}
                </a>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("navBlog")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
              {t("footerFeatures")}
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerTimeTracking")}
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerShiftPlanning")}
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerAbsences")}
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerReports")}
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerAutomation")}
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
              {t("footerResources")}
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li>
                <Link
                  href="/blog"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("navBlog")}
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@bashabsheh-vergabepartner.de"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerContact")}
                </a>
              </li>
              <li>
                <Link
                  href="/ersparnisrechner"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("savingsCalculator")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
              {t("footerLegal")}
            </h4>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li>
                <Link
                  href="/datenschutz"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerPrivacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/impressum"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerImprint")}
                </Link>
              </li>
              <li>
                <Link
                  href="/agb"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerTerms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/widerruf"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerWithdrawal")}
                </Link>
              </li>
              <li>
                <Link
                  href="/barrierefreiheit"
                  className="hover:text-gray-700 transition-colors"
                >
                  {t("footerAccessibility")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-200 pt-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Shiftfy. {t("footerRights")}
          </p>
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  );
}
