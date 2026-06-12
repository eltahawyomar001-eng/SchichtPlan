"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertTriangleIcon,
  CheckIcon,
  EditIcon,
  SparklesIcon,
  UserIcon,
} from "@/components/icons";
import {
  isLowConfidence,
  type StagedEntry,
  type WorkspaceEmployeeOption,
} from "./types";

interface TimesheetReviewProps {
  importId: string;
  initialEntries: StagedEntry[];
  workspaceEmployees: WorkspaceEmployeeOption[];
  /** "Edit" — return to the upload/input state. */
  onEdit: () => void;
  /** Called after a successful confirm with the count of staged shifts. */
  onConfirmed: (materializedShifts: number) => void;
}

type FieldKey = "date" | "shiftStart" | "shiftEnd";
const ackKey = (entryId: string, field: string) => `${entryId}:${field}`;

interface RowState extends StagedEntry {
  /** Manager's chosen employee ("" = unassigned → skipped on confirm). */
  assignedEmployeeId: string;
}

/**
 * Mandatory Review & Edit confirmation screen. The manager assigns the right
 * employee per row (pre-filled with the auto-match or a fuzzy suggestion),
 * resolves low-confidence fields, and confirms. Rows left unassigned are
 * skipped rather than imported under the wrong person.
 */
export function TimesheetReview({
  importId,
  initialEntries,
  workspaceEmployees,
  onEdit,
  onConfirmed,
}: TimesheetReviewProps) {
  const t = useTranslations("timesheetImport.review");
  const [rows, setRows] = useState<RowState[]>(() =>
    initialEntries.map((e) => ({
      ...e,
      assignedEmployeeId: e.employeeId ?? e.suggestedEmployeeId ?? "",
    })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flagged = useMemo(() => {
    const set = new Set<string>();
    for (const e of rows) {
      (["date", "shiftStart", "shiftEnd"] as FieldKey[]).forEach((f) => {
        if (isLowConfidence(e.confidenceScores[f])) set.add(ackKey(e.id, f));
      });
    }
    return set;
  }, [rows]);

  const [acked, setAcked] = useState<Set<string>>(new Set());
  const unresolved = [...flagged].filter((k) => !acked.has(k));
  const assignedCount = rows.filter((r) => r.assignedEmployeeId).length;
  const canConfirm =
    unresolved.length === 0 && assignedCount > 0 && !submitting;

  function updateField(id: string, field: FieldKey, value: string) {
    setRows((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
    setAcked((prev) => new Set(prev).add(ackKey(id, field)));
  }

  function assign(id: string, employeeId: string) {
    setRows((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, assignedEmployeeId: employeeId } : e,
      ),
    );
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/timesheet/import/${importId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only assigned rows are submitted — unassigned ones are skipped.
          entries: rows
            .filter((e) => e.assignedEmployeeId)
            .map((e) => ({
              id: e.id,
              employeeId: e.assignedEmployeeId,
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

  if (rows.length === 0) {
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
        {rows.map((e) => {
          const needsAssign = !e.assignedEmployeeId;
          const isSuggested = !e.employeeId && !!e.suggestedEmployeeId;
          return (
            <Card key={e.id}>
              <CardContent className="space-y-3 p-4">
                {/* Employee assignment */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                    <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                      {t("employee")}
                    </label>
                    {needsAssign && (
                      <span title={t("assignHint")}>
                        <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <Select
                    value={e.assignedEmployeeId}
                    onChange={(ev) => assign(e.id, ev.target.value)}
                    className={
                      needsAssign
                        ? "border-amber-400 ring-2 ring-amber-400/30"
                        : undefined
                    }
                  >
                    <option value="">{t("assignPlaceholder")}</option>
                    {workspaceEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </Select>
                  {/* Context: what was read off the sheet, and any suggestion. */}
                  {e.extractedName && (
                    <p className="text-xs text-gray-400">
                      {t("scanned")}: {e.extractedName}
                      {isSuggested && e.suggestedEmployeeName
                        ? ` · ${t("suggested")}: ${e.suggestedEmployeeName}`
                        : ""}
                    </p>
                  )}
                  {needsAssign && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {t("willSkip")}
                    </p>
                  )}
                </div>

                {/* Shift fields */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ReviewField
                    label={t("date")}
                    type="date"
                    value={e.date}
                    flagged={isLowConfidence(e.confidenceScores.date)}
                    resolved={acked.has(ackKey(e.id, "date"))}
                    warnLabel={t("lowConfidence")}
                    onChange={(v) => updateField(e.id, "date", v)}
                    onAck={() =>
                      setAcked((p) => new Set(p).add(ackKey(e.id, "date")))
                    }
                  />
                  <ReviewField
                    label={t("start")}
                    type="time"
                    value={e.shiftStart}
                    flagged={isLowConfidence(e.confidenceScores.shiftStart)}
                    resolved={acked.has(ackKey(e.id, "shiftStart"))}
                    warnLabel={t("lowConfidence")}
                    onChange={(v) => updateField(e.id, "shiftStart", v)}
                    onAck={() =>
                      setAcked((p) =>
                        new Set(p).add(ackKey(e.id, "shiftStart")),
                      )
                    }
                  />
                  <ReviewField
                    label={t("end")}
                    type="time"
                    value={e.shiftEnd}
                    flagged={isLowConfidence(e.confidenceScores.shiftEnd)}
                    resolved={acked.has(ackKey(e.id, "shiftEnd"))}
                    warnLabel={t("lowConfidence")}
                    onChange={(v) => updateField(e.id, "shiftEnd", v)}
                    onAck={() =>
                      setAcked((p) => new Set(p).add(ackKey(e.id, "shiftEnd")))
                    }
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                      {t("break")}
                    </label>
                    <Input
                      type="number"
                      value={String(e.breakMinutes)}
                      onChange={(ev) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === e.id
                              ? {
                                  ...x,
                                  breakMinutes: Number(ev.target.value) || 0,
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">
          {t("assignedSummary", {
            assigned: assignedCount,
            total: rows.length,
          })}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
