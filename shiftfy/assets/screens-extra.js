/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens · Punch Clock, Reports, placeholders
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   PUNCH CLOCK
   ════════════════════════════════════════════ */
SCREENS.stempeluhr = function () {
  const isIn = state.punch !== "out";
  const onBreak = state.punch === "break";
  const recent = state.lang === "de" ? [
    { d: "Heute", in: "08:00", out: "—", net: "5:12", live: true },
    { d: "Gestern", in: "08:02", out: "16:31", net: "8:02" },
    { d: "Mi, 1. März", in: "06:00", out: "14:05", net: "7:35" },
  ] : [
    { d: "Today", in: "08:00", out: "—", net: "5:12", live: true },
    { d: "Yesterday", in: "08:02", out: "16:31", net: "8:02" },
    { d: "Wed, Mar 1", in: "06:00", out: "14:05", net: "7:35" },
  ];

  const label = onBreak ? t("punch.endBreak") : isIn ? t("punch.clockOut") : t("punch.clockIn");
  const icon = onBreak ? "coffee" : isIn ? "logOut" : "stopwatch";

  return `
  <div class="grid punch-cols" style="gap:var(--gap-card);grid-template-columns:1fr">
    <div class="card card-pad" style="text-align:center">
      <div style="margin-bottom:6px">
        ${isIn
          ? `<span class="badge emerald"><span class="pip"></span>${t("punch.working")} · ${t("punch.location")} Amazon-Fra3</span>`
          : `<span class="badge gray">${t("punch.notClocked")}</span>`}
      </div>
      <div class="clock-face">
        <div class="clock-time num" id="clk"><span id="clk-hm">00:00</span><span class="sec" id="clk-s">:00</span></div>
        <div class="clock-date">${new Date().toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>
      <button class="punch-btn ${isIn && !onBreak ? "out" : ""}" id="punch" style="${onBreak ? "background:radial-gradient(circle at 50% 35%, var(--brand-400), var(--brand-600) 70%)" : ""}">
        ${isIn ? `<span class="punch-ring"></span>` : ""}
        <span class="pb-ic">${ic(icon)}</span>
        <span class="pb-label">${label}</span>
      </button>
      ${isIn ? `<button class="btn btn-secondary btn-sm" id="break-btn" style="margin-top:14px">${ic("coffee")}${onBreak ? t("punch.endBreak") : t("punch.onBreak")}</button>` : ""}

      ${onBreak ? `
      <!-- break countdown (ArbZG §4) -->
      <div class="punch-break" style="margin-top:18px">
        <div class="flex between items-center" style="margin-bottom:7px"><span class="kpi-label">${state.lang === "de" ? "Pause" : "Break"}</span><span class="num" style="font-weight:750;color:var(--warning)" id="brk-remain">${state.lang === "de" ? "12 Min verbleibend" : "12 min remaining"}</span></div>
        <div class="track" style="height:8px"><i style="width:60%;background:var(--warning)"></i></div>
        <div class="text-3" style="font-size:12px;margin-top:6px">${state.lang === "de" ? "Ziel 30 Min · seit 13:20" : "Target 30 min · since 13:20"}</div>
      </div>` : ""}

      ${isIn && !onBreak ? `
      <!-- ArbZG daily limit progress -->
      <div class="punch-arbzg" style="margin-top:18px">
        <div class="flex between items-center" style="margin-bottom:7px"><span class="kpi-label">${state.lang === "de" ? "Heute gearbeitet (ArbZG)" : "Worked today (ArbZG)"}</span><span class="num" style="font-weight:750">5h 12m / 10h</span></div>
        <div class="track" style="height:8px"><i style="width:52%;background:var(--brand)"></i></div>
        <div class="text-3" style="font-size:12px;margin-top:6px">${state.lang === "de" ? "Noch 4h 48m bis zur Tageshöchstgrenze" : "4h 48m remaining until daily limit"}</div>
      </div>` : ""}
    </div>

    <div class="grid" style="gap:var(--gap-card)">
      <!-- today stats -->
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="kpi"><div class="kpi-label">${t("punch.todayTotal")}</div><div class="kpi-val num">5<small>:12</small></div><div class="kpi-trend up">${ic("trendUp")}${t("punch.target")} 8:00</div></div>
        <div class="kpi"><div class="kpi-label">${t("punch.thisWeek")}</div><div class="kpi-val num">33<small>:48</small></div><div class="text-3" style="font-size:12px;margin-top:8px;font-weight:600">${t("punch.target")} 40:00</div></div>
      </div>

      <!-- project / location selectors -->
      <div class="card card-pad">
        <div class="field"><label>${t("punch.location")}</label><select class="select"><option>Amazon-Fra3</option><option>DHL-Hub Köln</option><option>Zalando-Erfurt</option></select></div>
        <div class="field" style="margin-bottom:0"><label>${t("punch.project")}</label><select class="select"><option>${t("punch.selectProject")}</option><option>Inbound Q1</option><option>Peak-Support</option></select></div>
      </div>

      <!-- recent entries -->
      <div class="card">
        <div class="card-head"><span class="ttl">${t("punch.recentEntries")}</span></div>
        <div class="card-body" style="padding-top:8px">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="text-align:left">
              <th style="padding:8px 0;font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">${t("shift.date")}</th>
              <th style="padding:8px 0;font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">${t("punch.clockIn")}</th>
              <th style="padding:8px 0;font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">${t("punch.clockOut")}</th>
              <th style="padding:8px 0;font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;text-align:right">${t("c.hrs")}</th>
            </tr></thead>
            <tbody>
              ${recent.map((r) => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:13px 0;font-size:var(--t-base);font-weight:600">${r.live ? `<span class="live-dot" style="display:inline-block;vertical-align:middle;margin-right:7px"></span>` : ""}${r.d}</td>
                <td style="padding:13px 0" class="num text-2">${r.in}</td>
                <td style="padding:13px 0" class="num text-2">${r.out}</td>
                <td style="padding:13px 0;text-align:right;font-weight:700" class="num">${r.net}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <style>@media (min-width:1024px){ .app.wide .punch-cols{ grid-template-columns:380px 1fr; align-items:start; } }</style>
  ${state.role !== "employee" ? `
  <div class="card" style="margin-top:var(--gap-card)">
    <div class="card-head"><div class="flex items-center gap-2"><span class="live-dot"></span><span class="ttl">${state.lang === "de" ? "Team-Status" : "Team status"}</span></div><span class="badge emerald act">2 ${state.lang === "de" ? "im Dienst" : "working"} · 1 ${state.lang === "de" ? "Pause" : "break"}</span></div>
    <div class="card-body" style="padding-top:10px">
      ${[[TEAM[0], "working", "08:00", "5h 12m"], [TEAM[4], "working", "10:00", "3h 04m"], [TEAM[2], "break", "06:00", "—"]].map(([e, st, since, dur]) => `<div class="irow">${avatar(e, "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}</div><div class="r-sub">${e.loc} · ${state.lang === "de" ? "seit" : "since"} ${since}</div></div>${st === "working" ? `<span class="badge emerald"><span class="pip"></span>${dur}</span>` : `<span class="badge amber">${ic("coffee")}${state.lang === "de" ? "Pause" : "Break"}</span>`}</div>`).join("")}
    </div>
  </div>` : ""}`;
};
SCREEN_INIT.stempeluhr = function () {
  const tick = () => {
    const now = new Date();
    const hm = $("#clk-hm"), s = $("#clk-s");
    if (!hm) { clearInterval(window._clk); return; }
    hm.textContent = now.toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", hour12: false });
    s.textContent = ":" + String(now.getSeconds()).padStart(2, "0");
  };
  clearInterval(window._clk); tick(); window._clk = setInterval(tick, 1000);

  $("#punch").onclick = () => {
    if (state.punch === "out") { state.punch = "in"; toast(t("punch.clockIn")); }
    else { state.punch = "out"; toast(t("punch.clockOut")); }
    mountScreen(); SCREEN_INIT.stempeluhr();
  };
  const bb = $("#break-btn");
  if (bb) bb.onclick = () => {
    state.punch = state.punch === "break" ? "in" : "break";
    toast(state.punch === "break" ? t("punch.onBreak") : t("punch.endBreak"));
    mountScreen(); SCREEN_INIT.stempeluhr();
  };
};

