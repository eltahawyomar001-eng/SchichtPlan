"use client";

import { useState } from "react";

export interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  enabledFor: string; // JSON array string
  disabledFor: string; // JSON array string
  rolloutPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

function countJsonArray(raw: string): number {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function FlagsTable({ flags: initial }: { flags: FeatureFlag[] }) {
  const [flags, setFlags] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-flag form
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  async function patchFlag(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/flags/${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, ...data } : f)),
      );
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function createFlag() {
    const key = newKey.trim();
    if (!key) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          description: newDesc.trim() || undefined,
          enabled: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }
      setFlags((prev) =>
        prev.some((f) => f.key === data.key)
          ? prev.map((f) => (f.key === data.key ? data : f))
          : [...prev, data].sort((a, b) => a.key.localeCompare(b.key)),
      );
      setNewKey("");
      setNewDesc("");
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function deleteFlag(key: string) {
    if (!confirm(`Delete feature flag "${key}"? This cannot be undone.`))
      return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/flags/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      setFlags((prev) => prev.filter((f) => f.key !== key));
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Create new flag */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
          New flag
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="flag_key (e.g. new_scheduler)"
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createFlag}
            disabled={!newKey.trim() || creating}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "…" : "Create"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Flag list */}
      <div className="space-y-2">
        {flags.map((f) => {
          const flagBusy = busy === f.key;
          const overrides =
            countJsonArray(f.enabledFor) + countJsonArray(f.disabledFor);
          return (
            <div
              key={f.key}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {f.key}
                  </code>
                  {overrides > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      {overrides} override{overrides !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {f.description && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    {f.description}
                  </div>
                )}
              </div>

              {/* Rollout % */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold">
                  Rollout
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={f.rolloutPercent}
                  disabled={flagBusy}
                  onBlur={(e) => {
                    const v = Math.max(
                      0,
                      Math.min(100, Number(e.target.value) || 0),
                    );
                    if (v !== f.rolloutPercent)
                      patchFlag(f.key, { rolloutPercent: v });
                  }}
                  className="w-16 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                />
                <span className="text-xs text-zinc-400">%</span>
              </div>

              {/* Enabled toggle */}
              <button
                onClick={() => patchFlag(f.key, { enabled: !f.enabled })}
                disabled={flagBusy}
                role="switch"
                aria-checked={f.enabled}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
                  f.enabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    f.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteFlag(f.key)}
                disabled={flagBusy}
                title="Delete flag"
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
              >
                Delete
              </button>
            </div>
          );
        })}

        {flags.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No feature flags yet. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}
