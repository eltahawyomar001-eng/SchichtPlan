/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens · Team & Objects
   Employees · Locations · Clients · Projects  (fully built)
   ═══════════════════════════════════════════════════════════════ */

/* extended team data */
const EMP_EXT = {
  e1: { weekly: 40, contract: "Vollzeit", status: "active", phone: "+49 151 2200 110", email: "omar@shiftfy.de", skills: ["Teamleitung", "Gabelstapler", "Erste Hilfe"], balance: 1080, vacation: 18, since: "2023-04-12", today: "08:00–16:00" },
  e2: { weekly: 32, contract: "Teilzeit", status: "active", phone: "+49 151 2200 221", email: "khaled@shiftfy.de", skills: ["Kommissionierung", "Inbound"], balance: 420, vacation: 24, since: "2024-01-08", today: "14:00–22:00" },
  e3: { weekly: 40, contract: "Vollzeit", status: "active", phone: "+49 151 2200 332", email: "aly@shiftfy.de", skills: ["Sortierung", "Nachtschicht"], balance: -120, vacation: 11, since: "2023-09-20", today: null },
  e4: { weekly: 30, contract: "Teilzeit", status: "active", phone: "+49 151 2200 443", email: "lena@shiftfy.de", skills: ["Qualitätskontrolle", "Inbound"], balance: 240, vacation: 30, since: "2024-03-15", today: "06:00–14:00" },
  e5: { weekly: 40, contract: "Vollzeit", status: "active", phone: "+49 151 2200 554", email: "marco@shiftfy.de", skills: ["Outbound", "Gabelstapler"], balance: 660, vacation: 20, since: "2022-11-02", today: "10:00–18:00" },
  e6: { weekly: 20, contract: "Minijob", status: "inactive", phone: "+49 151 2200 665", email: "sara@shiftfy.de", skills: ["Packen"], balance: 0, vacation: 8, since: "2025-01-10", today: null },
};
const fmtBal = (m) => (m >= 0 ? "+" : "−") + Math.abs(Math.round(m / 60 * 10) / 10) + "h";

/* ════════════════════════════════════════════
   EMPLOYEES
   ════════════════════════════════════════════ */
