"use client";

import { useState, useEffect, useCallback, use } from "react";
import { ShiftfyMark, CheckCircleIcon, CircleXIcon } from "@/components/icons";

interface QuoteView {
  number: string;
  title: string | null;
  notes: string | null;
  status: string;
  issueDate: string;
  validUntil: string | null;
  vatRate: number;
  clientName: string | null;
  workspaceName: string;
  items: { description: string; quantity: number; unitPriceCents: number }[];
  totals: { netCents: number; vatCents: number; grossCents: number };
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

export default function AngebotAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotes/accept/${token}`);
    if (res.ok) {
      const d = await res.json();
      setQuote(d);
      if (d.status === "ANGENOMMEN" || d.status === "ABGELEHNT")
        setResult(d.status);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function decide(decision: "accept" | "decline") {
    setSubmitting(true);
    const res = await fetch(`/api/quotes/accept/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      const d = await res.json();
      setResult(d.status);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div>
          <CircleXIcon className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-600">
            Dieses Angebot wurde nicht gefunden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-zinc-950 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <ShiftfyMark className="h-7 w-7" />
          <span className="font-bold text-gray-900 dark:text-zinc-100">
            {quote.workspaceName}
          </span>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                Angebot {quote.number}
              </h1>
              {quote.title && (
                <p className="mt-1 text-sm text-gray-500">{quote.title}</p>
              )}
            </div>
            {quote.validUntil && (
              <p className="text-xs text-gray-400">
                Gültig bis{" "}
                {new Date(quote.validUntil).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>

          <table className="mt-6 w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="pb-2 font-medium">Position</th>
                <th className="pb-2 font-medium text-right">Menge</th>
                <th className="pb-2 font-medium text-right">Einzelpreis</th>
                <th className="pb-2 font-medium text-right">Summe</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-zinc-800">
              {quote.items.map((it, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-800 dark:text-zinc-200">
                    {it.description}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {it.quantity}
                  </td>
                  <td className="py-2 text-right text-gray-600">
                    {euro(it.unitPriceCents)}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {euro(Math.round(it.quantity * it.unitPriceCents))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Netto</span>
              <span>{euro(quote.totals.netCents)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>MwSt. ({quote.vatRate}%)</span>
              <span>{euro(quote.totals.vatCents)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold text-gray-900 dark:text-zinc-100">
              <span>Gesamt</span>
              <span>{euro(quote.totals.grossCents)}</span>
            </div>
          </div>

          {quote.notes && (
            <p className="mt-5 text-sm text-gray-500 whitespace-pre-line">
              {quote.notes}
            </p>
          )}

          {/* Action / result */}
          <div className="mt-8 border-t pt-6">
            {result === "ANGENOMMEN" ? (
              <div className="flex items-center justify-center gap-2 text-emerald-700">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="font-medium">
                  Angebot angenommen — vielen Dank!
                </span>
              </div>
            ) : result === "ABGELEHNT" ? (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <CircleXIcon className="h-5 w-5" />
                <span className="font-medium">Angebot abgelehnt.</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => decide("accept")}
                  disabled={submitting}
                  className="flex-1 rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  Angebot annehmen
                </button>
                <button
                  onClick={() => decide("decline")}
                  disabled={submitting}
                  className="flex-1 rounded-full border border-gray-200 dark:border-zinc-700 px-6 py-3 font-semibold text-gray-600 dark:text-zinc-300 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                >
                  Ablehnen
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Bereitgestellt über Shiftfy
        </p>
      </div>
    </div>
  );
}
