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
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import { PlusIcon, TrashIcon, EditIcon, SearchIcon } from "@/components/icons";

interface Department {
  id: string;
  name: string;
  color: string | null;
  location: { id: string; name: string } | null;
  _count: { employees: number };
}

interface Location {
  id: string;
  name: string;
}

const INITIAL_FORM = { name: "", color: "#10b981", locationId: "" };

export default function AbteilungenSeite() {
  const t = useTranslations("departments");
  const tc = useTranslations("common");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [dRes, lRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/locations"),
      ]);
      if (dRes.ok) {
        const d = await dRes.json();
        setDepartments(d.data ?? d);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(dept: Department) {
    setEditId(dept.id);
    setForm({
      name: dept.name,
      color: dept.color || "#10b981",
      locationId: dept.location?.id || "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const url = editId ? `/api/departments/${editId}` : "/api/departments";
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
        const data = await res.json();
        setFormError(data.error || tc("errorOccurred"));
      }
    } catch {
      setFormError(tc("errorOccurred"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/departments/${deleteTarget}`, {
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

  const filtered = departments.filter((d) =>
    `${d.name} ${d.location?.name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

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
        {/* Search */}
        {departments.length > 0 && (
          <div className="relative max-w-full sm:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={tc("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Create/Edit Modal */}
        <AdaptiveModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editId ? t("edit") : t("add")}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("name")} *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

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
                <option value="">— {t("noLocation")} —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
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
        </AdaptiveModal>

        {/* Department list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg font-medium text-gray-900">
                {search ? tc("noResults") : t("empty")}
              </p>
              {!search && (
                <Button className="mt-4" onClick={openCreate}>
                  <PlusIcon className="h-4 w-4" />
                  {t("add")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((dept) => (
              <Card key={dept.id} className="card-elevated">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="h-4 w-4 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: dept.color || "#10b981",
                        }}
                      />
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {dept.name}
                      </h3>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(dept)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(dept.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    {dept.location && (
                      <p className="text-xs text-gray-500 truncate">
                        📍 {dept.location.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      👥 {dept._count.employees} {t("employees")}
                    </p>
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
