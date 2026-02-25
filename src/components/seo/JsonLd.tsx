/**
 * JSON-LD Structured Data for SEO
 * Generates schema.org markup for Google rich snippets.
 *
 * Uses a single @graph to avoid duplicate/unnamed items in Google Search Console.
 */

const SITE_URL = process.env.SITE_URL || "https://www.shiftfy.de";

/**
 * Combined JSON-LD for global structured data injected in the root layout `<head>`.
 * Uses a single `@graph` array so Google sees one cohesive entity, not separate items.
 */
export function CombinedJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      // ── Organization ──
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Shiftfy",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512x512.png`,
        },
        description:
          "Shiftfy ist die intelligente Schichtplanungs- und Zeiterfassungssoftware für Sicherheitsdienste, Gastronomie, Einzelhandel und Dienstleister in Deutschland.",
        foundingDate: "2024",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          availableLanguage: ["German", "English"],
        },
        address: {
          "@type": "PostalAddress",
          addressCountry: "DE",
        },
      },
      // ── WebSite ──
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Shiftfy",
        url: SITE_URL,
        description:
          "Intelligente Schichtplanung und Zeiterfassung für Deutschland",
        inLanguage: "de-DE",
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      // ── SoftwareApplication ──
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: "Shiftfy",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description:
          "Digitale Schichtplanung, Zeiterfassung und Personalmanagement – alles in einer App. DSGVO-konform, made in Germany.",
        offers: [
          {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            name: "Starter",
            description: "Kostenlos für bis zu 5 Mitarbeiter und 1 Standort",
          },
          {
            "@type": "Offer",
            price: "29",
            priceCurrency: "EUR",
            name: "Team",
            description:
              "Pauschal pro Workspace/Monat — unbegrenzte Mitarbeiter",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "29",
              priceCurrency: "EUR",
              unitText: "Workspace/Monat",
              billingDuration: "P1M",
            },
          },
          {
            "@type": "Offer",
            price: "59",
            priceCurrency: "EUR",
            name: "Business",
            description:
              "Pauschal pro Workspace/Monat — DATEV, API, Analysen, Priority-Support",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "59",
              priceCurrency: "EUR",
              unitText: "Workspace/Monat",
              billingDuration: "P1M",
            },
          },
        ],
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          ratingCount: "120",
          bestRating: "5",
        },
        featureList: [
          "Schichtplanung",
          "Zeiterfassung",
          "Abwesenheitsverwaltung",
          "Urlaubskonto",
          "Lohnexport",
          "Stempeluhr",
          "Mitarbeiterverwaltung",
          "Standortverwaltung",
          "Schichttausch",
          "Automatische Schichtplanung",
          "DSGVO-konform",
        ],
      },
      // ── FAQPage (merged into @graph to avoid duplicate FAQPage items) ──
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Was kostet Shiftfy?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Shiftfy bietet einen kostenlosen Starter-Plan für bis zu 5 Mitarbeiter. Der Team-Plan kostet pauschal 29 € pro Workspace/Monat (24 € bei jährlicher Zahlung) und der Business-Plan 59 € pro Workspace/Monat (49 € jährlich) — jeweils mit unbegrenzter Mitarbeiterzahl.",
            },
          },
          {
            "@type": "Question",
            name: "Ist Shiftfy DSGVO-konform?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Ja, Shiftfy ist vollständig DSGVO-konform. Alle Daten werden auf deutschen/europäischen Servern gespeichert und nach den strengsten Datenschutzrichtlinien verarbeitet.",
            },
          },
          {
            "@type": "Question",
            name: "Für welche Branchen eignet sich Shiftfy?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Shiftfy eignet sich für alle Branchen mit Schichtarbeit: Sicherheitsdienste, Gastronomie, Einzelhandel, Produktion, Gesundheitswesen, Logistik und weitere Dienstleistungsbranchen.",
            },
          },
          {
            "@type": "Question",
            name: "Wie funktioniert die digitale Zeiterfassung?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Mitarbeiter können ihre Arbeitszeiten über die integrierte Stempeluhr, manuell oder per Schichtplan erfassen. Alle Zeiten werden automatisch in Stunden- und Urlaubskonten übernommen.",
            },
          },
          {
            "@type": "Question",
            name: "Kann ich Shiftfy kostenlos testen?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Ja, der Starter-Plan ist dauerhaft kostenlos und enthält Schichtplanung, Zeiterfassung und bis zu 5 Mitarbeiter. Kein Vertrag, keine Kreditkarte nötig.",
            },
          },
          {
            "@type": "Question",
            name: "Unterstützt Shiftfy automatische Schichtplanung?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Ja, mit dem Business-Plan können Schichten automatisch anhand von Verfügbarkeiten, Qualifikationen und Arbeitszeitregeln erstellt werden.",
            },
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
