"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContent } from "@/components/ui/page-content";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import {
  ShieldCheckIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
} from "@/components/icons";

interface RoleDefinition {
  id: string;
  name: string;
  nameEn?: string | null;
  builtIn: boolean;
  baseRole?: string;
  permissions: string[];
  description: string | null;
  descriptionEn?: string | null;
}

const AVAILABLE_PERMISSIONS = [
  "employees.read",
  "employees.create",
  "employees.update",
  "employees.delete",
  "employees.*",
  "shifts.read",
  "shifts.create",
  "shifts.update",
  "shifts.delete",
  "shifts.*",
  "locations.read",
  "locations.create",
  "locations.update",
  "locations.delete",
  "locations.*",
  "absences.read",
  "absences.create",
  "absences.approve",
  "absences.*",
  "time-entries.read",
  "time-entries.create",
  "time-entries.approve",
  "time-entries.*",
  "reports.read",
  "reports.*",
  "settings.read",
  "settings.*",
];

function permToI18nKey(perm: string): string {
  return perm
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/\./g, "_")
    .replace("*", "all");
}

export default function RollenPage() {
  const t = useTranslations("roles");
  const locale = useLocale();
  const { handlePlanLimit } = usePlanLimit();
  const [builtIn, setBuiltIn] = useState<RoleDefinition[]>([]);
  const [custom, setCustom] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-role dialog state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBaseRole, setNewBaseRole] = useState<
    "EMPLOYEE" | "MANAGER" | "ADMIN"
  >("EMPLOYEE");
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/custom-roles");
      if (res.ok) {
        const data = await res.json();
        // Backward compat: old shape was a flat array; new shape is {builtIn, custom}
        if (Array.isArray(data)) {
          setBuiltIn(data);
          setCustom([]);
        } else {
          setBuiltIn(data.builtIn || []);
          setCustom(data.custom || []);
        }
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (isPlanLimit) {
          setLoading(false);
          return;
        }
        setError(t("loadError"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePlanLimit]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreate = async () => {
    if (!newName.trim() || newPermissions.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/custom-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          baseRole: newBaseRole,
          permissions: newPermissions,
        }),
      });
      if (!res.ok) {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || t("createError"));
        }
        return;
      }
      setCreating(false);
      setNewName("");
      setNewDescription("");
      setNewBaseRole("EMPLOYEE");
      setNewPermissions([]);
      fetchRoles();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/custom-roles/${id}`, { method: "DELETE" });
    if (res.ok) fetchRoles();
  };

  const togglePerm = (p: string) => {
    setNewPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const renderRole = (role: RoleDefinition) => (
    <Card key={role.id}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">
              {locale === "en" && role.nameEn ? role.nameEn : role.name}
            </CardTitle>
            {role.builtIn ? (
              <Badge variant="outline">{t("builtIn")}</Badge>
            ) : (
              <Badge>{t("custom")}</Badge>
            )}
          </div>
          {!role.builtIn && (
            <button
              type="button"
              onClick={() => handleDelete(role.id)}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              aria-label="Delete custom role"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {(role.description || role.descriptionEn) && (
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            {locale === "en" && role.descriptionEn
              ? role.descriptionEn
              : role.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {role.permissions.map((perm) => (
            <span
              key={perm}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-zinc-300"
            >
              <LockIcon className="h-3 w-3" />
              {t.has(`permissions.${permToI18nKey(perm)}`)
                ? t(`permissions.${permToI18nKey(perm)}`)
                : perm}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <PageContent className="max-w-4xl">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500 dark:text-zinc-400">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                    {t("builtInInfo")}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    {t("customRolesInfo")}
                  </p>
                </div>
              </div>
            </div>

            {/* Built-in roles */}
            {builtIn.map(renderRole)}

            {/* Custom roles */}
            {custom.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mt-6">
                  {t("customSection") ?? "Benutzerdefinierte Rollen"}
                </h3>
                {custom.map(renderRole)}
              </>
            )}

            {/* Create button + form */}
            {!creating && (
              <Button
                variant="outline"
                onClick={() => setCreating(true)}
                className="w-full mt-4"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                {t("addCustomRole") ?? "Eigene Rolle erstellen"}
              </Button>
            )}

            {creating && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("newCustomRole") ?? "Neue eigene Rolle"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                      {t("name") ?? "Name"}
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={50}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                      placeholder="z. B. Schichtkoordinator"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                      {t("description") ?? "Beschreibung"}
                    </label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      maxLength={500}
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                      {t("baseRole") ?? "Basisrolle"}
                    </label>
                    <select
                      value={newBaseRole}
                      onChange={(e) =>
                        setNewBaseRole(
                          e.target.value as "EMPLOYEE" | "MANAGER" | "ADMIN",
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    >
                      <option value="EMPLOYEE">Mitarbeiter</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-2 block">
                      {t("permissions") ?? "Berechtigungen"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {AVAILABLE_PERMISSIONS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => togglePerm(p)}
                          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors text-left ${
                            newPermissions.includes(p)
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          {newPermissions.includes(p) && (
                            <CheckIcon className="h-3 w-3" />
                          )}
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCreating(false);
                        setNewName("");
                        setNewDescription("");
                        setNewPermissions([]);
                      }}
                      disabled={saving}
                    >
                      {t("cancel") ?? "Abbrechen"}
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={
                        saving || !newName.trim() || newPermissions.length === 0
                      }
                    >
                      {saving
                        ? (t("saving") ?? "Speichert…")
                        : (t("create") ?? "Erstellen")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </PageContent>
    </div>
  );
}
