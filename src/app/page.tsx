import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  try {
    const session = await getServerSession(authOptions);
    if (session) {
      redirect("/dashboard");
    }
  } catch {
    // Auth not configured yet — show landing page
  }

  return <LandingPage />;
}
