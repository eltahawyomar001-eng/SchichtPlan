import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CalendarOffIcon, CheckCircleIcon } from "@/components/icons";

/* ── Types ── */
export interface PendingRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    color: string | null;
  };
  category: string; // AbsenceCategory enum value
  startDate: string; // formatted date string
  endDate: string; // formatted date string
}

interface PendingRequestsCardProps {
  requests: PendingRequest[];
  title: string;
  categoryLabel: (cat: string) => string;
  emptyLabel: string;
  viewAllLabel: string;
  viewAllHref: string;
}

export function PendingRequestsCard({
  requests,
  title,
  categoryLabel,
  emptyLabel,
  viewAllLabel,
  viewAllHref,
}: PendingRequestsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {requests.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40 px-1.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300">
              {requests.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 p-3">
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    name={`${req.employee.firstName} ${req.employee.lastName}`}
                    color={req.employee.color || undefined}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                      {req.employee.firstName} {req.employee.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      {req.startDate} – {req.endDate}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                  <CalendarOffIcon className="h-3 w-3" />
                  {categoryLabel(req.category)}
                </span>
              </div>
            ))}
            {requests.length > 4 && (
              <a
                href={viewAllHref}
                className="block text-center text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 pt-2 transition-colors"
              >
                {viewAllLabel} →
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
