/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens · Tracking & Reports group
   Vacation Balance · Time Accounts · Payroll Export
   Month Close · Holidays · Automation   (fully built)
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   VACATION BALANCE (Urlaubskonto)
   ════════════════════════════════════════════ */
const VAC = {
  e1: { ent: 30, taken: 12, planned: 4 }, e2: { ent: 28, taken: 4, planned: 0 },
  e3: { ent: 30, taken: 19, planned: 5 }, e4: { ent: 30, taken: 0, planned: 6 },
  e5: { ent: 30, taken: 10, planned: 2 }, e6: { ent: 20, taken: 12, planned: 0 },
};
SCREENS.vacationBalance = function () {
  const de = state.lang === "de";
  const me = VAC.e1; const remaining = me.ent - me.taken - me.planned;
  const pctTaken = (me.taken / me.ent) * 100, pctPlan = (me.planned / me.ent) * 100;
  const upcoming = de ? [
    { emp: TEAM[3], range: "12.–16. Mär", days: 5, st: "approved" },
    { emp: TEAM[0], range: "24.–25. Mär", days: 2, st: "approved" },
    { emp: TEAM[2], range: "07.–11. Apr", days: 5, st: "pending" },
  ] : [
    { emp: TEAM[3], range: "Mar 12–16", days: 5, st: "approved" },
    { emp: TEAM[0], range: "Mar 24–25", days: 2, st: "approved" },
    { emp: TEAM[2], range: "Apr 07–11", days: 5, st: "pending" },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad">
      <div class="flex between items-center wrap gap-4">
        <div>
          <div class="kpi-label">${de ? "Mein Urlaubsanspruch 2026" : "My vacation entitlement 2026"}</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:6px"><span class="num" style="font-size:var(--t-5xl);font-weight:800;letter-spacing:-.04em;line-height:1">${remaining}</span><span class="text-2" style="font-weight:600">${de ? "Tage übrig" : "days left"}</span></div>
          <div class="flex items-center gap-4 mt-4" style="font-size:var(--t-sm)">
            <span class="flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:var(--brand)"></span>${de ? "Genommen" : "Taken"} <b class="num">${me.taken}</b></span>
            <span class="flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:var(--brand-300)"></span>${de ? "Geplant" : "Planned"} <b class="num">${me.planned}</b></span>
            <span class="flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:var(--surface-2);border:1px solid var(--border-strong)"></span>${de ? "Anspruch" : "Total"} <b class="num">${me.ent}</b></span>
          </div>
        </div>
        <button class="btn btn-primary" onclick="toast('${de ? "Urlaub beantragen" : "Request vacation"}')">${ic("plus")}${de ? "Urlaub beantragen" : "Request vacation"}</button>
      </div>
      <div class="track" style="height:14px;margin-top:18px;display:flex"><i style="width:${pctTaken}%;border-radius:99px 0 0 99px"></i><i style="width:${pctPlan}%;background:var(--brand-300);border-radius:0"></i></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Team-Übersicht" : "Team overview"}</span></div>
      <div class="card-body" style="padding-top:10px">
        ${TEAM.map((e) => { const v = VAC[e.id]; const left = v.ent - v.taken - v.planned; const p = (v.taken / v.ent) * 100;
          return `<div class="irow"><div style="min-width:0;flex:0 0 auto">${avatar(e, "sm")}</div>
            <div class="grow" style="min-width:0"><div class="flex between items-center" style="margin-bottom:6px"><span class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}</span><span class="num text-2" style="font-weight:700;font-size:var(--t-sm)">${left}/${v.ent} ${de ? "Tg" : "d"}</span></div>
            <div class="track"><i style="width:${p}%;background:${left <= 3 ? "var(--warning)" : "var(--brand)"}"></i></div></div></div>`;
        }).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Kommende Abwesenheiten" : "Upcoming absences"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${upcoming.map((u) => `<div class="irow"><div class="dline-ic" style="background:${u.st === "approved" ? "var(--success-soft)" : "var(--warning-soft)"};color:${u.st === "approved" ? "var(--brand-600)" : "var(--warning)"}">${ic("palm")}</div>
          <div class="grow"><div class="r-title" style="font-size:var(--t-base)">${u.emp.first} ${u.emp.last}</div><div class="r-sub">${u.range} · ${u.days} ${de ? "Tage" : "days"}</div></div>
          <span class="badge ${u.st === "approved" ? "emerald" : "amber"}"><span class="pip"></span>${u.st === "approved" ? (de ? "Genehmigt" : "Approved") : (de ? "Offen" : "Pending")}</span></div>`).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   TIME ACCOUNTS (Zeitkonten)
   ════════════════════════════════════════════ */
SCREENS.timeAccounts = function () {
  const de = state.lang === "de";
  const rows = TEAM.map((e) => ({ e, bal: EMP_EXT[e.id].balance, target: EMP_EXT[e.id].weekly * 4 })).sort((a, b) => b.bal - a.bal);
  const total = rows.reduce((s, r) => s + r.bal, 0);
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="grid ta-kpi">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic">${ic("clock")}</div></div><div class="kpi-label">${de ? "Team-Saldo" : "Team balance"}</div><div class="kpi-val num" style="color:${total >= 0 ? "var(--success)" : "var(--danger)"}">${fmtBal(total)}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic blue">${ic("trendUp")}</div></div><div class="kpi-label">${de ? "Mit Überstunden" : "In overtime"}</div><div class="kpi-val num">${rows.filter((r) => r.bal > 0).length}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${ic("arrowDown")}</div></div><div class="kpi-label">${de ? "Minusstunden" : "Undertime"}</div><div class="kpi-val num">${rows.filter((r) => r.bal < 0).length}</div></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Zeitkonten" : "Time accounts"}</span>
        <div class="segmented act" id="ta-period"><button class="active">${t("c.month")}</button><button>${t("c.quarter") || t("c.month")}</button><button>${t("c.year")}</button></div>
      </div>
      <div class="card-body" style="padding-top:10px">
        ${rows.map((r) => { const mag = Math.min(Math.abs(r.bal) / 1200 * 50, 50);
          return `<div class="irow"><div style="flex:0 0 auto">${avatar(r.e, "sm")}</div>
            <div class="grow" style="min-width:0"><div class="r-title" style="font-size:var(--t-base)">${r.e.first} ${r.e.last}</div><div class="r-sub">${r.e.loc} · ${de ? "Soll" : "Target"} ${r.target}h</div></div>
            <div style="display:flex;align-items:center;gap:10px;width:160px;justify-content:flex-end">
              <div style="flex:1;height:8px;background:var(--surface-2);border-radius:99px;position:relative;overflow:hidden">
                <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border-strong)"></div>
                <div style="position:absolute;top:0;bottom:0;${r.bal >= 0 ? "left:50%" : "right:50%"};width:${mag}%;background:${r.bal >= 0 ? "var(--brand)" : "var(--warning)"};border-radius:99px"></div>
              </div>
              <span class="num" style="font-weight:700;width:54px;text-align:right;color:${r.bal >= 0 ? "var(--success)" : "var(--danger)"}">${fmtBal(r.bal)}</span>
            </div></div>`;
        }).join("")}
      </div>
    </div>
  </div>
  <style>.ta-kpi{ grid-template-columns:repeat(3,1fr); } @media (max-width:560px){ .ta-kpi{ grid-template-columns:1fr; } }</style>`;
};
SCREEN_INIT.timeAccounts = function () { segmentedBind("#ta-period"); };

/* ════════════════════════════════════════════
   PAYROLL EXPORT (Lohnexport)
   ════════════════════════════════════════════ */
SCREENS.payrollExport = function () {
  const de = state.lang === "de";
  const rows = TEAM.filter((e) => EMP_EXT[e.id].status === "active").map((e) => ({ e, hrs: EMP_EXT[e.id].weekly * 4, ot: EMP_EXT[e.id].balance }));
  const history = de ? [
    { p: "Januar 2026", fmt: "DATEV", date: "01.02.2026", emp: 6 },
    { p: "Dezember 2025", fmt: "DATEV", date: "02.01.2026", emp: 5 },
  ] : [
    { p: "January 2026", fmt: "DATEV", date: "Feb 1, 2026", emp: 6 },
    { p: "December 2025", fmt: "DATEV", date: "Jan 2, 2026", emp: 5 },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad">
      <div class="grid" style="grid-template-columns:1fr;gap:14px">
        <div class="field-row">
          <div class="field" style="margin:0"><label>${de ? "Zeitraum" : "Period"}</label><select class="select"><option>${de ? "Februar 2026" : "February 2026"}</option><option>${de ? "Januar 2026" : "January 2026"}</option></select></div>
          <div class="field" style="margin:0"><label>${de ? "Format" : "Format"}</label><select class="select"><option>DATEV (LODAS)</option><option>DATEV (Lohn & Gehalt)</option><option>CSV</option><option>PDF</option></select></div>
        </div>
        <div class="field" style="margin:0"><label>${de ? "Mitarbeiter" : "Employees"}</label><select class="select"><option>${de ? "Alle aktiven (6)" : "All active (6)"}</option><option>${de ? "Nach Standort" : "By location"}</option></select></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Vorschau" : "Preview"}</span><span class="badge emerald act">${de ? "Geprüft" : "Validated"}</span></div>
      <div class="card-body" style="padding-top:8px">
        <div class="pay-head"><span>${de ? "Mitarbeiter" : "Employee"}</span><span style="text-align:right">${de ? "Stunden" : "Hours"}</span><span style="text-align:right">${de ? "Überstd." : "Overtime"}</span><span style="text-align:right">${de ? "Status" : "Status"}</span></div>
        ${rows.map((r) => `<div class="pay-row"><div class="flex items-center gap-3">${avatar(r.e, "sm")}<span class="r-title" style="font-size:var(--t-base)">${r.e.first} ${r.e.last}</span></div>
          <span class="num pay-col" style="text-align:right;font-weight:700">${r.hrs}h</span>
          <span class="num pay-col" style="text-align:right;color:${r.ot >= 0 ? "var(--success)" : "var(--danger)"}">${fmtBal(r.ot)}</span>
          <span class="pay-col" style="text-align:right"><span class="badge emerald">${ic("check")}OK</span></span></div>`).join("")}
      </div>
      <div class="card-body" style="border-top:1px solid var(--border);padding-top:16px"><div class="flex gap-3 wrap">
        <button class="btn btn-primary grow" onclick="toast('DATEV')">${ic("download")}${de ? "Export starten" : "Run export"}</button>
        <button class="btn btn-secondary" onclick="toast('PDF')">${ic("fileDown")}PDF</button>
      </div></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Verlauf" : "History"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${history.map((h) => `<div class="irow"><div class="dline-ic">${ic("fileDown")}</div><div class="grow"><div class="r-title" style="font-size:var(--t-base)">${h.p}</div><div class="r-sub">${h.fmt} · ${h.emp} ${de ? "Mitarbeiter" : "employees"} · ${h.date}</div></div><button class="btn btn-ghost btn-sm" onclick="toast('${de ? "Erneut laden" : "Re-download"}')">${ic("download")}</button></div>`).join("")}
      </div>
    </div>
  </div>
  <style>
    .pay-head{ display:none; padding:6px 0 12px; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--border); }
    .pay-row{ display:grid; grid-template-columns:1fr; gap:8px; padding:13px 0; border-top:1px solid var(--border); align-items:center; }
    .pay-row .pay-col{ display:none; }
    @media (min-width:1024px){ .app.wide .pay-head{ display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:8px; } .app.wide .pay-row{ grid-template-columns:2fr 1fr 1fr 1fr; } .app.wide .pay-row .pay-col{ display:inline-block; } }
  </style>`;
};

/* ════════════════════════════════════════════
   MONTH CLOSE (Monatsabschluss)
   ════════════════════════════════════════════ */
SCREENS.monthClose = function () {
  const de = state.lang === "de";
  const steps = de ? [
    { t: "Alle Zeiteinträge bestätigt", d: "142 von 142 geprüft", done: true },
    { t: "Abwesenheiten genehmigt", d: "Keine offenen Anträge", done: true },
    { t: "Überstunden abgeglichen", d: "Zeitkonten aktualisiert", done: true },
    { t: "Lohnexport erstellt", d: "Noch ausstehend", done: false },
    { t: "Monat sperren", d: "Nach Export verfügbar", done: false },
  ] : [
    { t: "All time entries confirmed", d: "142 of 142 reviewed", done: true },
    { t: "Absences approved", d: "No open requests", done: true },
    { t: "Overtime reconciled", d: "Time accounts updated", done: true },
    { t: "Payroll export generated", d: "Still pending", done: false },
    { t: "Lock month", d: "Available after export", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length; const pct = Math.round((doneCount / steps.length) * 100);
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="background:linear-gradient(135deg,var(--brand-600),var(--brand-800));border:none;color:#fff">
      <div class="flex between items-center wrap gap-4">
        <div><div style="font-size:var(--t-sm);opacity:.85;font-weight:600">${de ? "Abschluss" : "Closing"}</div><div style="font-size:var(--t-2xl);font-weight:800;letter-spacing:-.02em;margin-top:2px">${de ? "Februar 2026" : "February 2026"}</div></div>
        <div style="text-align:right"><div class="num" style="font-size:var(--t-4xl);font-weight:800;line-height:1">${pct}%</div><div style="font-size:var(--t-sm);opacity:.85">${doneCount}/${steps.length} ${de ? "Schritte" : "steps"}</div></div>
      </div>
      <div class="track" style="margin-top:16px;background:rgba(255,255,255,.2)"><i style="width:${pct}%;background:#fff"></i></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Checkliste" : "Checklist"}</span></div>
      <div class="card-body" style="padding-top:10px">
        ${steps.map((s, i) => `<div class="irow">
          <div style="width:32px;height:32px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;${s.done ? "background:var(--success);color:#fff" : "background:var(--surface-2);border:2px solid var(--border-strong);color:var(--text-3)"}">${s.done ? ic("check") : `<span class="num" style="font-weight:700">${i + 1}</span>`}</div>
          <div class="grow"><div class="r-title" style="font-size:var(--t-base);${s.done ? "" : "color:var(--text-2)"}">${s.t}</div><div class="r-sub">${s.d}</div></div>
          ${s.done ? `<span class="badge emerald">${ic("check")}${de ? "Erledigt" : "Done"}</span>` : i === doneCount ? `<button class="btn btn-primary btn-sm" onclick="toast('${de ? "Wird erstellt…" : "Generating…"}')">${de ? "Starten" : "Start"}</button>` : `<span class="badge gray">${de ? "Wartet" : "Waiting"}</span>`}
        </div>`).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   HOLIDAYS (Feiertage)
   ════════════════════════════════════════════ */
SCREENS.holidays = function () {
  const de = state.lang === "de";
  const hols = [
    { de: "Neujahr", en: "New Year's Day", date: "01.01.2026", day: de ? "Do" : "Thu", nat: true },
    { de: "Karfreitag", en: "Good Friday", date: "03.04.2026", day: de ? "Fr" : "Fri", nat: true },
    { de: "Ostermontag", en: "Easter Monday", date: "06.04.2026", day: de ? "Mo" : "Mon", nat: true },
    { de: "Tag der Arbeit", en: "Labour Day", date: "01.05.2026", day: de ? "Fr" : "Fri", nat: true },
    { de: "Christi Himmelfahrt", en: "Ascension Day", date: "14.05.2026", day: de ? "Do" : "Thu", nat: true },
    { de: "Fronleichnam", en: "Corpus Christi", date: "04.06.2026", day: de ? "Do" : "Thu", nat: false },
    { de: "Tag der Dt. Einheit", en: "German Unity Day", date: "03.10.2026", day: de ? "Sa" : "Sat", nat: true },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="segmented" id="hol-state"><button class="active">Hessen</button><button>NRW</button><button>Bayern</button></div>
      <div class="segmented" id="hol-year"><button>2025</button><button class="active">2026</button></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Gesetzliche Feiertage" : "Public holidays"} 2026</span><span class="badge gray act num">${hols.length}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${hols.map((h) => `<div class="irow">
          <div class="dline-ic" style="background:var(--info-soft);color:var(--info)">${ic("flag")}</div>
          <div class="grow"><div class="r-title" style="font-size:var(--t-base)">${de ? h.de : h.en}</div><div class="r-sub">${h.day}, ${h.date}</div></div>
          ${h.nat ? `<span class="badge emerald">${de ? "Bundesweit" : "Nationwide"}</span>` : `<span class="badge amber">${de ? "Regional" : "Regional"}</span>`}
        </div>`).join("")}
      </div>
    </div>
  </div>`;
};
SCREEN_INIT.holidays = function () { segmentedBind("#hol-state"); segmentedBind("#hol-year"); };

/* ════════════════════════════════════════════
   AUTOMATION (Automatisierung)
   ════════════════════════════════════════════ */
const AUTOMATIONS = [
  { ic: "logOut", trig: { de: "Schichtende erreicht", en: "Shift end reached" }, act: { de: "Automatisch ausstempeln", en: "Auto clock-out" }, on: true, runs: 248 },
  { ic: "coffee", trig: { de: "6 Std ohne Pause", en: "6 hrs without break" }, act: { de: "Pausen-Erinnerung senden", en: "Send break reminder" }, on: true, runs: 96 },
  { ic: "alert", trig: { de: "Überstunden > 10h/Tag", en: "Overtime > 10h/day" }, act: { de: "Manager benachrichtigen", en: "Notify manager" }, on: true, runs: 12 },
  { ic: "clock", trig: { de: "Vergessen auszustempeln", en: "Forgot to clock out" }, act: { de: "Um Mitternacht ausstempeln", en: "Clock out at midnight" }, on: false, runs: 31 },
  { ic: "card", trig: { de: "Monatsende", en: "End of month" }, act: { de: "Lohnabrechnung sperren", en: "Lock payroll" }, on: true, runs: 5 },
  { ic: "userPlus", trig: { de: "Offene Schicht < 24h", en: "Open shift < 24h" }, act: { de: "SOS-Eskalation starten", en: "Trigger SOS escalation" }, on: false, runs: 8 },
];
SCREENS.automationRules = function () {
  const de = state.lang === "de";
  const activeCount = AUTOMATIONS.filter((a) => a.on).length;
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div class="kpi-ic" style="width:48px;height:48px">${ic("bolt")}</div>
      <div class="grow" style="min-width:160px"><div class="r-title" style="font-size:var(--t-md)">${de ? "Automatisierungen" : "Automations"}</div><div class="r-sub">${activeCount} ${de ? "von" : "of"} ${AUTOMATIONS.length} ${de ? "aktiv · sparen ~14 Std/Monat" : "active · saving ~14 hrs/mo"}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Regel erstellen" : "New rule"}')">${ic("plus")}${de ? "Regel" : "Rule"}</button>
    </div>
    <div class="grid auto-grid">
      ${AUTOMATIONS.map((a, i) => `<div class="card card-pad auto-card ${a.on ? "" : "auto-off"}">
        <div class="flex between items-center" style="margin-bottom:14px">
          <div class="kpi-ic ${a.on ? "" : ""}" style="${a.on ? "" : "background:var(--surface-2);color:var(--text-3)"}">${ic(a.ic)}</div>
          <button class="toggle ${a.on ? "on" : ""}" data-auto="${i}"><span class="knob"></span></button>
        </div>
        <div class="flex items-center gap-2" style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${de ? "Wenn" : "When"}</div>
        <div class="r-title" style="font-size:var(--t-base);margin-bottom:12px">${de ? a.trig.de : a.trig.en}</div>
        <div class="auto-arrow">${ic("arrowDown")}</div>
        <div class="flex items-center gap-2" style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${de ? "Dann" : "Then"}</div>
        <div class="r-title" style="font-size:var(--t-base)">${de ? a.act.de : a.act.en}</div>
        <div class="flex between items-center mt-4" style="border-top:1px solid var(--border);padding-top:12px">
          <span class="text-3" style="font-size:12px;font-weight:600">${a.runs} ${de ? "Ausführungen" : "runs"}</span>
          <span class="badge ${a.on ? "emerald" : "gray"}">${a.on ? `<span class="pip"></span>${de ? "Aktiv" : "Active"}` : (de ? "Pausiert" : "Paused")}</span>
        </div>
      </div>`).join("")}
    </div>
  </div>
  <style>
    .auto-grid{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .auto-grid{ grid-template-columns:repeat(3,1fr); } }
    .auto-card.auto-off{ opacity:.72; }
    .auto-arrow{ color:var(--text-3); margin:2px 0 8px; } .auto-arrow svg{ width:18px; height:18px; }
    .toggle{ width:46px; height:28px; border-radius:99px; border:none; background:var(--border-strong); cursor:pointer; padding:3px; transition:background var(--d-base) var(--e-out); }
    .toggle.on{ background:var(--brand); }
    .toggle .knob{ display:block; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:var(--sh-sm); transition:transform var(--d-base) var(--e-spring); }
    .toggle.on .knob{ transform:translateX(18px); }
  </style>`;
};
SCREEN_INIT.automationRules = function () {
  document.querySelectorAll("#content [data-auto]").forEach((btn) => {
    btn.onclick = () => {
      const i = +btn.dataset.auto; AUTOMATIONS[i].on = !AUTOMATIONS[i].on;
      btn.classList.toggle("on"); btn.closest(".auto-card").classList.toggle("auto-off", !AUTOMATIONS[i].on);
      toast(AUTOMATIONS[i].on ? (state.lang === "de" ? "Aktiviert" : "Enabled") : (state.lang === "de" ? "Pausiert" : "Paused"));
    };
  });
};
