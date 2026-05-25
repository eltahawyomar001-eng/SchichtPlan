"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShiftfyMark, CheckCircleIcon } from "@/components/icons";

/**
 * Landing page after "Continue with Google" on the register page.
 *
 * OAuth makes no distinction between "register" and "login" — the same
 * flow creates a new account or signs into an existing one. This page
 * reads a short-lived server flag (set only when createUser fires) to
 * show the appropriate message before redirecting to the dashboard.
 *
 * Existing users who click "Register with Google" land here and see a
 * clear "Welcome back — you already have an account" notice instead of
 * being silently dumped on the dashboard.
 */
export default function OAuthWelcomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [isNew, setIsNew] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/auth/oauth-status")
      .then((r) => r.json())
      .then((data: { isNew: boolean }) => {
        setIsNew(data.isNew);
        // Auto-redirect after showing the message
        setTimeout(() => router.replace("/dashboard"), 3000);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [status, router]);

  // Still loading session or fetching status
  if (status === "loading" || isNew === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-lg text-center">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <ShiftfyMark className="h-9 w-9" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Shiftfy
          </span>
        </Link>

        <div
          className={`mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full ${
            isNew ? "bg-emerald-50" : "bg-amber-50"
          }`}
        >
          <CheckCircleIcon
            className={`h-7 w-7 ${isNew ? "text-emerald-500" : "text-amber-500"}`}
          />
        </div>

        {isNew ? (
          <>
            <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
              Account erstellt!
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Willkommen bei Shiftfy. Ihr Konto wurde erfolgreich mit Google
              erstellt.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
              Willkommen zurück
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Sie haben bereits ein Shiftfy-Konto. Sie wurden mit Ihrem
              bestehenden Google-Konto angemeldet.
            </p>
          </>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Sie werden in Kürze weitergeleitet…
        </p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
