interface MobileHeaderProps {
  title: string;
  description?: string;
  /** Render actions next to the title area */
  actions?: React.ReactNode;
  /** Render utility icons (language, notifications) in the top-right.
   *  Pass null to hide. Default renders nothing. */
  utilities?: React.ReactNode;
  /** Use compact inline title instead of large title (default: false) */
  compact?: boolean;
  /** Optional greeting text shown above the large title */
  greeting?: string;
}

/**
 * iOS-style mobile page header.
 * - Large title (34px bold) by default — like Settings, App Store, etc.
 * - Compact mode uses 20px semibold inline title — like a pushed detail view.
 * - Only visible on mobile (<lg). Desktop uses the classic Topbar.
 * - Works in both Server and Client components.
 */
export function MobileHeader({
  title,
  description,
  actions,
  utilities,
  compact = false,
  greeting,
}: MobileHeaderProps) {
  return (
    <div className="lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
      {compact ? (
        /* ── Compact inline title ── */
        <div className="flex items-center justify-between px-4 pb-2">
          <h1 className="text-[20px] font-semibold text-gray-900 truncate">
            {title}
          </h1>
          <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>
        </div>
      ) : (
        /* ── iOS large title ── */
        <div className="px-4 pb-2">
          {/* Top row: greeting / utility icons */}
          {(greeting || utilities) && (
            <div className="flex items-center justify-between mb-1">
              {greeting ? (
                <p className="text-[13px] font-medium text-gray-400">
                  {greeting}
                </p>
              ) : (
                <div />
              )}
              {utilities && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {utilities}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[34px] font-bold tracking-tight text-gray-900 leading-[1.1]">
              {title}
            </h1>
            {actions && !utilities && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {actions}
              </div>
            )}
          </div>
          {description && (
            <p className="text-[15px] text-gray-500 mt-1">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
