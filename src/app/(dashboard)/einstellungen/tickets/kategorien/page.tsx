"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";

interface CategoryDef {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sortOrder: number;
  legacyEnum: string | null;
}

const COLOR_OPTIONS: Array<{ value: string; swatch: string }> = [
  { value: "emerald", swatch: "bg-emerald-500" },
  { value: "sky", swatch: "bg-sky-500" },
  { value: "amber", swatch: "bg-amber-500" },
  { value: "violet", swatch: "bg-violet-500" },
  { value: "pink", swatch: "bg-pink-500" },
  { value: "red", swatch: "bg-red-500" },
  { value: "orange", swatch: "bg-orange-500" },
  { value: "zinc", swatch: "bg-zinc-500" },
];

function swatchFor(color: string | null): string {
  return COLOR_OPTIONS.find((o) => o.value === color)?.swatch ?? "bg-zinc-400";
}

export default function TicketCategoriesAdminPage() {
  const t = useTranslations("ticketCategories");
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("emerald");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ticket-categories", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories);
        setError(null);
      } else {
        setError(data.message || data.error || t("loadError"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/ticket-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setNewColor("emerald");
        await fetchCategories();
      } else {
        setError(data.message || data.error || t("createError"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string, name: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ticket-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || data.error || t("updateError"));
      await fetchCategories();
    } finally {
      setBusyId(null);
    }
  }

  async function handleColor(id: string, color: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/ticket-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || data.error || t("updateError"));
      await fetchCategories();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/ticket-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || data.error || t("deleteError"));
      }
      await fetchCategories();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReorder(id: string, direction: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= categories.length) return;
    const a = categories[idx];
    const b = categories[swapIdx];
    setBusyId(id);
    try {
      await Promise.all([
        fetch(`/api/ticket-categories/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: b.sortOrder }),
        }),
        fetch(`/api/ticket-categories/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: a.sortOrder }),
        }),
      ]);
      await fetchCategories();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Topbar title={t("title")} />
      <PageContent>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  {t("nameLabel")}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={80}
                  placeholder={t("namePlaceholder")}
                  className="h-11 w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900/40 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  {t("colorLabel")}
                </label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewColor(opt.value)}
                      className={`h-7 w-7 rounded-full ${opt.swatch} ${
                        newColor === opt.value
                          ? "ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-zinc-900"
                          : "opacity-60 hover:opacity-100"
                      } transition`}
                      aria-label={opt.value}
                    />
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {creating ? t("creating") : t("createButton")}
              </button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("listTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {t("loading")}
              </p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {t("empty")}
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-zinc-800">
                {categories.map((cat, idx) => (
                  <li key={cat.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`h-3 w-3 rounded-full ${swatchFor(cat.color)}`}
                    />
                    <input
                      defaultValue={cat.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== cat.name) handleRename(cat.id, v);
                      }}
                      disabled={busyId === cat.id}
                      className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-zinc-100 hover:border-gray-300 dark:hover:border-zinc-700 focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="hidden gap-1 md:flex">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleColor(cat.id, opt.value)}
                          disabled={busyId === cat.id}
                          className={`h-5 w-5 rounded-full ${opt.swatch} ${
                            cat.color === opt.value
                              ? "ring-2 ring-offset-1 ring-emerald-500 dark:ring-offset-zinc-900"
                              : "opacity-50 hover:opacity-100"
                          } transition`}
                          aria-label={opt.value}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleReorder(cat.id, -1)}
                        disabled={busyId === cat.id || idx === 0}
                        className="h-8 w-8 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30"
                        aria-label={t("moveUp")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorder(cat.id, 1)}
                        disabled={
                          busyId === cat.id || idx === categories.length - 1
                        }
                        className="h-8 w-8 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30"
                        aria-label={t("moveDown")}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
                        disabled={busyId === cat.id}
                        className="ml-2 inline-flex h-8 items-center rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-50"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-gray-500 dark:text-zinc-400">
              {t("isolationHint")}
            </p>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
