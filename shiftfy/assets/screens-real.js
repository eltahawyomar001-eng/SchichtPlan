/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens that mirror real backend models
   Field names + enum values match prisma/schema.prisma exactly so the
   UI maps 1:1 onto the API when Claude Code swaps the frontend.
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   ZEITERFASSUNG — Time Tracking overview (TimeEntry)
   enum approval: status pending|approved + breakMinutes, source
   ════════════════════════════════════════════ */
const TIME_ENTRIES = [
  { id: "t1", emp: "e1", date: "2026-03-02", clockIn: "08:00", clockOut: "16:30", breakMinutes: 30, status: "pending", source: "APP", project: "Inbound Q1" },
  { id: "t2", emp: "e4", date: "2026-03-02", clockIn: "06:00", clockOut: "14:00", breakMinutes: 30, status: "approved", source: "TERMINAL", project: null },
  { id: "t3", emp: "e5", date: "2026-03-02", clockIn: "10:00", clockOut: "18:12", breakMinutes: 45, status: "pending", source: "APP", project: "Peak-Support" },
  { id: "t4", emp: "e2", date: "2026-03-01", clockIn: "14:00", clockOut: "22:05", breakMinutes: 30, status: "approved", source: "APP", project: null },
  { id: "t5", emp: "e3", date: "2026-03-01", clockIn: "22:00", clockOut: "06:00", breakMinutes: 45, status: "approved", source: "TERMINAL", project: null },
];
function netHours(e) {
  const [ih, im] = e.clockIn.split(":").map(Number); let [oh, om] = e.clockOut.split(":").map(Number);
  let mins = (oh * 60 + om) - (ih * 60 + im); if (mins < 0) mins += 1440; mins -= e.breakMinutes;
  return (mins / 60);
}
function fmtH(h) { const m = Math.round(h * 60); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); }

