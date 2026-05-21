"use client";

import { cn } from "@/lib/utils";

interface TierStats {
  tier: number;
  notified: number;
  pending: number;
  accepted: number;
  declined: number;
}

interface Props {
  tiers: TierStats[];
  currentTier: number;
  status: "OPEN" | "FILLED" | "CANCELLED" | "EXPIRED";
}

const TIER_CAPACITY = [5, 10, 20];

/**
 * Three-column escalation visualizer.
 *
 * Every tier card uses the EXACT same internal layout so heights,
 * paddings, and label positions line up across active / inactive /
 * filled states. Only colors and the dashed border style change.
 */
export function TierProgress({ tiers, currentTier, status }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((t) => {
        const stat = tiers.find((s) => s.tier === t) ?? {
          tier: t,
          notified: 0,
          pending: 0,
          accepted: 0,
          declined: 0,
        };
        const capacity = TIER_CAPACITY[t - 1];
        const isActive = status === "OPEN" && currentTier === t;
        const isReached = currentTier >= t;
        const isFilled = stat.accepted > 0;
        const isInactive = !isReached && !isFilled;

        return (
          <div
            key={t}
            className={cn(
              "rounded-xl border p-4 flex flex-col transition-colors duration-500 ease-out",
              isFilled
                ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/10"
                : isActive
                  ? "border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10"
                  : isReached
                    ? "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    : "border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30",
              isInactive && "opacity-60",
            )}
          >
            {/* Row 1 — fixed-height label bar (h-5 reserves space whether
                the "Aktiv" pill renders or not, so all 3 cards stay
                vertically aligned) */}
            <div className="flex items-center justify-between h-5">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  isFilled
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isActive
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-400 dark:text-zinc-500",
                )}
              >
                Tier {t}
              </p>
              {isActive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  Aktiv
                </span>
              ) : (
                <span aria-hidden className="h-1.5 w-1.5" />
              )}
            </div>

            {/* Row 2 — counter (consistent vertical rhythm via mt-2) */}
            <p className="mt-2 text-2xl font-bold tabular-nums leading-none text-gray-900 dark:text-zinc-100">
              {stat.notified}
              <span className="text-sm font-medium text-gray-400 dark:text-zinc-500 ml-1">
                / {capacity}
              </span>
            </p>

            {/* Row 3 — capacity meter */}
            <div className="mt-3 flex flex-wrap gap-1">
              {Array.from({ length: capacity }).map((_, i) => {
                const filled = i < stat.notified;
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 min-w-0 rounded-full transition-colors duration-700",
                      filled
                        ? stat.accepted > 0 && i === 0
                          ? "bg-emerald-500"
                          : isActive
                            ? "bg-red-500"
                            : "bg-gray-300 dark:bg-zinc-600"
                        : "bg-gray-100 dark:bg-zinc-800",
                    )}
                    style={{ transitionDelay: `${i * 30}ms` }}
                  />
                );
              })}
            </div>

            {/* Row 4 — secondary stats. min-h preserves vertical rhythm
                across cards even when this row has zero content. */}
            <div className="mt-3 flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-zinc-400 min-h-[16px]">
              {stat.accepted > 0 && (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {stat.accepted} angenommen
                </span>
              )}
              {stat.declined > 0 && (
                <span className="text-red-500">{stat.declined} abgelehnt</span>
              )}
              {stat.pending > 0 && status === "OPEN" && (
                <span>{stat.pending} offen</span>
              )}
              {/* zero-width spacer keeps the row baseline aligned when
                  all three counters are absent (inactive tiers) */}
              {stat.accepted === 0 &&
                stat.declined === 0 &&
                stat.pending === 0 && <span aria-hidden>&nbsp;</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
