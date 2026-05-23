import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isEmployee } from "@/lib/authorization";
import type { SessionUser } from "@/lib/types";

export default async function MitarbeiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  // EMPLOYEE role has no business access to the employee management area.
  // The sidebar already hides the link, but direct URL navigation must also
  // be blocked server-side — client-only guards are not security boundaries.
  if (!user || isEmployee(user)) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
