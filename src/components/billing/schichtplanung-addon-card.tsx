"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon } from "@/components/icons";

type Billing = "monthly" | "annual";

interface SchichtplanungState {
  active: boolean;
  billing: Billing | null;
  freeWithPlan: boolean;
  perUserMonthlyCents: number;
  perUserAnnualCents: number;
  seatCount: number;
}

interface AddonsResponse {
  schichtplanung?: SchichtplanungState;
}

function formatPrice(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
  });
}

export function SchichtplanungAddonCard() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [data, setData] = useState<SchichtplanungState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"toggle" | Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<Billing>("monthly");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/addons");
      if (res.ok) {
        const json = (await res.json()) as AddonsResponse;
        if (json.schichtplanung) {
          setData(json.schichtplanung);
          if (json.schichtplanung.billing) {
            setSelectedBilling(json.schichtplanung.billing);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (body: { active: false } | { active: true; billing: Billing }) => {
      setError(null);
      try {
        const res = await fetch("/api/billing/addons/schichtplanung", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError(t("schichtplanungAddonError"));
        } else {
          await load();
        }
      } catch {
        setError(t("schichtplanungAddonError"));
      } finally {
        setPending(null);
      }
    },
    [t, load],
  );

  const handleSubscribe = useCallback(
    async (billing: Billing) => {
      setPending(billing);
      await submit({ active: true, billing });
    },
    [submit],
  );

  const handleCancel = useCallback(async () => {
    if (!confirm(t("schichtplanungAddonCancelConfirm"))) return;
    setPending("toggle");
    await submit({ active: false });
  }, [submit, t]);

  if (loading) {
    return (
      <Card id="schichtplanung-addon">
        <CardHeader>
          <CardTitle>{t("schichtplanungAddonTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const {
    active,
    freeWithPlan,
    perUserMonthlyCents,
    perUserAnnualCents,
    seatCount,
  } = data;

  const monthlyPerUser = formatPrice(perUserMonthlyCents, locale);
  const annualPerUser = formatPrice(perUserAnnualCents, locale);
  const annualMonthlyEquivalent = perUserAnnualCents / 12;
  const savingsPct = Math.round(
    (1 - annualMonthlyEquivalent / perUserMonthlyCents) * 100,
  );

  const monthlyTotal = formatPrice(perUserMonthlyCents * seatCount, locale);
  const annualTotal = formatPrice(perUserAnnualCents * seatCount, locale);

  return (
    <Card id="schichtplanung-addon" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t("schichtplanungAddonTitle")}</CardTitle>
            <CardDescription className="mt-1">
              {t("schichtplanungAddonDescription")}
            </CardDescription>
          </div>
          {freeWithPlan ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircleIcon className="mr-1 h-3 w-3" />
              {t("schichtplanungAddonFreeWithEnterprise")}
            </Badge>
          ) : active ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircleIcon className="mr-1 h-3 w-3" />
              {t("schichtplanungAddonActive")}
            </Badge>
          ) : (
            <Badge variant="outline">{t("schichtplanungAddonInactive")}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {freeWithPlan ? (
          <p className="text-sm text-muted-foreground">
            {t("schichtplanungAddonFreeWithEnterpriseDescription")}
          </p>
        ) : (
          <>
            {/* Billing cycle toggle */}
            <div className="mb-4 inline-flex rounded-md border border-input p-1">
              <button
                type="button"
                onClick={() => setSelectedBilling("monthly")}
                className={`rounded px-3 py-1 text-sm transition ${
                  selectedBilling === "monthly"
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("schichtplanungAddonBillingMonthly")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedBilling("annual")}
                className={`rounded px-3 py-1 text-sm transition ${
                  selectedBilling === "annual"
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("schichtplanungAddonBillingAnnual")}
                {savingsPct > 0 && (
                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                    -{savingsPct}%
                  </span>
                )}
              </button>
            </div>

            {/* Pricing summary */}
            <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">
                  {selectedBilling === "monthly"
                    ? monthlyPerUser
                    : annualPerUser}
                </span>
                <span className="text-sm text-muted-foreground">
                  {selectedBilling === "monthly"
                    ? t("schichtplanungAddonPerUserMonth")
                    : t("schichtplanungAddonPerUserYear")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("schichtplanungAddonSeatTotal", {
                  seats: seatCount,
                  total:
                    selectedBilling === "monthly" ? monthlyTotal : annualTotal,
                })}{" "}
                · {t("schichtplanungAddonNetVat")}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {active && data.billing === selectedBilling ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={pending !== null}
                  className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {pending === "toggle"
                    ? t("schichtplanungAddonProcessing")
                    : t("schichtplanungAddonCancel")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubscribe(selectedBilling)}
                  disabled={pending !== null}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pending === selectedBilling
                    ? t("schichtplanungAddonProcessing")
                    : active
                      ? t("schichtplanungAddonSwitchBilling")
                      : t("schichtplanungAddonSubscribe")}
                </button>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
