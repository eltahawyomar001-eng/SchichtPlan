import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";
import { FAQJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title:
    "Shiftfy – Schichtplanung & Zeiterfassung Software | Dienstplan online erstellen",
  description:
    "Shiftfy ist die intelligente Software für Schichtplanung, Zeiterfassung und Personalmanagement. Ideal für Sicherheitsdienste, Gastronomie, Einzelhandel & Dienstleister. DSGVO-konform, kostenlos starten.",
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  try {
    const session = await getServerSession(authOptions);
    if (session) {
      redirect("/dashboard");
    }
  } catch {
    // Auth not configured yet — show landing page
  }

  return (
    <>
      <FAQJsonLd />
      <LandingPage />
    </>
  );
}
