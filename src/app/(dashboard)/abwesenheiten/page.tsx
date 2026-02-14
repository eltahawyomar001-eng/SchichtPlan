"use client";

import { useState, useEffect, useCallback } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  PlusIcon,
  XIcon,
  CheckCircleIcon,
  CalendarOffIcon,
} from "@/components/icons";
import { format } from "date-fns";
import { de } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

interface AbsenceRequest {
  id: string;
  category: string;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  totalDays: number;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  employee: Employee;
}

// ─── Constants ──────────────────────────────────────────────────

const CATEGORIES = [
  { value: "URLAUB", label: "Urlaub", color: "bg-blue-100 text-blue-700" },
  { value: "KRANK", label: "Krank", color: "bg-red-100 text-red-700" },
  {
    value: "ELTERNZEIT",
    label: "Elternzeit",
    color: "bg-pink-100 text-pink-700",
  },
  {
    value: "SONDERURLAUB",
    label: "Sonderurlaub",
    color: "bg-purple-100 text-purple-700",
  },
  {
    value: "UNBEZAHLT",
    label: "Unbezahlt",
    color: "bg-gray-100 text-gray-700",
  },
  {
    value: "FORTBILDUNG",
    label: "Fortbildung",
    color: "bg-teal-100 text-teal-700",
  },
  {
    value: "SONSTIGES",
    label: "Sonstiges",
    color: "bg-amber-100 text-amber-700",
  },
];

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "success" | "destructive" | "warning" | "outline";
  }
> = {
  AUSSTEHEND: { label: "Ausstehend", variant: "warning" },
  GENEHMIGT: { label: "Genehmigt", variant: "success" },
  ABGELEHNT: { label: "Abgelehnt", variant: "destructive" },
  STORNIERT: { label: "Storniert", variant: "outline" },
};

// ─── Component ──────────────────────────────────────────────────

export default function AbwesenheitenPage() {
  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  const [formData, setFormData] = useState({
    employeeId: "",
    category: "URLAUB",
    startDate: "",
    endDate: "",
    halfDayStart: false,
    halfDayEnd: false,
    reason: "",
  });

  // ── Fetch data ──────────────────────────────────────────────

  const fetchAbsences = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/absences?${params}`);
      if (res.ok) setAbsences(await res.json());
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (res.ok) setEmployees(await res.json());
    } catch (err) {
      console.error("Fehler:", err);
    }
  }, []);

  useEffect(() => {
    fetchAbsences();
    fetchEmployees();
  }, [fetchAbsences, fetchEmployees]);

  // ── Handlers ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          employeeId: "",
          category: "URLAUB",
          startDate: "",
          endDate: "",
          halfDayStart: false,
          halfDayEnd: false,
          reason: "",
        });
        fetchAbsences();
      }
    } catch (err) {
      console.error("Fehler:", err);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await fetch(`/api/absences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchAbsences();
    } catch (err) {
      console.error("Fehler:", err);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────

  function getCategoryInfo(cat: string) {
    return CATEGORIES.find((c) => c.value === cat) || CATEGORIES[6];
  }

  function formatDateRange(start: string, end: string) {
    const s = format(new Date(start), "dd. MMM", { locale: de });
    const e = format(new Date(end), "dd. MMM yyyy", { locale: de });
    return `${s} – ${e}`;
  }

  // ── Summary stats ───────────────────────────────────────────

  const pending = absences.filter((a) => a.status === "AUSSTEHEND").length;
  const approved = absences.filter((a) => a.status === "GENEHMIGT").length;
  const totalDays = absences
    .filter((a) => a.status === "GENEHMIGT")
    .reduce((sum, a) => sum + a.totalDays, 0);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title="Abwesenheiten"
        description="Urlaub, Krankmeldungen & Abwesenheitsanträge verwalten"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Neuer Antrag</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2">
                  <CalendarOffIcon className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {pending}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    Ausstehend
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
                    {approved}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    Genehmigt
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2">
                  <CalendarOffIcon className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {totalDays}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    Tage gesamt
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "AUSSTEHEND", "GENEHMIGT", "ABGELEHNT"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                filterStatus === s
                  ? "bg-violet-100 text-violet-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "Alle" : STATUS_MAP[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Absence list */}
        <Card>
          <CardHeader>
            <CardTitle>Abwesenheitsanträge</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Laden…</p>
            ) : absences.length === 0 ? (
              <div className="text-center py-10">
                <CalendarOffIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  Keine Abwesenheitsanträge vorhanden.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {absences.map((absence) => {
                  const cat = getCategoryInfo(absence.category);
                  const statusInfo = STATUS_MAP[absence.status];
                  return (
                    <div
                      key={absence.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 sm:p-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{
                            backgroundColor:
                              absence.employee.color || "#7C3AED",
                          }}
                        >
                          {absence.employee.firstName.charAt(0)}
                          {absence.employee.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {absence.employee.firstName}{" "}
                            {absence.employee.lastName}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {formatDateRange(
                              absence.startDate,
                              absence.endDate,
                            )}
                            <span className="text-gray-400"> · </span>
                            {absence.totalDays}{" "}
                            {absence.totalDays === 1 ? "Tag" : "Tage"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cat.color}`}
                            >
                              {cat.label}
                            </span>
                            <Badge variant={statusInfo?.variant || "outline"}>
                              {statusInfo?.label || absence.status}
                            </Badge>
                          </div>
                          {absence.reason && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                              {absence.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {absence.status === "AUSSTEHEND" && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleStatusChange(absence.id, "GENEHMIGT")
                            }
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircleIcon className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Genehmigen</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleStatusChange(absence.id, "ABGELEHNT")
                            }
                          >
                            <XIcon className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Ablehnen</span>
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

      {/* ── New Absence Request Modal ──────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-lg mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Neuer Abwesenheitsantrag</CardTitle>
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
                  <Label>Mitarbeiter</Label>
                  <Select
                    value={formData.employeeId}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeId: e.target.value })
                    }
                    required
                  >
                    <option value="">Bitte wählen…</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Kategorie</Label>
                  <Select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Startdatum</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      required
                    />
                    <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={formData.halfDayStart}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            halfDayStart: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      Halber Tag
                    </label>
                  </div>
                  <div>
                    <Label>Enddatum</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      required
                    />
                    <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={formData.halfDayEnd}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            halfDayEnd: e.target.checked,
                          })
                        }
                        className="rounded"
                      />
                      Halber Tag
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Bemerkung (optional)</Label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 min-h-[80px] resize-none"
                    placeholder="Grund oder Hinweise…"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit">Antrag einreichen</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
