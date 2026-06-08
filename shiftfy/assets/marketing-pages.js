/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Marketing landing (content mirrors the real app)
   Source: messages/{de,en}.json "landing" namespace
   ═══════════════════════════════════════════════════════════════ */
const MK_PAGES = {};
const MK_PAGE_INIT = {};

MK_PAGES.landing = function () {
  return `
  ${mkHero()}
  ${mkFeatureTabs()}
  ${mkSosSection()}
  ${mkComplianceSection()}
  ${mkBenefits()}
  ${mkAppShowcase()}
  ${mkTrust()}
  ${mkIntegrations()}
  ${mkSocialProof()}
  ${mkRoiSection()}
  ${MK_PAGES.__pricingInner()}
  ${mkLandingFaq()}
  ${mkCtaFooter()}`;
};
MK_PAGE_INIT.landing = function () {
  mkFeatureTabsInit();
  mkFaqInit("#land-faq");
  mkBillingInit();
};

/* ── HERO ── */
function mkHero() {
  const proofs = [L("DSGVO-konform", "GDPR compliant"), L("100 % Made in Germany", "100% Made in Germany"), L("7 Tage testen", "7-day trial")];
  const highlights = [
    { ic: "rocket", t: L("Sofort einsatzbereit", "Ready in minutes"), d: L("In unter 5 Minuten eingerichtet", "Set up in under 5 minutes") },
    { ic: "zap", t: L("Automatisiert", "Automated"), d: L("Pausen, Zuschläge & Exporte", "Breaks, surcharges & exports") },
    { ic: "globe", t: L("Alle Geräte", "All devices"), d: L("Desktop, Tablet & Smartphone", "Desktop, tablet & smartphone") },
    { ic: "download", t: L("DATEV-Export", "DATEV export"), d: L("Ein Klick zum Lohnbüro", "One click to payroll") },
  ];
  return `
  <section class="hero mk-section">
    <div class="hero-bg"></div>
    <div class="mk-wrap">
      <div class="hero-split">
        <div class="hero-left">
          <div class="eyebrow"><span class="flex items-center gap-2">${mic("shield")}</span> ${L("DSGVO-konform · Made in Germany", "GDPR compliant · Made in Germany")}</div>
          <h1 style="text-align:left">${L("Zeiterfassung", "Time tracking")} <span class="grad">${L("einfach per App", "made simple")}</span></h1>
          <p class="hero-sub" style="margin-left:0;text-align:left">${L("Arbeitszeiten erfassen, Pausen automatisch berechnen, Schichten planen — und per Klick zur Lohnabrechnung. DSGVO-konform und rechtssicher.", "Track working hours, auto-calculate breaks, plan shifts — and export to payroll in one click. GDPR-compliant and legally secure.")}</p>
          <div class="hero-proofs">
            ${proofs.map((p) => `<span class="hero-proof">${mic("checkCircle")}${p}</span>`).join("")}
          </div>
          <div class="hero-cta" style="justify-content:flex-start">
            <button class="btn btn-primary btn-lg" data-go="signup">${L("7 Tage testen", "Start 7-day trial")}${mic("arrowRight")}</button>
            <button class="btn btn-ghost btn-lg" data-go="pricing">${L("Preise ansehen", "See pricing")}${mic("chevR")}</button>
          </div>
          <p style="font-size:var(--t-sm);color:var(--text-3);margin:14px 0 0">${L("Ab 2,99 € pro Nutzer · jederzeit kündbar", "From €2.99 per user · cancel anytime")}</p>
          <button class="roi-link" data-go="roi">${L("Ersparnisse berechnen", "Calculate your savings")} →</button>
        </div>
        <div class="hero-right">${mkHeroMock()}</div>
      </div>

      <div class="hero-highlights">
        ${highlights.map((h) => `<div class="hl"><div class="hl-ic">${mic(h.ic)}</div><div class="hl-t">${h.t}</div><div class="hl-d">${h.d}</div></div>`).join("")}
      </div>
    </div>
  </section>`;
}
function mkHeroMock() {
  const rows = [
    { n: "Anna M.", time: "08:00 – 16:30", net: "7h 45m", st: "done" },
    { n: "Lukas B.", time: L("09:15 – läuft", "09:15 – running"), net: "4h 12m", st: "live" },
    { n: "Sara K.", time: "06:00 – 14:00", net: "7h 30m", st: "done" },
    { n: "Tom W.", time: "—", net: "—", st: "off" },
  ];
  return `<div class="hero-shot">
    <div class="hero-shot-bar"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i><span style="margin-left:6px;font-size:12px;color:var(--text-3);font-weight:600">${L("Shiftfy · Zeiterfassung Heute", "Shiftfy · Time Tracking Today")}</span></div>
    <div style="padding:18px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        ${[["16", L("Einträge", "Entries"), "var(--brand-600)"], ["12", L("Mitarbeiter", "Employees"), "var(--brand-600)"], ["98%", L("Erfasst", "Tracked"), "var(--warning)"]].map(([v, l, c]) => `<div style="border-radius:12px;background:${c === "var(--warning)" ? "var(--warning-soft)" : "var(--success-soft)"};padding:14px;text-align:center"><div class="num" style="font-size:24px;font-weight:800;color:${c}">${v}</div><div style="font-size:11px;font-weight:600;color:${c};opacity:.8;margin-top:2px">${l}</div></div>`).join("")}
      </div>
      <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr auto auto 32px;background:var(--surface-2);font-size:11px;font-weight:700;color:var(--text-3)"><div style="padding:9px 12px">${L("Team", "Team")}</div><div style="padding:9px 10px;text-align:center">${L("Zeit", "Time")}</div><div style="padding:9px 10px;text-align:center">${L("Netto", "Net")}</div><div></div></div>
        ${rows.map((r) => `<div style="display:grid;grid-template-columns:1fr auto auto 32px;border-top:1px solid var(--border);align-items:center;font-size:12px">
          <div style="padding:11px 12px;font-weight:600">${r.n}</div>
          <div style="padding:11px 10px;color:var(--text-2);white-space:nowrap">${r.time}</div>
          <div class="num" style="padding:11px 10px;font-weight:700;text-align:center;white-space:nowrap;${r.st === "live" ? "color:var(--brand-600)" : ""}">${r.st === "live" ? `<span class="live-dot" style="display:inline-block;vertical-align:middle;margin-right:4px"></span>` : ""}${r.net}</div>
          <div style="padding:11px 0;text-align:center;color:${r.st === "off" ? "var(--text-3)" : "var(--brand-500)"}">${r.st === "done" ? "✓" : r.st === "live" ? "●" : "○"}</div>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
}

