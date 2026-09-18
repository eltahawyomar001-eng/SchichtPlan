import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PublicPageShell from "@/components/layout/public-page-shell";
import LegalDocument, {
  type LegalSection,
} from "@/components/legal/legal-document";
import { CURRENT_TOS_VERSION, formatLegalDate } from "@/lib/legal-version";
import { getLocaleFromCookie } from "@/i18n/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalPrivacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/datenschutz" },
    robots: { index: true, follow: true },
  };
}

export default async function DatenschutzPage() {
  const t = await getTranslations("legalPrivacy");
  const locale = await getLocaleFromCookie();

  // The document body is data in the message files, not markup — see
  // components/legal/legal-document.tsx for why.
  const sections = t.raw("sections") as LegalSection[];

  return (
    <PublicPageShell legalTranslationNotice>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">
        {t("versionLine", {
          date: formatLegalDate(CURRENT_TOS_VERSION, locale),
          version: CURRENT_TOS_VERSION,
        })}
      </p>

      <LegalDocument sections={sections} />
    </PublicPageShell>
  );
}
