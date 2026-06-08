/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — App shell, state, routing, global toggles
   ═══════════════════════════════════════════════════════════════ */

const state = {
  lang: localStorage.getItem("sf_lang") || "en",
  theme: localStorage.getItem("sf_theme") || "light",
  view: localStorage.getItem("sf_view") || "dashboard",
  wide: (localStorage.getItem("sf_wide") || "desktop") === "desktop",
  role: localStorage.getItem("sf_role") || "manager",
  day: 2,            // active day index in shift plan (0=Mon)
  punch: "out",      // out | in | break
  punchStart: null,
};

const t = (k) => (I18N[state.lang] && I18N[state.lang][k]) || (I18N.en[k]) || k;
const ic = (n) => Icons[n] || "";
const $ = (s, r = document) => r.querySelector(s);

function avatar(emp, cls = "") {
  const initials = (emp.first[0] + (emp.last[0] || "")).toUpperCase();
  return `<div class="avatar ${cls}" style="background:${emp.color}">${initials}</div>`;
}

/* ── Navigation model — mirrors the real Shiftfy sidebar (navGroups) exactly ──
   roles omitted = visible to everyone (incl. EMPLOYEE); otherwise gated. ── */
const MGMT = ["OWNER", "ADMIN", "MANAGER"];
const ALL_ROLES = ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"];
const ADMIN_ONLY = ["OWNER", "ADMIN"];
const NAV = [
  // Main
  { id: "dashboard", icon: "grid", label: "nav.dashboard", group: null },
  { id: "shiftPlan", icon: "calendar", label: "nav.shiftPlan", group: null },
  { id: "sos", icon: "alert", label: "nav.sos", group: null, roles: MGMT },
  { id: "zeiterfassung", icon: "clock", label: "nav.timeTracking", group: null },
  { id: "absences", icon: "calOff", label: "nav.absences", group: null },
  { id: "shiftSwap", icon: "swap", label: "nav.shiftSwap", group: null },
  { id: "stempeluhr", icon: "stopwatch", label: "nav.punchClock", group: null },
  { id: "leistungsnachweis", icon: "fileCheck", label: "nav.serviceProof", group: null },
  { id: "tickets", icon: "ticket", label: "nav.tickets", group: null },
  { id: "teamCalendar", icon: "calendarUsers", label: "nav.teamCalendar", group: null, roles: MGMT },
  { id: "jahresplanung", icon: "calRange", label: "nav.annualPlanning", group: null, roles: MGMT },
  // Management
  { id: "employees", icon: "users", label: "nav.employees", group: "grp.management", roles: MGMT },
  { id: "departments", icon: "layers", label: "nav.departments", group: "grp.management", roles: MGMT },
  { id: "skills", icon: "award", label: "nav.skills", group: "grp.management", roles: MGMT },
  { id: "locations", icon: "mapPin", label: "nav.locations", group: "grp.management", roles: MGMT },
  { id: "compliance", icon: "shield", label: "nav.compliance", group: "grp.management", roles: MGMT },
  { id: "pruefungssicher", icon: "fileCheck", label: "nav.pruefungssicher", group: "grp.management", roles: MGMT },
  { id: "betriebsrat", icon: "scale", label: "nav.betriebsrat", group: "grp.management", roles: MGMT },
  { id: "shiftTemplates", icon: "template", label: "nav.shiftTemplates", group: "grp.management", roles: MGMT },
  { id: "projects", icon: "folder", label: "nav.projects", group: "grp.management", roles: MGMT },
  { id: "clients", icon: "briefcase", label: "nav.clients", group: "grp.management", roles: MGMT },
  // Tracking & Reports
  { id: "vacationBalance", icon: "palm", label: "nav.vacationBalance", group: "grp.trackingReports", roles: ALL_ROLES },
  { id: "timeAccounts", icon: "scale", label: "nav.timeAccounts", group: "grp.trackingReports", roles: MGMT },
  { id: "reports", icon: "chart", label: "nav.reports", group: "grp.trackingReports", roles: MGMT },
  { id: "payrollExport", icon: "fileDown", label: "nav.payrollExport", group: "grp.trackingReports", roles: ADMIN_ONLY },
  { id: "dataIO", icon: "database", label: "nav.dataIO", group: "grp.trackingReports", roles: ADMIN_ONLY },
  { id: "holidays", icon: "flag", label: "nav.holidays", group: "grp.trackingReports" },
  { id: "automationRules", icon: "bolt", label: "nav.automationRules", group: "grp.trackingReports", roles: ADMIN_ONLY },
  // Developer
  { id: "webhooks", icon: "link", label: "nav.webhooks", group: "grp.developer", roles: ADMIN_ONLY },
  // Settings
  { id: "settings", icon: "gear", label: "nav.settings", group: "grp.account" },
  { id: "billing", icon: "card", label: "nav.billing", group: "grp.account", roles: ADMIN_ONLY },
  { id: "roles", icon: "shield", label: "nav.roles", group: "grp.account", roles: ADMIN_ONLY },
];
function roleCode() { return state.role === "employee" ? "EMPLOYEE" : "MANAGER"; }
function canSee(item) { return !item.roles || item.roles.includes(roleCode()); }
function visibleNav() { return NAV.filter(canSee); }
const PRIMARY = ["dashboard", "shiftPlan", "zeiterfassung", "stempeluhr"];
function primaryTabs() { return state.role === "employee" ? ["dashboard", "shiftPlan", "stempeluhr", "absences"] : PRIMARY; }
const BADGES = { shiftPlan: 1, absences: 1, tickets: 2 };
const ME = TEAM[0];

