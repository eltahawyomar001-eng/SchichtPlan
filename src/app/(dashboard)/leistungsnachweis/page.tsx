"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdaptiveModal } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import {
  FileCheckIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  EyeIcon,
} from "@/components/icons";
import {
  ServiceExecutionView,
  type ServiceVisitExec,
} from "@/components/service-execution/service-execution-view";
import type { SessionUser } from "@/lib/types";
import type { Role } from "@/lib/authorization";

// ─── Types ─────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface VisitSignature {
  id: string;
  signerName: string;
  signerRole: string | null;
  signatureData: string;
  signedAt: string;
  signatureHash: string;
}

interface ServiceVisit {
  id: string;
  status: "GEPLANT" | "EINGECHECKT" | "ABGESCHLOSSEN" | "STORNIERT";
  scheduledDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  notes: string | null;
  employee: Employee;
  location: Location;
  signature: VisitSignature | null;
}

// ─── Status helpers ────────────────────────────────────────────

const statusColors: Record<ServiceVisit["status"], string> = {
  GEPLANT: "bg-blue-100 text-blue-700",
  EINGECHECKT: "bg-amber-100 text-amber-700",
  ABGESCHLOSSEN: "bg-emerald-100 text-emerald-700",
  STORNIERT: "bg-gray-100 text-gray-500",
};

const statusI18nKey: Record<ServiceVisit["status"], string> = {
  GEPLANT: "status.planned",
  EINGECHECKT: "status.checkedIn",
  ABGESCHLOSSEN: "status.completed",
  STORNIERT: "status.cancelled",
};

// ─── Component ─────────────────────────────────────────────────

