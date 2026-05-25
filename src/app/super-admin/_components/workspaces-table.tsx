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

const PLAN_COLORS: Record<Plan, string> = {
  BASIC: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  PROFESSIONAL:
    "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ENTERPRISE:
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const STATUS_COLORS: Record<Status, string> = {
  ACTIVE:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  TRIALING:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  PAST_DUE: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  CANCELED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  UNPAID: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  INCOMPLETE:
    "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  INCOMPLETE_EXPIRED:
    "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  PAUSED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

function fmt(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function TrialCountdown({ date }: { date: Date | null | undefined }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-zinc-400">—</span>;
  if (d < 0)
    return <span className="text-red-500 text-xs font-medium">Expired</span>;
  if (d <= 3)
    return <span className="text-red-500 text-xs font-bold">{d}d left</span>;
  if (d <= 7)
    return (
      <span className="text-amber-500 text-xs font-medium">{d}d left</span>
    );
  return <span className="text-zinc-500 text-xs">{fmt(date)}</span>;
}

function WorkspaceRow({
  w,
  onExtendTrial,
  onChangePlan,
  loading,
}: {
  w: Workspace;
  onExtendTrial: (id: string, days: number) => void;
  onChangePlan: (id: string, plan: Plan) => void;
  loading: string | null;
}) {
  const sub = w.subscription;
  const owner = w.members[0];
  const trialBusy = loading === `${w.id}-trial`;
  const planBusy = loading === `${w.id}-plan`;
  const canExtendTrial =
    !sub ||
    sub.status === "TRIALING" ||
    sub.status === "CANCELED" ||
    sub.status === "PAST_DUE" ||
    sub.status === "PAUSED" ||
    sub.status === "INCOMPLETE" ||
    sub.status === "INCOMPLETE_EXPIRED";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3">
      {/* Top row: name + status + plan */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {w.name}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
            {w.slug}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {sub && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[sub.plan]}`}
            >
              {sub.plan === "PROFESSIONAL"
                ? "Pro"
                : sub.plan === "ENTERPRISE"
                  ? "Ent."
                  : "Basic"}
            </span>
          )}
          {sub ? (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[sub.status]}`}
            >
              {sub.status}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
              no sub
            </span>
          )}
        </div>
      </div>

      {/* Middle row: owner + members + dates */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-zinc-400 uppercase tracking-wide text-[10px] font-semibold">
            Owner
          </span>
          <div className="text-zinc-700 dark:text-zinc-300 truncate">
            {owner?.name ?? owner?.email ?? "—"}
          </div>
          {owner?.name && (
            <div className="text-zinc-400 dark:text-zinc-500 truncate">
              {owner.email}
            </div>
          )}
        </div>
        <div>
          <span className="text-zinc-400 uppercase tracking-wide text-[10px] font-semibold">
            Members
          </span>
          <div className="text-zinc-700 dark:text-zinc-300">
            {w._count.members}
            {sub?.seatCount ? (
              <span className="text-zinc-400"> / {sub.seatCount} seats</span>
            ) : null}
          </div>
        </div>
        {sub?.status === "TRIALING" && (
          <div>
            <span className="text-zinc-400 uppercase tracking-wide text-[10px] font-semibold">
              Trial ends
            </span>
            <div>
              <TrialCountdown date={sub.trialEnd} />
            </div>
          </div>
        )}
        {sub?.currentPeriodEnd && (
          <div>
            <span className="text-zinc-400 uppercase tracking-wide text-[10px] font-semibold">
              Period ends
            </span>
            <div className="text-zinc-700 dark:text-zinc-300">
              {fmt(sub.currentPeriodEnd)}
            </div>
          </div>
        )}
        <div>
          <span className="text-zinc-400 uppercase tracking-wide text-[10px] font-semibold">
            Created
          </span>
          <div className="text-zinc-500 dark:text-zinc-400">
            {fmt(w.createdAt)}
          </div>
        </div>
        {sub?.stripeCustomerId && (
          <div>
            <span className="text-zinc-400 uppercase tracking-wide text-[10px] font-semibold">
              Stripe
            </span>
            <div>
              <a
                href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mr-1">
          Actions
        </span>

        {/* Extend trial */}
        {([7, 14] as const).map((days) => (
          <button
            key={days}
            disabled={!canExtendTrial || trialBusy || planBusy}
            onClick={() => onExtendTrial(w.id, days)}
            title={
              !canExtendTrial
                ? "Already on an active paid subscription"
                : `Extend trial by ${days} days`
            }
            className="rounded-lg px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {trialBusy ? "…" : `+${days} days`}
          </button>
        ))}

        {/* Change plan */}
        <select
          disabled={!sub || planBusy || trialBusy}
          value={sub?.plan ?? ""}
          onChange={(e) => onChangePlan(w.id, e.target.value as Plan)}
          className="ml-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs px-2 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors cursor-pointer"
        >
          <option value="BASIC">→ Basic</option>
          <option value="PROFESSIONAL">→ Professional</option>
          <option value="ENTERPRISE">→ Enterprise</option>
        </select>
      </div>
    </div>
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
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const filtered = workspaces.filter((w) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      w.name.toLowerCase().includes(q) ||
      w.slug.toLowerCase().includes(q) ||
      w.members[0]?.email.toLowerCase().includes(q) ||
      w.members[0]?.name?.toLowerCase().includes(q);
    const matchesStatus =
      filterStatus === "all" ||
      w.subscription?.status === filterStatus ||
      (!w.subscription && filterStatus === "none");
    return matchesSearch && matchesStatus;
  });

  // Summary counts
  const counts = {
    total: workspaces.length,
    active: workspaces.filter((w) => w.subscription?.status === "ACTIVE")
      .length,
    trialing: workspaces.filter((w) => w.subscription?.status === "TRIALING")
      .length,
    incomplete: workspaces.filter((w) =>
      [
        "INCOMPLETE",
        "INCOMPLETE_EXPIRED",
        "CANCELED",
        "PAST_DUE",
        "UNPAID",
      ].includes(w.subscription?.status ?? ""),
    ).length,
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: counts.total,
            color: "text-zinc-700 dark:text-zinc-300",
          },
          {
            label: "Active (paying)",
            value: counts.active,
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Trialing",
            value: counts.trialing,
            color: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Problem",
            value: counts.incomplete,
            color: "text-red-500 dark:text-red-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3"
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Search workspace, owner, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIALING">Trialing</option>
          <option value="INCOMPLETE">Incomplete</option>
          <option value="PAST_DUE">Past due</option>
          <option value="CANCELED">Canceled</option>
          <option value="none">No subscription</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Result count */}
      {(search || filterStatus !== "all") && (
        <p className="text-sm text-zinc-400">
          {filtered.length} of {workspaces.length} workspaces
        </p>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((w) => (
          <WorkspaceRow
            key={w.id}
            w={w}
            onExtendTrial={extendTrial}
            onChangePlan={changePlan}
            loading={loading}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
          No workspaces match your search.
        </div>
      )}
    </div>
  );
}
