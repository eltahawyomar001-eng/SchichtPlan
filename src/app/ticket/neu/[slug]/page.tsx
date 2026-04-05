"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const CATEGORIES = [
  { value: "SCHICHTPLAN", label: "Schichtplan" },
  { value: "ZEITERFASSUNG", label: "Zeiterfassung" },
  { value: "LOHNABRECHNUNG", label: "Lohnabrechnung" },
  { value: "TECHNIK", label: "Technik" },
  { value: "HR", label: "HR / Personal" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

interface SubmitResult {
  ticketNumber: string;
  token: string;
}

export default function ExternalTicketFormPage() {
  const params = useParams<{ slug: string }>();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("SONSTIGES");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/tickets/external?workspace=${encodeURIComponent(params.slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            subject,
            description,
            location,
            category,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error ??
            "Fehler beim Erstellen des Tickets. Bitte versuchen Sie es erneut.",
        );
        return;
      }

      const data = await res.json();
      setResult({ ticketNumber: data.ticketNumber, token: data.token });
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  // Success state
  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
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
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">
            Ticket erstellt!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ihr Ticket <strong>{result.ticketNumber}</strong> wurde erfolgreich
            eingereicht.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            Über den folgenden Link können Sie den Status jederzeit einsehen:
          </p>
          <a
            href={`/ticket/${result.token}`}
            className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 underline"
          >
            Ticket-Status anzeigen →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Ticket einreichen
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Beschreiben Sie Ihr Anliegen. Wir melden uns schnellstmöglich.
          </p>

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Ihr Name *
              </label>
              <input
                id="name"
                type="text"
                required
                minLength={2}
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Max Mustermann"
              />
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-medium text-gray-700"
              >
                Betreff *
              </label>
              <input
                id="subject"
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Kurze Beschreibung des Anliegens"
              />
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700"
              >
                Kategorie *
              </label>
              <select
                id="category"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700"
              >
                Standort <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="location"
                type="text"
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="z.B. Filiale Berlin-Mitte"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Beschreibung *
              </label>
              <textarea
                id="description"
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Beschreiben Sie Ihr Anliegen ausführlich…"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Wird gesendet…" : "Ticket einreichen"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Bitte geben Sie keine sensiblen Gesundheits- oder Standortdaten ein.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Powered by Shiftfy · Ticketsystem
        </p>
      </div>
    </div>
  );
}
