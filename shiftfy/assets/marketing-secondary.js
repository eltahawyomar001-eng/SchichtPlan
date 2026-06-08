/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Pricing · Feature deep-dives · ROI · Company · Legal
   Content mirrors the real app (messages + legal pages)
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   PRICING (real tiers from messages "pricing")
   ════════════════════════════════════════════ */
const PRICE_PLANS = () => [
  {
    id: "basic", name: "Basic", pop: false, custom: false,
    monthly: L("2,99 €", "€2.99"), annual: L("2,49 €", "€2.49"),
    desc: L("Manuelle Planung für kleine Teams — alles Wichtige zum Einstieg.", "Manual planning for small teams — all the essentials to get started."),
    cta: L("Jetzt abonnieren", "Subscribe now"), goto: "signup",
    feats: [L("Bis zu 15 Mitarbeiter", "Up to 15 employees"), L("1 Standort", "1 location"), L("500 MB Speicher", "500 MB storage"), L("Schichtvorlagen", "Shift templates"), L("Abwesenheitsverwaltung", "Absence management"), L("CSV- und PDF-Export", "CSV and PDF export")],
  },
  {
    id: "pro", name: "Professional", pop: true, custom: false,
    monthly: L("4,99 €", "€4.99"), annual: L("3,99 €", "€3.99"),
    desc: L("Automatisierung, rechtssichere Nachweise und volle Kontrolle.", "Automation, audit-proof records, and full control."),
    cta: L("Jetzt abonnieren", "Subscribe now"), goto: "signup",
    feats: [L("Bis zu 100 Mitarbeiter", "Up to 100 employees"), L("Bis zu 10 Standorte", "Up to 10 locations"), L("5 GB Speicher", "5 GB storage"), L("Alles aus Basic", "Everything in Basic"), L("Automatische Schichtplanung", "Automatic scheduling"), L("DATEV-Export", "DATEV export"), L("API und Webhooks", "API and Webhooks"), L("Rollen und Berechtigungen", "Roles and permissions"), L("Berichte und Analysen", "Reports and analytics"), L("Priorisierter Support", "Priority support")],
  },
  {
    id: "ent", name: "Enterprise", pop: false, custom: true,
    monthly: L("Individuell", "Custom"), annual: L("Individuell", "Custom"),
    desc: L("Maßgeschneiderte Lösung mit SSO, SLA und persönlichem Onboarding.", "Custom solution with SSO, SLA, and dedicated onboarding."),
    cta: L("Vertrieb kontaktieren", "Contact sales"), goto: "company",
    feats: [L("Unbegrenzte Mitarbeiter", "Unlimited employees"), L("Unbegrenzte Standorte", "Unlimited locations"), L("50 GB+ Speicher", "50 GB+ storage"), L("Alles aus Professional", "Everything in Professional"), L("SSO / SAML (Geplant)", "SSO / SAML (Planned)"), L("Individuelle Integrationen", "Custom integrations"), L("SLA-Garantie", "SLA guarantee"), L("Persönlicher Ansprechpartner", "Dedicated account manager")],
  },
];
const COMPARE_ROWS = () => [
  [L("Mitarbeiterverwaltung", "Employee Management"), 1, 1, 1],
  [L("Digitale Zeiterfassung", "Digital Time Tracking"), 1, 1, 1],
  [L("Schichtplanung", "Shift Planning"), 1, 1, 1],
  [L("Abwesenheitsverwaltung", "Absence Management"), 1, 1, 1],
  [L("Berichte & Exports", "Reports & Exports"), 1, 1, 1],
  [L("DATEV-Export", "DATEV Export"), 0, 1, 1],
  [L("API-Zugang", "API Access"), 0, 1, 1],
  [L("Prioritäts-Support", "Priority Support"), 0, 1, 1],
  [L("White-Label", "White Label"), 0, 0, 1],
  [L("Dedizierter Account-Manager", "Dedicated Account Manager"), 0, 0, 1],
];
const ALL_PLANS_FEATS = () => [
  ["calendar", L("Schichtplanung", "Shift scheduling")], ["stopwatch", L("Digitale Stempeluhr", "Digital punch clock")], ["users", L("Mitarbeiterverwaltung", "Employee management")],
  ["calendar", L("Teamkalender", "Team calendar")], ["globe", L("Mobile App (PWA)", "Mobile app (PWA)")], ["shield", L("Server in Deutschland (DSGVO)", "German servers (GDPR)")],
];
const PRICING_FAQ = () => [
  { q: L("Kann ich Pläne wechseln oder jederzeit kündigen?", "Can I switch plans or cancel anytime?"), a: L("Ja. Du kannst jederzeit zwischen Plänen wechseln oder kündigen. Bei jährlicher Zahlung sparst du bis zu 20 %. Zahlungen laufen sicher über Stripe.", "Yes. You can switch between plans or cancel at any time. Save up to 20% with annual billing. Payments are handled securely via Stripe.") },
  { q: L("Wie funktioniert die Abrechnung?", "How does billing work?"), a: L("Jedes neue Konto startet mit einer 7-tägigen Testphase. Danach wird dein gewählter Plan automatisch monatlich oder jährlich abgerechnet — jederzeit kündbar.", "Every new account begins with a 7-day trial. After that, your selected plan is billed automatically monthly or annually — cancel anytime.") },
  { q: L("Wie funktioniert die Preisgestaltung?", "How does the pricing work?"), a: L("Du zahlst einfach pro aktivem Mitarbeiter — keine Grundgebühr. Beispiel: Basic mit 5 Mitarbeitern = 5 × 2,99 € = 14,95 €/Monat.", "You simply pay per active employee — no base fee. Example: Basic with 5 employees = 5 × €2.99 = €14.95/month.") },
  { q: L("Gibt es eine Testphase?", "Is there a trial?"), a: L("Ja, jedes neue Konto erhält eine 7-tägige Testphase mit vollem Funktionsumfang. Danach wird dein gewählter Plan automatisch abgerechnet — jederzeit kündbar.", "Yes, every new account gets a 7-day trial with full features. After it ends, your selected plan is billed automatically — cancel anytime.") },
  { q: L("Kann ich jederzeit kündigen?", "Can I cancel at any time?"), a: L("Ja, du kannst jederzeit kündigen. Dein Zugang bleibt bis zum Ende des bezahlten Zeitraums bestehen — kein Datenverlust, kein Aufwand.", "Yes, you can cancel at any time. Your access continues until the end of the paid period — no data loss, no hassle.") },
  { q: L("Gibt es Mengenrabatte für größere Teams?", "Are there volume discounts for larger teams?"), a: L("Für Teams ab 50 Nutzern bieten wir individuelle Konditionen. Kontaktieren Sie uns unter " + ORG.email + ".", "For teams of 50 or more users we offer custom pricing. Contact us at " + ORG.email + ".") },
];

