import type { Metadata } from "next";
import Link from "next/link";
import {
  ShiftfyMark,
  ShieldCheckIcon,
  LockIcon,
  GlobeIcon,
  FileCheckIcon,
  ClockIcon,
  DatabaseIcon,
  CheckCircleIcon,
} from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Sicherheit & Vertrauen",
  description:
    "Wie Shiftfy Ihre Daten schützt: EU-Hosting, Verschlüsselung, DSGVO, Auftragsverarbeitung, Prüfbereitschaft und Arbeitsrecht — eingebaut.",
  alternates: { canonical: "/sicherheit" },
  robots: { index: true, follow: true },
};

const pillars = [
  {
    icon: GlobeIcon,
    title: "100 % Hosting in der EU",
    body: "Alle Daten werden ausschließlich in deutschen bzw. EU-Rechenzentren (Frankfurt am Main, AWS eu-central-1) verarbeitet und gespeichert. Kein Datentransfer in Drittländer für den regulären Betrieb.",
  },
  {
    icon: LockIcon,
    title: "Verschlüsselung Ende-zu-Ende",
    body: "Übertragung per TLS, Daten im Ruhezustand verschlüsselt. Passwörter werden ausschließlich gehasht gespeichert (bcrypt), niemals im Klartext.",
  },
  {
    icon: DatabaseIcon,
    title: "Mandantentrennung",
    body: "Jeder Workspace ist strikt voneinander isoliert. Eine zusätzliche Workspace-Scope-Schicht in der Anwendung stellt sicher, dass kein Betrieb die Daten eines anderen sehen kann.",
  },
  {
    icon: FileCheckIcon,
    title: "Auftragsverarbeitung (AVV)",
    body: "Ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO wird mit jeder Registrierung abgeschlossen und steht jederzeit zum Abruf bereit.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Prüfungssicher auf Knopfdruck",
    body: "Ein revisionssicheres Prüf-Dossier (Zoll/FKS, §34a, MiLoG) mit Bereitschafts-Score und SHA-256-Manipulationsschutz lässt sich jederzeit erzeugen.",
  },
  {
    icon: ClockIcon,
    title: "Arbeitsrecht — eingebaut",
    body: "ArbZG-Pausen und -Ruhezeiten sowie der gesetzliche Mindestlohn werden direkt in der Planung erzwungen — als harte Regel, nicht als Checkliste.",
  },
];

const subprocessors = [
  ["Vercel", "Hosting / Dateispeicher", "EU (Frankfurt)"],
  ["Supabase", "Datenbank (PostgreSQL)", "EU (Frankfurt)"],
  ["Resend", "E-Mail-Versand", "EU-SCCs"],
  ["Stripe", "Zahlungsabwicklung", "EU / DPF"],
  ["Sentry", "Fehlerüberwachung", "EU (Frankfurt)"],
  ["Upstash", "Rate Limiting", "EU (Frankfurt)"],
  [
    "Anthropic / OpenAI",
    "KI-Texterkennung (optional)",
    "US-SCCs, kein Training",
  ],
];

export default function SicherheitPage() {
  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900 dark:text-zinc-100">
              Shift<span className="text-gradient">fy</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/datenschutz"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Datenschutz
            </Link>
            <Link
              href="/avv"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              AVV
            </Link>
            <ThemeToggle />
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              7 Tage testen
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-4">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            <span>DSGVO-konform · Made in Germany</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
            Sicherheit & Vertrauen
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-zinc-400 leading-relaxed">
            Sie vertrauen Shiftfy hochsensible Personaldaten an. Deshalb ist
            Datenschutz bei uns keine Behauptung, sondern nachweisbar in das
            Produkt eingebaut. Hier sehen Sie konkret, wie.
          </p>
        </div>

        {/* Pillars */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 mb-3">
                <p.icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                {p.title}
              </h3>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        {/* Subprocessors */}
        <section className="mt-14">
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Eingesetzte Dienstleister (Auftragsverarbeiter)
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            Volle Transparenz: Mit jedem Dienstleister besteht ein
            Auftragsverarbeitungsvertrag nach Art. 28 DSGVO. Details in der{" "}
            <Link
              href="/datenschutz"
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              Datenschutzerklärung
            </Link>
            .
          </p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-zinc-900/60 text-left text-gray-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Dienstleister</th>
                  <th className="px-4 py-2.5 font-medium">Zweck</th>
                  <th className="px-4 py-2.5 font-medium">
                    Standort / Garantie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                {subprocessors.map(([name, purpose, loc]) => (
                  <tr key={name}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-zinc-100">
                      {name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-400">
                      {purpose}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-400">
                      {loc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Data subject rights */}
        <section className="mt-14">
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
            Ihre Rechte & Ihre Kontrolle
          </h2>
          <ul className="mt-4 space-y-2.5">
            {[
              "Datenexport jederzeit selbst möglich (Auskunft nach Art. 15 DSGVO).",
              "Vollständige Löschung Ihres Workspace auf Knopfdruck (Art. 17 DSGVO).",
              "Revisionssichere Audit-Logs aller relevanten Änderungen.",
              "Tägliche Backups mit Wiederherstellungsverfahren.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-zinc-300">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Links */}
        <section className="mt-14 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            Dokumente
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[
              ["Datenschutzerklärung", "/datenschutz"],
              ["Auftragsverarbeitungsvertrag (AVV)", "/avv"],
              ["AGB", "/agb"],
              ["Service Level (SLA)", "/sla"],
              ["Impressum", "/impressum"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 dark:border-zinc-800 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
              Shiftfy
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-zinc-500">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Datenschutz
            </Link>
            <Link
              href="/sicherheit"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Sicherheit
            </Link>
            <Link
              href="/avv"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              AVV
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
