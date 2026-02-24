/**
 * JSON-LD Structured Data for SEO
 * Generates schema.org markup for Google rich snippets
 */

const SITE_URL = process.env.SITE_URL || "https://www.shiftfy.de";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Shiftfy",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512x512.png`,
    description:
      "Shiftfy ist die intelligente Schichtplanungs- und Zeiterfassungssoftware für Sicherheitsdienste, Gastronomie, Einzelhandel und Dienstleister in Deutschland.",
    foundingDate: "2024",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["German", "English"],
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "DE",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
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
        description: "Kostenlos für bis zu 5 Mitarbeiter",
      },
      {
        "@type": "Offer",
        price: "2.99",
        priceCurrency: "EUR",
        name: "Team",
        description: "Pro Mitarbeiter/Monat",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "2.99",
          priceCurrency: "EUR",
          unitText: "Mitarbeiter/Monat",
          billingDuration: "P1M",
        },
      },
      {
        "@type": "Offer",
        price: "4.99",
        priceCurrency: "EUR",
        name: "Business",
        description: "Pro Mitarbeiter/Monat",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "4.99",
          priceCurrency: "EUR",
          unitText: "Mitarbeiter/Monat",
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd() {
  const faqs = [
    {
      question: "Was kostet Shiftfy?",
      answer:
        "Shiftfy bietet einen kostenlosen Starter-Plan für bis zu 5 Mitarbeiter. Der Team-Plan kostet 2,99€ pro Mitarbeiter/Monat und der Business-Plan 4,99€ pro Mitarbeiter/Monat.",
    },
    {
      question: "Ist Shiftfy DSGVO-konform?",
      answer:
        "Ja, Shiftfy ist vollständig DSGVO-konform. Alle Daten werden auf deutschen/europäischen Servern gespeichert und nach den strengsten Datenschutzrichtlinien verarbeitet.",
    },
    {
      question: "Für welche Branchen eignet sich Shiftfy?",
      answer:
        "Shiftfy eignet sich für alle Branchen mit Schichtarbeit: Sicherheitsdienste, Gastronomie, Einzelhandel, Produktion, Gesundheitswesen, Logistik und weitere Dienstleistungsbranchen.",
    },
    {
      question: "Wie funktioniert die digitale Zeiterfassung?",
      answer:
        "Mitarbeiter können ihre Arbeitszeiten über die integrierte Stempeluhr, manuell oder per Schichtplan erfassen. Alle Zeiten werden automatisch in Stunden- und Urlaubskonten übernommen.",
    },
    {
      question: "Kann ich Shiftfy kostenlos testen?",
      answer:
        "Ja, der Starter-Plan ist dauerhaft kostenlos und enthält Schichtplanung, Zeiterfassung und bis zu 5 Mitarbeiter. Kein Vertrag, keine Kreditkarte nötig.",
    },
    {
      question: "Unterstützt Shiftfy automatische Schichtplanung?",
      answer:
        "Ja, mit dem Business-Plan können Schichten automatisch anhand von Verfügbarkeiten, Qualifikationen und Arbeitszeitregeln erstellt werden.",
    },
  ];

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Shiftfy",
    url: SITE_URL,
    description:
      "Intelligente Schichtplanung und Zeiterfassung für Deutschland",
    inLanguage: "de-DE",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
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
