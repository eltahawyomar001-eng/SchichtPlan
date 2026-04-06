"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ShieldCheckIcon, AlertTriangleIcon } from "@/components/icons";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────

interface ESignatureRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  signedBy: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  signatureHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  statement: string;
  signedAt: string;
  workspaceId: string;
  isValid: boolean;
}

interface ESignatureBadgeProps {
  entityType: string;
  entityId: string;
  /** Compact mode shows only the badge; full mode shows inline details */
  compact?: boolean;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * Reusable e-signature display component.
 *
 * Fetches and renders e-signature records for any entity (absence,
 * time entry, shift swap, etc.). Shows a verified/invalid badge with
 * expandable details per industry standard (eIDAS SES).
 */
export function ESignatureBadge({
  entityType,
  entityId,
  compact = false,
}: ESignatureBadgeProps) {
  const t = useTranslations("eSignature");
  const locale = useLocale();
  const dateFnsLocale = locale === "de" ? de : enUS;

  const [signatures, setSignatures] = useState<ESignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchSignatures = useCallback(async () => {
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch(`/api/e-signatures?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSignatures(data);
      }
    } catch {
      // Silently fail — signature display is non-critical
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  // Don't render anything if loading or no signatures
  if (loading || signatures.length === 0) return null;

  // Deduplicate: show only the latest (most recent) signature per action
  // This handles the case where duplicate signatures were created by rapid clicks
  const latestSignature = [...signatures].sort(
    (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime(),
  )[0];
  const deduped = [latestSignature];

  const allValid = deduped.every((s) => s.isValid);

  // ── Compact mode: just a small inline badge ───────────────
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-xs font-medium transition-colors rounded-full px-2 py-0.5 cursor-pointer"
        style={{
          backgroundColor: allValid ? "rgb(236 253 245)" : "rgb(254 242 242)",
          color: allValid ? "rgb(4 120 87)" : "rgb(185 28 28)",
        }}
        title={allValid ? t("integrityValid") : t("integrityInvalid")}
      >
        {allValid ? (
          <ShieldCheckIcon className="h-3 w-3" />
        ) : (
          <AlertTriangleIcon className="h-3 w-3" />
        )}
        <span>{t("verifiedBadge")}</span>
      </button>
    );
  }

  // ── Full mode: badge + expandable details ─────────────────
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors rounded-md px-2.5 py-1 cursor-pointer border"
        style={{
          backgroundColor: allValid ? "rgb(236 253 245)" : "rgb(254 242 242)",
          color: allValid ? "rgb(4 120 87)" : "rgb(185 28 28)",
          borderColor: allValid ? "rgb(167 243 208)" : "rgb(254 202 202)",
        }}
      >
        {allValid ? (
          <ShieldCheckIcon className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangleIcon className="h-3.5 w-3.5" />
        )}
        <span>{t("verifiedBadge")}</span>
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {deduped.map((sig) => (
            <div
              key={sig.id}
              className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 text-xs space-y-1.5"
            >
              {/* Integrity status */}
              <div className="flex items-center gap-1.5">
                {sig.isValid ? (
                  <>
                    <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-medium text-emerald-700">
                      {t("integrityValid")}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangleIcon className="h-3.5 w-3.5 text-red-600" />
                    <span className="font-medium text-red-700">
                      {t("integrityInvalid")}
                    </span>
                  </>
                )}
              </div>

              {/* Signer info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                <div>
                  <span className="text-gray-400">{t("signedBy")}:</span>{" "}
                  <span className="font-medium text-gray-700">
                    {sig.signerName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">{t("role")}:</span>{" "}
                  <span className="font-medium text-gray-700">
                    {t(`roles.${sig.signerRole}`)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">{t("signedAt")}:</span>{" "}
                  <span className="font-medium text-gray-700">
                    {format(new Date(sig.signedAt), "dd.MM.yyyy HH:mm:ss", {
                      locale: dateFnsLocale,
                    })}
                  </span>
                </div>
              </div>

              {/* Consent statement */}
              <div className="border-t border-gray-200/60 pt-1.5">
                <span className="text-gray-400 block mb-0.5">
                  {t("consentStatement")}:
                </span>
                <p className="text-gray-600 italic leading-relaxed">
                  &ldquo;{sig.statement}&rdquo;
                </p>
              </div>

              {/* Signature hash */}
              <div className="border-t border-gray-200/60 pt-1.5">
                <span className="text-gray-400">{t("hashLabel")}:</span>{" "}
                <code className="text-[10px] text-gray-500 font-mono break-all">
                  {sig.signatureHash}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
