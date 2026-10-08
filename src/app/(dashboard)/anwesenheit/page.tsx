"use client";

/**
 * Live attendance against the roster.
 *
 * The four states are the point. A single "working" bucket would hide the one
 * that needs a decision: somebody clocked in without a shift, or outside the
 * one they were given. That is the situation a manager has to catch the same
 * day, because by the time it reaches a monthly export it has become an
 * argument about who remembers what.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import {
  RefreshIcon,
  CheckCircleIcon,
  CircleXIcon,
  AlertTriangleIcon,
} from "@/components/icons";

type Status = "PLANMAESSIG" | "PAUSE" | "UNPLANMAESSIG" | "OFFLINE";
type Decision = "OFFEN" | "GENEHMIGT" | "ABGELEHNT";

interface Row {
  employeeId: string;
  name: string;
  position: string | null;
  status: Status;
  reason: string | null;
  deviationMinutes: number | null;
  entryId: string | null;
  entryDate: string | null;
  since: string | null;
  locationName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  decision: Decision | null;
}

/** Colour carries the same meaning in both themes. */
const STATUS_STYLE: Record<Status, string> = {
  PLANMAESSIG:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  PAUSE: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  UNPLANMAESSIG: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  OFFLINE: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const DOT: Record<Status, string> = {
  PLANMAESSIG: "bg-emerald-500",
  PAUSE: "bg-amber-500",
  UNPLANMAESSIG: "bg-red-500",
  OFFLINE: "bg-gray-400",
};

/** The order a manager reads them in: problems first, then present, then not. */
const ORDER: Status[] = ["UNPLANMAESSIG", "PLANMAESSIG", "PAUSE", "OFFLINE"];

function hhmm(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnwesenheitPage() {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<Status, number> | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decideFor, setDecideFor] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/anwesenheit");
      if (res.ok) {
        const d = await res.json();
        setRows(d.employees ?? []);
        setSummary(d.summary ?? null);
        setAsOf(d.now ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // A live view that needs a manual refresh is not a live view. Sixty
    // seconds is frequent enough to act on and cheap enough to leave open on
    // a wall screen all day.
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const reasonText = (r: Row) => {
    if (!r.reason) return null;
    const m = r.deviationMinutes ?? 0;
    return t(`reason${r.reason}`, { minutes: m });
  };

  const sorted = [...rows].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.name.localeCompare(b.name, "de"),
  );

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("refresh")}</span>
          </Button>
        }
      />
      <PageContent>
        {/* Summary. Every bucket is shown even at zero: an admin must be able
            to tell "none unplanned" from "not measured". */}
        {summary && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ORDER.map((s) => (
              <Card key={s}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${DOT[s]}`} />
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {t(`status${s}`)}
                    </p>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {summary[s] ?? 0}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {asOf && (
          <p className="mt-3 text-right text-xs text-gray-400 dark:text-zinc-500">
            {t("asOf", { time: hhmm(asOf) })}
          </p>
        )}

        <Card className="mt-2">
          <CardContent className="p-0">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {tc("loading")}
              </p>
            ) : sorted.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {t("empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-gray-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">
                        {t("employee")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("statusLabel")}
                      </th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {t("since")}
                      </th>
                      <th className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {t("planned")}
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {sorted.map((r) => (
                      <tr key={r.employeeId}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.name} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-zinc-100">
                                {r.name}
                              </p>
                              {r.locationName && (
                                <p className="text-xs text-gray-500 dark:text-zinc-400">
                                  {r.locationName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            className={`${STATUS_STYLE[r.status]} whitespace-nowrap text-xs`}
                          >
                            {t(`status${r.status}`)}
                          </Badge>
                          {/* WHY it deviates. "No shift planned" and "three
                              hours early" are different conversations. */}
                          {reasonText(r) && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {reasonText(r)}
                            </p>
                          )}
                          {r.decision && r.decision !== "OFFEN" && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
                              {t(`decision${r.decision}`)}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                          {hhmm(r.since)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                          {r.plannedStart
                            ? `${r.plannedStart} – ${r.plannedEnd}`
                            : t("noPlan")}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.status === "UNPLANMAESSIG" && r.entryId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDecideFor(r)}
                            >
                              <AlertTriangleIcon className="h-3.5 w-3.5" />
                              {t("openDay")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {decideFor && (
          <DecideModal
            row={decideFor}
            onClose={() => setDecideFor(null)}
            onDone={() => {
              setDecideFor(null);
              void load();
            }}
          />
        )}
      </PageContent>
    </div>
  );
}

/* ───────── Day detail and decision ───────── */

interface DayEntry {
  id: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  netMinutes: number;
  remarks: string | null;
  unplannedDecision: Decision;
  unplannedReason: string | null;
  unplannedDecidedAt: string | null;
  verdict: {
    status: Status;
    reason: string | null;
    deviationMinutes: number | null;
  } | null;
}

/**
 * The recorded times and the planned shifts, side by side.
 *
 * The decision is "do these hours belong against that plan", and it cannot be
 * made from either half alone -- which is why the dialog shows both rather
 * than just the entry being judged.
 */
function DecideModal({
  row,
  onClose,
  onDone,
}: {
  row: Row;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [shifts, setShifts] = useState<
    {
      id: string;
      startTime: string;
      endTime: string;
      locationName: string | null;
    }[]
  >([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const date = (row.entryDate ?? new Date().toISOString()).slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/anwesenheit/${row.employeeId}?date=${date}`,
        );
        if (res.ok) {
          const d = await res.json();
          setEntries(d.entries ?? []);
          setShifts(d.shifts ?? []);
          const current = (d.entries ?? []).find(
            (e: DayEntry) => e.id === row.entryId,
          );
          if (current?.unplannedReason) setReason(current.unplannedReason);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [row.employeeId, row.entryId, date]);

  async function decide(decision: Decision) {
    if (decision !== "OFFEN" && !reason.trim()) {
      toast.error(t("reasonRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/time-entries/${row.entryId}/unplanned`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("decisionSaved"));
        onDone();
      } else {
        toast.error(d.message ?? t("decisionFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  const current = entries.find((e) => e.id === row.entryId);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t("dayTitle", {
        name: row.name,
        date: new Date(date).toLocaleDateString("de-DE"),
      })}
      description={t("decideHint")}
    >
      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">
          {tc("loading")}
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {t("dayRecorded")}
          </p>
          {entries.length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">{t("dayNoEntries")}</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-gray-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("colFrom")}</th>
                    <th className="px-3 py-2 font-medium">{t("colTo")}</th>
                    <th className="px-3 py-2 font-medium">{t("colBreak")}</th>
                    <th className="px-3 py-2 font-medium">{t("colNet")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800">
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      className={
                        e.id === row.entryId
                          ? "bg-red-50/60 dark:bg-red-950/20"
                          : ""
                      }
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {e.startTime}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {e.endTime}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {e.breakMinutes} min
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {(e.netMinutes / 60).toFixed(2)} h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {t("dayPlanned")}
          </p>
          {shifts.length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">{t("dayNoShifts")}</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {shifts.map((s) => (
                <li
                  key={s.id}
                  className="text-sm text-gray-600 dark:text-zinc-300"
                >
                  {s.startTime} – {s.endTime}
                  {s.locationName ? ` · ${s.locationName}` : ""}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <Label className="mb-1.5 block">{t("decideReason")}</Label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            {current?.unplannedDecidedAt && (
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                {t("decided", {
                  date: new Date(current.unplannedDecidedAt).toLocaleString(
                    "de-DE",
                  ),
                })}
              </p>
            )}
          </div>
        </>
      )}

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button
          variant="destructive"
          disabled={saving}
          onClick={() => decide("ABGELEHNT")}
        >
          <CircleXIcon className="h-4 w-4" />
          {t("reject")}
        </Button>
        <Button disabled={saving} onClick={() => decide("GENEHMIGT")}>
          <CheckCircleIcon className="h-4 w-4" />
          {t("approve")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
