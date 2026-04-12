"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useMemo } from "react";

// Global error is outside NextIntlClientProvider, so we read the cookie directly
function getLocaleFromCookie(): "de" | "en" {
  if (typeof document === "undefined") return "de";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match?.[1] === "en" ? "en" : "de";
}

const messages = {
  de: {
    title: "Etwas ist schiefgelaufen",
    description:
      "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    tryAgain: "Erneut versuchen",
  },
  en: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again.",
    tryAgain: "Try again",
  },
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useMemo(() => getLocaleFromCookie(), []);
  const t = messages[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="flex min-h-[100dvh] items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-zinc-900 dark:shadow-zinc-800/20">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-8 w-8 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-zinc-100">
            {t.title}
          </h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-zinc-400">
            {t.description}
          </p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            {t.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
