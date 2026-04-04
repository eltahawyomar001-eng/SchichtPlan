"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import { PlusIcon, TrashIcon, EditIcon, SearchIcon } from "@/components/icons";

interface Skill {
  id: string;
  name: string;
  category: string | null;
  _count: { employeeSkills: number };
}

const INITIAL_FORM = { name: "", category: "" };

export default function QualifikationenSeite() {
  const t = useTranslations("skills");
  const tc = useTranslations("common");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchSkills = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const d = await res.json();
        setSkills(d.data ?? d);
      } else setError(tc("errorLoading"));
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  function openCreate() {
    setEditId(null);
    setForm(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(skill: Skill) {
    setEditId(skill.id);
    setForm({ name: skill.name, category: skill.category || "" });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const url = editId ? `/api/skills/${editId}` : "/api/skills";
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
        fetchSkills();
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
      const res = await fetch(`/api/skills/${deleteTarget}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchSkills();
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

  // Group by category
  const filtered = skills.filter((s) =>
    `${s.name} ${s.category || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const grouped = filtered.reduce(
    (acc, skill) => {
      const cat = skill.category || t("general");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    },
    {} as Record<string, Skill[]>,
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
        {skills.length > 0 && (
          <div className="relative max-w-full sm:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={tc("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-10"
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
          title={editId ? t("editSkill") : t("add")}
          size="md"
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

            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Input
                placeholder={t("categoryPlaceholder")}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
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

        {/* Skill list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-12">
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
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {category}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((skill) => (
                    <Card key={skill.id} className="card-elevated">
                      <CardContent className="flex items-center justify-between gap-2 p-4 sm:p-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {skill.name}
                          </p>
                          <Badge className="mt-1 bg-gray-100 text-gray-600 text-xs">
                            {skill._count.employeeSkills} {t("assigned")}
                          </Badge>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(skill)}
                          >
                            <EditIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => setDeleteTarget(skill.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
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
