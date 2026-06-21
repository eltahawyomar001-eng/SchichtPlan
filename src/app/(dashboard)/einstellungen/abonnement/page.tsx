"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
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
import { PageContent } from "@/components/ui/page-content";
import {
  CheckCircleIcon,
  ZapIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  StarIcon,
  AlertTriangleIcon,
  BeakerIcon,
  TicketIcon,
} from "@/components/icons";
import { SchichtplanungAddonCard } from "@/components/billing/schichtplanung-addon-card";
import { TimesheetScannerAddonCard } from "@/components/billing/timesheet-scanner-addon-card";
import { UsageDashboard } from "@/components/billing/usage-dashboard";
import { WorkspaceBillingInfo } from "@/components/billing/workspace-billing-info";
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
  ticketingTier: string;
  hasStripeSubscription: boolean;
  limits: {
    maxEmployees: number;
    maxLocations: number;
    storageMb: number;
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

interface PublicPlanData {
  id: string;
  name: string;
  perUserMonthlyCents: number;
  perUserAnnualCents: number;
  limits: SubscriptionData["limits"];
}

interface TicketingTierData {
  id: string;
  name: string;
  priceMonthlyCents: number;
  ticketsPerMonth: number;
  storageGb: number;
}

interface PlanOption {
  id: string;
  name: string;
  perUserMonthlyCents: number;
  perUserAnnualCents: number;
  description: string;
  features: string[];
  highlighted: boolean;
  isEnterprise: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   Fallback tiers (used when /api/public/plans fails to load)
   ═══════════════════════════════════════════════════════════════ */

const FALLBACK_TICKETING_TIERS: TicketingTierData[] = [
  {
    id: "STARTER",
    name: "Ticketing Starter",
    priceMonthlyCents: 1899,
    ticketsPerMonth: 200,
    storageGb: 5,
  },
  {
    id: "GROWTH",
    name: "Ticketing Growth",
    priceMonthlyCents: 3399,
    ticketsPerMonth: 500,
    storageGb: 15,
  },
  {
    id: "BUSINESS",
    name: "Ticketing Business",
    priceMonthlyCents: 5599,
    ticketsPerMonth: 1000,
    storageGb: 40,
  },
];

/* ─── Invoice list ─── */

interface InvoiceRow {
  id: string;
  invoiceNumber: string | null;
  issuedAt: string;
  amount: number;
  vatAmount: number | null;
  currency: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

function InvoiceList() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (invoices.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Rechnungen
      </h3>
      <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
        {invoices.map((inv) => {
          const date = new Date(inv.issuedAt).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const gross = (inv.amount / 100).toLocaleString("de-DE", {
            style: "currency",
            currency: inv.currency.toUpperCase(),
          });
          return (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-gray-900 dark:text-white">
                  {inv.invoiceNumber ?? date}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  {date} · {gross}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inv.pdfUrl && (
                  <a
                    href={inv.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    PDF
                  </a>
                )}
                {inv.hostedUrl && (
                  <a
                    href={inv.hostedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Öffnen
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════════════ */

function BillingContent() {
  const { data: session } = useSession();
  const t = useTranslations("billing");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const user = session?.user as SessionUser | undefined;

  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [publicPlans, setPublicPlans] = useState<PublicPlanData[]>([]);
  const [ticketingTiers, setTicketingTiers] = useState<TicketingTierData[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "annual",
  );
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [ticketingLoading, setTicketingLoading] = useState(false);
  const [ticketingPendingTier, setTicketingPendingTier] = useState<
    string | null
  >(null);
  const [ticketingSuccessMsg, setTicketingSuccessMsg] = useState<string | null>(
    null,
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ticketingRef = useRef<HTMLDivElement>(null);
  const schichtplanungRef = useRef<HTMLDivElement>(null);

  // ── Seat-quantity drift detection (Stripe ↔ employee count) ──
  const [seatDrift, setSeatDrift] = useState<{
    employeeCount: number;
    stripeQuantity: number | null;
    inSync: boolean;
    reason?: string;
  } | null>(null);
  const [seatSyncLoading, setSeatSyncLoading] = useState(false);
  const [seatSyncMsg, setSeatSyncMsg] = useState<string | null>(null);

  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    const billingParam = searchParams.get("billing");
    const portalParam = searchParams.get("portal");
    const addonParam = searchParams.get("addon");

    if (billingParam === "success") {
      setSuccessMsg(t("checkoutSuccess"));
      // Trigger a server-side Stripe sync so features unlock immediately
      // without waiting for the webhook (FIX C-4).
      fetch("/api/billing/sync", { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => {});
      fetch("/api/billing/subscription?reconcile=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setSubscription(data);
        })
        .catch(() => {});
      window.history.replaceState({}, "", "/einstellungen/abonnement");
    }
    if (portalParam === "success") {
      setSuccessMsg(t("portalReturnSuccess"));
      fetch("/api/billing/subscription?reconcile=1")
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
    if (addonParam === "ticketing") {
      setTimeout(() => {
        ticketingRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 600);
    }
    if (addonParam === "schichtplanung") {
      setTimeout(() => {
        schichtplanungRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchSubscription = useCallback(async (reconcile = false) => {
    try {
      const url = reconcile
        ? "/api/billing/subscription?reconcile=1"
        : "/api/billing/subscription";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
        // Sync the billing-cycle toggle to reflect the actual subscription
        if (data.billingCycle === "monthly" || data.billingCycle === "annual") {
          setBillingCycle(data.billingCycle);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription(true);
  }, [fetchSubscription]);

  // ── Drift check: compare live Stripe quantity vs active employee count ──
  // Only meaningful for workspaces with a real (non-sim) Stripe subscription.
  const fetchSeatDrift = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/seats/reconcile");
      if (res.ok) setSeatDrift(await res.json());
    } catch {
      // silent — drift card just won't render
    }
  }, []);

  useEffect(() => {
    if (subscription?.hasStripeSubscription) fetchSeatDrift();
  }, [subscription?.hasStripeSubscription, fetchSeatDrift]);

  // Load public plan pricing (source of truth for displayed prices)
  useEffect(() => {
    fetch("/api/public/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans) setPublicPlans(data.plans);
        if (data?.ticketingTiers) setTicketingTiers(data.ticketingTiers);
      })
      .catch(() => {});
  }, []);

  // Auto-trigger checkout if user came from landing page with a plan.
  // Wait until subscription is loaded so handleCheckout sees the correct
  // subscription state and the billing-cycle toggle is already synced.
  const autoCheckoutFired = useRef(false);
  useEffect(() => {
    if (loading || autoCheckoutFired.current) return;
    const storedPlan = localStorage.getItem("shiftfy_selected_plan");
    const storedBilling = localStorage.getItem("shiftfy_selected_billing");
    if (
      storedPlan &&
      (storedPlan === "basic" || storedPlan === "professional")
    ) {
      autoCheckoutFired.current = true;
      localStorage.removeItem("shiftfy_selected_plan");
      localStorage.removeItem("shiftfy_selected_billing");
      if (storedBilling === "monthly" || storedBilling === "annual") {
        setBillingCycle(storedBilling);
      }
      handleCheckout(storedPlan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Build plan options — prices come from /api/public/plans so they match stripe.ts
  const getPlanPrices = (planId: string) => {
    const p = publicPlans.find((pl) => pl.id === planId);
    return {
      perUserMonthlyCents: p?.perUserMonthlyCents ?? 0,
      perUserAnnualCents: p?.perUserAnnualCents ?? 0,
    };
  };

  const plans: PlanOption[] = [
    {
      id: "basic",
      name: t("planBasic"),
      ...getPlanPrices("basic"),
      description: t("planBasicDesc"),
      features: [
        t("featureEmployees10"),
        t("featureLocation1"),
        t("featureStorage500mb"),
        t("featureTemplates"),
        t("featureAbsences"),
        t("featureCsvPdfExport"),
      ],
      highlighted: false,
      isEnterprise: false,
    },
    {
      id: "professional",
      name: t("planProfessional"),
      ...getPlanPrices("professional"),
      description: t("planProfessionalDesc"),
      features: [
        t("featureEmployees50"),
        t("featureLocations5"),
        t("featureStorage5gb"),
        t("featureEverythingBasic"),
        t("featureAutoScheduling"),
        t("featureDatev"),
        t("featureApi"),
        t("featureCustomRoles"),
        t("featureAnalytics"),
        t("featurePrioritySupport"),
      ],
      highlighted: true,
      isEnterprise: false,
    },
    {
      id: "enterprise",
      name: t("planEnterprise"),
      perUserMonthlyCents: 0,
      perUserAnnualCents: 0,
      description: t("planEnterpriseDesc"),
      features: [
        t("featureUnlimitedAll"),
        t("featureEverythingPro"),
        t("featureSso"),
        t("featureSla"),
        t("featureCustomIntegrations"),
        t("featureDedicatedManager"),
      ],
      highlighted: false,
      isEnterprise: true,
    },
  ];

  const currentPlan = subscription?.plan?.toLowerCase() ?? "basic";
  const isRequired = searchParams.get("required") === "1";

  // Map server-side error codes to localized fallbacks so German-only API
  // messages don't leak into the English UI.
  const localizeErr = (
    data: { error?: string; message?: string } | null | undefined,
    fallbackKey: "checkoutError" | "upgradeError" | "ticketingAddonError",
  ): string => {
    const code = data?.error;
    const codeMap: Record<string, string> = {
      ENTERPRISE_CONTACT_SALES: t("errorEnterpriseContactSales"),
      NO_BASE_SUBSCRIPTION: t("noBaseSubscription"),
      NO_STRIPE_SUBSCRIPTION: t("noBaseSubscription"),
      STRIPE_NOT_CONFIGURED: t("checkoutError"),
      STRIPE_CHECKOUT_FAILED: t("checkoutError"),
      STRIPE_UPGRADE_FAILED: t("errorStripeFailed"),
      STRIPE_UPDATE_FAILED: t("errorStripeFailed"),
      PRICE_NOT_CONFIGURED: t("errorPriceNotConfigured"),
      PAYMENT_REQUIRED: t("errorPaymentRequired"),
    };
    if (code && codeMap[code]) return codeMap[code];
    // Unknown error: fall back to translation rather than potentially
    // German server message.
    return t(fallbackKey);
  };

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
        setErrorMsg(localizeErr(data, "checkoutError"));
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

  const handleUpgrade = async (planId: string) => {
    if (!user) return;
    setUpgradeLoading(planId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, billingCycle }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(localizeErr(data, "upgradeError"));
        return;
      }

      // Reload the enriched subscription shape from the GET endpoint so the
      // UI has `limits`, `billingCycle`, etc. The raw Prisma row in
      // `data.subscription` is missing those and would crash render.
      try {
        const reconciled = await fetch("/api/billing/subscription?reconcile=1");
        if (reconciled.ok) {
          const d = await reconciled.json();
          setSubscription(d);
          if (d.billingCycle === "monthly" || d.billingCycle === "annual") {
            setBillingCycle(d.billingCycle);
          }
        }
      } catch {
        // non-fatal — server-state refresh below will recover
      }
      setSuccessMsg(t("upgradeSuccess"));
      // Refresh server components so any guards/usage widgets reflect new plan.
      router.refresh();
    } catch {
      setErrorMsg(t("upgradeError"));
    } finally {
      setUpgradeLoading(null);
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
        setErrorMsg(localizeErr(data, "checkoutError"));
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

  const handleForceSync = async () => {
    setSeatSyncLoading(true);
    setSeatSyncMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/billing/seats/reconcile", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(t("forceSyncError"));
        return;
      }
      if (data.changed) {
        setSeatSyncMsg(
          t("forceSyncUpdated", { before: data.before, after: data.after }),
        );
      } else {
        setSeatSyncMsg(t("forceSyncAlreadyInSync"));
      }
      await fetchSeatDrift();
      await fetchSubscription(true);
      // Tell the Usage & Limits card to re-fetch so all three views (sync
      // box, usage bar, seats card) snap to the same number immediately.
      window.dispatchEvent(new Event("shiftfy:usage-changed"));
    } catch {
      setErrorMsg(t("forceSyncError"));
    } finally {
      setSeatSyncLoading(false);
    }
  };

  const handleTicketingChange = async (tier: string) => {
    const isCanceling = tier === "NONE";
    const currentTier = subscription?.ticketingTier ?? "NONE";

    setTicketingLoading(true);
    setTicketingPendingTier(null);
    setTicketingSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/billing/addons/ticketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(localizeErr(data, "ticketingAddonError"));
        return;
      }
      await fetchSubscription(false);
      if (isCanceling) {
        setTicketingSuccessMsg(t("ticketingAddonCanceled"));
      } else if (currentTier !== "NONE") {
        setTicketingSuccessMsg(t("ticketingAddonTierChanged"));
      } else {
        setTicketingSuccessMsg(t("ticketingAddonActivated"));
      }
    } catch {
      setErrorMsg(t("ticketingAddonError"));
    } finally {
      setTicketingLoading(false);
    }
  };

  const formatCents = (cents: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(cents / 100);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "de-DE");

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
        variant: "bg-gray-100 dark:bg-zinc-800 text-gray-600",
      },
      UNPAID: {
        label: t("statusUnpaid"),
        variant: "bg-red-100 text-red-700",
      },
    };
    const s = map[status] ?? {
      label: status,
      variant: "bg-gray-100 dark:bg-zinc-800 text-gray-600",
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
      <PageContent>
        {/* Subscription required banner (redirected from dashboard gate) */}
        {isRequired && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-4 text-sm text-amber-900">
            <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold text-base">
                {t("subscriptionRequiredTitle")}
              </p>
              <p className="mt-0.5 text-amber-800">
                {t("subscriptionRequiredDescription")}
              </p>
            </div>
          </div>
        )}

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

        {/* Cancel-at-period-end warning */}
        {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
          <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-800">
            <AlertTriangleIcon className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <p className="font-semibold">
                {t("cancelScheduledWarning", {
                  date: formatDate(subscription.currentPeriodEnd),
                })}
              </p>
              <p className="mt-0.5 text-red-700">
                {t("resumeSubscriptionDesc")}
              </p>
            </div>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors"
            >
              {portalLoading ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
              ) : null}
              {t("resumeSubscription")}
            </button>
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
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("plan")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {subscription?.plan
                    ? t(
                        `plan${subscription.plan.charAt(0)}${subscription.plan.slice(1).toLowerCase()}`,
                      )
                    : t("planBasic")}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("seats")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {subscription?.seatCount ?? 1}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("employees")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {subscription?.limits?.maxEmployees === Infinity ||
                  (subscription?.limits?.maxEmployees ?? 0) > 10000
                    ? t("unlimited")
                    : (subscription?.limits?.maxEmployees ?? 5)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("renewalDate")}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {subscription?.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : "—"}
                </p>
              </div>
            </div>

            {/* Stripe Customer Portal — manage billing details, invoices, cancellation */}
            {subscription?.hasStripeSubscription && (
              <div className="mt-6">
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-md disabled:opacity-60"
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

            {/* ─── Seat-quantity sync (Stripe ↔ employee count) ─── */}
            {subscription?.hasStripeSubscription && seatDrift && (
              <div
                className={`mt-6 rounded-xl border p-4 ${
                  seatDrift.inSync
                    ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30"
                    : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        seatDrift.inSync
                          ? "text-emerald-800 dark:text-emerald-200"
                          : "text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      {seatDrift.inSync
                        ? t("seatSyncInSyncTitle")
                        : t("seatSyncDriftTitle")}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">
                      {t("seatSyncStatus", {
                        employees: seatDrift.employeeCount,
                        seats: seatDrift.stripeQuantity ?? 0,
                      })}
                    </p>
                    {seatSyncMsg && (
                      <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {seatSyncMsg}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleForceSync}
                    disabled={seatSyncLoading}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all disabled:opacity-60 ${
                      seatDrift.inSync
                        ? "border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    }`}
                  >
                    {seatSyncLoading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    )}
                    {t("forceSyncButton")}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500">
                  {t("forceSyncDesc")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Usage & Limits Dashboard ─── */}
        <UsageDashboard />

        {/* ─── Company Billing Info (WorkspaceCustomer) ─── */}
        <WorkspaceBillingInfo />

        {/* ─── Pricing + Billing Cycle Toggle ─── */}
        <div
          id="pricing"
          className="flex flex-col items-center gap-3 scroll-mt-20"
        >
          <div className="inline-flex items-center rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 shadow-sm">
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const perUserCents =
              billingCycle === "annual"
                ? plan.perUserAnnualCents
                : plan.perUserMonthlyCents;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-5 sm:p-6 flex flex-col transition-shadow ${
                  plan.highlighted
                    ? "border-emerald-500 ring-2 ring-emerald-500 bg-white dark:bg-zinc-900 shadow-lg shadow-emerald-100/50"
                    : isCurrentPlan
                      ? "border-emerald-300 bg-emerald-50/30 shadow-sm"
                      : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1 text-xs font-bold text-white whitespace-nowrap">
                    {t("popular")}
                  </span>
                )}

                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>

                <div className="mt-4">
                  {plan.isEnterprise ? (
                    <>
                      <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {t("custom")}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {t("enterpriseMinPrice")}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                          {perUserCents > 0 ? formatCents(perUserCents) : "—"}
                        </span>
                        <span className="text-sm text-gray-400 break-words">
                          {t("perUserMonth")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {billingCycle === "annual"
                          ? t("billedAnnually")
                          : t("billedMonthly")}
                      </p>
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
                      href="mailto:info@bashabsheh-vergabepartner.de"
                      className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-zinc-700 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-md"
                    >
                      <StarIcon className="h-4 w-4" />
                      {t("contactSales")}
                    </a>
                  ) : subscription?.hasStripeSubscription ? (
                    // Existing subscriber — switch plan directly via upgrade endpoint
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={
                        upgradeLoading !== null || checkoutLoading !== null
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 ${
                        plan.highlighted
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:brightness-110"
                          : "border border-gray-200 dark:border-zinc-700 text-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-md"
                      }`}
                    >
                      {upgradeLoading === plan.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <ArrowRightIcon className="h-4 w-4" />
                      )}
                      {upgradeLoading === plan.id
                        ? t("upgradingPlan")
                        : t("upgradePlan")}
                    </button>
                  ) : (
                    // No active subscription yet — go through checkout
                    <button
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading !== null}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-60 ${
                        plan.highlighted
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:brightness-110"
                          : "border border-gray-200 dark:border-zinc-700 text-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:shadow-md"
                      }`}
                    >
                      {checkoutLoading === plan.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <ArrowRightIcon className="h-4 w-4" />
                      )}
                      {t("subscribeToPlan")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Ticketing Add-on Section ─── */}
        {(() => {
          const displayTiers =
            ticketingTiers.length > 0
              ? ticketingTiers
              : FALLBACK_TICKETING_TIERS;
          const pendingTierData = displayTiers.find(
            (t) => t.id === ticketingPendingTier,
          );
          return (
            <div
              ref={ticketingRef}
              id="ticketing-addon"
              className="scroll-mt-6"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 p-2.5">
                      <TicketIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <CardTitle>{t("ticketingAddonSectionTitle")}</CardTitle>
                      <CardDescription>
                        {t("ticketingAddonSectionDesc")}
                      </CardDescription>
                    </div>
                    {subscription?.ticketingTier &&
                      subscription.ticketingTier !== "NONE" && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950/50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                          <CheckCircleIcon className="h-3 w-3" />
                          {t("ticketingAddonActiveTier")}:{" "}
                          {subscription.ticketingTier}
                        </span>
                      )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Per-section success message */}
                  {ticketingSuccessMsg && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircleIcon className="h-4 w-4 shrink-0" />
                      {ticketingSuccessMsg}
                    </div>
                  )}

                  {/* Trial gate — addons need a real paid Stripe subscription */}
                  {subscription &&
                    !subscription.hasStripeSubscription &&
                    (!subscription.ticketingTier ||
                      subscription.ticketingTier === "NONE") && (
                      <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        {t("addonRequiresPaidPlan")}{" "}
                        <a
                          href="#pricing"
                          className="font-semibold underline underline-offset-2 hover:opacity-80"
                        >
                          {t("addonRequiresPaidPlanCta")}
                        </a>
                      </div>
                    )}

                  {/* Auto-charge info */}
                  <p className="mb-4 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <ShieldCheckIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {t("addonAutoCharge")}
                  </p>

                  {/* Inline confirmation panel */}
                  {ticketingPendingTier !== null && (
                    <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                      {ticketingPendingTier === "NONE" ? (
                        <>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            {t("ticketingAddonConfirmCancel")}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                            {t("ticketingAddonConfirmChange", {
                              tier:
                                pendingTierData?.name ?? ticketingPendingTier,
                            })}
                          </p>
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            {pendingTierData
                              ? formatCents(pendingTierData.priceMonthlyCents)
                              : ""}
                            {t("billingAddonPerMonth")}
                          </p>
                        </>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() =>
                            handleTicketingChange(ticketingPendingTier)
                          }
                          disabled={ticketingLoading}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
                        >
                          {ticketingLoading && (
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          {t("confirmAction")}
                        </button>
                        <button
                          onClick={() => setTicketingPendingTier(null)}
                          disabled={ticketingLoading}
                          className="rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-60 transition-colors"
                        >
                          {t("cancelAction")}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {displayTiers.map((tier) => {
                      const isCurrent = subscription?.ticketingTier === tier.id;
                      const isPending = ticketingPendingTier === tier.id;
                      return (
                        <div
                          key={tier.id}
                          className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                            isCurrent
                              ? "border-violet-400 dark:border-violet-600 bg-violet-50/40 dark:bg-violet-950/20 shadow-sm"
                              : isPending
                                ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10"
                                : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                                {tier.name}
                              </p>
                              <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">
                                {formatCents(tier.priceMonthlyCents)}
                                <span className="text-sm font-normal text-gray-400">
                                  {t("billingAddonPerMonth")}
                                </span>
                              </p>
                            </div>
                            {isCurrent && (
                              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-bold text-white shrink-0">
                                ✓
                              </span>
                            )}
                          </div>
                          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                            <li>
                              {t("ticketingAddonTickets", {
                                count: tier.ticketsPerMonth,
                              })}
                            </li>
                            <li>
                              {t("ticketingAddonStorageLabel", {
                                gb: tier.storageGb,
                              })}
                            </li>
                          </ul>
                          {isCurrent ? (
                            <button
                              onClick={() => setTicketingPendingTier("NONE")}
                              disabled={
                                ticketingLoading ||
                                ticketingPendingTier !== null
                              }
                              className="mt-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-60 transition-colors"
                            >
                              {t("ticketingAddonCancelShort")}
                            </button>
                          ) : (
                            <button
                              onClick={() => setTicketingPendingTier(tier.id)}
                              disabled={
                                ticketingLoading ||
                                ticketingPendingTier !== null ||
                                // Add-ons attach to a real Stripe subscription —
                                // block the action (and avoid a raw API error)
                                // until the workspace has subscribed. The banner
                                // above explains why and links to the plans.
                                !subscription?.hasStripeSubscription
                              }
                              className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/50 disabled:opacity-60 transition-colors"
                            >
                              {subscription?.ticketingTier &&
                              subscription.ticketingTier !== "NONE"
                                ? t("ticketingAddonChange")
                                : t("ticketingAddonActivate")}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* ─── Schichtplanung Add-on Section ─── */}
        <div
          ref={schichtplanungRef}
          id="schichtplanung-addon"
          className="scroll-mt-6"
        >
          <SchichtplanungAddonCard
            hasStripeSubscription={subscription?.hasStripeSubscription ?? false}
          />
        </div>

        {/* ─── AI Timesheet Scanner Add-on Section ─── */}
        <div id="timesheet-scanner-addon" className="scroll-mt-6">
          <TimesheetScannerAddonCard
            hasStripeSubscription={subscription?.hasStripeSubscription ?? false}
          />
        </div>

        {/* ─── Payment Info ─── */}
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl stat-icon-emerald p-2.5">
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
                    className="fill-[#1A1F71]/10 dark:fill-[#1A1F71]/30"
                  />
                  <text
                    x="24"
                    y="20"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    className="fill-[#1A1F71] dark:fill-[#93c5fd]"
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
                    className="fill-[#EB001B]/10 dark:fill-[#EB001B]/30"
                  />
                  <text
                    x="24"
                    y="20"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    className="fill-[#EB001B] dark:fill-[#fca5a5]"
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
                    className="fill-[#0070BA]/10 dark:fill-[#0070BA]/30"
                  />
                  <text
                    x="24"
                    y="20"
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="bold"
                    className="fill-[#0070BA] dark:fill-[#93c5fd]"
                  >
                    SEPA
                  </text>
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Invoice History ─── */}
        <InvoiceList />

        {/* ─── FAQ Hints ─── */}
        <div className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
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
      </PageContent>
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
