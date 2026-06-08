"use client";

import { useState } from "react";

type Tab = "workspaces" | "flags" | "audit";

export function AdminShell({
  workspacesSlot,
  flagsSlot,
  auditSlot,
  flagCount,
}: {
  workspacesSlot: React.ReactNode;
  flagsSlot: React.ReactNode;
  auditSlot: React.ReactNode;
  flagCount: number;
}) {
  const [tab, setTab] = useState<Tab>("workspaces");

  const tabs: { id: Tab; label: string }[] = [
    { id: "workspaces", label: "Workspaces" },
    {
      id: "flags",
      label: `Feature Flags${flagCount ? ` (${flagCount})` : ""}`,
    },
    { id: "audit", label: "Audit Log" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.id
                ? "border-purple-500 text-purple-700 dark:text-purple-300"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "workspaces" ? "" : "hidden"}>
        {workspacesSlot}
      </div>
      <div className={tab === "flags" ? "" : "hidden"}>{flagsSlot}</div>
      {/* Mount the audit tab lazily — it fetches on mount, so only render
          when first opened to avoid a network call on every page load. */}
      {tab === "audit" && <div>{auditSlot}</div>}
    </div>
  );
}