/* map secondary routes to the on-system placeholder screen */
NAV.forEach((n) => { if (typeof SCREENS !== "undefined" && !SCREENS[n.id]) SCREENS[n.id] = SCREENS.__placeholder; });

/* ── Screen meta (title/desc) ── */
const META = {
  dashboard: { t: "dash.title", d: "dash.desc" },
  shiftPlan: { t: "shift.title", d: "shift.desc" },
  stempeluhr: { t: "punch.title", d: "punch.desc" },
  reports: { t: "rep.title", d: "rep.desc" },
  zeiterfassung: { t: "nav.timeTracking", d: "meta.zeiterfassung" },
  leistungsnachweis: { t: "nav.serviceProof", d: "meta.leistungsnachweis" },
  jahresplanung: { t: "nav.annualPlanning", d: "meta.jahresplanung" },
  departments: { t: "nav.departments", d: "meta.departments" },
  skills: { t: "nav.skills", d: "meta.skills" },
  compliance: { t: "nav.compliance", d: "meta.compliance" },
  pruefungssicher: { t: "nav.pruefungssicher", d: "meta.pruefungssicher" },
  betriebsrat: { t: "nav.betriebsrat", d: "meta.betriebsrat" },
  absences: { t: "nav.absences", d: "meta.absences" },
  shiftSwap: { t: "nav.shiftSwap", d: "meta.shiftSwap" },
  sos: { t: "nav.sos", d: "meta.sos" },
  tickets: { t: "nav.tickets", d: "meta.tickets" },
  teamCalendar: { t: "nav.teamCalendar", d: "meta.teamCalendar" },
  employees: { t: "nav.employees", d: "meta.employees" },
  employeeDetail: { t: "nav.employees", d: "meta.employees" },
  vacationBalance: { t: "nav.vacationBalance", d: "meta.vacationBalance" },
  timeAccounts: { t: "nav.timeAccounts", d: "meta.timeAccounts" },
};

/* ════════════════════════════════════════════
   Shell render
   ════════════════════════════════════════════ */
