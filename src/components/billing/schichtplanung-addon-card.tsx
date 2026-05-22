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

export function SchichtplanungAddonCard({
  hasStripeSubscription,
}: {
  hasStripeSubscription?: boolean;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [data, setData] = useState<SchichtplanungState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"toggle" | Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
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
      setSuccess(null);
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
          if (!body.active) {
            setSuccess(t("schichtplanungAddonDeactivated"));
          } else {
            setSuccess(t("schichtplanungAddonActivated"));
          }
        }
      } catch {
        setError(t("schichtplanungAddonError"));
      } finally {
        setPending(null);
        setConfirmCancel(false);
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
    setPending("toggle");
    await submit({ active: false });
  }, [submit]);

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

  // Trial users have no Stripe subscription yet — addons require a paid base plan.
  // Show a clear CTA instead of letting them click and get a confusing API error.
  if (hasStripeSubscription === false && !data.freeWithPlan && !data.active) {
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
            <Badge variant="outline">{t("schichtplanungAddonInactive")}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {t("addonRequiresPaidPlan")}{" "}
            <a
              href="#pricing"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {t("addonRequiresPaidPlanCta")}
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            {/* Success message */}
            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            {/* Auto-charge info */}
            <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              {t("addonAutoCharge")}
            </p>

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

            {/* Inline cancel confirmation */}
            {confirmCancel && (
              <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {t("schichtplanungAddonCancelConfirm")}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={pending !== null}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
                  >
                    {pending === "toggle" && (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {t("confirmAction")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    disabled={pending !== null}
                    className="rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 disabled:opacity-60 transition-colors"
                  >
                    {t("cancelAction")}
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!confirmCancel && (
              <div className="flex flex-wrap gap-2">
                {active && data.billing === selectedBilling ? (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    disabled={pending !== null}
                    className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {t("schichtplanungAddonCancel")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(selectedBilling)}
                    disabled={pending !== null}
                    className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {pending === selectedBilling && (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {pending === selectedBilling
                      ? t("schichtplanungAddonProcessing")
                      : active
                        ? t("schichtplanungAddonSwitchBilling")
                        : t("schichtplanungAddonSubscribe")}
                  </button>
                )}
              </div>
            )}

            {error && (
              <p
                className="mt-3 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
