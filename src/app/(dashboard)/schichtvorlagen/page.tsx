"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { PageContent } from "@/components/ui/page-content";
import { PlusIcon, TrashIcon, EditIcon } from "@/components/icons";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
  location: { id: string; name: string } | null;
}

interface Location {
  id: string;
  name: string;
}

const INITIAL_FORM = {
  name: "",
  startTime: "06:00",
  endTime: "14:00",
  color: "#10b981",
  locationId: "",
};

export default function SchichtvorlagenSeite() {
  const t = useTranslations("shiftTemplates");
  const tc = useTranslations("common");
  const { handlePlanLimit } = usePlanLimit();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [tRes, lRes] = await Promise.all([
        fetch("/api/shift-templates"),
        fetch("/api/locations"),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setTemplates(d.data ?? d);
      } else setError(tc("errorLoading"));
      if (lRes.ok) {
        const d = await lRes.json();
        setLocations(d.data ?? d);
      }
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(tmpl: ShiftTemplate) {
    setEditId(tmpl.id);
    setForm({
      name: tmpl.name,
      startTime: tmpl.startTime,
      endTime: tmpl.endTime,
      color: tmpl.color || "#10b981",
      locationId: tmpl.location?.id || "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const url = editId
        ? `/api/shift-templates/${editId}`
        : "/api/shift-templates";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setEditId(null);
        setForm(INITIAL_FORM);
        fetchData();
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) {
          const data = await res.json();
          setFormError(data.error || tc("errorOccurred"));
        }
      }
    } catch {
      setFormError(tc("errorOccurred"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/shift-templates/${deleteTarget}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || tc("errorOccurred"));
        setDeleteTarget(null);
      }
    } catch {
      setError(tc("errorOccurred"));
      setDeleteTarget(null);
    }
  }

  const calcDuration = (start: string, end: string): string => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("add")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />
      <PageContent>
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editId ? t("editTemplate") : t("add")}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("name")} *</Label>
              <Input
                required
                placeholder={t("namePlaceholder")}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("startTime")} *</Label>
                <Input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startTime: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("endTime")} *</Label>
                <Input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endTime: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("color")}</Label>
                <Input
                  type="color"
                  value={form.color}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value }))
                  }
                  className="h-10 cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("location")}</Label>
                <Select
                  value={form.locationId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, locationId: e.target.value }))
                  }
                >
                  <option value="">— {t("allLocations")} —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit">{editId ? tc("save") : t("create")}</Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* Template list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg font-medium text-gray-900">{t("empty")}</p>
              <Button className="mt-4" onClick={openCreate}>
                <PlusIcon className="h-4 w-4" />
                {t("add")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tmpl) => (
              <Card key={tmpl.id} className="card-elevated">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-4 w-4 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: tmpl.color || "#10b981",
                        }}
                      />
                      <h3 className="text-sm font-semibold text-gray-900">
                        {tmpl.name}
                      </h3>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(tmpl)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(tmpl.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-lg font-semibold text-gray-900">
                      {tmpl.startTime} – {tmpl.endTime}
                    </p>
                    <p className="text-xs text-gray-500">
                      ⏱ {calcDuration(tmpl.startTime, tmpl.endTime)}
                    </p>
                    {tmpl.location && (
                      <p className="text-xs text-gray-500">
                        📍 {tmpl.location.name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
