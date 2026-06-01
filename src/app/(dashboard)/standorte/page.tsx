"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Select } from "@/components/ui/select";
import {
  PlusIcon,
  MapPinIcon,
  TrashIcon,
  EditIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/icons";

interface Location {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
}

interface Skill {
  id: string;
  name: string;
  category: string | null;
}

interface RequiredSkillEntry {
  id: string;
  skillId: string;
  skill: Skill;
}

export default function StandortePage() {
  const t = useTranslations("locationsPage");
  const tc = useTranslations("common");
  const { handlePlanLimit } = usePlanLimit();

  const [locations, setLocations] = useState<Location[]>([]);
  const [locationLimit, setLocationLimit] = useState<number | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });

  // Certification management state
  const [certModalLocationId, setCertModalLocationId] = useState<string | null>(
    null,
  );
  const [certModalLocationName, setCertModalLocationName] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<RequiredSkillEntry[]>(
    [],
  );
  const [certLoading, setCertLoading] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [certSaving, setCertSaving] = useState(false);
  // Per-card cert previews (locationId → list)
  const [certPreviews, setCertPreviews] = useState<
    Record<string, RequiredSkillEntry[]>
  >({});

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      const locs: Location[] = data.data ?? data;
      setLocations(locs);
      // Fetch cert previews for all locations in parallel
      const previews = await Promise.all(
        locs.map(async (loc) => {
          const r = await fetch(
            `/api/locations/${loc.id}/required-skills`,
          ).catch(() => null);
          if (!r?.ok) return { id: loc.id, skills: [] };
          const d = await r.json();
          return { id: loc.id, skills: d.requiredSkills ?? [] };
        }),
      );
      const map: Record<string, RequiredSkillEntry[]> = {};
      previews.forEach(({ id, skills }) => {
        map[id] = skills;
      });
      setCertPreviews(map);
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    fetchLocations();
    fetch("/api/billing/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.locations?.limit != null) setLocationLimit(d.locations.limit);
      })
      .catch(() => {});
    fetch("/api/skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.skills) setAllSkills(d.skills);
        else if (Array.isArray(d)) setAllSkills(d);
      })
      .catch(() => {});
  }, [fetchLocations]);

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
    if (saving) return;
    setFormError(null);
    setSaving(true);
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
        window.dispatchEvent(new Event("shiftfy:usage-changed"));
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) return;
        const data = await res.json();
        setFormError(data.message || data.error || t("saveError"));
      }
    } catch {
      setFormError(t("networkError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/locations/${deleteTarget}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.message ?? tc("errorOccurred"));
        return;
      }
      setDeleteTarget(null);
      fetchLocations();
      window.dispatchEvent(new Event("shiftfy:usage-changed"));
    } catch {
      setError(tc("errorOccurred"));
    }
  };

  const openCertModal = async (loc: Location) => {
    setCertModalLocationId(loc.id);
    setCertModalLocationName(loc.name);
    setSelectedSkillId("");
    setCertLoading(true);
    try {
      const res = await fetch(`/api/locations/${loc.id}/required-skills`);
      const data = await res.json();
      setRequiredSkills(data.requiredSkills ?? []);
    } catch {
      setRequiredSkills([]);
    } finally {
      setCertLoading(false);
    }
  };

  const closeCertModal = () => {
    setCertModalLocationId(null);
    setCertModalLocationName("");
    setRequiredSkills([]);
    setSelectedSkillId("");
    // Refresh cert previews for all locations
    fetchLocations();
  };

  const addRequiredSkill = async () => {
    if (!selectedSkillId || !certModalLocationId) return;
    setCertSaving(true);
    try {
      const res = await fetch(
        `/api/locations/${certModalLocationId}/required-skills`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId: selectedSkillId }),
        },
      );
      if (res.ok) {
        const entry = await res.json();
        setRequiredSkills((prev) => {
          if (prev.find((s) => s.skillId === entry.skillId)) return prev;
          return [...prev, entry];
        });
        setSelectedSkillId("");
      }
    } finally {
      setCertSaving(false);
    }
  };

  const removeRequiredSkill = async (skillId: string) => {
    if (!certModalLocationId) return;
    const res = await fetch(
      `/api/locations/${certModalLocationId}/required-skills`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      },
    );
    if (!res.ok) return;
    setRequiredSkills((prev) => prev.filter((s) => s.skillId !== skillId));
  };

  const filteredLocations = locations.filter((loc) =>
    `${loc.name} ${loc.address || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const isAtLimit = locationLimit !== null && locations.length >= locationLimit;

  const availableSkillsToAdd = allSkills.filter(
    (s) => !requiredSkills.find((rs) => rs.skillId === s.id),
  );

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            size="sm"
            onClick={openCreateForm}
            disabled={isAtLimit}
            title={
              isAtLimit
                ? t("limitReached", {
                    used: locations.length,
                    limit: locationLimit,
                  })
                : undefined
            }
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newLocation")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />

      <PageContent>
        {isAtLimit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t("limitReached", {
              used: locations.length,
              limit: locationLimit,
            })}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {locations.length > 0 && (
          <div className="relative max-w-full sm:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 sm:left-3 sm:h-4 sm:w-4" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-11 sm:ps-10"
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
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1.5">
                <MapPinIcon className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                {t("form.addressTip")}
              </p>
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
              <Button type="submit" disabled={saving}>
                {saving
                  ? tc("saving")
                  : editingLocation
                    ? tc("save")
                    : t("addLocation")}
              </Button>
            </ModalFooter>
          </form>
        </AdaptiveModal>

        {/* Required Certifications Modal */}
        <AdaptiveModal
          open={!!certModalLocationId}
          onClose={closeCertModal}
          title={`§34a — ${certModalLocationName}`}
          size="md"
        >
          <div className="space-y-5">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {t("cert.intro")}
            </p>

            {/* Current required certifications */}
            <div className="space-y-2">
              <Label>{t("cert.required")}</Label>
              {certLoading ? (
                <div className="flex gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-7 w-28 rounded-full shimmer" />
                  ))}
                </div>
              ) : requiredSkills.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-zinc-500 italic">
                  {t("cert.noneRequired")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {requiredSkills.map((rs) => (
                    <span
                      key={rs.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-sm font-medium text-emerald-800 dark:text-emerald-300"
                    >
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      {rs.skill.name}
                      <button
                        onClick={() => removeRequiredSkill(rs.skillId)}
                        className="ml-1 rounded-full text-emerald-600 hover:text-red-600 dark:text-emerald-400 dark:hover:text-red-400 transition-colors"
                        title={t("cert.remove")}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Add certification */}
            {availableSkillsToAdd.length > 0 && (
              <div className="space-y-2">
                <Label>{t("cert.add")}</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedSkillId}
                    onChange={(e) => setSelectedSkillId(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">{t("cert.selectPlaceholder")}</option>
                    {availableSkillsToAdd.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.category ? ` · ${s.category}` : ""}
                      </option>
                    ))}
                  </Select>
                  <Button
                    onClick={addRequiredSkill}
                    disabled={!selectedSkillId || certSaving}
                    size="sm"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {t("cert.addButton")}
                  </Button>
                </div>
              </div>
            )}

            {allSkills.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {t("cert.noneDefinedPre")}{" "}
                <a href="/qualifikationen" className="underline font-medium">
                  {t("cert.qualificationsLink")}
                </a>{" "}
                {t("cert.noneDefinedPost")}
              </div>
            )}

            <ModalFooter>
              <Button variant="outline" onClick={closeCertModal}>
                {t("cert.done")}
              </Button>
            </ModalFooter>
          </div>
        </AdaptiveModal>

        {/* Locations List */}
        {loading ? (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6"
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
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map((location) => {
              const certs = certPreviews[location.id] ?? [];
              return (
                <Card key={location.id} className="card-elevated">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="rounded-xl stat-icon-emerald p-2.5 flex-shrink-0">
                          <MapPinIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-zinc-100 truncate">
                            {location.name}
                          </p>
                          {location.address && (
                            <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                              {location.address}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                          onClick={() => openEditForm(location)}
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                          onClick={() => setDeleteTarget(location.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Required certifications section */}
                    <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                          {t("cert.cardLabel")}
                        </span>
                        <button
                          onClick={() => openCertModal(location)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
                        >
                          {t("cert.manage")}
                        </button>
                      </div>
                      {certs.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-zinc-600 italic">
                          {t("cert.cardNone")}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {certs.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                            >
                              <ShieldCheckIcon className="h-3 w-3" />
                              {c.skill.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
