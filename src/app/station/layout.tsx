import type { ReactNode } from "react";
import type { Viewport } from "next";

export const metadata = {
  title: "Stempelstation | Shiftfy",
  description: "QR-Stempelstation für Mitarbeiter",
};

export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
};

export default function StationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
