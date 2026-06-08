"use client";

import { useEffect, useState } from "react";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  emailVerified: string | null;
  createdAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  userEmail: string | null;
  createdAt: string;
}

interface Detail {
  workspace: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    subscription: {
      plan: string;
      status: string;
      seatCount: number;
      currentPeriodEnd: string | null;
      stripeCustomerId: string | null;
    } | null;
    _count: {
      members: number;
      employees: number;
      shifts: number;
      tickets: number;
    };
  };
  members: Member[];
  auditLogs: AuditRow[];
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const ROLE_COLORS: Record<string, string> = {
  OWNER:
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ADMIN: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  MANAGER:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  EMPLOYEE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function WorkspaceDrawer({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/super-admin/workspaces/${workspaceId}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load workspace");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl h-full overflow-y-auto bg-white dark:bg-zinc-900 shadow-xl border-l border-zinc-200 dark:border-zinc-800">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {detail?.workspace.name ?? "Workspace"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {!detail && !error && (
            <div className="py-16 text-center text-sm text-zinc-400">
              Loading…
            </div>
          )}

          {detail && (
            <>
              {/* Counts */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Members", value: detail.workspace._count.members },
                  {
                    label: "Employees",
                    value: detail.workspace._count.employees,
                  },
                  { label: "Shifts", value: detail.workspace._count.shifts },
                  { label: "Tickets", value: detail.workspace._count.tickets },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center"
                  >
                    <div className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-400">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Subscription */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  Subscription
                </h3>
                {detail.workspace.subscription ? (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-sm grid grid-cols-2 gap-y-1 gap-x-4">
                    <span className="text-zinc-400">Plan</span>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                      {detail.workspace.subscription.plan}
                    </span>
                    <span className="text-zinc-400">Status</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {detail.workspace.subscription.status}
                    </span>
                    <span className="text-zinc-400">Seats</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {detail.workspace.subscription.seatCount}
                    </span>
                    <span className="text-zinc-400">Period ends</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {fmt(detail.workspace.subscription.currentPeriodEnd)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No subscription</p>
                )}
              </div>

              {/* Members */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  Members ({detail.members.length})
                </h3>
                <div className="space-y-1.5">
                  {detail.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
                          {m.name ?? m.email}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {m.email}
                        </div>
                      </div>
                      {!m.emailVerified && (
                        <span
                          title="Email not verified"
                          className="text-[10px] font-medium text-amber-600 dark:text-amber-400"
                        >
                          unverified
                        </span>
                      )}
                      {m.twoFactorEnabled && (
                        <span
                          title="2FA enabled"
                          className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                        >
                          2FA
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          ROLE_COLORS[m.role] ?? ROLE_COLORS.EMPLOYEE
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent audit */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
                  Recent activity
                </h3>
                {detail.auditLogs.length === 0 ? (
                  <p className="text-sm text-zinc-400">No recent activity.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.auditLogs.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1"
                      >
                        <span>
                          {a.action} · {a.entityType}
                          {a.userEmail ? ` · ${a.userEmail}` : ""}
                        </span>
                        <span className="text-zinc-400">
                          {fmt(a.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
