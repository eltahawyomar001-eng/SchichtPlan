"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface AttachmentDTO {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: string;
  uploaderName: string | null;
  createdAt: string;
}

interface TicketStatus {
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  category: string;
  location: string | null;
  externalSubmitterName: string | null;
  createdAt: string;
  closedAt: string | null;
  comments: {
    id: string;
    content: string;
    authorName: string | null;
    createdAt: string;
  }[];
  attachments: AttachmentDTO[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OFFEN: { label: "Offen", color: "bg-yellow-100 text-yellow-800" },
  IN_BEARBEITUNG: {
    label: "In Bearbeitung",
    color: "bg-blue-100 text-blue-800",
  },
  GESCHLOSSEN: {
    label: "Geschlossen",
    color: "bg-gray-100 text-gray-800",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  SCHICHTPLAN: "Schichtplan",
  ZEITERFASSUNG: "Zeiterfassung",
  LOHNABRECHNUNG: "Lohnabrechnung",
  TECHNIK: "Technik",
  HR: "HR / Personal",
  QUALITAETSMANGEL: "Qualitätsmangel",
  FEHLENDE_LEISTUNG: "Fehlende Leistungserbringung",
  SONSTIGES: "Sonstiges",
};

export default function ExternalTicketStatusPage() {
  const params = useParams<{ token: string }>();
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function loadTicket() {
    try {
      const res = await fetch(`/api/tickets/external/${params.token}`);
      if (!res.ok) {
        setError(
          res.status === 404
            ? "Ticket nicht gefunden. Bitte prüfen Sie den Link."
            : "Fehler beim Laden des Tickets.",
        );
        return;
      }
      setTicket(await res.json());
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("file", f);
      const res = await fetch(
        `/api/tickets/external/${params.token}/attachments`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setUploadError(err?.message ?? "Upload fehlgeschlagen.");
      } else {
        await loadTicket();
      }
    } catch {
      setUploadError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="mt-4 text-gray-500">Ticket wird geladen…</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
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
          <h2 className="text-lg font-semibold text-gray-900">
            {error ?? "Ticket nicht gefunden"}
          </h2>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[ticket.status] ?? {
    label: ticket.status,
    color: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{ticket.ticketNumber}</p>
              <h1 className="mt-1 text-xl font-semibold text-gray-900">
                {ticket.subject}
              </h1>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
            >
              {statusInfo.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Kategorie</span>
              <p className="font-medium text-gray-900">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Eingereicht am</span>
              <p className="font-medium text-gray-900">
                {new Date(ticket.createdAt).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {ticket.externalSubmitterName && (
              <div>
                <span className="text-gray-500">Einreicher</span>
                <p className="font-medium text-gray-900">
                  {ticket.externalSubmitterName}
                </p>
              </div>
            )}
            {ticket.location && (
              <div>
                <span className="text-gray-500">Standort</span>
                <p className="font-medium text-gray-900">{ticket.location}</p>
              </div>
            )}
            {ticket.closedAt && (
              <div>
                <span className="text-gray-500">Geschlossen am</span>
                <p className="font-medium text-gray-900">
                  {new Date(ticket.closedAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">Beschreibung</h2>
          <p className="mt-2 whitespace-pre-wrap text-gray-900">
            {ticket.description}
          </p>
        </div>

        {/* Attachments */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">
            Anhänge ({ticket.attachments.length})
          </h2>

          {ticket.attachments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {ticket.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {a.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatBytesExt(Number(a.fileSize))}
                      {a.uploaderName ? ` · ${a.uploaderName}` : ""}
                    </p>
                  </div>
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}

          {ticket.status !== "GESCHLOSSEN" && (
            <div className="mt-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-emerald-300">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={uploading}
                />
                {uploading ? "Wird hochgeladen…" : "Anhang hinzufügen"}
              </label>
              <p className="mt-1 text-xs text-gray-400">
                Max. 10 MB pro Datei, 3 Dateien pro Upload.
              </p>
              {uploadError && (
                <p className="mt-2 text-xs text-red-600">{uploadError}</p>
              )}
            </div>
          )}
        </div>

        {/* Comments */}
        {ticket.comments.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500">
              Antworten ({ticket.comments.length})
            </h2>
            <div className="mt-4 space-y-4">
              {ticket.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{comment.authorName ?? "Mitarbeiter"}</span>
                    <span>
                      {new Date(comment.createdAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          Powered by Shiftfy · Ticketsystem
        </p>
      </div>
    </div>
  );
}

function formatBytesExt(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
