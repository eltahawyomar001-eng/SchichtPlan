"use client";

import { useState } from "react";

type Plan = "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
type Status =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "PAUSED";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  subscription: {
    plan: Plan;
    status: Status;
    seatCount: number;
    trialStart: Date | null;
    trialEnd: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  members: { email: string; name: string | null }[];
  _count: { members: number };
}

const PLAN_LABELS: Record<Plan, string> = {
  BASIC: "Basic",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

const PLAN_COLORS: Record<Plan, string> = {
  BASIC: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
  PROFESSIONAL:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ENTERPRISE:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const STATUS_COLORS: Record<Status, string> = {
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  TRIALING:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  PAST_DUE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  CANCELED: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400",
  UNPAID: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  INCOMPLETE:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  INCOMPLETE_EXPIRED:
    "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400",
  PAUSED: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function fmt(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function WorkspacesTable({
  workspaces: initial,
}: {
  workspaces: Workspace[];
}) {
  const [workspaces, setWorkspaces] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function extendTrial(workspaceId: string, days: number) {
    setLoading(`${workspaceId}-trial`);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/workspaces/${workspaceId}/extend-trial`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId && w.subscription
            ? {
                ...w,
                subscription: {
                  ...w.subscription,
                  status: "TRIALING" as Status,
                  trialEnd: new Date(data.trialEnd),
                },
              }
            : w,
        ),
      );
    } finally {
      setLoading(null);
    }
  }

  async function changePlan(workspaceId: string, plan: Plan) {
    setLoading(`${workspaceId}-plan`);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/workspaces/${workspaceId}/plan`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId && w.subscription
            ? { ...w, subscription: { ...w.subscription, plan: data.plan } }
            : w,
        ),
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800/50">
            <tr>
              {[
                "Workspace",
                "Owner",
                "Members",
                "Plan",
                "Status",
                "Trial ends",
                "Period ends",
                "Stripe",
                "Created",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {workspaces.map((w) => {
              const sub = w.subscription;
              const owner = w.members[0];
              const isTrialable =
                !sub ||
                sub.status === "TRIALING" ||
                sub.status === "CANCELED" ||
                sub.status === "PAST_DUE" ||
                sub.status === "PAUSED";
              const trialBusy = loading === `${w.id}-trial`;
              const planBusy = loading === `${w.id}-plan`;

              return (
                <tr
                  key={w.id}
                  className="hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  {/* Workspace */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 dark:text-zinc-100">
                      {w.name}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-zinc-500">
                      {w.slug}
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {owner ? (
                      <>
                        <div className="text-gray-700 dark:text-zinc-300">
                          {owner.name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-zinc-500">
                          {owner.email}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Members */}
                  <td className="px-4 py-3 whitespace-nowrap text-center text-gray-700 dark:text-zinc-300">
                    {w._count.members}
                    {sub?.seatCount ? (
                      <span className="text-gray-400 dark:text-zinc-500">
                        /{sub.seatCount}
                      </span>
                    ) : null}
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sub ? (
                      <Badge
                        label={PLAN_LABELS[sub.plan]}
                        className={PLAN_COLORS[sub.plan]}
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sub ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          label={sub.status}
                          className={STATUS_COLORS[sub.status]}
                        />
                        {sub.cancelAtPeriodEnd && (
                          <span className="text-xs text-orange-500">
                            cancels at period end
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  {/* Trial ends */}
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-zinc-400">
                    {fmt(sub?.trialEnd)}
                  </td>

                  {/* Period ends */}
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-zinc-400">
                    {fmt(sub?.currentPeriodEnd)}
                  </td>

                  {/* Stripe */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sub?.stripeCustomerId ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Customer ↗
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">no stripe</span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-zinc-500 text-xs">
                    {fmt(w.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {/* Extend trial */}
                      <div className="flex gap-1">
                        {([7, 14] as const).map((days) => (
                          <button
                            key={days}
                            disabled={!isTrialable || trialBusy}
                            onClick={() => extendTrial(w.id, days)}
                            title={
                              !isTrialable
                                ? "Only available for non-active subscriptions"
                                : `Extend trial by ${days} days`
                            }
                            className="rounded px-2 py-1 text-xs font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {trialBusy ? "…" : `+${days}d`}
                          </button>
                        ))}
                      </div>

                      {/* Change plan */}
                      <select
                        disabled={!sub || planBusy}
                        value={sub?.plan ?? ""}
                        onChange={(e) =>
                          changePlan(w.id, e.target.value as Plan)
                        }
                        className="rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-xs px-1.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="BASIC">Basic</option>
                        <option value="PROFESSIONAL">Professional</option>
                        <option value="ENTERPRISE">Enterprise</option>
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {workspaces.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400 dark:text-zinc-500">
            No workspaces yet.
          </p>
        )}
      </div>
    </div>
  );
}
