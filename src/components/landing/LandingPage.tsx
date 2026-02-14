"use client";

import { useState } from "react";
import Link from "next/link";
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
        label="PLANUNG"
        title="Erstelle Schichtpläne in Minuten"
        description="Plane Schichten per Drag & Drop, nutze Vorlagen und lass dir freie Zeitfenster automatisch vorschlagen. Konflikte werden sofort erkannt."
        features={[
          "Drag & Drop Schichtplanung",
          "Automatische Konflikterkennung",
          "Wiederverwendbare Vorlagen",
          "Verfügbarkeiten der Mitarbeiter",
        ]}
        illustration={<PlanningIllustration />}
        reversed={false}
      />

      <FeatureSection
        step={2}
        label="VERTEILUNG"
        title="Mit einem Klick an alle verteilen"
        description="Veröffentliche den fertigen Schichtplan und benachrichtige dein gesamtes Team automatisch. Bestätigungen in Echtzeit."
        features={[
          "Sofortige Push-Benachrichtigung",
          "Bestätigungsstatus pro Mitarbeiter",
          "Automatische Erinnerungen",
          "Änderungshistorie",
        ]}
        illustration={<DistributionIllustration />}
        reversed={true}
      />

      <FeatureSection
        step={3}
        label="TAGESGESCHÄFT"
        title="Behalte den Überblick im Alltag"
        description="Verwalte Schichttausch, Abwesenheiten und Einchecken an einem Ort. Alles in Echtzeit."
        features={[
          "Live-Übersicht aktiver Schichten",
          "Schichttausch mit einem Klick",
          "Zeiterfassung & Einchecken",
          "Abwesenheitsmanagement",
        ]}
        illustration={<DayToDayIllustration />}
        reversed={false}
      />

      <FeatureSection
        step={4}
        label="AUSWERTUNG"
        title="Bereit für Lohnabrechnung"
        description="Exportiere Stundenreports, erkenne Überstunden und halte Arbeitsgesetze ein — alles automatisch."
        features={[
          "Automatische Stundenreports",
          "Überstunden-Erkennung",
          "CSV & PDF Export",
          "Lohnkosten-Übersicht",
        ]}
        illustration={<ReportingIllustration />}
        reversed={true}
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
            Funktionen
          </a>
          <a
            href="#benefits"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Vorteile
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            FAQ
          </a>
        </div>

        {/* CTA + mobile toggle */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Anmelden
          </Link>
          <Link
            href="/register"
            className="bg-brand-gradient text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-full hover:shadow-lg hover:shadow-violet-200 transition-all"
          >
            Kostenlos starten
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
              Funktionen
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Vorteile
            </a>
            <a
              href="#faq"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              FAQ
            </a>
            <Link
              href="/login"
              className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors sm:hidden"
            >
              Anmelden
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-24 sm:pt-32 pb-14 sm:pb-20 bg-hero-gradient bg-grid overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
          <ZapIcon className="w-4 h-4" />
          Schichtplanung neu gedacht
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 max-w-4xl mx-auto leading-[1.1]">
          Schichtpläne erstellen,{" "}
          <span className="text-gradient">die funktionieren</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Von der Planung bis zur Lohnabrechnung — SchichtPlan vereinfacht dein
          gesamtes Schichtmanagement in einer Plattform.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link
            href="/register"
            className="bg-brand-gradient text-white font-semibold px-8 py-3.5 rounded-full text-base hover:shadow-xl hover:shadow-violet-200 transition-all flex items-center gap-2"
          >
            Jetzt kostenlos starten
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 text-gray-600 font-medium hover:text-gray-900 transition-colors"
          >
            Mehr erfahren
            <ChevronRightIcon className="w-4 h-4" />
          </a>
        </div>

        {/* Social proof */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            Kostenlos testen
          </div>
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            Keine Kreditkarte nötig
          </div>
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            DSGVO-konform
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustedByBar() {
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
          Vertraut von Teams in ganz Deutschland
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
}: {
  step: number;
  label: string;
  title: string;
  description: string;
  features: string[];
  illustration: React.ReactNode;
  reversed: boolean;
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
              Schritt {step} — {label}
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
  const benefits = [
    {
      icon: ZapIcon,
      title: "80% schneller planen",
      desc: "Vorlagen und Drag & Drop machen Schluss mit Zettelwirtschaft.",
    },
    {
      icon: UsersIcon,
      title: "Team zufrieden stellen",
      desc: "Mitarbeiter sehen ihre Schichten sofort und können tauschen.",
    },
    {
      icon: ShieldCheckIcon,
      title: "Rechtssicher arbeiten",
      desc: "Automatische Prüfung von Ruhezeiten und Arbeitszeitgesetzen.",
    },
    {
      icon: BarChartIcon,
      title: "Kosten im Blick",
      desc: "Lohnkosten-Prognosen und Überstunden-Tracking in Echtzeit.",
    },
    {
      icon: CalendarIcon,
      title: "Abwesenheiten managen",
      desc: "Urlaub, Krankheit und Feiertage in einem System verwalten.",
    },
    {
      icon: StarIcon,
      title: "5-Sterne Bewertungen",
      desc: "Schichtplanung, die Teams lieben — einfach und intuitiv.",
    },
  ];

  return (
    <section id="benefits" className="py-12 sm:py-20 bg-hero-gradient bg-grid">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            Warum Teams <span className="text-gradient">SchichtPlan</span>{" "}
            wählen
          </h2>
          <p className="mt-4 text-gray-500">
            Alles, was du für professionelle Schichtplanung brauchst — in einer
            Plattform.
          </p>
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
  const faqs = [
    {
      q: "Ist SchichtPlan wirklich kostenlos?",
      a: "Ja! Du kannst SchichtPlan kostenlos mit bis zu 5 Mitarbeitern nutzen. Für größere Teams gibt es flexible Tarife.",
    },
    {
      q: "Wie schnell kann ich starten?",
      a: "In unter 5 Minuten. Registriere dich, lade deine Mitarbeiter ein und erstelle deinen ersten Schichtplan.",
    },
    {
      q: "Ist meine Daten sicher?",
      a: "Absolut. Alle Daten werden DSGVO-konform in Deutschland gehostet und verschlüsselt übertragen.",
    },
    {
      q: "Können Mitarbeiter ihre Schichten tauschen?",
      a: "Ja, Mitarbeiter können Tausch-Anfragen direkt stellen. Du als Manager behältst die volle Kontrolle und genehmigst Änderungen.",
    },
    {
      q: "Gibt es eine App für Mitarbeiter?",
      a: "SchichtPlan funktioniert vollständig im Browser auf jedem Gerät. Eine native App ist in Planung.",
    },
  ];

  return (
    <section id="faq" className="py-12 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
            Häufige Fragen
          </h2>
          <p className="mt-4 text-gray-500">
            Du hast Fragen? Wir haben Antworten.
          </p>
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
  return (
    <section className="py-12 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 p-8 sm:p-12 md:p-16 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full" />

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Bereit, deine Schichtplanung zu revolutionieren?
            </h2>
            <p className="mt-4 text-violet-200 text-lg max-w-xl mx-auto">
              Starte kostenlos und erlebe, wie einfach Personalplanung sein
              kann.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-white text-violet-700 font-bold px-8 py-3.5 rounded-full hover:shadow-xl transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                Jetzt kostenlos starten
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
  return (
    <footer className="border-t border-gray-100 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <SchichtPlanMark className="w-6 h-6" />
          <span className="font-bold text-sm text-gray-900">SchichtPlan</span>
        </div>
        <p className="text-sm text-gray-400">
          © {new Date().getFullYear()} SchichtPlan. Alle Rechte vorbehalten.
        </p>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <a href="#" className="hover:text-gray-600 transition-colors">
            Datenschutz
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            Impressum
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            AGB
          </a>
        </div>
      </div>
    </footer>
  );
}
