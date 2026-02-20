"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { HandRaisedIcon, CheckCircleIcon, XIcon } from "@/components/icons";
import type { SessionUser } from "@/lib/types";
import { isManagement } from "@/lib/authorization";

// ─── Types ──────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

interface Availability {
  id: string;
  weekday: number;
  startTime: string | null;
  endTime: string | null;
  type: string;
  notes: string | null;
  employee: Employee;
}

// ─── Constants ──────────────────────────────────────────────────

const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6];

const TYPE_KEYS = [
  { value: "VERFUEGBAR", color: "bg-green-100 text-green-700" },
  { value: "BEVORZUGT", color: "bg-blue-100 text-blue-700" },
  { value: "NICHT_VERFUEGBAR", color: "bg-red-100 text-red-700" },
];

// ─── Weekly entry type for the form ─────────────────────────────

interface WeekdayEntry {
  weekday: number;
  type: string;
  startTime: string;
  endTime: string;
  notes: string;
}

// ─── Component ──────────────────────────────────────────────────

export default function VerfuegbarkeitenPage() {
  const t = useTranslations("availability");
  const tc = useTranslations("common");
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const canManage = user ? isManagement(user) : false;
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const defaultEntries = (): WeekdayEntry[] =>
    WEEKDAY_KEYS.map((i) => ({
      weekday: i,
      type: i < 5 ? "VERFUEGBAR" : "NICHT_VERFUEGBAR",
      startTime: "08:00",
      endTime: "18:00",
      notes: "",
    }));

  const [formEmployee, setFormEmployee] = useState("");
  const [formEntries, setFormEntries] =
    useState<WeekdayEntry[]>(defaultEntries());

  // ── Fetch ───────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedEmployee) params.set("employeeId", selectedEmployee);
      const [avRes, empRes] = await Promise.all([
        fetch(`/api/availability?${params}`),
        fetch("/api/employees"),
      ]);
      if (avRes.ok) setAvailabilities(await avRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Group availabilities by employee ────────────────────────

  const grouped = availabilities.reduce(
    (acc, av) => {
      const key = av.employee.id;
      if (!acc[key]) {
        acc[key] = { employee: av.employee, entries: [] };
      }
      acc[key].entries.push(av);
      return acc;
    },
    {} as Record<string, { employee: Employee; entries: Availability[] }>,
  );

  // ── Submit ──────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formEmployee) return;

    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: formEmployee,
          entries: formEntries,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormEntries(defaultEntries());
        setFormEmployee("");
        fetchData();
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }

  function updateEntry(
    index: number,
    field: keyof WeekdayEntry,
    value: string,
  ) {
    setFormEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function getTypeInfo(type: string) {
    return TYPE_KEYS.find((tk) => tk.value === type) || TYPE_KEYS[0];
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            onClick={() => {
              if (!canManage && user?.employeeId) {
                setFormEmployee(user.employeeId);
              }
              setShowForm(true);
            }}
          >
            <HandRaisedIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{t("addAvailability")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Employee filter (management only) */}
        {canManage && (
          <div className="max-w-xs">
            <Select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">{tc("allEmployees")}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Availability cards per employee */}
        {loading ? (
          <p className="text-sm text-gray-500">{tc("loading")}</p>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <HandRaisedIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("noEntries")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.values(grouped).map(({ employee, entries }) => (
              <Card key={employee.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: employee.color || "#7C3AED" }}
                    >
                      {employee.firstName.charAt(0)}
                      {employee.lastName.charAt(0)}
                    </div>
                    <CardTitle className="text-sm sm:text-base">
                      {employee.firstName} {employee.lastName}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {WEEKDAY_KEYS.map((i) => {
                      const entry = entries.find((e) => e.weekday === i);
                      const typeInfo = entry
                        ? getTypeInfo(entry.type)
                        : { value: "", color: "bg-gray-50 text-gray-400" };
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="text-sm font-medium text-gray-700 w-24 shrink-0">
                            {t(`weekdays.${i}`)}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            {entry?.startTime && entry?.endTime && (
                              <span className="text-xs text-gray-500 hidden sm:inline">
                                {entry.startTime} – {entry.endTime}
                              </span>
                            )}
                            <Badge
                              className={`${typeInfo.color} text-xs shrink-0`}
                            >
                              {entry ? t(`types.${entry.type}`) : "—"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Availability Form Modal ────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-2xl mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0">
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
                {canManage ? (
                  <div>
                    <Label>{t("form.employee")}</Label>
                    <Select
                      value={formEmployee}
                      onChange={(e) => setFormEmployee(e.target.value)}
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
                ) : (
                  <input type="hidden" value={formEmployee} />
                )}

                {/* Weekday grid */}
                <div className="space-y-3">
                  {formEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-gray-50"
                    >
                      <span className="text-sm font-medium text-gray-700 w-20 shrink-0">
                        <span className="hidden sm:inline">
                          {t(`weekdays.${i}`)}
                        </span>
                        <span className="sm:hidden">
                          {t(`weekdaysShort.${i}`)}
                        </span>
                      </span>
                      <Select
                        value={entry.type}
                        onChange={(e) => updateEntry(i, "type", e.target.value)}
                        className="text-xs sm:text-sm flex-1"
                      >
                        {TYPE_KEYS.map((tk) => (
                          <option key={tk.value} value={tk.value}>
                            {t(`types.${tk.value}`)}
                          </option>
                        ))}
                      </Select>
                      {entry.type !== "NICHT_VERFUEGBAR" && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={entry.startTime}
                            onChange={(e) =>
                              updateEntry(i, "startTime", e.target.value)
                            }
                            className="w-[100px] text-xs"
                          />
                          <span className="text-xs text-gray-400">–</span>
                          <Input
                            type="time"
                            value={entry.endTime}
                            onChange={(e) =>
                              updateEntry(i, "endTime", e.target.value)
                            }
                            className="w-[100px] text-xs"
                          />
                        </div>
                      )}
                    </div>
                  ))}
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
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    {tc("save")}
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
