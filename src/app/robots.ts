import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.SITE_URL || "https://www.shiftfy.de";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/mitarbeiter/",
          "/schichtplan/",
          "/einstellungen/",
          "/standorte/",
          "/abteilungen/",
          "/qualifikationen/",
          "/zeiterfassung/",
          "/abwesenheiten/",
          "/verfuegbarkeiten/",
          "/schichttausch/",
          "/schichtvorlagen/",
          "/urlaubskonto/",
          "/zeitkonten/",
          "/berichte/",
          "/lohnexport/",
          "/feiertage/",
          "/projekte/",
          "/stempeluhr/",
          "/monatsabschluss/",
          "/automatisierung/",
          "/daten/",
          "/teamkalender/",
          "/webhooks/",
          "/api/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
