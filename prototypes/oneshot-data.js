/* =========================================================
   ONESHOT — shared data + content layer
   Single source of truth for both landing & lobby.
   No user-facing string is hardcoded in the markup;
   everything is injected from here via data-bind / data-ph.
   ========================================================= */

const CONFIG = {
  host: location.host || "127.0.0.1:8080",
  sector: "F92A1",
  joinUrl: "ONESHOT.IO/JOIN?SECTOR=F92A1",
  startUsers: 14082,
};

/* uptime anchor so the clock looks alive (1024H 12M 04S ago) */
const BOOTED_AT = Date.now() - (1024 * 3600 + 12 * 60 + 4) * 1000;

/* ---- GAME CATALOG (shared by landing rail + lobby modules) ----
   `real` maps the themed module name onto the actual game id from
   the design spec, so the flavor layer stays swappable. */
const GAMES = [
  { key: "TRUTH_OR_SHOT",    real: "kinggame",   glyph: "⌖", accent: "red",  players: "3-12", time: "15 MIN", tag: "INTERROGATION", desc: "A cyberpunk interrogation party module.", status: "LOADED" },
  { key: "NEON_BETRAYAL",    real: "liar",       glyph: "◎", accent: "gray", players: "4-10", time: "20 MIN", tag: "SOCIAL DEDUCTION", desc: "Find the spy hidden in the system.", status: "STANDBY" },
  { key: "CODE_CRACKER_PRO", real: "arithmetic", glyph: "⌗", accent: "gray", players: "2-8",  time: "10 MIN", tag: "CO-OP PUZZLE", desc: "Collaborative decryption task.", status: "STANDBY" },
  { key: "DATA_HEIST_XL",    real: "upstage",    glyph: "⛁", accent: "gold", players: "5-16", time: "25 MIN", tag: "CARD STRATEGY", desc: "Fast-paced resource collection.", status: "STANDBY" },
  { key: "LIARS_PROTOCOL",   real: "fool-liar",  glyph: "✕", accent: "gray", players: "4-12", time: "12 MIN", tag: "BLUFF / VOTE", desc: "Bluff your way past the firewall.", status: "STANDBY" },
  { key: "KING_OVERRIDE",    real: "kinggame",   glyph: "♔", accent: "gold", players: "3-10", time: "08 MIN", tag: "PARTY CLASSIC", desc: "Random command injection sequence.", status: "STANDBY" },
];

/* ---- OPERATORS (lobby players) ---- */
const OPERATORS = [
  { tag: "K", avatarId: "cyborg",  name: "K-NEO_SOUL",     role: "COMMANDER",    ip: "192.168.1.104 // HOST_ORIGIN", status: "ONLINE",       meta: "STABLE_CONNECTION",  accent: "cyan", wins: 2 },
  { tag: "X", avatarId: "fox",     name: "X_GHOST_RUNNER", role: null,           ip: "82.44.192.12 // REMOTE",       status: "ONLINE",       meta: "PING: 42MS",         accent: "gold", wins: 3 },
  { tag: "V", avatarId: "owl",     name: "V-SYNC_ZERO",    role: null,           ip: "212.8.33.109 // TIMEOUT",      status: "RECONNECTING", meta: "SIGNAL_DEGRADATION", accent: "cyan", wins: 1 },
  { tag: "A", avatarId: "samurai", name: "ADRIAN_CODE",    role: "TEMP_COMMAND", ip: "104.1.92.55 // ASSIGNED",      status: "ONLINE",       meta: "PING: 18MS",         accent: "red",  wins: 2 },
  { tag: "M", avatarId: "wolf",    name: "MIST_WALKER",    role: null,           ip: "DISCONNECTED",                 status: "OFFLINE",      meta: "RESERVED_SLOT",      accent: "gray", wins: 0 },
];

const STATUS_CLASS = { ONLINE: "s-online", RECONNECTING: "s-warn", OFFLINE: "s-off" };
const STATUS_DOT = { ONLINE: "dot--ok", RECONNECTING: "dot--warn", OFFLINE: "dot--off" };