function renderShell() {
  const meta = META[state.view] || { t: "nav." + state.view, d: null };
  const app = document.getElementById("app");
  app.className = "app" + (state.wide ? " wide" : "");
  const stage = document.getElementById("stage");
  if (stage) stage.className = "stage" + (state.wide ? "" : " frame-mobile");

  app.innerHTML = `
    ${renderSidebar()}
    <div class="main">
      ${renderTopbar(meta)}
      <main class="content" id="content"></main>
      ${renderTabbar()}
    </div>
    <div class="scrim" id="scrim"></div>
    <div id="sheet-host"></div>
  `;

  document.documentElement.classList.toggle("dark", state.theme === "dark");
  mountScreen();
  bindShell();
  renderDock();
}

/* ── floating viewport dock (preview chrome, not part of product) ── */
function renderDock() {
  let host = document.getElementById("dock-host");
  if (!host) return;
  host.innerHTML = `
    <div class="dock">
      <span class="dock-lbl">View</span>
      <a class="btn btn-ghost btn-sm" href="Shiftfy Website.html" style="text-decoration:none" title="Marketing site">${ic("globe")}<span class="txt">Website</span></a>
      <span class="sep"></span>
      <div class="dock-seg">
        <button data-vp="mobile" class="${!state.wide ? "active" : ""}" title="Mobile">${ic("stopwatch") && '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>'}<span class="txt">Mobile</span></button>
        <button data-vp="desktop" class="${state.wide ? "active" : ""}" title="Desktop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg><span class="txt">Desktop</span></button>
      </div>
    </div>`;
  host.querySelectorAll("[data-vp]").forEach((b) => {
    b.onclick = () => {
      state.wide = b.dataset.vp === "desktop";
      localStorage.setItem("sf_wide", state.wide ? "desktop" : "mobile");
      renderShell();
    };
  });
}

function renderSidebar() {
  let html = `<aside class="sidebar">
    <div class="sb-brand">
      <div class="sb-logo">${ic("logo")}</div>
      <div class="sb-wordmark">Shift<b>fy</b></div>
    </div>
    <div class="sb-search">${ic("search")}<span>${t("c.search")}</span><kbd>⌘K</kbd></div>
    <nav class="sb-nav">`;

  let curGroup = "__init";
  visibleNav().forEach((n) => {
    if (n.group !== curGroup) {
      curGroup = n.group;
      if (n.group) html += `<div class="sb-group-label">${t(n.group)}</div>`;
    }
    const active = state.view === n.id ? " active" : "";
    const badge = BADGES[n.id] ? `<span class="badge-count">${BADGES[n.id]}</span>` : "";
    html += `<div class="sb-item${active}" data-nav="${n.id}">${ic(n.icon)}<span>${t(n.label)}</span>${badge}</div>`;
  });

  html += `</nav>
    <div class="sb-user" id="sb-user">
      ${avatar(ME, "sm")}
      <div class="meta">
        <div class="nm">${ME.first} ${ME.last}</div>
        <div class="em">${roleLabel()}</div>
      </div>
      <span class="chev" style="margin-left:auto">${ic("chevR")}</span>
    </div>
  </aside>`;
  return html;
}

function renderTopbar(meta) {
  const flag = state.lang === "de";
  return `<header class="topbar">
    <div class="tb-brand mobile-only">
      <div class="tb-logo">${ic("logo")}</div>
      <div class="tb-wordmark">Shift<b>fy</b></div>
    </div>
    <div class="tb-titles desktop-only">
      <div class="tb-title">${t(meta.t)}</div>
      ${meta.d ? `<div class="tb-desc">${t(meta.d)}</div>` : ""}
    </div>
    <div class="tb-actions">
      <button class="punch-quick" id="punch-quick" title="Stempeluhr">${ic("clock")}<span class="pq-ring"></span></button>
      <div class="lang-toggle" id="lang">
        <button data-lang="de" class="${flag ? "active" : ""}" title="Deutsch">DE</button>
        <button data-lang="en" class="${!flag ? "active" : ""}" title="English">EN</button>
      </div>
      <button class="icon-btn" id="theme" title="${state.theme === 'dark' ? t('c.lightMode') : t('c.darkMode')}">${state.theme === "dark" ? ic("sun") : ic("moon")}</button>
      <button class="icon-btn" id="bell" title="${t('c.notifications')}">${ic("bell")}<span class="dot">2</span></button>
      <button class="tb-avatar-btn desktop-only" id="user-menu-btn" title="${ME.first} ${ME.last}">${avatar(ME, "")}</button>
    </div>
    <div id="punch-pop-host"></div>
  </header>`;
}

