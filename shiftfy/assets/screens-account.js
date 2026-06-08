/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens · Planning extras, Developer & Account
   Team Calendar · Shift Templates · Webhooks · Import/Export
   Settings · Subscription · Roles   (fully built)
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   TEAM CALENDAR (Teamkalender)
   ════════════════════════════════════════════ */
SCREENS.teamCalendar = function () {
  const de = state.lang === "de";
  const dayLabels = de ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const today = new Date(); const year = today.getFullYear(), month = today.getMonth();
  const first = new Date(year, month, 1); const startDow = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const shiftDays = { 3: 4, 5: 2, 6: 2, 10: 3, 12: 1, 13: 2, 17: 2, 19: 3, 20: 1, 24: 2, 26: 4 };
  const absDays = { 12: 1, 13: 1, 14: 1, 24: 1 };
  let cells = "";
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= daysIn; d++) {
    const isToday = d === today.getDate();
    const sc = shiftDays[d] || 0, ac = absDays[d] || 0;
    cells += `<div class="cal-cell${isToday ? " today" : ""}">
      <span class="cal-d num">${d}</span>
      <div class="cal-dots">${sc ? `<span class="cal-dot s" title="${sc}"></span>` : ""}${ac ? `<span class="cal-dot a"></span>` : ""}</div>
      ${sc ? `<span class="cal-count num">${sc}</span>` : ""}
    </div>`;
  }
  const monthName = first.toLocaleDateString(loc(), { month: "long", year: "numeric" });
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="sched-week" style="margin:0"><button class="icon-btn">${ic("chevL")}</button><div class="rng" style="text-transform:capitalize">${monthName}</div><button class="icon-btn">${ic("chevR")}</button></div>
      <div class="flex items-center gap-4" style="font-size:var(--t-sm)">
        <span class="flex items-center gap-2"><span class="cal-dot s" style="position:static"></span>${de ? "Schichten" : "Shifts"}</span>
        <span class="flex items-center gap-2"><span class="cal-dot a" style="position:static"></span>${de ? "Abwesend" : "Absences"}</span>
      </div>
    </div>
    <div class="card card-pad">
      <div class="cal-grid head">${dayLabels.map((d) => `<div class="cal-hd">${d}</div>`).join("")}</div>
      <div class="cal-grid">${cells}</div>
    </div>
  </div>
  <style>
    .cal-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
    .cal-grid.head{ margin-bottom:8px; }
    .cal-hd{ text-align:center; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; }
    .cal-cell{ position:relative; aspect-ratio:1; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--surface-2); padding:6px; display:flex; flex-direction:column; cursor:pointer; transition:all var(--d-fast); }
    .cal-cell:hover{ border-color:var(--border-strong); background:var(--surface-hover); }
    .cal-cell.empty{ border:none; background:transparent; cursor:default; }
    .cal-cell.today{ border-color:var(--brand); background:var(--success-soft); }
    .cal-d{ font-size:var(--t-sm); font-weight:650; }
    .cal-cell.today .cal-d{ color:var(--brand-700); }
    .dark .cal-cell.today .cal-d{ color:var(--brand-300); }
    .cal-dots{ display:flex; gap:3px; margin-top:auto; }
    .cal-dot{ width:7px; height:7px; border-radius:50%; }
    .cal-dot.s{ background:var(--brand); } .cal-dot.a{ background:var(--warning); }
    .cal-count{ position:absolute; top:6px; right:7px; font-size:11px; font-weight:700; color:var(--text-3); }
    @media (max-width:560px){ .cal-cell{ padding:4px; } .cal-count{ display:none; } }
  </style>`;
};

/* ════════════════════════════════════════════
   SHIFT TEMPLATES (Schichtvorlagen)
   ════════════════════════════════════════════ */
const TEMPLATES = [
  { name: de_("Frühschicht", "Early shift"), start: "06:00", end: "14:00", brk: 30, color: "#059669", rec: de_("Mo–Fr", "Mon–Fri") },
  { name: de_("Spätschicht", "Late shift"), start: "14:00", end: "22:00", brk: 30, color: "#2563eb", rec: de_("Mo–Fr", "Mon–Fri") },
  { name: de_("Nachtschicht", "Night shift"), start: "22:00", end: "06:00", brk: 45, color: "#7c3aed", rec: de_("Mo–Sa", "Mon–Sat") },
  { name: de_("Wochenende", "Weekend"), start: "08:00", end: "16:00", brk: 30, color: "#d97706", rec: de_("Sa–So", "Sat–Sun") },
];
function de_(d, e) { return { de: d, en: e }; }
SCREENS.shiftTemplates = function () {
  const de = state.lang === "de";
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="text-2" style="font-size:var(--t-sm)">${TEMPLATES.length} ${de ? "Vorlagen — für schnelle Planung" : "templates — for faster planning"}</div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Vorlage erstellen" : "New template"}')">${ic("plus")}${de ? "Vorlage" : "Template"}</button>
    </div>
    <div class="grid tmpl-grid">
      ${TEMPLATES.map((tp) => { const dur = tplDur(tp.start, tp.end);
        return `<div class="card card-pad tmpl-card">
          <div class="shift-accent" style="position:absolute;left:0;top:0;bottom:0;width:5px;background:${tp.color};border-radius:var(--r-lg) 0 0 var(--r-lg)"></div>
          <div class="flex between items-center" style="margin-bottom:12px"><div class="r-title" style="font-size:var(--t-md)">${tp.name[state.lang] || tp.name.en}</div><button class="icon-btn" onclick="toast('${de ? "Bearbeiten" : "Edit"}')">${ic("edit")}</button></div>
          <div class="num" style="font-size:var(--t-2xl);font-weight:800;letter-spacing:-.02em">${tp.start} – ${tp.end}</div>
          <div class="flex items-center gap-4 mt-2 text-2" style="font-size:var(--t-sm)">
            <span class="flex items-center gap-2">${ic("clock")} ${dur}h</span>
            <span class="flex items-center gap-2">${ic("coffee")} ${tp.brk} min</span>
          </div>
          <div class="mt-4"><span class="badge gray">${ic("calendar")}${tp.rec[state.lang] || tp.rec.en}</span></div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <style>.tmpl-grid{ grid-template-columns:1fr; } .tmpl-card{ position:relative; padding-left:24px; } @media (min-width:1024px){ .app.wide .tmpl-grid{ grid-template-columns:repeat(2,1fr); } }</style>`;
};
function tplDur(s, e) { let [sh, sm] = s.split(":").map(Number), [eh, em] = e.split(":").map(Number); let d = (eh * 60 + em) - (sh * 60 + sm); if (d <= 0) d += 1440; return Math.round(d / 60 * 10) / 10; }

/* ════════════════════════════════════════════
   WEBHOOKS
   ════════════════════════════════════════════ */
const WEBHOOKS = [
  { url: "https://api.lohnbuero.de/shiftfy/hook", events: ["timeentry.created", "payroll.locked"], status: "active", last: de_("vor 4 Min", "4 min ago") },
  { url: "https://hooks.slack.com/services/T0…/B0…", events: ["shift.open", "absence.requested"], status: "active", last: de_("vor 1 Std", "1 hr ago") },
  { url: "https://erp.internal.amazon-fra3/ingest", events: ["shift.completed"], status: "failing", last: de_("vor 2 Tagen", "2 days ago") },
];
SCREENS.webhooks = function () {
  const de = state.lang === "de";
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div class="kpi-ic" style="width:46px;height:46px">${ic("link")}</div>
      <div class="grow" style="min-width:160px"><div class="r-title" style="font-size:var(--t-md)">${de ? "Webhook-Endpunkte" : "Webhook endpoints"}</div><div class="r-sub">${de ? "Echtzeit-Events an externe Systeme senden" : "Push real-time events to external systems"}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Endpunkt hinzufügen" : "Add endpoint"}')">${ic("plus")}${de ? "Endpunkt" : "Endpoint"}</button>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Aktive Endpunkte" : "Active endpoints"}</span><span class="badge gray act num">${WEBHOOKS.length}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${WEBHOOKS.map((w) => `<div class="wh-row">
          <div class="flex items-center gap-3" style="min-width:0">
            <span class="${w.status === "active" ? "live-dot" : ""}" style="${w.status === "active" ? "" : "width:8px;height:8px;border-radius:50%;background:var(--danger)"};flex-shrink:0"></span>
            <div style="min-width:0"><div class="mono" style="font-size:var(--t-sm);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.url}</div>
            <div class="flex wrap gap-2" style="margin-top:7px">${w.events.map((ev) => `<span class="badge gray mono" style="font-size:11px;height:20px">${ev}</span>`).join("")}</div></div>
          </div>
          <div class="flex items-center gap-3" style="flex-shrink:0">
            <div style="text-align:right"><span class="badge ${w.status === "active" ? "emerald" : "red"}"><span class="pip"></span>${w.status === "active" ? (de ? "Aktiv" : "Active") : (de ? "Fehler" : "Failing")}</span><div class="text-3" style="font-size:11px;margin-top:4px">${w.last[state.lang] || w.last.en}</div></div>
            <button class="icon-btn" onclick="toast('${de ? "Optionen" : "Options"}')">${ic("dots")}</button>
          </div>
        </div>`).join("")}
      </div>
    </div>
  </div>
  <style>.wh-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0; } .wh-row + .wh-row{ border-top:1px solid var(--border); }</style>`;
};

