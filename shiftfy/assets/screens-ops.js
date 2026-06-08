/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Screens · Operations group
   Absences · Availability · Shift Swap · SOS · Tickets
   Full EN/DE copy, interactive states
   ═══════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════
   ABSENCES & LEAVE MANAGEMENT
   ════════════════════════════════════════════ */
const ABSENCE_REQS = [
  { id: "a1", emp: "e4", type: "vacation", from: "2026-03-12", to: "2026-03-16", days: 5, st: "pending", note: { de: "Familienurlaub – lange im Voraus geplant.", en: "Family holiday – planned well in advance." } },
  { id: "a2", emp: "e3", type: "sick", from: "2026-03-02", to: "2026-03-03", days: 2, st: "pending", note: { de: "Ärztliches Attest nachgereicht.", en: "Doctor's note submitted." } },
  { id: "a3", emp: "e2", type: "parental", from: "2026-04-01", to: "2026-06-30", days: 64, st: "pending", note: { de: "Elternzeit-Antrag, 3 Monate.", en: "Parental leave request, 3 months." } },
  { id: "a4", emp: "e5", type: "vacation", from: "2026-03-24", to: "2026-03-25", days: 2, st: "approved", note: { de: "Brückentag.", en: "Long-weekend bridge day." } },
  { id: "a5", emp: "e6", type: "sick", from: "2026-02-26", to: "2026-02-27", days: 2, st: "rejected", note: { de: "Ohne Krankmeldung.", en: "No sick certificate provided." } },
];
const ABS_TYPES = {
  vacation: { de: "Urlaub", en: "Vacation", ic: "palm", color: "#059669", soft: "var(--success-soft)" },
  sick: { de: "Krankheit", en: "Sick leave", ic: "alert", color: "#dc2626", soft: "var(--danger-soft)" },
  parental: { de: "Elternzeit", en: "Parental leave", ic: "user", color: "#2563eb", soft: "var(--info-soft)" },
};

