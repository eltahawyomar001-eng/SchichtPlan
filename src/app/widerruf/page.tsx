import type { Metadata } from "next";
import Link from "next/link";
import { ShiftfyMark } from "@/components/icons";
import ThemeToggle from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Widerrufsbelehrung",
  description: "Widerrufsbelehrung und Widerrufsformular für Shiftfy.",
  alternates: { canonical: "/widerruf" },
  robots: { index: true, follow: true },
};

export default function WiderrufPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950 dark:bg-gray-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <ShiftfyMark className="h-7 w-7" />
            <span className="font-bold text-base text-gray-900 dark:text-zinc-100 dark:text-white">
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
            <Link
              href="/blog"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Blog
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden sm:inline-flex"
            >
              Login
            </Link>
            <ThemeToggle />
            <Link
              href="/register"
              className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:shadow-lg hover:shadow-emerald-200/50 transition-all"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-2">
          Widerrufsbelehrung
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-8">
          Stand:{" "}
          {new Date().toLocaleDateString("de-DE", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
          {/* 1. Widerrufsrecht */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              1. Widerrufsrecht
            </h2>
            <p>
              Sie haben das Recht, binnen <strong>vierzehn Tagen</strong> ohne
              Angabe von Gründen diesen Vertrag zu widerrufen.
            </p>
            <p className="mt-2">
              Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
              Vertragsschlusses (Registrierung bei Shiftfy).
            </p>
            <p className="mt-2">
              Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer
              eindeutigen Erklärung (z.&nbsp;B. ein mit der Post versandter
              Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu
              widerrufen, informieren. Sie können dafür das beigefügte
              Muster-Widerrufsformular verwenden, das jedoch nicht
              vorgeschrieben ist.
            </p>
            <p className="mt-3">
              <strong>Kontakt für den Widerruf:</strong>
            </p>
            <p>
              Bashabsheh Vergabepartner
              <br />
              Mohammad Bashabsheh
              <br />
              c/o VirtualOfficeBerlin
              <br />
              Kolonnenstraße 8, 10827 Berlin, Deutschland
              <br />
              E-Mail: info@bashabsheh-vergabepartner.de
              <br />
              Telefon: +49 176 30365636
            </p>
            <p className="mt-2">
              Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
              Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
              Widerrufsfrist absenden.
            </p>
          </section>

          {/* 2. Folgen des Widerrufs */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              2. Folgen des Widerrufs
            </h2>
            <p>
              Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle
              Zahlungen, die wir von Ihnen erhalten haben, einschließlich der
              Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich
              daraus ergeben, dass Sie eine andere Art der Lieferung als die von
              uns angebotene, günstigste Standardlieferung gewählt haben),
              unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag
              zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses
              Vertrags bei uns eingegangen ist.
            </p>
            <p className="mt-2">
              Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das
              Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei
              denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in
              keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte
              berechnet.
            </p>
          </section>

          {/* 3. Vorzeitiges Erlöschen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              3. Vorzeitiges Erlöschen des Widerrufsrechts
            </h2>
            <p>
              Das Widerrufsrecht erlischt vorzeitig, wenn wir mit der Ausführung
              des Vertrags erst begonnen haben, nachdem Sie dazu Ihre
              ausdrückliche Zustimmung gegeben und gleichzeitig Ihre Kenntnis
              davon bestätigt haben, dass Sie Ihr Widerrufsrecht bei
              vollständiger Vertragserfüllung durch uns verlieren (§&nbsp;356
              Abs.&nbsp;4 BGB).
            </p>
            <p className="mt-2">
              Bei der Registrierung stimmen Sie zu, dass die Bereitstellung der
              digitalen Inhalte (Zugang zur Shiftfy-Plattform) sofort nach
              Vertragsschluss beginnt. Sie bestätigen damit, dass Sie Kenntnis
              davon haben, dass Sie dadurch Ihr Widerrufsrecht verlieren, sobald
              wir mit der Ausführung des Vertrags vollständig begonnen haben.
            </p>
          </section>

          {/* 4. Muster-Widerrufsformular */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              4. Muster-Widerrufsformular
            </h2>
            <p className="mb-3">
              (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte
              dieses Formular aus und senden Sie es zurück.)
            </p>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-3">
              <p>
                An:
                <br />
                Bashabsheh Vergabepartner — Mohammad Bashabsheh
                <br />
                Kolonnenstraße 8, 10827 Berlin
                <br />
                E-Mail: info@bashabsheh-vergabepartner.de
              </p>
              <p>
                Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*)
                abgeschlossenen Vertrag über die Erbringung der folgenden
                Dienstleistung:
              </p>
              <p className="text-gray-500 dark:text-zinc-400 italic">
                Nutzung der Shiftfy-Plattform (Schichtplanung, Zeiterfassung,
                Personalverwaltung)
              </p>
              <ul className="list-none space-y-2 pl-0">
                <li>Bestellt am / erhalten am (*): _______________</li>
                <li>Name des/der Verbraucher(s): _______________</li>
                <li>Anschrift des/der Verbraucher(s): _______________</li>
                <li className="pt-2">
                  Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf
                  Papier): _______________
                </li>
                <li>Datum: _______________</li>
              </ul>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-3">
                (*) Unzutreffendes streichen.
              </p>
            </div>
          </section>

          {/* 5. Rechtsgrundlagen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
              5. Rechtsgrundlagen
            </h2>
            <p>
              Diese Widerrufsbelehrung erfolgt gemäß den gesetzlichen Vorgaben
              der §§&nbsp;312b–312h, 355–357 BGB (Fernabsatzgesetz) sowie der
              Verbraucherrechterichtlinie 2011/83/EU (Anlage 1 zu Art.&nbsp;246a
              §&nbsp;1 Abs.&nbsp;2 Satz&nbsp;2 EGBGB).
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 dark:border-zinc-800 py-10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          <div className="flex items-center gap-2">
            <ShiftfyMark className="w-6 h-6" />
            <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">
              Shiftfy
            </span>
          </div>
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center">
            © {new Date().getFullYear()} Shiftfy. Alle Rechte vorbehalten.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400 dark:text-zinc-500">
            <Link
              href="/datenschutz"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Datenschutz
            </Link>
            <Link
              href="/impressum"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Impressum
            </Link>
            <Link
              href="/agb"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              AGB
            </Link>
            <Link
              href="/widerruf"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Widerruf
            </Link>
            <Link
              href="/barrierefreiheit"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              Barrierefreiheit
            </Link>
            <Link
              href="/sla"
              className="hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            >
              SLA
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
