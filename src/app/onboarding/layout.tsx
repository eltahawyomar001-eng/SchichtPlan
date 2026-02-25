import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Onboarding layout -- full-screen, no sidebar/topbar.
 * Auth-protected (redirects to login if unauthenticated).
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  return <>{children}</>;
}
