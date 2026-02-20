"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
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
  LogOutIcon,
  UserIcon,
  BuildingIcon,
  ShieldCheckIcon,
  ZapIcon,
  BellIcon,
  ChevronRightIcon,
  EditIcon,
  CheckIcon,
  XIcon,
  LockIcon,
  UsersIcon,
  DownloadIcon,
  TrashIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function EinstellungenPage() {
  const { data: session, update: updateSession } = useSession();
  const t = useTranslations("settings");

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(session?.user?.name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // DSGVO: Account deletion + data export
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  const roleMap: Record<string, string> = {
    OWNER: t("roleOwner"),
    ADMIN: t("roleAdmin"),
    MANAGER: t("roleManager"),
    EMPLOYEE: t("roleEmployee"),
  };
  const rawRole = (session?.user as SessionUser)?.role || "OWNER";
  const translatedRole = roleMap[rawRole] || rawRole;

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      });
      if (res.ok) {
        setEditingProfile(false);
        setProfileMsg({ type: "success", text: t("profileUpdated") });
        await updateSession({ name: profileName });
      } else {
        const data = await res.json();
        setProfileMsg({ type: "error", text: data.error || t("saveError") });
      }
    } catch {
      setProfileMsg({ type: "error", text: t("networkError") });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: t("passwordsNoMatch") });
      return;
    }
    if (newPassword.length < 8) {
      setPwMsg({ type: "error", text: t("passwordTooShort") });
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPwMsg({ type: "success", text: t("passwordChanged") });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPwForm(false);
      } else {
        const data = await res.json();
        const errMap: Record<string, string> = {
          WRONG_PASSWORD: t("wrongPassword"),
          PASSWORD_TOO_SHORT: t("passwordTooShort"),
          NO_PASSWORD: t("noPassword"),
        };
        setPwMsg({
          type: "error",
          text: errMap[data.code] || data.error || t("saveError"),
        });
      }
    } catch {
      setPwMsg({ type: "error", text: t("networkError") });
    } finally {
      setPwSaving(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/profile/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schichtplan-datenexport-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setDeleteMsg({ type: "error", text: t("networkError") });
      }
    } catch {
      setDeleteMsg({ type: "error", text: t("networkError") });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (res.ok) {
        signOut({ callbackUrl: "/login" });
      } else {
        const data = await res.json();
        if (data.error === "OWNER_TRANSFER_REQUIRED") {
          setDeleteMsg({ type: "error", text: t("ownerTransferRequired") });
        } else {
          setDeleteMsg({ type: "error", text: t("deleteError") });
        }
      }
    } catch {
      setDeleteMsg({ type: "error", text: t("networkError") });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div>
      <Topbar title={t("title")} description={t("description")} />

      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              {t("profile")}
            </CardTitle>
            <CardDescription>{t("profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              {session?.user?.name && (
                <Avatar name={session.user.name} size="lg" />
              )}
              <div className="flex-1 space-y-2">
                {editingProfile ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="max-w-xs"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                    >
                      <CheckIcon className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingProfile(false);
                        setProfileName(session?.user?.name || "");
                      }}
                    >
                      <XIcon className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-medium text-gray-900">
                      {session?.user?.name || "–"}
                    </p>
                    <button
                      onClick={() => setEditingProfile(true)}
                      className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  {session?.user?.email || "–"}
                </p>
                <Badge className="mt-1">{translatedRole}</Badge>
              </div>
            </div>
            {profileMsg && (
              <div
                className={`mt-3 rounded-lg p-3 text-sm ${
                  profileMsg.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {profileMsg.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workspace Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BuildingIcon className="h-5 w-5" />
              {t("workspace")}
            </CardTitle>
            <CardDescription>{t("workspaceDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t("workspaceName")}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {(session?.user as SessionUser)?.workspaceName || "–"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">
                  {t("workspaceId")}
                </span>
                <span className="text-sm font-mono text-gray-900 break-all">
                  {(session?.user as SessionUser)?.workspaceId || "–"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{t("role")}</span>
                <Badge variant="outline">{translatedRole}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Automations Card */}
        <Link href="/einstellungen/automationen" className="block group">
          <Card className="transition-colors group-hover:border-violet-200 group-hover:bg-violet-50/30">
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div className="rounded-xl bg-violet-50 p-3 group-hover:bg-violet-100 transition-colors">
                <ZapIcon className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900">
                  {t("automations")}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t("automationsDesc")}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-violet-500 transition-colors flex-shrink-0" />
            </CardContent>
          </Card>
        </Link>

        {/* Notification Channels Card */}
        <Link href="/einstellungen/benachrichtigungen" className="block group">
          <Card className="transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/30">
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div className="rounded-xl bg-blue-50 p-3 group-hover:bg-blue-100 transition-colors">
                <BellIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900">
                  {t("notificationPrefs")}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t("notificationPrefsDesc")}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
            </CardContent>
          </Card>
        </Link>

        {/* Team Management Card */}
        {["OWNER", "ADMIN"].includes(rawRole) && (
          <Link href="/einstellungen/team" className="block group">
            <Card className="transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-50/30">
              <CardContent className="flex items-center gap-4 p-4 sm:p-6">
                <div className="rounded-xl bg-emerald-50 p-3 group-hover:bg-emerald-100 transition-colors">
                  <UsersIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900">
                    {t("teamManagement")}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {t("teamManagementDesc")}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              {t("security")}
            </CardTitle>
            <CardDescription>{t("securityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Change Password */}
              {!showPwForm ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPwForm(true);
                    setPwMsg(null);
                  }}
                >
                  <LockIcon className="h-4 w-4" />
                  {t("changePassword")}
                </Button>
              ) : (
                <form
                  onSubmit={handleChangePassword}
                  className="space-y-3 rounded-lg border border-gray-200 p-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword">
                      {t("currentPassword")}
                    </Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">{t("newPassword")}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">
                      {t("confirmNewPassword")}
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={pwSaving}>
                      {t("changePassword")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPwForm(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                        setPwMsg(null);
                      }}
                    >
                      {t("cancelChange")}
                    </Button>
                  </div>
                </form>
              )}

              {pwMsg && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    pwMsg.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {pwMsg.text}
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <Button
                  variant="destructive"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOutIcon className="h-4 w-4" />
                  {t("signOut")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DSGVO: Data Privacy & Account Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              {t("dataPrivacy")}
            </CardTitle>
            <CardDescription>{t("dataPrivacyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Export Data */}
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  {t("exportDataInfo")}
                </p>
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  disabled={exporting}
                >
                  <DownloadIcon className="h-4 w-4" />
                  {exporting ? t("exportingData") : t("exportData")}
                </Button>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600 mb-2">
                  {t("deleteAccountInfo")}
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                  {t("deleteAccount")}
                </Button>
              </div>

              {deleteMsg && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    deleteMsg.type === "success"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {deleteMsg.text}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={showDeleteDialog}
          title={t("deleteAccountTitle")}
          message={t("deleteAccountMessage")}
          confirmLabel={
            deleting ? t("deletingAccount") : t("deleteAccountConfirm")
          }
          cancelLabel={t("cancelChange")}
          variant="danger"
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteDialog(false)}
        />
      </div>
    </div>
  );
}
