"use client";

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
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LogOutIcon,
  UserIcon,
  BuildingIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import type { SessionUser } from "@/lib/types";

export default function EinstellungenPage() {
  const { data: session } = useSession();
  const t = useTranslations("settings");

  const roleMap: Record<string, string> = {
    OWNER: t("roleOwner"),
    ADMIN: t("roleAdmin"),
    EMPLOYEE: t("roleEmployee"),
  };
  const rawRole = (session?.user as SessionUser)?.role || "OWNER";
  const translatedRole = roleMap[rawRole] || rawRole;

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
            <div className="flex items-center gap-4">
              {session?.user?.name && (
                <Avatar name={session.user.name} size="lg" />
              )}
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {session?.user?.name || "–"}
                </p>
                <p className="text-sm text-gray-500">
                  {session?.user?.email || "–"}
                </p>
                <Badge className="mt-2">{translatedRole}</Badge>
              </div>
            </div>
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
              <Button
                variant="destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOutIcon className="h-4 w-4" />
                {t("signOut")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