/* ---- live tickers ---- */
function liveConnected() {
  const jitter = Math.floor(Math.sin(Date.now() / 4000) * 40);
  return `CONNECTED_USERS: ${(CONFIG.startUsers + jitter).toLocaleString("en-US")}`;
}
function liveGlobalUsers() {
  const jitter = Math.floor(Math.sin(Date.now() / 4000) * 40);
  return `GLOBAL_USERS: ${(CONFIG.startUsers + jitter).toLocaleString("en-US")}`;
}
function liveUptime() {
  const s = Math.floor((Date.now() - BOOTED_AT) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return `UPTIME: ${h.toLocaleString("en-US")}H ${pad(m)}M ${pad(sec)}S`;
}
function liveClock() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `TIME: ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function liveLatency() {
  return `LATENCY: ${20 + Math.floor(Math.abs(Math.sin(Date.now() / 3000)) * 12)}MS`;
}

/* ---- binding util: fills [data-bind] (innerHTML) and [data-ph] (placeholder) ---- */
function renderBindings(scope) {
  if (!window.CONTENT) return;
  (scope || document).querySelectorAll("[data-bind]").forEach((el) => {
    const fn = window.CONTENT[el.getAttribute("data-bind")];
    if (fn) el.innerHTML = typeof fn === "function" ? fn() : fn;
  });
  (scope || document).querySelectorAll("[data-ph]").forEach((el) => {
    const fn = window.CONTENT[el.getAttribute("data-ph")];
    if (fn) el.setAttribute("placeholder", typeof fn === "function" ? fn() : fn);
  });
}
function startLiveLoop(keys) {
  setInterval(() => {
    keys.forEach((k) => {
      const el = document.querySelector(`[data-bind="${k}"]`);
      if (el && window.CONTENT[k]) el.innerHTML = window.CONTENT[k]();
    });
  }, 1000);
}

/* =========================================================
   IDENTITY + SETTINGS (shared)
   Preset avatar units the player can pick from.
   ========================================================= */
const AVATAR_DIR = "assets/avatars/";
const AVATARS = [
  { id: "cyborg",       label: "CYBORG",      accent: "cyan" },
  { id: "ninja",        label: "NINJA",       accent: "red" },
  { id: "samurai",      label: "SAMURAI",     accent: "red" },
  { id: "assassin",     label: "ASSASSIN",    accent: "red" },
  { id: "hawkeye",      label: "HAWKEYE",     accent: "gold" },
  { id: "alien",        label: "ALIEN",       accent: "cyan" },
  { id: "buddhist-nun", label: "MONK",        accent: "gold" },
  { id: "fox",          label: "FOX",         accent: "gold" },
  { id: "wolf",         label: "WOLF",        accent: "cyan" },
  { id: "tiger",        label: "TIGER",       accent: "gold" },
  { id: "bear",         label: "BEAR",        accent: "red" },
  { id: "shark",        label: "SHARK",       accent: "cyan" },
  { id: "eagle",        label: "EAGLE",       accent: "gold" },
  { id: "owl",          label: "OWL",         accent: "cyan" },
  { id: "cat",          label: "CAT",         accent: "gold" },
  { id: "rabbit",       label: "RABBIT",      accent: "red" },
];

function avatarById(id) { return AVATARS.find((a) => a.id === id) || AVATARS[0]; }
function avatarSrc(id) { return AVATAR_DIR + avatarById(id).id + ".png"; }
/* image markup for the small glyph boxes used across screens */
function avatarBox(id, extraClass) {
  const a = avatarById(id);
  return `<span class="glyph glyph--img glyph--${a.accent} ${extraClass || ""}"><img src="${avatarSrc(id)}" alt="${a.label}" loading="lazy" /></span>`;
}
function loadIdentity() {
  try { const s = JSON.parse(localStorage.getItem("oneshot.identity")); if (s && s.avatarId) return s; } catch (e) {}
  return { nickname: "", avatarId: AVATARS[0].id };
}
function saveIdentity(id) { localStorage.setItem("oneshot.identity", JSON.stringify(id)); }

/* mountSettings({ onSave }) -> { open, close }.  Injects the modal once. */
function mountSettings(opts) {
  opts = opts || {};
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>OPERATOR_CONFIG</h3><button class="x" data-close>✕</button></div>
      <div class="modal-body">
        <div class="field">
          <div class="field-head"><span>IDENTIFICATION_NICKNAME</span><span class="opt" data-cfg-count>0/12</span></div>
          <input data-cfg-nick type="text" maxlength="12" placeholder="ENTER_NAME..." autocomplete="off" />
        </div>
        <div>
          <div class="field-head" style="margin-bottom:10px"><span>SELECT_AVATAR_UNIT</span><span class="opt">${AVATARS.length} UNITS</span></div>
          <div class="avatar-grid" data-cfg-avatars></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn--sm" data-close><span>CANCEL</span></button>
        <button class="btn btn--sm btn--primary" data-save><span>SAVE_CONFIG</span></button>
      </div>
    </div>`;
  document.body.appendChild(el);

  const nick = el.querySelector("[data-cfg-nick]");
  const count = el.querySelector("[data-cfg-count]");
  const grid = el.querySelector("[data-cfg-avatars]");
  let pick = loadIdentity().avatarId;

  grid.innerHTML = AVATARS.map(
    (a) => `<button class="avatar-opt" data-av="${a.id}" title="${a.label}"><img src="${avatarSrc(a.id)}" alt="${a.label}" loading="lazy" /><span class="av-name">${a.label}</span></button>`
  ).join("");
  nick.addEventListener("input", () => (count.textContent = `${nick.value.length}/12`));
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-av]"); if (!b) return;
    pick = b.dataset.av;
    grid.querySelectorAll(".avatar-opt").forEach((x) => x.classList.toggle("sel", x === b));
  });

  const close = () => el.classList.remove("open");
  el.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector("[data-save]").addEventListener("click", () => {
    const next = { nickname: nick.value.trim(), avatarId: pick };
    saveIdentity(next); close(); if (opts.onSave) opts.onSave(next);
  });

  return {
    open() {
      const cur = loadIdentity();
      nick.value = cur.nickname || "";
      count.textContent = `${nick.value.length}/12`;
      pick = cur.avatarId;
      grid.querySelectorAll(".avatar-opt").forEach((x) => x.classList.toggle("sel", x.dataset.av === pick));
      el.classList.add("open");
      setTimeout(() => nick.focus(), 30);
    },
    close,
  };
}

