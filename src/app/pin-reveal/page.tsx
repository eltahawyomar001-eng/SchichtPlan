"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PinRevealContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [pin, setPin] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "shown" | "error">(
    token ? "loading" : "error",
  );

  useEffect(() => {
    if (!token) return;

    fetch(`/api/pin-reveal?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.pin) {
          setPin(data.pin);
          setState("shown");
        } else setState("error");
      })
      .catch(() => setState("error"));
  }, [token]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (state === "error" || !pin) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Link abgelaufen
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte
            wenden Sie sich an Ihren Vorgesetzten, um eine neue PIN zu erhalten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg
            className="h-6 w-6 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">
          Ihre Stempeluhr-PIN
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Bitte notieren Sie sich Ihre PIN. Dieser Link kann nur einmal geöffnet
          werden.
        </p>
        <div className="mt-6 rounded-xl bg-gray-50 py-6">
          <span className="text-4xl font-bold tracking-[0.3em] text-emerald-700">
            {pin}
          </span>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Teilen Sie Ihre PIN nicht mit Kolleginnen und Kollegen.
        </p>
      </div>
    </div>
  );
}

export default function PinRevealPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <PinRevealContent />
    </Suspense>
  );
}