function renderTabbar() {
  const tabIcons = {
    dashboard: "grid", shiftPlan: "calendar", stempeluhr: "stopwatch", zeiterfassung: "clock",
    reports: "chart", absences: "calOff",
  };
  const tabs = primaryTabs().map((id) => ({ id, icon: tabIcons[id], label: NAV.find((n) => n.id === id).label }));
  tabs.push({ id: "__more", icon: "dots", label: "nav.more" });
  return `<nav class="tabbar">${tabs.map((tb) => {
    const active = (state.view === tb.id || (tb.id === "__more" && !primaryTabs().includes(state.view))) ? " active" : "";
    const dot = BADGES[tb.id] ? `<span class="tdot"></span>` : "";
    return `<button class="tab${active}" data-tab="${tb.id}">${ic(tb.icon)}${dot}<span>${t(tb.label)}</span></button>`;
  }).join("")}</nav>`;
}

/* ════════════════════════════════════════════
   Mount the active screen
   ════════════════════════════════════════════ */
function mountScreen() {
  const c = document.getElementById("content");
  const fn = SCREENS[state.view] || SCREENS.__placeholder;
  c.innerHTML = fn();
  if (SCREEN_INIT[state.view]) SCREEN_INIT[state.view]();
}

/* ════════════════════════════════════════════
   Sheets
   ════════════════════════════════════════════ */
function openSheet(html) {
  const host = document.getElementById("sheet-host");
  host.innerHTML = `<div class="sheet" id="sheet">${html}</div>`;
  const scrim = document.getElementById("scrim");
  const sheet = document.getElementById("sheet");
  void sheet.offsetHeight; // commit initial (closed) transform before transitioning
  scrim.classList.add("open");
  sheet.classList.add("open");
  scrim.onclick = closeSheet;
  host.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeSheet));
}
function closeSheet() {
  const sheet = document.getElementById("sheet");
  const scrim = document.getElementById("scrim");
  if (!sheet) return;
  sheet.classList.remove("open");
  scrim.classList.remove("open");
  setTimeout(() => { document.getElementById("sheet-host").innerHTML = ""; }, 360);
}
window.openSheet = openSheet;
window.closeSheet = closeSheet;

/* ════════════════════════════════════════════
   Events
   ════════════════════════════════════════════ */
function setView(id) {
  if (!META[id] && !SCREENS[id]) id = "dashboard";
  // role gate: employees can't reach management-only routes
  const item = NAV.find((n) => n.id === id);
  if (item && !canSee(item)) id = "dashboard";
  state.view = id;
  localStorage.setItem("sf_view", id);
  renderShell();
  document.getElementById("content").scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}
window.setView = setView;

function bindShell() {
  // nav (sidebar)
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.onclick = () => setView(el.dataset.nav);
  });
  // tabs
  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.onclick = () => { el.dataset.tab === "__more" ? openMoreSheet() : setView(el.dataset.tab); };
  });
  // theme
  $("#theme").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("sf_theme", state.theme);
    document.documentElement.classList.toggle("dark", state.theme === "dark");
    $("#theme").innerHTML = state.theme === "dark" ? ic("sun") : ic("moon");
    $("#theme").title = state.theme === "dark" ? t("c.lightMode") : t("c.darkMode");
  };
  // language
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.onclick = () => {
      state.lang = b.dataset.lang;
      localStorage.setItem("sf_lang", state.lang);
      renderShell();
    };
  });
  // bell
  $("#bell").onclick = openNotifications;
  // punch quick-clock
  const pq = $("#punch-quick");
  if (pq) { pq.classList.toggle("active", state.punch !== "out"); pq.onclick = togglePunchPop; }
  updatePunchQuickUI();
  // user menu (role switch)
  const um = $("#user-menu-btn"); if (um) um.onclick = openUserMenu;
  const sbu = $("#sb-user"); if (sbu) sbu.onclick = openUserMenu;
}

