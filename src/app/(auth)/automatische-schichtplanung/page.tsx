import type { Metadata } from "next";
import SeoLandingPage from "@/components/seo/SeoLandingPage";
import {
  SparklesIcon,
  ScaleIcon,
  ClockIcon,
  FileExportIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Automatische Schichtplanung mit Zuschlägen – Software | Shiftfy",
  description:
    "Automatische Schichtplanung: Shiftfy plant Schichten automatisch nach Verfügbarkeit, Qualifikation & Arbeitszeitgesetz und berechnet Nacht-, Sonn- & Feiertagszuschläge. Zeiterfassung inklusive, DATEV-Export, Made in Germany. 7 Tage testen.",
  keywords: [
    "automatische Schichtplanung",
    "automatisierte Schichtplanung",
    "automatische Schichtplanung Software",
    "Zeiterfassung mit automatischer Schichtplanung",
    "Schichtplanung mit Zuschlägen",
    "Nachtzuschlag automatisch berechnen",
    "Schichtplanung Software Deutschland",
    "KI Schichtplanung",
    "Dienstplan automatisch erstellen",
    "Schichtplaner automatisch",
  ],
  alternates: { canonical: "/automatische-schichtplanung" },
  openGraph: {
    title: "Automatische Schichtplanung mit Zuschlägen – Software | Shiftfy",
    description:
      "Schichten automatisch planen nach Verfügbarkeit, Qualifikation & ArbZG. Nacht-, Sonn- & Feiertagszuschläge automatisch. 7 Tage testen.",
    url: "https://www.shiftfy.de/automatische-schichtplanung",
  },
};

export default function AutomatischeSchichtplanungPage() {
  return (
    <SeoLandingPage
      segmentLabel="Automatische Schichtplanung"
      titleLead="Schichten automatisch planen –"
      titleHighlight="mit Zuschlägen"
      subtitle="Shiftfy erstellt Dienstpläne automatisch nach Verfügbarkeit, Qualifikation und Arbeitszeitgesetz – und berechnet Nacht-, Sonn- und Feiertagszuschläge gleich mit. Inklusive Zeiterfassung und DATEV-Export. Entwickelt und gehostet in Deutschland."
      breadcrumb={{
        name: "Automatische Schichtplanung",
        path: "/automatische-schichtplanung",
      }}
      navLink={{ href: "/schichtplanung-software", label: "Schichtplanung" }}
      featuresHeading="So plant Shiftfy automatisch"
      featuresIntro="Aus offenen Schichten, Verfügbarkeiten und Regeln entsteht in Sekunden ein fertiger, gesetzeskonformer Dienstplan."
      features={[
        {
          title: "Auto-Scheduler",
          description:
            "Definieren Sie den Personalbedarf pro Schicht – Shiftfy weist automatisch passende Mitarbeiter zu, fair verteilt und unter Berücksichtigung von Wunsch- und Sperrzeiten.",
          icon: SparklesIcon,
        },
        {
          title: "Arbeitszeitgesetz automatisch eingehalten",
          description:
            "Ruhezeiten (11-Stunden-Regel), Höchstarbeitszeiten und Pausen werden bei jeder automatischen Planung geprüft – Verstöße entstehen gar nicht erst.",
          icon: ScaleIcon,
        },
        {
          title: "Zuschläge automatisch berechnen",
          description:
            "Nacht-, Sonn- und Feiertagszuschläge werden direkt aus den geplanten und geleisteten Schichten ermittelt – ohne manuelle Nachrechnung.",
          icon: ClockIcon,
        },
        {
          title: "Zeiterfassung & DATEV-Export",
          description:
            "Ist-Zeiten werden per App erfasst, mit dem Plan abgeglichen und inklusive Zuschlägen nach DATEV exportiert – eine durchgängige Kette von Plan bis Lohn.",
          icon: FileExportIcon,
        },
      ]}
      benefitsHeading="Warum automatische Schichtplanung mit Shiftfy"
      benefits={[
        "Schichtplan in Sekunden statt Stunden – per Auto-Scheduler",
        "Faire, regelbasierte Verteilung der Schichten",
        "Verfügbarkeiten, Wünsche und Qualifikationen automatisch berücksichtigt",
        "Nacht-, Sonn- und Feiertagszuschläge automatisch berechnet",
        "Arbeitszeitgesetz & Ruhezeiten ohne manuelle Prüfung eingehalten",
        "Integrierte Zeiterfassung per App oder QR-Code",
        "DATEV- und Lohnexport mit einem Klick",
        "Made & hosted in Germany – DSGVO-konform, Server in der EU",
      ]}
      explainerHeading="Was ist automatische Schichtplanung?"
      explainer={[
        {
          text: "Automatische Schichtplanung bedeutet, dass eine Software den Dienstplan selbstständig erstellt – statt ihn manuell in Excel zusammenzustellen. Sie geben den Bedarf vor (welche Schichten mit wie vielen und welchen Qualifikationen besetzt werden müssen), und Shiftfy verteilt die passenden Mitarbeiter automatisch unter Berücksichtigung von Verfügbarkeiten, Wunschschichten und gesetzlichen Vorgaben.",
        },
        {
          lead: "Mit Zuschlägen gedacht:",
          text: "Gerade in Deutschland sind Nacht-, Sonn- und Feiertagszuschläge ein wesentlicher Teil der Lohnabrechnung. Shiftfy berechnet diese Zuschläge automatisch aus den geplanten und tatsächlich geleisteten Schichten – die Basis für einen sauberen DATEV- und Lohnexport.",
        },
        {
          lead: "Für wen geeignet?",
          text: "Für alle Betriebe mit Schichtarbeit und wechselnden Besetzungen: Sicherheitsdienste, Gastronomie, Pflege, Logistik, Einzelhandel und Produktion. Jedes Konto startet mit einer 7-tägigen Testphase, danach ab 2,99 €/Nutzer/Monat.",
        },
      ]}
      faqs={[
        {
          q: "Plant Shiftfy Schichten wirklich vollautomatisch?",
          a: "Ja. Der Auto-Scheduler erstellt aus Personalbedarf, Verfügbarkeiten, Qualifikationen und gesetzlichen Regeln einen kompletten Vorschlag. Sie können diesen vor der Veröffentlichung prüfen und anpassen.",
        },
        {
          q: "Werden Nacht- und Feiertagszuschläge automatisch berechnet?",
          a: "Ja. Zuschläge für Nacht-, Sonn- und Feiertagsarbeit werden automatisch aus den Schichten ermittelt und stehen für den DATEV- und Lohnexport bereit.",
        },
        {
          q: "Hält die automatische Planung das Arbeitszeitgesetz ein?",
          a: "Ja. Ruhezeiten, Höchstarbeitszeiten und Pausen werden bei jeder automatischen Planung geprüft, sodass ArbZG-Verstöße vermieden werden.",
        },
        {
          q: "Ist Shiftfy DSGVO-konform und in Deutschland gehostet?",
          a: "Ja. Shiftfy wird in Deutschland entwickelt und auf Servern in der EU betrieben – DSGVO-konform.",
        },
      ]}
      ctaHeading="Schichtplanung automatisieren – inklusive Zuschläge"
      related={[
        { href: "/schichtplanung-software", label: "Schichtplanung Software" },
        { href: "/zeiterfassung-software", label: "Zeiterfassung Software" },
        { href: "/pricing", label: "Preise vergleichen" },
      ]}
    />
  );
}
