"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  SwapIcon,
  PlusIcon,
  XIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from "@/components/icons";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

interface ShiftInfo {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: { name: string } | null;
}

interface SwapRequest {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  shift: ShiftInfo;
  targetShift: ShiftInfo | null;
  requester: Employee;
  target: Employee | null;
  reviewNote: string | null;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_VARIANTS: Record<
  string,
  "default" | "success" | "destructive" | "warning" | "outline"
> = {
  ANGEFRAGT: "warning",
  ANGENOMMEN: "default",
  GENEHMIGT: "success",
  ABGELEHNT: "destructive",
  STORNIERT: "outline",
  ABGESCHLOSSEN: "success",
};

const STATUS_KEYS: Record<string, string> = {
  ANGEFRAGT: "statuses.ANGEFRAGT",
  ANGENOMMEN: "statuses.ANGENOMMEN",
  GENEHMIGT: "statuses.GENEHMIGT",
  ABGELEHNT: "statuses.ABGELEHNT",
  STORNIERT: "statuses.STORNIERT",
  ABGESCHLOSSEN: "statuses.ABGESCHLOSSEN",
};

// ─── Component ──────────────────────────────────────────────────

export default function SchichttauschPage() {
  const t = useTranslations("shiftSwap");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "de" ? de : enUS;
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftInfo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  const [formData, setFormData] = useState({
    requesterId: "",
    shiftId: "",
    targetId: "",
    targetShiftId: "",
    reason: "",
  });

  // ── Fetch ───────────────────────────────────────────────────

  const fetchSwaps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/shift-swaps?${params}`);
      if (res.ok) setSwaps(await res.json());
    } catch (err) {
      console.error("Fehler:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchMeta = useCallback(async () => {
    try {
      const [empRes, shiftRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/shifts"),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (shiftRes.ok) setShifts(await shiftRes.json());
    } catch (err) {
      console.error("Fehler:", err);
    }
  }, []);

  useEffect(() => {
    fetchSwaps();
    fetchMeta();
  }, [fetchSwaps, fetchMeta]);

  // ── Handlers ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/shift-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: formData.shiftId,
          requesterId: formData.requesterId,
          targetId: formData.targetId || undefined,
          targetShiftId: formData.targetShiftId || undefined,
          reason: formData.reason || undefined,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          requesterId: "",
          shiftId: "",
          targetId: "",
          targetShiftId: "",
          reason: "",
        });
        fetchSwaps();
      }
    } catch (err) {
      console.error("Fehler:", err);
    }
  }

  async function handleAction(
    id: string,
    status: string,
    extra?: Record<string, string>,
  ) {
    try {
      await fetch(`/api/shift-swaps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      fetchSwaps();
    } catch (err) {
      console.error("Fehler:", err);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  function formatShift(shift: ShiftInfo) {
    const d = format(new Date(shift.date), "dd.MM.", { locale: dateFnsLocale });
    return `${d} ${shift.startTime}–${shift.endTime}`;
  }

  // ── Summary ─────────────────────────────────────────────────

  const openSwaps = swaps.filter((s) =>
    ["ANGEFRAGT", "ANGENOMMEN"].includes(s.status),
  ).length;
  const completedSwaps = swaps.filter(
    (s) => s.status === "ABGESCHLOSSEN",
  ).length;

  // ── Shifts for selected requester ───────────────────────────

  const requesterShifts = shifts.filter(
    (s) =>
      formData.requesterId &&
      (s as ShiftInfo & { employee?: Employee })?.id &&
      true,
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t("newRequest")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2">
                  <SwapIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {openSwaps}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {t("openRequests")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {completedSwaps}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {t("completed")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "ANGEFRAGT", "ANGENOMMEN", "GENEHMIGT", "ABGESCHLOSSEN"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-violet-100 text-violet-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? tc("all") : t(STATUS_KEYS[s]) || s}
              </button>
            ),
          )}
        </div>

        {/* Swap list */}
        <Card>
          <CardHeader>
            <CardTitle>{t("requests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">{tc("loading")}</p>
            ) : swaps.length === 0 ? (
              <div className="text-center py-10">
                <SwapIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">{t("noRequests")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {swaps.map((swap) => {
                  return (
                    <div
                      key={swap.id}
                      className="rounded-lg border border-gray-100 p-3 sm:p-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Swap visualization */}
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
                          {/* Requester */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                              style={{
                                backgroundColor:
                                  swap.requester.color || "#7C3AED",
                              }}
                            >
                              {swap.requester.firstName.charAt(0)}
                              {swap.requester.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {swap.requester.firstName}{" "}
                                {swap.requester.lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatShift(swap.shift)}
                              </p>
                            </div>
                          </div>

                          <ArrowRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />

                          {/* Target */}
                          {swap.target ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    swap.target.color || "#3B82F6",
                                }}
                              >
                                {swap.target.firstName.charAt(0)}
                                {swap.target.lastName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {swap.target.firstName} {swap.target.lastName}
                                </p>
                                {swap.targetShift && (
                                  <p className="text-xs text-gray-500">
                                    {formatShift(swap.targetShift)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              {t("open")}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant={STATUS_VARIANTS[swap.status] || "outline"}
                          >
                            {t(STATUS_KEYS[swap.status]) || swap.status}
                          </Badge>
                        </div>
                      </div>

                      {swap.reason && (
                        <p className="mt-2 text-xs text-gray-400 line-clamp-1">
                          {swap.reason}
                        </p>
                      )}

                      {/* Manager actions */}
                      {swap.status === "ANGENOMMEN" && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                          <Button
                            size="sm"
                            onClick={() => handleAction(swap.id, "GENEHMIGT")}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircleIcon className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">
                              {t("approve")}
                            </span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(swap.id, "ABGELEHNT")}
                          >
                            <XIcon className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">
                              {t("reject")}
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── New Swap Request Modal ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("form.title")}</CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 hover:bg-gray-100"
                >
                  <XIcon className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t("form.requester")}</Label>
                  <Select
                    value={formData.requesterId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requesterId: e.target.value,
                        shiftId: "",
                      })
                    }
                    required
                  >
                    <option value="">{tc("selectPlaceholder")}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>{t("form.shift")}</Label>
                  <Select
                    value={formData.shiftId}
                    onChange={(e) =>
                      setFormData({ ...formData, shiftId: e.target.value })
                    }
                    required
                  >
                    <option value="">{tc("selectPlaceholder")}</option>
                    {shifts
                      .filter(
                        (s) =>
                          !formData.requesterId ||
                          (s as ShiftInfo & { employeeId?: string }).id,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatShift(s)}
                          {s.location ? ` · ${s.location.name}` : ""}
                        </option>
                      ))}
                  </Select>
                </div>

                <div>
                  <Label>{t("form.target")}</Label>
                  <Select
                    value={formData.targetId}
                    onChange={(e) =>
                      setFormData({ ...formData, targetId: e.target.value })
                    }
                  >
                    <option value="">{t("form.targetOpen")}</option>
                    {employees
                      .filter((emp) => emp.id !== formData.requesterId)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                  </Select>
                </div>

                <div>
                  <Label>{t("form.reason")}</Label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 min-h-[80px] resize-none"
                    placeholder={t("form.reasonPlaceholder")}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button type="submit">
                    <SwapIcon className="h-4 w-4 mr-2" />
                    {t("form.submit")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
