import Link from "next/link";
import { SchichtPlanMark } from "@/components/icons";

export default function WiderrufPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <SchichtPlanMark className="h-7 w-7" />
            <span className="text-lg font-bold text-gray-900">
              Schicht<span className="text-gradient">Plan</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Widerrufsbelehrung
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Stand:{" "}
          {new Date().toLocaleDateString("de-DE", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <div className="prose prose-gray max-w-none space-y-6 text-sm text-gray-700 leading-relaxed">
          {/* 1. Widerrufsrecht */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              1. Widerrufsrecht
            </h2>
            <p>
              Sie haben das Recht, binnen <strong>vierzehn Tagen</strong> ohne
              Angabe von Gründen diesen Vertrag zu widerrufen.
            </p>
            <p className="mt-2">
              Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
              Vertragsschlusses (Registrierung bei SchichtPlan).
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
              SchichtPlan
              <br />
              Omar Rageh
              <br />
              Fulda, Deutschland
              <br />
              E-Mail: kontakt@schichtplan.plan
            </p>
            <p className="mt-2">
              Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
              Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
              Widerrufsfrist absenden.
            </p>
          </section>

          {/* 2. Folgen des Widerrufs */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
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
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
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
              digitalen Inhalte (Zugang zur SchichtPlan-Plattform) sofort nach
              Vertragsschluss beginnt. Sie bestätigen damit, dass Sie Kenntnis
              davon haben, dass Sie dadurch Ihr Widerrufsrecht verlieren, sobald
              wir mit der Ausführung des Vertrags vollständig begonnen haben.
            </p>
          </section>

          {/* 4. Muster-Widerrufsformular */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              4. Muster-Widerrufsformular
            </h2>
            <p className="mb-3">
              (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte
              dieses Formular aus und senden Sie es zurück.)
            </p>
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
              <p>
                An:
                <br />
                SchichtPlan — Omar Rageh
                <br />
                E-Mail: kontakt@schichtplan.plan
              </p>
              <p>
                Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*)
                abgeschlossenen Vertrag über die Erbringung der folgenden
                Dienstleistung:
              </p>
              <p className="text-gray-500 italic">
                Nutzung der SchichtPlan-Plattform (Schichtplanung,
                Zeiterfassung, Personalverwaltung)
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
              <p className="text-xs text-gray-400 mt-3">
                (*) Unzutreffendes streichen.
              </p>
            </div>
          </section>

          {/* 5. Rechtsgrundlagen */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
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

        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link
            href="/"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            &larr; Zurück zur Startseite
          </Link>
        </div>
      </main>
    </div>
  );
}
