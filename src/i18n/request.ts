import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { log } from "@/lib/logger";

/**
 * Request-scoped i18n configuration.
 *
 * Reads the user's preferred locale from the "locale" cookie.
 * Falls back to "de" (German) since Shiftfy is a German-market SaaS.
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
    // Safety net: a missing/edge translation key must never crash a whole page
    // into the root error boundary. Degrade gracefully — log it, and render a
    // readable fallback (the last path segment) instead of throwing.
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        log.warn("[i18n] missing message", { message: error.message });
        return;
      }
      log.error("[i18n] error", { message: error.message });
    },
    getMessageFallback({ key, namespace }) {
      const full = namespace ? `${namespace}.${key}` : key;
      // Human-ish fallback: last segment, so the UI shows e.g. "submit"
      // rather than a blank or a crash.
      return full.split(".").pop() ?? full;
    },
  };
});
