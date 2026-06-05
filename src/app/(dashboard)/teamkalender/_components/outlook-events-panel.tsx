"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarIcon, LinkIcon } from "@/components/icons";

interface OutlookEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location: string | null;
  status: string;
  isCancelled: boolean;
  webLink: string | null;
  source: "outlook";
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; events: OutlookEvent[] }
  | { kind: "notConnected" }
  | { kind: "reauth" }
  | { kind: "error" };

/**
 * Self-contained panel that pulls the current user's Outlook events for the
 * visible calendar range. It owns its own fetch and error handling so it can be
 * dropped onto the calendar page without touching the shift/absence grid.
 */
export function OutlookEventsPanel({ start, end }: { start: Date; end: Date }) {
  const t = useTranslations("outlookConnect");
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Fetch inline within the effect (React-recommended data-fetching pattern):
  // state is only updated after the awaited fetch resolves, and a `cancelled`
  // flag discards results from a stale request when the visible range changes
  // before the previous fetch completes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/integrations/outlook/events?start=${startStr}&end=${endStr}`,
        );
        if (cancelled) return;
        if (res.status === 409) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setState({ kind: body.reauthRequired ? "reauth" : "notConnected" });
          }
          return;
        }
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = await res.json();
        if (!cancelled) setState({ kind: "ok", events: data.events ?? [] });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startStr, endStr]);

  function timeLabel(ev: OutlookEvent): string {
    if (ev.isAllDay) return t("allDay");
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    return `${format(s, "HH:mm")}–${format(e, "HH:mm")}`;
  }

  function dayLabel(iso: string): string {
    return format(new Date(iso), "EEE dd.MM.");
  }

  return (
    <div className="rounded-2xl border border-[#0078d4]/20 bg-[#0078d4]/[0.03] dark:bg-[#0078d4]/[0.06] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarIcon className="h-4 w-4 text-[#0078d4]" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
          {t("panelTitle")}
        </h3>
      </div>

      {state.kind === "loading" && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0078d4] border-t-transparent" />
      )}

      {(state.kind === "notConnected" || state.kind === "reauth") && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
          <span>
            {state.kind === "reauth" ? t("reauthRequired") : t("notConnected")}
          </span>
          <Link
            href="/einstellungen"
            className="inline-flex items-center gap-1 text-[#0078d4] hover:underline"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {t("connect")}
          </Link>
        </div>
      )}

      {state.kind === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {t("loadError")}
        </p>
      )}

      {state.kind === "ok" && state.events.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          {t("noEvents")}
        </p>
      )}

      {state.kind === "ok" && state.events.length > 0 && (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {state.events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0078d4]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`truncate text-sm font-medium text-gray-900 dark:text-zinc-100 ${
                      ev.isCancelled ? "line-through opacity-60" : ""
                    }`}
                  >
                    {ev.webLink ? (
                      <a
                        href={ev.webLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {ev.title}
                      </a>
                    ) : (
                      ev.title
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-zinc-500">
                    {dayLabel(ev.start)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-400">
                  {timeLabel(ev)}
                  {ev.location ? ` · ${ev.location}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