export default function LeistungsnachweisSeite() {
  const { data: session } = useSession();
  const t = useTranslations("serviceProof");
  const tc = useTranslations("common");
  const user = session?.user as SessionUser | undefined;
  const isManagement = ["OWNER", "ADMIN", "MANAGER"].includes(
    (user?.role as Role) ?? "",
  );

  // State
  const [visits, setVisits] = useState<ServiceVisit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    scheduledDate: new Date().toISOString().split("T")[0],
    employeeId: "",
    locationId: "",
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Check-in/out
  const [acting, setActing] = useState<string | null>(null);

  // Execution view
  const [executingVisit, setExecutingVisit] = useState<ServiceVisit | null>(
    null,
  );

  // ────────── Fetching ──────────

  const fetchVisits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/service-visits?${params}`);
      const data = await res.json();
      setVisits(data.data ?? []);
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  // Load employees + locations for create form
  useEffect(() => {
    if (!isManagement) return;
    Promise.all([
      fetch("/api/employees?limit=500").then((r) => r.json()),
      fetch("/api/locations?limit=500").then((r) => r.json()),
    ]).then(([empRes, locRes]) => {
      setEmployees(empRes.data ?? []);
      setLocations(locRes.data ?? []);
    });
  }, [isManagement]);

  // ────────── Actions ──────────

  const handleCreate = async () => {
    setFormError(null);
    if (!createForm.employeeId || !createForm.locationId) {
      setFormError(t("errors.requiredFields"));
      return;
    }
    try {
      const res = await fetch("/api/service-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || t("errors.genericError"));
        return;
      }
      setShowCreate(false);
      setCreateForm({
        scheduledDate: new Date().toISOString().split("T")[0],
        employeeId: "",
        locationId: "",
        notes: "",
      });
      fetchVisits();
    } catch {
      setFormError(t("errors.networkError"));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCheckIn = async (visitId: string) => {
    setActing(visitId);
    try {
      const res = await fetch(`/api/service-visits/${visitId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || t("errors.checkInFailed"));
      }
      fetchVisits();
    } catch {
      setError(t("errors.checkInNetworkError"));
    } finally {
      setActing(null);
    }
  };

  const handleCheckOut = async (visitId: string) => {
    setActing(visitId);
    try {
      const res = await fetch(`/api/service-visits/${visitId}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || t("errors.checkOutFailed"));
      }
      fetchVisits();
    } catch {
      setError(t("errors.checkOutNetworkError"));
    } finally {
      setActing(null);
    }
  };

  // ────────── Filtering ──────────

  const filtered = visits.filter((v) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        v.employee.firstName.toLowerCase().includes(q) ||
        v.employee.lastName.toLowerCase().includes(q) ||
        v.location.name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // ────────── Stats ──────────

  const stats = {
    total: visits.length,
    planned: visits.filter((v) => v.status === "GEPLANT").length,
    checkedIn: visits.filter((v) => v.status === "EINGECHECKT").length,
    completed: visits.filter((v) => v.status === "ABGESCHLOSSEN").length,
  };

  // ────────── Render ──────────

  // Show execution view when a visit is selected for field execution
  if (executingVisit) {
    return (
      <ServiceExecutionView
        visit={executingVisit as ServiceVisitExec}
        onComplete={() => {
          setExecutingVisit(null);
          fetchVisits();
        }}
        onBack={() => {
          setExecutingVisit(null);
          fetchVisits();
        }}
      />
    );
  }

  return (
    <>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          isManagement ? (
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              className="hidden sm:inline-flex"
            >
              <PlusIcon className="h-4 w-4" />
              <span>{t("createVisit")}</span>
            </Button>
          ) : undefined
        }
      />

      <PageContent>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button className="ml-2 underline" onClick={() => setError(null)}>
              {tc("close")}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">{t("stats.total")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats.planned}
              </p>
              <p className="text-xs text-gray-500">{t("stats.planned")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">
                {stats.checkedIn}
              </p>
              <p className="text-xs text-gray-500">{t("stats.checkedIn")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {stats.completed}
              </p>
              <p className="text-xs text-gray-500">{t("stats.completed")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t("allStatuses")}</option>
            <option value="GEPLANT">{t("status.planned")}</option>
            <option value="EINGECHECKT">{t("status.checkedIn")}</option>
            <option value="ABGESCHLOSSEN">{t("status.completed")}</option>
            <option value="STORNIERT">{t("status.cancelled")}</option>
          </Select>
        </div>

        {/* Visit list */}
        {loading ? (
          <div className="py-12 text-center text-gray-400">{tc("loading")}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileCheckIcon className="h-8 w-8 text-emerald-500" />}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                acting={acting === visit.id}
                onCheckOut={() => handleCheckOut(visit.id)}
                onExecute={() => setExecutingVisit(visit)}
              />
            ))}
          </div>
        )}
      </PageContent>

      {/* Create visit modal */}
      <AdaptiveModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("createVisit")}
        size="md"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="flex-1 !h-14 md:!h-10 md:flex-none"
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 !h-14 md:!h-10 md:flex-none font-bold"
            >
              {tc("create")}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 px-4 py-4">
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}
          <div>
            <Label className="text-sm font-medium text-gray-700">
              {t("form.date")}
            </Label>
            <Input
              type="date"
              value={createForm.scheduledDate}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  scheduledDate: e.target.value,
                }))
              }
              className="mt-1.5 !h-14 !text-base !px-4 md:!h-10 md:!text-sm md:!px-3.5"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">
              {t("form.employee")}
            </Label>
            <Select
              value={createForm.employeeId}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, employeeId: e.target.value }))
              }
              className="mt-1.5 !h-14 !text-base !px-4 md:!h-10 md:!text-sm md:!px-3.5"
            >
              <option value="">{t("form.selectEmployee")}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">
              {t("form.location")}
            </Label>
            <Select
              value={createForm.locationId}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, locationId: e.target.value }))
              }
              className="mt-1.5 !h-14 !text-base !px-4 md:!h-10 md:!text-sm md:!px-3.5"
            >
              <option value="">{t("form.selectLocation")}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-700">
              {t("form.notes")}
            </Label>
            <Input
              value={createForm.notes}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder={t("form.notesPlaceholder")}
              className="mt-1.5 !h-14 !text-base !px-4 md:!h-10 md:!text-sm md:!px-3.5"
            />
          </div>
        </div>
      </AdaptiveModal>

      {/* ── Mobile FAB — "Plan Visit" ── */}
      {isManagement && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed z-40 sm:hidden right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+1rem)] h-14 w-14 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center active:scale-95 transition-transform"
          aria-label={t("createVisit")}
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      )}
    </>
  );
}

// ─── Visit Card sub-component ──────────────────────────────────

interface VisitCardProps {
  visit: ServiceVisit;
  acting: boolean;
  onCheckOut: () => void;
  onExecute: () => void;
}

function VisitCard({ visit, acting, onCheckOut, onExecute }: VisitCardProps) {
  const t = useTranslations("serviceProof");
  const statusLabel = t(statusI18nKey[visit.status]);
  const statusColor = statusColors[visit.status];

  const dateStr = new Date(visit.scheduledDate).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeStr = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={statusColor}>{statusLabel}</Badge>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {visit.employee.firstName} {visit.employee.lastName}
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPinIcon className="h-3 w-3" />
              {visit.location.name}
              {visit.location.address && ` · ${visit.location.address}`}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <ClockIcon className="h-3 w-3" />
              {dateStr}
              {visit.checkInAt &&
                ` · ${t("checkInAt")} ${timeStr(visit.checkInAt)}`}
              {visit.checkOutAt &&
                ` · ${t("checkOutAt")} ${timeStr(visit.checkOutAt)}`}
            </div>
            {visit.signature && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircleIcon className="h-3 w-3" />
                {t("signedBy")} {visit.signature.signerName}
              </div>
            )}
            {visit.notes && (
              <p className="text-xs text-gray-400 line-clamp-1">
                {visit.notes}
              </p>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex shrink-0 flex-wrap gap-2">
            {visit.status === "ABGESCHLOSSEN" && (
              <Button size="sm" variant="outline" onClick={onExecute}>
                <EyeIcon className="h-3.5 w-3.5 mr-1" />
                {t("actions.viewDetails")}
              </Button>
            )}
            {visit.status === "GEPLANT" && (
              <Button size="sm" onClick={onExecute}>
                <PlayIcon className="h-3.5 w-3.5 mr-1" />
                {t("actions.execute")}
              </Button>
            )}
            {visit.status === "EINGECHECKT" && (
              <Button size="sm" onClick={onExecute}>
                <PlayIcon className="h-3.5 w-3.5 mr-1" />
                {t("actions.continue")}
              </Button>
            )}
            {visit.status === "EINGECHECKT" && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCheckOut}
                disabled={acting}
              >
                {t("actions.checkOut")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
