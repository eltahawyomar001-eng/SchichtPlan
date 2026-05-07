"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { XIcon } from "@/components/icons";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

type Category = "BUG" | "FEATURE" | "QUESTION" | "OTHER";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "BUG", label: "Fehler melden" },
  { value: "FEATURE", label: "Funktionswunsch" },
  { value: "QUESTION", label: "Frage" },
  { value: "OTHER", label: "Sonstiges" },
];

export function FeedbackWidget() {
  const pathname = usePathname();
  const keyboardInset = useKeyboardInset();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<Category>("BUG");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message, url: pathname }),
      });
      if (!res.ok) {
        setError(
          "Feedback konnte nicht gesendet werden. Bitte erneut versuchen.",
        );
        return;
      }
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setSubject("");
        setMessage("");
        setCategory("BUG");
      }, 1800);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Feedback geben"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
          style={
            keyboardInset > 0
              ? { paddingBottom: keyboardInset + 16 }
              : undefined
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
              <h2
                id="feedback-title"
                className="text-base font-semibold text-gray-900 dark:text-white"
              >
                Feedback senden
              </h2>
              <button
                type="button"
                aria-label="Schließen"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {submitted ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Vielen Dank für Ihr Feedback!
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                    Kategorie
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
                          category === c.value
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                            : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-gray-300"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="fb-subject"
                    className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
                  >
                    Betreff
                  </label>
                  <input
                    id="fb-subject"
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Kurze Zusammenfassung"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fb-message"
                    className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
                  >
                    Nachricht
                  </label>
                  <textarea
                    id="fb-message"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    placeholder="Beschreiben Sie das Problem oder Ihren Wunsch so detailliert wie möglich."
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="text-xs text-red-600 dark:text-red-400"
                  >
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Senden …" : "Senden"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
