import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ersparnisrechner – Shiftfy",
  description:
    "Berechnen Sie, wie viel Zeit und Geld Ihr Unternehmen mit Shiftfy sparen kann. ROI-Kalkulator für Schichtplanung und Zeiterfassung.",
  alternates: { canonical: "/ersparnisrechner" },
  robots: { index: true, follow: true },
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
