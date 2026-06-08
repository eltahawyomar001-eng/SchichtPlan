/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens
   ═══════════════════════════════════════════════════════════════ */
const SCREENS = {};
const SCREEN_INIT = {};

/* shared helpers */
function statusBadge(st) {
  const map = {
    scheduled: ["blue", "shift.scheduled"], confirmed: ["emerald", "shift.confirmed"],
    inProgress: ["amber", "shift.inProgress"], completed: ["gray", "shift.completed"],
  };
  const [cls, key] = map[st] || ["gray", "shift.scheduled"];
  return `<span class="badge ${cls}"><span class="pip"></span>${t(key)}</span>`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t("dash.greetingAM") : h < 18 ? t("dash.greetingPM") : t("dash.greetingEve");
}

/* week shift dataset (Mon..Sun), keyed by day index */
const WEEK_SHIFTS = {
  0: [
    { id: "s01", emp: TEAM[0], start: "08:00", end: "16:00", loc: "Amazon-Fra3", st: "confirmed" },
    { id: "s02", emp: TEAM[1], start: "14:00", end: "22:00", loc: "Amazon-Fra3", st: "scheduled" },
  ],
  1: [
    { id: "s03", emp: TEAM[3], start: "06:00", end: "14:00", loc: "Amazon-Fra3", st: "confirmed" },
    { id: "s04", emp: TEAM[2], start: "09:00", end: "17:00", loc: "DHL-Hub Köln", st: "scheduled" },
  ],
  2: [
    { id: "s05", emp: TEAM[0], start: "08:00", end: "16:00", loc: "Amazon-Fra3", st: "inProgress" },
    { id: "s06", emp: TEAM[4], start: "10:00", end: "18:00", loc: "DHL-Hub Köln", st: "confirmed" },
    { id: "s07", emp: null, start: "16:00", end: "00:00", loc: "Amazon-Fra3", st: "open" },
    { id: "s08", emp: TEAM[5], start: "12:00", end: "20:00", loc: "Zalando-Erfurt", st: "scheduled" },
  ],
  3: [
    { id: "s09", emp: TEAM[1], start: "08:00", end: "16:00", loc: "Amazon-Fra3", st: "scheduled" },
    { id: "s10", emp: TEAM[3], start: "14:00", end: "22:00", loc: "Amazon-Fra3", st: "scheduled" },
  ],
  4: [
    { id: "s11", emp: TEAM[2], start: "06:00", end: "14:00", loc: "DHL-Hub Köln", st: "confirmed" },
    { id: "s12", emp: null, start: "14:00", end: "22:00", loc: "DHL-Hub Köln", st: "open" },
  ],
  5: [{ id: "s13", emp: TEAM[5], start: "10:00", end: "18:00", loc: "Zalando-Erfurt", st: "scheduled" }],
  6: [],
};


/* ════════════════════════════════════════════
   SHIFT PLAN
   ════════════════════════════════════════════ */
const DAY_NAMES = { en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] };

