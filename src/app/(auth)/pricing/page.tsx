import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  // Says what 2,99 € actually buys. The previous title and description both
  // placed "Schichtplanung" next to that price, which is the module that
  // costs 1,50 € extra -- the claim that prompted a customer to write in
  // asking what the plans actually contain.
  title: "Preise – Zeiterfassung ab 2,99 € pro Nutzer",
  description:
    "Shiftfy Preise: Einfach pro Nutzer bezahlen — keine Grundgebühr. Basic ab 2,99 €/Nutzer/Monat inkl. Zeiterfassung. Schichtplanung als Zusatzmodul ab 1,50 €/Nutzer/Monat.",
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
    title: "Shiftfy Preise – Zeiterfassung ab 2,99 €/Nutzer/Monat",
    description:
      "Einfach pro Nutzer bezahlen — keine Grundgebühr. Basic ab 2,99 €, Professional ab 4,99 €. Schichtplanung als Zusatzmodul ab 1,50 €/Nutzer/Monat.",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
