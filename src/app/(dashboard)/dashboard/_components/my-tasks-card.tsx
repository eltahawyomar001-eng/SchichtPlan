import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ── Types ── */
export interface Task {
  id: string;
  title: string;
  done: boolean;
}

interface MyTasksCardProps {
  tasks: Task[];
  title: string;
  newLabel: string;
  emptyLabel: string;
  emptyDesc: string;
}

export function MyTasksCard({
  tasks,
  title,
  newLabel,
  emptyLabel,
  emptyDesc,
}: MyTasksCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
            {newLabel}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-4">
            {/* ── Minimalist empty-state illustration ── */}
            <EmptyIllustration />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {emptyLabel}
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                {emptyDesc}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <span
                  className={`h-4 w-4 rounded-md border-2 flex-shrink-0 transition-colors ${
                    task.done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-gray-300 dark:border-zinc-600"
                  }`}
                />
                <span
                  className={`text-sm ${
                    task.done
                      ? "text-gray-400 dark:text-zinc-500 line-through"
                      : "text-gray-900 dark:text-zinc-100"
                  }`}
                >
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── SVG empty-state illustration (character) ── */
function EmptyIllustration() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-80"
      aria-hidden
    >
      {/* Body circle */}
      <circle
        cx="60"
        cy="68"
        r="32"
        className="fill-gray-100 dark:fill-zinc-800"
      />
      {/* Head */}
      <circle
        cx="60"
        cy="36"
        r="18"
        className="fill-gray-200 dark:fill-zinc-700"
      />
      {/* Face — simple smile */}
      <circle
        cx="54"
        cy="34"
        r="2"
        className="fill-gray-400 dark:fill-zinc-500"
      />
      <circle
        cx="66"
        cy="34"
        r="2"
        className="fill-gray-400 dark:fill-zinc-500"
      />
      <path
        d="M54 41 Q60 46 66 41"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        className="stroke-gray-400 dark:stroke-zinc-500"
      />
      {/* Arm — waving */}
      <path
        d="M88 58 Q94 48 98 38"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        className="stroke-emerald-400 dark:stroke-emerald-500"
      />
      {/* Hand circle */}
      <circle
        cx="99"
        cy="36"
        r="4"
        className="fill-emerald-400 dark:fill-emerald-500"
      />
      {/* Clipboard in other hand */}
      <rect
        x="26"
        y="56"
        width="14"
        height="18"
        rx="2"
        className="fill-gray-200 dark:fill-zinc-700"
      />
      <rect
        x="29"
        y="60"
        width="8"
        height="2"
        rx="1"
        className="fill-gray-300 dark:fill-zinc-600"
      />
      <rect
        x="29"
        y="64"
        width="6"
        height="2"
        rx="1"
        className="fill-gray-300 dark:fill-zinc-600"
      />
      <rect
        x="29"
        y="68"
        width="8"
        height="2"
        rx="1"
        className="fill-gray-300 dark:fill-zinc-600"
      />
      {/* Checkmark on clipboard */}
      <path
        d="M30 63 L32 65 L36 60"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="stroke-emerald-500 dark:stroke-emerald-400"
      />
      {/* Shadow */}
      <ellipse
        cx="60"
        cy="106"
        rx="28"
        ry="6"
        className="fill-gray-100 dark:fill-zinc-800/50"
      />
    </svg>
  );
}