function shiftCardHTML(s) {
  const open = !s.emp;
  return `<div class="shift-card ${open ? "shift-open" : ""}" data-shift="${s.id}">
    <div class="shift-accent" style="background:${open ? "var(--warning)" : s.emp.color}"></div>
    <div class="shift-main">
      ${open ? `<div class="dline-ic" style="background:var(--warning-soft);color:var(--warning)">${ic("userPlus")}</div>` : avatar(s.emp)}
      <div class="grow">
        <div class="shift-time num">${s.start} – ${s.end}</div>
        <div class="shift-meta">${open ? `<span style="color:var(--warning);font-weight:650">${t("shift.open")}</span>` : `${s.emp.first} ${s.emp.last}`} <span class="text-3">·</span> ${ic("mapPin")}<span style="display:inline-flex;margin-left:-2px">${s.loc}</span></div>
      </div>
      ${open ? `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();openShiftDetails('${s.id}')">${t("shift.assign")}</button>` : statusBadge(s.st)}
    </div>
  </div>`;
}

SCREENS.shiftPlan = function () {
  state.shiftView = state.shiftView || "week";
  const de = state.lang === "de";
  const names = DAY_NAMES[state.lang] || DAY_NAMES.en;
  const monday = mondayOf(new Date());
  const weekEnd = new Date(monday); weekEnd.setDate(weekEnd.getDate() + 6);
  const isEmp = state.role === "employee";

  // header range label depends on view
  let rangeStr;
  if (state.shiftView === "day") { const d = new Date(monday); d.setDate(d.getDate() + state.day); rangeStr = d.toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" }); }
  else if (state.shiftView === "month") { rangeStr = monday.toLocaleDateString(loc(), { month: "long", year: "numeric" }); }
  else { rangeStr = `${monday.toLocaleDateString(loc(), { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString(loc(), { day: "numeric", month: "short" })}`; }

  const viewModes = [["day", de ? "Tag" : "Day"], ["week", de ? "Woche" : "Week"], ["month", de ? "Monat" : "Month"]];

  return `
  <div class="grid" style="gap:var(--gap-card)">
    <!-- toolbar: view modes + nav + actions -->
    <div class="flex between items-center wrap gap-3">
      <div class="flex items-center gap-3 wrap">
        <div class="segmented" id="sv-mode">${viewModes.map((v) => `<button data-sv="${v[0]}" class="${state.shiftView === v[0] ? "active" : ""}">${v[1]}</button>`).join("")}</div>
        <div class="sched-week" style="margin:0">
          <button class="icon-btn" id="wk-prev">${ic("chevL")}</button>
          <button class="btn btn-ghost btn-sm" id="wk-today">${de ? "Heute" : "Today"}</button>
          <button class="icon-btn" id="wk-next">${ic("chevR")}</button>
        </div>
        <div class="rng num" style="text-transform:capitalize">${rangeStr}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge emerald"><span class="pip"></span>${t("shift.published")}</span>
        ${!isEmp ? `<button class="btn btn-secondary btn-sm" id="publish-btn">${ic("check")}<span class="desktop-only">${de ? "Veröffentlichen" : "Publish"}</span></button>
        <button class="btn btn-primary btn-sm" id="add-shift">${ic("plus")}<span class="desktop-only">${t("shift.addShift")}</span></button>` : ""}
      </div>
    </div>

    ${state.shiftView === "week" ? weekView(monday, names, isEmp) : state.shiftView === "month" ? monthView(monday, de) : dayView(de)}
  </div>`;
};

/* WEEK VIEW — desktop 7-col grid, mobile day-strip + day cards */
function weekView(monday, names, isEmp) {
  const de = state.lang === "de";
  const dows = names.map((n, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return { n, num: d.getDate(), i, count: (WEEK_SHIFTS[i] || []).length, today: i === 2 }; });
  const dayShifts = WEEK_SHIFTS[state.day] || [];
  return `
    <!-- desktop 7-column grid -->
    <div class="week-grid">
      ${dows.map((d) => `
        <div class="week-col ${d.today ? "today" : ""}">
          <div class="week-col-head"><span class="wch-day">${d.n}</span><span class="wch-num num ${d.today ? "today" : ""}">${d.num}</span></div>
          <div class="week-col-body" data-weekday="${d.i}">
            ${(WEEK_SHIFTS[d.i] || []).map((s) => weekChip(s)).join("") || `<div class="week-empty">${!isEmp ? `<button class="week-add" data-addday="${d.i}">${ic("plus")}</button>` : ""}</div>`}
            ${(WEEK_SHIFTS[d.i] || []).length && !isEmp ? `<button class="week-add sm" data-addday="${d.i}">${ic("plus")}</button>` : ""}
          </div>
        </div>`).join("")}
    </div>

    <!-- mobile: day strip + selected day -->
    <div class="week-mobile">
      <div class="card card-pad" style="padding:14px;margin-bottom:var(--gap-card)">
        <div class="daystrip" id="daystrip">
          ${dows.map((d) => `<div class="daycell ${d.i === state.day ? "active" : ""}" data-day="${d.i}"><span class="dn">${d.n}</span><span class="dd num">${d.num}</span>${d.count ? `<span class="ddot"></span>` : `<span style="height:5px"></span>`}</div>`).join("")}
        </div>
      </div>
      <div class="section-title" style="margin-top:4px">${names[state.day]} · ${dayShifts.length} ${state.lang === "de" ? "Schichten" : "shifts"}</div>
      ${dayShifts.length ? dayShifts.map((s) => shiftCardHTML(s)).join("") : `<div class="card"><div class="empty"><div class="empty-ic">${ic("calendar")}</div><h4>${t("shift.noShifts")}</h4><p>${t("shift.noShiftsDesc")}</p></div></div>`}
    </div>
    <style>
      .week-grid{ display:none; grid-template-columns:repeat(7,1fr); gap:1px; background:var(--border); border:1px solid var(--border); border-radius:var(--r-lg); overflow:hidden; }
      .week-mobile{ display:block; }
      .app.wide .week-grid{ display:grid; }
      .app.wide .week-mobile{ display:none; }
      .week-col{ background:var(--surface); min-height:320px; display:flex; flex-direction:column; }
      .week-col.today{ background:var(--success-soft); }
      .week-col-head{ display:flex; flex-direction:column; align-items:center; gap:3px; padding:12px 4px; border-bottom:1px solid var(--border); }
      .wch-day{ font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; }
      .wch-num{ font-size:var(--t-lg); font-weight:750; width:30px; height:30px; display:grid; place-items:center; border-radius:50%; }
      .wch-num.today{ background:var(--brand); color:#fff; }
      .week-col-body{ flex:1; padding:8px; display:flex; flex-direction:column; gap:7px; }
      .week-empty{ flex:1; display:grid; place-items:center; min-height:60px; }
      .week-add{ width:32px; height:32px; border-radius:9px; border:1.5px dashed var(--border-strong); background:transparent; color:var(--text-3); cursor:pointer; display:grid; place-items:center; transition:all var(--d-fast); }
      .week-add.sm{ width:100%; height:28px; border-radius:8px; }
      .week-add:hover{ border-color:var(--brand); color:var(--brand); background:var(--success-soft); }
      .week-add svg{ width:16px; height:16px; }
      .week-chip{ display:flex; flex-direction:column; align-items:flex-start; gap:3px; width:100%; text-align:left; padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); cursor:pointer; transition:all var(--d-fast); box-shadow:var(--sh-xs); overflow:hidden; }
      .week-chip:hover{ box-shadow:var(--sh-sm); transform:translateY(-1px); border-color:var(--border-strong); }
      .wc-time{ font-size:11px; font-weight:750; white-space:nowrap; line-height:1.25; color:var(--text); }
      .wc-emp{ font-size:11px; color:var(--text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; line-height:1.25; }
    </style>`;
}
function weekChip(s) {
  const open = !s.emp;
  const color = open ? "var(--warning)" : s.emp.color;
  return `<button class="week-chip" data-shift="${s.id}" style="border-left:3px solid ${color}">
    <span class="wc-time num">${s.start}–${s.end}</span>
    <span class="wc-emp">${open ? `<span style="color:var(--warning);font-weight:650">${t("shift.open")}</span>` : `${s.emp.first} ${s.emp.last[0]}.`}</span>
  </button>`;
}
/* MONTH VIEW — calendar grid */
function monthView(monday, de) {
  const names = de ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date(); const year = today.getFullYear(), month = today.getMonth();
  const first = new Date(year, month, 1); const startDow = (first.getDay() + 6) % 7; const daysIn = new Date(year, month + 1, 0).getDate();
  const shiftCounts = { 3: 4, 5: 2, 6: 2, 10: 3, 12: 1, 13: 2, 17: 2, 19: 3, 20: 1, 24: 2, 26: 4 };
  let cells = "";
  for (let i = 0; i < startDow; i++) cells += `<div class="mv-cell empty"></div>`;
  for (let d = 1; d <= daysIn; d++) {
    const isToday = d === today.getDate(); const cnt = shiftCounts[d] || 0;
    cells += `<div class="mv-cell ${isToday ? "today" : ""}"><span class="mv-num num">${d}</span>${cnt ? `<div class="mv-shifts">${Array.from({ length: Math.min(cnt, 3) }).map(() => `<span class="mv-bar"></span>`).join("")}${cnt > 3 ? `<span class="mv-more">+${cnt - 3}</span>` : ""}</div>` : ""}</div>`;
  }
  return `<div class="card card-pad">
    <div class="mv-head">${names.map((n) => `<div class="mv-hd">${n}</div>`).join("")}</div>
    <div class="mv-grid">${cells}</div>
  </div>
  <style>
    .mv-head{ display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-bottom:8px; }
    .mv-hd{ text-align:center; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; }
    .mv-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:6px; }
    .mv-cell{ aspect-ratio:1; border:1px solid var(--border); border-radius:var(--r-sm); background:var(--surface-2); padding:7px; display:flex; flex-direction:column; cursor:pointer; transition:all var(--d-fast); }
    .mv-cell:hover{ border-color:var(--border-strong); background:var(--surface-hover); }
    .mv-cell.empty{ border:none; background:transparent; cursor:default; }
    .mv-cell.today{ border-color:var(--brand); background:var(--success-soft); }
    .mv-num{ font-size:var(--t-sm); font-weight:650; }
    .mv-cell.today .mv-num{ color:var(--brand-700); }
    .dark .mv-cell.today .mv-num{ color:var(--brand-300); }
    .mv-shifts{ display:flex; flex-wrap:wrap; gap:3px; margin-top:auto; align-items:center; }
    .mv-bar{ height:5px; width:16px; border-radius:99px; background:var(--brand); }
    .mv-more{ font-size:10px; font-weight:700; color:var(--text-3); }
    @media (max-width:560px){ .mv-cell{ padding:4px; } .mv-bar{ width:10px; } }
  </style>`;
}
/* DAY VIEW — single day list */
function dayView(de) {
  const dayShifts = WEEK_SHIFTS[state.day] || [];
  const names = DAY_NAMES[state.lang] || DAY_NAMES.en;
  return `<div>
    <div class="section-title" style="margin-top:4px">${names[state.day]} · ${dayShifts.length} ${de ? "Schichten" : "shifts"}</div>
    ${dayShifts.length ? dayShifts.map((s) => shiftCardHTML(s)).join("") : `<div class="card"><div class="empty"><div class="empty-ic">${ic("calendar")}</div><h4>${t("shift.noShifts")}</h4><p>${t("shift.noShiftsDesc")}</p></div></div>`}
  </div>`;
}
SCREEN_INIT.shiftPlan = function () {
  const de = state.lang === "de";
  document.querySelectorAll("#sv-mode [data-sv]").forEach((el) => (el.onclick = () => { state.shiftView = el.dataset.sv; mountScreen(); SCREEN_INIT.shiftPlan(); }));
  document.querySelectorAll("#daystrip [data-day]").forEach((el) => { el.onclick = () => { state.day = +el.dataset.day; mountScreen(); SCREEN_INIT.shiftPlan(); }; });
  document.querySelectorAll("#content .shift-card, #content .week-chip").forEach((el) => { el.onclick = () => openShiftDetails(el.dataset.shift); });
  document.querySelectorAll("#content [data-addday]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); state.day = +el.dataset.addday; openShiftEdit(null); }));
  const add = $("#add-shift"); if (add) add.onclick = () => openShiftEdit(null);
  const pub = $("#publish-btn"); if (pub) pub.onclick = () => toast(de ? "Schichtplan veröffentlicht · Team benachrichtigt" : "Schedule published · team notified");
  $("#wk-today").onclick = () => { state.day = 2; toast(de ? "Diese Woche" : "This week"); };
  $("#wk-prev").onclick = $("#wk-next").onclick = () => toast(de ? "Demo: ein Zeitraum" : "Demo: one period");
};

/* ── Shift Details sheet ── */
function findShift(id) { for (const k in WEEK_SHIFTS) { const f = WEEK_SHIFTS[k].find((s) => s.id === id); if (f) return f; } return null; }

function openShiftDetails(id) {
  const s = findShift(id); if (!s) return;
  const open = !s.emp;
  const dateStr = (() => { const m = mondayOf(new Date()); m.setDate(m.getDate() + state.day); return m.toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }); })();
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${t("shift.details")}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div style="margin-bottom:8px">${open ? `<span class="badge amber"><span class="pip"></span>${t("shift.open")}</span>` : statusBadge(s.st)}</div>
      <div class="dline"><div class="dline-ic">${ic("clock")}</div><div><div class="lbl">${t("shift.date")}</div><div class="val">${dateStr}</div><div class="val num" style="font-weight:700;margin-top:2px">${s.start} – ${s.end}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("user")}</div><div><div class="lbl">${t("shift.employee")}</div><div class="val">${open ? `<span style="color:var(--warning)">${t("shift.open")}</span>` : `${s.emp.first} ${s.emp.last}`}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("mapPin")}</div><div><div class="lbl">${t("shift.location")}</div><div class="val">${s.loc}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("coffee")}</div><div><div class="lbl">${t("shift.break")}</div><div class="val num">30 min</div></div></div>
    </div>
    <div class="sheet-foot" style="flex-direction:column">
      <div class="flex gap-3" style="width:100%">
        <button class="btn btn-secondary grow" onclick="closeSheet();setTimeout(()=>openShiftEdit('${s.id}'),220)">${ic("edit")}${t("shift.edit")}</button>
        <button class="btn btn-secondary grow" data-close>${ic(open ? "userPlus" : "swap")}${open ? t("shift.assign") : t("shift.unassign")}</button>
      </div>
      <button class="btn btn-danger btn-block" data-close>${ic("trash")}${t("shift.delete")}</button>
    </div>`);
}
window.openShiftDetails = openShiftDetails;

/* ── Shift Edit sheet ── */
function openShiftEdit(id) {
  const s = id ? findShift(id) : null;
  const isNew = !s;
  const empOpts = TEAM.map((e) => `<option ${s && s.emp && s.emp.id === e.id ? "selected" : ""}>${e.first} ${e.last}</option>`).join("");
  const locs = ["Amazon-Fra3", "DHL-Hub Köln", "Zalando-Erfurt"].map((l) => `<option ${s && s.loc === l ? "selected" : ""}>${l}</option>`).join("");
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${isNew ? t("shift.addShift") : t("shift.edit")}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="field"><label>${t("shift.employee")}</label><select class="select">${isNew ? `<option value="">${t("shift.open")}</option>` : ""}${empOpts}</select></div>
      <div class="field-row">
        <div class="field"><label>${t("shift.startTime")}</label><input class="input" type="time" value="${s ? s.start : "08:00"}"></div>
        <div class="field"><label>${t("shift.endTime")}</label><input class="input" type="time" value="${s ? s.end : "16:00"}"></div>
      </div>
      <div class="field"><label>${t("shift.location")}</label><select class="select">${locs}</select></div>
      <div class="field-row">
        <div class="field"><label>${t("shift.break")} (min)</label><input class="input num" type="number" value="30"></div>
        <div class="field"><label>${t("c.month")}</label><select class="select"><option>${t("shift.scheduled")}</option><option>${t("shift.confirmed")}</option></select></div>
      </div>
      <div class="field" style="margin-bottom:0"><label>${t("shift.notes")}</label><input class="input" placeholder="${state.lang === "de" ? "Optionale Notiz…" : "Optional note…"}"></div>
    </div>
    <div class="sheet-foot">
      <button class="btn btn-ghost grow" data-close>${t("c.cancel")}</button>
      <button class="btn btn-primary grow" data-close onclick="toast('${state.lang === "de" ? "Gespeichert" : "Saved"}')">${ic("check")}${t("shift.save")}</button>
    </div>`);
}
window.openShiftEdit = openShiftEdit;

/* utils */
function mondayOf(d) { const x = new Date(d); const dow = x.getDay(); const off = dow === 0 ? -6 : 1 - dow; x.setDate(x.getDate() + off); x.setHours(0, 0, 0, 0); return x; }
function loc() { return state.lang === "de" ? "de-DE" : "en-GB"; }
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%) translateY(10px);background:var(--n-900);color:#fff;padding:11px 18px;border-radius:99px;font-size:14px;font-weight:600;z-index:200;box-shadow:var(--sh-lg);opacity:0;transition:all .3s var(--e-out)";
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(10px)"; }, 1900);
}
window.toast = toast;
