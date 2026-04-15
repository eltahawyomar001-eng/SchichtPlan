"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { UsersIcon, ArrowRightIcon } from "@/components/icons";
import Link from "next/link";

/* ── Types ── */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
}

interface TeamMembersCardProps {
  members: TeamMember[];
  title: string;
  roleLabels: Record<string, string>;
  youLabel: string;
  manageLabel: string;
  emptyLabel: string;
  countLabel: string;
}

const roleBadgeStyles: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ADMIN:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  EMPLOYEE: "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300",
};

export function TeamMembersCard({
  members,
  title,
  roleLabels,
  youLabel,
  manageLabel,
  emptyLabel,
  countLabel,
}: TeamMembersCardProps) {
  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 p-2">
              <UsersIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                {countLabel}
              </p>
            </div>
          </div>
          <Link
            href="/einstellungen/team"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
          >
            {manageLabel}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400 py-4 text-center">
            {emptyLabel}
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-zinc-700 p-3 transition-colors hover:bg-gray-50/50 dark:hover:bg-zinc-800/30"
              >
                {/* Avatar */}
                <Avatar
                  name={member.name || member.email}
                  color="#10b981"
                  size="md"
                />

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                      {member.name || member.email}
                    </p>
                    {member.isSelf && (
                      <span className="text-[10px] font-medium text-gray-400 dark:text-zinc-500">
                        ({youLabel})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                    {member.email}
                  </p>
                </div>

                {/* Role badge */}
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                    roleBadgeStyles[member.role] || roleBadgeStyles.EMPLOYEE
                  }`}
                >
                  {roleLabels[member.role] || member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