SCREENS.employees = function () {
  const de = state.lang === "de";
  const active = TEAM.filter((e) => EMP_EXT[e.id].status === "active").length;
  const onShift = TEAM.filter((e) => EMP_EXT[e.id].today).length;
  const avg = Math.round(TEAM.reduce((s, e) => s + EMP_EXT[e.id].weekly, 0) / TEAM.length);
  const stats = [
    { label: de ? "Mitarbeiter" : "Employees", val: TEAM.length, ic: "users" },
    { label: de ? "Aktiv" : "Active", val: active, ic: "checkCircle" },
    { label: de ? "Im Dienst" : "On shift", val: onShift, ic: "clock", cls: "blue" },
    { label: de ? "Ø Std/Woche" : "Avg hrs/week", val: avg, ic: "chart", cls: "amber" },
  ];

  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="sb-search" style="margin:0;flex:1;min-width:200px;max-width:360px;background:var(--surface);height:42px">${ic("search")}<span style="color:var(--text-3)">${de ? "Mitarbeiter suchen…" : "Search employees…"}</span></div>
      <div class="flex items-center gap-2">
        <div class="segmented" id="emp-filter"><button class="active">${de ? "Alle" : "All"}</button><button>${de ? "Aktiv" : "Active"}</button><button>${de ? "Inaktiv" : "Inactive"}</button></div>
        <button class="btn btn-primary btn-sm" onclick="openEmpEdit()">${ic("userPlus")}<span class="desktop-only">${de ? "Hinzufügen" : "Add"}</span></button>
      </div>
    </div>

    <div class="grid emp-stats" id="emp-stats">
      ${stats.map((s) => `<div class="kpi"><div class="kpi-top"><div class="kpi-ic ${s.cls || ""}">${ic(s.ic)}</div></div><div class="kpi-label">${s.label}</div><div class="kpi-val num">${s.val}</div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Alle Mitarbeiter" : "All employees"}</span><span class="badge gray act num">${TEAM.length}</span></div>
      <div class="card-body" style="padding-top:8px">
        <div class="emp-table-head">
          <span>${de ? "Mitarbeiter" : "Employee"}</span><span>${de ? "Rolle" : "Role"}</span><span>${de ? "Standort" : "Location"}</span><span>${de ? "Vertrag" : "Contract"}</span><span style="text-align:right">${de ? "Saldo" : "Balance"}</span><span></span>
        </div>
        ${TEAM.map((e) => {
          const x = EMP_EXT[e.id];
          return `<div class="emp-row" data-emp="${e.id}">
            <div class="flex items-center gap-3" style="min-width:0">${avatar(e)}<div style="min-width:0"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}${x.status === "inactive" ? ` <span class="badge gray" style="height:18px;font-size:11px">${de ? "Inaktiv" : "Inactive"}</span>` : ""}</div><div class="r-sub desktop-hide" style="font-size:var(--t-sm)">${e.role === "Manager" ? (de ? "Manager" : "Manager") : (de ? "Mitarbeiter" : "Employee")} · ${e.loc}</div></div></div>
            <span class="badge ${e.role === "Manager" ? "emerald" : "gray"} emp-col">${e.role === "Manager" ? "Manager" : (de ? "Mitarbeiter" : "Employee")}</span>
            <span class="emp-col text-2" style="font-size:var(--t-sm)">${ic("mapPin")} ${e.loc}</span>
            <span class="emp-col text-2" style="font-size:var(--t-sm)">${x.contract} · ${x.weekly}h</span>
            <span class="emp-col num" style="text-align:right;font-weight:700;color:${x.balance >= 0 ? "var(--success)" : "var(--danger)"}">${fmtBal(x.balance)}</span>
            <span class="chev emp-col" style="justify-self:end">${ic("chevR")}</span>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>
  <style>
    .emp-stats{ grid-template-columns:repeat(2,1fr); }
    .emp-table-head{ display:none; grid-template-columns:2fr 1fr 1.4fr 1.3fr .9fr 28px; gap:12px; padding:6px 12px 12px; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--border); }
    .emp-row{ display:grid; grid-template-columns:1fr; gap:12px; align-items:center; padding:14px 12px; border-radius:var(--r-md); cursor:pointer; transition:background var(--d-fast); }
    .emp-row:hover{ background:var(--surface-hover); }
    .emp-row + .emp-row{ border-top:1px solid var(--border); }
    .emp-row .emp-col{ display:none; }
    .emp-row .emp-col svg{ width:15px;height:15px;vertical-align:-2px; }
    @media (min-width:1024px){
      .app.wide .emp-stats{ grid-template-columns:repeat(4,1fr); }
      .app.wide .emp-table-head{ display:grid; }
      .app.wide .emp-row{ grid-template-columns:2fr 1fr 1.4fr 1.3fr .9fr 28px; border-top:1px solid var(--border); }
      .app.wide .emp-row .emp-col{ display:inline-flex; align-items:center; gap:5px; }
      .app.wide .emp-row .desktop-hide{ display:none; }
    }
  </style>`;
};
SCREEN_INIT.employees = function () {
  document.querySelectorAll("#content .emp-row").forEach((el) => (el.onclick = () => openEmpDetail(el.dataset.emp)));
  segmentedBind("#emp-filter");
};

/* full employee detail PAGE (mirrors real /mitarbeiter/[id]) */
function openEmpDetail(id) {
  state.empDetail = id;
  setView("employeeDetail");
}
window.openEmpDetail = openEmpDetail;

SCREENS.employeeDetail = function () {
  const de = state.lang === "de";
  const id = state.empDetail || "e1";
  const e = TEAM.find((x) => x.id === id) || TEAM[0];
  const x = EMP_EXT[id] || EMP_EXT.e1;
  const v = (typeof VAC !== "undefined" && VAC[id]) ? VAC[id] : { ent: 30, taken: 12, planned: 4 };
  const vacRemaining = v.ent - v.taken - v.planned;
  // demo recent records
  const recentShifts = [
    { date: "2026-06-03", start: "08:00", end: "16:00", loc: e.loc, st: "inProgress" },
    { date: "2026-06-02", start: "08:00", end: "16:00", loc: e.loc, st: "completed" },
    { date: "2026-05-30", start: "14:00", end: "22:00", loc: e.loc, st: "completed" },
  ];
  const recentTime = [
    { date: "2026-06-03", clockIn: "08:00", clockOut: "—", net: "5:12", st: "pending" },
    { date: "2026-06-02", clockIn: "08:02", clockOut: "16:31", net: "8:02", st: "approved" },
    { date: "2026-05-30", clockIn: "14:00", clockOut: "22:05", net: "7:35", st: "approved" },
  ];
  const recentAbs = [
    { type: de ? "Urlaub" : "Vacation", from: "2026-03-24", to: "2026-03-25", days: 2, st: "approved" },
  ];
  const myCerts = (typeof EMP_SKILLS !== "undefined") ? EMP_SKILLS.filter((s) => s.emp === id) : [];
  const fmtD = (d) => new Date(d).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtDShort = (d) => new Date(d).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" });
  const stBadge = (st) => {
    const m = { completed: ["gray", de ? "Abgeschlossen" : "Completed"], inProgress: ["amber", de ? "Laufend" : "In progress"], approved: ["emerald", de ? "Genehmigt" : "Approved"], pending: ["amber", de ? "Offen" : "Pending"], scheduled: ["blue", de ? "Geplant" : "Scheduled"] };
    const [c, l] = m[st] || ["gray", st]; return `<span class="badge ${c}">${st === "approved" || st === "completed" ? "" : st === "inProgress" || st === "pending" ? '<span class="pip"></span>' : ""}${l}</span>`;
  };
  const stats = [
    { ic: "calendar", color: "var(--brand-600)", v: recentShifts.length, l: de ? "Letzte Schichten" : "Recent shifts" },
    { ic: "clock", color: "var(--info)", v: recentTime.length, l: de ? "Zeiteinträge" : "Time entries" },
    { ic: "calOff", color: "var(--warning)", v: recentAbs.length, l: de ? "Abwesenheiten" : "Absences" },
    { ic: "palm", color: "#0891b2", v: vacRemaining, l: de ? "Urlaub übrig" : "Vacation left" },
    { ic: "alert", color: x.balance >= 0 ? "var(--brand-600)" : "var(--danger)", v: fmtBal(x.balance), l: de ? "Saldo" : "Balance" },
  ];
  const tableShell = (title, head, rows) => `<div class="card"><div class="card-head"><span class="ttl">${title}</span></div><div class="card-body" style="padding-top:8px"><div style="overflow-x:auto"><table class="ed-table"><thead><tr>${head.map((h, i) => `<th style="${i === 0 ? "text-align:left" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div></div></div>`;

  return `
  <div class="grid" style="gap:var(--gap-card)">
    <button class="btn btn-ghost btn-sm" id="ed-back" style="align-self:flex-start">${ic("chevL")}${de ? "Zurück zu Mitarbeiter" : "Back to employees"}</button>

    <!-- profile header -->
    <div class="card card-pad">
      <div class="flex items-start gap-4 wrap">
        ${avatar(e, "lg")}
        <div class="grow" style="min-width:0">
          <div class="flex items-center gap-3 wrap"><h2 style="font-size:var(--t-xl);font-weight:800;letter-spacing:-.02em;margin:0">${e.first} ${e.last}</h2><span class="badge ${x.status === "active" ? "emerald" : "gray"}"><span class="pip"></span>${x.status === "active" ? (de ? "Aktiv" : "Active") : (de ? "Inaktiv" : "Inactive")}</span><span class="badge ${e.role === "Manager" ? "blue" : "gray"}">${e.role === "Manager" ? "Manager" : (de ? "Mitarbeiter" : "Employee")}</span></div>
          <p class="text-2" style="font-size:var(--t-sm);margin:8px 0 0">${x.contract} · ${e.loc}</p>
          <div class="flex wrap" style="gap:6px 22px;margin-top:10px;font-size:var(--t-sm);color:var(--text-2)">
            <span class="flex items-center gap-2">${ic("message")}${x.email}</span>
            <span class="flex items-center gap-2">${ic("bell")}<span class="num">${x.phone}</span></span>
            <span class="flex items-center gap-2">${ic("briefcase")}<span class="num">16,50 €/h · ${x.weekly}${de ? " Std/Woche" : " hrs/wk"}</span></span>
          </div>
        </div>
        <div class="flex gap-2"><button class="btn btn-secondary btn-sm" onclick="openEmpEdit('${id}')">${ic("edit")}${de ? "Bearbeiten" : "Edit"}</button><button class="btn btn-primary btn-sm" onclick="setView('shiftPlan')">${ic("calendar")}${de ? "Schichten" : "Shifts"}</button></div>
      </div>
    </div>

    <!-- stats row -->
    <div class="grid ed-stats">
      ${stats.map((s) => `<div class="kpi" style="text-align:center"><div style="color:${s.color};margin-bottom:6px;display:grid;place-items:center">${ic(s.ic)}</div><div class="num" style="font-size:var(--t-2xl);font-weight:800">${s.v}</div><div class="kpi-label" style="text-transform:none;letter-spacing:0;margin-top:2px">${s.l}</div></div>`).join("")}
    </div>

    <!-- §34a certificates -->
    <div class="card">
      <div class="card-head"><div class="flex items-center gap-2">${ic("shield")}<span class="ttl">${de ? "§34a-Nachweise & Qualifikationen" : "§34a certificates & qualifications"}</span></div><button class="btn btn-ghost btn-sm act" onclick="setView('skills')">${ic("plus")}${de ? "Verwalten" : "Manage"}</button></div>
      <div class="card-body" style="padding-top:8px">
        ${myCerts.length ? myCerts.map((es) => { const sk = SKILLS.find((s) => s.id === es.skill); const st = skillState(es); const sb = st === "expired" ? `<span class="badge red"><span class="pip"></span>${de ? "Abgelaufen" : "Expired"}</span>` : st === "soon" ? `<span class="badge amber"><span class="pip"></span>${de ? "Läuft bald ab" : "Expiring"}</span>` : `<span class="badge emerald"><span class="pip"></span>${de ? "Gültig" : "Valid"}</span>`;
          return `<div class="irow"><div class="dline-ic" style="background:var(--surface-2);color:var(--brand-600)">${ic("award")}</div><div class="grow"><div class="r-title" style="font-size:var(--t-base)">${sk ? sk.name : es.skill}${sk && sk.required ? ` <span class="badge red" style="height:18px;font-size:10px">${de ? "Pflicht" : "Required"}</span>` : ""}</div><div class="r-sub">${es.certificateNumber} · ${es.issuingAuthority} · ${de ? "gültig bis" : "valid until"} ${fmtD(es.expiresAt)}</div></div>${sb}</div>`;
        }).join("") : `<div class="text-3" style="font-size:var(--t-sm);padding:8px 0">${de ? "Keine Nachweise hinterlegt" : "No certificates on file"}</div>`}
      </div>
    </div>

    <!-- shifts table -->
    ${tableShell(de ? "Letzte Schichten" : "Recent shifts", [de ? "Datum" : "Date", de ? "Zeit" : "Time", de ? "Standort" : "Location", "Status"],
      recentShifts.map((s) => `<tr><td style="text-align:left">${fmtDShort(s.date)}</td><td class="num">${s.start} – ${s.end}</td><td class="text-2">${s.loc}</td><td>${stBadge(s.st)}</td></tr>`).join(""))}

    <!-- time entries table -->
    ${tableShell(de ? "Letzte Zeiteinträge" : "Recent time entries", [de ? "Datum" : "Date", de ? "Kommt" : "In", de ? "Geht" : "Out", de ? "Netto" : "Net", "Status"],
      recentTime.map((r) => `<tr><td style="text-align:left">${fmtDShort(r.date)}</td><td class="num">${r.clockIn}</td><td class="num">${r.clockOut}</td><td class="num" style="font-weight:700">${r.net}</td><td>${stBadge(r.st)}</td></tr>`).join(""))}

    <!-- absences table -->
    ${tableShell(de ? "Abwesenheiten" : "Absences", [de ? "Art" : "Type", de ? "Von" : "From", de ? "Bis" : "To", de ? "Tage" : "Days", "Status"],
      recentAbs.map((a) => `<tr><td style="text-align:left">${a.type}</td><td class="num">${fmtD(a.from)}</td><td class="num">${fmtD(a.to)}</td><td class="num">${a.days}</td><td>${stBadge(a.st)}</td></tr>`).join(""))}
  </div>
  <style>
    .ed-stats{ grid-template-columns:repeat(2,1fr); }
    @media (min-width:640px){ .ed-stats{ grid-template-columns:repeat(5,1fr); } }
    .ed-table{ width:100%; border-collapse:collapse; min-width:440px; }
    .ed-table th{ font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:center; }
    .ed-table td{ padding:12px;text-align:center;border-top:1px solid var(--border);font-size:var(--t-sm); }
    .ed-table td:first-child{ font-weight:600; }
  </style>`;
};
SCREEN_INIT.employeeDetail = function () {
  const b = document.getElementById("ed-back"); if (b) b.onclick = () => setView("employees");
};

function openEmpDetailSheetLEGACY(id) {
  const e = TEAM.find((x) => x.id === id); const x = EMP_EXT[id]; const de = state.lang === "de";
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${de ? "Profil" : "Profile"}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="flex items-center gap-4" style="margin-bottom:6px">
        ${avatar(e, "lg")}
        <div class="grow"><div style="font-size:var(--t-xl);font-weight:800;letter-spacing:-.02em">${e.first} ${e.last}</div>
        <div class="flex items-center gap-2 mt-2"><span class="badge ${e.role === "Manager" ? "emerald" : "gray"}">${e.role === "Manager" ? "Manager" : (de ? "Mitarbeiter" : "Employee")}</span><span class="badge ${x.status === "active" ? "emerald" : "gray"}"><span class="pip"></span>${x.status === "active" ? (de ? "Aktiv" : "Active") : (de ? "Inaktiv" : "Inactive")}</span></div></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:16px 0">
        <div class="card" style="box-shadow:none;padding:13px"><div class="kpi-label">${de ? "Saldo" : "Balance"}</div><div class="num" style="font-size:var(--t-xl);font-weight:800;color:${x.balance >= 0 ? "var(--success)" : "var(--danger)"}">${fmtBal(x.balance)}</div></div>
        <div class="card" style="box-shadow:none;padding:13px"><div class="kpi-label">${de ? "Urlaub übrig" : "Vacation left"}</div><div class="num" style="font-size:var(--t-xl);font-weight:800">${x.vacation}<span class="text-3" style="font-size:14px"> ${de ? "Tg" : "d"}</span></div></div>
      </div>
      <div class="dline"><div class="dline-ic">${ic("mapPin")}</div><div><div class="lbl">${de ? "Standort" : "Location"}</div><div class="val">${e.loc}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("briefcase")}</div><div><div class="lbl">${de ? "Vertrag" : "Contract"}</div><div class="val">${x.contract} · ${x.weekly} ${de ? "Std/Woche" : "hrs/week"}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("message")}</div><div><div class="lbl">E-Mail</div><div class="val">${x.email}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("bell")}</div><div><div class="lbl">${de ? "Telefon" : "Phone"}</div><div class="val num">${x.phone}</div></div></div>
      <div class="section-title" style="margin:16px 0 8px">${de ? "Qualifikationen" : "Qualifications"}</div>
      <div class="flex wrap gap-2">${x.skills.map((s) => `<span class="badge gray">${ic("shield")}${s}</span>`).join("")}</div>
    </div>
    <div class="sheet-foot">
      <button class="btn btn-secondary grow" data-close onclick="setTimeout(()=>openEmpEdit('${id}'),220)">${ic("edit")}${de ? "Bearbeiten" : "Edit"}</button>
      <button class="btn btn-primary grow" data-close onclick="setView('shiftPlan')">${ic("calendar")}${de ? "Schichten" : "Shifts"}</button>
    </div>`);
}
window.openEmpDetail = openEmpDetail;

function openEmpEdit(id) {
  const e = id ? TEAM.find((x) => x.id === id) : null; const x = id ? EMP_EXT[id] : null; const de = state.lang === "de";
  const locs = ["Amazon-Fra3", "DHL-Hub Köln", "Zalando-Erfurt"].map((l) => `<option ${e && e.loc === l ? "selected" : ""}>${l}</option>`).join("");
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${id ? (de ? "Mitarbeiter bearbeiten" : "Edit employee") : (de ? "Mitarbeiter hinzufügen" : "Add employee")}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="field-row">
        <div class="field"><label>${de ? "Vorname" : "First name"}</label><input class="input" value="${e ? e.first : ""}" placeholder="${de ? "Vorname" : "First name"}"></div>
        <div class="field"><label>${de ? "Nachname" : "Last name"}</label><input class="input" value="${e ? e.last : ""}" placeholder="${de ? "Nachname" : "Last name"}"></div>
      </div>
      <div class="field"><label>E-Mail</label><input class="input" type="email" value="${x ? x.email : ""}" placeholder="name@firma.de"></div>
      <div class="field"><label>${de ? "Standort" : "Location"}</label><select class="select">${locs}</select></div>
      <div class="field-row">
        <div class="field"><label>${de ? "Vertrag" : "Contract"}</label><select class="select"><option ${x && x.contract === "Vollzeit" ? "selected" : ""}>${de ? "Vollzeit" : "Full-time"}</option><option ${x && x.contract === "Teilzeit" ? "selected" : ""}>${de ? "Teilzeit" : "Part-time"}</option><option ${x && x.contract === "Minijob" ? "selected" : ""}>Minijob</option></select></div>
        <div class="field"><label>${de ? "Std/Woche" : "Hrs/week"}</label><input class="input num" type="number" value="${x ? x.weekly : 40}"></div>
      </div>
      <div class="field" style="margin-bottom:0"><label>${de ? "Rolle" : "Role"}</label><select class="select"><option ${e && e.role === "Employee" ? "selected" : ""}>${de ? "Mitarbeiter" : "Employee"}</option><option ${e && e.role === "Manager" ? "selected" : ""}>Manager</option></select></div>
    </div>
    <div class="sheet-foot">
      <button class="btn btn-ghost grow" data-close>${t("c.cancel")}</button>
      <button class="btn btn-primary grow" data-close onclick="toast('${de ? "Gespeichert" : "Saved"}')">${ic("check")}${t("c.save")}</button>
    </div>`);
}
window.openEmpEdit = openEmpEdit;

