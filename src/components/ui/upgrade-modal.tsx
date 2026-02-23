"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RocketIcon, XIcon } from "@/components/icons";

export interface PlanLimitError {
  error: "PLAN_LIMIT";
  message: string;
  feature: string;
  limit?: number;
}

interface UpgradeModalProps {
  open: boolean;
  planLimitError: PlanLimitError | null;
  onClose: () => void;
}

/**
 * Modal that appears when a 403 PLAN_LIMIT is returned from an API call.
 * Guides the user to the billing page to upgrade their plan.
 */
export function UpgradeModal({
  open,
  planLimitError,
  onClose,
}: UpgradeModalProps) {
  const router = useRouter();
  const t = useTranslations("planLimit");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleUpgrade = useCallback(() => {
    onClose();
    router.push("/einstellungen/abonnement");
  }, [onClose, router]);

  if (!open || !planLimitError) return null;

  const featureLabel = t(`features.${planLimitError.feature}`, {
    // Fallback to raw feature name if key not found
    default: planLimitError.feature,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md mx-4 rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-3 p-6">
          <div className="flex-shrink-0 rounded-full bg-indigo-100 p-2.5">
            <RocketIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("title")}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {planLimitError.limit
                ? t("limitReached", {
                    feature: featureLabel,
                    limit: planLimitError.limit,
                  })
                : t("featureGated", { feature: featureLabel })}
            </p>
            <p className="mt-3 text-sm text-gray-500">{t("upgradeHint")}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1 hover:bg-gray-100"
          >
            <XIcon className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("dismiss")}
          </Button>
          <Button size="sm" onClick={handleUpgrade}>
            <RocketIcon className="mr-1.5 h-4 w-4" />
            {t("upgradeCta")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility to check if a fetch Response is a PLAN_LIMIT error.
 * Returns the parsed error body, or null if it's not a plan-limit error.
 */
export async function parsePlanLimitError(
  res: Response,
): Promise<PlanLimitError | null> {
  if (res.status !== 403) return null;

  try {
    const body = await res.clone().json();
    if (body?.error === "PLAN_LIMIT") {
      return body as PlanLimitError;
    }
  } catch {
    // Not JSON or not our error shape
  }
  return null;
}
