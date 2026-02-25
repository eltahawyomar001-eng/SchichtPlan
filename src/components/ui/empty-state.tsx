import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  /** Icon to render above the title */
  icon: React.ReactNode;
  /** Main heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Optional bulleted tips or feature list */
  tips?: string[];
  /** Primary and optional secondary CTA */
  actions?: EmptyStateAction[];
  /** Extra class names for the outer container */
  className?: string;
}

/**
 * Polished, branded empty-state component.
 * Renders an icon, title, description, optional feature tips, and up to
 * two action buttons (primary emerald + secondary outline).
 *
 * Usage:
 *   <EmptyState
 *     icon={<UsersIcon className="h-8 w-8 text-emerald-500" />}
 *     title="Noch keine Mitarbeiter"
 *     description="Legen Sie Ihren ersten Mitarbeiter an, um mit der Planung zu starten."
 *     tips={["Importieren Sie Mitarbeiter per CSV", "Weisen Sie Rollen und Qualifikationen zu"]}
 *     actions={[{ label: "Mitarbeiter hinzufügen", onClick: openForm }]}
 *   />
 */
export function EmptyState({
  icon,
  title,
  description,
  tips,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 px-6 py-14 sm:py-16",
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 shadow-sm">
        {icon}
      </div>

      {/* Heading */}
      <h3 className="text-base sm:text-lg font-semibold text-gray-900">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      )}

      {/* Feature tips */}
      {tips && tips.length > 0 && (
        <ul className="mt-5 space-y-1.5 text-left w-full max-w-xs">
          {tips.map((tip, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-gray-500"
            >
              <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="mt-7 flex flex-col sm:flex-row items-center gap-3">
          {actions.map((action, i) =>
            action.variant === "secondary" ? (
              <button
                key={i}
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {action.label}
              </button>
            ) : (
              <button
                key={i}
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
