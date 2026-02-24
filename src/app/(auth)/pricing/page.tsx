import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Preise – Schichtplanung Software ab 0 €",
  description:
    "Shiftfy Preise: Kostenloser Starter-Plan für bis zu 5 Mitarbeiter. Team ab 4,90 €/Mitarbeiter/Monat. Zeiterfassung, Schichtplanung, Lohnexport inklusive.",
  keywords: [
    "Schichtplanung Preise",
    "Zeiterfassung Kosten",
    "Dienstplan Software Preise",
    "kostenlose Schichtplanung",
    "Personalplanung Kosten",
  ],
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Shiftfy Preise – Schichtplanung ab 0 €/Monat",
    description:
      "Kostenlos starten mit bis zu 5 Mitarbeitern. Team- und Business-Pläne für wachsende Unternehmen.",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