function roleLabel() {
  const de = state.lang === "de";
  if (state.role === "employee") return de ? "Mitarbeiter-Ansicht" : "Employee view";
  return de ? "Management-Ansicht" : "Management view";
}

/* user menu — role switch (industry-standard profile menu) */
function openUserMenu() {
  const de = state.lang === "de";
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${de ? "Konto" : "Account"}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="sb-user" style="margin:0 0 16px;cursor:default">${avatar(ME)}<div class="meta"><div class="nm">${ME.first} ${ME.last}</div><div class="em">${ME.first.toLowerCase()}@shiftfy.de</div></div></div>
      <div class="section-title" style="margin-top:0">${de ? "Ansicht wechseln" : "Switch view"}</div>
      <div class="row" data-role="manager" style="${state.role === "manager" ? "border-color:var(--brand);background:var(--success-soft)" : ""}">
        <div class="dline-ic" style="${state.role === "manager" ? "background:var(--brand);color:#fff" : ""}">${ic("shield")}</div>
        <div class="grow"><div class="r-title">${de ? "Management" : "Management"}</div><div class="r-sub">${de ? "Volles Dashboard mit allen Widgets" : "Full dashboard with all widgets"}</div></div>
        ${state.role === "manager" ? `<span style="color:var(--brand-600)">${ic("checkCircle")}</span>` : ""}
      </div>
      <div class="row" data-role="employee" style="${state.role === "employee" ? "border-color:var(--brand);background:var(--success-soft)" : ""}">
        <div class="dline-ic" style="${state.role === "employee" ? "background:var(--brand);color:#fff" : ""}">${ic("user")}</div>
        <div class="grow"><div class="r-title">${de ? "Mitarbeiter" : "Employee"}</div><div class="r-sub">${de ? "Persönliche Ansicht: meine Schichten & Zeiten" : "Personal view: my shifts & hours"}</div></div>
        ${state.role === "employee" ? `<span style="color:var(--brand-600)">${ic("checkCircle")}</span>` : ""}
      </div>
      <div class="row" data-um="settings" style="margin-top:16px"><div class="dline-ic">${ic("gear")}</div><div class="grow"><div class="r-title">${t("nav.settings")}</div></div><span class="chev">${ic("chevR")}</span></div>
      <div class="row" data-um="__logout"><div class="dline-ic" style="color:var(--danger)">${ic("logOut")}</div><div class="grow"><div class="r-title" style="color:var(--danger)">${t("nav.logout")}</div></div></div>
    </div>`);
  document.querySelectorAll("[data-role]").forEach((el) => (el.onclick = () => {
    state.role = el.dataset.role; localStorage.setItem("sf_role", state.role);
    closeSheet(); setView("dashboard");
  }));
  document.querySelectorAll("[data-um]").forEach((el) => (el.onclick = () => {
    closeSheet(); const v = el.dataset.um; if (v !== "__logout" && (SCREENS[v] || META[v])) setTimeout(() => setView(v), 200);
  }));
}

/* ── More sheet (mobile secondary nav) ── */
function openMoreSheet() {
  let body = "";
  let curGroup = "__init";
  NAV.filter((n) => !primaryTabs().includes(n.id) && canSee(n)).forEach((n) => {
    if (n.group !== curGroup) { curGroup = n.group; if (n.group) body += `<div class="section-title" style="margin-top:18px">${t(n.group)}</div>`; }
    body += `<div class="row" data-more="${n.id}"><div class="dline-ic">${ic(n.icon)}</div><div class="grow"><div class="r-title">${t(n.label)}</div></div><span class="chev">${ic("chevR")}</span></div>`;
  });
  body += `<div class="row" style="margin-top:18px" data-more="__logout"><div class="dline-ic" style="color:var(--danger)">${ic("logOut")}</div><div class="grow"><div class="r-title" style="color:var(--danger)">${t("nav.logout")}</div></div></div>`;
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${t("nav.more")}</div><button class="icon-btn" data-close>${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="sb-user" style="margin:0 0 6px;cursor:pointer" data-more="__account">${avatar(ME)}<div class="meta"><div class="nm">${ME.first} ${ME.last}</div><div class="em">${roleLabel()}</div></div><span class="chev" style="margin-left:auto">${ic("chevR")}</span></div>
      ${body}
    </div>`);
  document.querySelectorAll("[data-more]").forEach((el) => {
    el.onclick = () => { closeSheet(); const id = el.dataset.more; if (id !== "__logout" && (SCREENS[id] || META[id])) setTimeout(() => setView(id), 200); };
  });
}

