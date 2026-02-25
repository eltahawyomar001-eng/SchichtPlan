/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || "https://www.shiftfy.de",
  generateRobotsTxt: false, // We use src/app/robots.ts instead
  changefreq: "weekly",
  priority: 0.7,
  exclude: [
    "/dashboard*",
    "/mitarbeiter*",
    "/schichtplan",
    "/schichtplan/**",
    "/einstellungen*",
    "/standorte*",
    "/abteilungen*",
    "/qualifikationen*",
    "/zeiterfassung",
    "/zeiterfassung/**",
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
    "/daten*",
    "/teamkalender*",
    "/webhooks*",
    "/api/*",
    "/einladung*",
    "/passwort-vergessen*",
    "/passwort-zuruecksetzen*",
    "/verifizierung*",
  ],
  transform: async (config, path) => {
    // Assign higher priority to key SEO pages
    const highPriority = [
      "/",
      "/pricing",
      "/blog",
      "/zeiterfassung-software",
      "/schichtplanung-software",
    ];
    const medPriority = ["/login", "/register"];

    let priority = config.priority;
    let changefreq = config.changefreq;

    if (highPriority.includes(path)) {
      priority = 1.0;
      changefreq = "daily";
    } else if (medPriority.includes(path)) {
      priority = 0.8;
      changefreq = "monthly";
    } else if (path.startsWith("/blog/")) {
      priority = 0.9;
      changefreq = "weekly";
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    };
  },
};

module.exports = config;