/* ── FEATURE TABS ── */
const FEATURE_TABS = () => [
  { ic: "stopwatch", label: L("Zeiterfassung", "Time Tracking"),
    title: L("Arbeitszeiten digital erfassen", "Track working hours digitally"),
    desc: L("Mitarbeiter stempeln per App ein und aus — mit automatischer Pausenberechnung nach ArbZG. Einzigartig: Jede Arbeitszeit ist prüfungssicher — auf Knopfdruck erstellen Sie ein revisionssicheres Zoll/FKS-Dossier.", "Employees clock in and out via the app — with automatic break calculation per German labor law. Uniquely: every hour is audit-proof — generate a tamper-evident Zoll/FKS dossier in one click."),
    bullets: [L("Ein-/Ausstempeln per Knopfdruck", "Clock in and out with one tap"), L("Automatische Pausenberechnung (ArbZG)", "Automatic break calculation (ArbZG)"), L("Mehrstufiger Freigabe-Workflow", "Multi-step approval workflow"), L("Projektbezogene Zeiterfassung", "Project-based time tracking")] },
  { ic: "calendar", label: L("Schichtplanung", "Shift Planning"),
    title: L("Schichten visuell planen", "Plan shifts visually"),
    desc: L("Erstelle Schichtpläne per Drag & Drop, nutze Vorlagen und verteile Pläne an dein Team. Konflikte werden automatisch erkannt.", "Create shift schedules with drag & drop, use templates, and distribute plans to your team. Conflicts are detected automatically."),
    bullets: [L("Drag-and-Drop-Schichtplanung", "Drag-and-drop shift planning"), L("Schichtvorlagen & Wochenplanung", "Shift templates & weekly planning"), L("Automatische Konflikterkennung", "Automatic conflict detection"), L("Schichttausch mit Freigabe", "Shift swaps with approval")] },
  { ic: "palm", label: L("Abwesenheiten", "Absences"),
    title: L("Urlaub & Abwesenheiten verwalten", "Manage vacation & absences"),
    desc: L("Urlaubsanträge, Krankmeldungen und Feiertage in einem System. Mit Urlaubskonto, Restanspruch und Genehmigungsworkflow.", "Vacation requests, sick notes, and holidays in one system. With leave account, remaining entitlement, and approval workflow."),
    bullets: [L("Urlaubsanträge mit Genehmigung", "Vacation requests with approval"), L("Urlaubskonto & Restanspruch", "Leave account & remaining balance"), L("Feiertage je Bundesland", "Public holidays per state"), L("Abwesenheitsübersicht im Kalender", "Absence overview in calendar")] },
  { ic: "chart", label: L("Berichte", "Reports"),
    title: L("Auswertungen und Lohnexport", "Analytics and payroll export"),
    desc: L("Geprüfte Stunden exportieren, Überstunden erkennen und Lohndaten für den Steuerberater aufbereiten — CSV oder DATEV.", "Export approved hours, detect overtime, and prepare payroll data for your accountant — CSV or DATEV."),
    bullets: [L("CSV- und DATEV-Lohnexport", "CSV and DATEV payroll export"), L("Industrieminuten-Umwandlung", "Industrial minutes conversion"), L("Monatsabschluss-Workflow", "Month-close workflow"), L("Zeitkonto pro Mitarbeiter", "Time account per employee")] },
];
function mkFeatureTabs() {
  const tabs = FEATURE_TABS();
  return `
  <section id="features" class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <h2>${L("Alles, was dein Team braucht", "Everything your team needs")}</h2>
        <p>${L("Eine Plattform für Zeiterfassung, Schichtplanung, Abwesenheiten und Berichte — klar und intuitiv.", "One platform for time tracking, shift planning, absences, and reports — clear and intuitive.")}</p>
      </div>
      <div class="ft-bar" id="ft-bar">
        ${tabs.map((tb, i) => `<button class="ft-tab ${i === 0 ? "active" : ""}" data-ft="${i}">${mic(tb.ic)}<span>${tb.label}</span></button>`).join("")}
      </div>
      <div class="split" id="ft-content">${mkFeatureTabBody(tabs[0], 0)}</div>
    </div>
  </section>`;
}
function mkFeatureTabBody(tb, i) {
  return `
    <div class="split-text">
      <div class="ft-chip">${mic(tb.ic)}${tb.label}</div>
      <h3>${tb.title}</h3>
      <p>${tb.desc}</p>
      <ul class="split-list">${tb.bullets.map((b) => `<li><span class="ck">${mic("check")}</span><span>${b}</span></li>`).join("")}</ul>
      <button class="btn btn-primary mt-6" data-go="signup">${L("7 Tage testen", "Start 7-day trial")}${mic("arrowRight")}</button>
    </div>
    <div class="split-media"><div class="split-media-bar"><i></i><i></i><i></i><span style="margin-left:6px;font-size:11px;color:var(--text-3)">app.shiftfy.de</span></div>${mkFtMock(i)}</div>`;
}
function mkFtMock(i) {
  if (i === 0) return mkLiveMock();
  if (i === 1) return mkScheduleMock();
  if (i === 2) return mkAbsenceMock();
  return mkReportsMock();
}
function mkFeatureTabsInit() {
  const bar = document.querySelector("#ft-bar"); if (!bar) return;
  const tabs = FEATURE_TABS();
  bar.querySelectorAll("[data-ft]").forEach((b) => (b.onclick = () => {
    bar.querySelectorAll("[data-ft]").forEach((x) => x.classList.toggle("active", x === b));
    const i = +b.dataset.ft;
    document.querySelector("#ft-content").innerHTML = mkFeatureTabBody(tabs[i], i);
    document.querySelectorAll("#ft-content [data-go]").forEach((el) => (el.onclick = () => mkGo(el.dataset.go)));
  }));
}

