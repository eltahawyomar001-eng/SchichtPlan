"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { RocketIcon, XIcon } from "@/components/icons";
import type { SessionUser } from "@/lib/types";
import { isAdmin } from "@/lib/authorization";

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
 * - For OWNER/ADMIN: shows an "Upgrade Now" button that routes to billing.
 * - For MANAGER/EMPLOYEE: shows a "Contact Administrator" message instead —
 *   they cannot upgrade the account themselves.
 */
export function UpgradeModal({
  open,
  planLimitError,
  onClose,
}: UpgradeModalProps) {
  const router = useRouter();
  const t = useTranslations("planLimit");
  const closeRef = useRef<HTMLButtonElement>(null);
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const canUpgrade = user ? isAdmin(user) : false;

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100 animate-fade-in">
        {/* Header */}
        <div className="flex items-start gap-3 p-6">
          <div className="flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-2.5 ring-1 ring-emerald-200/30">
            <RocketIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">{t("title")}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {planLimitError.limit
                ? t("limitReached", {
                    feature: featureLabel,
                    limit: planLimitError.limit,
                  })
                : t("featureGated", { feature: featureLabel })}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              {canUpgrade ? t("upgradeHint") : t("upgradeHintEmployee")}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1 hover:bg-gray-100 transition-colors"
          >
            <XIcon className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            {canUpgrade ? t("dismiss") : t("dismissEmployee")}
          </Button>
          {canUpgrade && (
            <Button size="sm" onClick={handleUpgrade}>
              <RocketIcon className="mr-1.5 h-4 w-4" />
              {t("upgradeCta")}
            </Button>
          )}
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