SCREENS.zeiterfassung = function () {
  const de = state.lang === "de";
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" });
  const pending = TIME_ENTRIES.filter((e) => e.status === "pending");
  const totalNet = TIME_ENTRIES.reduce((s, e) => s + netHours(e), 0);
  const kpis = [
    { label: de ? "Einträge heute" : "Entries today", val: TIME_ENTRIES.filter((e) => e.date === "2026-03-02").length, ic: "clock" },
    { label: de ? "Zu prüfen" : "To approve", val: pending.length, ic: "checkCircle", cls: "amber" },
    { label: de ? "Erfasst (Netto)" : "Tracked (net)", val: fmtH(totalNet), ic: "stopwatch", cls: "blue" },
    { label: de ? "Aktiv jetzt" : "Active now", val: 2, ic: "users" },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="segmented" id="ze-filter"><button class="active">${de ? "Alle" : "All"}</button><button>${de ? "Zu prüfen" : "To approve"}</button><button>${de ? "Genehmigt" : "Approved"}</button></div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary btn-sm" onclick="setView('stempeluhr')">${ic("stopwatch")}<span class="desktop-only">${de ? "Stempeluhr" : "Punch clock"}</span></button>
        <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Eintrag hinzufügen" : "Add entry"}')">${ic("plus")}${de ? "Eintrag" : "Entry"}</button>
      </div>
    </div>

    <div class="grid ze-kpi" id="ze-kpi">
      ${kpis.map((k) => `<div class="kpi"><div class="kpi-top"><div class="kpi-ic ${k.cls || ""}">${ic(k.ic)}</div></div><div class="kpi-label">${k.label}</div><div class="kpi-val num">${k.val}</div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Zeiteinträge" : "Time entries"}</span><span class="badge amber act"><span class="pip"></span>${pending.length} ${de ? "offen" : "pending"}</span></div>
      <div class="card-body" style="padding-top:8px">
        <div class="ze-head"><span>${de ? "Mitarbeiter" : "Employee"}</span><span>${de ? "Datum" : "Date"}</span><span style="text-align:center">${de ? "Kommt/Geht" : "In/Out"}</span><span style="text-align:center">${de ? "Pause" : "Break"}</span><span style="text-align:right">${de ? "Netto" : "Net"}</span><span style="text-align:right">Status</span></div>
        ${TIME_ENTRIES.map((e) => { const emp = TEAM.find((x) => x.id === e.emp);
          return `<div class="ze-row" data-entry="${e.id}">
            <div class="flex items-center gap-3" style="min-width:0">${avatar(emp, "sm")}<div style="min-width:0"><div class="r-title" style="font-size:var(--t-base)">${emp.first} ${emp.last}</div><div class="r-sub ze-mobile">${fmt(e.date)} · ${e.clockIn}–${e.clockOut}</div></div></div>
            <span class="ze-col text-2" style="font-size:var(--t-sm)">${fmt(e.date)}</span>
            <span class="ze-col num text-2" style="font-size:var(--t-sm);text-align:center">${e.clockIn} – ${e.clockOut} ${e.source === "TERMINAL" ? `<span class="badge gray" style="height:18px;font-size:10px;margin-left:4px">Terminal</span>` : ""}</span>
            <span class="ze-col num text-3" style="font-size:var(--t-sm);text-align:center">${e.breakMinutes}m</span>
            <span class="ze-col num" style="font-weight:700;text-align:right">${fmtH(netHours(e))}</span>
            <span class="ze-col" style="text-align:right">${e.status === "approved" ? `<span class="badge emerald">${ic("check")}${de ? "Genehmigt" : "Approved"}</span>` : `<span class="badge amber"><span class="pip"></span>${de ? "Offen" : "Pending"}</span>`}</span>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>
  <style>
    .ze-kpi{ grid-template-columns:repeat(2,1fr); } @media (min-width:1024px){ .app.wide .ze-kpi{ grid-template-columns:repeat(4,1fr); } }
    .ze-head{ display:none; grid-template-columns:1.6fr 1fr 1.4fr .7fr .8fr 1fr; gap:12px; padding:6px 12px 12px; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--border); }
    .ze-row{ display:grid; grid-template-columns:1fr; gap:10px; align-items:center; padding:13px 12px; border-radius:var(--r-md); cursor:pointer; transition:background var(--d-fast); }
    .ze-row:hover{ background:var(--surface-hover); } .ze-row + .ze-row{ border-top:1px solid var(--border); }
    .ze-row .ze-col{ display:none; }
    @media (min-width:1024px){ .app.wide .ze-row{ grid-template-columns:1.6fr 1fr 1.4fr .7fr .8fr 1fr; } .app.wide .ze-row .ze-col{ display:block; } .app.wide .ze-mobile{ display:none; } .app.wide .ze-head{ display:grid; } }
  </style>`;
};
SCREEN_INIT.zeiterfassung = function () {
  segmentedBind("#ze-filter");
  document.querySelectorAll("#content .ze-row").forEach((el) => (el.onclick = () => openTimeEntry(el.dataset.entry)));
};
function openTimeEntry(id) {
  const de = state.lang === "de"; const e = TIME_ENTRIES.find((x) => x.id === id); const emp = TEAM.find((x) => x.id === e.emp);
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${de ? "Zeiteintrag" : "Time entry"}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="flex items-center gap-3" style="margin-bottom:8px">${avatar(emp)}<div><div class="r-title">${emp.first} ${emp.last}</div><div class="r-sub">${new Date(e.date).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("clock")}</div><div><div class="lbl">${de ? "Kommt / Geht" : "Clock in / out"}</div><div class="val num">${e.clockIn} – ${e.clockOut}</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("coffee")}</div><div><div class="lbl">${de ? "Pause (ArbZG)" : "Break (ArbZG)"}</div><div class="val num">${e.breakMinutes} min</div></div></div>
      <div class="dline"><div class="dline-ic">${ic("stopwatch")}</div><div><div class="lbl">${de ? "Netto-Arbeitszeit" : "Net working time"}</div><div class="val num">${fmtH(netHours(e))} h</div></div></div>
      <div class="dline"><div class="dline-ic">${ic(e.source === "TERMINAL" ? "building" : "stopwatch")}</div><div><div class="lbl">${de ? "Quelle" : "Source"}</div><div class="val">${e.source === "TERMINAL" ? "Terminal" : "App"}</div></div></div>
      ${e.project ? `<div class="dline"><div class="dline-ic">${ic("folder")}</div><div><div class="lbl">${de ? "Projekt" : "Project"}</div><div class="val">${e.project}</div></div></div>` : ""}
    </div>
    <div class="sheet-foot">
      ${e.status === "pending"
        ? `<button class="btn btn-danger grow" data-close onclick="reviewEntry('${e.id}','reject')">${ic("x")}${de ? "Ablehnen" : "Reject"}</button><button class="btn btn-primary grow" data-close onclick="reviewEntry('${e.id}','approve')">${ic("check")}${de ? "Genehmigen" : "Approve"}</button>`
        : `<button class="btn btn-secondary grow" data-close>${ic("edit")}${de ? "Korrigieren" : "Correct"}</button><span class="badge emerald" style="align-self:center;padding:0 14px;height:42px">${ic("check")}${de ? "Genehmigt" : "Approved"}</span>`}
    </div>`);
}
window.openTimeEntry = openTimeEntry;
function reviewEntry(id, action) {
  const e = TIME_ENTRIES.find((x) => x.id === id); e.status = action === "approve" ? "approved" : "rejected";
  toast(action === "approve" ? (state.lang === "de" ? "Eintrag genehmigt" : "Entry approved") : (state.lang === "de" ? "Eintrag abgelehnt" : "Entry rejected"));
  mountScreen(); SCREEN_INIT.zeiterfassung();
}
window.reviewEntry = reviewEntry;

/* ════════════════════════════════════════════
   ABTEILUNGEN — Departments (Department model)
   ════════════════════════════════════════════ */
const DEPARTMENTS = [
  { id: "d1", name: "Wareneingang", color: "#059669", location: "Amazon-Fra3", members: ["e1", "e4"] },
  { id: "d2", name: "Kommissionierung", color: "#2563eb", location: "Amazon-Fra3", members: ["e2"] },
  { id: "d3", name: "Sortierung Nacht", color: "#7c3aed", location: "DHL-Hub Köln", members: ["e3", "e5"] },
  { id: "d4", name: "Retouren", color: "#d97706", location: "Zalando-Erfurt", members: ["e6"] },
];
SCREENS.departments = function () {
  const de = state.lang === "de";
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="text-2" style="font-size:var(--t-sm)">${DEPARTMENTS.length} ${de ? "Abteilungen · für Personalbedarf & Planung" : "departments · for staffing & planning"}</div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Abteilung anlegen" : "New department"}')">${ic("plus")}${de ? "Abteilung" : "Department"}</button>
    </div>
    <div class="grid dep-grid">
      ${DEPARTMENTS.map((d) => { const members = d.members.map((id) => TEAM.find((e) => e.id === id)).filter(Boolean);
        return `<div class="card card-pad dep-card">
          <div class="shift-accent" style="position:absolute;left:0;top:0;bottom:0;width:5px;background:${d.color};border-radius:var(--r-lg) 0 0 var(--r-lg)"></div>
          <div class="flex between items-center" style="margin-bottom:14px">
            <div class="flex items-center gap-3"><div class="kpi-ic" style="background:${d.color}1a;color:${d.color}">${ic("layers")}</div><div><div class="r-title" style="font-size:var(--t-md)">${d.name}</div><div class="r-sub flex items-center gap-1">${ic("mapPin")}${d.location}</div></div></div>
            <button class="icon-btn" onclick="toast('${de ? "Bearbeiten" : "Edit"}')">${ic("dots")}</button>
          </div>
          <div class="flex between items-center">
            <div class="flex items-center" style="padding-left:6px">${members.map((m) => `<div style="margin-left:-8px;border:2px solid var(--surface);border-radius:50%">${avatar(m, "sm")}</div>`).join("") || `<span class="text-3" style="font-size:var(--t-sm)">${de ? "Keine Mitarbeiter" : "No staff"}</span>`}</div>
            <span class="badge gray num">${members.length} ${de ? "MA" : "staff"}</span>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <style>.dep-grid{ grid-template-columns:1fr; } .dep-card{ position:relative; padding-left:24px; } @media (min-width:1024px){ .app.wide .dep-grid{ grid-template-columns:repeat(2,1fr); } }</style>`;
};

/* ════════════════════════════════════════════
   QUALIFIKATIONEN — Skills (Skill + EmployeeSkill, §34a)
   EmployeeSkill: certificateNumber, issuingAuthority, issuedAt, expiresAt, documentUrl
   ════════════════════════════════════════════ */
const SKILLS = [
  { id: "sk1", name: "§34a Sachkunde", category: "Sicherheit", required: true },
  { id: "sk2", name: "Ersthelfer", category: "Sicherheit", required: false },
  { id: "sk3", name: "Gabelstaplerschein", category: "Logistik", required: false },
  { id: "sk4", name: "Brandschutzhelfer", category: "Sicherheit", required: false },
];
const EMP_SKILLS = [
  { emp: "e1", skill: "sk1", certificateNumber: "34a-BE-2023-1187", issuingAuthority: "IHK Berlin", issuedAt: "2023-02-10", expiresAt: "2028-02-10", doc: true },
  { emp: "e1", skill: "sk2", certificateNumber: "EH-2024-0421", issuingAuthority: "DRK", issuedAt: "2024-05-02", expiresAt: "2026-05-02", doc: true },
  { emp: "e2", skill: "sk1", certificateNumber: "34a-BE-2024-0902", issuingAuthority: "IHK Berlin", issuedAt: "2024-01-08", expiresAt: "2026-04-12", doc: true },
  { emp: "e3", skill: "sk1", certificateNumber: "34a-NW-2022-3310", issuingAuthority: "IHK Köln", issuedAt: "2022-09-20", expiresAt: "2026-03-20", doc: false },
  { emp: "e5", skill: "sk3", certificateNumber: "GS-2023-7781", issuingAuthority: "TÜV", issuedAt: "2023-03-15", expiresAt: "2027-03-15", doc: true },
];
function skillState(es) {
  if (!es.expiresAt) return "valid";
  const days = Math.round((new Date(es.expiresAt) - new Date("2026-03-02")) / 86400000);
  if (days < 0) return "expired"; if (days < 45) return "soon"; return "valid";
}
SCREENS.skills = function () {
  const de = state.lang === "de";
  const expSoon = EMP_SKILLS.filter((es) => skillState(es) === "soon").length;
  const expired = EMP_SKILLS.filter((es) => skillState(es) === "expired").length;
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" });
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="grid sk-kpi">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic">${ic("award")}</div></div><div class="kpi-label">${de ? "Qualifikationen" : "Qualifications"}</div><div class="kpi-val num">${SKILLS.length}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${ic("clock")}</div></div><div class="kpi-label">${de ? "Läuft bald ab" : "Expiring soon"}</div><div class="kpi-val num ${expSoon ? "warn" : ""}">${expSoon}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic red">${ic("alert")}</div></div><div class="kpi-label">${de ? "Abgelaufen" : "Expired"}</div><div class="kpi-val num" style="${expired ? "color:var(--danger)" : ""}">${expired}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Nachweise & Zertifikate" : "Certificates & proofs"}</span><button class="btn btn-primary btn-sm act" onclick="toast('${de ? "Nachweis hinzufügen" : "Add certificate"}')">${ic("plus")}${de ? "Nachweis" : "Certificate"}</button></div>
      <div class="card-body" style="padding-top:8px">
        ${EMP_SKILLS.map((es) => { const emp = TEAM.find((x) => x.id === es.emp); const sk = SKILLS.find((s) => s.id === es.skill); const st = skillState(es);
          const stBadge = st === "expired" ? `<span class="badge red"><span class="pip"></span>${de ? "Abgelaufen" : "Expired"}</span>` : st === "soon" ? `<span class="badge amber"><span class="pip"></span>${de ? "Läuft bald ab" : "Expiring"}</span>` : `<span class="badge emerald"><span class="pip"></span>${de ? "Gültig" : "Valid"}</span>`;
          return `<div class="irow">
            ${avatar(emp, "sm")}
            <div class="grow" style="min-width:0">
              <div class="r-title" style="font-size:var(--t-base)">${emp.first} ${emp.last} · ${sk.name}${sk.required ? ` <span class="badge red" style="height:18px;font-size:10px">${de ? "Pflicht" : "Required"}</span>` : ""}</div>
              <div class="r-sub">${es.certificateNumber} · ${es.issuingAuthority} · ${de ? "gültig bis" : "valid until"} ${fmt(es.expiresAt)}</div>
            </div>
            ${es.doc ? `<button class="icon-btn" title="${de ? "Scan ansehen" : "View scan"}" onclick="toast('${de ? "Dokument öffnen" : "Open document"}')">${ic("fileCheck")}</button>` : `<span class="badge amber" style="height:22px">${de ? "Kein Scan" : "No scan"}</span>`}
            ${stBadge}
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>
  <style>.sk-kpi{ grid-template-columns:repeat(3,1fr); } @media (max-width:560px){ .sk-kpi{ grid-template-columns:1fr; } }</style>`;
};

/* ════════════════════════════════════════════
   COMPLIANCE — §34a, ArbZG, eAU, Betriebsrat readiness
   ════════════════════════════════════════════ */
SCREENS.compliance = function () {
  const de = state.lang === "de";
  const checks = [
    { ic: "shield", t: de ? "§34a Sachkunde-Nachweise" : "§34a proof of competence", d: de ? "1 Nachweis ohne Scan, 2 laufen in < 45 Tagen ab" : "1 proof without scan, 2 expiring in < 45 days", st: "warn", n: "3/5" },
    { ic: "coffee", t: de ? "ArbZG §4 Pausen" : "ArbZG §4 breaks", d: de ? "Alle Schichten erfüllen die Pausenpflicht" : "All shifts meet break requirements", st: "pass", n: "100%" },
    { ic: "clock", t: de ? "ArbZG §5 Ruhezeit (11 Std)" : "ArbZG §5 rest period (11 hrs)", d: de ? "Keine Verstöße im laufenden Monat" : "No violations this month", st: "pass", n: "0" },
    { ic: "card", t: de ? "eAU-Abruf (DATEV hr:eau)" : "eAU retrieval (DATEV hr:eau)", d: de ? "DATEV verbunden · 4 Abrufe diesen Monat" : "DATEV connected · 4 retrievals this month", st: "pass", n: de ? "Verbunden" : "Connected" },
    { ic: "scale", t: de ? "Betriebsrat-Mitbestimmung" : "Works-council co-determination", d: de ? "1 Dienstplan wartet auf Zustimmung" : "1 schedule awaiting approval", st: "warn", n: "1" },
    { ic: "fileCheck", t: de ? "Revisionssichere Zeiterfassung" : "Audit-proof time tracking", d: de ? "Lückenloser Audit-Trail aktiv" : "Complete audit trail active", st: "pass", n: "100%" },
  ];
  const pass = checks.filter((c) => c.st === "pass").length;
  const score = Math.round((pass / checks.length) * 100);
  const stCfg = { pass: ["emerald", "checkCircle", de ? "OK" : "OK"], warn: ["amber", "alert", de ? "Prüfen" : "Review"], fail: ["red", "x", de ? "Fehler" : "Fail"] };
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="background:linear-gradient(135deg,var(--brand-600),var(--brand-800));border:none;color:#fff">
      <div class="flex between items-center wrap gap-4">
        <div><div style="font-size:var(--t-sm);opacity:.85;font-weight:600">${de ? "Compliance-Status" : "Compliance status"}</div><div style="font-size:var(--t-2xl);font-weight:800;letter-spacing:-.02em;margin-top:2px">${de ? "Deutsches Arbeitsrecht" : "German labor law"}</div><div style="font-size:var(--t-sm);opacity:.85;margin-top:6px">${pass}/${checks.length} ${de ? "Prüfungen bestanden" : "checks passing"}</div></div>
        <div style="text-align:right"><div class="num" style="font-size:var(--t-5xl);font-weight:850;line-height:1">${score}%</div></div>
      </div>
      <div class="track" style="margin-top:16px;background:rgba(255,255,255,.2)"><i style="width:${score}%;background:#fff"></i></div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Prüfungen" : "Checks"}</span><button class="btn btn-secondary btn-sm act" onclick="setView('pruefungssicher')">${ic("fileCheck")}${de ? "Dossier erstellen" : "Generate dossier"}</button></div>
      <div class="card-body" style="padding-top:10px">
        ${checks.map((c) => { const [cls, cic, lbl] = stCfg[c.st];
          return `<div class="irow"><div class="dline-ic" style="background:var(--${c.st === "pass" ? "success" : c.st === "warn" ? "warning" : "danger"}-soft);color:var(--${c.st === "pass" ? "brand-600" : c.st === "warn" ? "warning" : "danger"})">${ic(c.ic)}</div>
            <div class="grow"><div class="r-title" style="font-size:var(--t-base)">${c.t}</div><div class="r-sub">${c.d}</div></div>
            <div class="flex items-center gap-3"><span class="num text-2" style="font-weight:700;font-size:var(--t-sm)">${c.n}</span><span class="badge ${cls}">${ic(cic)}${lbl}</span></div>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   PRÜFUNGSSICHER — Audit dossiers (AuditDossier)
   readinessScore, passCount/warnCount/failCount, contentHash
   ════════════════════════════════════════════ */
const DOSSIERS = [
  { id: "ad1", period: "Februar 2026", periodEn: "February 2026", readinessScore: 96, passCount: 5, warnCount: 1, failCount: 0, hash: "a3f8…91c2", generatedAt: "2026-03-01" },
  { id: "ad2", period: "Januar 2026", periodEn: "January 2026", readinessScore: 100, passCount: 6, warnCount: 0, failCount: 0, hash: "7d12…4ab9", generatedAt: "2026-02-01" },
  { id: "ad3", period: "Dezember 2025", periodEn: "December 2025", readinessScore: 92, passCount: 5, warnCount: 1, failCount: 0, hash: "e0c5…77f1", generatedAt: "2026-01-02" },
];
SCREENS.pruefungssicher = function () {
  const de = state.lang === "de";
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" });
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div class="kpi-ic" style="width:48px;height:48px">${ic("fileCheck")}</div>
      <div class="grow" style="min-width:200px"><div class="r-title" style="font-size:var(--t-md)">${de ? "Revisionssichere Dossiers" : "Audit-proof dossiers"}</div><div class="r-sub">${de ? "Eingefrorene, manipulationssichere Compliance-Berichte für Zoll, FKS & Wirtschaftsprüfer" : "Frozen, tamper-evident compliance reports for customs, labor inspections & auditors"}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Dossier wird erstellt…" : "Generating dossier…"}')">${ic("plus")}${de ? "Neues Dossier" : "New dossier"}</button>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Erstellte Dossiers" : "Generated dossiers"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${DOSSIERS.map((d) => `<div class="irow">
          <div class="dline-ic" style="background:var(--success-soft);color:var(--brand-600)">${ic("shield")}</div>
          <div class="grow" style="min-width:0">
            <div class="r-title" style="font-size:var(--t-base)">${de ? d.period : d.periodEn} · ${de ? "Bereitschaft" : "Readiness"} ${d.readinessScore}%</div>
            <div class="r-sub flex items-center gap-2" style="flex-wrap:wrap"><span class="flex items-center gap-1" style="color:var(--success)">${ic("check")}${d.passCount}</span> <span class="flex items-center gap-1" style="color:var(--warning)">${ic("alert")}${d.warnCount}</span> <span class="mono text-3">SHA-256 ${d.hash}</span></div>
          </div>
          <div class="flex items-center gap-2"><span class="text-3" style="font-size:12px;white-space:nowrap">${fmt(d.generatedAt)}</span><button class="icon-btn" onclick="toast('PDF')">${ic("download")}</button></div>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   BETRIEBSRAT — Works-council co-determination (ShiftPlanApproval)
   status: PENDING|APPROVED|REJECTED|WITHDRAWN · 3-day deadline
   ════════════════════════════════════════════ */
const PLAN_APPROVALS = [
  { id: "pa1", title: "KW 11 · Amazon-Fra3", periodStart: "2026-03-09", periodEnd: "2026-03-15", status: "PENDING", deadline: "2026-03-06", submittedAt: "2026-03-03" },
  { id: "pa2", title: "KW 10 · Alle Standorte", periodStart: "2026-03-02", periodEnd: "2026-03-08", status: "APPROVED", deadline: "2026-02-28", submittedAt: "2026-02-25" },
  { id: "pa3", title: "KW 09 · DHL-Hub Köln", periodStart: "2026-02-23", periodEnd: "2026-03-01", status: "REJECTED", deadline: "2026-02-21", submittedAt: "2026-02-18" },
];
SCREENS.betriebsrat = function () {
  const de = state.lang === "de";
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { day: "numeric", month: "short" });
  const stCfg = {
    PENDING: ["amber", de ? "Ausstehend" : "Pending"], APPROVED: ["emerald", de ? "Zugestimmt" : "Approved"],
    REJECTED: ["red", de ? "Abgelehnt" : "Rejected"], WITHDRAWN: ["gray", de ? "Zurückgezogen" : "Withdrawn"],
  };
  const members = [TEAM[0], TEAM[3]];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div class="kpi-ic" style="width:48px;height:48px">${ic("scale")}</div>
      <div class="grow" style="min-width:200px"><div class="r-title" style="font-size:var(--t-md)">${de ? "Betriebsrat-Mitbestimmung" : "Works-council co-determination"}</div><div class="r-sub">${de ? "Dienstpläne nach BetrVG §87 zur Zustimmung vorlegen — mit 3-Tage-Frist" : "Submit schedules for approval under BetrVG §87 — with a 3-day deadline"}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Dienstplan vorlegen" : "Submit schedule"}')">${ic("plus")}${de ? "Vorlegen" : "Submit"}</button>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Vorgelegte Dienstpläne" : "Submitted schedules"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${PLAN_APPROVALS.map((p) => { const [cls, lbl] = stCfg[p.status];
          return `<div class="irow">
            <div class="dline-ic" style="background:var(--${cls === "emerald" ? "success" : cls === "amber" ? "warning" : cls === "red" ? "danger" : "surface"}-soft);color:var(--${cls === "emerald" ? "brand-600" : cls === "amber" ? "warning" : cls === "red" ? "danger" : "text-3"})">${ic("calendar")}</div>
            <div class="grow"><div class="r-title" style="font-size:var(--t-base)">${p.title}</div><div class="r-sub">${fmt(p.periodStart)} – ${fmt(p.periodEnd)}${p.status === "PENDING" ? ` · <span style="color:var(--warning);font-weight:650">${de ? "Frist" : "Deadline"} ${fmt(p.deadline)}</span>` : ""}</div></div>
            <span class="badge ${cls}">${p.status === "APPROVED" || p.status === "PENDING" ? '<span class="pip"></span>' : ""}${lbl}</span>
          </div>`;
        }).join("")}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Betriebsratsmitglieder" : "Works-council members"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${members.map((m, i) => `<div class="irow">${avatar(m, "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${m.first} ${m.last}</div><div class="r-sub">${i === 0 ? (de ? "Vorsitzende:r" : "Chair") : (de ? "Mitglied" : "Member")}</div></div>${i === 0 ? `<span class="badge emerald">${de ? "Vorsitz" : "Chair"}</span>` : ""}</div>`).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   LEISTUNGSNACHWEIS — Service proof (ServiceReport + ServiceVisit)
   ServiceReport.status: ENTWURF|ERSTELLT|VERSENDET
   ServiceVisit.status: GEPLANT|EINGECHECKT|ABGESCHLOSSEN|STORNIERT
   ════════════════════════════════════════════ */
const SERVICE_REPORTS = [
  { id: "sr1", title: "Amazon-Fra3 · Februar 2026", status: "ENTWURF", periodStart: "2026-02-01", periodEnd: "2026-02-28", totalVisits: 22, completedVisits: 19 },
  { id: "sr2", title: "DHL-Hub Köln · Februar 2026", status: "ERSTELLT", periodStart: "2026-02-01", periodEnd: "2026-02-28", totalVisits: 16, completedVisits: 16 },
  { id: "sr3", title: "Zalando-Erfurt · Januar 2026", status: "VERSENDET", periodStart: "2026-01-01", periodEnd: "2026-01-31", totalVisits: 12, completedVisits: 12 },
];
const SERVICE_VISITS = [
  { id: "sv1", emp: "e1", location: "Amazon-Fra3", scheduledDate: "2026-03-02", status: "ABGESCHLOSSEN", checkIn: "08:02", checkOut: "16:14", signer: "M. Hoffmann (Objektleiter)" },
  { id: "sv2", emp: "e4", location: "Amazon-Fra3", scheduledDate: "2026-03-02", status: "EINGECHECKT", checkIn: "06:00", checkOut: null, signer: null },
  { id: "sv3", emp: "e5", location: "DHL-Hub Köln", scheduledDate: "2026-03-02", status: "GEPLANT", checkIn: null, checkOut: null, signer: null },
];
SCREENS.leistungsnachweis = function () {
  const de = state.lang === "de";
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { day: "numeric", month: "short" });
  const repCfg = { ENTWURF: ["gray", de ? "Entwurf" : "Draft"], ERSTELLT: ["blue", de ? "Erstellt" : "Generated"], VERSENDET: ["emerald", de ? "Versendet" : "Sent"] };
  const visCfg = { GEPLANT: ["gray", de ? "Geplant" : "Scheduled"], EINGECHECKT: ["amber", de ? "Eingecheckt" : "Checked in"], ABGESCHLOSSEN: ["emerald", de ? "Abgeschlossen" : "Completed"], STORNIERT: ["red", de ? "Storniert" : "Cancelled"] };
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div class="kpi-ic" style="width:48px;height:48px">${ic("clipboard")}</div>
      <div class="grow" style="min-width:200px"><div class="r-title" style="font-size:var(--t-md)">${de ? "Leistungsnachweis" : "Service proof"}</div><div class="r-sub">${de ? "Einsätze mit Check-in, Check-out und Unterschrift — als revisionssicheres Sammel-PDF" : "Visits with check-in, check-out and signature — as a tamper-evident consolidated PDF"}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Bericht erstellen" : "Generate report"}')">${ic("plus")}${de ? "Bericht" : "Report"}</button>
    </div>

    <div>
      <div class="section-title" style="margin-top:4px">${de ? "Sammel-Berichte" : "Consolidated reports"}</div>
      ${SERVICE_REPORTS.map((r) => { const [cls, lbl] = repCfg[r.status]; const pct = Math.round((r.completedVisits / r.totalVisits) * 100);
        return `<div class="row" onclick="toast('${r.title}')" style="border-radius:var(--r-md)">
          <div class="dline-ic" style="background:var(--surface-2)">${ic("fileCheck")}</div>
          <div class="grow" style="min-width:0"><div class="r-title">${r.title}</div><div class="r-sub">${fmt(r.periodStart)} – ${fmt(r.periodEnd)} · ${r.completedVisits}/${r.totalVisits} ${de ? "Einsätze" : "visits"} (${pct}%)</div></div>
          <span class="badge ${cls}">${r.status === "VERSENDET" ? ic("check") : ""}${lbl}</span>
          <span class="chev">${ic("chevR")}</span>
        </div>`;
      }).join("")}
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Einsätze heute" : "Visits today"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${SERVICE_VISITS.map((v) => { const emp = TEAM.find((x) => x.id === v.emp); const [cls, lbl] = visCfg[v.status];
          return `<div class="irow">${avatar(emp, "sm")}
            <div class="grow" style="min-width:0"><div class="r-title" style="font-size:var(--t-base)">${emp.first} ${emp.last} · ${v.location}</div><div class="r-sub">${v.checkIn ? `${de ? "Check-in" : "Check-in"} ${v.checkIn}` : (de ? "Noch nicht eingecheckt" : "Not checked in")}${v.checkOut ? ` · Check-out ${v.checkOut}` : ""}${v.signer ? ` · ${ic("fileCheck")} ${v.signer}` : ""}</div></div>
            <span class="badge ${cls}">${v.status === "ABGESCHLOSSEN" ? ic("check") : v.status === "EINGECHECKT" ? '<span class="pip"></span>' : ""}${lbl}</span>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>`;
};

/* ════════════════════════════════════════════
   JAHRESPLANUNG — Annual planning (vacation/coverage heatmap)
   ════════════════════════════════════════════ */
SCREENS.jahresplanung = function () {
  const de = state.lang === "de";
  const months = de ? ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // per employee, vacation days planned per month (demo)
  const plan = {
    e1: [0, 0, 2, 0, 0, 5, 5, 0, 0, 2, 0, 4], e2: [0, 0, 0, 3, 0, 0, 10, 0, 0, 0, 0, 5],
    e3: [2, 0, 5, 0, 0, 0, 0, 8, 0, 0, 0, 3], e4: [0, 0, 0, 6, 0, 0, 0, 0, 5, 0, 0, 4],
    e5: [0, 0, 2, 0, 5, 0, 0, 0, 0, 3, 0, 6], e6: [0, 0, 0, 0, 0, 4, 4, 0, 0, 0, 0, 0],
  };
  const cell = (v) => {
    if (!v) return "var(--surface-2)";
    if (v <= 2) return "color-mix(in oklab, var(--brand) 30%, transparent)";
    if (v <= 5) return "color-mix(in oklab, var(--brand) 60%, transparent)";
    return "var(--brand)";
  };
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="sched-week" style="margin:0"><button class="icon-btn">${ic("chevL")}</button><div class="rng num">2026</div><button class="icon-btn">${ic("chevR")}</button></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Urlaub eintragen" : "Add vacation"}')">${ic("plus")}${de ? "Urlaub" : "Vacation"}</button>
    </div>
    <div class="card card-pad">
      <div style="overflow-x:auto"><table class="jp-table">
        <thead><tr><th>${de ? "Mitarbeiter" : "Employee"}</th>${months.map((m) => `<th>${m}</th>`).join("")}<th style="text-align:right">${de ? "Ges." : "Tot."}</th></tr></thead>
        <tbody>
          ${TEAM.map((e) => { const row = plan[e.id] || []; const tot = row.reduce((s, x) => s + x, 0);
            return `<tr><td class="jp-emp"><div class="flex items-center gap-2">${avatar(e, "sm")}<span style="font-size:var(--t-sm);font-weight:600;white-space:nowrap">${e.first} ${e.last[0]}.</span></div></td>${row.map((v) => `<td><div class="jp-cell" style="background:${cell(v)}" title="${v} ${de ? "Tage" : "days"}">${v || ""}</div></td>`).join("")}<td class="num" style="text-align:right;font-weight:700">${tot}</td></tr>`;
          }).join("")}
        </tbody>
      </table></div>
      <div class="flex items-center gap-4 mt-4 wrap" style="font-size:var(--t-sm)">
        <span class="flex items-center gap-2"><span style="width:16px;height:16px;border-radius:5px;background:color-mix(in oklab,var(--brand) 30%,transparent)"></span>1–2 ${de ? "Tage" : "days"}</span>
        <span class="flex items-center gap-2"><span style="width:16px;height:16px;border-radius:5px;background:color-mix(in oklab,var(--brand) 60%,transparent)"></span>3–5</span>
        <span class="flex items-center gap-2"><span style="width:16px;height:16px;border-radius:5px;background:var(--brand)"></span>6+</span>
      </div>
    </div>
  </div>
  <style>
    .jp-table{ width:100%; border-collapse:collapse; min-width:680px; }
    .jp-table th{ font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; padding:0 0 10px; text-align:center; }
    .jp-table th:first-child{ text-align:left; }
    .jp-table td{ padding:4px 3px; text-align:center; }
    .jp-emp{ text-align:left !important; padding-right:12px !important; }
    .jp-cell{ height:30px; border-radius:6px; display:grid; place-items:center; font-size:11px; font-weight:700; color:#fff; }
  </style>`;
};
