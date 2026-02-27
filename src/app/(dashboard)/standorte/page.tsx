"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  PlusIcon,
  MapPinIcon,
  TrashIcon,
  EditIcon,
  SearchIcon,
} from "@/components/icons";

interface Location {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
}

export default function StandortePage() {
  const t = useTranslations("locationsPage");
  const tc = useTranslations("common");
  const { handlePlanLimit } = usePlanLimit();
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(data.data ?? data);
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingLocation(null);
    setFormData({ name: "", address: "" });
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (loc: Location) => {
    setEditingLocation(loc);
    setFormData({ name: loc.name, address: loc.address || "" });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const url = editingLocation
        ? `/api/locations/${editingLocation.id}`
        : "/api/locations";
      const method = editingLocation ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingLocation(null);
        setFormData({ name: "", address: "" });
        fetchLocations();
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;

        const data = await res.json();
        setFormError(data.error || t("saveError"));
      }
    } catch {
      setFormError(t("networkError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/locations/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchLocations();
    } catch {
      setError(tc("errorOccurred"));
    }
  };

  const filteredLocations = locations.filter((loc) =>
    `${loc.name} ${loc.address || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={openCreateForm}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newLocation")}</span>
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

        {/* Search */}
        {locations.length > 0 && (
          <div className="relative max-w-full sm:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Add/Edit Location Modal */}
        <AdaptiveModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editingLocation ? t("form.editTitle") : t("form.title")}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("form.name")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                placeholder={t("form.namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t("form.address")}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, address: e.target.value }))
                }
                placeholder={t("form.addressPlaceholder")}
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
              <Button type="submit">
                {editingLocation ? tc("save") : t("addLocation")}
              </Button>
            </ModalFooter>
          </form>
        </AdaptiveModal>

        {/* Locations List */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 rounded shimmer" />
                    <div className="h-3 w-40 rounded shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredLocations.length === 0 ? (
          search ? (
            <EmptyState
              icon={<MapPinIcon className="h-8 w-8 text-emerald-500" />}
              title={tc("noResults")}
            />
          ) : (
            <EmptyState
              icon={<MapPinIcon className="h-8 w-8 text-emerald-500" />}
              title={t("noLocations")}
              description={t("noLocationsHint")}
              tips={[t("emptyTip1"), t("emptyTip2"), t("emptyTip3")]}
              actions={[{ label: t("addLocation"), onClick: openCreateForm }]}
            />
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map((location) => (
              <Card key={location.id} className="card-elevated">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl stat-icon-emerald p-2.5">
                        <MapPinIcon className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {location.name}
                        </p>
                        {location.address && (
                          <p className="text-sm text-gray-500">
                            {location.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => openEditForm(location)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(location.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      {/* Delete Confirmation Dialog */}
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
