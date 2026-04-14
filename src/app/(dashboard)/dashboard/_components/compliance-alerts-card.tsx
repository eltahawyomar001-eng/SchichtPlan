import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, ShieldCheckIcon } from "@/components/icons";
import Link from "next/link";

/* ── Types ── */
export type AlertSeverity = "critical" | "warning" | "info";

export interface ComplianceAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  employeeName?: string;
  date?: string;
  href?: string;
}

interface ComplianceAlertsCardProps {
  alerts: ComplianceAlert[];
  title: string;
  criticalLabel: string;
  warningLabel: string;
  allClearLabel: string;
  allClearDesc: string;
  viewLabel: string;
}

const severityConfig: Record<
  AlertSeverity,
  {
    bg: string;
    border: string;
    icon: string;
    text: string;
    darkBg: string;
    darkBorder: string;
    darkText: string;
  }
> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-600",
    text: "text-red-700",
    darkBg: "dark:bg-red-950/20",
    darkBorder: "dark:border-red-900/30",
    darkText: "dark:text-red-300",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "text-amber-600",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-950/20",
    darkBorder: "dark:border-amber-900/30",
    darkText: "dark:text-amber-300",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-600",
    text: "text-blue-700",
    darkBg: "dark:bg-blue-950/20",
    darkBorder: "dark:border-blue-900/30",
    darkText: "dark:text-blue-300",
  },
};

export function ComplianceAlertsCard({
  alerts,
  title,
  criticalLabel,
  warningLabel,
  allClearLabel,
  allClearDesc,
  viewLabel,
}: ComplianceAlertsCardProps) {
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {alerts.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 px-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                {alerts.length}
              </span>
            )}
          </div>
          {/* Severity summary */}
          {alerts.length > 0 && (
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/30 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                  {criticalCount} {criticalLabel}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {warningCount} {warningLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 mb-3">
              <ShieldCheckIcon className="h-6 w-6 text-emerald-400 dark:text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {allClearLabel}
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              {allClearDesc}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const cfg = severityConfig[alert.severity];
              const inner = (
                <>
                  <AlertTriangleIcon
                    className={cn("h-4 w-4 mt-0.5 flex-shrink-0", cfg.icon)}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        cfg.text,
                        cfg.darkText,
                      )}
                    >
                      {alert.title}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      {alert.description}
                    </p>
                    {(alert.employeeName || alert.date) && (
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 dark:text-zinc-500">
                        {alert.employeeName && (
                          <span>{alert.employeeName}</span>
                        )}
                        {alert.date && <span>· {alert.date}</span>}
                      </div>
                    )}
                  </div>
                  {alert.href && (
                    <span className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 flex-shrink-0 mt-0.5">
                      {viewLabel} →
                    </span>
                  )}
                </>
              );
              const classes = cn(
                "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                cfg.bg,
                cfg.border,
                cfg.darkBg,
                cfg.darkBorder,
                alert.href && "hover:shadow-sm cursor-pointer",
              );
              return alert.href ? (
                <Link key={alert.id} href={alert.href} className={classes}>
                  {inner}
                </Link>
              ) : (
                <div key={alert.id} className={classes}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
