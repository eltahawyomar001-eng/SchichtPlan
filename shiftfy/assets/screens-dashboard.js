/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Dashboard (manager + employee views)
   Mirrors real dashboard/page.tsx card-for-card.
   Role toggle lets you preview both (real app keys off isManagement()).
   ═══════════════════════════════════════════════════════════════ */

/* ── shared dashboard data ── */
const DASH = {
  today: () => WEEK_SHIFTS[2],
  live: [
    { emp: TEAM[0], since: "08:00", dur: "5h 12m", status: "working" },
    { emp: TEAM[4], since: "10:00", dur: "3h 04m", status: "working" },
    { emp: TEAM[2], since: "06:00", dur: "—", status: "break" },
  ],
};

SCREENS.dashboard = function () {
  if (!state.role) state.role = localStorage.getItem("sf_role") || "manager";
  return state.role === "employee" ? employeeDashboard() : managerDashboard();
};
SCREEN_INIT.dashboard = function () {
  document.querySelectorAll("#content .shift-card").forEach((el) => (el.onclick = () => openShiftDetails(el.dataset.shift)));
  // hours chart period toggle
  const seg = document.querySelector("#hours-seg");
  if (seg) seg.querySelectorAll("button").forEach((b) => (b.onclick = () => { seg.querySelectorAll("button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); drawHoursChart(b.dataset.period); }));
  drawHoursChart("week");
  // my-tasks (localStorage personal todos)
  initMyTasks();
  // animate bars/tracks
  requestAnimationFrame(() => {
    document.querySelectorAll("#content .bar[data-h]").forEach((b) => (b.style.height = b.dataset.h + "%"));
    document.querySelectorAll("#content .track > i[data-w]").forEach((i) => (i.style.width = i.dataset.w + "%"));
  });
};

/* ════════════════════════════════════════════
   MANAGER DASHBOARD
   ════════════════════════════════════════════ */
function managerDashboard() {
  const de = state.lang === "de";
  const today = DASH.today();
  const stats = [
    { label: de ? "Mitarbeiter" : "Employees", val: "6", ic: "users", trend: null },
    { label: de ? "Schichten gesamt" : "Total shifts", val: "13", ic: "calendar", trend: 2 },
    { label: de ? "Abwesend" : "Absent", val: "1", ic: "calOff", neg: false },
    { label: de ? "Überstunden" : "Overtime", val: "+18 Std", ic: "clock", trend: 3 },
    { label: de ? "Standorte" : "Locations", val: "3", ic: "mapPin" },
    { label: de ? "Schichten heute" : "Shifts today", val: "4", ic: "calendar", trend: 1 },
  ];

  return `
  <div class="grid" style="gap:var(--gap-card)">
    ${gettingStarted()}

    <!-- Stats grid (3-col desktop, 2-col mobile) -->
    <div class="grid dash-stats" id="dash-stats">
      ${stats.map((s) => `
        <div class="kpi">
          <div class="kpi-top"><div class="kpi-ic">${ic(s.ic)}</div>${s.trend ? `<span class="kpi-trend up" style="margin:0 0 0 auto">${ic("arrowUp")}${s.trend}</span>` : ""}</div>
          <div class="kpi-label">${s.label}</div>
          <div class="kpi-val num" style="color:var(--brand-600)">${s.val}</div>
        </div>`).join("")}
    </div>

    <!-- Live overview (full width) -->
    ${liveOverviewCard()}

    <!-- Favorites -->
    ${favoritesCard()}

    <!-- Pending items -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Ausstehende Aufgaben" : "Pending items"}</span></div>
      <div class="card-body" style="padding-top:12px">
        <div class="row" onclick="setView('absences')"><div class="dline-ic" style="background:var(--warning-soft);color:var(--warning)">${ic("calOff")}</div><div class="grow"><div class="r-title">3 ${de ? "Abwesenheitsanträge" : "absence requests"}</div></div><span class="badge emerald" style="height:24px">${de ? "Jetzt prüfen" : "Review now"} ${ic("arrowRight")}</span></div>
        <div class="row" onclick="setView('shiftSwap')"><div class="dline-ic" style="background:var(--info-soft);color:var(--info)">${ic("swap")}</div><div class="grow"><div class="r-title">2 ${de ? "Tauschanfragen" : "swap requests"}</div></div><span class="badge emerald" style="height:24px">${de ? "Jetzt prüfen" : "Review now"} ${ic("arrowRight")}</span></div>
        <div class="row" onclick="setView('zeiterfassung')"><div class="dline-ic" style="background:var(--surface-2);color:var(--brand-600)">${ic("clock")}</div><div class="grow"><div class="r-title">2 ${de ? "unbestätigte Zeiteinträge" : "unconfirmed time entries"}</div></div><span class="badge emerald" style="height:24px">${de ? "Jetzt prüfen" : "Review now"} ${ic("arrowRight")}</span></div>
      </div>
    </div>

    <!-- Today's shifts -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Heutige Schichten" : "Today's shifts"}</span><a class="badge gray act" style="cursor:pointer" onclick="setView('shiftPlan')">${de ? "Alle anzeigen" : "View all"}</a></div>
      <div class="card-body">${today.map((s) => shiftCardHTML(s)).join("")}</div>
    </div>

    <!-- Hours chart -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Erfasste Stunden gesamt" : "Total recorded hours"}</span>
        <div class="segmented act" id="hours-seg"><button data-period="week" class="active">${de ? "Woche" : "Week"}</button><button data-period="month">${de ? "Monat" : "Month"}</button><button data-period="year">${de ? "Jahr" : "Year"}</button></div>
      </div>
      <div class="card-body"><div class="bars" id="hours-bars"></div></div>
    </div>

    <!-- 2-col widget grid -->
    <div class="grid dash-cols2">
      ${overtimeTrackerCard()}
      ${recentActivityCard()}
      ${sosUrgentCard()}
      ${shiftCoverageCard()}
      ${complianceAlertsCard()}
      ${absenteeismCard()}
      ${pendingRequestsCard()}
      ${locationDistributionCard()}
      ${teamMembersCard()}
      ${liveProjectsCard()}
      ${celebrationsCard()}
      ${myTasksCard()}
    </div>

    <!-- Team calendar + weather -->
    <div class="grid dash-cols2">
      ${teamCalendarMiniCard()}
      ${weatherCard()}
    </div>
  </div>
  <style>
    #dash-stats{ grid-template-columns:repeat(2,1fr); }
    .dash-cols2{ grid-template-columns:1fr; }
    @media (min-width:1024px){ .app.wide #dash-stats{ grid-template-columns:repeat(3,1fr); } .app.wide .dash-cols2{ grid-template-columns:1fr 1fr; align-items:start; } }
  </style>`;
}

/* ════════════════════════════════════════════
   EMPLOYEE DASHBOARD
   ════════════════════════════════════════════ */
function employeeDashboard() {
  const de = state.lang === "de";
  const me = TEAM[0];
  const myToday = [{ id: "s05", emp: me, start: "08:00", end: "16:00", loc: "Amazon-Fra3", st: "inProgress" }];
  const myUpcoming = [
    { d: de ? "Mi, 4. März" : "Wed, Mar 4", start: "08:00", end: "16:00", loc: "Amazon-Fra3", st: "scheduled" },
    { d: de ? "Fr, 6. März" : "Fri, Mar 6", start: "08:00", end: "16:00", loc: "Amazon-Fra3", st: "confirmed" },
    { d: de ? "Mo, 9. März" : "Mon, Mar 9", start: "14:00", end: "22:00", loc: "Amazon-Fra3", st: "scheduled" },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <!-- Greeting + my quick stats -->
    <div class="card card-pad" style="background:linear-gradient(135deg, var(--brand-600), var(--brand-800));border:none;color:#fff;box-shadow:var(--sh-md)">
      <div style="font-size:var(--t-sm);opacity:.85;font-weight:600">${greeting()}, ${me.first}</div>
      <div style="font-size:var(--t-2xl);font-weight:800;letter-spacing:-.03em;margin-top:4px">${new Date().toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })}</div>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px">
        ${[[de ? "Heute" : "Today", "5:12 h"], [de ? "Diese Woche" : "This week", "33:48 h"], [de ? "Urlaub übrig" : "Leave left", "18 " + (de ? "Tg" : "d")]].map((x) => `<div style="background:rgba(255,255,255,.14);border-radius:14px;padding:12px 14px"><div class="num" style="font-size:var(--t-xl);font-weight:800">${x[1]}</div><div style="font-size:12px;opacity:.85">${x[0]}</div></div>`).join("")}
      </div>
    </div>

    <!-- My pending requests -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Meine Anträge" : "My pending requests"}</span></div>
      <div class="card-body" style="padding-top:12px">
        <div class="row" onclick="setView('absences')"><div class="dline-ic" style="background:var(--success-soft);color:var(--brand-600)">${ic("calOff")}</div><div class="grow"><div class="r-title">1 ${de ? "offener Urlaubsantrag" : "pending vacation request"}</div></div><span class="chev">${ic("chevR")}</span></div>
        <div class="row" onclick="setView('shiftSwap')"><div class="dline-ic" style="background:var(--success-soft);color:var(--brand-600)">${ic("swap")}</div><div class="grow"><div class="r-title">1 ${de ? "offene Tauschanfrage" : "pending swap request"}</div></div><span class="chev">${ic("chevR")}</span></div>
      </div>
    </div>

    <!-- My shifts today -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Meine Schichten heute" : "My shifts today"}</span></div>
      <div class="card-body">
        ${myToday.map((s) => shiftCardHTML(s)).join("")}
      </div>
    </div>

    <!-- Upcoming shifts -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Kommende Schichten" : "Upcoming shifts"}</span><a class="badge gray act" style="cursor:pointer" onclick="setView('shiftPlan')">${de ? "Plan" : "Schedule"}</a></div>
      <div class="card-body" style="padding-top:8px">
        ${myUpcoming.map((s) => `<div class="irow"><div class="dline-ic">${ic("calendar")}</div><div class="grow"><div class="r-title num" style="font-size:var(--t-base)">${s.start} – ${s.end}</div><div class="r-sub">${s.d} · ${s.loc}</div></div>${statusBadge(s.st)}</div>`).join("")}
      </div>
    </div>

    <!-- My time account + punch shortcut -->
    <div class="grid dash-cols2">
      <div class="card card-pad">
        <div class="kpi-label">${de ? "Mein Zeitkonto" : "My time account"}</div>
        <div class="num" style="font-size:var(--t-3xl);font-weight:800;color:var(--success);margin:6px 0">+18,0 h</div>
        <div class="text-2" style="font-size:var(--t-sm)">${de ? "Überstunden-Saldo" : "Overtime balance"}</div>
        <button class="btn btn-secondary btn-sm mt-4" onclick="setView('timeAccounts')">${ic("scale")}${de ? "Zeitkonto ansehen" : "View account"}</button>
      </div>
      <div class="card card-pad" style="display:flex;flex-direction:column;justify-content:center;text-align:center">
        <div class="text-2" style="font-size:var(--t-sm);margin-bottom:12px">${de ? "Bist du im Dienst?" : "On the clock?"}</div>
        <button class="btn btn-primary btn-lg" onclick="setView('stempeluhr')">${ic("stopwatch")}${de ? "Zur Stempeluhr" : "Open punch clock"}</button>
      </div>
    </div>
    <style>.dash-cols2{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .dash-cols2{ grid-template-columns:1fr 1fr; } }</style>
  </div>`;
}

/* ════════════════════════════════════════════
   WIDGET BUILDERS
   ════════════════════════════════════════════ */
function gettingStarted() {
  const de = state.lang === "de";
  if (localStorage.getItem("sf_onboard_done") === "1") return "";
  const items = [
    [de ? "Erste Mitarbeiter anlegen" : "Add your first employees", true],
    [de ? "Standort einrichten" : "Set up a location", true],
    [de ? "Ersten Schichtplan erstellen" : "Create your first schedule", false],
    [de ? "DATEV verbinden" : "Connect DATEV", false],
  ];
  const done = items.filter((i) => i[1]).length; const pct = Math.round((done / items.length) * 100);
  return `<div class="card card-pad" id="onboard-card" style="border-color:color-mix(in oklab,var(--brand) 30%,var(--border))">
    <div class="flex between items-center" style="margin-bottom:14px">
      <div class="flex items-center gap-3"><div class="kpi-ic">${ic("rocket")}</div><div><div class="r-title" style="font-size:var(--t-md)">${de ? "Erste Schritte" : "Getting started"}</div><div class="r-sub">${done}/${items.length} ${de ? "erledigt" : "complete"} · ${pct}%</div></div></div>
      <button class="icon-btn" onclick="localStorage.setItem('sf_onboard_done','1');document.getElementById('onboard-card').remove()">${ic("x")}</button>
    </div>
    <div class="track" style="margin-bottom:16px"><i style="width:${pct}%"></i></div>
    <div class="grid" style="gap:8px">
      ${items.map((it) => `<div class="flex items-center gap-3" style="padding:8px 0"><div style="width:26px;height:26px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;${it[1] ? "background:var(--success);color:#fff" : "background:var(--surface-2);border:2px solid var(--border-strong);color:var(--text-3)"}">${it[1] ? ic("check") : ""}</div><span style="font-size:var(--t-base);${it[1] ? "color:var(--text-3);text-decoration:line-through" : "font-weight:600"}">${it[0]}</span></div>`).join("")}
    </div>
  </div>`;
}

function liveOverviewCard() {
  const de = state.lang === "de";
  return `<div class="card">
    <div class="card-head"><div class="flex items-center gap-2"><span class="live-dot"></span><span class="ttl">${de ? "Live-Übersicht" : "Live overview"}</span></div><a class="badge gray act" style="cursor:pointer" onclick="setView('zeiterfassung')">${de ? "Alle anzeigen" : "View all"}</a></div>
    <div class="card-body" style="padding-top:14px">
      ${DASH.live.map((l) => `<div class="irow">${avatar(l.emp)}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${l.emp.first} ${l.emp.last}</div><div class="r-sub">${l.emp.loc} · ${de ? "seit" : "since"} ${l.since}</div></div>${l.status === "working" ? `<span class="badge emerald"><span class="pip"></span>${l.dur}</span>` : `<span class="badge amber">${ic("coffee")}${de ? "Pause" : "Break"}</span>`}</div>`).join("")}
    </div>
  </div>`;
}

function favoritesCard() {
  const de = state.lang === "de";
  const favs = [["calendar", de ? "Schichtplan" : "Shift Plan", "shiftPlan"], ["stopwatch", de ? "Stempeluhr" : "Punch Clock", "stempeluhr"], ["chart", de ? "Berichte" : "Reports", "reports"], ["fileDown", de ? "Lohnexport" : "Payroll", "payrollExport"]];
  return `<div class="card card-pad">
    <div class="flex items-center gap-2" style="margin-bottom:14px">${ic("star")}<span class="ttl" style="font-size:var(--t-md)">${de ? "Favoriten" : "Favorites"}</span></div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);gap:10px">
      ${favs.map((f) => `<button class="row" style="margin:0;justify-content:flex-start" onclick="setView('${f[2]}')"><div class="dline-ic">${ic(f[0])}</div><span class="r-title" style="font-size:var(--t-base)">${f[1]}</span></button>`).join("")}
    </div>
  </div>`;
}

function overtimeTrackerCard() {
  const de = state.lang === "de";
  const rows = [{ e: TEAM[0], bal: 1080 }, { e: TEAM[4], bal: 660 }, { e: TEAM[2], bal: -120 }, { e: TEAM[1], bal: 420 }];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Überstunden-Tracker" : "Overtime tracker"}</span><span class="badge gray act num">+34,7 h</span></div>
    <div class="card-body" style="padding-top:10px">
      ${rows.map((r) => { const mag = Math.min(Math.abs(r.bal) / 1200 * 50, 50);
        return `<div class="irow" style="padding:10px 0">${avatar(r.e, "sm")}<div class="grow" style="min-width:0"><div class="r-title" style="font-size:var(--t-base)">${r.e.first} ${r.e.last}</div></div>
          <div style="display:flex;align-items:center;gap:8px;width:130px;justify-content:flex-end"><div style="flex:1;height:7px;background:var(--surface-2);border-radius:99px;position:relative;overflow:hidden"><div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border-strong)"></div><div style="position:absolute;top:0;bottom:0;${r.bal >= 0 ? "left:50%" : "right:50%"};width:${mag}%;background:${r.bal >= 0 ? "var(--brand)" : "var(--warning)"};border-radius:99px"></div></div><span class="num" style="font-weight:700;width:48px;text-align:right;font-size:var(--t-sm);color:${r.bal >= 0 ? "var(--success)" : "var(--danger)"}">${fmtBal(r.bal)}</span></div>
        </div>`;
      }).join("")}
    </div></div>`;
}

function recentActivityCard() {
  const de = state.lang === "de";
  const ev = de ? [
    { ic: "check", t: "Omar R. hat eine Schicht bestätigt", time: "vor 12 Min", c: "var(--brand-600)" },
    { ic: "calOff", t: "Lena B. hat Urlaub beantragt", time: "vor 1 Std", c: "var(--warning)" },
    { ic: "swap", t: "Khaled O. bietet eine Schicht an", time: "vor 2 Std", c: "var(--info)" },
    { ic: "userPlus", t: "Sara K. wurde hinzugefügt", time: "vor 3 Std", c: "var(--brand-600)" },
  ] : [
    { ic: "check", t: "Omar R. confirmed a shift", time: "12 min ago", c: "var(--brand-600)" },
    { ic: "calOff", t: "Lena B. requested vacation", time: "1 hr ago", c: "var(--warning)" },
    { ic: "swap", t: "Khaled O. offered a shift", time: "2 hrs ago", c: "var(--info)" },
    { ic: "userPlus", t: "Sara K. was added", time: "3 hrs ago", c: "var(--brand-600)" },
  ];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Letzte Aktivität" : "Recent activity"}</span></div>
    <div class="card-body" style="padding-top:10px">${ev.map((e) => `<div class="irow" style="padding:10px 0"><div class="dline-ic" style="background:var(--surface-2);color:${e.c}">${ic(e.ic)}</div><div class="grow"><div class="r-title" style="font-size:var(--t-sm);font-weight:600">${e.t}</div></div><span class="text-3" style="font-size:12px;white-space:nowrap">${e.time}</span></div>`).join("")}</div></div>`;
}

function sosUrgentCard() {
  const de = state.lang === "de";
  return `<div class="card" style="border-color:color-mix(in oklab,var(--danger) 25%,var(--border))"><div class="card-head"><div class="flex items-center gap-2"><span style="color:var(--danger)">${ic("alert")}</span><span class="ttl">${de ? "Dringend zu besetzen" : "SOS urgent"}</span></div><a class="badge red act" style="cursor:pointer" onclick="setView('sos')">${de ? "Alle" : "View all"}</a></div>
    <div class="card-body" style="padding-top:10px">
      <div class="shift-card shift-open"><div class="shift-accent" style="background:var(--danger)"></div><div class="shift-main"><div class="dline-ic" style="background:var(--danger-soft);color:var(--danger)">${ic("userPlus")}</div><div class="grow"><div class="shift-time num">16:00 – 00:00</div><div class="shift-meta">${de ? "Heute" : "Today"} · Amazon-Fra3</div></div><button class="btn btn-sm btn-primary" onclick="setView('sos')">${de ? "Senden" : "Broadcast"}</button></div></div>
    </div></div>`;
}

function shiftCoverageCard() {
  const de = state.lang === "de";
  const cov = [{ d: de ? "Mo" : "Mon", t: 2, o: 0 }, { d: de ? "Di" : "Tue", t: 4, o: 1 }, { d: de ? "Mi" : "Wed", t: 4, o: 1 }, { d: de ? "Do" : "Thu", t: 2, o: 0 }, { d: de ? "Fr" : "Fri", t: 1, o: 0 }, { d: de ? "Sa" : "Sat", t: 0, o: 0 }, { d: de ? "So" : "Sun", t: 0, o: 0 }];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Schichtabdeckung" : "Shift coverage"}</span><span class="badge amber act">2 ${de ? "offen" : "open"}</span></div>
    <div class="card-body"><div class="daystrip" style="grid-template-columns:repeat(7,1fr);gap:8px">
      ${cov.map((c) => { const filled = c.t - c.o; const pct = c.t ? Math.round((filled / c.t) * 100) : 100; const color = c.o ? "var(--warning)" : c.t ? "var(--brand)" : "var(--border-strong)";
        return `<div style="text-align:center"><div style="font-size:11px;color:var(--text-3);font-weight:600;margin-bottom:8px">${c.d}</div><div style="height:56px;border-radius:8px;background:var(--surface-2);display:flex;align-items:flex-end;overflow:hidden"><div style="width:100%;height:${c.t ? Math.max(pct, 12) : 6}%;background:${color};border-radius:8px 8px 0 0"></div></div><div class="num" style="font-size:12px;font-weight:700;margin-top:6px">${c.t || "–"}</div></div>`;
      }).join("")}
    </div></div></div>`;
}

function complianceAlertsCard() {
  const de = state.lang === "de";
  const alerts = [
    { sev: "warning", t: de ? "§34a läuft bald ab — 2 Mitarbeiter" : "§34a expiring — 2 employees", ic: "shield" },
    { sev: "warning", t: de ? "1 Dienstplan wartet auf Betriebsrat" : "1 schedule awaiting works council", ic: "scale" },
  ];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Compliance-Hinweise" : "Compliance alerts"}</span><a class="badge gray act" style="cursor:pointer" onclick="setView('compliance')">${de ? "Ansehen" : "View"}</a></div>
    <div class="card-body" style="padding-top:10px">${alerts.map((a) => `<div class="irow" style="padding:10px 0"><div class="dline-ic" style="background:var(--warning-soft);color:var(--warning)">${ic(a.ic)}</div><div class="grow"><div class="r-title" style="font-size:var(--t-sm);font-weight:600">${a.t}</div></div><span class="badge amber" style="height:22px">${de ? "Warnung" : "Warning"}</span></div>`).join("")}</div></div>`;
}

function absenteeismCard() {
  const de = state.lang === "de";
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Abwesend" : "Absent"}</span><a class="badge gray act" style="cursor:pointer" onclick="setView('absences')">${de ? "Alle" : "View all"}</a></div>
    <div class="card-body" style="padding-top:10px"><div class="irow" style="padding:10px 0">${avatar(TEAM[3], "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${TEAM[3].first} ${TEAM[3].last}</div><div class="r-sub">${de ? "Urlaub · noch 4 Tage" : "Vacation · 4 days remaining"}</div></div><span class="badge emerald" style="height:22px">${ic("palm")}${de ? "Urlaub" : "Vacation"}</span></div></div></div>`;
}

function pendingRequestsCard() {
  const de = state.lang === "de";
  const reqs = [{ e: TEAM[3], t: de ? "Urlaub · 12.–16. März" : "Vacation · Mar 12–16", c: "palm" }, { e: TEAM[2], t: de ? "Krank · 2.–3. März" : "Sick · Mar 2–3", c: "alert" }];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Offene Anträge" : "Pending requests"}</span><a class="badge amber act"><span class="pip"></span>3</a></div>
    <div class="card-body" style="padding-top:10px">${reqs.map((r) => `<div class="irow" style="padding:10px 0">${avatar(r.e, "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${r.e.first} ${r.e.last}</div><div class="r-sub">${r.t}</div></div><div class="flex gap-2"><button class="icon-btn" style="width:32px;height:32px;color:var(--danger)" onclick="setView('absences')">${ic("x")}</button><button class="icon-btn" style="width:32px;height:32px;color:var(--brand-600)" onclick="setView('absences')">${ic("check")}</button></div></div>`).join("")}</div></div>`;
}

function locationDistributionCard() {
  const de = state.lang === "de";
  const locs = [["Amazon-Fra3", 4, "#059669"], ["DHL-Hub Köln", 3, "#2563eb"], ["Zalando-Erfurt", 1, "#d97706"]];
  const total = 8;
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Wer ist wo" : "Who is where"}</span></div>
    <div class="card-body" style="padding-top:12px">${locs.map((l) => `<div style="margin-bottom:14px"><div class="flex between items-center" style="margin-bottom:6px"><span style="font-weight:650;font-size:var(--t-sm)">${l[0]}</span><span class="num text-2" style="font-weight:700;font-size:var(--t-sm)">${l[1]}</span></div><div class="track"><i style="width:${(l[1] / total * 100)}%;background:${l[2]}"></i></div></div>`).join("")}</div></div>`;
}

function teamMembersCard() {
  const de = state.lang === "de";
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Teammitglieder" : "Team members"}</span><a class="badge gray act num">6</a></div>
    <div class="card-body" style="padding-top:10px">${TEAM.slice(0, 4).map((e) => `<div class="irow" style="padding:10px 0">${avatar(e, "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}${e.id === "e1" ? ` <span class="text-3" style="font-weight:500">(${de ? "Du" : "You"})</span>` : ""}</div></div><span class="badge ${e.role === "Manager" ? "emerald" : "gray"}" style="height:22px">${e.role === "Manager" ? "Manager" : (de ? "Mitarbeiter" : "Employee")}</span></div>`).join("")}</div></div>`;
}

function liveProjectsCard() {
  const de = state.lang === "de";
  const projs = [["Inbound Q1", 142, 200, "#059669"], ["Peak-Support", 88, 120, "#d97706"]];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Aktive Projekte" : "Live projects"}</span><a class="badge gray act" style="cursor:pointer" onclick="setView('projects')">${de ? "Alle" : "All"}</a></div>
    <div class="card-body" style="padding-top:12px">${projs.map((p) => { const pct = Math.round(p[1] / p[2] * 100); return `<div style="margin-bottom:14px"><div class="flex between items-center" style="margin-bottom:6px"><span style="font-weight:650;font-size:var(--t-sm)">${p[0]}</span><span class="num text-2" style="font-weight:700;font-size:var(--t-sm)">${p[1]}/${p[2]}h</span></div><div class="track"><i style="width:${pct}%;background:${p[3]}"></i></div></div>`; }).join("")}</div></div>`;
}

function celebrationsCard() {
  const de = state.lang === "de";
  const c = [{ e: TEAM[1], t: de ? "Geburtstag · morgen" : "Birthday · tomorrow", ic: "star" }, { e: TEAM[4], t: de ? "3 Jahre dabei · in 4 Tagen" : "3-year anniversary · in 4 days", ic: "award" }];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Anlässe" : "Celebrations"}</span></div>
    <div class="card-body" style="padding-top:10px">${c.map((x) => `<div class="irow" style="padding:10px 0">${avatar(x.e, "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${x.e.first} ${x.e.last}</div><div class="r-sub">${x.t}</div></div><span style="color:var(--brand-500)">${ic(x.ic)}</span></div>`).join("")}</div></div>`;
}

function myTasksCard() {
  const de = state.lang === "de";
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Meine Aufgaben" : "My tasks"}</span><button class="btn btn-ghost btn-sm act" id="mytask-add">${ic("plus")}${de ? "Neu" : "New"}</button></div>
    <div class="card-body" style="padding-top:10px"><div id="mytask-list"></div><div id="mytask-empty" class="text-3" style="font-size:var(--t-sm);padding:8px 0;display:none">${de ? "Keine Aufgaben" : "No tasks yet"}</div></div></div>`;
}
function initMyTasks() {
  const list = document.getElementById("mytask-list"); if (!list) return;
  const de = state.lang === "de";
  let tasks = JSON.parse(localStorage.getItem("sf_mytasks") || "null") || [{ t: de ? "Schichtplan KW 11 prüfen" : "Review schedule CW 11", done: false }, { t: de ? "Lohnexport Februar" : "February payroll export", done: true }];
  const save = () => localStorage.setItem("sf_mytasks", JSON.stringify(tasks));
  const render = () => {
    document.getElementById("mytask-empty").style.display = tasks.length ? "none" : "block";
    list.innerHTML = tasks.map((tk, i) => `<div class="flex items-center gap-3" style="padding:9px 0;border-bottom:1px solid var(--border)"><button class="mt-check" data-i="${i}" style="width:22px;height:22px;border-radius:6px;flex-shrink:0;border:2px solid ${tk.done ? "var(--brand)" : "var(--border-strong)"};background:${tk.done ? "var(--brand)" : "transparent"};color:#fff;display:grid;place-items:center;cursor:pointer">${tk.done ? ic("check") : ""}</button><span style="flex:1;font-size:var(--t-base);${tk.done ? "color:var(--text-3);text-decoration:line-through" : ""}">${tk.t}</span><button class="mt-del" data-i="${i}" style="border:none;background:none;color:var(--text-3);cursor:pointer">${ic("x")}</button></div>`).join("");
    list.querySelectorAll(".mt-check").forEach((b) => (b.onclick = () => { tasks[+b.dataset.i].done = !tasks[+b.dataset.i].done; save(); render(); }));
    list.querySelectorAll(".mt-del").forEach((b) => (b.onclick = () => { tasks.splice(+b.dataset.i, 1); save(); render(); }));
  };
  render();
  const add = document.getElementById("mytask-add");
  if (add) add.onclick = () => { const v = prompt(de ? "Neue Aufgabe:" : "New task:"); if (v) { tasks.push({ t: v, done: false }); save(); render(); } };
}

function teamCalendarMiniCard() {
  const de = state.lang === "de";
  const days = de ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const today = new Date(); const month = today.getMonth(), year = today.getFullYear();
  const first = new Date(year, month, 1); const startDow = (first.getDay() + 6) % 7; const daysIn = new Date(year, month + 1, 0).getDate();
  const shiftDays = { 3: true, 5: true, 6: true, 10: true, 12: true, 13: true, 17: true, 19: true, 24: true };
  const absDays = { 12: true, 13: true };
  let cells = "";
  for (let i = 0; i < startDow; i++) cells += `<div></div>`;
  for (let d = 1; d <= daysIn; d++) {
    const isToday = d === today.getDate();
    cells += `<div style="aspect-ratio:1;border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-weight:600;${isToday ? "background:var(--success-soft);color:var(--brand-700);outline:1.5px solid var(--brand)" : "background:var(--surface-2)"}"><span>${d}</span><span style="display:flex;gap:2px;margin-top:2px">${shiftDays[d] ? '<span style="width:4px;height:4px;border-radius:50%;background:var(--brand)"></span>' : ""}${absDays[d] ? '<span style="width:4px;height:4px;border-radius:50%;background:var(--warning)"></span>' : ""}</span></div>`;
  }
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Teamkalender" : "Team calendar"}</span><span class="text-3" style="font-size:var(--t-sm);font-weight:600;text-transform:capitalize">${first.toLocaleDateString(loc(), { month: "long", year: "numeric" })}</span></div>
    <div class="card-body"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px">${days.map((d) => `<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text-3)">${d}</div>`).join("")}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells}</div>
    <div class="flex items-center gap-4 mt-4" style="font-size:var(--t-sm)"><span class="flex items-center gap-2"><span style="width:7px;height:7px;border-radius:50%;background:var(--brand)"></span>${de ? "Schichten" : "Shifts"}</span><span class="flex items-center gap-2"><span style="width:7px;height:7px;border-radius:50%;background:var(--warning)"></span>${de ? "Abwesend" : "Absences"}</span></div></div></div>`;
}

function weatherCard() {
  const de = state.lang === "de";
  const days = de ? ["Heute", "Mo", "Di", "Mi"] : ["Today", "Mon", "Tue", "Wed"];
  const temps = [[8, "sun"], [6, "moon"], [10, "sun"], [4, "alert"]];
  return `<div class="card"><div class="card-head"><span class="ttl">${de ? "Wetter" : "Weather"}</span><span class="text-3" style="font-size:var(--t-sm)">Frankfurt</span></div>
    <div class="card-body"><div class="flex between items-center" style="margin-bottom:16px"><div><div class="num" style="font-size:var(--t-4xl);font-weight:800;line-height:1">8°</div><div class="text-2" style="font-size:var(--t-sm);margin-top:4px">${de ? "Leicht bewölkt" : "Partly cloudy"}</div></div><div style="color:var(--brand-500)">${ic("sun")}</div></div>
    <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:8px">${days.map((d, i) => `<div style="text-align:center;padding:10px 4px;background:var(--surface-2);border-radius:10px"><div style="font-size:11px;color:var(--text-3);font-weight:600;margin-bottom:6px">${d}</div><div style="color:var(--brand-500);display:grid;place-items:center;margin-bottom:4px">${ic(temps[i][1])}</div><div class="num" style="font-weight:700;font-size:var(--t-sm)">${temps[i][0]}°</div></div>`).join("")}</div>
    <div class="flex items-center gap-4 mt-4" style="font-size:var(--t-sm);color:var(--text-2)"><span>${de ? "Luftf." : "Humidity"} 72%</span><span>${de ? "Wind" : "Wind"} 14 km/h</span></div></div></div>`;
}

/* ── hours chart ── */
function drawHoursChart(period) {
  const bars = document.getElementById("hours-bars"); if (!bars) return;
  const de = state.lang === "de";
  const sets = {
    week: { labels: de ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], vals: [38, 42, 40, 44, 36, 12, 0], max: 44 },
    month: { labels: ["KW1", "KW2", "KW3", "KW4"], vals: [186, 204, 192, 210], max: 210 },
    year: { labels: de ? ["Q1", "Q2", "Q3", "Q4"] : ["Q1", "Q2", "Q3", "Q4"], vals: [2280, 2410, 2180, 2350], max: 2410 },
  };
  const s = sets[period] || sets.week;
  bars.innerHTML = s.labels.map((lb, i) => `<div class="bar-col"><div class="bar-val num">${s.vals[i]}h</div><div class="bar" data-h="${Math.round(s.vals[i] / s.max * 100)}" style="height:0"></div><div class="bar-lbl">${lb}</div></div>`).join("");
  requestAnimationFrame(() => bars.querySelectorAll(".bar").forEach((b) => (b.style.height = b.dataset.h + "%")));
}