/* ════════════════════════════════════════════
   LOCATIONS
   ════════════════════════════════════════════ */
const LOCATIONS = [
  { name: "Amazon-Fra3", addr: "Am Schäferweg 3, 65760 Eschborn", staff: 4, open: 1, cov: 92, color: "#059669" },
  { name: "DHL-Hub Köln", addr: "Eifeltor 12, 50997 Köln", staff: 3, open: 1, cov: 78, color: "#2563eb" },
  { name: "Zalando-Erfurt", addr: "Am Güterbahnhof 5, 99085 Erfurt", staff: 1, open: 0, cov: 100, color: "#d97706" },
];
SCREENS.locations = function () {
  const de = state.lang === "de";
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="text-2" style="font-size:var(--t-sm)">${LOCATIONS.length} ${de ? "Standorte" : "locations"} · ${LOCATIONS.reduce((s, l) => s + l.staff, 0)} ${de ? "Mitarbeiter" : "staff"}</div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Standort hinzufügen" : "Add location"}')">${ic("plus")}${de ? "Standort" : "Location"}</button>
    </div>
    <div class="grid loc-grid">
      ${LOCATIONS.map((l) => {
        const members = TEAM.filter((e) => e.loc === l.name);
        return `<div class="card card-pad loc-card">
          <div class="flex items-center gap-3" style="margin-bottom:14px">
            <div class="kpi-ic" style="background:${l.color}1a;color:${l.color}">${ic("building")}</div>
            <div class="grow" style="min-width:0"><div class="r-title" style="font-size:var(--t-md)">${l.name}</div><div class="r-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.addr}</div></div>
            <button class="icon-btn" onclick="toast('${de ? "Optionen" : "Options"}')">${ic("dots")}</button>
          </div>
          <div class="flex between items-center" style="margin-bottom:8px">
            <span class="kpi-label">${de ? "Abdeckung heute" : "Coverage today"}</span>
            <span class="num" style="font-weight:700;color:${l.cov >= 90 ? "var(--success)" : "var(--warning)"}">${l.cov}%</span>
          </div>
          <div class="track" style="margin-bottom:16px"><i style="width:${l.cov}%;background:${l.cov >= 90 ? "var(--brand)" : "var(--warning)"}"></i></div>
          <div class="flex between items-center">
            <div class="flex items-center" style="padding-left:6px">${members.slice(0, 4).map((m, i) => `<div style="margin-left:-8px;border:2px solid var(--surface);border-radius:50%">${avatar(m, "sm")}</div>`).join("")}</div>
            <div class="flex items-center gap-2">
              ${l.open ? `<span class="badge amber"><span class="pip"></span>${l.open} ${de ? "offen" : "open"}</span>` : ""}
              <span class="badge gray num">${l.staff} ${de ? "MA" : "staff"}</span>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <style>.loc-grid{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .loc-grid{ grid-template-columns:repeat(3,1fr); } }</style>`;
};

/* ════════════════════════════════════════════
   CLIENTS
   ════════════════════════════════════════════ */
const CLIENTS = [
  { name: "Amazon Logistik GmbH", short: "AL", color: "#059669", projects: 3, status: "active", contact: "K. Hoffmann", hours: 320 },
  { name: "DHL Express", short: "DH", color: "#d97706", projects: 2, status: "active", contact: "M. Vogel", hours: 188 },
  { name: "Zalando SE", short: "ZA", color: "#7c3aed", projects: 1, status: "active", contact: "S. Reinholz", hours: 64 },
  { name: "Hermes Germany", short: "HG", color: "#2563eb", projects: 1, status: "paused", contact: "T. Bauer", hours: 12 },
];
SCREENS.clients = function () {
  const de = state.lang === "de";
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="sb-search" style="margin:0;flex:1;min-width:200px;max-width:360px;background:var(--surface);height:42px">${ic("search")}<span style="color:var(--text-3)">${de ? "Kunden suchen…" : "Search clients…"}</span></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Kunde hinzufügen" : "Add client"}')">${ic("plus")}${de ? "Kunde" : "Client"}</button>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Kunden" : "Clients"}</span><span class="badge gray act num">${CLIENTS.length}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${CLIENTS.map((c) => `<div class="row" style="border-color:transparent;border-top:1px solid var(--border);border-radius:var(--r-md)" onclick="toast('${c.name}')">
          <div class="avatar" style="background:${c.color};border-radius:12px">${c.short}</div>
          <div class="grow"><div class="r-title">${c.name}</div><div class="r-sub">${de ? "Ansprechpartner" : "Contact"}: ${c.contact} · ${c.hours}h ${de ? "erfasst" : "logged"}</div></div>
          <div class="flex items-center gap-3 desktop-only"><span class="badge gray num">${c.projects} ${de ? "Projekte" : "projects"}</span></div>
          <span class="badge ${c.status === "active" ? "emerald" : "amber"}"><span class="pip"></span>${c.status === "active" ? (de ? "Aktiv" : "Active") : (de ? "Pausiert" : "Paused")}</span>
          <span class="chev">${ic("chevR")}</span>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   PROJECTS
   ════════════════════════════════════════════ */
const PROJECTS = [
  { name: "Inbound Q1", client: "Amazon Logistik", color: "#059669", logged: 142, budget: 200, team: ["e1", "e4", "e5"], status: "active", due: "31.03." },
  { name: "Peak-Support", client: "DHL Express", color: "#d97706", logged: 88, budget: 120, team: ["e3", "e5"], status: "active", due: "15.04." },
  { name: "Retouren-Sortierung", client: "Zalando SE", color: "#7c3aed", logged: 64, budget: 64, team: ["e6"], status: "done", due: "—" },
  { name: "Nachtschicht-Pilot", client: "Hermes", color: "#2563eb", logged: 12, budget: 80, team: ["e2"], status: "planning", due: "01.05." },
];
SCREENS.projects = function () {
  const de = state.lang === "de";
  const stMap = { active: ["emerald", de ? "Aktiv" : "Active"], done: ["gray", de ? "Fertig" : "Done"], planning: ["blue", de ? "Planung" : "Planning"] };
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="segmented" id="proj-filter"><button class="active">${de ? "Alle" : "All"}</button><button>${de ? "Aktiv" : "Active"}</button><button>${de ? "Fertig" : "Done"}</button></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Projekt anlegen" : "New project"}')">${ic("plus")}${de ? "Projekt" : "Project"}</button>
    </div>
    <div class="grid proj-grid">
      ${PROJECTS.map((p) => {
        const pct = Math.round((p.logged / p.budget) * 100);
        const over = pct >= 100;
        const [bc, bl] = stMap[p.status];
        const members = p.team.map((tid) => TEAM.find((e) => e.id === tid)).filter(Boolean);
        return `<div class="card card-pad">
          <div class="flex between items-center" style="margin-bottom:12px">
            <div class="flex items-center gap-3" style="min-width:0"><div class="kpi-ic" style="background:${p.color}1a;color:${p.color}">${ic("folder")}</div><div style="min-width:0"><div class="r-title" style="font-size:var(--t-md)">${p.name}</div><div class="r-sub">${p.client}</div></div></div>
            <span class="badge ${bc}">${p.status === "active" ? '<span class="pip"></span>' : ""}${bl}</span>
          </div>
          <div class="flex between items-center" style="margin-bottom:7px">
            <span class="kpi-label">${de ? "Stunden" : "Hours"}</span>
            <span class="num" style="font-weight:700">${p.logged}<span class="text-3" style="font-weight:600">/${p.budget}h · ${pct}%</span></span>
          </div>
          <div class="track" style="margin-bottom:14px"><i style="width:${Math.min(pct, 100)}%;background:${over ? "var(--success)" : pct > 85 ? "var(--warning)" : "var(--brand)"}"></i></div>
          <div class="flex between items-center">
            <div class="flex items-center" style="padding-left:6px">${members.map((m) => `<div style="margin-left:-8px;border:2px solid var(--surface);border-radius:50%">${avatar(m, "sm")}</div>`).join("")}</div>
            <span class="text-3" style="font-size:12px;font-weight:600">${p.due !== "—" ? (de ? "Fällig " : "Due ") + p.due : ""}</span>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <style>.proj-grid{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .proj-grid{ grid-template-columns:repeat(2,1fr); } }</style>`;
};
SCREEN_INIT.projects = function () { segmentedBind("#proj-filter"); };

/* shared: segmented binder */
function segmentedBind(sel) {
  const root = document.querySelector(sel); if (!root) return;
  const btns = [...root.querySelectorAll("button")];
  btns.forEach((b) => (b.onclick = () => { btns.forEach((x) => x.classList.remove("active")); b.classList.add("active"); }));
}
window.segmentedBind = segmentedBind;
