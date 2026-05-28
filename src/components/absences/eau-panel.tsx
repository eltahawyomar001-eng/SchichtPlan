"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import {
  FileCheckIcon,
  RefreshIcon,
  EditIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from "@/components/icons";

interface EauRecord {
  id: string;
  status: "PENDING" | "RETRIEVED" | "NOT_FOUND" | "ERROR" | "MANUAL";
  provider: string;
  auFrom: string | null;
  auTo: string | null;
  isInitial: boolean | null;
  issuedDate: string | null;
  krankenkasse: string | null;
  message: string | null;
}

const STATUS: Record<EauRecord["status"], { label: string; cls: string }> = {
  PENDING: {
    label: "Ausstehend",
    cls: "bg-gray-100 text-gray-600 border-gray-200",
  },
  RETRIEVED: {
    label: "Abgerufen",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  NOT_FOUND: {
    label: "Nicht gefunden",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ERROR: { label: "Fehler", cls: "bg-red-50 text-red-700 border-red-200" },
  MANUAL: {
    label: "Manuell zu erfassen",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

function fmt(d: string | null): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

export function EauPanel({
  absenceId,
  employeeId,
  startDate,
}: {
  absenceId: string;
  employeeId: string;
  startDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<EauRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<EauRecord | null>(null);
  const [form, setForm] = useState({
    auFrom: "",
    auTo: "",
    issuedDate: "",
    krankenkasse: "",
    isInitial: true,
    applyToAbsence: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    const res = await fetch(`/api/eau?absenceRequestId=${absenceId}`);
    if (res.ok) setRecords(await res.json());
    setLoaded(true);
  }, [absenceId]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await fetchRecords();
  }

  async function retrieve() {
    setBusy(true);
    try {
      const res = await fetch("/api/eau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          absenceRequestId: absenceId,
          incapacityDate: startDate.slice(0, 10),
          isInitial: true,
        }),
      });
      if (res.ok) await fetchRecords();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r: EauRecord) {
    setEdit(r);
    setForm({
      auFrom: r.auFrom ? r.auFrom.slice(0, 10) : startDate.slice(0, 10),
      auTo: r.auTo ? r.auTo.slice(0, 10) : "",
      issuedDate: r.issuedDate ? r.issuedDate.slice(0, 10) : "",
      krankenkasse: r.krankenkasse ?? "",
      isInitial: r.isInitial ?? true,
      applyToAbsence: false,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/eau/${edit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RETRIEVED",
          auFrom: form.auFrom || null,
          auTo: form.auTo || null,
          issuedDate: form.issuedDate || null,
          krankenkasse: form.krankenkasse || null,
          isInitial: form.isInitial,
          applyToAbsence: form.applyToAbsence,
        }),
      });
      if (res.ok) {
        setEdit(null);
        await fetchRecords();
      }
    } finally {
      setSaving(false);
    }
  }

  const latest = records[0];

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
      >
        <FileCheckIcon className="h-3.5 w-3.5" />
        eAU
        {latest && (
          <Badge
            className={`ml-1 text-[10px] border ${STATUS[latest.status].cls}`}
          >
            {STATUS[latest.status].label}
          </Badge>
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/30 p-3">
          {!loaded ? (
            <p className="text-xs text-gray-400">Lädt…</p>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Noch kein eAU-Abruf für diese Krankmeldung.
              </p>
              <Button size="sm" disabled={busy} onClick={retrieve}>
                <RefreshIcon className="h-3.5 w-3.5" />
                {busy ? "Wird abgerufen…" : "eAU abrufen"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      className={`text-[10px] border ${STATUS[r.status].cls}`}
                    >
                      {r.status === "RETRIEVED" ? (
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                      ) : r.status === "ERROR" || r.status === "NOT_FOUND" ? (
                        <AlertTriangleIcon className="h-3 w-3 mr-1" />
                      ) : null}
                      {STATUS[r.status].label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => openEdit(r)}
                    >
                      <EditIcon className="h-3 w-3" />
                      Erfassen
                    </Button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-600 dark:text-zinc-400">
                    <span>AU von: {fmt(r.auFrom)}</span>
                    <span>AU bis: {fmt(r.auTo)}</span>
                    <span>
                      Art:{" "}
                      {r.isInitial == null
                        ? "–"
                        : r.isInitial
                          ? "Erstbescheinigung"
                          : "Folgebescheinigung"}
                    </span>
                    <span>Ausgestellt: {fmt(r.issuedDate)}</span>
                    <span className="col-span-2">
                      Krankenkasse: {r.krankenkasse || "–"}
                    </span>
                  </div>
                  {r.message && (
                    <p className="mt-1 text-[11px] italic text-gray-500 dark:text-zinc-500">
                      {r.message}
                    </p>
                  )}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={retrieve}
                className="w-full"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                Erneut abrufen (Folgebescheinigung)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Manual entry / correction modal */}
      <AdaptiveModal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="eAU-Daten erfassen"
        size="md"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Tragen Sie die über das SV-Meldeportal abgerufenen Angaben ein. Die
            eAU enthält keine Diagnose.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>AU von</Label>
              <Input
                type="date"
                value={form.auFrom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, auFrom: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>AU bis</Label>
              <Input
                type="date"
                value={form.auTo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, auTo: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ausgestellt am</Label>
              <Input
                type="date"
                value={form.issuedDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issuedDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Krankenkasse</Label>
              <Input
                placeholder="z. B. AOK Hessen"
                value={form.krankenkasse}
                onChange={(e) =>
                  setForm((f) => ({ ...f, krankenkasse: e.target.value }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isInitial}
              onChange={(e) =>
                setForm((f) => ({ ...f, isInitial: e.target.checked }))
              }
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Erstbescheinigung (sonst Folgebescheinigung)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.applyToAbsence}
              onChange={(e) =>
                setForm((f) => ({ ...f, applyToAbsence: e.target.checked }))
              }
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Abwesenheitszeitraum auf AU-Zeitraum aktualisieren
          </label>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEdit(null)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>
    </div>
  );
}
