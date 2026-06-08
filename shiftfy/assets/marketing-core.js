/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Marketing site core (nav, footer, router, toggles)
   Content mirrors the real app: 7-day trial, real legal entity
   ═══════════════════════════════════════════════════════════════ */

const mk = {
  lang: localStorage.getItem("sf_lang") || "de",
  theme: localStorage.getItem("sf_theme") || "light",
  view: "landing",
  billing: "annual",
  signupStep: 1,
  signupRole: "manager",
};
const L = (de, en) => (mk.lang === "de" ? de : en);
const mic = (n) => Icons[n] || "";
const m$ = (s, r = document) => r.querySelector(s);

/* Real company facts (from impressum/datenschutz) */
const ORG = {
  name: "Bashabsheh Vergabepartner",
  owner: "Mohammad Bashabsheh",
  street: "Kolonnenstraße 8",
  city: "10827 Berlin",
  country: "Deutschland",
  phone: "+49 176 30365636",
  email: "info@bashabsheh-vergabepartner.de",
};

const MK_NAV = [
  { id: "features", scroll: "features", de: "Funktionen", en: "Features" },
  { id: "pricing", de: "Preise", en: "Pricing" },
  { id: "benefits", scroll: "benefits", de: "Vorteile", en: "Benefits" },
  { id: "faq", scroll: "faq", de: "FAQ", en: "FAQ" },
  { id: "f-scheduling", de: "Schichtplanung", en: "Scheduling" },
  { id: "f-timetracking", de: "Zeiterfassung", en: "Time Tracking" },
  { id: "blog", de: "Blog", en: "Blog" },
];

function mkRender() {
  document.documentElement.classList.toggle("dark", mk.theme === "dark");
  const root = document.getElementById("site-root");
  const isAuth = ["login", "signup", "reset", "invite"].includes(mk.view);
  if (isAuth) { root.innerHTML = MK_AUTH[mk.view](); mkBindAuth(); return; }

  root.innerHTML = `
    <div class="site">
      ${mkNav()}
      <main class="mk-main" id="mk-main">${(MK_PAGES[mk.view] || MK_PAGES.landing)()}</main>
      ${mkFooter()}
    </div>
    <div class="scrim" id="scrim"></div>
    <div id="sheet-host"></div>
    <div id="dock-host"></div>`;
  mkBindShell();
  if (MK_PAGE_INIT[mk.view]) MK_PAGE_INIT[mk.view]();
  mkRevealInit();
  mkDock();
  window.scrollTo(0, 0);
}

function mkNav() {
  const flag = mk.lang === "de";
  const onLanding = mk.view === "landing";
  return `
  <header class="mk-nav">
    <div class="mk-brand" data-go="landing"><div class="mk-logo">${mic("logo")}</div><div class="mk-wordmark">Shift<b>fy</b></div></div>
    <nav class="mk-links">
      ${MK_NAV.map((n) => {
        const active = mk.view === n.id ? "active" : "";
        if (n.scroll) return `<button class="mk-link ${active}" data-scroll="${n.scroll}">${L(n.de, n.en)}</button>`;
        return `<button class="mk-link ${active}" data-go="${n.id}">${L(n.de, n.en)}</button>`;
      }).join("")}
    </nav>
    <div class="mk-nav-right">
      <div class="lang-toggle" id="mk-lang">
        <button data-lang="de" class="${flag ? "active" : ""}">DE</button>
        <button data-lang="en" class="${!flag ? "active" : ""}">EN</button>
      </div>
      <button class="icon-btn" id="mk-theme">${mk.theme === "dark" ? mic("sun") : mic("moon")}</button>
      <button class="btn btn-ghost btn-sm mk-login" data-go="login">${L("Anmelden", "Sign in")}</button>
      <button class="btn btn-primary btn-sm" data-go="signup">${L("7 Tage testen", "Start 7-day trial")}</button>
      <button class="icon-btn mk-menu-btn" id="mk-menu">${mic("list")}</button>
    </div>
  </header>`;
}

function mkFooter() {
  const cols = [
    { h: L("Produkt", "Product"), links: [["f-timetracking", L("Zeiterfassung", "Time Tracking")], ["f-scheduling", L("Schichtplanung", "Shift Planning")], ["features", L("Abwesenheiten", "Absences")], ["features", L("Berichte & Export", "Reports & Export")], ["pricing", L("Preise", "Pricing")]] },
    { h: L("Anwendungsfälle", "Use Cases"), links: [["pricing", L("Gastronomie", "Restaurants")], ["pricing", L("Einzelhandel", "Retail")], ["pricing", L("Pflege & Gesundheit", "Healthcare")], ["pricing", L("Handwerk", "Trades & Crafts")], ["pricing", L("Logistik", "Logistics")]] },
    { h: L("Rechtliches", "Legal"), links: [["datenschutz", L("Datenschutz", "Privacy")], ["impressum", L("Impressum", "Imprint")], ["agb", L("AGB", "Terms")], ["widerruf", L("Widerruf", "Withdrawal")], ["barrierefreiheit", L("Barrierefreiheit", "Accessibility")]] },
  ];
  return `
  <footer class="mk-footer">
    <div class="mk-wrap">
      <div class="foot-grid">
        <div class="foot-col">
          <div class="mk-brand" data-go="landing" style="display:inline-flex"><div class="mk-logo">${mic("logo")}</div><div class="mk-wordmark">Shift<b>fy</b></div></div>
          <p class="foot-about">${L("Die intelligente Software für Schichtplanung, Zeiterfassung und Personalmanagement. DSGVO-konform, rechtssicher, Made in Germany.", "The intelligent software for shift planning, time tracking, and workforce management. GDPR-compliant, legally secure, Made in Germany.")}</p>
          <div class="flex items-center gap-2 mt-4" style="font-size:var(--t-sm);color:var(--text-3);font-weight:600">${mic("shield")} ${L("Server in Deutschland · DSGVO", "Servers in Germany · GDPR")}</div>
        </div>
        ${cols.map((c) => `<div class="foot-col"><h5>${c.h}</h5>${c.links.map((l) => `<a data-go="${l[0]}">${l[1]}</a>`).join("")}</div>`).join("")}
      </div>
      <div class="foot-bottom">
        <span>© ${new Date().getFullYear()} ${ORG.name} · ${ORG.city.replace(/^\d+\s/, "")} · ${L("Alle Rechte vorbehalten.", "All rights reserved.")}</span>
        <span class="flex items-center gap-2">${mic("mail")} ${ORG.email}</span>
      </div>
    </div>
  </footer>`;
}

