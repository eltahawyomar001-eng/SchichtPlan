/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || "https://schichtplan-wine.vercel.app",
  generateRobotsTxt: true,
  exclude: [
    "/dashboard*",
    "/mitarbeiter*",
    "/schichtplan*",
    "/einstellungen*",
    "/standorte*",
    "/abteilungen*",
    "/qualifikationen*",
    "/zeiterfassung*",
    "/abwesenheiten*",
    "/verfuegbarkeiten*",
    "/schichttausch*",
    "/schichtvorlagen*",
    "/urlaubskonto*",
    "/zeitkonten*",
    "/berichte*",
    "/lohnexport*",
    "/feiertage*",
    "/projekte*",
    "/kunden*",
    "/stempeluhr*",
    "/monatsabschluss*",
    "/automatisierung*",
    "/api/*",
  ],
  robotsTxtOptions: {
    additionalSitemaps: [],
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/", "/einstellungen"],
      },
    ],
  },
};

module.exports = config;
