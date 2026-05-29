"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuildingIcon } from "@/components/icons";

export function DATEVNumbersCard() {
  const t = useTranslations("datevNumbers");
  const [consultantNumber, setConsultantNumber] = useState("");
  const [clientNumber, setClientNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((d) => {
        setConsultantNumber(d.datevConsultantNumber ?? "");
        setClientNumber(d.datevClientNumber ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datevConsultantNumber: consultantNumber,
          datevClientNumber: clientNumber,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t("saveError"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BuildingIcon className="h-5 w-5 text-emerald-600" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {t("description")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="consultantNumber">
                  {t("consultantNumber")}
                </Label>
                <Input
                  id="consultantNumber"
                  value={consultantNumber}
                  onChange={(e) => setConsultantNumber(e.target.value)}
                  placeholder="z.B. 5929293"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientNumber">{t("clientNumber")}</Label>
                <Input
                  id="clientNumber"
                  value={clientNumber}
                  onChange={(e) => setClientNumber(e.target.value)}
                  placeholder="z.B. 1"
                  maxLength={20}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-emerald-600">{t("saved")}</p>}
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