/* ── routing ── */
function mkGo(id) { mk.view = id; mkRender(); }
window.mkGo = mkGo;

function mkScrollTo(anchor) {
  if (mk.view !== "landing") { mk.view = "landing"; mkRender(); setTimeout(() => mkDoScroll(anchor), 80); return; }
  mkDoScroll(anchor);
}
function mkDoScroll(anchor) {
  const el = document.getElementById(anchor);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
}

function mkBindShell() {
  document.querySelectorAll("[data-go]").forEach((el) => (el.onclick = () => mkGo(el.dataset.go)));
  document.querySelectorAll("[data-scroll]").forEach((el) => (el.onclick = () => mkScrollTo(el.dataset.scroll)));
  document.querySelectorAll("#mk-lang [data-lang]").forEach((b) => (b.onclick = () => { mk.lang = b.dataset.lang; localStorage.setItem("sf_lang", mk.lang); mkRender(); }));
  m$("#mk-theme").onclick = () => { mk.theme = mk.theme === "dark" ? "light" : "dark"; localStorage.setItem("sf_theme", mk.theme); mkRender(); };
  const menu = m$("#mk-menu"); if (menu) menu.onclick = mkMobileMenu;
}

function mkMobileMenu() {
  mkOpenSheet(`
    <div class="sheet-grab"></div>
    <div class="sheet-head"><div class="ttl">${L("Menü", "Menu")}</div><button class="icon-btn" data-close style="margin-left:auto">${mic("x")}</button></div>
    <div class="sheet-body">
      <div class="mk-mobile-links">
        ${MK_NAV.map((n) => `<button data-m${n.scroll ? "scroll" : "go"}="${n.scroll || n.id}">${L(n.de, n.en)}</button>`).join("")}
        <button data-mgo="login">${L("Anmelden", "Sign in")}</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" data-mgo="signup">${L("7 Tage testen", "Start 7-day trial")}</button>
    </div>`);
  document.querySelectorAll("[data-mgo]").forEach((b) => (b.onclick = () => { mkCloseSheet(); setTimeout(() => mkGo(b.dataset.mgo), 220); }));
  document.querySelectorAll("[data-mscroll]").forEach((b) => (b.onclick = () => { mkCloseSheet(); setTimeout(() => mkScrollTo(b.dataset.mscroll), 240); }));
}

/* ── sheets ── */
function mkOpenSheet(html) {
  const host = document.getElementById("sheet-host");
  host.innerHTML = `<div class="sheet" id="sheet">${html}</div>`;
  const scrim = document.getElementById("scrim"); const sheet = document.getElementById("sheet");
  void sheet.offsetHeight; scrim.classList.add("open"); sheet.classList.add("open");
  scrim.onclick = mkCloseSheet;
  host.querySelectorAll("[data-close]").forEach((b) => (b.onclick = mkCloseSheet));
}
function mkCloseSheet() {
  const sheet = document.getElementById("sheet"); const scrim = document.getElementById("scrim");
  if (!sheet) return; sheet.classList.remove("open"); scrim.classList.remove("open");
  setTimeout(() => { document.getElementById("sheet-host").innerHTML = ""; }, 360);
}
window.mkOpenSheet = mkOpenSheet; window.mkCloseSheet = mkCloseSheet;

/* ── toast ── */
function mkToast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.cssText = "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(10px);background:var(--n-900);color:#fff;padding:12px 20px;border-radius:99px;font-size:14px;font-weight:600;z-index:200;box-shadow:var(--sh-lg);opacity:0;transition:all .3s var(--e-out)";
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(10px)"; }, 2200);
}
window.mkToast = mkToast;

/* ── reveal on scroll ── */
function mkRevealInit() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.1 });
  els.forEach((e) => io.observe(e));
}

/* ── dock ── */
function mkDock() {
  const host = document.getElementById("dock-host"); if (!host) return;
  host.innerHTML = `<div class="dock"><span class="dock-lbl">Shiftfy</span>
    <a class="btn btn-primary btn-sm" href="Shiftfy Redesign.html" style="text-decoration:none">${mic("grid")}<span class="txt">${L("Zur App", "Open app")}</span></a></div>`;
}

window.addEventListener("DOMContentLoaded", mkRender);