SCREENS.absences = function () {
  const de = state.lang === "de";
  const pending = ABSENCE_REQS.filter((r) => r.st === "pending");
  const kpis = [
    { label: de ? "Offene Anträge" : "Pending requests", val: pending.length, ic: "calOff", cls: "amber" },
    { label: de ? "Abwesend heute" : "Out today", val: 1, ic: "palm", cls: "blue" },
    { label: de ? "Krankenquote" : "Sick rate", val: "3.1%", ic: "alert", cls: "red" },
    { label: de ? "Genehmigt (Monat)" : "Approved (mo)", val: 8, ic: "checkCircle" },
  ];
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { day: "numeric", month: "short" });
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="segmented" id="abs-filter"><button class="active">${de ? "Alle" : "All"}</button><button>${de ? "Offen" : "Pending"}</button><button>${de ? "Genehmigt" : "Approved"}</button><button>${de ? "Abgelehnt" : "Rejected"}</button></div>
      <button class="btn btn-primary btn-sm" onclick="openAbsenceNew()">${ic("plus")}${de ? "Neuer Antrag" : "New request"}</button>
    </div>
    <div class="grid abs-kpi" id="abs-kpi">
      ${kpis.map((k) => `<div class="kpi"><div class="kpi-top"><div class="kpi-ic ${k.cls || ""}">${ic(k.ic)}</div></div><div class="kpi-label">${k.label}</div><div class="kpi-val num">${k.val}</div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Anträge zur Genehmigung" : "Requests to review"}</span><span class="badge amber act"><span class="pip"></span>${pending.length} ${de ? "offen" : "pending"}</span></div>
      <div class="card-body" style="padding-top:10px">
        ${pending.map((r) => { const ty = ABS_TYPES[r.type]; const e = TEAM.find((x) => x.id === r.emp);
          return `<div class="abs-req">
            <div class="flex items-center gap-3" style="min-width:0">${avatar(e, "sm")}
              <div style="min-width:0"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}</div>
              <div class="r-sub flex items-center gap-2" style="flex-wrap:wrap"><span class="badge" style="background:${ty.soft};color:${ty.color};height:20px">${ic(ty.ic)}${de ? ty.de : ty.en}</span><span>${fmt(r.from)} – ${fmt(r.to)} · ${r.days} ${de ? "Tage" : "days"}</span></div></div>
            </div>
            <div class="abs-note text-2" style="font-size:var(--t-sm)">"${de ? r.note.de : r.note.en}"</div>
            <div class="flex gap-2 abs-actions">
              <button class="btn btn-sm btn-primary" data-approve="${r.id}">${ic("check")}${de ? "Genehmigen" : "Approve"}</button>
              <button class="btn btn-sm btn-danger" data-reject="${r.id}">${ic("x")}${de ? "Ablehnen" : "Reject"}</button>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Bearbeitet" : "Processed"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${ABSENCE_REQS.filter((r) => r.st !== "pending").map((r) => { const ty = ABS_TYPES[r.type]; const e = TEAM.find((x) => x.id === r.emp);
          return `<div class="irow"><div class="dline-ic" style="background:${ty.soft};color:${ty.color}">${ic(ty.ic)}</div>
            <div class="grow"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last} · ${de ? ty.de : ty.en}</div><div class="r-sub">${fmt(r.from)} – ${fmt(r.to)} · ${r.days} ${de ? "Tage" : "days"}</div></div>
            <span class="badge ${r.st === "approved" ? "emerald" : "red"}"><span class="pip"></span>${r.st === "approved" ? (de ? "Genehmigt" : "Approved") : (de ? "Abgelehnt" : "Rejected")}</span></div>`;
        }).join("")}
      </div>
    </div>
  </div>
  <style>
    .abs-kpi{ grid-template-columns:repeat(2,1fr); } @media (min-width:1024px){ .app.wide .abs-kpi{ grid-template-columns:repeat(4,1fr); } }
    .abs-req{ display:grid; grid-template-columns:1fr; gap:12px; padding:16px 0; align-items:center; } .abs-req + .abs-req{ border-top:1px solid var(--border); }
    .abs-note{ font-style:italic; }
    @media (min-width:1024px){ .app.wide .abs-req{ grid-template-columns:1.4fr 1.4fr auto; } .app.wide .abs-actions{ justify-content:flex-end; } }
  </style>`;
};
SCREEN_INIT.absences = function () {
  const de = state.lang === "de";
  segmentedBind("#abs-filter");
  document.querySelectorAll("#content [data-approve]").forEach((b) => (b.onclick = () => {
    const r = ABSENCE_REQS.find((x) => x.id === b.dataset.approve); r.st = "approved";
    toast(de ? "Antrag genehmigt" : "Request approved"); mountScreen(); SCREEN_INIT.absences();
  }));
  document.querySelectorAll("#content [data-reject]").forEach((b) => (b.onclick = () => {
    const r = ABSENCE_REQS.find((x) => x.id === b.dataset.reject); r.st = "rejected";
    toast(de ? "Antrag abgelehnt" : "Request rejected"); mountScreen(); SCREEN_INIT.absences();
  }));
};

/* New absence request — with deductible-days preview (holidays excluded, per Bundesland) */
function openAbsenceNew() {
  const de = state.lang === "de";
  const cats = de
    ? [["vacation", "Urlaub"], ["sick", "Krankheit"], ["parental", "Elternzeit"], ["special", "Sonderurlaub"], ["unpaid", "Unbezahlt"]]
    : [["vacation", "Vacation"], ["sick", "Sick leave"], ["parental", "Parental leave"], ["special", "Special leave"], ["unpaid", "Unpaid"]];
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${de ? "Neuer Antrag" : "New request"}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="field"><label>${de ? "Mitarbeiter" : "Employee"}</label><select class="select">${TEAM.map((e) => `<option>${e.first} ${e.last}</option>`).join("")}</select></div>
      <div class="field"><label>${de ? "Kategorie" : "Category"}</label><select class="select" id="ab-cat">${cats.map((c) => `<option value="${c[0]}">${c[1]}</option>`).join("")}</select></div>
      <div class="field-row">
        <div class="field"><label>${de ? "Von" : "Start date"}</label><input class="input" type="date" id="ab-from" value="2026-06-15"><label class="checkrow" style="margin-top:8px;font-size:13px"><input type="checkbox" id="ab-half-from">${de ? "Halber Tag" : "Half day"}</label></div>
        <div class="field"><label>${de ? "Bis" : "End date"}</label><input class="input" type="date" id="ab-to" value="2026-06-19"><label class="checkrow" style="margin-top:8px;font-size:13px"><input type="checkbox" id="ab-half-to">${de ? "Halber Tag" : "Half day"}</label></div>
      </div>
      <div class="field"><label>${de ? "Bundesland (Feiertage)" : "State (public holidays)"}</label><select class="select" id="ab-land"><option>Hessen</option><option>Nordrhein-Westfalen</option><option>Bayern</option><option>Berlin</option></select></div>
      <div class="card" id="ab-preview" style="box-shadow:none;background:var(--success-soft);border-color:transparent;padding:14px">
        <div class="flex items-center gap-2" style="color:var(--brand-700)">${ic("calendar")}<span style="font-weight:700" id="ab-deduct">${de ? "5 Arbeitstage abziehbar" : "5 working days deductible"}</span></div>
        <div class="text-2" style="font-size:var(--t-sm);margin-top:6px" id="ab-holiday">${de ? "Feiertage und Wochenenden ausgeschlossen" : "Public holidays and weekends excluded"}</div>
      </div>
      <div class="field" style="margin:16px 0 0"><label>${de ? "Notiz (optional)" : "Note (optional)"}</label><input class="input" placeholder="${de ? "z. B. Familienurlaub" : "e.g. Family holiday"}"></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-ghost grow" data-close>${t("c.cancel")}</button><button class="btn btn-primary grow" data-close onclick="toast('${de ? "Antrag eingereicht" : "Request submitted"}')">${ic("check")}${de ? "Einreichen" : "Submit"}</button></div>`);
  const recalc = () => {
    const from = new Date(document.getElementById("ab-from").value);
    const to = new Date(document.getElementById("ab-to").value);
    if (isNaN(from) || isNaN(to) || to < from) return;
    let work = 0; const d = new Date(from);
    while (d <= to) { const dow = d.getDay(); if (dow !== 0 && dow !== 6) work++; d.setDate(d.getDate() + 1); }
    if (document.getElementById("ab-half-from").checked) work -= 0.5;
    if (document.getElementById("ab-half-to").checked && to > from) work -= 0.5;
    work = Math.max(0, work);
    document.getElementById("ab-deduct").textContent = de ? `${work} Arbeitstage abziehbar` : `${work} working days deductible`;
  };
  ["ab-from", "ab-to", "ab-half-from", "ab-half-to"].forEach((id) => { const el = document.getElementById(id); if (el) el.oninput = el.onchange = recalc; });
  recalc();
}
window.openAbsenceNew = openAbsenceNew;