/* ════════════════════════════════════════════
   IMPORT / EXPORT (Daten)
   ════════════════════════════════════════════ */
SCREENS.dataIO = function () {
  const de = state.lang === "de";
  const imp = [
    { ic: "users", t: de ? "Mitarbeiter importieren" : "Import employees", d: "CSV / Excel" },
    { ic: "calendar", t: de ? "Schichten importieren" : "Import shifts", d: "CSV / iCal" },
    { ic: "mapPin", t: de ? "Standorte importieren" : "Import locations", d: "CSV" },
  ];
  const exp = [
    { ic: "calendar", t: de ? "Schichtplan exportieren" : "Export schedule", d: "iCal / PDF" },
    { ic: "clock", t: de ? "Zeiterfassung exportieren" : "Export time entries", d: "CSV / Excel" },
    { ic: "database", t: de ? "Komplett-Backup" : "Full backup", d: "JSON" },
  ];
  const jobs = de ? [
    { t: "Mitarbeiter-Import", d: "6 Datensätze · erfolgreich", date: "Heute 09:14", ok: true },
    { t: "Schichtplan-Export", d: "Februar 2026 · iCal", date: "Gestern 17:02", ok: true },
    { t: "Schichten-Import", d: "2 Fehler in Zeile 14, 22", date: "27. Feb", ok: false },
  ] : [
    { t: "Employee import", d: "6 records · success", date: "Today 09:14", ok: true },
    { t: "Schedule export", d: "February 2026 · iCal", date: "Yesterday 17:02", ok: true },
    { t: "Shift import", d: "2 errors on row 14, 22", date: "Feb 27", ok: false },
  ];
  const tile = (x, primary) => `<button class="io-tile" onclick="toast('${x.t}')"><div class="kpi-ic" style="${primary ? "" : "background:var(--info-soft);color:var(--info)"}">${ic(x.ic)}</div><div style="text-align:left"><div class="r-title" style="font-size:var(--t-base)">${x.t}</div><div class="r-sub">${x.d}</div></div>${ic(primary ? "download" : "arrowRight")}</button>`;
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="grid io-cols">
      <div class="card"><div class="card-head"><div class="kpi-ic" style="width:34px;height:34px;border-radius:9px">${ic("download")}</div><span class="ttl">${de ? "Importieren" : "Import"}</span></div><div class="card-body" style="display:grid;gap:10px;padding-top:14px">${imp.map((x) => tile(x, true)).join("")}</div></div>
      <div class="card"><div class="card-head"><div class="kpi-ic blue" style="width:34px;height:34px;border-radius:9px">${ic("fileDown")}</div><span class="ttl">${de ? "Exportieren" : "Export"}</span></div><div class="card-body" style="display:grid;gap:10px;padding-top:14px">${exp.map((x) => tile(x, false)).join("")}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Letzte Vorgänge" : "Recent jobs"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${jobs.map((j) => `<div class="irow"><div class="dline-ic" style="background:${j.ok ? "var(--success-soft)" : "var(--danger-soft)"};color:${j.ok ? "var(--brand-600)" : "var(--danger)"}">${ic(j.ok ? "checkCircle" : "alert")}</div><div class="grow"><div class="r-title" style="font-size:var(--t-base)">${j.t}</div><div class="r-sub">${j.d}</div></div><span class="text-3" style="font-size:12px;white-space:nowrap">${j.date}</span></div>`).join("")}
      </div>
    </div>
  </div>
  <style>
    .io-cols{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .io-cols{ grid-template-columns:1fr 1fr; } }
    .io-tile{ display:flex; align-items:center; gap:13px; width:100%; padding:13px; border:1px solid var(--border); border-radius:var(--r-md); background:var(--surface); cursor:pointer; font-family:inherit; transition:all var(--d-fast); color:var(--text); }
    .io-tile:hover{ border-color:var(--border-strong); background:var(--surface-hover); }
    .io-tile svg:last-child{ width:18px; height:18px; color:var(--text-3); margin-left:auto; }
    .io-tile > div:nth-child(2){ flex:1; min-width:0; }
  </style>`;
};

/* ════════════════════════════════════════════
   SETTINGS (Einstellungen)
   ════════════════════════════════════════════ */
SCREENS.settings = function () {
  const de = state.lang === "de";
  const toggle = (on, id) => `<button class="toggle ${on ? "on" : ""}" data-set="${id}"><span class="knob"></span></button>`;
  return `
  <div class="grid set-cols" style="gap:var(--gap-card)">
    <div class="grid" style="gap:var(--gap-card)">
      <div class="card">
        <div class="card-head"><span class="ttl">${de ? "Unternehmen" : "Company"}</span></div>
        <div class="card-body" style="padding-top:14px">
          <div class="field"><label>${de ? "Firmenname" : "Company name"}</label><input class="input" value="Bashabsheh Vergabepartner"></div>
          <div class="field-row"><div class="field"><label>${de ? "Zeitzone" : "Timezone"}</label><select class="select"><option>Europe/Berlin</option></select></div><div class="field"><label>${de ? "Sprache" : "Language"}</label><select class="select"><option ${de ? "selected" : ""}>Deutsch</option><option ${!de ? "selected" : ""}>English</option></select></div></div>
          <div class="field" style="margin-bottom:0"><label>${de ? "Wochenstart" : "Week starts on"}</label><div class="segmented" style="display:flex"><button class="active grow">${de ? "Montag" : "Monday"}</button><button class="grow">${de ? "Sonntag" : "Sunday"}</button></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="ttl">${de ? "Arbeitszeit-Regeln (ArbZG)" : "Working-time rules (ArbZG)"}</span></div>
        <div class="card-body" style="padding-top:6px">
          ${[
            [de ? "Max. 10 Std/Tag erzwingen" : "Enforce max 10 hrs/day", true, "maxhrs"],
            [de ? "Pausen automatisch abziehen" : "Auto-deduct breaks", true, "brk"],
            [de ? "11 Std Ruhezeit prüfen" : "Check 11 hrs rest period", true, "rest"],
            [de ? "Überstunden-Warnung" : "Overtime warnings", false, "ot"],
          ].map(([t2, on, id]) => `<div class="set-row"><div><div class="r-title" style="font-size:var(--t-base)">${t2}</div></div>${toggle(on, id)}</div>`).join("")}
        </div>
      </div>
    </div>
    <div class="grid" style="gap:var(--gap-card)">
      <div class="card">
        <div class="card-head"><span class="ttl">${de ? "Benachrichtigungen" : "Notifications"}</span></div>
        <div class="card-body" style="padding-top:6px">
          ${[
            [de ? "Neue Tauschanfragen" : "New swap requests", true, "n1"],
            [de ? "Abwesenheitsanträge" : "Absence requests", true, "n2"],
            [de ? "Offene Schichten (SOS)" : "Open shifts (SOS)", true, "n3"],
            [de ? "Wöchentliche Zusammenfassung" : "Weekly summary email", false, "n4"],
          ].map(([t2, on, id]) => `<div class="set-row"><div class="r-title" style="font-size:var(--t-base)">${t2}</div>${toggle(on, id)}</div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><span class="ttl">${de ? "Erscheinungsbild" : "Appearance"}</span></div>
        <div class="card-body" style="padding-top:14px">
          <div class="set-row" style="padding-top:0"><div class="r-title" style="font-size:var(--t-base)">${de ? "Design" : "Theme"}</div>
            <div class="segmented" id="set-theme"><button data-th="light" class="${state.theme === "light" ? "active" : ""}">${ic("sun")}</button><button data-th="dark" class="${state.theme === "dark" ? "active" : ""}">${ic("moon")}</button></div></div>
        </div>
      </div>
      <div class="card" style="border-color:color-mix(in oklab,var(--danger) 30%,var(--border))">
        <div class="card-head"><span class="ttl" style="color:var(--danger)">${de ? "Gefahrenzone" : "Danger zone"}</span></div>
        <div class="card-body" style="padding-top:14px"><button class="btn btn-danger btn-block" onclick="toast('${de ? "Aktion erfordert Bestätigung" : "Action requires confirmation"}')">${ic("trash")}${de ? "Workspace löschen" : "Delete workspace"}</button></div>
      </div>
    </div>
  </div>
  <style>
    .set-cols{ grid-template-columns:1fr; align-items:start; } @media (min-width:1024px){ .app.wide .set-cols{ grid-template-columns:1fr 1fr; } }
    .set-row{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:13px 0; } .set-row + .set-row{ border-top:1px solid var(--border); }
    .toggle{ width:46px; height:28px; border-radius:99px; border:none; background:var(--border-strong); cursor:pointer; padding:3px; transition:background var(--d-base); flex-shrink:0; }
    .toggle.on{ background:var(--brand); } .toggle .knob{ display:block; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:var(--sh-sm); transition:transform var(--d-base) var(--e-spring); } .toggle.on .knob{ transform:translateX(18px); }
  </style>`;
};
SCREEN_INIT.settings = function () {
  document.querySelectorAll("#content [data-set]").forEach((b) => (b.onclick = () => b.classList.toggle("on")));
  const th = document.querySelector("#set-theme"); if (th) th.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    state.theme = b.dataset.th; localStorage.setItem("sf_theme", state.theme);
    document.documentElement.classList.toggle("dark", state.theme === "dark"); renderShell();
  }));
};

