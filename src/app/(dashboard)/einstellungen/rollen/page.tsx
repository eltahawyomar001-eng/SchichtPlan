"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContent } from "@/components/ui/page-content";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";
import { ShieldCheckIcon, LockIcon } from "@/components/icons";

interface RoleDefinition {
  id: string;
  name: string;
  nameEn?: string;
  builtIn: boolean;
  permissions: string[];
  description: string;
  descriptionEn?: string;
}

// Permission label translations
const PERM_LABELS_DE: Record<string, string> = {
  "employees.*": "Mitarbeiter verwalten",
  "employees.read": "Mitarbeiter einsehen",
  "shifts.*": "Schichten verwalten",
  "shifts.read": "Schichten einsehen",
  "locations.*": "Standorte verwalten",
  "absences.*": "Abwesenheiten verwalten",
  "absences.create": "Abwesenheiten einreichen",
  "absences.approve": "Abwesenheiten genehmigen",
  "time-entries.*": "Zeiteinträge verwalten",
  "time-entries.create": "Zeiteinträge erfassen",
  "time-entries.approve": "Zeiteinträge genehmigen",
  "settings.*": "Einstellungen verwalten",
  "settings.read": "Einstellungen einsehen",
  "billing.*": "Abrechnung verwalten",
  "team.*": "Team verwalten",
  "reports.*": "Berichte verwalten",
  "reports.read": "Berichte einsehen",
  "availability.manage": "Verfügbarkeiten verwalten",
};

const PERM_LABELS_EN: Record<string, string> = {
  "employees.*": "Manage employees",
  "employees.read": "View employees",
  "shifts.*": "Manage shifts",
  "shifts.read": "View shifts",
  "locations.*": "Manage locations",
  "absences.*": "Manage absences",
  "absences.create": "Submit absences",
  "absences.approve": "Approve absences",
  "time-entries.*": "Manage time entries",
  "time-entries.create": "Record time entries",
  "time-entries.approve": "Approve time entries",
  "settings.*": "Manage settings",
  "settings.read": "View settings",
  "billing.*": "Manage billing",
  "team.*": "Manage team",
  "reports.*": "Manage reports",
  "reports.read": "View reports",
  "availability.manage": "Manage availability",
};

export default function RollenPage() {
  const t = useTranslations("roles");
  const locale = useLocale();
  const { handlePlanLimit } = usePlanLimit();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const permLabels = locale === "en" ? PERM_LABELS_EN : PERM_LABELS_DE;

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-roles");
      if (res.ok) {
        setRoles(await res.json());
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
  }, [handlePlanLimit, t]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

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
            <CardContent className="py-10 text-center text-sm text-gray-500">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {/* Info banner */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">
                    {t("builtInInfo")}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    {t("customRolesInfo")}
                  </p>
                </div>
              </div>
            </div>

            {/* Role cards */}
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">
                      {locale === "en" && role.nameEn ? role.nameEn : role.name}
                    </CardTitle>
                    {role.builtIn && (
                      <Badge variant="outline">{t("builtIn")}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-3">
                    {locale === "en" && role.descriptionEn
                      ? role.descriptionEn
                      : role.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                      >
                        <LockIcon className="h-3 w-3" />
                        {permLabels[perm] || perm}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </div>
  );
}