/* ── Notifications ── */
function openNotifications() {
  const items = state.lang === "de" ? [
    { ic: "swap", t: "Neue Tauschanfrage", s: "Khaled Omar möchte am 5. März tauschen", time: "vor 5 Min", color: "blue" },
    { ic: "calOff", t: "Abwesenheitsantrag", s: "Lena Brandt · Urlaub 12.–16. März", time: "vor 1 Std", color: "amber" },
  ] : [
    { ic: "swap", t: "New swap request", s: "Khaled Omar wants to swap on Mar 5", time: "5 min ago", color: "blue" },
    { ic: "calOff", t: "Absence request", s: "Lena Brandt · Vacation Mar 12–16", time: "1 hr ago", color: "amber" },
  ];
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${t("c.notifications")}</div><span class="badge emerald">2 ${state.lang === "de" ? "neu" : "new"}</span><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      ${items.map((n) => `<div class="row"><div class="dline-ic ${n.color === "amber" ? "" : ""}" style="background:var(--${n.color === "amber" ? "warning" : "info"}-soft);color:var(--${n.color === "amber" ? "warning" : "info"})">${ic(n.ic)}</div><div class="grow"><div class="r-title">${n.t}</div><div class="r-sub">${n.s}</div></div><div class="text-3" style="font-size:12px;white-space:nowrap">${n.time}</div></div>`).join("")}
    </div>`);
}

/* ── Stempeluhr quick-clock popover (always-accessible in topbar) ── */
function updatePunchQuickUI() {
  const pq = document.getElementById("punch-quick");
  if (!pq) return;
  pq.classList.toggle("active", state.punch !== "out");
  pq.classList.toggle("onbreak", state.punch === "break");
}

function togglePunchPop() {
  const host = document.getElementById("punch-pop-host");
  if (!host) return;
  if (host.querySelector(".punch-pop")) { closePunchPop(); return; }
  const de = state.lang === "de";
  const isIn = state.punch !== "out";
  const onBreak = state.punch === "break";
  const statusLabel = onBreak ? (de ? "In Pause" : "On break") : isIn ? (de ? "Eingestempelt" : "Clocked in") : (de ? "Nicht eingestempelt" : "Not clocked in");
  const statusCls = onBreak ? "amber" : isIn ? "emerald" : "gray";
  const mainLabel = onBreak ? (de ? "Pause beenden" : "End break") : isIn ? (de ? "Ausstempeln" : "Clock out") : (de ? "Einstempeln" : "Clock in");

  host.innerHTML = `
    <div class="punch-pop" id="punch-pop">
      <div class="pp-head">
        <span class="pp-title">${de ? "Stempeluhr" : "Punch clock"}</span>
        <span class="badge ${statusCls}">${statusCls !== "gray" ? '<span class="pip"></span>' : ""}${statusLabel}</span>
      </div>
      <div class="pp-clock">
        <svg class="pp-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="pp-ring-bg"/><circle cx="60" cy="60" r="54" class="pp-ring-fg" id="pp-ring-fg"/></svg>
        <div class="pp-clock-inner">
          <div class="pp-time num" id="pp-time">--:--:--</div>
          <div class="pp-clock-sub">${isIn ? (de ? "seit " : "since ") + (state.punchStart || "08:00") : (de ? "Nicht eingestempelt" : "Not clocked in")}</div>
        </div>
      </div>
      <div class="pp-stats">
        <div class="pp-stat"><div class="pp-stat-v num" id="pp-elapsed">${isIn ? "5:12" : "0:00"}</div><div class="pp-stat-l">${de ? "Heute" : "Today"}</div></div>
        <div class="pp-stat"><div class="pp-stat-v num">33:48</div><div class="pp-stat-l">${de ? "Diese Woche" : "This week"}</div></div>
        <div class="pp-stat"><div class="pp-stat-v"><span style="font-size:13px">Amazon-Fra3</span></div><div class="pp-stat-l">${de ? "Standort" : "Location"}</div></div>
      </div>
      <button class="btn ${onBreak ? "btn-primary" : isIn ? "btn-danger" : "btn-primary"} btn-block btn-lg" id="pp-main">${ic(onBreak ? "coffee" : isIn ? "logOut" : "play")}${mainLabel}</button>
      ${isIn ? `<button class="btn btn-secondary btn-block btn-sm" id="pp-break" style="margin-top:8px">${ic("coffee")}${onBreak ? (de ? "Pause beenden" : "End break") : (de ? "Pause starten" : "Start break")}</button>` : ""}
      <button class="pp-full" id="pp-full">${de ? "Stempeluhr öffnen" : "Open full punch clock"} ${ic("arrowRight")}</button>
    </div>`;

  requestAnimationFrame(() => { const p = document.getElementById("punch-pop"); if (p) p.classList.add("open"); });

  // live tick
  const tick = () => {
    const tEl = document.getElementById("pp-time"); if (!tEl) { clearInterval(window._ppClk); return; }
    const now = new Date();
    tEl.textContent = isIn ? now.toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "--:--:--";
    const ring = document.getElementById("pp-ring-fg");
    if (ring) { const frac = isIn ? (now.getSeconds() / 60) : 0; const c = 2 * Math.PI * 54; ring.style.strokeDasharray = c; ring.style.strokeDashoffset = c * (1 - frac); }
  };
  clearInterval(window._ppClk); tick(); window._ppClk = setInterval(tick, 1000);

  // actions
  document.getElementById("pp-main").onclick = () => {
    if (state.punch === "out") { state.punch = "in"; state.punchStart = new Date().toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", hour12: false }); toast(t("punch.clockIn")); }
    else if (state.punch === "break") { state.punch = "in"; toast(t("punch.endBreak")); }
    else { state.punch = "out"; toast(t("punch.clockOut")); }
    closePunchPop(); updatePunchQuickUI();
    if (state.view === "stempeluhr" || state.view === "zeiterfassung" || state.view === "dashboard") { mountScreen(); if (SCREEN_INIT[state.view]) SCREEN_INIT[state.view](); }
  };
  const brk = document.getElementById("pp-break");
  if (brk) brk.onclick = () => { state.punch = state.punch === "break" ? "in" : "break"; toast(state.punch === "break" ? t("punch.onBreak") : t("punch.endBreak")); closePunchPop(); updatePunchQuickUI(); };
  document.getElementById("pp-full").onclick = () => { closePunchPop(); setView("stempeluhr"); };

  // outside click
  setTimeout(() => { document.addEventListener("click", ppOutside, true); }, 0);
}
function ppOutside(e) {
  const pop = document.getElementById("punch-pop"); const btn = document.getElementById("punch-quick");
  if (pop && !pop.contains(e.target) && btn && !btn.contains(e.target)) closePunchPop();
}
function closePunchPop() {
  document.removeEventListener("click", ppOutside, true);
  clearInterval(window._ppClk);
  const pop = document.getElementById("punch-pop");
  if (pop) { pop.classList.remove("open"); setTimeout(() => { const h = document.getElementById("punch-pop-host"); if (h) h.innerHTML = ""; }, 240); }
}
window.togglePunchPop = togglePunchPop;

/* boot */
window.addEventListener("DOMContentLoaded", renderShell);
