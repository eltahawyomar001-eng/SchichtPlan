"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BriefcaseIcon } from "@/components/icons";

export function BetriebsnummerCard() {
  const t = useTranslations("betriebsnummer");
  const [betriebsnummer, setBetriebsnummer] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((d) => {
        setBetriebsnummer(d.betriebsnummer ?? "");
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
        body: JSON.stringify({ betriebsnummer }),
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
          <BriefcaseIcon className="h-5 w-5 text-emerald-600" />
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
            <div className="max-w-xs space-y-2">
              <Label htmlFor="betriebsnummer">{t("label")}</Label>
              <Input
                id="betriebsnummer"
                value={betriebsnummer}
                onChange={(e) => setBetriebsnummer(e.target.value)}
                placeholder="z.B. 12345678"
                maxLength={15}
                inputMode="numeric"
              />
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
