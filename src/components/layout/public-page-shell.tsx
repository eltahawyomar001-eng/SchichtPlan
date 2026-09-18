import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShiftfyMark } from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getLocaleFromCookie } from "@/i18n/locale";

/**
 * Shared chrome for every public page outside the marketing home page.
 *
 * Each of these pages used to inline its own nav and footer with the labels
 * written straight into the JSX in German, and none of them rendered the
 * LanguageSwitcher — it existed only in the dashboard topbar. So the locale
 * cookie had nothing to act on and the pages were German whatever the user
 * picked. One shell fixes the switcher, the labels and the duplication at once.
 */
export default async function PublicPageShell({
  children,
  legalTranslationNotice = false,
}: {
  children: React.ReactNode;
  /**
   * Legal pages (AGB, Datenschutz, AVV, Widerruf, SLA, Impressum,
   * Barrierefreiheit) render an English translation for convenience, but the
   * German wording is the version that binds. Say so, on the page.
   */
  legalTranslationNotice?: boolean;
}) {
  const t = await getTranslations("publicPages");

  const navLinks = [
    { href: "/", label: t("navHome") },
    { href: "/pricing", label: t("navPricing") },
    { href: "/blog", label: t("navBlog") },
    { href: "/login", label: t("navLogin") },
  ];

  const footerLinks = [
    { href: "/datenschutz", label: t("footerPrivacy") },
    { href: "/impressum", label: t("footerImprint") },
    { href: "/agb", label: t("footerTerms") },
    { href: "/widerruf", label: t("footerWithdrawal") },
    { href: "/barrierefreiheit", label: t("footerAccessibility") },
    { href: "/sla", label: t("footerSla") },
  ];

  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-zinc-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900 dark:text-white">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
              >
                {l.label}
              </Link>
            ))}
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              {t("navCta")}
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {legalTranslationNotice && <LegalTranslationNotice />}
        {children}
      </main>

      <footer className="border-t border-gray-100 dark:border-zinc-800 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
              Shiftfy
            </span>
          </div>
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center">
            {t("footerRights", { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-zinc-500">
            {footerLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Renders only when the reader is not on the German original. German readers
 * are already looking at the binding text, so the notice would be noise.
 */
async function LegalTranslationNotice() {
  const locale = await getLocaleFromCookie();
  if (locale === "de") return null;

  const t = await getTranslations("publicPages");
  return (
    <div
      role="note"
      className="mb-8 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-3"
    >
      <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
        {t("legalTranslationNotice")}
      </p>
    </div>
  );
}