/* ── SOS ── */
function mkSosSection() {
  const bullets = [
    L("Gestaffelte Push-Benachrichtigungen: Erst die Top 5, dann erweitern bei Bedarf", "Tiered push notifications: Top 5 first, then expand if needed"),
    L("Optionaler Notfall-Bonus — 5 €, 10 € oder freier Betrag pro Schicht", "Optional emergency bonus — €5, €10, or custom amount per shift"),
    L("Vollständig automatisch: Erster Annahmebestätiger bekommt die Schicht", "Fully automatic: First acceptance wins the shift"),
    L("Zuverlässigkeits-Score pro Mitarbeiter im Profil", "Reliability score per employee on their profile"),
  ];
  return `
  <section class="mk-section tight">
    <div class="mk-wrap">
      <div class="split reveal">
        <div class="split-text">
          <div class="ft-chip" style="background:var(--danger-soft);color:var(--danger)">${mic("alert")}${L("Neu · Notfall-Besetzung", "New · Emergency Fill")}</div>
          <h3>${L("Schicht kurzfristig unbesetzt? Ein Klick genügt.", "Shift uncovered last minute? One click solves it.")}</h3>
          <p>${L("Mitarbeiter krank gemeldet, ein No-Show oder eine offene Schicht — Shiftfy benachrichtigt automatisch alle qualifizierten Mitarbeiter und besetzt die Schicht in Minuten statt Stunden.", "Employee called in sick, a no-show, or an open shift — Shiftfy automatically notifies all qualified employees and fills the shift in minutes instead of hours.")}</p>
          <ul class="split-list">${bullets.map((b) => `<li><span class="ck">${mic("check")}</span><span>${b}</span></li>`).join("")}</ul>
        </div>
        <div class="split-media"><div class="split-media-bar"><i></i><i></i><i></i></div>${mkSosMock()}</div>
      </div>
    </div>
  </section>`;
}
function mkSosMock() {
  return `<div class="mock">
    <div class="flex between items-center" style="margin-bottom:4px"><div><div class="r-title" style="font-size:13px">${L("SOS · Mo 14:00–22:00", "SOS · Mon 2pm–10pm")}</div><div class="r-sub" style="font-size:12px">${L("Hauptstandort", "Main location")}</div></div><span class="badge red" style="height:22px"><span class="pip"></span>${L("Läuft", "Live")}</span></div>
    ${[["Lukas R.", L("Angenommen", "Accepted"), "emerald"], ["Sara K.", L("Benachrichtigt", "Notified"), "blue"], ["Tom W.", L("Ausstehend", "Pending"), "amber"]].map(([n, s, c]) => `<div class="mock-row"><div class="avatar sm" style="background:var(--brand-600)">${n[0]}</div><div style="flex:1"><div style="font-weight:650;font-size:13px">${n}</div></div><span class="badge ${c}" style="height:22px">${c === "emerald" ? '<span class="pip"></span>' : ""}${s}</span></div>`).join("")}
    <div style="margin-top:4px;padding:12px;border-radius:12px;background:var(--success-soft);display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:50%;background:var(--brand-600);color:#fff;display:grid;place-items:center">${mic("check")}</div><div><div style="font-weight:700;font-size:13px;color:var(--brand-700)">${L("Schicht besetzt! Lukas R. übernimmt", "Shift filled! Lukas R. takes over")}</div><div style="font-size:12px;color:var(--brand-600)">${L("Besetzt in 4 Minuten", "Filled in 4 minutes")}</div></div></div>
  </div>`;
}

