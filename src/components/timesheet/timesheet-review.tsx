"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertTriangleIcon,
  CheckIcon,
  EditIcon,
  SparklesIcon,
} from "@/components/icons";
import { isLowConfidence, type StagedEntry } from "./types";

interface TimesheetReviewProps {
  importId: string;
  initialEntries: StagedEntry[];
  /** "Edit" — return to the upload/input state. */
  onEdit: () => void;
  /** Called after a successful confirm with the count of staged shifts. */
  onConfirmed: (materializedShifts: number) => void;
}

type FieldKey = "date" | "shiftStart" | "shiftEnd";
const ackKey = (entryId: string, field: string) => `${entryId}:${field}`;

/**
 * Mandatory Review & Edit confirmation screen. Renders the extracted rows,
 * highlights low-confidence fields with a custom warning SVG, and forces the
 * manager to acknowledge each flagged field before the final mutation.
 */
export function TimesheetReview({
  importId,
  initialEntries,
  onEdit,
  onConfirmed,
}: TimesheetReviewProps) {
  const t = useTranslations("timesheetImport.review");
  const [entries, setEntries] = useState<StagedEntry[]>(initialEntries);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fields flagged low-confidence that still need manager acknowledgement.
  const flagged = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      (["date", "shiftStart", "shiftEnd"] as FieldKey[]).forEach((f) => {
        if (isLowConfidence(e.confidenceScores[f])) set.add(ackKey(e.id, f));
      });
    }
    return set;
  }, [entries]);

  const [acked, setAcked] = useState<Set<string>>(new Set());
  const unresolved = [...flagged].filter((k) => !acked.has(k));
  const canConfirm =
    unresolved.length === 0 && entries.length > 0 && !submitting;

  function updateField(id: string, field: FieldKey, value: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
    // Editing a flagged field counts as resolving it.
    setAcked((prev) => new Set(prev).add(ackKey(id, field)));
  }

  function acknowledge(id: string, field: string) {
    setAcked((prev) => new Set(prev).add(ackKey(id, field)));
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/timesheet/import/${importId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: entries.map((e) => ({
            id: e.id,
            date: e.date,
            shiftStart: e.shiftStart,
            shiftEnd: e.shiftEnd,
            breakMinutes: e.breakMinutes,
          })),
        }),
      });
      if (!res.ok) throw new Error("approve_failed");
      const data = (await res.json()) as { materializedShifts: number };
      onConfirmed(data.materializedShifts);
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <EmptyState
            icon={<SparklesIcon className="h-6 w-6" />}
            title={t("noEntries")}
            description=""
          />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={onEdit}>
              <EditIcon className="h-4 w-4" />
              {t("edit")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      {unresolved.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          {t("resolveHint")}
        </div>
      )}

      <div className="space-y-3">
        {entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-zinc-100">
                  {e.employeeName}
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(e.confidence * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ReviewField
                  label={t("date")}
                  type="date"
                  value={e.date}
                  flagged={isLowConfidence(e.confidenceScores.date)}
                  resolved={acked.has(ackKey(e.id, "date"))}
                  warnLabel={t("lowConfidence")}
                  onChange={(v) => updateField(e.id, "date", v)}
                  onAck={() => acknowledge(e.id, "date")}
                />
                <ReviewField
                  label={t("start")}
                  type="time"
                  value={e.shiftStart}
                  flagged={isLowConfidence(e.confidenceScores.shiftStart)}
                  resolved={acked.has(ackKey(e.id, "shiftStart"))}
                  warnLabel={t("lowConfidence")}
                  onChange={(v) => updateField(e.id, "shiftStart", v)}
                  onAck={() => acknowledge(e.id, "shiftStart")}
                />
                <ReviewField
                  label={t("end")}
                  type="time"
                  value={e.shiftEnd}
                  flagged={isLowConfidence(e.confidenceScores.shiftEnd)}
                  resolved={acked.has(ackKey(e.id, "shiftEnd"))}
                  warnLabel={t("lowConfidence")}
                  onChange={(v) => updateField(e.id, "shiftEnd", v)}
                  onAck={() => acknowledge(e.id, "shiftEnd")}
                />
                <ReviewField
                  label={t("break")}
                  type="number"
                  value={String(e.breakMinutes)}
                  flagged={false}
                  resolved
                  warnLabel={t("lowConfidence")}
                  onChange={(v) =>
                    setEntries((prev) =>
                      prev.map((x) =>
                        x.id === e.id
                          ? { ...x, breakMinutes: Number(v) || 0 }
                          : x,
                      ),
                    )
                  }
                  onAck={() => {}}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onEdit} disabled={submitting}>
          <EditIcon className="h-4 w-4" />
          {t("edit")}
        </Button>
        <Button
          variant="default"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          <CheckIcon className="h-4 w-4" />
          {submitting ? t("submitting") : t("confirm")}
        </Button>
      </div>
    </div>
  );
}

interface ReviewFieldProps {
  label: string;
  type: "date" | "time" | "number";
  value: string;
  flagged: boolean;
  resolved: boolean;
  warnLabel: string;
  onChange: (v: string) => void;
  onAck: () => void;
}

function ReviewField({
  label,
  type,
  value,
  flagged,
  resolved,
  warnLabel,
  onChange,
  onAck,
}: ReviewFieldProps) {
  const needsAttention = flagged && !resolved;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">
          {label}
        </label>
        {needsAttention && (
          <span title={warnLabel}>
            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
          </span>
        )}
      </div>
      <Input
        type={type}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onBlur={() => flagged && onAck()}
        className={
          needsAttention
            ? "border-amber-400 ring-2 ring-amber-400/30 focus:border-amber-500"
            : undefined
        }
      />
    </div>
  );
}
