"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  UsersIcon,
  UserPlusIcon,
  MailIcon,
  ChevronLeftIcon,
  TrashIcon,
  SendIcon,
  ClockIcon,
  CheckCircleIcon,
  XIcon,
  AlertCircleIcon,
  RefreshIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string | null; email: string };
};

export default function TeamPage() {
  const { data: session } = useSession();
  const t = useTranslations("team");
  const user = session?.user as SessionUser | undefined;

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EMPLOYEE");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null);

  // Remove / Revoke
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isOwner = user?.role === "OWNER";
  const isAdmin = user?.role === "ADMIN" || isOwner;

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations");
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [fetchMembers, fetchInvitations]);

  // Send invitation
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMsg(null);
    setInviting(true);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteMsg({ type: "success", text: t("inviteSent") });
        setInviteEmail("");
        setInviteRole("EMPLOYEE");
        fetchInvitations();
      } else {
        const errorMap: Record<string, string> = {
          ALREADY_MEMBER: t("errorAlreadyMember"),
          ALREADY_INVITED: t("errorAlreadyInvited"),
        };
        setInviteMsg({
          type: "error",
          text: errorMap[data.error] || t("errorInviteFailed"),
        });
      }
    } catch {
      setInviteMsg({ type: "error", text: t("errorNetwork") });
    } finally {
      setInviting(false);
    }
  };

  // Revoke invitation
  const handleRevoke = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchInvitations();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // Resend invitation
  const handleResend = async (id: string) => {
    setActionLoading(`resend-${id}`);
    try {
      const res = await fetch(`/api/invitations/${id}/resend`, {
        method: "POST",
      });
      if (res.ok) {
        setInviteMsg({ type: "success", text: t("inviteResent") });
        fetchInvitations();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  // Change role
  const handleRoleChange = async (memberId: string, newRole: string) => {
    setChangingRole(memberId);
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch {
      // silent
    } finally {
      setChangingRole(null);
    }
  };

  // Remove member
  const handleRemove = async (memberId: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
      if (res.ok) {
        fetchMembers();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const roleLabels: Record<string, string> = {
    OWNER: t("roleOwner"),
    ADMIN: t("roleAdmin"),
    MANAGER: t("roleManager"),
    EMPLOYEE: t("roleEmployee"),
  };

  const roleBadgeColor: Record<string, string> = {
    OWNER: "bg-amber-100 text-amber-800",
    ADMIN: "bg-violet-100 text-violet-800",
    MANAGER: "bg-blue-100 text-blue-800",
    EMPLOYEE: "bg-gray-100 text-gray-700",
  };

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPending"),
    ACCEPTED: t("statusAccepted"),
    EXPIRED: t("statusExpired"),
    REVOKED: t("statusRevoked"),
  };

  const pendingInvitations = invitations.filter((i) => i.status === "PENDING");
  const pastInvitations = invitations.filter((i) => i.status !== "PENDING");

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
        {/* Back link */}
        <Link
          href="/einstellungen"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t("backToSettings")}
        </Link>

        {/* ── Invite Form ── */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlusIcon className="h-5 w-5" />
                {t("inviteTitle")}
              </CardTitle>
              <CardDescription>{t("inviteDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="invite-email">{t("emailLabel")}</Label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-40 space-y-1.5">
                    <Label htmlFor="invite-role">{t("roleLabel")}</Label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      <option value="EMPLOYEE">{t("roleEmployee")}</option>
                      <option value="MANAGER">{t("roleManager")}</option>
                      <option value="ADMIN">{t("roleAdmin")}</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={inviting}>
                  <SendIcon className="h-4 w-4" />
                  {inviting ? t("sending") : t("sendInvite")}
                </Button>
              </form>

              {inviteMsg && (
                <div
                  className={`mt-3 rounded-lg p-3 text-sm ${
                    inviteMsg.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {inviteMsg.text}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Members List ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              {t("membersTitle")}
              {!loadingMembers && (
                <Badge variant="outline" className="ml-1">
                  {members.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t("membersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {t("noMembers")}
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Avatar name={member.name || member.email} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name || member.email}
                        {member.id === user?.id && (
                          <span className="ml-1.5 text-xs text-gray-400">
                            ({t("you")})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {member.email}
                      </p>
                    </div>

                    {/* Role badge + management */}
                    <div className="flex items-center gap-2">
                      {isOwner &&
                      member.id !== user?.id &&
                      member.role !== "OWNER" ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value)
                          }
                          disabled={changingRole === member.id}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-violet-500 ${roleBadgeColor[member.role] || roleBadgeColor.EMPLOYEE}`}
                        >
                          <option value="ADMIN">{t("roleAdmin")}</option>
                          <option value="MANAGER">{t("roleManager")}</option>
                          <option value="EMPLOYEE">{t("roleEmployee")}</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeColor[member.role] || roleBadgeColor.EMPLOYEE}`}
                        >
                          {roleLabels[member.role] || member.role}
                        </span>
                      )}

                      {/* Remove button */}
                      {isAdmin &&
                        member.id !== user?.id &&
                        member.role !== "OWNER" &&
                        !(
                          user?.role === "ADMIN" && member.role === "ADMIN"
                        ) && (
                          <button
                            onClick={() => handleRemove(member.id)}
                            disabled={actionLoading === member.id}
                            className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title={t("removeMember")}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Pending Invitations ── */}
        {isAdmin && pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5" />
                {t("pendingTitle")}
                <Badge variant="outline" className="ml-1">
                  {pendingInvitations.length}
                </Badge>
              </CardTitle>
              <CardDescription>{t("pendingDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100">
                {pendingInvitations.map((inv) => {
                  const isExpired = new Date(inv.expiresAt) < new Date();
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        <MailIcon className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {inv.email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {roleLabels[inv.role]} &middot;{" "}
                          {isExpired ? (
                            <span className="text-amber-600">
                              {t("expired")}
                            </span>
                          ) : (
                            <span>
                              {t("expiresOn")}{" "}
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleResend(inv.id)}
                          disabled={actionLoading === `resend-${inv.id}`}
                          className="rounded-lg p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50"
                          title={t("resend")}
                        >
                          <RefreshIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRevoke(inv.id)}
                          disabled={actionLoading === inv.id}
                          className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title={t("revoke")}
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Invitation History ── */}
        {isAdmin && pastInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircleIcon className="h-5 w-5" />
                {t("historyTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100">
                {pastInvitations.slice(0, 10).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      {inv.status === "ACCEPTED" ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <XIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">
                        {inv.email}
                      </p>
                      <p className="text-xs text-gray-400">
                        {roleLabels[inv.role]} &middot;{" "}
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        inv.status === "ACCEPTED"
                          ? "text-green-600"
                          : inv.status === "EXPIRED"
                            ? "text-amber-600"
                            : "text-gray-500"
                      }`}
                    >
                      {statusLabels[inv.status] || inv.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
