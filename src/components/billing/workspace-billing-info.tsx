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

type EmailStatus =
  | "sent"
  | "quota_exceeded"
  | "no_email"
  | "no_stripe"
  | "error"
  | null;

function StatusBanner({
  status,
  email,
  t,
}: {
  status: EmailStatus;
  email: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!status) return null;

  const isWarning = status === "quota_exceeded" || status === "error";
  const isInfo = status === "no_email";

  const text = (() => {
    switch (status) {
      case "sent":
        return t("auditEmailSent", { email });
      case "quota_exceeded":
        return t("auditEmailQuotaExceeded");
      case "no_email":
        return t("auditEmailNoEmail");
      case "error":
        return t("auditEmailError");
      default:
        return t("savedCompanyInfo");
    }
  })();

  const colorClass = isWarning
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : isInfo
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <p
      className={`rounded-lg border px-3 py-2 text-sm leading-snug ${colorClass}`}
    >
      {text}
    </p>
  );
}

export function WorkspaceBillingInfo() {
  const t = useTranslations("billing");
  const [info, setInfo] = useState<CustomerInfo>({});
  const [saving, setSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>(null);
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
    (field: keyof CustomerInfo) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmailStatus(null);
      setInfo((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const save = async () => {
    setSaving(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/billing/customer-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailStatus((data.emailStatus as EmailStatus) ?? "no_email");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const billingEmail = info.billingEmail ?? "";

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
              value={billingEmail}
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
        <div className="flex flex-col gap-2.5 pt-2">
          <div className="flex flex-col gap-1.5">
            <Button onClick={save} disabled={saving} className="w-fit">
              {saving ? t("saving") : t("saveCompanyInfo")}
            </Button>
            {billingEmail && !emailStatus && (
              <p className="text-xs text-gray-400 leading-snug max-w-sm">
                {t("billingEmailSaveHint")}
              </p>
            )}
          </div>
          <StatusBanner status={emailStatus} email={billingEmail} t={t} />
        </div>
      </CardContent>
    </Card>
  );
}