/* =========================================================
   BACKGROUND PREVIEW  (temporary — append ?bg=a or ?bg=b to any page URL)
   Does NOT change the committed design; just live-previews lighter tones.
   ========================================================= */
const BG_PREVIEWS = {
  a: {
    bg: `radial-gradient(120% 90% at 85% 6%, rgba(217,63,46,0.16), transparent 52%),
         radial-gradient(130% 100% at 50% 120%, rgba(43,214,255,0.05), transparent 55%),
         linear-gradient(165deg, #232030, #17141f 72%)`,
    vignette: "inset 0 0 260px 30px rgba(0,0,0,0.5)",
  },
  b: {
    bg: `radial-gradient(120% 90% at 85% 6%, rgba(217,63,46,0.12), transparent 50%),
         radial-gradient(120% 100% at 50% 120%, rgba(255,255,255,0.03), transparent 55%),
         linear-gradient(165deg, #2c2838, #201c2a 70%)`,
    vignette: "inset 0 0 280px 20px rgba(0,0,0,0.42)",
  },
  c: {
    bg: `radial-gradient(120% 90% at 85% 6%, rgba(217,63,46,0.14), transparent 50%),
         radial-gradient(120% 100% at 50% 120%, rgba(120,90,200,0.06), transparent 55%),
         linear-gradient(165deg, #353043, #262232 70%)`,
    vignette: "inset 0 0 300px 16px rgba(0,0,0,0.36)",
  },
};
function applyBgPreview() {
  const key = new URLSearchParams(location.search).get("bg");
  const p = BG_PREVIEWS[key];
  if (!p) return;
  document.body.style.background = p.bg;
  const v = document.querySelector(".fx--vignette");
  if (v) v.style.boxShadow = p.vignette;
}
document.addEventListener("DOMContentLoaded", applyBgPreview);

/* re-trigger the wordmark glitch on demand */
function flashGlitch(id) {
  const brand = document.getElementById(id || "brand");
  if (!brand) return;
  brand.style.animation = "none";
  void brand.offsetWidth;
  brand.style.animation = "rgb-split 0.6s ease-out 1 both";
}