MK_PAGES.__pricingInner = function () {
  const annual = mk.billing === "annual";
  const plans = PRICE_PLANS();
  const rows = COMPARE_ROWS();
  const allf = ALL_PLANS_FEATS();
  const faq = PRICING_FAQ();
  return `
  <section id="pricing" class="mk-section">
    <div class="mk-wrap">
      <div class="sec-head reveal">
        <div class="sec-kicker">${L("Preise", "Pricing")}</div>
        <h2>${L("Transparente Preise für jede Teamgröße", "Transparent pricing for every team size")}</h2>
        <p>${L("Einfach pro Nutzer bezahlen — keine Grundgebühr, keine versteckten Kosten. Schichtplanung in jedem Tarif inklusive.", "Simply pay per user — no base fee, no hidden costs. Shift scheduling included in every plan.")}</p>
      </div>
      <div class="flex items-center gap-4 wrap" style="justify-content:center;margin-bottom:14px;font-size:var(--t-sm);color:var(--text-2)">
        ${[L("Sofort einsatzbereit", "Ready to use immediately"), L("Sichere Zahlung via Stripe", "Secure payment via Stripe"), L("DSGVO-konform", "GDPR compliant"), L("Jederzeit kündbar", "Cancel anytime")].map((b) => `<span class="flex items-center gap-2">${mic("checkCircle")}${b}</span>`).join("")}
      </div>
      <div class="bill-toggle">
        <span style="font-weight:650;color:${annual ? "var(--text-3)" : "var(--text)"}">${L("Monatlich", "Monthly")}</span>
        <button class="toggle ${annual ? "on" : ""}" id="bill-switch"><span class="knob"></span></button>
        <span style="font-weight:650;color:${annual ? "var(--text)" : "var(--text-3)"}">${L("Jährlich", "Annual")}</span>
        <span class="bill-save">${L("2 Monate gratis", "2 months free")}</span>
      </div>

      <div class="price-grid">
        ${plans.map((p) => `
          <div class="price-card ${p.pop ? "pop" : ""} reveal">
            ${p.pop ? `<div class="price-pop-tag">${L("Am beliebtesten", "Most popular")}</div>` : ""}
            <div class="price-name">${p.name}</div>
            <div class="price-desc">${p.desc}</div>
            <div class="price-amt"><span class="val num">${annual ? p.annual : p.monthly}</span></div>
            <div class="price-meta">${p.custom ? L("individuelle Konditionen", "custom pricing") : `${L("pro Nutzer/Monat", "per user/month")} · ${annual ? L("jährlich abgerechnet", "billed annually") : L("monatlich abgerechnet", "billed monthly")}`}</div>
            <button class="btn ${p.pop ? "btn-primary" : "btn-secondary"} btn-block" style="margin-top:22px" data-go="${p.goto}">${p.cta}</button>
            <ul class="price-feats">
              ${p.feats.map((f) => `<li><span class="ck">${mic("check")}</span><span>${f}</span></li>`).join("")}
            </ul>
          </div>`).join("")}
      </div>
      <p style="text-align:center;color:var(--text-3);font-size:var(--t-sm);margin-top:22px">${mic("check")} ${L("Keine Einrichtungsgebühr · Keine Mindestvertragslaufzeit · DSGVO-konform", "No setup fees · No minimum contract · GDPR-compliant")}</p>

      <!-- comparison table -->
      <div class="sec-head reveal" style="margin:64px auto 28px"><h2 style="font-size:clamp(24px,3.5vw,34px)">${L("Tarifvergleich im Detail", "Plan Comparison in Detail")}</h2></div>
      <div class="card reveal" style="overflow:hidden"><div style="overflow-x:auto">
        <table class="cmp-table">
          <thead><tr><th></th><th>Basic</th><th style="color:var(--brand-600)">Professional</th><th>Enterprise</th></tr></thead>
          <tbody>
            ${rows.map((r) => `<tr><td>${r[0]}</td>${[r[1], r[2], r[3]].map((on) => `<td>${on ? `<span class="cmp-yes">${mic("check")}</span>` : `<span class="cmp-no">—</span>`}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div></div>

      <!-- included everywhere -->
      <div class="sec-head reveal" style="margin:64px auto 28px"><h2 style="font-size:clamp(24px,3.5vw,34px)">${L("In jedem Tarif enthalten", "Included in every plan")}</h2></div>
      <div class="incl-grid reveal">
        ${allf.map((f) => `<div class="incl-card"><div class="feat-ic" style="width:46px;height:46px;margin:0 auto 12px">${mic(f[0])}</div><span style="font-size:var(--t-sm);font-weight:600">${f[1]}</span></div>`).join("")}
      </div>

      <!-- pricing FAQ -->
      <div class="sec-head reveal" style="margin:64px auto 28px"><h2 style="font-size:clamp(24px,3.5vw,34px)">${L("Preis-FAQ", "Pricing FAQ")}</h2></div>
      <div class="faq" id="price-faq">
        ${faq.map((f, i) => `<div class="faq-item ${i === 0 ? "open" : ""}"><button class="faq-q">${f.q}<span class="qic">${mic("plus")}</span></button><div class="faq-a" style="${i === 0 ? "max-height:300px" : ""}"><div class="faq-a-inner">${f.a}</div></div></div>`).join("")}
      </div>
    </div>
  </section>`;
};

MK_PAGES.pricing = function () {
  return `${MK_PAGES.__pricingInner()}${mkCtaFooter()}`;
};
MK_PAGE_INIT.pricing = function () { mkBillingInit(); mkFaqInit("#price-faq"); };

function mkBillingInit() {
  const sw = m$("#bill-switch"); if (sw) sw.onclick = () => { mk.billing = mk.billing === "annual" ? "monthly" : "annual"; mkRender(); };
  mkFaqInit("#price-faq");
}

/* ════════════════════════════════════════════
   FEATURE DEEP-DIVES (real /schichtplanung & /zeiterfassung)
   ════════════════════════════════════════════ */
function featurePage({ ic, kicker, h1, sub, statline, blocks }) {
  return `
  <section class="hero mk-section tight"><div class="hero-bg"></div>
    <div class="mk-wrap"><div class="hero-inner">
      <div class="feat-ic" style="margin:0 auto 20px;width:60px;height:60px">${mic(ic)}</div>
      <div class="sec-kicker">${kicker}</div>
      <h1 style="font-size:clamp(30px,5vw,50px)">${h1}</h1>
      <p class="hero-sub">${sub}</p>
      <div class="hero-cta"><button class="btn btn-primary btn-lg" data-go="signup">${L("7 Tage testen", "Start 7-day trial")}</button><button class="btn btn-secondary btn-lg" data-go="pricing">${L("Preise ansehen", "See pricing")}</button></div>
    </div></div>
  </section>
  ${statline ? `<section class="mk-section tight"><div class="mk-wrap"><div class="metrics reveal">${statline.map((s) => `<div class="metric"><div class="mv num">${s.v}</div><div class="ml">${s.l}</div></div>`).join("")}</div></div></section>` : ""}
  ${blocks.map((b, i) => `
  <section class="mk-section tight"><div class="mk-wrap">
    <div class="split ${i % 2 ? "rev" : ""} reveal">
      <div class="split-text"><div class="sec-kicker">${b.k}</div><h3>${b.t}</h3><p>${b.p}</p>
        <ul class="split-list">${b.list.map((li) => `<li><span class="ck">${mic("check")}</span><span>${li}</span></li>`).join("")}</ul></div>
      <div class="split-media"><div class="split-media-bar"><i></i><i></i><i></i></div>${b.media}</div>
    </div>
  </div></section>`).join("")}
  ${mkCtaFooter()}`;
}
MK_PAGES["f-scheduling"] = function () {
  return featurePage({
    ic: "calendar", kicker: L("Schichtplanung-Software", "Shift Scheduling Software"),
    h1: L("Schichten planen in Minuten, nicht Stunden", "Plan shifts in minutes, not hours"),
    sub: L("Erstelle Schichtpläne per Drag & Drop, nutze Vorlagen und lass dein Team Schichten tauschen — Konflikte und ArbZG-Verstöße werden automatisch erkannt.", "Build shift schedules by drag & drop, use templates, and let your team swap shifts — conflicts and ArbZG violations are detected automatically."),
    statline: [{ v: "70 %", l: L("weniger Planungsaufwand", "less planning effort") }, { v: "328 h", l: L("Zeitersparnis / Jahr", "hours saved per year") }, { v: "0", l: L("ArbZG-Verstöße", "ArbZG violations") }],
    blocks: [
      { k: L("Drag & Drop", "Drag & drop"), t: L("Schichtpläne visuell erstellen", "Build schedules visually"), p: L("Ziehe Vorlagen auf den Wochenplan und verteile fertige Pläne mit einem Klick an dein Team.", "Drag templates onto the week and publish finished plans to your team in one click."), list: [L("Schichtvorlagen & Wochenplanung", "Shift templates & weekly planning"), L("Automatische Konflikterkennung", "Automatic conflict detection"), L("Veröffentlichen mit einem Klick", "One-click publish")], media: mkScheduleMock() },
      { k: "Compliance", t: L("Arbeitszeitgesetz, automatisch geprüft", "Working Hours Act, checked automatically"), p: L("Schichten über 6 bzw. 9 Stunden ohne gesetzliche Pause lassen sich gar nicht erst speichern — Bußgelder bis 15.000 € werden vermieden.", "Shifts over 6 or 9 hours without the statutory break can't even be saved — avoiding fines up to €15,000."), list: [L("ArbZG §4 Pausen-Pflicht erzwungen", "ArbZG §4 mandatory breaks enforced"), L("11-Stunden-Ruhezeit-Prüfung", "11-hour rest-period checks"), L("§34a Sachkunde-Nachweis", "§34a proof of competence")], media: mkComplianceMiniMock() },
    ],
  });
};
MK_PAGES["f-timetracking"] = function () {
  return featurePage({
    ic: "stopwatch", kicker: L("Zeiterfassung-Software", "Time Tracking Software"),
    h1: L("Arbeitszeiten digital erfassen", "Track working hours digitally"),
    sub: L("Mitarbeiter stempeln per App, Terminal oder QR-Code ein und aus — mit automatischer Pausenberechnung nach ArbZG und revisionssicherem Audit-Trail.", "Employees clock in and out by app, terminal, or QR code — with automatic break calculation per German labor law and an audit-proof trail."),
    statline: [{ v: "99,8 %", l: L("erfasste Zeiten korrekt", "accurate time entries") }, { v: "< 2 Sek", l: L("pro Stempelvorgang", "per clock-in") }, { v: "100 %", l: L("prüfungssicher", "audit-proof") }],
    blocks: [
      { k: L("Überall stempeln", "Clock in anywhere"), t: L("App, Terminal oder QR-Code", "App, terminal, or QR code"), p: L("Mitarbeiter stempeln auf ihrem Handy, oder ihr stellt ein gemeinsames Terminal mit QR-Code am Eingang auf.", "Staff clock in on their phone, or you set up a shared terminal with QR code at the entrance."), list: [L("Live-Stundenzähler in Echtzeit", "Live hour counter in real time"), L("Automatische Pausenberechnung (ArbZG)", "Automatic break calculation (ArbZG)"), L("Projektbezogene Zeiterfassung", "Project-based time tracking")], media: mkLiveMock() },
      { k: L("Prüfungssicher", "Audit-proof"), t: L("Revisionssicheres Zoll/FKS-Dossier", "Tamper-evident Zoll/FKS dossier"), p: L("Jede Arbeitszeit ist lückenlos dokumentiert. Auf Knopfdruck erstellen Sie ein revisionssicheres Dossier für Zoll und Finanzkontrolle Schwarzarbeit.", "Every working hour is fully documented. Generate a tamper-evident dossier for customs and labor inspections in one click."), list: [L("Lückenloser Audit-Trail", "Complete audit trail"), L("Mehrstufiger Freigabe-Workflow", "Multi-step approval workflow"), L("Korrekturen mit Kommentar", "Corrections with comments")], media: mkReportsMock() },
    ],
  });
};
function mkComplianceMiniMock() {
  return `<div class="mock">${[[L("Pause automatisch eingeplant", "Break scheduled automatically"), "coffee", "var(--brand-600)"], [L("Ruhezeit geprüft", "Rest period OK"), "check", "var(--success)"], [L("§34a gültig bis 2027", "§34a valid until 2027"), "shield", "var(--success)"]].map(([t2, i, c]) => `<div class="mock-row"><div style="width:34px;height:34px;border-radius:9px;background:${c === "var(--success)" ? "var(--success-soft)" : "var(--success-soft)"};color:${c};display:grid;place-items:center">${mic(i)}</div><div style="flex:1;font-weight:600;font-size:13px">${t2}</div><span style="color:var(--brand-500)">${mic("check")}</span></div>`).join("")}</div>`;
}

/* ════════════════════════════════════════════
   ROI / Ersparnisrechner
   ════════════════════════════════════════════ */
MK_PAGES.roi = function () {
  return `
  <section class="hero mk-section tight"><div class="hero-bg"></div>
    <div class="mk-wrap"><div class="hero-inner">
      <div class="feat-ic" style="margin:0 auto 20px;width:60px;height:60px">${mic("chart")}</div>
      <div class="sec-kicker">${L("Ersparnisrechner", "Savings Calculator")}</div>
      <h1 style="font-size:clamp(30px,5vw,46px)">${L("Wie viel spart Ihr Team mit Shiftfy?", "How much will your team save with Shiftfy?")}</h1>
      <p class="hero-sub">${L("Geben Sie Ihre Unternehmensdaten ein und sehen Sie sofort, wie viel Zeit und Geld Sie sparen.", "Enter your company details and instantly see how much time and money you can save.")}</p>
    </div></div>
  </section>
  <section class="mk-section tight" style="padding-top:0"><div class="mk-wrap">
    <div class="roi-grid">
      <div class="card card-pad reveal">
        <div class="field"><label>${L("Anzahl Mitarbeiter", "Number of employees")}</label><input class="input num" type="number" id="roi-emp" value="25"></div>
        <div class="field"><label>${L("Durchschnittlicher Stundenlohn (€)", "Average hourly wage (€)")}</label><input class="input num" type="number" id="roi-wage" value="18"></div>
        <div class="field"><label>${L("Stunden/Woche für Schichtplanung", "Hours per week on shift planning")}</label><input class="input num" type="number" id="roi-plan" value="6"></div>
        <div class="field"><label>${L("Stunden/Woche für Zeiterfassung", "Hours per week on time tracking")}</label><input class="input num" type="number" id="roi-track" value="4"></div>
        <div class="field" style="margin-bottom:0"><label>${L("Stunden/Monat für Lohnabrechnung", "Hours per month on payroll")}</label><input class="input num" type="number" id="roi-pay" value="8"></div>
      </div>
      <div class="card card-pad reveal" style="background:linear-gradient(150deg,var(--brand-600),var(--brand-800));border:none;color:#fff;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:var(--t-sm);opacity:.85;font-weight:600">${L("Ihre jährliche Ersparnis mit Shiftfy", "Your annual savings with Shiftfy")}</div>
        <div class="num" id="roi-money" style="font-size:clamp(40px,7vw,60px);font-weight:850;letter-spacing:-.03em;margin:8px 0">€0</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
          <div><div class="num" id="roi-hours" style="font-size:var(--t-2xl);font-weight:800">0 h</div><div style="font-size:var(--t-sm);opacity:.85">${L("Zeitersparnis / Jahr", "hours saved / year")}</div></div>
          <div><div class="num" style="font-size:var(--t-2xl);font-weight:800">70 %</div><div style="font-size:var(--t-sm);opacity:.85">${L("weniger Aufwand", "less effort")}</div></div>
        </div>
        <button class="btn btn-lg" style="background:#fff;color:var(--brand-700);margin-top:24px" data-go="signup">${L("Jetzt 7 Tage testen", "Start 7-day trial")}${mic("arrowRight")}</button>
      </div>
    </div>
  </div></section>`;
};
MK_PAGE_INIT.roi = function () {
  const calc = () => {
    const emp = +m$("#roi-emp").value || 0, wage = +m$("#roi-wage").value || 0;
    const plan = +m$("#roi-plan").value || 0, track = +m$("#roi-track").value || 0, pay = +m$("#roi-pay").value || 0;
    // Admin effort partly scales with team size (more staff = more planning/tracking volume),
    // plus a per-employee self-service saving (~0.2 h/week of manager reconciliation per head).
    const sizeFactor = 0.6 + 0.4 * (emp / 25);
    const weeklyHours = (plan + track) * 0.7 * sizeFactor + emp * 0.2;
    const monthlyHours = pay * 0.7 * sizeFactor;
    const yearHours = Math.round(weeklyHours * 52 + monthlyHours * 12);
    const money = Math.round(yearHours * wage / 100) * 100;
    m$("#roi-hours").textContent = yearHours.toLocaleString(mk.lang === "de" ? "de-DE" : "en-US") + " h";
    m$("#roi-money").textContent = "€" + money.toLocaleString(mk.lang === "de" ? "de-DE" : "en-US");
  };
  ["roi-emp", "roi-wage", "roi-plan", "roi-track", "roi-pay"].forEach((id) => { const el = m$("#" + id); if (el) el.oninput = calc; });
  calc();
};

/* ════════════════════════════════════════════
   COMPANY / CONTACT (real legal entity)
   ════════════════════════════════════════════ */
MK_PAGES.company = function () {
  const values = [
    { ic: "shield", t: L("Datenschutz zuerst", "Privacy first"), d: L("Server in Deutschland, DSGVO-konform, kein Daten-Verkauf.", "Servers in Germany, GDPR-compliant, no data selling.") },
    { ic: "zap", t: L("Einfach by Design", "Simple by design"), d: L("Software, die das Team ohne Schulung versteht.", "Software your team understands without training.") },
    { ic: "headset", t: L("Support auf Deutsch", "Support in your language"), d: L("Echte Menschen, schnelle Antworten — in unter 2 Stunden.", "Real people, fast answers — in under 2 hours.") },
  ];
  return `
  <section class="hero mk-section tight"><div class="hero-bg"></div>
    <div class="mk-wrap"><div class="hero-inner">
      <div class="sec-kicker">${L("Unternehmen", "Company")}</div>
      <h1 style="font-size:clamp(30px,5vw,48px)">${L("Schichtplanung & Zeiterfassung, Made in Germany", "Shift planning & time tracking, Made in Germany")}</h1>
      <p class="hero-sub">${L("Shiftfy ist die intelligente Software für Schichtplanung, Zeiterfassung und Personalmanagement — DSGVO-konform und rechtssicher für deutsche Teams.", "Shiftfy is the intelligent software for shift planning, time tracking, and workforce management — GDPR-compliant and legally secure for German teams.")}</p>
    </div></div>
  </section>
  <section class="mk-section tight"><div class="mk-wrap">
    <div class="feat-grid">${values.map((v) => `<div class="feat-card reveal" style="cursor:default"><div class="feat-ic">${mic(v.ic)}</div><h3>${v.t}</h3><p>${v.d}</p></div>`).join("")}</div>
  </div></section>
  <section class="mk-section"><div class="mk-wrap">
    <div class="sec-head reveal"><div class="sec-kicker">${L("Kontakt", "Contact")}</div><h2>${L("Sprich mit unserem Team", "Talk to our team")}</h2><p>${L("Ob Demo-Wunsch, Vertriebsfrage oder Support — wir antworten in unter 2 Stunden (Mo–Fr).", "Whether it's a demo, a sales question, or support — we reply in under 2 hours (Mon–Fri).")}</p></div>
    <div class="contact-grid">
      <div class="contact-info reveal">
        <div class="ci-item"><div class="ci-ic">${mic("building")}</div><div><div class="lbl">${L("Anbieter", "Provider")}</div><div class="val">${ORG.name}<br><span style="font-weight:500;color:var(--text-2)">${L("Inhaber", "Owner")}: ${ORG.owner}</span></div></div></div>
        <div class="ci-item"><div class="ci-ic">${mic("mapPin")}</div><div><div class="lbl">${L("Adresse", "Address")}</div><div class="val">${ORG.street}<br>${ORG.city}, ${ORG.country}</div></div></div>
        <div class="ci-item"><div class="ci-ic">${mic("phone")}</div><div><div class="lbl">${L("Telefon", "Phone")}</div><div class="val num">${ORG.phone}</div></div></div>
        <div class="ci-item"><div class="ci-ic">${mic("mail")}</div><div><div class="lbl">E-Mail</div><div class="val" style="font-size:var(--t-sm)">${ORG.email}</div></div></div>
      </div>
      <div class="contact-form" id="contact-form"><div id="cf-body">
        <div class="field-row"><div class="field"><label>${L("Vorname", "First name")}</label><input class="input" data-req placeholder="${L("Max", "Jane")}"><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div><div class="field"><label>${L("Nachname", "Last name")}</label><input class="input" data-req placeholder="${L("Mustermann", "Doe")}"><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div></div>
        <div class="field"><label>${L("Geschäftliche E-Mail", "Work email")}</label><input class="input" type="email" data-req data-email placeholder="max@firma.de"><div class="field-err">${L("Gültige E-Mail erforderlich", "Valid email required")}</div></div>
        <div class="field"><label>${L("Unternehmen", "Company")}</label><input class="input" data-req placeholder="${L("Firma GmbH", "Acme GmbH")}"><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div>
        <div class="field"><label>${L("Teamgröße", "Team size")}</label><select class="select"><option>1–15</option><option>16–100</option><option>100+</option></select></div>
        <div class="field"><label>${L("Nachricht", "Message")}</label><textarea class="input" data-req style="height:110px;padding:12px 14px;resize:none" placeholder="${L("Wie können wir helfen?", "How can we help?")}"></textarea><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div>
        <button class="btn btn-primary btn-block btn-lg" id="cf-submit">${mic("mail")}${L("Nachricht senden", "Send message")}</button>
      </div></div>
    </div>
  </div></section>`;
};
MK_PAGE_INIT.company = function () {
  const btn = m$("#cf-submit"); if (!btn) return;
  btn.onclick = () => {
    const form = m$("#contact-form"); let ok = true;
    form.querySelectorAll("[data-req]").forEach((inp) => {
      const f = inp.closest(".field"); const empty = !inp.value.trim();
      const bad = inp.hasAttribute("data-email") && inp.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value);
      f.classList.toggle("show-err", empty || bad); if (empty || bad) ok = false;
    });
    if (!ok) { mkToast(L("Bitte Felder prüfen", "Please check the form")); return; }
    m$("#cf-body").innerHTML = `<div class="form-success"><div class="fs-ic">${mic("checkCircle")}</div><h3>${L("Nachricht gesendet", "Message sent")}</h3><p>${L("Danke! Wir melden uns in Kürze.", "Thanks! We'll be in touch shortly.")}</p></div>`;
  };
};

/* ════════════════════════════════════════════
   BLOG (index — real structure)
   ════════════════════════════════════════════ */
MK_PAGES.blog = function () {
  const posts = [
    { tag: L("Recht", "Legal"), t: L("Arbeitszeiterfassung-Pflicht 2026: Was Arbeitgeber jetzt wissen müssen", "Mandatory time tracking 2026: what employers need to know"), d: L("Das BAG-Urteil und der Gesetzentwurf — ein praktischer Leitfaden zur gesetzeskonformen Zeiterfassung.", "The Federal Labour Court ruling and the draft law — a practical guide to compliant time tracking."), read: "8 Min", c: "#2563eb" },
    { tag: "DATEV", t: L("DATEV-Lohnexport in 5 Minuten einrichten", "Set up DATEV payroll export in 5 minutes"), d: L("Schritt für Schritt: So verbinden Sie Shiftfy mit DATEV LODAS und Lohn und Gehalt.", "Step by step: how to connect Shiftfy with DATEV LODAS and Lohn und Gehalt."), read: "6 Min", c: "#059669" },
    { tag: L("Sicherheit", "Security"), t: L("§34a-Pflicht im Sicherheitsdienst: automatisch nachweisen", "§34a in the security industry: prove competence automatically"), d: L("Wie Sie Sachkunde-Nachweise verwalten und ungültige Einsätze automatisch verhindern.", "How to manage proof of competence and automatically prevent invalid assignments."), read: "5 Min", c: "#d97706" },
    { tag: L("Tipps", "Tips"), t: L("Schichttausch ohne Chaos: 6 Best Practices", "Shift swaps without chaos: 6 best practices"), d: L("So lassen Sie Ihr Team Schichten selbst tauschen — mit voller Kontrolle.", "Let your team swap shifts on their own — while keeping full control."), read: "4 Min", c: "#7c3aed" },
  ];
  return `
  <section class="hero mk-section tight"><div class="hero-bg"></div>
    <div class="mk-wrap"><div class="hero-inner">
      <div class="sec-kicker">Blog</div>
      <h1 style="font-size:clamp(30px,5vw,46px)">${L("Wissen rund um Schichtplanung & Arbeitsrecht", "Insights on scheduling & labor law")}</h1>
      <p class="hero-sub">${L("Praktische Leitfäden zu Zeiterfassung, DSGVO, ArbZG und DATEV — für deutsche Teams.", "Practical guides on time tracking, GDPR, German labor law, and DATEV — for German teams.")}</p>
    </div></div>
  </section>
  <section class="mk-section tight" style="padding-top:0"><div class="mk-wrap">
    <div class="blog-grid">
      ${posts.map((p) => `<article class="blog-card reveal" onclick="mkToast('${L("Demo-Artikel", "Demo article")}')">
        <div class="blog-thumb" style="background:linear-gradient(135deg,${p.c},${p.c}cc)"><span class="badge" style="background:rgba(255,255,255,.2);color:#fff;height:24px">${p.tag}</span></div>
        <div class="blog-body"><h3>${p.t}</h3><p>${p.d}</p><div class="blog-meta">${mic("clock")} ${p.read} · ${L("Lesezeit", "read")}</div></div>
      </article>`).join("")}
    </div>
  </div></section>
  ${mkCtaFooter()}`;
};

/* ════════════════════════════════════════════
   LEGAL PAGES (real content: Impressum, Datenschutz, AGB, Widerruf, Barrierefreiheit)
   ════════════════════════════════════════════ */
function legalPage(title, updated, sections) {
  return `
  <section class="mk-section tight legal">
    <div class="legal-wrap">
      <button class="btn btn-ghost btn-sm" data-go="landing" style="margin-bottom:18px">${mic("chevL")}${L("Zurück", "Back")}</button>
      <h1 class="legal-h1">${title}</h1>
      ${updated ? `<p class="legal-date">${updated}</p>` : ""}
      <div class="legal-body">
        ${sections.map((s) => `${s.h ? `<h2>${s.h}</h2>` : ""}${s.body}`).join("")}
      </div>
    </div>
  </section>`;
}

MK_PAGES.impressum = function () {
  return legalPage("Impressum", "", [
    { h: L("Angaben gemäß § 5 DDG", "Information pursuant to § 5 DDG"), body: `<p>${ORG.name}<br>${L("Inhaber", "Owner")}: ${ORG.owner}</p><p>${ORG.street}<br>${ORG.city}<br>${ORG.country}</p>` },
    { h: L("Kontakt", "Contact"), body: `<p>${L("Telefon", "Phone")}: ${ORG.phone}<br>E-Mail: ${ORG.email}</p>` },
    { h: L("Umsatzsteuer", "VAT"), body: `<p>${L("Kleinunternehmer gemäß § 19 UStG — es wird keine Umsatzsteuer ausgewiesen.", "Small business under § 19 German VAT Act — no VAT is charged.")}</p>` },
    { h: L("Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV", "Responsible for content under § 18 (2) MStV"), body: `<p>${ORG.owner}<br>${ORG.street}<br>${ORG.city}</p>` },
    { h: L("EU-Streitschlichtung", "EU dispute resolution"), body: `<p>${L("Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit. Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.", "The European Commission provides a platform for online dispute resolution (ODR). We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board.")}</p>` },
  ]);
};

MK_PAGES.datenschutz = function () {
  const de = mk.lang === "de";
  return legalPage(de ? "Datenschutzerklärung" : "Privacy Policy", de ? "Stand: Juni 2026 · Version 2.0" : "Last updated: June 2026 · Version 2.0", [
    { h: de ? "1. Datenschutz auf einen Blick" : "1. Data protection at a glance", body: `<p>${L("Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.", "The following notes provide a simple overview of what happens to your personal data when you visit this website. Personal data is any data that can be used to identify you personally.")}</p>` },
    { h: de ? "2. Verantwortliche Stelle" : "2. Responsible party", body: `<p>${L("Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:", "The party responsible for data processing on this website is:")}</p><p>${ORG.name}<br>${L("Inhaber", "Owner")}: ${ORG.owner}<br>${ORG.street}<br>${ORG.city}, ${ORG.country}<br>${L("Telefon", "Phone")}: ${ORG.phone}<br>E-Mail: ${ORG.email}</p>` },
    { h: de ? "3. Rechtsgrundlage der Datenverarbeitung" : "3. Legal basis", body: `<p>${L("Die Verarbeitung Ihrer personenbezogenen Daten erfolgt auf Grundlage der DSGVO, insbesondere Art. 6 Abs. 1 lit. a (Einwilligung), lit. b (Vertragserfüllung) und lit. f (berechtigtes Interesse).", "Your personal data is processed on the basis of the GDPR, in particular Art. 6 (1) (a) consent, (b) contract performance, and (f) legitimate interest.")}</p>` },
    { h: de ? "4. Hosting & Serverstandort" : "4. Hosting & server location", body: `<p>${L("Alle Daten werden ausschließlich in Rechenzentren innerhalb der Europäischen Union (Deutschland) gehostet und DSGVO-konform verarbeitet. Die Übertragung erfolgt SSL/TLS-verschlüsselt.", "All data is hosted exclusively in data centres within the European Union (Germany) and processed in compliance with the GDPR. Transmission is SSL/TLS-encrypted.")}</p>` },
    { h: de ? "5. Ihre Rechte" : "5. Your rights", body: `<p>${L("Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem steht Ihnen ein Beschwerderecht bei einer Aufsichtsbehörde zu.", "You have the right at any time to access, rectification, erasure, restriction of processing, data portability, and objection. You also have the right to lodge a complaint with a supervisory authority.")}</p>` },
    { h: de ? "6. Auftragsverarbeitung (DATEV)" : "6. Data processing (DATEV)", body: `<p>${L("Für den Lohnexport und den eAU-Abruf nutzen wir die DATEV-Schnittstelle. Die Verarbeitung erfolgt auf Grundlage eines Auftragsverarbeitungsvertrags und ausschließlich nach Ihrer ausdrücklichen Freigabe.", "For payroll export and eAU retrieval we use the DATEV interface. Processing takes place on the basis of a data processing agreement and only with your explicit authorisation.")}</p>` },
  ]);
};

MK_PAGES.agb = function () {
  const de = mk.lang === "de";
  return legalPage(de ? "Allgemeine Geschäftsbedingungen" : "Terms & Conditions", de ? "Stand: Juni 2026" : "Last updated: June 2026", [
    { h: de ? "§ 1 Geltungsbereich" : "§ 1 Scope", body: `<p>${L("Diese AGB gelten für die Nutzung der Software-as-a-Service-Plattform Shiftfy, bereitgestellt von " + ORG.name + ", " + ORG.street + ", " + ORG.city + ".", "These terms apply to the use of the software-as-a-service platform Shiftfy, provided by " + ORG.name + ", " + ORG.street + ", " + ORG.city + ".")}</p>` },
    { h: de ? "§ 2 Vertragsgegenstand" : "§ 2 Subject of contract", body: `<p>${L("Shiftfy stellt eine webbasierte Plattform für Schichtplanung, Zeiterfassung und Personalmanagement bereit. Der Funktionsumfang richtet sich nach dem gewählten Tarif (Basic, Professional, Enterprise).", "Shiftfy provides a web-based platform for shift planning, time tracking, and workforce management. The scope of functionality depends on the chosen plan (Basic, Professional, Enterprise).")}</p>` },
    { h: de ? "§ 3 Testphase & Vertragslaufzeit" : "§ 3 Trial & contract term", body: `<p>${L("Jedes neue Konto erhält eine kostenlose 7-tägige Testphase mit vollem Funktionsumfang. Nach Ablauf wird der gewählte Tarif automatisch monatlich oder jährlich abgerechnet. Der Vertrag ist jederzeit zum Ende des bezahlten Zeitraums kündbar.", "Every new account receives a free 7-day trial with full features. After it ends, the selected plan is billed automatically monthly or annually. The contract can be cancelled at any time, effective at the end of the paid period.")}</p>` },
    { h: de ? "§ 4 Preise & Zahlung" : "§ 4 Prices & payment", body: `<p>${L("Die Abrechnung erfolgt pro aktivem Nutzer und Monat über unseren Zahlungsdienstleister Stripe. Es fallen keine Einrichtungsgebühren an. Als Kleinunternehmer gemäß § 19 UStG weisen wir keine Umsatzsteuer aus.", "Billing is per active user per month via our payment provider Stripe. No setup fees apply. As a small business under § 19 German VAT Act, we do not charge VAT.")}</p>` },
    { h: de ? "§ 5 Verfügbarkeit" : "§ 5 Availability", body: `<p>${L("Wir bemühen uns um eine Verfügbarkeit von 99,9 %. Wartungsfenster werden, soweit möglich, vorab angekündigt. Enterprise-Kunden erhalten eine vertragliche SLA-Garantie.", "We aim for 99.9% availability. Maintenance windows are announced in advance where possible. Enterprise customers receive a contractual SLA guarantee.")}</p>` },
    { h: de ? "§ 6 Haftung" : "§ 6 Liability", body: `<p>${L("Wir haften nach den gesetzlichen Bestimmungen. Für die Richtigkeit lohnsteuerlicher und arbeitsrechtlicher Bewertungen ist letztlich der Nutzer bzw. dessen Steuerberater verantwortlich.", "We are liable in accordance with statutory provisions. The user or their tax advisor is ultimately responsible for the correctness of payroll-tax and employment-law assessments.")}</p>` },
  ]);
};

MK_PAGES.widerruf = function () {
  const de = mk.lang === "de";
  return legalPage(de ? "Widerrufsbelehrung" : "Right of Withdrawal", "", [
    { h: de ? "Widerrufsrecht" : "Right of withdrawal", body: `<p>${L("Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.", "You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period is fourteen days from the day the contract was concluded.")}</p>` },
    { h: de ? "Ausübung des Widerrufs" : "Exercising withdrawal", body: `<p>${L("Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (" + ORG.name + ", " + ORG.street + ", " + ORG.city + ", " + ORG.email + ") mittels einer eindeutigen Erklärung (z. B. per E-Mail) über Ihren Entschluss informieren.", "To exercise your right of withdrawal, you must inform us (" + ORG.name + ", " + ORG.street + ", " + ORG.city + ", " + ORG.email + ") of your decision by means of a clear statement (e.g. by email).")}</p>` },
    { h: de ? "Folgen des Widerrufs" : "Consequences of withdrawal", body: `<p>${L("Wenn Sie diesen Vertrag widerrufen, erstatten wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen.", "If you withdraw from this contract, we will refund all payments received from you without undue delay and within fourteen days at the latest.")}</p>` },
    { h: de ? "Vorzeitiges Erlöschen" : "Early expiry", body: `<p>${L("Das Widerrufsrecht erlischt bei Dienstleistungen vorzeitig, wenn wir die Dienstleistung vollständig erbracht haben und Sie dem ausdrücklich zugestimmt haben.", "For services, the right of withdrawal expires early if we have fully provided the service and you have expressly agreed to this.")}</p>` },
  ]);
};

MK_PAGES.barrierefreiheit = function () {
  const de = mk.lang === "de";
  return legalPage(de ? "Barrierefreiheit" : "Accessibility", de ? "Stand: Juni 2026" : "Last updated: June 2026", [
    { h: de ? "Unser Anspruch" : "Our commitment", body: `<p>${L("Wir sind bestrebt, Shiftfy für alle Menschen zugänglich zu gestalten — im Einklang mit dem Barrierefreiheitsstärkungsgesetz (BFSG) und den Web Content Accessibility Guidelines (WCAG 2.1, Stufe AA).", "We strive to make Shiftfy accessible to everyone — in line with the German Accessibility Strengthening Act (BFSG) and the Web Content Accessibility Guidelines (WCAG 2.1, level AA).")}</p>` },
    { h: de ? "Maßnahmen" : "Measures", body: `<ul><li>${L("Tastaturbedienbarkeit aller Funktionen", "Full keyboard operability")}</li><li>${L("Ausreichende Farbkontraste (Hell- und Dunkelmodus)", "Sufficient colour contrast (light and dark mode)")}</li><li>${L("Skip-to-Content-Links und semantisches HTML", "Skip-to-content links and semantic HTML")}</li><li>${L("Screenreader-freundliche Beschriftungen", "Screen-reader-friendly labels")}</li></ul>` },
    { h: de ? "Feedback" : "Feedback", body: `<p>${L("Sind Ihnen Barrieren aufgefallen? Schreiben Sie uns an " + ORG.email + " — wir nehmen Ihr Feedback ernst und bessern nach.", "Noticed any barriers? Write to us at " + ORG.email + " — we take your feedback seriously and will improve.")}</p>` },
  ]);
};
