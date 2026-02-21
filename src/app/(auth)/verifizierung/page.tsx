"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  SchichtPlanMark,
  CheckCircleIcon,
  AlertTriangleIcon,
  MailIcon,
} from "@/components/icons";

function VerifizierungContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("verification");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "no-token"
  >(token && email ? "verifying" : "no-token");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Auto-verify on mount if token present
  useEffect(() => {
    if (!token || !email) return;

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        });
        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          // Redirect to login after 3 seconds
          setTimeout(() => router.push("/login?verified=true"), 3000);
        } else {
          setStatus("error");
          setErrorMsg(data.error || t("genericError"));
        }
      } catch {
        setStatus("error");
        setErrorMsg(t("networkError"));
      }
    })();
  }, [token, email, router, t]);

  // Resend verification email
  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <SchichtPlanMark className="h-10 w-10" />
          <span className="text-xl font-bold text-gray-900">SchichtPlan</span>
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100 text-center">
          {/* ── Verifying ── */}
          {status === "verifying" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-600 border-t-transparent" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {t("verifyingTitle")}
              </h1>
              <p className="mt-2 text-sm text-gray-500">{t("verifyingDesc")}</p>
            </>
          )}

          {/* ── Success ── */}
          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {t("successTitle")}
              </h1>
              <p className="mt-2 text-sm text-gray-500">{t("successDesc")}</p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
              >
                {t("goToLogin")}
              </Link>
            </>
          )}

          {/* ── Error ── */}
          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <AlertTriangleIcon className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {t("errorTitle")}
              </h1>
              <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
              {email && (
                <button
                  onClick={handleResend}
                  disabled={resending || resent}
                  className="mt-4 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  {resent ? t("resent") : t("resend")}
                </button>
              )}
            </>
          )}

          {/* ── No token (check your email page) ── */}
          {status === "no-token" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
                <MailIcon className="h-8 w-8 text-violet-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {t("checkEmailTitle")}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {t("checkEmailDesc")}
              </p>
              <p className="mt-4 text-xs text-gray-400">
                {t("checkEmailSpam")}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                {t("backToLogin")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifizierungSeite() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      }
    >
      <VerifizierungContent />
    </Suspense>
  );
}
