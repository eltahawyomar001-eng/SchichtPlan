"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, CheckCircleIcon, XIcon } from "@/components/icons";

interface TourStep {
  /** CSS selector for the element to spotlight — null = center screen */
  target: string | null;
  /** Title of the step */
  title: string;
  /** Description text */
  description: string;
  /** Position of the tooltip relative to target */
  placement: "top" | "bottom" | "left" | "right" | "center";
}

const STORAGE_KEY = "shiftfy-tour-completed";

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: "Willkommen bei Shiftfy! 👋",
    description:
      "Wir zeigen dir in wenigen Schritten die wichtigsten Bereiche. Du kannst die Tour jederzeit überspringen.",
    placement: "center",
  },
  {
    target: '[aria-label="Hauptnavigation"]',
    title: "Navigation",
    description:
      "Hier findest du alle Bereiche: Schichtplan, Zeiterfassung, Abwesenheiten und mehr. Auf dem Handy nutze die untere Navigationsleiste.",
    placement: "right",
  },
  {
    target: '[href="/schichtplan"]',
    title: "Schichtplan",
    description:
      "Erstelle Schichtpläne per Drag & Drop, nutze Vorlagen und verteile Pläne an dein Team. Konflikte werden automatisch erkannt.",
    placement: "right",
  },
  {
    target: '[href="/zeiterfassung"]',
    title: "Zeiterfassung",
    description:
      "Erfasse Arbeitszeiten in Echtzeit — per Stempeluhr, App oder manuell. DSGVO-konform und EuGH-konform.",
    placement: "right",
  },
  {
    target: '[href="/abwesenheiten"]',
    title: "Abwesenheiten",
    description:
      "Urlaub, Krankheit und mehr — dein Team stellt Anträge, du genehmigst sie mit einem Klick.",
    placement: "right",
  },
  {
    target: null,
    title: "Tastenkürzel: ⌘K",
    description:
      "Drücke ⌘K (Mac) oder Strg+K (Windows), um blitzschnell zu jeder Seite zu navigieren. Probiere es gleich aus!",
    placement: "center",
  },
  {
    target: null,
    title: "Du bist startklar! 🚀",
    description:
      "Lege als Nächstes deine Mitarbeiter an und erstelle deinen ersten Schichtplan. Bei Fragen findest du Hilfe in den Einstellungen.",
    placement: "center",
  },
];

/**
 * Interactive product tour overlay.
 *
 * Shows a spotlight + tooltip walkthrough on the first visit to the dashboard.
 * Persisted via localStorage so it only shows once.
 *
 * Place in the DashboardShell — it only activates on /dashboard.
 */
export function OnboardingTour() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number>(0);

  // Only show on dashboard, only if not yet completed
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (completed) return;

    // Delay start slightly so the dashboard renders first
    const timer = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Find & track the target element for the current step
  useEffect(() => {
    if (!active) return;

    const currentStep = TOUR_STEPS[step];
    if (!currentStep?.target) {
      rafRef.current = requestAnimationFrame(() => setTargetRect(null));
      return () => cancelAnimationFrame(rafRef.current);
    }

    function measure() {
      const el = document.querySelector(currentStep.target!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
      rafRef.current = requestAnimationFrame(measure);
    }

    measure();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, step]);

  // Lock body scroll
  useEffect(() => {
    if (active) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  const dismiss = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
    document.body.style.overflow = "";
  }, []);

  const next = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  // Keyboard handler
  useEffect(() => {
    if (!active) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, next, prev, dismiss]);

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const isCenter = currentStep.placement === "center" || !targetRect;

  // Calculate tooltip position
  const tooltipStyle = isCenter
    ? {}
    : getTooltipPosition(
        targetRect!,
        currentStep.placement as "top" | "bottom" | "left" | "right",
      );

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="Produkt-Tour"
    >
      {/* Backdrop with cutout for target element */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "all" }}
          onClick={dismiss}
        />
      </svg>

      {/* Spotlight ring around target */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent pointer-events-none animate-pulse"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={cn(
          "absolute z-[71] w-[340px] max-w-[calc(100vw-2rem)]",
          "bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700",
          "p-5 animate-[commandIn_0.2s_ease-out]",
          isCenter && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={isCenter ? {} : tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === step
                    ? "w-5 bg-emerald-500"
                    : i < step
                      ? "w-1.5 bg-emerald-300 dark:bg-emerald-700"
                      : "w-1.5 bg-gray-200 dark:bg-zinc-700",
                )}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            aria-label="Tour schließen"
            className="rounded-lg p-1.5 text-gray-400 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-1.5">
          {currentStep.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed mb-5">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors px-2 py-1"
              >
                Zurück
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={dismiss}
                className="text-sm font-medium text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors px-2 py-1"
              >
                Überspringen
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:brightness-105 transition-all active:scale-[0.97]"
            >
              {isLast ? (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Los geht&apos;s!
                </>
              ) : (
                <>
                  Weiter
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className="mt-3 text-[11px] text-gray-400 dark:text-zinc-500 text-center">
          Schritt {step + 1} von {TOUR_STEPS.length}
        </p>
      </div>
    </div>
  );
}

/** Compute absolute tooltip position based on target rect and placement */
function getTooltipPosition(
  rect: DOMRect,
  placement: "top" | "bottom" | "left" | "right",
): React.CSSProperties {
  const gap = 16;
  const tooltipWidth = 340;

  switch (placement) {
    case "right":
      return {
        left: Math.min(rect.right + gap, window.innerWidth - tooltipWidth - 16),
        top: Math.max(16, rect.top + rect.height / 2 - 80),
      };
    case "left":
      return {
        right: window.innerWidth - rect.left + gap,
        top: Math.max(16, rect.top + rect.height / 2 - 80),
      };
    case "bottom":
      return {
        left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
        top: rect.bottom + gap,
      };
    case "top":
      return {
        left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
        bottom: window.innerHeight - rect.top + gap,
      };
    default:
      return {};
  }
}