/* ════════════════════════════════════════════
   SUBSCRIPTION (Abonnement)
   ════════════════════════════════════════════ */
SCREENS.billing = function () {
  const de = state.lang === "de";
  const seats = 6, max = 100; const pct = (seats / max) * 100;
  // Professional: 3,99 € pro Nutzer/Monat (jährlich) × 6 = 23,94 €
  const invoices = de ? [
    { id: "2026-02", amt: "23,94 €", date: "01.02.2026", st: "paid" },
    { id: "2026-01", amt: "23,94 €", date: "01.01.2026", st: "paid" },
    { id: "2025-12", amt: "19,95 €", date: "01.12.2025", st: "paid" },
  ] : [
    { id: "2026-02", amt: "€23.94", date: "Feb 1, 2026", st: "paid" },
    { id: "2026-01", amt: "€23.94", date: "Jan 1, 2026", st: "paid" },
    { id: "2025-12", amt: "€19.95", date: "Dec 1, 2025", st: "paid" },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="background:linear-gradient(135deg,var(--brand-600),var(--brand-800));border:none;color:#fff">
      <div class="flex between items-start wrap gap-4">
        <div><div class="flex items-center gap-2"><span class="badge" style="background:rgba(255,255,255,.2);color:#fff">Professional</span><span style="font-size:var(--t-sm);opacity:.85">${de ? "Jährlich" : "Annual"}</span></div>
          <div style="font-size:var(--t-3xl);font-weight:800;letter-spacing:-.03em;margin-top:10px">${de ? "3,99 €" : "€3.99"}<span style="font-size:var(--t-base);font-weight:500;opacity:.85"> / ${de ? "Nutzer/Monat" : "user/mo"}</span></div>
          <div style="font-size:var(--t-sm);opacity:.85;margin-top:4px">${de ? "6 Nutzer · 23,94 €/Monat · nächste Abrechnung 01.03.2026" : "6 users · €23.94/mo · next billing Mar 1, 2026"}</div></div>
        <button class="btn" style="background:#fff;color:var(--brand-700)" onclick="toast('${de ? "Plan ändern" : "Change plan"}')">${de ? "Plan verwalten" : "Manage plan"}</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--gap-card)">
      <div class="card card-pad"><div class="kpi-label">${de ? "Genutzte Plätze" : "Seats used"}</div><div class="num" style="font-size:var(--t-2xl);font-weight:800;margin:6px 0 10px">${seats}<span class="text-3" style="font-size:16px">/${max}</span></div><div class="track"><i style="width:${pct}%"></i></div></div>
      <div class="card card-pad"><div class="kpi-label">${de ? "Zahlungsart" : "Payment method"}</div><div class="flex items-center gap-3" style="margin-top:10px"><div class="dline-ic">${ic("card")}</div><div><div class="r-title num" style="font-size:var(--t-base)">•••• 4242</div><div class="r-sub">${de ? "Läuft ab 09/27" : "Expires 09/27"}</div></div></div></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Rechnungen" : "Invoices"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${invoices.map((inv) => `<div class="irow"><div class="dline-ic">${ic("fileDown")}</div><div class="grow"><div class="r-title num" style="font-size:var(--t-base)">${inv.id}</div><div class="r-sub">${inv.date}</div></div><span class="num" style="font-weight:700">${inv.amt}</span><span class="badge emerald">${ic("check")}${de ? "Bezahlt" : "Paid"}</span><button class="btn btn-ghost btn-sm" onclick="toast('PDF')">${ic("download")}</button></div>`).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   ROLES (Rollen)
   ════════════════════════════════════════════ */
SCREENS.roles = function () {
  const de = state.lang === "de";
  const perms = de
    ? ["Schichten planen", "Zeiten freigeben", "Mitarbeiter verwalten", "Berichte ansehen", "Lohnexport", "Einstellungen"]
    : ["Plan shifts", "Approve times", "Manage employees", "View reports", "Payroll export", "Settings"];
  const roles = [
    { name: "Owner", color: "#059669", count: 1, p: [1, 1, 1, 1, 1, 1] },
    { name: de ? "Administrator" : "Admin", color: "#2563eb", count: 1, p: [1, 1, 1, 1, 1, 1] },
    { name: "Manager", color: "#d97706", count: 1, p: [1, 1, 1, 1, 0, 0] },
    { name: de ? "Mitarbeiter" : "Employee", color: "#64748b", count: 3, p: [0, 0, 0, 0, 0, 0] },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="text-2" style="font-size:var(--t-sm)">${roles.length} ${de ? "Rollen · 6 Mitglieder" : "roles · 6 members"}</div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Rolle erstellen" : "New role"}')">${ic("plus")}${de ? "Rolle" : "Role"}</button>
    </div>
    <div class="card" style="overflow:hidden">
      <div class="card-body" style="overflow-x:auto;padding:0">
        <table class="roles-table">
          <thead><tr><th style="text-align:left">${de ? "Berechtigung" : "Permission"}</th>${roles.map((r) => `<th><div class="flex" style="flex-direction:column;align-items:center;gap:5px"><span class="role-chip" style="background:${r.color}">${ic("shield")}</span><span style="font-size:var(--t-sm);font-weight:700">${r.name}</span><span class="text-3" style="font-size:11px">${r.count}</span></div></th>`).join("")}</tr></thead>
          <tbody>
            ${perms.map((p, i) => `<tr><td style="text-align:left;font-weight:600;font-size:var(--t-sm)">${p}</td>${roles.map((r) => `<td>${r.p[i] ? `<span class="perm-yes">${ic("check")}</span>` : `<span class="perm-no">—</span>`}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <style>
    .roles-table{ width:100%; border-collapse:collapse; min-width:540px; }
    .roles-table th,.roles-table td{ padding:14px 12px; text-align:center; border-bottom:1px solid var(--border); }
    .roles-table thead th{ background:var(--surface-2); position:sticky; top:0; }
    .role-chip{ width:32px; height:32px; border-radius:9px; display:grid; place-items:center; color:#fff; } .role-chip svg{ width:17px; height:17px; }
    .perm-yes{ display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%; background:var(--success-soft); color:var(--brand-600); } .perm-yes svg{ width:15px; height:15px; }
    .dark .perm-yes{ color:var(--brand-300); }
    .perm-no{ color:var(--text-3); font-weight:700; }
  </style>`;
};
