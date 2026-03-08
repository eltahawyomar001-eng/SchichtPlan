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
        "rounded-2xl border-2 border-dashed border-gray-200/80 bg-gradient-to-b from-gray-50/60 to-white px-5 py-12 sm:px-6 sm:py-16 md:py-20",
        className,
      )}
    >
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 shadow-sm ring-1 ring-emerald-200/30">
        {icon}
      </div>

      {/* Heading */}
      <h3 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      )}

      {/* Feature tips */}
      {tips && tips.length > 0 && (
        <ul className="mt-6 space-y-2 text-left w-full max-w-xs">
          {tips.map((tip, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm text-gray-500"
            >
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          {actions.map((action, i) =>
            action.variant === "secondary" ? (
              <button
                key={i}
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {action.label}
              </button>
            ) : (
              <button
                key={i}
                onClick={action.onClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 hover:shadow-md hover:brightness-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