/* ════════════════════════════════════════════
   AVAILABILITY TRACKER
   ════════════════════════════════════════════ */
/* 0 = unavailable, 1 = available, 2 = preferred */
const AVAIL = {
  mon: [1, 2, 2, 1, 0], tue: [1, 2, 2, 1, 0], wed: [2, 2, 1, 0, 0],
  thu: [1, 1, 2, 2, 1], fri: [2, 2, 2, 1, 1], sat: [0, 0, 1, 2, 2], sun: [0, 0, 0, 1, 1],
};
const SLOT_LABELS = { de: ["Früh 06–10", "Vormittag 10–14", "Nachmittag 14–18", "Abend 18–22", "Nacht 22–06"], en: ["Early 06–10", "Morning 10–14", "Afternoon 14–18", "Evening 18–22", "Night 22–06"] };
SCREENS.availability = function () {
  const de = state.lang === "de";
  const days = de ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const slots = SLOT_LABELS[de ? "de" : "en"];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div class="kpi-ic" style="width:46px;height:46px">${ic("checkCircle")}</div>
      <div class="grow" style="min-width:180px"><div class="r-title" style="font-size:var(--t-md)">${de ? "Meine Verfügbarkeit" : "My availability"}</div><div class="r-sub">${de ? "Tippe auf eine Zelle, um zwischen Bevorzugt, Verfügbar und Nicht verfügbar zu wechseln." : "Tap a cell to cycle Preferred, Available, Unavailable."}</div></div>
      <button class="btn btn-primary btn-sm" onclick="toast('${de ? "Verfügbarkeit gespeichert" : "Availability saved"}')">${ic("check")}${de ? "Speichern" : "Save"}</button>
    </div>

    <div class="card card-pad">
      <div class="avail-grid" id="avail-grid" style="grid-template-columns:minmax(120px,1.4fr) repeat(7,1fr)">
        <div class="avail-corner"></div>
        ${days.map((d) => `<div class="avail-dh">${d}</div>`).join("")}
        ${slots.map((slot, si) => `
          <div class="avail-rh">${slot}</div>
          ${keys.map((k) => { const v = AVAIL[k][si];
            return `<button class="avail-cell v${v}" data-day="${k}" data-slot="${si}" title="${slot}"></button>`;
          }).join("")}
        `).join("")}
      </div>
      <div class="flex items-center gap-4 mt-6 wrap" style="font-size:var(--t-sm)">
        <span class="flex items-center gap-2"><span class="avail-key v2"></span>${de ? "Bevorzugt" : "Preferred"}</span>
        <span class="flex items-center gap-2"><span class="avail-key v1"></span>${de ? "Verfügbar" : "Available"}</span>
        <span class="flex items-center gap-2"><span class="avail-key v0"></span>${de ? "Nicht verfügbar" : "Unavailable"}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Sperrzeiten" : "Blackout dates"}</span><button class="btn btn-ghost btn-sm act" onclick="toast('${de ? "Sperrzeit hinzufügen" : "Add blackout"}')">${ic("plus")}${de ? "Hinzufügen" : "Add"}</button></div>
      <div class="card-body" style="padding-top:8px">
        ${[
          { d: de ? "Mo, 16. März" : "Mon, Mar 16", r: de ? "Arzttermin" : "Doctor appointment" },
          { d: de ? "Fr, 27. März" : "Fri, Mar 27", r: de ? "Privat" : "Personal" },
        ].map((b) => `<div class="irow"><div class="dline-ic" style="background:var(--danger-soft);color:var(--danger)">${ic("calOff")}</div><div class="grow"><div class="r-title" style="font-size:var(--t-base)">${b.d}</div><div class="r-sub">${b.r}</div></div><button class="icon-btn" onclick="this.closest('.irow').remove();toast('${de ? "Entfernt" : "Removed"}')">${ic("trash")}</button></div>`).join("")}
      </div>
    </div>
  </div>
  <style>
    .avail-grid{ display:grid; gap:6px; }
    .avail-corner{ }
    .avail-dh{ text-align:center; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.04em; padding-bottom:4px; }
    .avail-rh{ display:flex; align-items:center; font-size:var(--t-sm); font-weight:600; color:var(--text-2); padding-right:8px; }
    .avail-cell{ height:38px; border:none; border-radius:var(--r-xs); cursor:pointer; transition:all var(--d-fast); }
    .avail-cell:hover{ transform:scale(1.06); }
    .avail-cell.v0{ background:var(--surface-2); border:1px solid var(--border); }
    .avail-cell.v1{ background:var(--brand-200); } .dark .avail-cell.v1{ background:color-mix(in oklab,var(--brand) 28%,transparent); }
    .avail-cell.v2{ background:var(--brand); }
    .avail-key{ width:16px; height:16px; border-radius:5px; }
    .avail-key.v0{ background:var(--surface-2); border:1px solid var(--border-strong); }
    .avail-key.v1{ background:var(--brand-200); } .dark .avail-key.v1{ background:color-mix(in oklab,var(--brand) 28%,transparent); }
    .avail-key.v2{ background:var(--brand); }
    @media (max-width:560px){ .avail-rh{ font-size:11px; } .avail-cell{ height:32px; } }
  </style>`;
};
SCREEN_INIT.availability = function () {
  document.querySelectorAll("#content .avail-cell").forEach((c) => (c.onclick = () => {
    const k = c.dataset.day, si = +c.dataset.slot; const nv = (AVAIL[k][si] + 1) % 3; AVAIL[k][si] = nv;
    c.className = "avail-cell v" + nv;
  }));
};

/* ════════════════════════════════════════════
   SHIFT SWAP MARKETPLACE
   ════════════════════════════════════════════ */
const SWAP_BOARD = [
  { id: "w1", emp: "e2", date: "2026-03-05", start: "14:00", end: "22:00", loc: "Amazon-Fra3", reason: { de: "Familienfeier", en: "Family event" }, offers: 2, st: "open" },
  { id: "w2", emp: "e5", date: "2026-03-07", start: "06:00", end: "14:00", loc: "DHL-Hub Köln", reason: { de: "Arzttermin", en: "Doctor appointment" }, offers: 0, st: "open" },
  { id: "w3", emp: "e3", date: "2026-03-09", start: "22:00", end: "06:00", loc: "DHL-Hub Köln", reason: { de: "Nachtschicht-Tausch", en: "Night-shift swap" }, offers: 1, st: "open" },
  { id: "w4", emp: "e4", date: "2026-03-04", start: "06:00", end: "14:00", loc: "Amazon-Fra3", reason: { de: "Brückentag", en: "Bridge day" }, offers: 1, st: "pending" },
];
SCREENS.shiftSwap = function () {
  const de = state.lang === "de";
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" });
  const mine = SWAP_BOARD.filter((s) => s.emp === "e1" || s.st === "pending");
  const board = SWAP_BOARD.filter((s) => s.st === "open");
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="segmented" id="swap-tabs"><button class="active">${de ? "Marktplatz" : "Marketplace"}</button><button>${de ? "Meine Anfragen" : "My requests"}</button><button>${de ? "Genehmigung" : "Approvals"}</button></div>
      <button class="btn btn-primary btn-sm" onclick="openSwapPost()">${ic("plus")}${de ? "Schicht anbieten" : "Offer a shift"}</button>
    </div>

    <div class="card card-pad" style="background:var(--surface-2);box-shadow:none">
      <div class="flex items-center gap-3"><div class="kpi-ic blue">${ic("swap")}</div><div><div class="r-title" style="font-size:var(--t-base)">${board.length} ${de ? "Schichten verfügbar zum Tausch" : "shifts available to swap"}</div><div class="r-sub">${de ? "Übernimm eine Schicht oder biete deine eigene an. Tausche brauchen Manager-Freigabe." : "Pick up a shift or offer your own. Swaps need manager approval."}</div></div></div>
    </div>

    <div class="grid swap-grid">
      ${board.map((s) => { const e = TEAM.find((x) => x.id === s.emp);
        return `<div class="card card-pad swap-card">
          <div class="flex between items-center" style="margin-bottom:14px">
            <div class="flex items-center gap-3">${avatar(e, "sm")}<div><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}</div><div class="r-sub">${de ? "möchte abgeben" : "wants to give up"}</div></div></div>
            ${s.offers ? `<span class="badge blue">${s.offers} ${de ? "Angebote" : "offers"}</span>` : `<span class="badge gray">${de ? "Neu" : "New"}</span>`}
          </div>
          <div class="swap-shift">
            <div class="shift-accent" style="background:${e.color}"></div>
            <div style="padding:12px 14px;flex:1">
              <div class="num" style="font-weight:750;font-size:var(--t-md)">${s.start} – ${s.end}</div>
              <div class="shift-meta">${fmt(s.date)} <span class="text-3">·</span> ${ic("mapPin")}${s.loc}</div>
            </div>
          </div>
          <div class="text-2" style="font-size:var(--t-sm);margin:12px 0;font-style:italic">"${de ? s.reason.de : s.reason.en}"</div>
          <button class="btn btn-primary btn-block btn-sm" data-claim="${s.id}">${ic("swap")}${de ? "Schicht übernehmen" : "Claim this shift"}</button>
        </div>`;
      }).join("")}
    </div>
  </div>
  <style>.swap-grid{ grid-template-columns:1fr; } @media (min-width:1024px){ .app.wide .swap-grid{ grid-template-columns:repeat(3,1fr); } }
    .swap-shift{ display:flex; border:1px solid var(--border); border-radius:var(--r-md); overflow:hidden; }
  </style>`;
};
SCREEN_INIT.shiftSwap = function () {
  const de = state.lang === "de";
  segmentedBind("#swap-tabs");
  document.querySelectorAll("#content [data-claim]").forEach((b) => (b.onclick = () => {
    const s = SWAP_BOARD.find((x) => x.id === b.dataset.claim); s.st = "pending";
    toast(de ? "Anfrage gesendet – wartet auf Freigabe" : "Request sent – awaiting approval");
    mountScreen(); SCREEN_INIT.shiftSwap();
  }));
};
function openSwapPost() {
  const de = state.lang === "de";
  const myShifts = WEEK_SHIFTS[2].filter((s) => s.emp && s.emp.id === "e1");
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${de ? "Schicht zum Tausch anbieten" : "Offer a shift to swap"}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="field"><label>${de ? "Welche Schicht?" : "Which shift?"}</label><select class="select"><option>Mi 4. März · 08:00 – 16:00 · Amazon-Fra3</option><option>Fr 6. März · 08:00 – 16:00 · Amazon-Fra3</option></select></div>
      <div class="field"><label>${de ? "Grund (sichtbar für das Team)" : "Reason (visible to the team)"}</label><input class="input" placeholder="${de ? "z. B. Arzttermin" : "e.g. Doctor appointment"}"></div>
      <div class="field" style="margin-bottom:0"><label>${de ? "Tausch-Art" : "Swap type"}</label><div class="segmented" style="display:flex"><button class="active grow">${de ? "Abgeben" : "Give away"}</button><button class="grow">${de ? "Tauschen" : "Trade"}</button></div></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-ghost grow" data-close>${t("c.cancel")}</button><button class="btn btn-primary grow" data-close onclick="toast('${de ? "Auf dem Marktplatz veröffentlicht" : "Posted to marketplace"}')">${ic("check")}${de ? "Veröffentlichen" : "Post"}</button></div>`);
}
window.openSwapPost = openSwapPost;

