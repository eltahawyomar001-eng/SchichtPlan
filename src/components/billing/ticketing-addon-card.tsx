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

type Tier = "NONE" | "STARTER" | "GROWTH" | "BUSINESS";

interface TierConfig {
  id: Tier;
  name: string;
  priceMonthlyCents: number;
  ticketsPerMonth: number;
  storageGb: number;
  storageBytes: string;
}

interface AddonsResponse {
  ticketing: {
    tier: Tier;
    active: boolean;
    tierConfig: TierConfig | null;
    usage: {
      ticketsCreated: number;
      ticketsLimit: number;
      storageBytesUsed: string;
      storageBytesLimit: string;
      resetAt: string | null;
    };
  };
  availableTiers: TierConfig[];
}

const TIER_ORDER: Record<Tier, number> = {
  NONE: 0,
  STARTER: 1,
  GROWTH: 2,
  BUSINESS: 3,
};

function formatBytes(bytesStr: string, locale: string): string {
  try {
    const bytes = BigInt(bytesStr);
    const gb = Number(bytes) / 1024 ** 3;
    if (gb >= 1) {
      return `${gb.toLocaleString(locale, { maximumFractionDigits: 2 })} GB`;
    }
    const mb = Number(bytes) / 1024 ** 2;
    return `${mb.toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
  } catch {
    return "0 MB";
  }
}

function formatPrice(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
  });
}

export function TicketingAddonCard() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const [data, setData] = useState<AddonsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/addons");
      if (res.ok) setData((await res.json()) as AddonsResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = useCallback(
    async (tier: Tier) => {
      if (tier === "NONE") {
        if (!confirm(t("ticketingAddonCancelConfirm"))) return;
      }
      setPendingTier(tier);
      setError(null);
      try {
        const res = await fetch("/api/billing/addons/ticketing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier }),
        });
        if (!res.ok) {
          setError(t("ticketingAddonError"));
        } else {
          await load();
        }
      } catch {
        setError(t("ticketingAddonError"));
      } finally {
        setPendingTier(null);
      }
    },
    [t, load],
  );

  if (loading) {
    return (
      <Card id="ticketing-addon">
        <CardContent className="py-12 text-center text-sm text-gray-500">
          …
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const { ticketing, availableTiers } = data;
  const currentRank = TIER_ORDER[ticketing.tier];
  const ticketPct = ticketing.usage.ticketsLimit
    ? Math.min(
        100,
        (ticketing.usage.ticketsCreated / ticketing.usage.ticketsLimit) * 100,
      )
    : 0;
  const storageUsed = Number(BigInt(ticketing.usage.storageBytesUsed));
  const storageLimit = Number(BigInt(ticketing.usage.storageBytesLimit));
  const storagePct = storageLimit
    ? Math.min(100, (storageUsed / storageLimit) * 100)
    : 0;

  return (
    <Card id="ticketing-addon" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t("ticketingAddonTitle")}</CardTitle>
            <CardDescription className="mt-1">
              {t("ticketingAddonDescription")}
            </CardDescription>
          </div>
          {ticketing.active ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              {t("ticketingAddonActive")}
            </Badge>
          ) : (
            <Badge variant="outline">{t("ticketingAddonInactive")}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Current usage (only when active) */}
        {ticketing.active && ticketing.tierConfig && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {t("ticketingAddonCurrentTier")}
                </div>
                <div className="mt-0.5 text-base font-semibold text-gray-900">
                  {ticketing.tierConfig.name} ·{" "}
                  {formatPrice(ticketing.tierConfig.priceMonthlyCents, locale)}
                  {t("ticketingAddonPerMonth")}
                </div>
              </div>
              {ticketing.usage.resetAt && (
                <div className="text-right text-xs text-gray-500">
                  {t("ticketingAddonResetAt")}
                  <br />
                  <span className="font-medium text-gray-700">
                    {new Date(ticketing.usage.resetAt).toLocaleDateString(
                      locale,
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Tickets bar */}
            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-600">
                  {t("ticketingAddonUsageTickets")}
                </span>
                <span className="font-medium text-gray-900">
                  {ticketing.usage.ticketsCreated} /{" "}
                  {ticketing.usage.ticketsLimit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    ticketPct >= 90
                      ? "bg-red-500"
                      : ticketPct >= 75
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${ticketPct}%` }}
                />
              </div>
            </div>

            {/* Storage bar */}
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-600">
                  {t("ticketingAddonUsageStorage")}
                </span>
                <span className="font-medium text-gray-900">
                  {formatBytes(ticketing.usage.storageBytesUsed, locale)} /{" "}
                  {formatBytes(ticketing.usage.storageBytesLimit, locale)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    storagePct >= 90
                      ? "bg-red-500"
                      : storagePct >= 75
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tier comparison cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {availableTiers.map((tier) => {
            const tierRank = TIER_ORDER[tier.id];
            const isCurrent = ticketing.tier === tier.id;
            const isUpgrade = tierRank > currentRank;
            const isDowngrade = tierRank < currentRank && currentRank > 0;
            const isPending = pendingTier === tier.id;
            const label = isCurrent
              ? null
              : !ticketing.active
                ? t("ticketingAddonSubscribe")
                : isUpgrade
                  ? t("ticketingAddonUpgrade")
                  : t("ticketingAddonDowngrade");

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-xl border p-4 transition-shadow ${
                  isCurrent
                    ? "border-emerald-500 bg-emerald-50/30 shadow-sm"
                    : "border-gray-200 bg-white hover:shadow-sm"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-2 right-3">
                    <Badge className="bg-emerald-600 text-white">
                      <CheckCircleIcon className="mr-1 h-3 w-3" />
                      {t("ticketingAddonActive")}
                    </Badge>
                  </div>
                )}
                <div className="text-base font-semibold text-gray-900">
                  {tier.name}
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {formatPrice(tier.priceMonthlyCents, locale)}
                  <span className="text-sm font-normal text-gray-500">
                    {t("ticketingAddonPerMonth")}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
                  <li>
                    {tier.ticketsPerMonth.toLocaleString(locale)}{" "}
                    {t("ticketingAddonTicketsPerMonth")}
                  </li>
                  <li>
                    {tier.storageGb} {t("ticketingAddonStorageGb")}
                  </li>
                </ul>
                {!isCurrent && label && (
                  <button
                    type="button"
                    onClick={() => handleChange(tier.id)}
                    disabled={pendingTier !== null}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      isUpgrade || !ticketing.active
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {isPending ? t("ticketingAddonProcessing") : label}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel button */}
        {ticketing.active && (
          <div className="flex justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => handleChange("NONE")}
              disabled={pendingTier !== null}
              className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {pendingTier === "NONE"
                ? t("ticketingAddonProcessing")
                : t("ticketingAddonCancel")}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
