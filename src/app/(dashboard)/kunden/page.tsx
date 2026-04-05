"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageContent } from "@/components/ui/page-content";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  XIcon,
  UsersIcon,
} from "@/components/icons";

// ─── Types ──────────────────────────────────────────────────────

interface ProjectRef {
  id: string;
  name: string;
  status: string;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  projects?: ProjectRef[];
}

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

// ─── Component ──────────────────────────────────────────────────

export default function KundenSeite() {
  const t = useTranslations("clients");
  const tc = useTranslations("common");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const d = await res.json();
        setClients(d.data ?? d);
      } else {
        setError(tc("errorLoading"));
      }
    } catch {
      setError(tc("networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── Form helpers ─────────────────────────────────────────────

  function openCreate() {
    setEditingClient(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      notes: client.notes || "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingClient(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
  }

  function handleField(field: keyof typeof INITIAL_FORM, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // ── Save ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(t("nameRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const url = editingClient
        ? `/api/clients/${editingClient.id}`
        : "/api/clients";
      const method = editingClient ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          notes: formData.notes.trim() || null,
        }),
      });
      if (res.ok) {
        await fetchClients();
        closeForm();
      } else {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || tc("errorOccurred"));
      }
    } catch {
      setFormError(tc("networkError"));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/clients/${deleteTarget}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== deleteTarget));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || tc("errorOccurred"));
      }
    } catch {
      setError(tc("networkError"));
    } finally {
      setDeleteTarget(null);
    }
  }

  // ── Toggle active ────────────────────────────────────────────

  async function handleToggleActive(client: Client) {
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !client.isActive }),
      });
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) =>
            c.id === client.id ? { ...c, isActive: !c.isActive } : c,
          ),
        );
      }
    } catch {
      // Non-critical toggle
    }
  }

  // ── Filtering ────────────────────────────────────────────────

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Render ───────────────────────────────────────────────────

  return (
    <>
      <div>
        <Topbar
          title={t("title")}
          description={t("description")}
          actions={
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              {t("newClient")}
            </Button>
          }
        />

        <PageContent>
          {/* Error banner */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Search */}
          <div className="relative max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 sm:left-3 sm:h-4 sm:w-4" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-11 sm:ps-10"
            />
          </div>

          {/* Create/Edit Form */}
          {showForm && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {editingClient ? t("editClient") : t("newClient")}
                </CardTitle>
                <button
                  onClick={closeForm}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  aria-label={tc("close")}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                      {formError}
                    </p>
                  )}

                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="clientName">{t("nameLabel")} *</Label>
                    <Input
                      id="clientName"
                      required
                      value={formData.name}
                      onChange={(e) => handleField("name", e.target.value)}
                      placeholder={t("namePlaceholder")}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* E-Mail */}
                    <div className="space-y-1.5">
                      <Label htmlFor="clientEmail">{t("emailLabel")}</Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleField("email", e.target.value)}
                        placeholder="kontakt@kunde.de"
                      />
                    </div>

                    {/* Telefon */}
                    <div className="space-y-1.5">
                      <Label htmlFor="clientPhone">{t("phoneLabel")}</Label>
                      <Input
                        id="clientPhone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleField("phone", e.target.value)}
                        placeholder="+49 30 12345678"
                      />
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="space-y-1.5">
                    <Label htmlFor="clientAddress">{t("addressLabel")}</Label>
                    <Input
                      id="clientAddress"
                      value={formData.address}
                      onChange={(e) => handleField("address", e.target.value)}
                      placeholder="Musterstraße 1, 10115 Berlin"
                    />
                  </div>

                  {/* Notizen */}
                  <div className="space-y-1.5">
                    <Label htmlFor="clientNotes">{t("notesLabel")}</Label>
                    <textarea
                      id="clientNotes"
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => handleField("notes", e.target.value)}
                      placeholder={t("notesPlaceholder")}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button type="button" variant="outline" onClick={closeForm}>
                      {tc("cancel")}
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "..." : tc("save")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <UsersIcon className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {search ? t("noResults") : t("empty")}
              </p>
              {!search && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={openCreate}
                >
                  {t("newClient")}
                </Button>
              )}
            </div>
          )}

          {/* Client list */}
          {!loading && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((client) => (
                <Card key={client.id}>
                  <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {client.name}
                        </h3>
                        <Badge
                          variant={client.isActive ? "success" : "outline"}
                        >
                          {client.isActive ? t("active") : t("inactive")}
                        </Badge>
                        {client.projects && client.projects.length > 0 && (
                          <Badge variant="outline">
                            {client.projects.length} {t("projects")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
                        {client.email && <span>{client.email}</span>}
                        {client.phone && <span>{client.phone}</span>}
                        {client.address && (
                          <span className="truncate max-w-xs">
                            {client.address}
                          </span>
                        )}
                      </div>
                      {client.notes && (
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {client.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(client)}
                        title={
                          client.isActive ? t("deactivate") : t("activate")
                        }
                        className="text-xs"
                      >
                        {client.isActive ? t("deactivate") : t("activate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(client)}
                        aria-label={tc("edit")}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(client.id)}
                        aria-label={tc("delete")}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </PageContent>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
