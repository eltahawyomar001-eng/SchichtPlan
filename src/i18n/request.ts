import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/**
 * Request-scoped i18n configuration.
 *
 * Reads the user's preferred locale from the "locale" cookie.
 * Falls back to "de" (German) since SchichtPlan is a German-market SaaS.
 *
 * Supported locales: "de" | "en"
 */

export type Locale = "de" | "en";
export const defaultLocale: Locale = "de";
export const locales: Locale[] = ["de", "en"];

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("locale")?.value;
  const locale: Locale = locales.includes(raw as Locale)
    ? (raw as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
