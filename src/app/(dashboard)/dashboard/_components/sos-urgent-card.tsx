import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircleIcon } from "@/components/icons";
import Link from "next/link";

export interface OpenShiftToday {
  id: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
}

interface SosUrgentCardProps {
  shifts: OpenShiftToday[];
}

export function SosUrgentCard({ shifts }: SosUrgentCardProps) {
  if (shifts.length === 0) return null;

  return (
    <Card className="border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">🚨</span>
            <CardTitle className="text-base text-red-700 dark:text-red-400">
              Heute unbesetzte Schichten
            </CardTitle>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
              {shifts.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {shifts.slice(0, 4).map((shift) => (
          <div
            key={shift.id}
            className="flex items-center justify-between rounded-lg border border-red-100 dark:border-red-900/30 bg-white dark:bg-zinc-900 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircleIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {shift.startTime} – {shift.endTime}
              </span>
              {shift.locationName && (
                <span className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                  · {shift.locationName}
                </span>
              )}
            </div>
            <Link
              href="/schichtplan"
              className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
            >
              SOS starten
            </Link>
          </div>
        ))}
        {shifts.length > 4 && (
          <p className="text-xs text-red-500 dark:text-red-400 text-center pt-1">
            +{shifts.length - 4} weitere unbesetzte Schichten
          </p>
        )}
        <div className="pt-1">
          <Link
            href="/schichtplan"
            className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Zum Schichtplan →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
