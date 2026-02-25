"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Topbar } from "@/components/layout/topbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircleIcon,
  ZapIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  StarIcon,
  AlertTriangleIcon,
  BeakerIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface SubscriptionData {
  plan: string;
  status: string;
  seatCount: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  simulationMode?: boolean;
  limits: {
    maxEmployees: number;
    maxLocations: number;
    shiftTemplates: boolean;
    absenceManagement: boolean;
    csvPdfExport: boolean;
    datevExport: boolean;
    apiWebhooks: boolean;
    customRoles: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    ssoSaml: boolean;
  };
}

interface PlanOption {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  highlighted: boolean;
  isFree: boolean;
  isEnterprise: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════════════ */

function BillingContent() {
  const { data: session } = useSession();
  const t = useTranslations("billing");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const user = session?.user as SessionUser | undefined;

  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "annual",
  );
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    const billingParam = searchParams.get("billing");
    const portalParam = searchParams.get("portal");
    if (billingParam === "success") {
      setSuccessMsg(t("checkoutSuccess"));
      // Re-fetch subscription to reflect the updated plan
      fetch("/api/billing/subscription")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setSubscription(data);
        })
        .catch(() => {});
      window.history.replaceState({}, "", "/einstellungen/abonnement");
    }
    if (portalParam === "sim") {
      setSuccessMsg(t("simPortalMsg"));
      window.history.replaceState({}, "", "/einstellungen/abonnement");
    }
  }, [searchParams, t]);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/subscription");
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Auto-trigger checkout if user came from landing page with a plan
  useEffect(() => {
    const storedPlan = localStorage.getItem("shiftfy_selected_plan");
    const storedBilling = localStorage.getItem("shiftfy_selected_billing");
    if (storedPlan && (storedPlan === "team" || storedPlan === "business")) {
      localStorage.removeItem("shiftfy_selected_plan");
      localStorage.removeItem("shiftfy_selected_billing");
      // Apply the stored billing cycle
      if (storedBilling === "monthly" || storedBilling === "annual") {
        setBillingCycle(storedBilling);
      }
      // Small delay to let subscription data load first
      const timer = setTimeout(() => {
        handleCheckout(storedPlan);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plan options
  const plans: PlanOption[] = [
    {
      id: "starter",
      name: t("planStarter"),
      monthlyPrice: 0,
      annualPrice: 0,
      description: t("planStarterDesc"),
      features: [
        t("featureEmployees5"),
        t("featureLocation1"),
        t("featureBasicScheduling"),
        t("featureTimeClock"),
      ],
      highlighted: false,
      isFree: true,
      isEnterprise: false,
    },
    {
      id: "team",
      name: t("planTeam"),
      monthlyPrice: 5.9,
      annualPrice: 4.9,
      description: t("planTeamDesc"),
      features: [
        t("featureUnlimitedEmployees"),
        t("featureLocations5"),
        t("featureTemplates"),
        t("featureAbsences"),
        t("featureCsvPdfExport"),
        t("feature14DayTrial"),
      ],
      highlighted: true,
      isFree: false,
      isEnterprise: false,
    },
    {
      id: "business",
      name: t("planBusiness"),
      monthlyPrice: 9.5,
      annualPrice: 7.9,
      description: t("planBusinessDesc"),
      features: [
        t("featureUnlimitedAll"),
        t("featureDatev"),
        t("featureApi"),
        t("featureCustomRoles"),
        t("featureAnalytics"),
        t("featurePrioritySupport"),
        t("feature14DayTrial"),
      ],
      highlighted: false,
      isFree: false,
      isEnterprise: false,
    },
    {
      id: "enterprise",
      name: t("planEnterprise"),
      monthlyPrice: 0,
      annualPrice: 0,
      description: t("planEnterpriseDesc"),
      features: [
        t("featureEverythingBusiness"),
        t("featureSso"),
        t("featureSla"),
        t("featureCustomIntegrations"),
        t("featureDedicatedManager"),
      ],
      highlighted: false,
      isFree: false,
      isEnterprise: true,
    },
  ];

  const currentPlan = subscription?.plan?.toLowerCase() ?? "starter";

  const handleCheckout = async (planId: string) => {
    if (!user) return;
    setCheckoutLoading(planId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          billingCycle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? t("checkoutError"));
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg(t("checkoutError"));
      }
    } catch {
      setErrorMsg(t("checkoutError"));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? t("checkoutError"));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg(t("checkoutError"));
      }
    } catch {
      setErrorMsg(t("checkoutError"));
    } finally {
      setPortalLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: string }> = {
      ACTIVE: {
        label: t("statusActive"),
        variant: "bg-emerald-100 text-emerald-700",
      },
      TRIALING: {
        label: t("statusTrial"),
        variant: "bg-emerald-100 text-emerald-700",
      },
      PAST_DUE: {
        label: t("statusPastDue"),
        variant: "bg-red-100 text-red-700",
      },
      CANCELED: {
        label: t("statusCanceled"),
        variant: "bg-gray-100 text-gray-600",
      },
      UNPAID: {
        label: t("statusUnpaid"),
        variant: "bg-red-100 text-red-700",
      },
    };
    const s = map[status] ?? {
      label: status,
      variant: "bg-gray-100 text-gray-600",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.variant}`}
      >
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div>
        <Topbar title={t("title")} description={t("description")} />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />
      <div className="p-4 sm:p-6 space-y-6">
        {/* Success message */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircleIcon className="h-5 w-5 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-700">
            <AlertTriangleIcon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sandbox mode banner */}
        {subscription?.simulationMode && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
            <BeakerIcon className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("sandboxBanner")}</p>
              <p className="mt-0.5 text-amber-700">{t("sandboxBannerDesc")}</p>
            </div>
          </div>
        )}

        {/* ─── Current Plan Card ─── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>{t("currentPlan")}</CardTitle>
                <CardDescription>{t("currentPlanDesc")}</CardDescription>
              </div>
              {subscription && statusBadge(subscription.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("plan")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {subscription?.plan
                    ? t(
                        `plan${subscription.plan.charAt(0)}${subscription.plan.slice(1).toLowerCase()}`,
                      )
                    : t("planStarter")}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("seats")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {subscription?.seatCount ?? 1}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("employees")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {subscription?.limits.maxEmployees === Infinity ||
                  (subscription?.limits.maxEmployees ?? 0) > 10000
                    ? t("unlimited")
                    : (subscription?.limits.maxEmployees ?? 5)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("renewalDate")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {subscription?.currentPeriodEnd
                    ? new Date(
                        subscription.currentPeriodEnd,
                      ).toLocaleDateString(locale === "en" ? "en-GB" : "de-DE")
                    : "—"}
                </p>
                {subscription?.cancelAtPeriodEnd && (
                  <p className="mt-1 text-xs text-red-600">
                    {t("cancelsAtEnd")}
                  </p>
                )}
              </div>
            </div>

            {/* Manage Subscription Button */}
            {currentPlan !== "starter" && (
              <div className="mt-6">
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md disabled:opacity-60"
                >
                  {portalLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  ) : (
                    <ShieldCheckIcon className="h-4 w-4 text-gray-500" />
                  )}
                  {t("manageSubscription")}
                </button>
                <p className="mt-2 text-xs text-gray-400">
                  {t("manageSubscriptionDesc")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Billing Cycle Toggle ─── */}
        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                billingCycle === "annual"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("annual")}
            </button>
          </div>
          {billingCycle === "annual" && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <ZapIcon className="h-3 w-3 mr-1" />
              {t("save17")}
            </Badge>
          )}
        </div>

        {/* ─── Plan Cards ─── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const price =
              billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-5 sm:p-6 flex flex-col transition-shadow ${
                  plan.highlighted
                    ? "border-emerald-500 ring-2 ring-emerald-500 bg-white shadow-lg shadow-emerald-100/50"
                    : isCurrentPlan
                      ? "border-emerald-300 bg-emerald-50/30 shadow-sm"
                      : "border-gray-200 bg-white shadow-sm hover:shadow-md"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1 text-xs font-bold text-white whitespace-nowrap">
                    {t("popular")}
                  </span>
                )}

                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>

                <div className="mt-4 flex flex-wrap items-baseline gap-1">
                  {plan.isFree ? (
                    <span className="text-3xl font-extrabold text-gray-900">
                      {t("free")}
                    </span>
                  ) : plan.isEnterprise ? (
                    <span className="text-2xl font-extrabold text-gray-900">
                      {t("custom")}
                    </span>
                  ) : (
                    <>
                      <span className="text-3xl font-extrabold text-gray-900">
                        {formatPrice(price)}
                      </span>
                      <span className="text-sm text-gray-400 break-words">
                        {t("perUserMonth")}
                      </span>
                    </>
                  )}
                </div>

                <p className="mt-2 text-sm text-gray-500 break-words">
                  {plan.description}
                </p>

                <ul className="mt-5 space-y-2.5 flex-1 min-w-0">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm min-w-0"
                    >
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700 break-words min-w-0">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrentPlan ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700">
                      <CheckCircleIcon className="h-4 w-4" />
                      {t("currentPlanLabel")}
                    </div>
                  ) : plan.isEnterprise ? (
                    <a
                      href="mailto:info@shiftfy.de"
                      className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md"
                    >
                      <StarIcon className="h-4 w-4" />
                      {t("contactSales")}
                    </a>
                  ) : plan.isFree ? (
                    <div className="flex items-center justify-center rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-400">
                      {t("includedFree")}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading !== null}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 ${
                        plan.highlighted
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:brightness-110"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md"
                      }`}
                    >
                      {checkoutLoading === plan.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <ArrowRightIcon className="h-4 w-4" />
                      )}
                      {currentPlan === "starter"
                        ? t("upgrade")
                        : t("switchPlan")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Payment Info ─── */}
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t("securePayment")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("securePaymentDesc")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                {/* Payment method icons */}
                <svg
                  className="h-8 w-auto"
                  viewBox="0 0 48 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    width="48"
                    height="32"
                    rx="4"
                    fill="#1A1F71"
                    fillOpacity="0.08"
                  />
                  <text
                    x="24"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="#1A1F71"
                  >
                    VISA
                  </text>
                </svg>
                <svg
                  className="h-8 w-auto"
                  viewBox="0 0 48 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    width="48"
                    height="32"
                    rx="4"
                    fill="#EB001B"
                    fillOpacity="0.08"
                  />
                  <text
                    x="24"
                    y="20"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#EB001B"
                  >
                    MC
                  </text>
                </svg>
                <svg
                  className="h-8 w-auto"
                  viewBox="0 0 48 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    width="48"
                    height="32"
                    rx="4"
                    fill="#0070BA"
                    fillOpacity="0.08"
                  />
                  <text
                    x="24"
                    y="20"
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="bold"
                    fill="#0070BA"
                  >
                    SEPA
                  </text>
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── FAQ Hints ─── */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("billingFaqTitle")}
          </h3>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <p>
              <strong>{t("faqCancel")}</strong> {t("faqCancelAnswer")}
            </p>
            <p>
              <strong>{t("faqInvoice")}</strong> {t("faqInvoiceAnswer")}
            </p>
            <p>
              <strong>{t("faqTax")}</strong> {t("faqTaxAnswer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
