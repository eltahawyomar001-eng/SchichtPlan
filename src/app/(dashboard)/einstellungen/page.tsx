"use client";

import { useSession, signOut } from "next-auth/react";
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

  return (
    <div>
      <Topbar
        title="Einstellungen"
        description="Verwalten Sie Ihr Konto und Ihre Einstellungen"
      />

      <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Profil
            </CardTitle>
            <CardDescription>Ihre persönlichen Informationen</CardDescription>
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
                <Badge className="mt-2">
                  {(session?.user as SessionUser)?.role || "OWNER"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workspace Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BuildingIcon className="h-5 w-5" />
              Workspace
            </CardTitle>
            <CardDescription>
              Informationen zu Ihrem Arbeitsbereich
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Workspace ID</span>
                <span className="text-sm font-mono text-gray-900 break-all">
                  {(session?.user as SessionUser)?.workspaceId || "–"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Rolle</span>
                <Badge variant="outline">
                  {(session?.user as SessionUser)?.role || "OWNER"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              Sicherheit
            </CardTitle>
            <CardDescription>Konto-Sicherheitseinstellungen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                variant="destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOutIcon className="h-4 w-4" />
                Abmelden
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
