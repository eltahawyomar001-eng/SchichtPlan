"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  workspaceName: string;
  workspaceSlug: string | null;
  actorEmail: string | null;
  createdAt: string;
  superAdminAction: string;
  changes: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  "extend-trial": "Extended trial",
  "change-plan": "Changed plan",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeChanges(changes: Record<string, unknown> | null): string {
  if (!changes) return "—";
  return Object.entries(changes)
    .map(([field, v]) => {
      if (v && typeof v === "object" && "from" in v && "to" in v) {
        const { from, to } = v as { from: unknown; to: unknown };
        return `${field}: ${String(from ?? "∅")} → ${String(to ?? "∅")}`;
      }
      return `${field}: ${String(v)}`;
    })
    .join(", ");
}

export function AuditTable() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/super-admin/audit")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d) => {
        if (!cancelled) setEntries(d.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load audit log");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (entries === null) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400">Loading…</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
        No super-admin actions recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-left text-xs uppercase tracking-wide text-zinc-400">
          <tr>
            <th className="px-4 py-2.5 font-semibold">When</th>
            <th className="px-4 py-2.5 font-semibold">Action</th>
            <th className="px-4 py-2.5 font-semibold">Workspace</th>
            <th className="px-4 py-2.5 font-semibold">Actor</th>
            <th className="px-4 py-2.5 font-semibold">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {entries.map((e) => (
            <tr
              key={e.id}
              className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                {fmtDateTime(e.createdAt)}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap font-medium text-zinc-800 dark:text-zinc-200">
                {ACTION_LABELS[e.superAdminAction] ?? e.superAdminAction}
              </td>
              <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                {e.workspaceName}
              </td>
              <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                {e.actorEmail ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">
                {summarizeChanges(e.changes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