/* ════════════════════════════════════════════
   REPORTS (Berichte) — mirrors real /berichte
   ════════════════════════════════════════════ */
function repDonut(segments, size){ size=size||120; const r=size/2-10; const c=2*Math.PI*r; let off=0; const total=segments.reduce((a,x)=>a+x.v,0)||1; const circ=segments.map(seg=>{ const frac=seg.v/total; const dash=c*frac; const el='<circle cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+r+'" fill="none" stroke="'+seg.c+'" stroke-width="14" stroke-dasharray="'+dash+' '+(c-dash)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+(size/2)+' '+(size/2)+')"/>'; off+=dash; return el; }).join(""); return '<svg viewBox="0 0 '+size+' '+size+'" style="width:'+size+'px;height:'+size+'px">'+circ+'</svg>'; }

SCREENS.reports = function () {
  const de = state.lang === "de";
  const empHours = [
    { e: TEAM[0], planned: 168, actual: 172, shifts: 21 },
    { e: TEAM[1], planned: 128, actual: 124, shifts: 16 },
    { e: TEAM[3], planned: 120, actual: 120, shifts: 15 },
    { e: TEAM[4], planned: 168, actual: 176, shifts: 21 },
    { e: TEAM[2], planned: 160, actual: 152, shifts: 19 },
    { e: TEAM[5], planned: 80, actual: 78, shifts: 10 },
  ];
  const maxH = 176;
  const kpis = [
    { ic: "calendar", cls: "", label: de ? "Schichten gesamt" : "Total shifts", val: "102" },
    { ic: "clock", cls: "blue", label: de ? "Stunden gesamt" : "Total hours", val: "822", suf: "h" },
    { ic: "userPlus", cls: "amber", label: de ? "Offene Schichten" : "Open shifts", val: "3", warn: true },
    { ic: "users", cls: "", label: de ? "Ø Std/Mitarbeiter" : "Avg hrs/employee", val: "137", suf: "h" },
  ];
  const tt = [
    { label: de ? "Erfasste Stunden" : "Tracked hours", val: "806 h" },
    { label: de ? "Pausenzeit" : "Break hours", val: "63 h" },
    { label: de ? "Live-Stempelungen" : "Live clock entries", val: "418" },
  ];
  const shiftBreak = [
    { name: de ? "Nachtschichten" : "Night shifts", v: 18, c: "#6366f1" },
    { name: de ? "Sonntagsschichten" : "Sunday shifts", v: 9, c: "#d97706" },
    { name: de ? "Feiertagsschichten" : "Holiday shifts", v: 4, c: "#dc2626" },
    { name: de ? "Reguläre" : "Regular", v: 71, c: "#059669" },
  ];
  const entryStatus = [
    { name: de ? "Genehmigt" : "Approved", v: 386, c: "#059669" },
    { name: de ? "Offen" : "Pending", v: 24, c: "#d97706" },
    { name: de ? "Abgelehnt" : "Rejected", v: 8, c: "#dc2626" },
  ];
  const absCat = [
    { name: de ? "Urlaub" : "Vacation", v: 14, c: "#059669" },
    { name: de ? "Krankheit" : "Sick", v: 6, c: "#dc2626" },
    { name: de ? "Sonderurlaub" : "Special leave", v: 2, c: "#2563eb" },
    { name: de ? "Elternzeit" : "Parental", v: 1, c: "#7c3aed" },
  ];
  const presets = [[de ? "Diese Woche" : "This week", false], [de ? "Dieser Monat" : "This month", true], [de ? "Letzter Monat" : "Last month", false], [de ? "Letzte 3 Monate" : "Last 3 months", false]];
  const legend = (segs) => segs.map((x) => `<div class="flex items-center gap-2" style="font-size:var(--t-sm)"><span style="width:10px;height:10px;border-radius:3px;background:${x.c}"></span><span class="grow">${x.name}</span><span class="num text-2" style="font-weight:700">${x.v}</span></div>`).join("");

  return `
  <div class="grid" style="gap:var(--gap-card)">
    <!-- range + export -->
    <div class="card card-pad">
      <div class="flex between items-center wrap gap-4">
        <div class="segmented" id="rep-preset">${presets.map((p) => `<button class="${p[1] ? "active" : ""}">${p[0]}</button>`).join("")}</div>
        <div class="flex items-center gap-2 wrap">
          <div class="field" style="margin:0"><input class="input" type="date" value="2026-05-01" style="width:150px"></div>
          <span class="text-3">–</span>
          <div class="field" style="margin:0"><input class="input" type="date" value="2026-05-31" style="width:150px"></div>
        </div>
      </div>
      <div class="flex items-center gap-2 wrap" style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
        <span class="text-3" style="font-size:12px;font-weight:600">${de ? "Exportieren" : "Export"}:</span>
        <button class="btn btn-secondary btn-sm" onclick="toast('Excel')">${ic("download")}Excel</button>
        <button class="btn btn-secondary btn-sm" onclick="toast('CSV')">${ic("download")}CSV</button>
        <button class="btn btn-secondary btn-sm" onclick="toast('PDF')">${ic("download")}PDF</button>
        <button class="btn btn-primary btn-sm" onclick="toast('DATEV')">${ic("fileDown")}DATEV</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid" id="rep-kpi" style="grid-template-columns:repeat(2,1fr)">
      ${kpis.map((k) => `<div class="kpi"><div class="kpi-top"><div class="kpi-ic ${k.cls}">${ic(k.ic)}</div></div><div class="kpi-label">${k.label}</div><div class="kpi-val num ${k.warn ? "warn" : ""}">${k.val}${k.suf ? `<small>${k.suf}</small>` : ""}</div></div>`).join("")}
    </div>

    <!-- time tracking sub-stats -->
    <div>
      <div class="section-title" style="margin-top:4px">${de ? "Zeiterfassung" : "Time tracking"}</div>
      <div class="grid" id="rep-tt" style="grid-template-columns:repeat(3,1fr);gap:var(--gap-card)">
        ${tt.map((x) => `<div class="card card-pad"><div class="kpi-label">${x.label}</div><div class="num" style="font-size:var(--t-2xl);font-weight:800;margin-top:6px">${x.val}</div></div>`).join("")}
      </div>
    </div>

    <!-- employee hours chart -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Stunden pro Mitarbeiter" : "Hours per employee"}</span></div>
      <div class="card-body"><div class="bars">
        ${empHours.map((b) => `<div class="bar-col"><div class="bar-val num">${b.actual}h</div><div class="bar" style="height:0" data-h="${Math.round(b.actual / maxH * 100)}"></div><div class="bar-lbl">${b.e.first}</div></div>`).join("")}
      </div></div>
    </div>

    <!-- donut row: shift breakdown + entry status + absences -->
    <div class="grid rep-donuts">
      <div class="card"><div class="card-head"><span class="ttl">${de ? "Schichten gesamt" : "Total shifts"}</span></div><div class="card-body"><div class="flex items-center gap-4 wrap" style="justify-content:center"><div style="position:relative">${repDonut(shiftBreak)}</div><div class="grid" style="gap:9px;flex:1;min-width:140px">${legend(shiftBreak)}</div></div></div></div>
      <div class="card"><div class="card-head"><span class="ttl">${de ? "Eintrags-Status" : "Entry status"}</span></div><div class="card-body"><div class="flex items-center gap-4 wrap" style="justify-content:center"><div>${repDonut(entryStatus)}</div><div class="grid" style="gap:9px;flex:1;min-width:140px">${legend(entryStatus)}</div></div></div></div>
      <div class="card"><div class="card-head"><span class="ttl">${de ? "Abwesenheiten nach Kategorie" : "Absences by category"}</span></div><div class="card-body"><div class="flex items-center gap-4 wrap" style="justify-content:center"><div>${repDonut(absCat)}</div><div class="grid" style="gap:9px;flex:1;min-width:140px">${legend(absCat)}</div></div></div></div>
    </div>

    <!-- planned vs actual -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Soll vs. Ist" : "Planned vs actual"}</span>
        <div class="flex items-center gap-3 act" style="font-size:var(--t-sm)"><span class="flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:var(--border-strong)"></span>${de ? "Soll" : "Planned"}</span><span class="flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:var(--brand)"></span>${de ? "Ist" : "Actual"}</span></div>
      </div>
      <div class="card-body" style="padding-top:14px">
        ${empHours.map((b) => `<div style="margin-bottom:14px"><div class="flex between items-center" style="margin-bottom:6px"><span style="font-weight:650;font-size:var(--t-sm)">${b.e.first} ${b.e.last}</span><span class="num text-2" style="font-weight:700;font-size:var(--t-sm)">${b.actual} / ${b.planned} h</span></div><div style="position:relative;height:10px;background:var(--surface-2);border-radius:99px"><div style="position:absolute;inset:0;width:${b.planned / maxH * 100}%;background:var(--border-strong);border-radius:99px"></div><div class="pva-bar" data-w="${b.actual / maxH * 100}" style="position:absolute;inset:0;width:0;background:${b.actual >= b.planned ? "var(--brand)" : "var(--warning)"};border-radius:99px;transition:width .6s var(--e-out)"></div></div></div>`).join("")}
      </div>
    </div>

    <!-- employee hours table -->
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Stunden pro Mitarbeiter" : "Employee hours"}</span></div>
      <div class="card-body" style="padding-top:8px"><div style="overflow-x:auto"><table class="rep-table">
        <thead><tr><th style="text-align:left">${de ? "Mitarbeiter" : "Employee"}</th><th>${de ? "Soll" : "Planned"}</th><th>${de ? "Ist" : "Actual"}</th><th>${de ? "Diff" : "Diff"}</th><th>${de ? "Schichten" : "Shifts"}</th></tr></thead>
        <tbody>${empHours.map((b) => { const diff = b.actual - b.planned; return `<tr><td style="text-align:left"><div class="flex items-center gap-2">${avatar(b.e, "sm")}<span style="font-weight:600;font-size:var(--t-sm);white-space:nowrap">${b.e.first} ${b.e.last}</span></div></td><td class="num">${b.planned}h</td><td class="num" style="font-weight:700">${b.actual}h</td><td class="num" style="color:${diff >= 0 ? "var(--success)" : "var(--danger)"}">${diff >= 0 ? "+" : ""}${diff}h</td><td class="num">${b.shifts}</td></tr>`; }).join("")}</tbody>
      </table></div></div>
    </div>
  </div>
  <style>
    @media (min-width:1024px){ .app.wide #rep-kpi{ grid-template-columns:repeat(4,1fr); } }
    .rep-donuts{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .rep-donuts{ grid-template-columns:repeat(3,1fr); } }
    @media (max-width:560px){ #rep-tt{ grid-template-columns:1fr !important; } }
    .rep-table{ width:100%; border-collapse:collapse; min-width:480px; }
    .rep-table th{ font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:center; }
    .rep-table td{ padding:12px;text-align:center;border-top:1px solid var(--border); }
  </style>`;
};
SCREEN_INIT.reports = function () {
  requestAnimationFrame(() => {
    document.querySelectorAll("#content .bar").forEach((b) => { b.style.height = b.dataset.h + "%"; });
    document.querySelectorAll("#content .pva-bar").forEach((i) => { i.style.width = i.dataset.w + "%"; });
  });
  segmentedBind("#rep-preset");
};

/* ════════════════════════════════════════════
   PLACEHOLDER (secondary routes — show the system applied)
   ════════════════════════════════════════════ */
SCREENS.__placeholder = function () {
  const navItem = NAV.find((n) => n.id === state.view) || { icon: "sparkle", label: "nav." + state.view };
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:16px">
      <div class="kpi-ic" style="width:48px;height:48px">${ic(navItem.icon)}</div>
      <div class="grow">
        <div style="font-size:var(--t-xl);font-weight:800;letter-spacing:-.025em">${t(navItem.label)}</div>
        <div class="text-2" style="font-size:var(--t-sm);margin-top:3px">${state.lang === "de" ? "Dieser Bereich übernimmt dasselbe Premium-System — Karten, Abstände, Typografie und beide Themes." : "This section inherits the same premium system — cards, spacing, type and both themes."}</div>
      </div>
      <span class="badge emerald desktop-only"><span class="pip"></span>${state.lang === "de" ? "Im System" : "On-system"}</span>
    </div>

    <div class="grid" style="grid-template-columns:repeat(2,1fr)">
      ${[0, 1, 2, 3].map(() => `<div class="kpi"><div class="kpi-top"><div class="kpi-ic">${ic("sparkle")}</div></div><div class="skel" style="height:11px;width:60%;margin-bottom:10px"></div><div class="skel" style="height:26px;width:42%"></div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${t(navItem.label)}</span><span class="badge gray act">${state.lang === "de" ? "Vorschau" : "Preview"}</span></div>
      <div class="card-body">
        ${TEAM.slice(0, 4).map((e) => `<div class="irow">${avatar(e)}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}</div><div class="r-sub">${e.loc}</div></div><span class="badge ${e.role === "Manager" ? "emerald" : "gray"}">${e.role}</span></div>`).join("")}
      </div>
    </div>

    <div class="empty card" style="padding:32px 20px">
      <div class="empty-ic">${ic(navItem.icon)}</div>
      <h4>${state.lang === "de" ? "Vollständiges Layout in Arbeit" : "Full layout in progress"}</h4>
      <p>${state.lang === "de" ? "Im nächsten Durchgang erweitern wir diesen Screen mit dem festgelegten System." : "We expand this screen with the locked system in the next pass."}</p>
    </div>
  </div>`;
};

/* map all soft nav ids to placeholder — done in app.js once NAV exists */
