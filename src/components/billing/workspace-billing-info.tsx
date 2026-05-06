"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomerInfo {
  companyName?: string | null;
  vatId?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  billingCity?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string;
}

export function WorkspaceBillingInfo() {
  const t = useTranslations("billing");
  const [info, setInfo] = useState<CustomerInfo>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/customer-info")
      .then((r) => r.json())
      .then((d) => {
        setInfo(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange =
    (field: keyof CustomerInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setInfo((prev) => ({ ...prev, [field]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/billing/customer-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("companyInfoTitle")}</CardTitle>
        <CardDescription>{t("companyInfoDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("companyName")}
            </label>
            <Input
              value={info.companyName ?? ""}
              onChange={handleChange("companyName")}
              placeholder="Musterfirma GmbH"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("vatId")}
            </label>
            <Input
              value={info.vatId ?? ""}
              onChange={handleChange("vatId")}
              placeholder="DE123456789"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("billingEmail")}
            </label>
            <Input
              type="email"
              value={info.billingEmail ?? ""}
              onChange={handleChange("billingEmail")}
              placeholder="buchhaltung@firma.de"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("billingAddress")}
            </label>
            <Input
              value={info.billingAddress ?? ""}
              onChange={handleChange("billingAddress")}
              placeholder="Musterstraße 1"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("billingCity")}
            </label>
            <Input
              value={info.billingCity ?? ""}
              onChange={handleChange("billingCity")}
              placeholder="Berlin"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("billingPostalCode")}
            </label>
            <Input
              value={info.billingPostalCode ?? ""}
              onChange={handleChange("billingPostalCode")}
              placeholder="10115"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? t("saving") : t("saveCompanyInfo")}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-600 font-medium">
              {t("savedCompanyInfo")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
