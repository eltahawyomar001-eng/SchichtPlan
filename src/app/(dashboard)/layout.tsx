import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { SessionUser } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const user = session.user as SessionUser;

  // Redirect new workspaces to the onboarding wizard.
  // Only applies to OWNER and ADMIN — employees join existing workspaces.
  if (
    user.onboardingCompleted === false &&
    (user.role === "OWNER" || user.role === "ADMIN")
  ) {
    redirect("/onboarding");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
