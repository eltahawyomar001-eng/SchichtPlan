import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Preise – Schichtplanung ab 2,99 € pro Nutzer",
  description:
    "Shiftfy Preise: Einfach pro Nutzer bezahlen — keine Grundgebühr. Basic ab 2,99 €/Nutzer/Monat. Zeiterfassung, Schichtplanung, Lohnexport inklusive.",
  keywords: [
    "Schichtplanung Preise",
    "Zeiterfassung Kosten",
    "Dienstplan Software Preise",
    "günstige Schichtplanung",
    "Personalplanung Kosten",
  ],
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Shiftfy Preise – Schichtplanung ab 2,99 €/Nutzer/Monat",
    description:
      "Einfach pro Nutzer bezahlen — keine Grundgebühr. Basic ab 2,99 €, Professional ab 4,99 €. Schichtplanung immer inklusive.",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