/* ════════════════════════════════════════════
   SOS — URGENT COVERAGE
   ════════════════════════════════════════════ */
const SOS_SHIFTS = [
  { id: "sos1", date: "2026-03-02", start: "16:00", end: "00:00", loc: "Amazon-Fra3", premium: 25, urgency: "critical", qualified: 4, sent: 4, hoursLeft: 6 },
  { id: "sos2", date: "2026-03-03", start: "06:00", end: "14:00", loc: "DHL-Hub Köln", premium: 15, urgency: "high", qualified: 3, sent: 3, hoursLeft: 22 },
];
SCREENS.sos = function () {
  const de = state.lang === "de";
  const fmt = (d) => new Date(d).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "short" });
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="card card-pad sos-hero">
      <div class="flex items-center gap-3" style="margin-bottom:6px"><span class="sos-pulse">${ic("alert")}</span><div><div style="font-size:var(--t-xl);font-weight:800;letter-spacing:-.02em;color:#fff">${de ? "Notfall-Besetzung" : "Emergency Fill"}</div><div style="font-size:var(--t-sm);color:rgba(255,255,255,.85)">${de ? "Unbesetzte Schichten sofort an qualifizierte Mitarbeiter senden" : "Broadcast unfilled shifts to qualified staff instantly"}</div></div></div>
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr;gap:var(--gap-card)">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic red">${ic("alert")}</div></div><div class="kpi-label">${de ? "Kritisch offen" : "Critical open"}</div><div class="kpi-val num warn">${SOS_SHIFTS.filter((s) => s.urgency === "critical").length}</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic blue">${ic("users")}</div></div><div class="kpi-label">${de ? "Benachrichtigt" : "Notified"}</div><div class="kpi-val num">${SOS_SHIFTS.reduce((s, x) => s + x.sent, 0)}</div></div>
    </div>

    ${SOS_SHIFTS.map((s) => {
      const crit = s.urgency === "critical";
      return `<div class="card card-pad sos-card ${crit ? "sos-crit" : ""}">
        <div class="flex between items-start wrap gap-3" style="margin-bottom:14px">
          <div><span class="badge ${crit ? "red" : "amber"}"><span class="pip"></span>${crit ? (de ? "Kritisch" : "Critical") : (de ? "Dringend" : "Urgent")}</span>
            <div class="num" style="font-size:var(--t-xl);font-weight:800;margin-top:10px">${s.start} – ${s.end}</div>
            <div class="shift-meta">${fmt(s.date)} <span class="text-3">·</span> ${ic("mapPin")}${s.loc}</div></div>
          <div class="sos-premium"><div class="kpi-label" style="color:var(--brand-700)">${de ? "Zuschlag" : "Premium"}</div><div class="num" style="font-size:var(--t-2xl);font-weight:800;color:var(--brand-600)">+${s.premium}%</div></div>
        </div>
        <div class="flex between items-center" style="padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:14px">
          <div class="flex items-center gap-2"><span class="${crit ? "" : ""}" style="color:var(--text-2);font-size:var(--t-sm);font-weight:600">${ic("clock")} ${s.hoursLeft}h ${de ? "verbleibend" : "left to fill"}</span></div>
          <div class="text-2" style="font-size:var(--t-sm);font-weight:600">${s.sent}/${s.qualified} ${de ? "benachrichtigt" : "notified"}</div>
        </div>
        <div class="flex gap-2 wrap">
          <button class="btn btn-primary grow" data-broadcast="${s.id}">${ic("bell")}${de ? "Erneut senden" : "Re-broadcast"}</button>
          <button class="btn btn-secondary" onclick="setView('shiftPlan')">${ic("calendar")}${de ? "Schicht ansehen" : "View shift"}</button>
        </div>
      </div>`;
    }).join("")}

    <div class="card">
      <div class="card-head"><span class="ttl">${de ? "Qualifizierte Mitarbeiter" : "Qualified responders"}</span></div>
      <div class="card-body" style="padding-top:8px">
        ${TEAM.slice(1, 5).map((e, i) => `<div class="irow">${avatar(e, "sm")}<div class="grow"><div class="r-title" style="font-size:var(--t-base)">${e.first} ${e.last}</div><div class="r-sub">${e.loc} · ${de ? "verfügbar" : "available"}</div></div>${i === 0 ? `<span class="badge emerald"><span class="pip"></span>${de ? "Hat angenommen" : "Accepted"}</span>` : i === 1 ? `<span class="badge amber">${de ? "Gesehen" : "Seen"}</span>` : `<span class="badge gray">${de ? "Gesendet" : "Sent"}</span>`}</div>`).join("")}
      </div>
    </div>
  </div>
  <style>
    .sos-hero{ background:linear-gradient(135deg,#dc2626,#991b1b); border:none; }
    .sos-pulse{ width:46px; height:46px; border-radius:13px; background:rgba(255,255,255,.18); display:grid; place-items:center; color:#fff; flex-shrink:0; }
    .sos-pulse svg{ width:24px; height:24px; }
    .sos-card.sos-crit{ border-color:color-mix(in oklab,var(--danger) 35%,var(--border)); }
    .sos-premium{ text-align:right; background:var(--success-soft); border-radius:var(--r-md); padding:8px 14px; }
  </style>`;
};
SCREEN_INIT.sos = function () {
  const de = state.lang === "de";
  document.querySelectorAll("#content [data-broadcast]").forEach((b) => (b.onclick = () => toast(de ? "Benachrichtigung an 4 Mitarbeiter gesendet" : "Alert sent to 4 staff members")));
};

/* ════════════════════════════════════════════
   TICKETS — INTERNAL SUPPORT
   ════════════════════════════════════════════ */
const TICKETS = [
  { id: "T-1042", title: { de: "Schichtkonflikt am 8. März", en: "Shift conflict on Mar 8" }, cat: "scheduling", emp: "e3", st: "open", prio: "high", time: { de: "vor 2 Std", en: "2 hrs ago" }, replies: 1 },
  { id: "T-1041", title: { de: "Stundenzahl im Februar stimmt nicht", en: "February hour count looks wrong" }, cat: "payroll", emp: "e5", st: "open", prio: "medium", time: { de: "vor 5 Std", en: "5 hrs ago" }, replies: 0 },
  { id: "T-1039", title: { de: "Stempeluhr lädt nicht auf iPhone", en: "Punch clock won't load on iPhone" }, cat: "bug", emp: "e4", st: "progress", prio: "high", time: { de: "Gestern", en: "Yesterday" }, replies: 3 },
  { id: "T-1036", title: { de: "Urlaubssaldo falsch berechnet", en: "Vacation balance miscalculated" }, cat: "payroll", emp: "e2", st: "resolved", prio: "medium", time: { de: "vor 2 Tagen", en: "2 days ago" }, replies: 4 },
  { id: "T-1031", title: { de: "Bitte Standort Erfurt hinzufügen", en: "Please add Erfurt location" }, cat: "scheduling", emp: "e6", st: "resolved", prio: "low", time: { de: "vor 4 Tagen", en: "4 days ago" }, replies: 2 },
];
const TICKET_CAT = {
  scheduling: { de: "Planung", en: "Scheduling", ic: "calendar", color: "#2563eb" },
  payroll: { de: "Lohn", en: "Payroll", ic: "card", color: "#d97706" },
  bug: { de: "Technik", en: "Technical", ic: "alert", color: "#dc2626" },
};
SCREENS.tickets = function () {
  const de = state.lang === "de";
  const cols = [
    { k: "open", t: de ? "Offen" : "Open", badge: "amber" },
    { k: "progress", t: de ? "In Bearbeitung" : "In progress", badge: "blue" },
    { k: "resolved", t: de ? "Gelöst" : "Resolved", badge: "emerald" },
  ];
  return `
  <div class="grid" style="gap:var(--gap-card)">
    <div class="flex between items-center wrap gap-3">
      <div class="segmented" id="tk-filter"><button class="active">${de ? "Alle" : "All"}</button><button>${de ? "Planung" : "Scheduling"}</button><button>${de ? "Lohn" : "Payroll"}</button><button>${de ? "Technik" : "Technical"}</button></div>
      <button class="btn btn-primary btn-sm" onclick="openTicketNew()">${ic("plus")}${de ? "Ticket erstellen" : "New ticket"}</button>
    </div>
    <div class="grid tk-board">
      ${cols.map((c) => { const items = TICKETS.filter((tk) => tk.st === c.k);
        return `<div class="tk-col">
          <div class="flex between items-center" style="margin-bottom:12px"><div class="flex items-center gap-2"><span class="badge ${c.badge}"><span class="pip"></span>${c.t}</span></div><span class="num text-3" style="font-weight:700">${items.length}</span></div>
          <div class="grid" style="gap:10px">
            ${items.map((tk) => { const cat = TICKET_CAT[tk.cat]; const e = TEAM.find((x) => x.id === tk.emp);
              return `<div class="card card-pad tk-card" data-ticket="${tk.id}" style="padding:14px;cursor:pointer">
                <div class="flex between items-center" style="margin-bottom:10px"><span class="badge" style="background:${cat.color}1a;color:${cat.color};height:20px">${ic(cat.ic)}${de ? cat.de : cat.en}</span><span class="mono text-3" style="font-size:11px">${tk.id}</span></div>
                <div class="r-title" style="font-size:var(--t-base);line-height:1.35;margin-bottom:12px">${de ? tk.title.de : tk.title.en}</div>
                <div class="flex between items-center">
                  <div class="flex items-center gap-2">${avatar(e, "sm")}<span class="text-3" style="font-size:12px">${tk.time[de ? "de" : "en"]}</span></div>
                  <div class="flex items-center gap-2">${tk.prio === "high" ? `<span class="badge red" style="height:20px">${de ? "Hoch" : "High"}</span>` : ""}${tk.replies ? `<span class="flex items-center gap-1 text-3" style="font-size:12px;font-weight:600">${ic("message")}${tk.replies}</span>` : ""}</div>
                </div>
              </div>`;
            }).join("") || `<div class="empty" style="padding:24px 12px"><div class="empty-ic" style="width:40px;height:40px">${ic("checkCircle")}</div><p>${de ? "Keine Tickets" : "No tickets"}</p></div>`}
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  <style>
    .tk-board{ grid-template-columns:1fr; gap:var(--gap-card); }
    @media (min-width:1024px){ .app.wide .tk-board{ grid-template-columns:repeat(3,1fr); align-items:start; } }
    .tk-col{ background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-lg); padding:14px; }
    .tk-card{ box-shadow:var(--sh-xs); transition:all var(--d-fast); }
    .tk-card:hover{ box-shadow:var(--sh-md); transform:translateY(-2px); }
  </style>`;
};
SCREEN_INIT.tickets = function () {
  segmentedBind("#tk-filter");
  document.querySelectorAll("#content .tk-card").forEach((c) => (c.onclick = () => openTicketDetail(c.dataset.ticket)));
};
function openTicketDetail(id) {
  const de = state.lang === "de"; const tk = TICKETS.find((x) => x.id === id); const cat = TICKET_CAT[tk.cat]; const e = TEAM.find((x) => x.id === tk.emp);
  const thread = de ? [
    { who: e, txt: "Mir wurden zwei Schichten am selben Tag zugeteilt. Bitte prüfen.", time: tk.time.de, me: false },
    { who: ME, txt: "Danke für die Meldung – ich schaue es mir sofort an und melde mich.", time: "vor 1 Std", me: true },
  ] : [
    { who: e, txt: "I've been assigned two shifts on the same day. Please check.", time: tk.time.en, me: false },
    { who: ME, txt: "Thanks for flagging – looking into it now and will get back to you.", time: "1 hr ago", me: true },
  ];
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div><div class="ttl">${de ? tk.title.de : tk.title.en}</div><div class="flex items-center gap-2 mt-2"><span class="mono text-3" style="font-size:12px">${tk.id}</span><span class="badge" style="background:${cat.color}1a;color:${cat.color};height:20px">${ic(cat.ic)}${de ? cat.de : cat.en}</span></div></div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      ${thread.map((m) => `<div class="flex gap-3" style="margin-bottom:16px;${m.me ? "flex-direction:row-reverse" : ""}">${avatar(m.who, "sm")}<div style="max-width:78%"><div class="tk-bubble ${m.me ? "me" : ""}">${m.txt}</div><div class="text-3" style="font-size:11px;margin-top:4px;${m.me ? "text-align:right" : ""}">${m.who.first} · ${m.time}</div></div></div>`).join("")}
    </div>
    <div class="sheet-foot" style="gap:8px">
      <input class="input grow" placeholder="${de ? "Antwort schreiben…" : "Write a reply…"}">
      <button class="btn btn-primary" data-close onclick="toast('${de ? "Antwort gesendet" : "Reply sent"}')">${ic("arrowRight")}</button>
    </div>
    <style>.tk-bubble{ background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:11px 14px; font-size:var(--t-sm); line-height:1.45; } .tk-bubble.me{ background:var(--brand); color:var(--on-brand); border-color:transparent; } .dark .tk-bubble.me{ color:#04130d; }</style>`);
}
window.openTicketDetail = openTicketDetail;
function openTicketNew() {
  const de = state.lang === "de";
  openSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${de ? "Neues Ticket" : "New ticket"}</div><button class="icon-btn" data-close style="margin-left:auto">${ic("x")}</button></div>
    <div class="sheet-body">
      <div class="field"><label>${de ? "Kategorie" : "Category"}</label><select class="select"><option>${de ? "Planung" : "Scheduling"}</option><option>${de ? "Lohn" : "Payroll"}</option><option>${de ? "Technik" : "Technical"}</option></select></div>
      <div class="field"><label>${de ? "Betreff" : "Subject"}</label><input class="input" placeholder="${de ? "Kurze Zusammenfassung" : "Short summary"}"></div>
      <div class="field-row"><div class="field"><label>${de ? "Priorität" : "Priority"}</label><select class="select"><option>${de ? "Niedrig" : "Low"}</option><option>${de ? "Mittel" : "Medium"}</option><option>${de ? "Hoch" : "High"}</option></select></div><div class="field"><label>${de ? "Standort" : "Location"}</label><select class="select"><option>Amazon-Fra3</option><option>DHL-Hub Köln</option></select></div></div>
      <div class="field" style="margin-bottom:0"><label>${de ? "Beschreibung" : "Description"}</label><textarea class="input" style="height:96px;padding:12px 14px;resize:none" placeholder="${de ? "Was ist passiert?" : "What happened?"}"></textarea></div>
    </div>
    <div class="sheet-foot"><button class="btn btn-ghost grow" data-close>${t("c.cancel")}</button><button class="btn btn-primary grow" data-close onclick="toast('${de ? "Ticket erstellt" : "Ticket created"}')">${ic("check")}${de ? "Senden" : "Submit"}</button></div>`);
}
window.openTicketNew = openTicketNew;
