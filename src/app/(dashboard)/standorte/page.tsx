"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PlusIcon,
  MapPinIcon,
  XIcon,
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
  const [locations, setLocations] = useState<Location[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLocations(data);
    } catch (error) {
      console.error("Error:", error);
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
        const data = await res.json();
        setFormError(data.error || t("saveError"));
      }
    } catch (error) {
      console.error("Error:", error);
      setFormError(t("networkError"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/locations/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchLocations();
    } catch (error) {
      console.error("Error:", error);
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

      <div className="p-4 sm:p-6 space-y-6">
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
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <Card className="w-full max-w-md mx-0 sm:mx-4 rounded-b-none sm:rounded-b-xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {editingLocation ? t("form.editTitle") : t("form.title")}
                </CardTitle>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1 hover:bg-gray-100"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </CardHeader>
              <CardContent>
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
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {formError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
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
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Locations List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">{tc("loading")}</p>
          </div>
        ) : filteredLocations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <MapPinIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900">
                {search ? tc("noResults") : t("noLocations")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {!search && t("noLocationsHint")}
              </p>
              {!search && (
                <Button className="mt-4" onClick={openCreateForm}>
                  <PlusIcon className="h-4 w-4" />
                  {t("addLocation")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map((location) => (
              <Card
                key={location.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-purple-50 p-2.5">
                        <MapPinIcon className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
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
      </div>

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