/* ── COMPLIANCE ── */
function mkComplianceSection() {
  const items = [
    { ic: "shield", t: L("§34a Sachkunde-Nachweis", "§34a proof of competence"), d: L("Hinterlegen Sie echte Zertifikate mit Nummer, Aussteller, Gültigkeit und Scan. Mitarbeiter ohne gültigen Nachweis werden automatisch von bewachungspflichtigen Standorten ausgeschlossen — inkl. Compliance-Bericht auf Knopfdruck.", "Store real certificates with number, authority, validity and scan. Staff without a valid proof are automatically blocked from security-regulated sites — including a one-click compliance report.") },
    { ic: "coffee", t: L("ArbZG §4 Pausen-Pflicht", "ArbZG §4 mandatory breaks"), d: L("Schichten über 6 bzw. 9 Stunden ohne gesetzliche Pause lassen sich gar nicht erst speichern. Die vorgeschriebene Pause wird automatisch eingeplant — Bußgelder bis 15.000 € werden vermieden.", "Shifts over 6 or 9 hours without the statutory break simply can't be saved. The required break is scheduled automatically — avoiding fines of up to €15,000.") },
    { ic: "users", t: L("Betriebsrat-Mitbestimmung", "Works-council co-determination"), d: L("Legen Sie Dienstpläne dem Betriebsrat nach BetrVG §87 zur Zustimmung vor — mit 3-Tage-Frist, Prüfansicht und revisionssicherer Zustimmung oder begründeter Ablehnung.", "Submit schedules to the works council for approval under BetrVG §87 — with a 3-day deadline, a review view and an audit-proof approval or reasoned refusal.") },
    { ic: "card", t: L("eAU direkt via DATEV hr:eau", "eAU directly via DATEV hr:eau"), d: L("Verbinden Sie Shiftfy einmalig mit DATEV (OAuth). Bei jeder Krankmeldung ruft Shiftfy die eAU automatisch über die offizielle DATEV hr:eau API ab — kein manuelles Eintippen, keine Drittanbieter, DSGVO-konform. Seit 2023 gesetzliche Pflicht für alle Arbeitgeber.", "Connect Shiftfy to DATEV once via OAuth. For every sick leave, Shiftfy automatically retrieves the eAU through the official DATEV hr:eau API — no manual entry, no third parties, GDPR-compliant. Mandatory for all German employers since 2023.") },
  ];
  return `
  <section class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <div class="sec-kicker">${L("Deutsches Arbeitsrecht — eingebaut", "German labor law — built in")}</div>
        <h2>${L("Rechtssicher, ohne Mehraufwand", "Legally compliant, with zero extra effort")}</h2>
        <p>${L("Shiftfy setzt die wichtigsten deutschen Vorschriften direkt in der Planung durch — nicht als Checkliste, sondern als harte Regel im System. Kein anderes Tool kombiniert all das ab Werk.", "Shiftfy enforces Germany's key regulations right inside scheduling — not as a checklist, but as a hard rule in the system. No other tool ships all of this out of the box.")}</p>
      </div>
      <div class="feat-grid" style="grid-template-columns:1fr">
        ${items.map((it) => `<div class="feat-card reveal" style="cursor:default;display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap"><div class="feat-ic" style="margin:0;flex-shrink:0">${mic(it.ic)}</div><div style="flex:1;min-width:220px"><h3>${it.t}</h3><p>${it.d}</p></div></div>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ── BENEFITS (16) ── */
function mkBenefits() {
  const b = [
    ["stopwatch", L("Stunden sofort erfasst", "Hours tracked instantly"), L("Ein-/Ausstempeln per App — Pausen und Überstunden werden automatisch berechnet.", "Clock in and out via app — breaks and overtime are calculated automatically.")],
    ["checkCircle", L("Mehrstufige Freigabe", "Multi-step approval"), L("Manager prüfen und genehmigen Zeiteinträge — mit vollständigem Audit-Trail.", "Managers review and approve time entries — with full audit trail.")],
    ["shield", L("Rechtssicher arbeiten", "Stay legally compliant"), L("Automatische Prüfung von Ruhezeiten und Aufzeichnungspflichten nach ArbZG.", "Automatic checks for rest periods and record-keeping per German labor law.")],
    ["card", L("Lohnabrechnung in Minuten", "Payroll in minutes"), L("Geprüfte Stunden als CSV oder DATEV exportieren — fertig für den Steuerberater.", "Export approved hours as CSV or DATEV — ready for your accountant.")],
    ["palm", L("Abwesenheiten im Griff", "Absences under control"), L("Urlaub, Krankheit und Feiertage in einem System verwalten.", "Vacation, sick leave, and holidays managed in one system.")],
    ["zap", L("Einfach und intuitiv", "Simple and intuitive"), L("Mitarbeiter stempeln sofort — keine Schulung nötig.", "Employees start tracking right away — no training needed.")],
    ["clock", L("Industrieminuten", "Industrial minutes"), L("Automatische Umwandlung in Industriezeit (z. B. 7:45 h → 7,75 h).", "Automatic conversion to decimal time (e.g. 7:45 h → 7.75 h).")],
    ["list", L("Schichtvorlagen", "Shift templates"), L("Wiederkehrende Schichten als Vorlage speichern und mit einem Klick anwenden.", "Save recurring shifts as templates and apply them with one click.")],
    ["swap", L("Schichttausch", "Shift swaps"), L("Mitarbeiter tauschen Schichten selbstständig — mit optionaler Freigabe.", "Employees swap shifts on their own — with optional manager approval.")],
    ["star", L("Qualifikationen", "Qualifications"), L("Skills und Zertifikate zuweisen — nur qualifiziertes Personal wird eingeplant.", "Assign skills and certifications — only qualified staff gets scheduled.")],
    ["bolt", L("Automatisierung", "Automation"), L("Regeln für automatische Zuschläge, Benachrichtigungen und Schichtzuweisungen.", "Rules for automatic surcharges, notifications, and shift assignments.")],
    ["calendar", L("Teamkalender", "Team calendar"), L("Wer arbeitet wann? Übersichtliche Kalenderansicht für das gesamte Team.", "Who's working when? Clear calendar view for the entire team.")],
    ["wallet", L("Urlaubskonto", "Vacation account"), L("Resturlaub, Anspruch und genommene Tage — alles auf einen Blick.", "Remaining leave, entitlement, and days taken — all at a glance.")],
    ["mapPin", L("Standorte & Objekte", "Locations & Objects"), L("Mehrere Standorte und Objekte verwalten — jeweils mit eigenen Plänen.", "Manage multiple locations and objects — each with their own schedules.")],
    ["folder", L("Projekte", "Projects"), L("Arbeitszeiten projektbezogen erfassen — für exakte Kostenzuordnung.", "Track working hours per project for precise cost allocation.")],
    ["flag", L("Feiertage", "Public holidays"), L("Gesetzliche Feiertage je Bundesland automatisch berücksichtigt.", "Public holidays per state are considered automatically.")],
  ];
  return `
  <section id="benefits" class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <h2>${L("Warum Teams Shiftfy wählen", "Why teams choose Shiftfy")}</h2>
        <p>${L("Mehr als 20 Funktionen für Zeiterfassung, Schichtplanung und Personalmanagement — alles in einer Plattform.", "Over 20 features for time tracking, shift planning, and workforce management — all in one platform.")}</p>
      </div>
      <div class="feat-grid">
        ${b.map((x) => `<div class="feat-card reveal" style="cursor:default"><div class="feat-ic" style="width:42px;height:42px;border-radius:12px;margin-bottom:14px">${mic(x[0])}</div><h3 style="font-size:var(--t-md)">${x[1]}</h3><p style="font-size:var(--t-sm)">${x[2]}</p></div>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ── APP SHOWCASE ── */
function mkAppShowcase() {
  const dev = [
    { ic: "globe", t: L("Desktop & Laptop", "Desktop & Laptop"), d: L("Volle Funktionalität im Browser — Chrome, Firefox, Safari, Edge.", "Full functionality in the browser — Chrome, Firefox, Safari, Edge.") },
    { ic: "stopwatch", t: "Smartphone", d: L("PWA zum Startbildschirm hinzufügen — fühlt sich an wie eine native App.", "Add PWA to home screen — feels like a native app.") },
    { ic: "grid", t: "Tablet", d: L("Optimierte Darstellung für iPad und Android-Tablets.", "Optimized layout for iPad and Android tablets.") },
  ];
  const chips = [L("Offline-fähig", "Offline-capable"), L("Sofort verfügbar", "Instantly available"), L("Keine Installation", "No installation")];
  return `
  <section class="mk-section tight">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <h2>${L("Funktioniert auf jedem Gerät", "Works on every device")}</h2>
        <p>${L("Als Progressive Web App (PWA) ist Shiftfy auf Desktop, Tablet und Smartphone sofort einsatzbereit — ohne Installation.", "As a Progressive Web App (PWA), Shiftfy is instantly ready on desktop, tablet, and smartphone — no installation needed.")}</p>
      </div>
      <div class="feat-grid" style="grid-template-columns:1fr">
        ${dev.map((d) => `<div class="feat-card reveal" style="cursor:default;display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div class="feat-ic" style="margin:0">${mic(d.ic)}</div><div style="flex:1;min-width:200px"><h3 style="font-size:var(--t-md)">${d.t}</h3><p style="font-size:var(--t-sm)">${d.d}</p></div></div>`).join("")}
      </div>
      <div class="flex items-center gap-3 wrap" style="justify-content:center;margin-top:26px">
        ${chips.map((c) => `<span class="badge emerald" style="height:30px;padding:0 16px;font-size:var(--t-sm)">${mic("check")}${c}</span>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ── TRUST ── */
function mkTrust() {
  const stats = [
    ["100 %", L("DSGVO-konform", "GDPR compliant"), L("Alle Daten werden in Deutschland verarbeitet und gespeichert.", "All data is processed and stored in Germany.")],
    ["99,9 %", L("Verfügbarkeit", "Uptime"), L("Enterprise-Infrastruktur mit automatischen Backups.", "Enterprise infrastructure with automatic backups.")],
    ["< 2 h", L("Antwortzeit", "Response time"), L("Unser Support antwortet schnell — auf Deutsch.", "Our support responds quickly — in German and English.")],
    ["256-Bit", L("Verschlüsselung", "Encryption"), L("SSL/TLS-Verschlüsselung für alle Datenübertragungen.", "SSL/TLS encryption for all data transfers.")],
  ];
  return `
  <section class="mk-section tight">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <div class="sec-kicker">${mic("shield")}</div>
        <h2>${L("Sicherheit & Vertrauen", "Security & Trust")}</h2>
        <p>${L("Deine Daten in besten Händen — gehostet in Deutschland, DSGVO-konform und mit höchsten Sicherheitsstandards.", "Your data is in good hands — hosted in Germany, GDPR-compliant, and secured with the highest standards.")}</p>
      </div>
      <div class="trust-grid">
        ${stats.map((s) => `<div class="trust-card reveal"><div class="num" style="font-size:var(--t-3xl);font-weight:850;color:var(--brand-600)">${s[0]}</div><div style="font-weight:750;margin:8px 0 6px">${s[1]}</div><div class="text-2" style="font-size:var(--t-sm);line-height:1.5">${s[2]}</div></div>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ── INTEGRATIONS ── */
function mkIntegrations() {
  const ints = [
    ["DATEV", L("Lohndaten per Klick exportieren — kompatibel mit DATEV LODAS und Lohn & Gehalt.", "Export payroll data with a click — compatible with DATEV LODAS and Lohn & Gehalt."), false],
    ["Lexware Office", L("Arbeitszeiten direkt in Lexware Office für die Lohnbuchhaltung übernehmen.", "Transfer work hours directly into Lexware Office for payroll processing."), false],
    ["sevdesk", L("Projektzeiten nahtlos in sevdesk für Rechnungen und Buchhaltung einbinden.", "Seamlessly integrate project hours into sevdesk for invoicing and accounting."), false],
    ["SAP", L("Enterprise-Integration für SAP SuccessFactors und SAP HCM.", "Enterprise integration for SAP SuccessFactors and SAP HCM."), true],
    ["Personio", L("Mitarbeiterdaten synchronisieren und HR-Prozesse automatisieren.", "Sync employee data and automate HR processes."), true],
    ["Sage", L("Kompatibel mit Sage HR und Sage Lohnabrechnung für nahtlosen Datenfluss.", "Compatible with Sage HR and Sage Payroll for seamless data flow."), true],
  ];
  return `
  <section class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <span class="badge emerald" style="margin-bottom:14px;height:28px;padding:0 14px">${mic("check")}${L("Offizieller DATEV-Integrationspartner", "Official DATEV integration partner")}</span>
        <h2>${L("Nahtlose Integration in Ihre bestehende Software", "Seamless integration with your existing software")}</h2>
        <p>${L("Shiftfy verbindet sich mit den führenden Tools für Buchhaltung, Lohnabrechnung und HR — für einen reibungslosen Workflow.", "Shiftfy connects with leading tools for accounting, payroll and HR — for a smooth workflow.")}</p>
      </div>
      <div class="feat-grid">
        ${ints.map((x) => `<div class="feat-card reveal" style="cursor:default"><div class="flex between items-start"><div class="int-logo">${x[0].split(" ")[0]}</div>${x[2] ? `<span class="badge gray" style="height:22px">${L("Bald", "Soon")}</span>` : `<span class="badge emerald" style="height:22px"><span class="pip"></span>Live</span>`}</div><h3 style="font-size:var(--t-md);margin-top:14px">${x[0]}</h3><p style="font-size:var(--t-sm)">${x[1]}</p></div>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ── SOCIAL PROOF: industries + testimonials + before/after ── */
function mkSocialProof() {
  const inds = [
    ["briefcase", L("Gastronomie", "Restaurants")], ["building", L("Einzelhandel", "Retail")], ["headset", L("Pflege & Gesundheit", "Healthcare")],
    ["gear", L("Handwerk", "Trades & Crafts")], ["swap", L("Logistik", "Logistics")], ["palm", L("Hotellerie", "Hotels")],
  ];
  const quotes = [
    { txt: L("Seit wir Shiftfy nutzen, sparen wir jede Woche Stunden bei der Schichtplanung. Die Mitarbeiter lieben die App — Tauschaktionen laufen jetzt ohne mein Zutun.", "Since we started using Shiftfy, we save hours every week on shift planning. The team loves the app — shift swaps now happen without my involvement."), nm: "Maria K.", rl: L("Betriebsleiterin · Restaurant & Catering", "Operations Manager · Restaurant & Catering"), c: "#059669", in: "MK" },
    { txt: L("Die DSGVO-Konformität war für uns entscheidend. Endlich eine Lösung, die datenschutzrechtlich sauber ist und trotzdem einfach zu bedienen.", "GDPR compliance was crucial for us. Finally a solution that is legally clean and still incredibly easy to use."), nm: "Thomas R.", rl: L("Geschäftsführer · Pflegedienst, 35 MA", "Managing Director · Care Service, 35 staff"), c: "#2563eb", in: "TR" },
    { txt: L("Der DATEV-Export allein spart uns zwei Arbeitstage im Monat. Und die automatische Pausenberechnung nach ArbZG gibt uns Rechtssicherheit.", "The DATEV export alone saves us two working days a month. And the automatic break calculation per ArbZG gives us legal certainty."), nm: "Lisa M.", rl: L("HR-Managerin · Einzelhandelskette", "HR Manager · Retail Chain"), c: "#d97706", in: "LM" },
  ];
  const before = [L("Schichtpläne in Excel — fehleranfällig", "Shift plans in Excel — error-prone"), L("Zettelwirtschaft bei Urlaubsanträgen", "Paper chaos for vacation requests"), L("Stundenlange manuelle Lohnabrechnung", "Hours of manual payroll processing"), L("Keine Übersicht über Arbeitszeiten", "No visibility into work hours")];
  const after = [L("Drag-and-Drop-Schichtplanung in Sekunden", "Drag-and-drop shift planning in seconds"), L("Digitale Anträge mit Ein-Klick-Freigabe", "Digital requests with one-click approval"), L("DATEV-Export per Knopfdruck", "DATEV export at the push of a button"), L("Echtzeit-Dashboard für alle Standorte", "Real-time dashboard for all locations")];
  return `
  <section class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal" style="margin-bottom:32px">
        <div class="sec-kicker">${L("Für alle Branchen mit Schichtbetrieb", "Built for every shift-based industry")}</div>
        <p style="margin-top:8px">${L("Shiftfy ist gebaut für Gastronomie, Einzelhandel, Pflege, Handwerk, Logistik und Hotellerie.", "Shiftfy is built for restaurants, retail, healthcare, trades, logistics, and hotels.")}</p>
      </div>
      <div class="logos reveal" style="margin-bottom:64px">
        ${inds.map((i) => `<span class="flex items-center gap-2 text-3" style="font-weight:600">${mic(i[0])}<span style="font-size:var(--t-md)">${i[1]}</span></span>`).join("")}
      </div>
      <div class="sec-head reveal" style="margin-bottom:36px"><h2>${L("Der Unterschied mit Shiftfy", "The difference with Shiftfy")}</h2></div>
      <div class="ba-grid reveal">
        <div class="ba-card ba-before">
          <div class="flex items-center gap-2" style="margin-bottom:18px"><span class="ba-ic" style="background:var(--danger-soft);color:var(--danger)">${mic("x")}</span><span style="font-weight:750;color:var(--danger)">${L("Ohne Shiftfy", "Without Shiftfy")}</span></div>
          <ul class="ba-list">${before.map((b) => `<li><span class="ba-dot" style="background:var(--danger-soft);color:var(--danger)">${mic("x")}</span>${b}</li>`).join("")}</ul>
        </div>
        <div class="ba-card ba-after">
          <div class="flex items-center gap-2" style="margin-bottom:18px"><span class="ba-ic" style="background:var(--success-soft);color:var(--brand-600)">${mic("check")}</span><span style="font-weight:750;color:var(--brand-700)">${L("Mit Shiftfy", "With Shiftfy")}</span></div>
          <ul class="ba-list">${after.map((a) => `<li><span class="ba-dot" style="background:var(--success-soft);color:var(--brand-600)">${mic("check")}</span>${a}</li>`).join("")}</ul>
        </div>
      </div>
    </div>
  </section>`;
}

/* ── ROI section ── */
function mkRoiSection() {
  return `
  <section class="mk-section tight">
    <div class="mk-wrap">
      <div class="cta-band reveal" style="background:var(--surface);border:1px solid var(--border);box-shadow:var(--sh-md)">
        <h2 style="color:var(--text)">${L("Was kostet manuelle Zeiterfassung Ihr Unternehmen wirklich?", "What is manual time tracking really costing your business?")}</h2>
        <p style="color:var(--text-2)">${L("Berechnen Sie in 60 Sekunden, wie viel Zeit und Geld Sie mit Shiftfy einsparen — basierend auf Ihren eigenen Zahlen.", "Calculate in 60 seconds how much time and money you save with Shiftfy — based on your own numbers.")}</p>
        <div class="metrics" style="margin:8px 0 28px;max-width:680px;margin-left:auto;margin-right:auto;grid-template-columns:repeat(3,1fr)">
          ${mkMetricCells([["70 %", L("weniger Planungsaufwand", "less planning effort")], ["328 h", L("Zeitersparnis / Jahr", "hours saved per year")], ["8.000 €", L("Kostenersparnis / Jahr", "cost savings per year")]])}
        </div>
        <button class="btn btn-primary btn-lg" data-go="roi">${mic("chart")}${L("Jetzt Ersparnis berechnen", "Calculate your savings now")}</button>
      </div>
    </div>
  </section>`;
}

/* ── Landing FAQ ── */
const LANDING_FAQ = () => [
  { q: L("Wie funktioniert die Preisgestaltung?", "How does pricing work?"), a: L("Reine Pro-Nutzer-Abrechnung — keine Grundgebühr. Jedes neue Konto erhält eine 7-tägige Testphase mit vollem Funktionsumfang. Der Basic-Plan startet ab 2,99 € pro Nutzer/Monat. Pläne können jederzeit gewechselt oder gekündigt werden.", "Pricing is purely per active user — no base fee. Every new account gets a 7-day trial with full features. The Basic plan starts at €2.99 per user per month, and you can switch plans or cancel anytime.") },
  { q: L("Wie schnell kann ich starten?", "How quickly can I get started?"), a: L("In unter 5 Minuten. Registriere dich, lege deine Mitarbeiter an und dein Team kann sofort Arbeitszeiten erfassen. Keine Kreditkarte nötig.", "In under 5 minutes. Sign up, add your employees, and your team can start tracking hours right away. No credit card required.") },
  { q: L("Sind meine Daten sicher?", "Is my data secure?"), a: L("Absolut. Alle Daten werden DSGVO-konform in Deutschland gehostet und verschlüsselt übertragen. Wir setzen auf modernste Sicherheitsstandards.", "Absolutely. All data is hosted GDPR-compliant in Germany and transmitted with state-of-the-art encryption.") },
  { q: L("Kann ich jederzeit upgraden oder kündigen?", "Can I upgrade or cancel anytime?"), a: L("Ja, du kannst jederzeit zwischen Plänen wechseln oder kündigen. Die Abrechnung läuft sicher über Stripe. Bei jährlicher Zahlung sparst du bis zu 17 %.", "Yes, you can switch between plans or cancel at any time. Billing is handled securely through Stripe. Save up to 17% with annual billing.") },
  { q: L("Gibt es eine App für Mitarbeiter?", "Is there an app for employees?"), a: L("Shiftfy ist als Progressive Web App (PWA) auf jedem Gerät nutzbar — einfach im Browser öffnen und zum Startbildschirm hinzufügen. Native iOS-/Android-Apps sind in Planung.", "Shiftfy works as a Progressive Web App (PWA) on any device — just open it in your browser and add it to your home screen. Native iOS/Android apps are coming soon.") },
  { q: L("Wie funktioniert der automatische eAU-Abruf?", "How does automatic eAU retrieval work?"), a: L("Verbinden Sie Shiftfy einmalig per OAuth mit Ihrem DATEV-Konto (dauert 2 Minuten). Hinterlegen Sie die DATEV-Personalnummer jedes Mitarbeiters. Bei jeder Krankmeldung genügt ein Klick — Shiftfy fragt die eAU direkt bei der Krankenkasse über die DATEV hr:eau API an.", "Connect Shiftfy to your DATEV account once via OAuth (takes 2 minutes). Store each employee's DATEV personnel number. For every sick leave, one click is all it takes — Shiftfy queries the eAU directly from the health insurer via the DATEV hr:eau API.") },
];
function mkLandingFaq() {
  const faq = LANDING_FAQ();
  return `
  <section id="faq" class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal"><div class="sec-kicker">FAQ</div><h2>${L("Häufig gestellte Fragen", "Frequently asked questions")}</h2><p>${L("Du hast Fragen? Wir haben Antworten.", "Got questions? We have answers.")}</p></div>
      <div class="faq" id="land-faq">
        ${faq.map((f, i) => `<div class="faq-item ${i === 0 ? "open" : ""}"><button class="faq-q">${f.q}<span class="qic">${mic("plus")}</span></button><div class="faq-a" style="${i === 0 ? "max-height:320px" : ""}"><div class="faq-a-inner">${f.a}</div></div></div>`).join("")}
      </div>
    </div>
  </section>`;
}

/* ── CTA footer band ── */
function mkCtaFooter() {
  return `
  <section class="mk-section tight">
    <div class="mk-wrap">
      <div class="cta-band reveal">
        <h2>${L("Bereit, deine Zeiterfassung zu digitalisieren?", "Ready to digitize your time tracking?")}</h2>
        <p>${L("Wähle einen Plan und erlebe, wie einfach Arbeitszeiterfassung sein kann.", "Pick a plan and discover how easy time tracking can be.")}</p>
        <div class="hero-cta" style="margin:0"><button class="btn btn-lg" style="background:#fff;color:var(--brand-700)" data-go="signup">${L("7 Tage testen", "Start 7-day trial")}</button><button class="btn btn-lg" style="background:rgba(255,255,255,.16);color:#fff" data-go="company">${L("Vertrieb kontaktieren", "Talk to sales")}</button></div>
      </div>
    </div>
  </section>`;
}

/* shared FAQ accordion init */
function mkMetricCells(arr) {
  return arr.map((m) => `<div class="metric"><div class="mv num">${m[0]}</div><div class="ml">${m[1]}</div></div>`).join("");
}
function mkFaqInit(sel) {
  document.querySelectorAll(`${sel} .faq-item`).forEach((it) => {
    const q = it.querySelector(".faq-q"); const a = it.querySelector(".faq-a");
    q.onclick = () => { const open = it.classList.toggle("open"); a.style.maxHeight = open ? a.scrollHeight + 40 + "px" : "0"; };
  });
}

/* ── shared mock builders ── */
function mkScheduleMock() {
  const days = mk.lang === "de" ? ["Mo", "Di", "Mi", "Do", "Fr"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const shifts = [[L("Früh", "Early"), "var(--brand-600)", "var(--success-soft)"], [L("Spät", "Late"), "var(--warning)", "var(--warning-soft)"], [L("Nacht", "Night"), "#6366f1", "#eef2ff"]];
  return `<div class="mock"><div class="flex between items-center" style="margin-bottom:4px"><div class="r-title" style="font-size:13px">${L("Schichtplan · KW 24", "Shift Plan · CW 24")}</div><span class="badge emerald" style="height:20px">${L("100 % besetzt", "100% covered")}</span></div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px">
      ${days.map((d) => `<div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-3);padding-bottom:4px">${d}</div>`).join("")}
      ${days.map((d, di) => shifts.map((s, si) => `<div style="border-radius:7px;padding:7px 2px;text-align:center;font-size:10px;font-weight:700;background:${s[2]};color:${s[1]};${di === 2 && si === 1 ? "outline:2px solid var(--brand);outline-offset:1px" : ""}">${s[0]}</div>`).join("")).join("")}
    </div></div>`;
}
function mkAbsenceMock() {
  const items = [["Anna M.", L("Urlaub", "Vacation"), L("Genehmigt", "Approved"), "emerald"], ["Ben K.", L("Krank", "Sick"), L("Genehmigt", "Approved"), "emerald"], ["Clara S.", L("Urlaub", "Vacation"), L("Ausstehend", "Pending"), "amber"]];
  return `<div class="mock"><div class="r-title" style="font-size:13px;margin-bottom:4px">${L("Abwesenheiten · Juni", "Absences · June")}</div>
    ${items.map((i) => `<div class="mock-row"><div class="avatar sm" style="background:var(--brand-600)">${i[0][0]}</div><div style="flex:1"><div style="font-weight:650;font-size:13px">${i[0]}</div><div style="font-size:12px;color:var(--text-3)">${i[1]}</div></div><span class="badge ${i[3]}" style="height:22px">${i[2]}</span></div>`).join("")}</div>`;
}
function mkReportsMock() {
  const bars = [60, 85, 45, 95, 70];
  return `<div class="mock"><div class="flex between items-center" style="margin-bottom:8px"><div class="r-title" style="font-size:13px">${L("Berichte · Mai 2025", "Reports · May 2025")}</div><button class="btn btn-primary btn-sm" style="height:30px">${mic("download")}DATEV</button></div>
    <div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding:10px;background:var(--surface-2);border-radius:12px">
      ${bars.map((h) => `<div style="flex:1;height:${h}%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--brand-400),var(--brand-600))"></div>`).join("")}
    </div>
    <div class="flex between" style="font-size:12px;color:var(--text-2);font-weight:600"><span>${L("Gesamt", "Total")}: 1.284 h</span><span>${L("Überstunden", "Overtime")}: +42 h</span></div></div>`;
}
function mkLiveMock() {
  return `<div class="mock">${[["Anna M.", L("08:00 – laufend", "08:00 – running"), "live"], ["Ben K.", "07:30 – 16:00", "done"], ["Clara S.", L("09:00 – laufend", "09:00 – running"), "live"]].map((r) => `<div class="mock-row"><div class="avatar sm" style="background:var(--brand-600)">${r[0][0]}</div><div style="flex:1"><div style="font-weight:650;font-size:13px">${r[0]}</div><div style="font-size:12px;color:var(--text-3)">${r[1]}</div></div>${r[2] === "live" ? `<span class="badge emerald" style="height:22px"><span class="pip"></span>${L("Aktiv", "Active")}</span>` : `<span style="color:var(--brand-500)">${mic("checkCircle")}</span>`}</div>`).join("")}</div>`;
}
