"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  MapPinIcon,
  UsersIcon,
  CalendarIcon,
  ArrowRightIcon,
  XIcon,
} from "@/components/icons";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
  icon: "location" | "employee" | "shift" | "invite";
}

const ICONS = {
  location: MapPinIcon,
  employee: UsersIcon,
  shift: CalendarIcon,
  invite: UsersIcon,
};

const DISMISS_KEY_PREFIX = "shiftfy_checklist_dismissed_";

export function GettingStartedChecklist({
  workspaceId,
  items,
}: {
  workspaceId: string;
  items: ChecklistItem[];
}) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    const key = `${DISMISS_KEY_PREFIX}${workspaceId}`;
    setDismissed(localStorage.getItem(key) === "1");
  }, [workspaceId]);

  const allDone = items.every((i) => i.done);
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);

  function dismiss() {
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${workspaceId}`, "1");
    setDismissed(true);
  }

  // Auto-dismiss when everything is done (after a short delay)
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(dismiss, 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-zinc-900 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            Erste Schritte
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            {allDone
              ? "Alles erledigt — super!"
              : `${doneCount} von ${items.length} abgeschlossen`}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Schließen"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full rounded-full bg-gray-200 dark:bg-zinc-700">
        <div
          className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                item.done
                  ? "opacity-60"
                  : "bg-white dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-700/50"
              }`}
            >
              {/* Status icon */}
              <div
                className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full ${
                  item.done
                    ? "bg-emerald-100 dark:bg-emerald-900/50"
                    : "bg-gray-100 dark:bg-zinc-700"
                }`}
              >
                {item.done ? (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-400" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium leading-tight ${
                    item.done
                      ? "line-through text-gray-400 dark:text-zinc-500"
                      : "text-gray-900 dark:text-zinc-100"
                  }`}
                >
                  {item.label}
                </p>
                {!item.done && (
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 truncate">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Action link */}
              {!item.done && (
                <Link
                  href={item.href}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  Los
                  <ArrowRightIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
