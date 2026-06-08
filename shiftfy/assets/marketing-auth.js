/* ═══════════════════════════════════════════════════════════════
   SHIFTFY — Auth funnel
   Login · 3-step Signup · Password reset · Email verify · Invite accept
   7-day trial · real legal entity
   ═══════════════════════════════════════════════════════════════ */
const MK_AUTH = {};

function authAside(head, quote, who, role) {
  return `<aside class="auth-aside"><div class="aa-glow"></div>
    <div class="aa-brand"><div class="aa-logo">${mic("logo")}</div><div class="aa-word">Shiftfy</div></div>
    <div class="aa-head">${head}</div>
    <div class="aa-quote"><p>"${quote}"</p><div class="aq-who">${who} · ${role}</div></div>
  </aside>`;
}
function authTop() {
  return `<div class="auth-topbar">
    <div class="at-brand" data-go="landing"><div class="at-logo">${mic("logo")}</div><div class="mk-wordmark" style="font-size:19px">Shift<b>fy</b></div></div>
    <div style="margin-left:auto" class="flex items-center gap-2">
      <div class="lang-toggle" id="mk-lang"><button data-lang="de" class="${mk.lang === "de" ? "active" : ""}">DE</button><button data-lang="en" class="${mk.lang !== "de" ? "active" : ""}">EN</button></div>
      <button class="icon-btn" id="mk-theme">${mk.theme === "dark" ? mic("sun") : mic("moon")}</button>
    </div>
  </div>`;
}
const googleSvg = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.3-4.9 3.3-7.9Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>`;

MK_AUTH.login = function () {
  return `<div class="auth">
    ${authAside(L("Willkommen zurück. Dein Team wartet.", "Welcome back. Your team is waiting."), L("Seit wir Shiftfy nutzen, sparen wir jede Woche Stunden bei der Schichtplanung.", "Since we started using Shiftfy, we save hours every week on shift planning."), "Maria K.", L("Betriebsleiterin", "Operations Manager"))}
    <div class="auth-main">
      ${authTop()}
      <div class="auth-card">
        <h1>${L("Anmelden", "Sign in")}</h1>
        <p class="sub">${L("Schön, dich wiederzusehen. Melde dich bei deinem Workspace an.", "Good to see you again. Sign in to your workspace.")}</p>
        <button class="btn btn-secondary btn-social">${googleSvg}${L("Mit Google anmelden", "Continue with Google")}</button>
        <div class="auth-divider">${L("oder", "or")}</div>
        <div class="field"><label>${L("E-Mail", "Email")}</label><input class="input" type="email" id="lg-email" data-req data-email placeholder="max@firma.de" value="omar@shiftfy.app"><div class="field-err">${L("Gültige E-Mail erforderlich", "Valid email required")}</div></div>
        <div class="field"><div class="flex between items-center" style="margin-bottom:7px"><label style="margin:0">${L("Passwort", "Password")}</label><a class="auth-foot" style="margin:0;font-size:13px" data-go="reset">${L("Vergessen?", "Forgot?")}</a></div><div style="position:relative"><input class="input" type="password" id="lg-pw" data-req placeholder="••••••••" value="demopass" style="padding-right:44px"><button class="icon-btn" data-eye="lg-pw" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);border:none;background:none;width:36px;height:36px">${mic("eye")}</button></div><div class="field-err">${L("Bitte Passwort eingeben", "Enter your password")}</div></div>
        <label class="checkrow" style="margin-bottom:20px"><input type="checkbox" checked> ${L("Angemeldet bleiben", "Keep me signed in")}</label>
        <button class="btn btn-primary btn-block btn-lg" id="lg-submit">${L("Anmelden", "Sign in")}</button>
        <div class="auth-foot">${L("Noch kein Konto?", "Don't have an account?")} <a data-go="signup">${L("7 Tage kostenlos testen", "Start 7-day trial")}</a></div>
      </div>
    </div>
  </div>`;
};

MK_AUTH.signup = function () {
  const step = mk.signupStep;
  const roles = [
    { id: "manager", ic: "users", t: L("Ich plane ein Team", "I schedule a team"), d: L("Manager, Inhaber oder Betriebsleiter", "Manager, owner, or operations lead") },
    { id: "employee", ic: "user", t: L("Ich arbeite in Schichten", "I work shifts"), d: L("Mitarbeiter mit Einladungscode", "Employee with an invite code") },
  ];
  let body = "";
  if (step === 1) {
    body = `<h1>${L("Konto erstellen", "Create your account")}</h1><p class="sub">${L("Schritt 1 von 3 · Wie nutzt du Shiftfy?", "Step 1 of 3 · How will you use Shiftfy?")}</p>
      <div class="role-cards">${roles.map((r) => `<button class="role-pick ${mk.signupRole === r.id ? "sel" : ""}" data-role="${r.id}"><div class="rp-ic">${mic(r.ic)}</div><div><div class="rp-t">${r.t}</div><div class="rp-d">${r.d}</div></div><div class="rp-check">${mic("check")}</div></button>`).join("")}</div>
      <button class="btn btn-primary btn-block btn-lg" style="margin-top:24px" id="su-next">${L("Weiter", "Continue")}${mic("arrowRight")}</button>`;
  } else if (step === 2) {
    body = `<h1>${L("Dein Profil", "Your details")}</h1><p class="sub">${L("Schritt 2 von 3 · Erzähl uns von dir.", "Step 2 of 3 · Tell us about you.")}</p>
      <button class="btn btn-secondary btn-social" style="margin-bottom:8px">${googleSvg}${L("Mit Google registrieren", "Sign up with Google")}</button>
      <div class="auth-divider">${L("oder", "or")}</div>
      <div class="field-row"><div class="field"><label>${L("Vorname", "First name")}</label><input class="input" data-req placeholder="${L("Max", "Jane")}"><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div><div class="field"><label>${L("Nachname", "Last name")}</label><input class="input" data-req placeholder="${L("Mustermann", "Doe")}"><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div></div>
      <div class="field"><label>${L("Geschäftliche E-Mail", "Work email")}</label><input class="input" type="email" data-req data-email placeholder="max@firma.de"><div class="field-err">${L("Gültige E-Mail erforderlich", "Valid email required")}</div></div>
      <div class="field"><label>${L("Passwort", "Password")}</label><input class="input" type="password" id="su-pw" data-req placeholder="${L("Mindestens 8 Zeichen", "At least 8 characters")}"><div class="pw-meter"><i id="pw-bar"></i></div><div class="pw-hint" id="pw-hint">${L("Wähle ein sicheres Passwort", "Choose a strong password")}</div></div>
      <div class="flex gap-3" style="margin-top:8px"><button class="btn btn-secondary" id="su-back">${mic("chevL")}${L("Zurück", "Back")}</button><button class="btn btn-primary grow" id="su-next">${L("Weiter", "Continue")}${mic("arrowRight")}</button></div>`;
  } else if (step === 3) {
    const isMgr = mk.signupRole === "manager";
    body = `<h1>${isMgr ? L("Dein Workspace", "Your workspace") : L("Team beitreten", "Join your team")}</h1><p class="sub">${L("Schritt 3 von 3 · Fast geschafft.", "Step 3 of 3 · Almost there.")}</p>
      ${isMgr ? `
        <div class="field"><label>${L("Firmenname", "Company name")}</label><input class="input" data-req placeholder="${L("Firma GmbH", "Acme GmbH")}"><div class="field-err">${L("Bitte ausfüllen", "Required")}</div></div>
        <div class="field"><label>${L("Branche", "Industry")}</label><select class="select"><option>${L("Gastronomie", "Restaurants")}</option><option>${L("Einzelhandel", "Retail")}</option><option>${L("Pflege & Gesundheit", "Healthcare")}</option><option>${L("Handwerk", "Trades & Crafts")}</option><option>${L("Logistik", "Logistics")}</option><option>${L("Hotellerie", "Hotels")}</option><option>${L("Sonstiges", "Other")}</option></select></div>
        <div class="field"><label>${L("Teamgröße", "Team size")}</label><select class="select"><option>1–15</option><option>16–100</option><option>100+</option></select></div>`
      : `<div class="field"><label>${L("Einladungscode", "Invite code")}</label><input class="input mono" data-req placeholder="SHIFT-XXXX" style="text-transform:uppercase"><div class="field-err">${L("Code erforderlich", "Code required")}</div></div>
         <p class="text-2" style="font-size:var(--t-sm);line-height:1.5;margin:0 0 8px">${L("Den Code erhältst du von deinem Manager oder per E-Mail-Einladung.", "Your manager provides this code, or you'll receive an email invite.")}</p>`}
      <label class="checkrow" style="margin:16px 0 20px"><input type="checkbox" id="su-terms"> ${L("Ich akzeptiere die", "I accept the")} <a data-go="agb">${L("AGB", "Terms")}</a> ${L("und", "and")} <a data-go="datenschutz">${L("Datenschutzerklärung", "Privacy Policy")}</a></label>
      <div class="flex gap-3"><button class="btn btn-secondary" id="su-back">${mic("chevL")}${L("Zurück", "Back")}</button><button class="btn btn-primary grow" id="su-finish">${mic("rocket")}${L("7 Tage kostenlos testen", "Start 7-day trial")}</button></div>`;
  } else {
    body = `<div class="form-success" style="padding:40px 16px"><div class="fs-ic">${mic("mail")}</div><h3>${L("Bestätige deine E-Mail", "Confirm your email")}</h3><p style="margin-bottom:24px">${L("Wir haben dir einen Bestätigungslink geschickt. Danach ist deine 7-tägige Testphase aktiv.", "We've sent you a confirmation link. Your 7-day trial starts right after.")}</p><a class="btn btn-primary btn-lg" href="Shiftfy Redesign.html" style="text-decoration:none">${mic("grid")}${L("Zur App", "Open the app")}</a></div>`;
  }
  const pips = [1, 2, 3].map((n) => `<div class="step-pip ${step > n ? "done" : step === n ? "active" : ""}"><i></i></div>`).join("");
  return `<div class="auth">
    ${authAside(L("In wenigen Schritten zur fertigen Planung.", "A few steps to a finished schedule."), L("Die Einrichtung dauerte fünf Minuten. Wirklich.", "Setup took five minutes. Genuinely."), "Thomas R.", L("Geschäftsführer", "Managing Director"))}
    <div class="auth-main">
      ${authTop()}
      <div class="auth-card">
        ${step <= 3 ? `<div class="stepper">${pips}</div>` : ""}
        ${body}
        ${step <= 3 ? `<div class="auth-foot">${L("Schon registriert?", "Already have an account?")} <a data-go="login">${L("Anmelden", "Sign in")}</a></div>` : ""}
      </div>
    </div>
  </div>`;
};

MK_AUTH.reset = function () {
  const sent = mk._resetSent;
  return `<div class="auth">
    ${authAside(L("Kein Problem. Wir helfen dir zurück.", "No problem. We'll get you back in."), L("Der Support hat in Minuten reagiert. Top.", "Support responded in minutes. Outstanding."), "Lisa M.", L("HR-Managerin", "HR Manager"))}
    <div class="auth-main">
      ${authTop()}
      <div class="auth-card">
        ${sent ? `
          <div class="form-success"><div class="fs-ic">${mic("mail")}</div><h3>${L("E-Mail unterwegs", "Check your inbox")}</h3><p>${L("Wir haben dir einen Link zum Zurücksetzen geschickt. Prüfe auch deinen Spam-Ordner.", "We've sent you a reset link. Don't forget to check your spam folder.")}</p></div>
          <button class="btn btn-secondary btn-block" style="margin-top:24px" data-go="login">${mic("chevL")}${L("Zurück zur Anmeldung", "Back to sign in")}</button>`
        : `
          <h1>${L("Passwort zurücksetzen", "Reset your password")}</h1>
          <p class="sub">${L("Gib deine E-Mail ein und wir senden dir einen Link zum Zurücksetzen.", "Enter your email and we'll send you a reset link.")}</p>
          <div class="field"><label>${L("E-Mail", "Email")}</label><input class="input" type="email" id="rs-email" data-req data-email placeholder="max@firma.de"><div class="field-err">${L("Gültige E-Mail erforderlich", "Valid email required")}</div></div>
          <button class="btn btn-primary btn-block btn-lg" id="rs-submit">${L("Link senden", "Send reset link")}</button>
          <div class="auth-foot">${L("Wieder eingefallen?", "Remembered it?")} <a data-go="login">${L("Anmelden", "Sign in")}</a></div>`}
      </div>
    </div>
  </div>`;
};

MK_AUTH.invite = function () {
  return `<div class="auth">
    ${authAside(L("Dein Team hat dich eingeladen.", "Your team invited you."), L("Onboarding war kinderleicht – Code rein, fertig.", "Onboarding was effortless — enter code, done."), "Lena B.", L("Mitarbeiterin", "Team member"))}
    <div class="auth-main">
      ${authTop()}
      <div class="invite-card">
        <div class="invite-org">RM</div>
        <h1 style="font-size:var(--t-2xl)">Rhein-Main Logistik</h1>
        <p class="sub" style="margin-bottom:24px">${L("Sandra Reinholz hat dich eingeladen, dem Team auf Shiftfy beizutreten.", "Sandra Reinholz invited you to join the team on Shiftfy.")}</p>
        <div class="card card-pad" style="text-align:left;margin-bottom:20px">
          <div class="dline" style="padding-top:0"><div class="dline-ic">${mic("briefcase")}</div><div><div class="lbl">${L("Rolle", "Role")}</div><div class="val">${L("Mitarbeiter", "Employee")}</div></div></div>
          <div class="dline"><div class="dline-ic">${mic("mapPin")}</div><div><div class="lbl">${L("Standort", "Location")}</div><div class="val">Amazon-Fra3</div></div></div>
          <div class="dline" style="padding-bottom:0"><div class="dline-ic">${mic("mail")}</div><div><div class="lbl">${L("Eingeladen als", "Invited as")}</div><div class="val">neu@firma.de</div></div></div>
        </div>
        <div class="field" style="text-align:left"><label>${L("Wähle ein Passwort", "Choose a password")}</label><input class="input" type="password" id="iv-pw" data-req placeholder="${L("Mindestens 8 Zeichen", "At least 8 characters")}"><div class="pw-meter"><i id="pw-bar"></i></div><div class="pw-hint" id="pw-hint">${L("Wähle ein sicheres Passwort", "Choose a strong password")}</div></div>
        <a class="btn btn-primary btn-block btn-lg" href="Shiftfy Redesign.html" style="text-decoration:none;margin-top:8px">${mic("check")}${L("Einladung annehmen", "Accept invitation")}</a>
        <div class="auth-foot">${L("Falsche Adresse?", "Wrong address?")} <a data-go="landing">${L("Mehr über Shiftfy", "Learn about Shiftfy")}</a></div>
      </div>
    </div>
  </div>`;
};

function mkBindAuth() {
  document.querySelectorAll("[data-go]").forEach((el) => (el.onclick = () => { if (el.tagName === "A" && el.getAttribute("href")) return; mkGo(el.dataset.go); }));
  document.querySelectorAll("#mk-lang [data-lang]").forEach((b) => (b.onclick = () => { mk.lang = b.dataset.lang; localStorage.setItem("sf_lang", mk.lang); mkRender(); }));
  const th = m$("#mk-theme"); if (th) th.onclick = () => { mk.theme = mk.theme === "dark" ? "light" : "dark"; localStorage.setItem("sf_theme", mk.theme); mkRender(); };
  document.querySelectorAll("[data-eye]").forEach((b) => (b.onclick = () => { const inp = document.getElementById(b.dataset.eye); inp.type = inp.type === "password" ? "text" : "password"; }));
  document.querySelectorAll("#su-pw, #iv-pw").forEach((pw) => { if (pw) pw.oninput = () => mkPwMeter(pw.value); });

  const validate = (scope) => {
    let ok = true;
    scope.querySelectorAll("[data-req]").forEach((inp) => {
      const f = inp.closest(".field"); if (!f) return;
      const empty = !inp.value.trim(); const bad = inp.hasAttribute("data-email") && inp.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value);
      f.classList.toggle("show-err", empty || bad); if (empty || bad) ok = false;
    });
    return ok;
  };

  const lg = m$("#lg-submit"); if (lg) lg.onclick = () => { if (validate(m$(".auth-card"))) { mkToast(L("Anmeldung erfolgreich", "Signed in")); setTimeout(() => (window.location.href = "Shiftfy Redesign.html"), 700); } };
  const rs = m$("#rs-submit"); if (rs) rs.onclick = () => { if (validate(m$(".auth-card"))) { mk._resetSent = true; mkRender(); } };
  document.querySelectorAll("[data-role]").forEach((b) => (b.onclick = () => { mk.signupRole = b.dataset.role; document.querySelectorAll("[data-role]").forEach((x) => x.classList.toggle("sel", x === b)); }));
  const next = m$("#su-next"); if (next) next.onclick = () => { const card = m$(".auth-card"); if (mk.signupStep === 1 || validate(card)) { mk.signupStep++; mkRender(); } };
  const back = m$("#su-back"); if (back) back.onclick = () => { mk.signupStep = Math.max(1, mk.signupStep - 1); mkRender(); };
  const fin = m$("#su-finish"); if (fin) fin.onclick = () => { const card = m$(".auth-card"); const terms = m$("#su-terms"); if (!validate(card)) return; if (terms && !terms.checked) { mkToast(L("Bitte AGB akzeptieren", "Please accept the terms")); return; } mk.signupStep = 4; mkRender(); };
}
function mkPwMeter(v) {
  const bar = m$("#pw-bar"); const hint = m$("#pw-hint"); if (!bar) return;
  let s = 0; if (v.length >= 8) s++; if (/[A-Z]/.test(v)) s++; if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
  const pct = [0, 25, 50, 75, 100][s]; const colors = ["var(--border-strong)", "var(--danger)", "var(--warning)", "var(--brand-400)", "var(--brand)"];
  const labels = [L("Zu kurz", "Too short"), L("Schwach", "Weak"), L("Okay", "Fair"), L("Gut", "Good"), L("Stark", "Strong")];
  bar.style.width = pct + "%"; bar.style.background = colors[s]; if (hint) hint.textContent = labels[s];
}
