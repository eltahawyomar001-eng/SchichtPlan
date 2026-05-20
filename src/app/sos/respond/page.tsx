import { Suspense } from "react";
import { SosRespondClient } from "./_client";

export const metadata = { title: "Schicht annehmen – Shiftfy" };

export default function SosRespondPage() {
  return (
    <Suspense>
      <SosRespondClient />
    </Suspense>
  );
}
