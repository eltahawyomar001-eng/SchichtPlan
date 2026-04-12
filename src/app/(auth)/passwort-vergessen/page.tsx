"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShiftfyMark, MailIcon, CheckCircleIcon } from "@/components/icons";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || t("genericError"));
      }
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <ShiftfyMark className="h-10 w-10" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Shiftfy
            </span>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                {t("resetEmailSent")}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                {t("resetEmailSentDesc")}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)]"
              >
                {t("backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {t("forgotPasswordTitle")}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                {t("forgotPasswordDesc")}
              </p>

              {error && (
                <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300"
                  >
                    {t("email")}
                  </label>
                  <div className="relative">
                    <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      required
                      className="h-12 w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-11 pr-4 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 transition-shadow focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? t("sending") : t("sendResetLink")}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
                <Link
                  href="/login"
                  className="font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)]"
                >
                  {t("backToLogin")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
