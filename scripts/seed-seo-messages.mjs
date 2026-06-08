/**
 * Injects the `seoCommon` + `seo.*` translation namespaces used by the
 * SEO landing pages into messages/de.json and messages/en.json.
 *
 * Idempotent: re-running overwrites only these two top-level keys, preserving
 * everything else. Run: `node scripts/seed-seo-messages.mjs`
 *
 * Keep page slugs here in sync with src/app/(auth)/<slug>/page.tsx.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const seoCommon = {
  de: {
    home: "Startseite",
    tryFree: "7 Tage testen",
    pricing: "Preise",
    pricingView: "Preise ansehen",
    trialLine:
      "7 Tage Testphase · Jederzeit kündbar · DSGVO-konform · Server in der EU",
    faqHeading: "Häufige Fragen",
    discoverMore: "Mehr entdecken",
    ctaSubtitleDefault:
      "7 Tage testen — danach ab 2,99 €/Nutzer/Monat. Jederzeit kündbar.",
    datenschutz: "Datenschutz",
    impressum: "Impressum",
    agb: "AGB",
  },
  en: {
    home: "Home",
    tryFree: "Try 7 days free",
    pricing: "Pricing",
    pricingView: "View pricing",
    trialLine:
      "7-day trial · Cancel anytime · GDPR-compliant · Servers in the EU",
    faqHeading: "Frequently asked questions",
    discoverMore: "Discover more",
    ctaSubtitleDefault:
      "Try 7 days free — then from €2.99/user/month. Cancel anytime.",
    datenschutz: "Privacy",
    impressum: "Imprint",
    agb: "Terms",
  },
};

const seo = {
  de: {
    automatischeSchichtplanung: {
      metaTitle: "Automatische Schichtplanung mit Zuschlägen – Software | Shiftfy",
      metaDescription:
        "Automatische Schichtplanung: Shiftfy plant Schichten automatisch nach Verfügbarkeit, Qualifikation & Arbeitszeitgesetz und berechnet Nacht-, Sonn- & Feiertagszuschläge. Zeiterfassung inklusive, DATEV-Export, Made in Germany. 7 Tage testen.",
      keywords: [
        "automatische Schichtplanung",
        "automatisierte Schichtplanung",
        "automatische Schichtplanung Software",
        "Zeiterfassung mit automatischer Schichtplanung",
        "Schichtplanung mit Zuschlägen",
        "Nachtzuschlag automatisch berechnen",
        "Schichtplanung Software Deutschland",
        "Dienstplan automatisch erstellen",
        "Schichtplaner automatisch",
      ],
      segmentLabel: "Automatische Schichtplanung",
      titleLead: "Schichten automatisch planen –",
      titleHighlight: "mit Zuschlägen",
      subtitle:
        "Shiftfy erstellt Dienstpläne automatisch nach Verfügbarkeit, Qualifikation und Arbeitszeitgesetz – und berechnet Nacht-, Sonn- und Feiertagszuschläge gleich mit. Inklusive Zeiterfassung und DATEV-Export. Entwickelt und gehostet in Deutschland.",
      breadcrumbName: "Automatische Schichtplanung",
      navLabel: "Schichtplanung",
      featuresHeading: "So plant Shiftfy automatisch",
      featuresIntro:
        "Aus offenen Schichten, Verfügbarkeiten und Regeln entsteht in Sekunden ein fertiger, gesetzeskonformer Dienstplan.",
      features: [
        {
          title: "Auto-Scheduler",
          description:
            "Definieren Sie den Personalbedarf pro Schicht – Shiftfy weist automatisch passende Mitarbeiter zu, fair verteilt und unter Berücksichtigung von Wunsch- und Sperrzeiten.",
        },
        {
          title: "Arbeitszeitgesetz automatisch eingehalten",
          description:
            "Ruhezeiten (11-Stunden-Regel), Höchstarbeitszeiten und Pausen werden bei jeder automatischen Planung geprüft – Verstöße entstehen gar nicht erst.",
        },
        {
          title: "Zuschläge automatisch berechnen",
          description:
            "Nacht-, Sonn- und Feiertagszuschläge werden direkt aus den geplanten und geleisteten Schichten ermittelt – ohne manuelle Nachrechnung.",
        },
        {
          title: "Zeiterfassung & DATEV-Export",
          description:
            "Ist-Zeiten werden per App erfasst, mit dem Plan abgeglichen und inklusive Zuschlägen nach DATEV exportiert – eine durchgängige Kette von Plan bis Lohn.",
        },
      ],
      benefitsHeading: "Warum automatische Schichtplanung mit Shiftfy",
      benefits: [
        "Schichtplan in Sekunden statt Stunden – per Auto-Scheduler",
        "Faire, regelbasierte Verteilung der Schichten",
        "Verfügbarkeiten, Wünsche und Qualifikationen automatisch berücksichtigt",
        "Nacht-, Sonn- und Feiertagszuschläge automatisch berechnet",
        "Arbeitszeitgesetz & Ruhezeiten ohne manuelle Prüfung eingehalten",
        "Integrierte Zeiterfassung per App oder QR-Code",
        "DATEV- und Lohnexport mit einem Klick",
        "Made & hosted in Germany – DSGVO-konform, Server in der EU",
      ],
      explainerHeading: "Was ist automatische Schichtplanung?",
      explainer: [
        {
          text: "Automatische Schichtplanung bedeutet, dass eine Software den Dienstplan selbstständig erstellt – statt ihn manuell in Excel zusammenzustellen. Sie geben den Bedarf vor, und Shiftfy verteilt die passenden Mitarbeiter automatisch unter Berücksichtigung von Verfügbarkeiten, Wunschschichten und gesetzlichen Vorgaben.",
        },
        {
          lead: "Mit Zuschlägen gedacht:",
          text: "Gerade in Deutschland sind Nacht-, Sonn- und Feiertagszuschläge ein wesentlicher Teil der Lohnabrechnung. Shiftfy berechnet diese Zuschläge automatisch aus den geplanten und geleisteten Schichten – die Basis für einen sauberen DATEV- und Lohnexport.",
        },
        {
          lead: "Für wen geeignet?",
          text: "Für alle Betriebe mit Schichtarbeit: Sicherheitsdienste, Gastronomie, Pflege, Logistik, Einzelhandel und Produktion. Jedes Konto startet mit einer 7-tägigen Testphase, danach ab 2,99 €/Nutzer/Monat.",
        },
      ],
      faqs: [
        {
          q: "Plant Shiftfy Schichten wirklich vollautomatisch?",
          a: "Ja. Der Auto-Scheduler erstellt aus Personalbedarf, Verfügbarkeiten, Qualifikationen und gesetzlichen Regeln einen kompletten Vorschlag, den Sie vor der Veröffentlichung prüfen und anpassen können.",
        },
        {
          q: "Werden Nacht- und Feiertagszuschläge automatisch berechnet?",
          a: "Ja. Zuschläge für Nacht-, Sonn- und Feiertagsarbeit werden automatisch aus den Schichten ermittelt und stehen für den DATEV- und Lohnexport bereit.",
        },
        {
          q: "Hält die automatische Planung das Arbeitszeitgesetz ein?",
          a: "Ja. Ruhezeiten, Höchstarbeitszeiten und Pausen werden bei jeder automatischen Planung geprüft, sodass ArbZG-Verstöße vermieden werden.",
        },
      ],
      ctaHeading: "Schichtplanung automatisieren – inklusive Zuschläge",
      relatedLabels: [
        "Schichtplanung Software",
        "Zeiterfassung Software",
        "Preise vergleichen",
      ],
    },

    schichtplanungSicherheitsdienst: {
      metaTitle:
        "Schichtplanung Sicherheitsdienst – Dienstplan & Zeiterfassung | Shiftfy",
      metaDescription:
        "Schichtplanung für Sicherheitsdienste: Dienstpläne für Objektschutz & Wachdienst erstellen, §34a-Qualifikationen prüfen, Nachtzuschläge automatisch berechnen, Zeiterfassung per App. 7 Tage testen, DSGVO-konform.",
      keywords: [
        "Schichtplanung Sicherheitsdienst",
        "Schichtplan Sicherheitsdienst",
        "Dienstplan Sicherheitsdienst",
        "Zeiterfassung Sicherheitsdienst",
        "Dienstplan Wachdienst",
        "Schichtplanung Objektschutz",
        "Personalplanung Sicherheitsdienst",
        "Einsatzplanung Sicherheitsdienst",
        "Sicherheitsdienst Software",
      ],
      segmentLabel: "Für Sicherheitsdienste",
      titleLead: "Schichtplanung & Zeiterfassung für",
      titleHighlight: "Sicherheitsdienste",
      subtitle:
        "Dienstpläne für Objektschutz und Wachdienst erstellen, §34a-Qualifikationen prüfen, Nacht- und Feiertagszuschläge automatisch berechnen – und die Arbeitszeit per App direkt am Objekt erfassen.",
      breadcrumbName: "Schichtplanung Sicherheitsdienst",
      navLabel: "Schichtplanung",
      featuresHeading: "Speziell für den Wach- und Sicherheitsbereich",
      featuresIntro:
        "Von der 24/7-Objektbesetzung bis zur Zuschlagsberechnung – Shiftfy bildet die Anforderungen von Sicherheitsdiensten ab.",
      features: [
        {
          title: "24/7-Dienstpläne für Objektschutz",
          description:
            "Planen Sie Früh-, Spät- und Nachtschichten über mehrere Objekte und Standorte hinweg – lückenlose Besetzung rund um die Uhr per Drag-and-Drop.",
        },
        {
          title: "§34a-Qualifikationen automatisch prüfen",
          description:
            "Hinterlegen Sie Sachkundeprüfung §34a, Unterrichtungsnachweis und Zertifikate je Mitarbeiter. Shiftfy plant nur Personal ein, das für das Objekt qualifiziert ist.",
        },
        {
          title: "Nacht-, Sonn- & Feiertagszuschläge",
          description:
            "Zuschläge für Nacht-, Sonn- und Feiertagsarbeit werden automatisch erfasst und berechnet – direkt aus den geleisteten Schichten für den Lohnexport.",
        },
        {
          title: "Mobile Zeiterfassung im Einsatz",
          description:
            "Wachpersonal stempelt per App oder QR-Code am Objekt ein und aus. Ist-Zeiten fließen automatisch in die Lohnabrechnung – kein Papier, keine Excel-Listen.",
        },
      ],
      benefitsHeading: "Warum Sicherheitsdienste Shiftfy nutzen",
      benefits: [
        "Mehrere Objekte und Auftraggeber in einem Dienstplan verwalten",
        "Arbeitszeitgesetz & Ruhezeiten (11-Stunden-Regel) automatisch einhalten",
        "Qualifikationen & Sachkundenachweise pro Einsatz prüfen",
        "Nacht-, Sonn- und Feiertagszuschläge automatisch berechnen",
        "Kurzfristige Ausfälle per SOS-Funktion schnell nachbesetzen",
        "Zeiterfassung per App oder QR-Code direkt am Objekt",
        "Lückenlose Dokumentation für Auftraggeber & Audits",
        "DSGVO-konform, Server in der EU",
      ],
      explainerHeading: "Dienstplan-Software für den Sicherheitsdienst",
      explainer: [
        {
          text: "Die Schichtplanung im Sicherheitsdienst ist besonders anspruchsvoll: Objekte müssen rund um die Uhr besetzt sein, Mitarbeiter brauchen gültige Qualifikationen wie die Sachkundeprüfung nach §34a GewO, und Zuschläge müssen korrekt abgerechnet werden. Shiftfy übernimmt diese Aufgaben automatisch – statt fehleranfälliger Excel-Dienstpläne.",
        },
        {
          lead: "Objektbezogene Einsatzplanung:",
          text: "Planen Sie Wachpersonal pro Objekt und Auftraggeber, erkennen Sie Doppelbuchungen und Unterbesetzungen sofort und reagieren Sie bei Ausfällen mit der SOS-Funktion in Minuten.",
        },
        {
          lead: "Zeiterfassung & Lohn:",
          text: "Mitarbeiter erfassen ihre Arbeitszeit per App oder QR-Code direkt am Einsatzort. Zuschläge und Ist-Zeiten fließen automatisch in den DATEV- und Lohnexport.",
        },
      ],
      faqs: [
        {
          q: "Ist Shiftfy für kleine und große Sicherheitsdienste geeignet?",
          a: "Ja. Shiftfy skaliert vom Ein-Objekt-Wachdienst bis zum überregionalen Sicherheitsunternehmen. Die Abrechnung erfolgt pro Nutzer und Monat, Sie zahlen nur für aktive Mitarbeiter.",
        },
        {
          q: "Werden §34a-Nachweise berücksichtigt?",
          a: "Ja. Sie hinterlegen Qualifikationen wie die Sachkundeprüfung §34a samt Ablaufdaten. Shiftfy warnt vor ablaufenden Nachweisen und verhindert die Einplanung nicht qualifizierter Kräfte.",
        },
        {
          q: "Können Nacht- und Feiertagszuschläge automatisch berechnet werden?",
          a: "Ja. Zuschläge werden automatisch aus den geleisteten Schichten ermittelt und stehen für DATEV- und Lohnexport bereit.",
        },
      ],
      ctaHeading: "Dienstplanung für Ihren Sicherheitsdienst digitalisieren",
      relatedLabels: [
        "Schichtplanung Software",
        "Zeiterfassung Logistik",
        "Preise vergleichen",
      ],
    },

    zeiterfassungLogistik: {
      metaTitle:
        "Zeiterfassung Logistik – Schichtplanung für Lager & Transport | Shiftfy",
      metaDescription:
        "Zeiterfassung & Schichtplanung für die Logistik: Arbeitszeiten im Lager per App erfassen, Schichten für Kommissionierung & Versand planen, Nacht- und Wochenendzuschläge automatisch berechnen. 7 Tage testen, DSGVO-konform.",
      keywords: [
        "Zeiterfassung Logistik",
        "Schichtplanung Logistik",
        "Zeiterfassung Lager",
        "Dienstplan Logistik",
        "Schichtplan Lager",
        "Personalplanung Logistik",
        "Zeiterfassung Spedition",
        "Einsatzplanung Lager",
      ],
      segmentLabel: "Für die Logistik",
      titleLead: "Zeiterfassung & Schichtplanung für die",
      titleHighlight: "Logistik",
      subtitle:
        "Arbeitszeiten im Lager per App erfassen, Schichten für Kommissionierung und Versand planen und Nacht- sowie Wochenendzuschläge automatisch berechnen – alles in einer App.",
      breadcrumbName: "Zeiterfassung Logistik",
      navLabel: "Zeiterfassung",
      featuresHeading: "Zeiterfassung & Planung für Lager und Transport",
      featuresIntro:
        "Von der mobilen Stempeluhr bis zur automatischen Zuschlagsberechnung – Shiftfy ist auf Schichtarbeit in der Logistik ausgelegt.",
      features: [
        {
          title: "Mobile & stationäre Zeiterfassung",
          description:
            "Lagermitarbeiter stempeln per Smartphone-App oder per QR-Code-Terminal am Wareneingang ein und aus – exakte Ist-Zeiten ohne Stechuhr-Hardware.",
        },
        {
          title: "Schichtplanung für Spitzenlast",
          description:
            "Planen Sie Früh-, Spät- und Nachtschichten für Kommissionierung, Wareneingang und Versand – und decken Sie Saison- und Peak-Zeiten flexibel ab.",
        },
        {
          title: "Zuschläge automatisch berechnen",
          description:
            "Nacht-, Sonn- und Feiertagszuschläge werden automatisch aus den Schichten ermittelt und stehen für DATEV- und Lohnexport bereit.",
        },
        {
          title: "Mehrere Standorte & Hallen",
          description:
            "Verwalten Sie mehrere Lagerstandorte, Hallen und Teams in einem System – mit Auslastungs- und Stundenberichten pro Bereich.",
        },
      ],
      benefitsHeading: "Warum Logistikbetriebe Shiftfy nutzen",
      benefits: [
        "Arbeitszeiten im Lager per App statt Stechkarte erfassen",
        "Arbeitszeitgesetz & Pausenregelungen automatisch einhalten",
        "Schichten für Wareneingang, Kommissionierung & Versand planen",
        "Nacht- und Wochenendzuschläge automatisch berechnen",
        "Kurzfristige Ausfälle schnell nachbesetzen",
        "Überstunden und Arbeitszeitkonten transparent führen",
        "DATEV- und Lohnexport mit einem Klick",
        "DSGVO-konform, Server in der EU",
      ],
      explainerHeading: "Zeiterfassung in der Logistik – digital statt Stechkarte",
      explainer: [
        {
          text: "In Lager, Versand und Spedition wechseln Schichten häufig, die Auslastung schwankt saisonal und Zuschläge für Nacht- und Wochenendarbeit müssen korrekt abgerechnet werden. Shiftfy verbindet mobile Zeiterfassung mit Schichtplanung in einem System – ohne teure Stechuhr-Hardware und ohne Excel-Listen.",
        },
        {
          lead: "Exakte Arbeitszeiten:",
          text: "Mitarbeiter erfassen ihre Zeit per App oder QR-Terminal. Pausen, Überstunden und Arbeitszeitkonten werden gesetzeskonform geführt und sind jederzeit auswertbar.",
        },
        {
          lead: "Planung für Peak-Zeiten:",
          text: "Decken Sie Spitzenlasten in Kommissionierung und Versand flexibel ab, erkennen Sie Unterbesetzungen früh und exportieren Sie alle Daten direkt nach DATEV.",
        },
      ],
      faqs: [
        {
          q: "Wie erfassen Lagermitarbeiter ihre Arbeitszeit?",
          a: "Per Smartphone-App oder über ein QR-Code-Terminal am Wareneingang. Zusätzliche Stechuhr-Hardware ist nicht nötig.",
        },
        {
          q: "Lassen sich Nacht- und Wochenendzuschläge automatisch berechnen?",
          a: "Ja. Shiftfy ermittelt Zuschläge automatisch aus den geleisteten Schichten und stellt sie für den DATEV- und Lohnexport bereit.",
        },
        {
          q: "Kann ich mehrere Lagerstandorte verwalten?",
          a: "Ja. Sie planen und werten mehrere Standorte, Hallen und Teams in einem System aus – inklusive Berichten pro Bereich.",
        },
      ],
      ctaHeading: "Zeiterfassung im Lager jetzt digitalisieren",
      relatedLabels: [
        "Zeiterfassung Software",
        "Schichtplanung Sicherheitsdienst",
        "Preise vergleichen",
      ],
    },

    schichtplanungGastronomie: {
      metaTitle:
        "Schichtplanung Gastronomie – Dienstplan für Restaurant & Hotel | Shiftfy",
      metaDescription:
        "Schichtplanung für die Gastronomie: Dienstpläne für Restaurant, Hotel & Café erstellen, Zeiterfassung per App, Trinkgeld- und Zuschlagsverwaltung, Schichttausch per Klick. 7 Tage testen, DSGVO-konform.",
      keywords: [
        "Schichtplanung Gastronomie",
        "Dienstplan Gastronomie",
        "Schichtplan Restaurant",
        "Dienstplan Restaurant",
        "Zeiterfassung Gastronomie",
        "Personalplanung Gastronomie",
        "Dienstplan Hotel",
        "Schichtplaner Gastronomie",
      ],
      segmentLabel: "Für die Gastronomie",
      titleLead: "Schichtplanung & Zeiterfassung für die",
      titleHighlight: "Gastronomie",
      subtitle:
        "Dienstpläne für Restaurant, Hotel und Café in Minuten erstellen, Arbeitszeiten per App erfassen und kurzfristige Änderungen sofort ans Team kommunizieren – ideal für schwankende Auslastung und flexible Teams.",
      breadcrumbName: "Schichtplanung Gastronomie",
      navLabel: "Schichtplanung",
      featuresHeading: "Gemacht für Restaurant, Hotel & Café",
      featuresIntro:
        "Schwankende Gästezahlen, Aushilfen und Spätschichten – Shiftfy bildet den Gastro-Alltag flexibel ab.",
      features: [
        {
          title: "Dienstplan in Minuten",
          description:
            "Erstellen Sie Service-, Küchen- und Thekenschichten per Drag-and-Drop und veröffentlichen Sie den Plan mit einem Klick an das ganze Team.",
        },
        {
          title: "Flexibel bei schwankender Auslastung",
          description:
            "Planen Sie Aushilfen, Teilzeit- und Vollzeitkräfte gemeinsam und passen Sie die Besetzung kurzfristig an das Gästeaufkommen an.",
        },
        {
          title: "Zeiterfassung & Zuschläge",
          description:
            "Arbeitszeiten werden per App erfasst, Nacht-, Sonn- und Feiertagszuschläge automatisch berechnet – die Basis für eine korrekte Lohnabrechnung.",
        },
        {
          title: "Schichttausch per Klick",
          description:
            "Mitarbeiter tauschen Schichten direkt in der App, die Leitung genehmigt mit einem Klick – ohne Anrufe und WhatsApp-Chaos.",
        },
      ],
      benefitsHeading: "Warum Gastrobetriebe Shiftfy nutzen",
      benefits: [
        "Service-, Küchen- und Thekenschichten in einem Plan",
        "Aushilfen, Teilzeit- und Vollzeitkräfte gemeinsam planen",
        "Arbeitszeitgesetz & Ruhezeiten automatisch einhalten",
        "Nacht-, Sonn- und Feiertagszuschläge automatisch berechnen",
        "Zeiterfassung per App oder QR-Code",
        "Schichttausch und Verfügbarkeiten digital",
        "Mehrere Standorte (Filialen) in einem System",
        "DSGVO-konform, Server in der EU",
      ],
      explainerHeading: "Dienstplan-Software für die Gastronomie",
      explainer: [
        {
          text: "In der Gastronomie ändern sich Besetzung und Bedarf täglich: Reservierungen, Wetter und Events lassen die Gästezahl schwanken. Eine Schichtplanung-Software wie Shiftfy ersetzt Excel und Aushänge durch einen digitalen Dienstplan, den jeder Mitarbeiter mobil sieht.",
        },
        {
          lead: "Weniger Aufwand für die Leitung:",
          text: "Verfügbarkeiten, Schichttausch und Krankmeldungen laufen digital. Die Leitung sieht sofort, wo eine Schicht unbesetzt ist, und kann reagieren – ohne Telefonkette.",
        },
        {
          lead: "Korrekte Abrechnung:",
          text: "Erfasste Ist-Zeiten und automatisch berechnete Zuschläge gehen direkt in den DATEV- und Lohnexport – das spart Zeit und vermeidet Fehler.",
        },
      ],
      faqs: [
        {
          q: "Eignet sich Shiftfy für einzelne Restaurants und für Ketten?",
          a: "Ja. Sie planen einen einzelnen Betrieb oder mehrere Filialen in einem System. Die Abrechnung erfolgt pro Nutzer und Monat.",
        },
        {
          q: "Können Mitarbeiter Schichten selbst tauschen?",
          a: "Ja. Mitarbeiter tauschen Schichten in der App, die Leitung genehmigt mit einem Klick. Verfügbarkeiten werden dabei berücksichtigt.",
        },
        {
          q: "Werden Zuschläge automatisch berechnet?",
          a: "Ja. Nacht-, Sonn- und Feiertagszuschläge werden automatisch aus den Schichten ermittelt und stehen für den Lohnexport bereit.",
        },
      ],
      ctaHeading: "Dienstplanung für Ihren Gastrobetrieb digitalisieren",
      relatedLabels: [
        "Schichtplanung Software",
        "Schichtplanung Pflege",
        "Preise vergleichen",
      ],
    },

    schichtplanungPflege: {
      metaTitle:
        "Schichtplanung Pflege – Dienstplan für Pflegedienst & Heim | Shiftfy",
      metaDescription:
        "Schichtplanung für die Pflege: Dienstpläne für Pflegedienst, Pflegeheim & ambulante Pflege erstellen, Qualifikationen berücksichtigen, Nacht- und Feiertagszuschläge automatisch berechnen, Zeiterfassung per App. 7 Tage testen, DSGVO-konform.",
      keywords: [
        "Schichtplanung Pflege",
        "Dienstplan Pflege",
        "Dienstplan Pflegedienst",
        "Schichtplan Pflegeheim",
        "Zeiterfassung Pflege",
        "Personalplanung Pflege",
        "Dienstplan ambulante Pflege",
        "Schichtplaner Pflegedienst",
      ],
      segmentLabel: "Für die Pflege",
      titleLead: "Schichtplanung & Zeiterfassung für die",
      titleHighlight: "Pflege",
      subtitle:
        "Dienstpläne für Pflegedienst, Pflegeheim und ambulante Pflege erstellen, Qualifikationen und Ruhezeiten automatisch berücksichtigen und Nacht- sowie Feiertagszuschläge korrekt abrechnen – verlässlich rund um die Uhr.",
      breadcrumbName: "Schichtplanung Pflege",
      navLabel: "Schichtplanung",
      featuresHeading: "Verlässliche Planung für die Pflege",
      featuresIntro:
        "24/7-Versorgung, Qualifikationen und Zuschläge – Shiftfy bildet die Anforderungen von Pflegeeinrichtungen ab.",
      features: [
        {
          title: "24/7-Dienstpläne mit Früh-, Spät- & Nachtdienst",
          description:
            "Planen Sie eine lückenlose Versorgung rund um die Uhr – inklusive Wochenend- und Feiertagsbesetzung per Drag-and-Drop.",
        },
        {
          title: "Qualifikationen berücksichtigen",
          description:
            "Hinterlegen Sie examinierte Fachkräfte, Pflegehilfskräfte und Zusatzqualifikationen. Shiftfy plant nur passend qualifiziertes Personal ein.",
        },
        {
          title: "Nacht- & Feiertagszuschläge automatisch",
          description:
            "Zuschläge für Nacht-, Sonn- und Feiertagsarbeit werden automatisch aus den Schichten berechnet – korrekte Basis für die Lohnabrechnung.",
        },
        {
          title: "Zeiterfassung per App",
          description:
            "Pflegekräfte erfassen ihre Arbeitszeit mobil. Ist-Zeiten, Überstunden und Arbeitszeitkonten werden gesetzeskonform geführt.",
        },
      ],
      benefitsHeading: "Warum Pflegeeinrichtungen Shiftfy nutzen",
      benefits: [
        "Lückenlose 24/7-Versorgung sicher planen",
        "Examinierte Fachkräfte und Hilfskräfte korrekt einsetzen",
        "Arbeitszeitgesetz & Ruhezeiten automatisch einhalten",
        "Nacht-, Sonn- und Feiertagszuschläge automatisch berechnen",
        "Kurzfristige Ausfälle schnell nachbesetzen",
        "Zeiterfassung, Überstunden und Arbeitszeitkonten transparent",
        "Mehrere Standorte und Wohnbereiche in einem System",
        "DSGVO-konform, Server in der EU",
      ],
      explainerHeading: "Dienstplan-Software für die Pflege",
      explainer: [
        {
          text: "Pflegeeinrichtungen müssen rund um die Uhr verlässlich besetzt sein – mit den richtigen Qualifikationen und unter Einhaltung des Arbeitszeitgesetzes. Eine Dienstplan-Software wie Shiftfy ersetzt manuelle Pläne durch eine digitale, regelbasierte Planung.",
        },
        {
          lead: "Qualifikation und Recht im Blick:",
          text: "Shiftfy berücksichtigt Qualifikationen und Ruhezeiten automatisch und warnt vor Konflikten, bevor der Plan veröffentlicht wird.",
        },
        {
          lead: "Korrekte Abrechnung:",
          text: "Erfasste Ist-Zeiten und automatisch berechnete Nacht- und Feiertagszuschläge gehen direkt in den DATEV- und Lohnexport.",
        },
      ],
      faqs: [
        {
          q: "Eignet sich Shiftfy für ambulante und stationäre Pflege?",
          a: "Ja. Shiftfy unterstützt ambulante Pflegedienste ebenso wie Pflegeheime und mehrere Wohnbereiche in einem System.",
        },
        {
          q: "Werden Qualifikationen bei der Planung berücksichtigt?",
          a: "Ja. Sie hinterlegen Qualifikationen pro Mitarbeiter; Shiftfy plant nur passend qualifiziertes Personal in die jeweilige Schicht ein.",
        },
        {
          q: "Werden Nacht- und Feiertagszuschläge automatisch berechnet?",
          a: "Ja. Zuschläge werden automatisch aus den geleisteten Schichten ermittelt und stehen für DATEV- und Lohnexport bereit.",
        },
      ],
      ctaHeading: "Dienstplanung für Ihre Pflegeeinrichtung digitalisieren",
      relatedLabels: [
        "Schichtplanung Software",
        "Schichtplanung Gastronomie",
        "Preise vergleichen",
      ],
    },
  },

  en: {
    automatischeSchichtplanung: {
      metaTitle: "Automatic Shift Scheduling with Surcharges – Software | Shiftfy",
      metaDescription:
        "Automatic shift scheduling: Shiftfy plans shifts automatically by availability, qualification and working-time law and calculates night, Sunday and holiday surcharges. Time tracking included, DATEV export, made in Germany. Try 7 days free.",
      keywords: [
        "automatic shift scheduling",
        "automated shift planning",
        "automatic rota software",
        "time tracking with shift scheduling",
        "shift scheduling with surcharges",
        "automatic night surcharge",
        "shift planning software Germany",
        "auto schedule rota",
      ],
      segmentLabel: "Automatic shift scheduling",
      titleLead: "Schedule shifts automatically –",
      titleHighlight: "with surcharges",
      subtitle:
        "Shiftfy builds rotas automatically by availability, qualification and working-time law – and calculates night, Sunday and holiday surcharges along the way. Time tracking and DATEV export included. Built and hosted in Germany.",
      breadcrumbName: "Automatic shift scheduling",
      navLabel: "Shift scheduling",
      featuresHeading: "How Shiftfy schedules automatically",
      featuresIntro:
        "From open shifts, availability and rules, a complete, compliant rota is generated in seconds.",
      features: [
        {
          title: "Auto-scheduler",
          description:
            "Define the staffing need per shift – Shiftfy assigns suitable employees automatically, fairly distributed and respecting preferred and blocked times.",
        },
        {
          title: "Working-time law applied automatically",
          description:
            "Rest periods (11-hour rule), maximum working hours and breaks are checked on every automatic plan – violations never arise.",
        },
        {
          title: "Surcharges calculated automatically",
          description:
            "Night, Sunday and holiday surcharges are derived directly from planned and worked shifts – no manual recalculation.",
        },
        {
          title: "Time tracking & DATEV export",
          description:
            "Actual times are captured in the app, reconciled with the plan and exported to DATEV including surcharges – an end-to-end chain from plan to payroll.",
        },
      ],
      benefitsHeading: "Why automatic scheduling with Shiftfy",
      benefits: [
        "Rota in seconds instead of hours – via the auto-scheduler",
        "Fair, rule-based distribution of shifts",
        "Availability, preferences and qualifications considered automatically",
        "Night, Sunday and holiday surcharges calculated automatically",
        "Working-time law & rest periods upheld without manual checks",
        "Built-in time tracking via app or QR code",
        "DATEV and payroll export in one click",
        "Made & hosted in Germany – GDPR-compliant, servers in the EU",
      ],
      explainerHeading: "What is automatic shift scheduling?",
      explainer: [
        {
          text: "Automatic shift scheduling means software builds the rota itself – instead of assembling it manually in Excel. You define the demand, and Shiftfy assigns suitable employees automatically while respecting availability, preferred shifts and legal requirements.",
        },
        {
          lead: "Designed with surcharges in mind:",
          text: "In Germany especially, night, Sunday and holiday surcharges are a key part of payroll. Shiftfy calculates them automatically from planned and worked shifts – the basis for a clean DATEV and payroll export.",
        },
        {
          lead: "Who is it for?",
          text: "Any business with shift work: security services, hospitality, care, logistics, retail and production. Every account starts with a 7-day trial, then from €2.99/user/month.",
        },
      ],
      faqs: [
        {
          q: "Does Shiftfy really schedule shifts fully automatically?",
          a: "Yes. The auto-scheduler produces a complete proposal from staffing demand, availability, qualifications and legal rules, which you can review and adjust before publishing.",
        },
        {
          q: "Are night and holiday surcharges calculated automatically?",
          a: "Yes. Night, Sunday and holiday surcharges are derived automatically from shifts and are ready for DATEV and payroll export.",
        },
        {
          q: "Does automatic planning comply with working-time law?",
          a: "Yes. Rest periods, maximum hours and breaks are checked on every automatic plan, so violations are avoided.",
        },
      ],
      ctaHeading: "Automate your scheduling – surcharges included",
      relatedLabels: [
        "Shift scheduling software",
        "Time tracking software",
        "Compare pricing",
      ],
    },

    schichtplanungSicherheitsdienst: {
      metaTitle:
        "Shift Scheduling for Security Services – Rota & Time Tracking | Shiftfy",
      metaDescription:
        "Shift scheduling for security services: build rotas for guarding & site security, check §34a qualifications, calculate night surcharges automatically, time tracking via app. Try 7 days free, GDPR-compliant.",
      keywords: [
        "shift scheduling security service",
        "rota security service",
        "security guard scheduling",
        "time tracking security service",
        "guarding rota software",
        "workforce planning security",
      ],
      segmentLabel: "For security services",
      titleLead: "Shift scheduling & time tracking for",
      titleHighlight: "security services",
      subtitle:
        "Build rotas for site security and guarding, check §34a qualifications, calculate night and holiday surcharges automatically – and capture working time via app right at the site.",
      breadcrumbName: "Security service scheduling",
      navLabel: "Shift scheduling",
      featuresHeading: "Built for the guarding & security sector",
      featuresIntro:
        "From 24/7 site coverage to surcharge calculation – Shiftfy covers the needs of security companies.",
      features: [
        {
          title: "24/7 rotas for site security",
          description:
            "Plan early, late and night shifts across multiple sites and locations – seamless round-the-clock coverage via drag-and-drop.",
        },
        {
          title: "Check §34a qualifications automatically",
          description:
            "Store the §34a competence certificate, instruction proof and certificates per employee. Shiftfy only schedules staff qualified for the site.",
        },
        {
          title: "Night, Sunday & holiday surcharges",
          description:
            "Surcharges for night, Sunday and holiday work are captured and calculated automatically – straight from worked shifts for payroll.",
        },
        {
          title: "Mobile time tracking on duty",
          description:
            "Guards clock in and out via app or QR code at the site. Actual times flow automatically into payroll – no paper, no spreadsheets.",
        },
      ],
      benefitsHeading: "Why security companies use Shiftfy",
      benefits: [
        "Manage multiple sites and clients in one rota",
        "Uphold working-time law & rest periods (11-hour rule) automatically",
        "Check qualifications & competence proofs per assignment",
        "Calculate night, Sunday and holiday surcharges automatically",
        "Fill last-minute gaps fast with the SOS function",
        "Time tracking via app or QR code at the site",
        "Seamless documentation for clients & audits",
        "GDPR-compliant, servers in the EU",
      ],
      explainerHeading: "Rota software for security services",
      explainer: [
        {
          text: "Scheduling in security is especially demanding: sites must be staffed around the clock, employees need valid qualifications such as the §34a competence certificate, and surcharges must be billed correctly. Shiftfy handles these tasks automatically – instead of error-prone Excel rotas.",
        },
        {
          lead: "Site-based deployment planning:",
          text: "Plan guards per site and client, spot double-bookings and understaffing instantly, and respond to gaps with the SOS function in minutes.",
        },
        {
          lead: "Time tracking & payroll:",
          text: "Employees capture working time via app or QR code at the site. Surcharges and actual times flow automatically into DATEV and payroll export.",
        },
      ],
      faqs: [
        {
          q: "Is Shiftfy suitable for small and large security companies?",
          a: "Yes. Shiftfy scales from a single-site guarding service to a nationwide security company. Billing is per user per month – you only pay for active employees.",
        },
        {
          q: "Are §34a proofs taken into account?",
          a: "Yes. You store qualifications such as the §34a competence certificate with expiry dates. Shiftfy warns about expiring proofs and prevents scheduling unqualified staff.",
        },
        {
          q: "Can night and holiday surcharges be calculated automatically?",
          a: "Yes. Surcharges are derived automatically from worked shifts and are ready for DATEV and payroll export.",
        },
      ],
      ctaHeading: "Digitise scheduling for your security company",
      relatedLabels: [
        "Shift scheduling software",
        "Time tracking logistics",
        "Compare pricing",
      ],
    },

    zeiterfassungLogistik: {
      metaTitle:
        "Time Tracking Logistics – Scheduling for Warehouse & Transport | Shiftfy",
      metaDescription:
        "Time tracking & shift scheduling for logistics: capture warehouse working time via app, plan shifts for picking & dispatch, calculate night and weekend surcharges automatically. Try 7 days free, GDPR-compliant.",
      keywords: [
        "time tracking logistics",
        "shift scheduling logistics",
        "warehouse time tracking",
        "logistics rota software",
        "warehouse scheduling",
        "workforce planning logistics",
      ],
      segmentLabel: "For logistics",
      titleLead: "Time tracking & shift scheduling for",
      titleHighlight: "logistics",
      subtitle:
        "Capture warehouse working time via app, plan shifts for picking and dispatch and calculate night and weekend surcharges automatically – all in one app.",
      breadcrumbName: "Time tracking logistics",
      navLabel: "Time tracking",
      featuresHeading: "Time tracking & planning for warehouse and transport",
      featuresIntro:
        "From the mobile time clock to automatic surcharge calculation – Shiftfy is built for shift work in logistics.",
      features: [
        {
          title: "Mobile & stationary time tracking",
          description:
            "Warehouse staff clock in and out via smartphone app or a QR-code terminal at goods-in – exact actual times without time-clock hardware.",
        },
        {
          title: "Scheduling for peak load",
          description:
            "Plan early, late and night shifts for picking, goods-in and dispatch – and cover seasonal and peak times flexibly.",
        },
        {
          title: "Surcharges calculated automatically",
          description:
            "Night, Sunday and holiday surcharges are derived automatically from shifts and are ready for DATEV and payroll export.",
        },
        {
          title: "Multiple sites & halls",
          description:
            "Manage multiple warehouse sites, halls and teams in one system – with utilisation and hours reports per area.",
        },
      ],
      benefitsHeading: "Why logistics operations use Shiftfy",
      benefits: [
        "Capture warehouse time via app instead of punch cards",
        "Uphold working-time law & break rules automatically",
        "Plan shifts for goods-in, picking & dispatch",
        "Calculate night and weekend surcharges automatically",
        "Fill last-minute gaps quickly",
        "Track overtime and working-time accounts transparently",
        "DATEV and payroll export in one click",
        "GDPR-compliant, servers in the EU",
      ],
      explainerHeading: "Time tracking in logistics – digital, not punch cards",
      explainer: [
        {
          text: "In warehousing, dispatch and freight, shifts change often, load fluctuates seasonally, and night and weekend surcharges must be billed correctly. Shiftfy combines mobile time tracking with shift scheduling in one system – without expensive time-clock hardware and without spreadsheets.",
        },
        {
          lead: "Exact working times:",
          text: "Employees capture their time via app or QR terminal. Breaks, overtime and working-time accounts are kept compliantly and are auditable at any time.",
        },
        {
          lead: "Planning for peaks:",
          text: "Cover peak loads in picking and dispatch flexibly, spot understaffing early, and export all data straight to DATEV.",
        },
      ],
      faqs: [
        {
          q: "How do warehouse staff capture their working time?",
          a: "Via smartphone app or a QR-code terminal at goods-in. No additional time-clock hardware is required.",
        },
        {
          q: "Can night and weekend surcharges be calculated automatically?",
          a: "Yes. Shiftfy derives surcharges automatically from worked shifts and makes them available for DATEV and payroll export.",
        },
        {
          q: "Can I manage multiple warehouse sites?",
          a: "Yes. You plan and analyse multiple sites, halls and teams in one system – including reports per area.",
        },
      ],
      ctaHeading: "Digitise warehouse time tracking now",
      relatedLabels: [
        "Time tracking software",
        "Security service scheduling",
        "Compare pricing",
      ],
    },

    schichtplanungGastronomie: {
      metaTitle:
        "Shift Scheduling Hospitality – Rota for Restaurant & Hotel | Shiftfy",
      metaDescription:
        "Shift scheduling for hospitality: build rotas for restaurant, hotel & café, time tracking via app, surcharge handling, shift swaps in one click. Try 7 days free, GDPR-compliant.",
      keywords: [
        "shift scheduling hospitality",
        "restaurant rota",
        "hotel rota software",
        "time tracking hospitality",
        "workforce planning hospitality",
        "café scheduling",
      ],
      segmentLabel: "For hospitality",
      titleLead: "Shift scheduling & time tracking for",
      titleHighlight: "hospitality",
      subtitle:
        "Build rotas for restaurant, hotel and café in minutes, capture working time via app and communicate last-minute changes to the team instantly – ideal for fluctuating demand and flexible teams.",
      breadcrumbName: "Hospitality scheduling",
      navLabel: "Shift scheduling",
      featuresHeading: "Made for restaurant, hotel & café",
      featuresIntro:
        "Fluctuating guest numbers, casual staff and late shifts – Shiftfy reflects the hospitality day flexibly.",
      features: [
        {
          title: "Rota in minutes",
          description:
            "Create service, kitchen and bar shifts via drag-and-drop and publish the plan to the whole team in one click.",
        },
        {
          title: "Flexible for fluctuating demand",
          description:
            "Plan casual, part-time and full-time staff together and adjust coverage at short notice to guest numbers.",
        },
        {
          title: "Time tracking & surcharges",
          description:
            "Working time is captured via app, night, Sunday and holiday surcharges are calculated automatically – the basis for correct payroll.",
        },
        {
          title: "Shift swaps in one click",
          description:
            "Employees swap shifts in the app, management approves in one click – without calls and WhatsApp chaos.",
        },
      ],
      benefitsHeading: "Why hospitality businesses use Shiftfy",
      benefits: [
        "Service, kitchen and bar shifts in one plan",
        "Plan casual, part-time and full-time staff together",
        "Uphold working-time law & rest periods automatically",
        "Calculate night, Sunday and holiday surcharges automatically",
        "Time tracking via app or QR code",
        "Digital shift swaps and availability",
        "Multiple locations (branches) in one system",
        "GDPR-compliant, servers in the EU",
      ],
      explainerHeading: "Rota software for hospitality",
      explainer: [
        {
          text: "In hospitality, staffing and demand change daily: reservations, weather and events make guest numbers fluctuate. Scheduling software like Shiftfy replaces Excel and notice boards with a digital rota every employee can see on mobile.",
        },
        {
          lead: "Less work for management:",
          text: "Availability, shift swaps and sick notes run digitally. Management instantly sees where a shift is unfilled and can react – without a phone chain.",
        },
        {
          lead: "Correct payroll:",
          text: "Captured actual times and automatically calculated surcharges feed straight into DATEV and payroll export – saving time and avoiding errors.",
        },
      ],
      faqs: [
        {
          q: "Is Shiftfy suitable for single restaurants and chains?",
          a: "Yes. You plan a single venue or multiple branches in one system. Billing is per user per month.",
        },
        {
          q: "Can employees swap shifts themselves?",
          a: "Yes. Employees swap shifts in the app and management approves in one click; availability is taken into account.",
        },
        {
          q: "Are surcharges calculated automatically?",
          a: "Yes. Night, Sunday and holiday surcharges are derived automatically from shifts and are ready for payroll export.",
        },
      ],
      ctaHeading: "Digitise scheduling for your hospitality business",
      relatedLabels: [
        "Shift scheduling software",
        "Care scheduling",
        "Compare pricing",
      ],
    },

    schichtplanungPflege: {
      metaTitle: "Shift Scheduling Care – Rota for Care Service & Home | Shiftfy",
      metaDescription:
        "Shift scheduling for care: build rotas for care services, care homes & home care, respect qualifications, calculate night and holiday surcharges automatically, time tracking via app. Try 7 days free, GDPR-compliant.",
      keywords: [
        "shift scheduling care",
        "care service rota",
        "care home rota",
        "time tracking care",
        "workforce planning care",
        "home care scheduling",
      ],
      segmentLabel: "For care",
      titleLead: "Shift scheduling & time tracking for",
      titleHighlight: "care",
      subtitle:
        "Build rotas for care services, care homes and home care, respect qualifications and rest periods automatically and bill night and holiday surcharges correctly – reliably around the clock.",
      breadcrumbName: "Care scheduling",
      navLabel: "Shift scheduling",
      featuresHeading: "Reliable planning for care",
      featuresIntro:
        "24/7 coverage, qualifications and surcharges – Shiftfy reflects the needs of care providers.",
      features: [
        {
          title: "24/7 rotas with early, late & night duty",
          description:
            "Plan seamless round-the-clock care – including weekend and holiday coverage via drag-and-drop.",
        },
        {
          title: "Respect qualifications",
          description:
            "Store registered nurses, care assistants and extra qualifications. Shiftfy only schedules suitably qualified staff.",
        },
        {
          title: "Night & holiday surcharges automatically",
          description:
            "Surcharges for night, Sunday and holiday work are calculated automatically from shifts – a correct basis for payroll.",
        },
        {
          title: "Time tracking via app",
          description:
            "Care staff capture working time on mobile. Actual times, overtime and working-time accounts are kept compliantly.",
        },
      ],
      benefitsHeading: "Why care providers use Shiftfy",
      benefits: [
        "Plan seamless 24/7 coverage reliably",
        "Deploy registered and assistant staff correctly",
        "Uphold working-time law & rest periods automatically",
        "Calculate night, Sunday and holiday surcharges automatically",
        "Fill last-minute gaps quickly",
        "Transparent time tracking, overtime and working-time accounts",
        "Multiple sites and living areas in one system",
        "GDPR-compliant, servers in the EU",
      ],
      explainerHeading: "Rota software for care",
      explainer: [
        {
          text: "Care facilities must be reliably staffed around the clock – with the right qualifications and in compliance with working-time law. Rota software like Shiftfy replaces manual plans with digital, rule-based scheduling.",
        },
        {
          lead: "Qualification and law in view:",
          text: "Shiftfy considers qualifications and rest periods automatically and warns about conflicts before the plan is published.",
        },
        {
          lead: "Correct payroll:",
          text: "Captured actual times and automatically calculated night and holiday surcharges feed straight into DATEV and payroll export.",
        },
      ],
      faqs: [
        {
          q: "Is Shiftfy suitable for home care and residential care?",
          a: "Yes. Shiftfy supports home care services as well as care homes and multiple living areas in one system.",
        },
        {
          q: "Are qualifications considered during planning?",
          a: "Yes. You store qualifications per employee; Shiftfy only schedules suitably qualified staff into each shift.",
        },
        {
          q: "Are night and holiday surcharges calculated automatically?",
          a: "Yes. Surcharges are derived automatically from worked shifts and are ready for DATEV and payroll export.",
        },
      ],
      ctaHeading: "Digitise scheduling for your care facility",
      relatedLabels: [
        "Shift scheduling software",
        "Hospitality scheduling",
        "Compare pricing",
      ],
    },
  },
};

for (const locale of ["de", "en"]) {
  const path = join(process.cwd(), "messages", `${locale}.json`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  json.seoCommon = seoCommon[locale];
  json.seo = seo[locale];
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`Updated ${locale}.json: seoCommon + seo (${Object.keys(seo[locale]).length} pages)`);
}
