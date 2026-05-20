import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Was ist neu? — Shiftfy",
  description:
    "Aktuelle Verbesserungen und neue Funktionen in Shiftfy. Bleiben Sie über Updates rund um Schichtplanung, Zeiterfassung und Compliance auf dem Laufenden.",
  alternates: { canonical: "/changelog" },
  robots: { index: true, follow: true },
};

interface ReleaseNote {
  date: string;
  version: string;
  highlights: string[];
}

const releases: ReleaseNote[] = [
  {
    date: "2026-05-07",
    version: "0.7.0",
    highlights: [
      "7-tägiger kostenloser Testzeitraum für alle neuen Workspaces",
      "Rechnungsübersicht mit PDF-Download im Abonnement-Bereich",
      "QR-Stempelprotokoll mit Audit-Log für Manager",
      "DSGVO Art. 17 — Kontolöschung im Self-Service",
      "DSGVO Art. 20 — Datenexport im Self-Service",
      "In-App-Feedback-Widget für Bug-Reports und Funktionswünsche",
      "Versionsbasierte AGB-/Datenschutz-Zustimmung mit Re-Acceptance-Modal",
      "Banner für überfällige Zahlungen (PAST_DUE)",
      "Alle Fehlertexte im Billing-Bereich auf Deutsch",
    ],
  },
  {
    date: "2026-05-06",
    version: "0.6.0",
    highlights: [
      "White-Hat-Sicherheits-Audit umgesetzt (alle 14 Findings behoben)",
      "PIN-Brute-Force-Schutz mit 5-Versuchs-Lockout",
      "Einmalige PIN-Übermittlung per signiertem Reveal-Link",
      "Idle-Session-Timeout nach 15 Minuten Inaktivität",
      "HttpOnly-Cookie-Authentifizierung für Stempelstationen",
      "Strikte CSP mit Per-Request-Nonces",
    ],
  },
  {
    date: "2026-05-05",
    version: "0.5.0",
    highlights: [
      "GoBD-konforme Rechnungslegung (Identitätsfelder eingefroren)",
      "Synchroner Webhook-Schreibvorgang für Rechnungspersistenz",
      "Foreign-Key-Cascade-Audit (verwaiste Daten verhindert)",
      "Barrierefreiheit (BFSG/WCAG 2.1) — PIN-Tastatur a11y",
      "Offline-Banner für die Stempeluhr",
      "Dark-Mode-Konsistenz auf allen Dashboard-Seiten",
    ],
  },
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-zinc-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900 dark:text-white">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Startseite
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Preise
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-10 sm:mb-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
            Changelog
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Was ist neu?
          </h1>
          <p className="mt-3 text-gray-600 dark:text-zinc-400 leading-relaxed">
            Wir verbessern Shiftfy kontinuierlich. Hier finden Sie alle
            wichtigen Updates der letzten Wochen.
          </p>
        </header>

        <ol className="relative border-l border-gray-200 dark:border-zinc-800 ml-2">
          {releases.map((release) => (
            <li key={release.version} className="ml-6 pb-10 last:pb-0">
              <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-950 bg-emerald-500" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  v{release.version}
                </h2>
                <time
                  dateTime={release.date}
                  className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-400 font-medium"
                >
                  {formatDate(release.date)}
                </time>
              </div>
              <ul className="space-y-2">
                {release.highlights.map((highlight, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-zinc-300"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="leading-relaxed">{highlight}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <footer className="mt-16 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
            Sie vermissen eine Funktion? Senden Sie uns Ihren Wunsch direkt aus
            der App — wir hören zu.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Kostenlos testen →
          </Link>
        </footer>
      </main>
    </div>
  );
}
