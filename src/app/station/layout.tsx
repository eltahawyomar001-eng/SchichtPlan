import type { ReactNode } from "react";

export const metadata = {
  title: "Stempelstation | Shiftfy",
  description: "QR-Stempelstation für Mitarbeiter",
};

export default function StationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
