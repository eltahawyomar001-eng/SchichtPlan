import { getTranslations } from "next-intl/server";
import deMessages from "../../messages/de.json";

type Namespace = keyof typeof deMessages;

/**
 * Translate a user-facing string inside an API route, without ever failing the
 * request because of it.
 *
 * `getTranslations()` needs a next-intl request scope. Route handlers normally
 * have one, but when it is missing the lookup throws — and `withRoute` turns
 * any throw into a 500. That is how localising the duplicate-account message
 * briefly converted a deliberate 409 ("this email already exists") into an
 * opaque 500: the caller lost both the status and the explanation.
 *
 * So: try the request locale, and fall back to the default-locale (German)
 * message. A German string is a far better outcome than a 500, and German is
 * the default locale anyway.
 */
export async function routeMessage(
  namespace: Namespace,
  key: string,
  values?: Record<string, string | number>,
): Promise<string> {
  try {
    const t = await getTranslations(namespace as string);
    return t(key as never, values as never) as string;
  } catch {
    const table = deMessages[namespace] as unknown as Record<string, string>;
    let message = table?.[key] ?? key;
    for (const [name, value] of Object.entries(values ?? {})) {
      message = message.split(`{${name}}`).join(String(value));
    }
    return message;
  }
}
