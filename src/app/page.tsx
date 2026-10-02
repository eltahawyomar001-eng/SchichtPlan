import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

/** Absolute URLs are required by schema.org; relative ones are ignored. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.shiftfy.de";

export const metadata: Metadata = {
  title:
    "Shiftfy – Schichtplanung & Zeiterfassung Software | Dienstplan online erstellen",
  description:
    "Shiftfy ist die intelligente Software für Schichtplanung, Zeiterfassung und Personalmanagement. Ideal für Sicherheitsdienste, Gastronomie, Einzelhandel & Dienstleister. DSGVO-konform, 14 Tage testen.",
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

  /**
   * VideoObject markup.
   *
   * Lets the video appear as a video result in Google and gives the page a
   * thumbnail in the SERP, which is worth more on a landing page than it costs
   * to add. Absolute URLs are required by the spec; relative ones are ignored.
   */
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "Shiftfy erklärt: Zeiterfassung, Schichtplanung und Lohnexport in einer App",
    description:
      "In 90 Sekunden: digitale Zeiterfassung per App, automatische Pausenberechnung nach ArbZG, Stundenzettel-Scanner, Notfall-Besetzung, DATEV-Export und rechtssichere Dienstplanung. DSGVO-konform, Daten in Deutschland.",
    thumbnailUrl: `${SITE_URL}/videos/landing/poster-clean-1920.jpg`,
    uploadDate: "2026-10-02",
    duration: "PT1M26S",
    contentUrl: `${SITE_URL}/videos/landing/shiftfy-erklaervideo-1080.mp4`,
    inLanguage: "de",
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised through JSON.stringify, so the copy above cannot break out
        // of the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <LandingPage />
    </>
  );
}
