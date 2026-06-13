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

interface ScannerUsage {
  tier: "free" | "premium";
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

interface TimesheetScannerState {
  active: boolean;
  freeWithPlan: boolean;
  priceMonthlyCents: number;
  freeScansPerMonth: number;
  premiumScansPerMonth: number;
  usage: ScannerUsage;
}

interface AddonsResponse {
  timesheetScanner?: TimesheetScannerState;
}

function formatPrice(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
  });
}

export function TimesheetScannerAddonCard({
  hasStripeSubscription,
}: {
  hasStripeSubscription?: boolean;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [data, setData] = useState<TimesheetScannerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/addons");
      if (res.ok) {
        const json = (await res.json()) as AddonsResponse;
        if (json.timesheetScanner) setData(json.timesheetScanner);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (active: boolean) => {
      setError(null);
      setSuccess(null);
      setPending(true);
      try {
        const res = await fetch("/api/billing/addons/timesheet-scanner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active }),
        });
        if (!res.ok) {
          setError(t("timesheetScannerAddonError"));
        } else {
          await load();
          setSuccess(
            active
              ? t("timesheetScannerAddonActivated")
              : t("timesheetScannerAddonDeactivated"),
          );
        }
      } catch {
        setError(t("timesheetScannerAddonError"));
      } finally {
        setPending(false);
        setConfirmCancel(false);
      }
    },
    [t, load],
  );

  if (loading) {
    return (
      <Card id="timesheet-scanner-addon">
        <CardHeader>
          <CardTitle>{t("timesheetScannerAddonTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Trial users have no Stripe subscription yet — add-ons need a paid base plan.
  if (hasStripeSubscription === false && !data.freeWithPlan && !data.active) {
    return (
      <Card id="timesheet-scanner-addon" className="scroll-mt-24">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t("timesheetScannerAddonTitle")}</CardTitle>
              <CardDescription className="mt-1">
                {t("timesheetScannerAddonDescription")}
              </CardDescription>
            </div>
            <Badge variant="outline">
              {t("timesheetScannerAddonInactive")}
            </Badge>
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

  const { active, freeWithPlan, priceMonthlyCents, usage } = data;
  const monthlyPrice = formatPrice(priceMonthlyCents, locale);
  const usedPct =
    usage.limit > 0
      ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
      : 0;

  return (
    <Card id="timesheet-scanner-addon" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t("timesheetScannerAddonTitle")}</CardTitle>
            <CardDescription className="mt-1">
              {t("timesheetScannerAddonDescription")}
            </CardDescription>
          </div>
          {freeWithPlan ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircleIcon className="mr-1 h-3 w-3" />
              {t("timesheetScannerAddonFreeWithEnterprise")}
            </Badge>
          ) : active ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircleIcon className="mr-1 h-3 w-3" />
              {t("timesheetScannerAddonActive")}
            </Badge>
          ) : (
            <Badge variant="outline">
              {t("timesheetScannerAddonInactive")}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Usage meter — always shown so managers see remaining scans. */}
        <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {t("timesheetScannerAddonUsageLabel")}
            </span>
            <span className="text-muted-foreground">
              {t("timesheetScannerAddonUsageCount", {
                used: usage.used,
                limit: usage.limit,
              })}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                usedPct >= 100 ? "bg-red-500" : "bg-emerald-600"
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        {freeWithPlan ? (
          <p className="text-sm text-muted-foreground">
            {t("timesheetScannerAddonFreeWithEnterpriseDescription")}
          </p>
        ) : (
          <>
            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            {/* Pricing summary */}
            <div className="mb-4 rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">{monthlyPrice}</span>
                <span className="text-sm text-muted-foreground">
                  {t("timesheetScannerAddonPerMonth")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("timesheetScannerAddonScansSummary", {
                  free: data.freeScansPerMonth,
                  premium: data.premiumScansPerMonth,
                })}{" "}
                · {t("timesheetScannerAddonNetVat")}
              </p>
            </div>

            {/* Inline cancel confirmation */}
            {confirmCancel && (
              <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {t("timesheetScannerAddonCancelConfirm")}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => submit(false)}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
                  >
                    {pending && (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {t("confirmAction")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    disabled={pending}
                    className="rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 disabled:opacity-60 transition-colors"
                  >
                    {t("cancelAction")}
                  </button>
                </div>
              </div>
            )}

            {/* Action button */}
            {!confirmCancel && (
              <div className="flex flex-wrap gap-2">
                {active ? (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    disabled={pending}
                    className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    {t("timesheetScannerAddonCancel")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => submit(true)}
                    disabled={pending}
                    className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {pending && (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {pending
                      ? t("timesheetScannerAddonProcessing")
                      : t("timesheetScannerAddonSubscribe")}
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
