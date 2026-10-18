// Ortak araçlar: tema düğmesi, hesap makinesi ve yazı tahtası.
// Sayfadaki .tools-slot içine düğmeler eklenir; data-tool-open="hesap|tahta" taşıyan düğmeler de ilgili aracı açar.
// Paneller masaüstünde sürüklenebilir pencere, dar ekranda alttan açılan sayfa olarak görünür.
(() => {
"use strict";

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const wide = () => innerWidth >= 720;
const clamp = (v, a, b) => Math.max(a, Math.min(v, b));

const ICON = {
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M8.5 18h.01M12 18h.01M15.5 15v3"/>',
  board: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12.5l3-3 2 2 4.5-4.5"/>',
  pen: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/><path d="M14 7l3 3"/>',
  eraser: '<path d="M8 20h11"/><path d="M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L13 17H8.5z"/><path d="M9.5 10.5l5 5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const svg = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------- Tema ---------- */
const mq = matchMedia("(prefers-color-scheme: dark)");
const theme = () => document.documentElement.dataset.theme || (mq.matches ? "dark" : "light");
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("enerji-tema", t); } catch (e) {}
  syncButtons();
  board?.redraw();
}
mq.addEventListener?.("change", () => { syncButtons(); board?.redraw(); });

/* ---------- Panel iskeleti ---------- */
let zTop = 80;
const pos = store.get("enerji-arac-konum", {});
const openState = store.get("enerji-arac-acik", {});
const tools = {};

function panel(name, title, icon) {
  const el = document.createElement("section");
  el.className = "tool-panel tp-" + name;
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", title);
  el.innerHTML = `
    <header class="tp-head" title="Taşımak için sürükleyin; çift tıklayınca yerine döner">
      <span class="tp-ico">${svg(icon)}</span><h2>${title}</h2><span class="grow"></span>
      <span class="tp-extra"></span>
      <button type="button" class="tp-btn" data-act="min" aria-label="Küçült" title="Küçült">${svg("minus")}</button>
      <button type="button" class="tp-btn" data-act="close" aria-label="${title} kapat" title="Kapat">${svg("x")}</button>
    </header>
    <div class="tp-body"></div>`;
  document.body.appendChild(el);
  const t = { name, el, title, body: el.querySelector(".tp-body") };
  tools[name] = t;
  el.addEventListener("pointerdown", () => front(el), true);
  el.querySelector('[data-act="close"]').onclick = () => openTool(name, false);
  el.querySelector('[data-act="min"]').onclick = e => {
    const m = el.classList.toggle("min");
    e.currentTarget.innerHTML = svg(m ? "plus" : "minus");
    e.currentTarget.title = m ? "Büyüt" : "Küçült";
    e.currentTarget.setAttribute("aria-label", e.currentTarget.title);
    dock();
  };
  draggable(t);
  return t;
}
function front(el) { el.style.zIndex = ++zTop; }
// Geniş ekranda yerinden oynatılmamış hesap makinesi açıkken içerik sola kayar; soru panelin altında kalmaz
function dock() {
  const c = tools.hesap?.el;
  document.body.classList.toggle("hesap-yanda", !!c && !c.hidden && !pos.hesap && !c.classList.contains("min"));
}

function setPos(t, x, y) {
  const el = t.el;
  x = clamp(x, 0, Math.max(0, innerWidth - el.offsetWidth));
  y = clamp(y, 0, Math.max(0, innerHeight - 56));
  Object.assign(el.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
}
function place(t) {
  const p = pos[t.name];
  if (!wide() || !p) return;
  if (p.w) t.el.style.width = Math.min(p.w, innerWidth - 16) + "px";
  if (p.h) t.el.style.height = Math.min(p.h, innerHeight - 16) + "px";
  setPos(t, p.x, p.y);
}
function savePos(t) {
  const r = t.el.getBoundingClientRect();
  pos[t.name] = Object.assign(pos[t.name] || {}, { x: Math.round(r.left), y: Math.round(r.top) });
  store.set("enerji-arac-konum", pos);
  dock();
}
function draggable(t) {
  const head = t.el.querySelector(".tp-head");
  // Çift tıklama paneli varsayılan yerine ve boyutuna döndürür
  head.addEventListener("dblclick", e => {
    if (e.target.closest("button")) return;
    delete pos[t.name];
    store.set("enerji-arac-konum", pos);
    ["left", "top", "right", "bottom", "width", "height"].forEach(k => { t.el.style[k] = ""; });
    dock();
  });
  head.addEventListener("pointerdown", e => {
    if (!wide() || e.button !== 0 || e.target.closest("button") || t.el.classList.contains("full")) return;
    const r = t.el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    head.classList.add("dragging");
    let moved = false;
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 4) return;
      moved = true;
      setPos(t, ev.clientX - dx, ev.clientY - dy);
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      head.removeEventListener("pointercancel", up);
      head.classList.remove("dragging");
      if (moved) savePos(t);
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", up);
  });
}
addEventListener("resize", () => {
  Object.values(tools).forEach(t => { if (!t.el.hidden && wide() && t.el.style.left) setPos(t, t.el.offsetLeft, t.el.offsetTop); });
});

function openTool(name, on) {
  const t = tools[name];
  if (!t) return;
  on = on ?? t.el.hidden;
  t.el.hidden = !on;
  if (on) { front(t.el); place(t); t.onOpen?.(); }
  openState[name] = on;
  store.set("enerji-arac-acik", openState);
  syncButtons();
  dock();
}

/* ---------- Üst çubuk düğmeleri ---------- */
function syncButtons() {
  document.querySelectorAll("[data-tool-btn]").forEach(b => {
    const k = b.dataset.toolBtn;
    if (k === "tema") {
      const d = theme() === "dark";
      b.innerHTML = svg(d ? "sun" : "moon");
      b.title = d ? "Açık temaya geç" : "Koyu temaya geç";
      b.setAttribute("aria-label", b.title);
    } else if (tools[k]) b.setAttribute("aria-pressed", !tools[k].el.hidden);
  });
}
function mountButtons() {
  document.querySelectorAll(".tools-slot").forEach(slot => {
    slot.innerHTML = `
      <button type="button" class="ibtn" data-tool-btn="hesap" aria-pressed="false" title="Hesap makinesi">${svg("calc")}<span class="lbl">Hesap makinesi</span></button>
      <button type="button" class="ibtn" data-tool-btn="tahta" aria-pressed="false" title="Yazı tahtası">${svg("board")}<span class="lbl">Yazı tahtası</span></button>
      <button type="button" class="ibtn only" data-tool-btn="tema"></button>`;
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-tool-btn], [data-tool-open]");
    if (!b) return;
    const k = b.dataset.toolBtn || b.dataset.toolOpen;
    if (k === "tema") return setTheme(theme() === "dark" ? "light" : "dark");
    openTool(k, b.dataset.toolOpen ? true : undefined);
  });
}

/* ---------- Hesap makinesi ---------- */
// İfade çözücü: eval kullanılmaz. Virgül ondalık ayırıcıdır; 8.250 ve 1.000.000 gibi üçlü gruplar binlik sayılır.
function tokenize(s) {
  const out = [];
  s = s.replace(/\s+/g, "").replace(/sin⁻¹/g, "asin").replace(/cos⁻¹/g, "acos").replace(/tan⁻¹/g, "atan");
  let i = 0;
  while (i < s.length) {
    const r = s.slice(i);
    let m;
    if ((m = r.match(/^(?:\d{1,3}(?:\.\d{3})+(?!\d)(?:,\d+)?|\d+(?:[.,]\d+)?|[.,]\d+)/))) {
      const t = m[0];
      const thou = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(t);
      out.push({ k: "num", v: thou ? +t.replace(/\./g, "").replace(",", ".") : +t.replace(",", ".") });
      i += t.length; continue;
    }
    if ((m = r.match(/^(asin|acos|atan|sin|cos|tan|sqrt|log|ln|exp|abs|ans|pi|π|e)/i))) {
      const w = m[1].toLowerCase();
      if (w === "pi" || w === "π") out.push({ k: "const", v: Math.PI });
      else if (w === "e") out.push({ k: "const", v: Math.E });
      else if (w === "ans") out.push({ k: "const", v: "ans" });
      else out.push({ k: "fn", v: w });
      i += w.length; continue;
    }
    const c = r[0];
    if (c === "√") out.push({ k: "fn", v: "sqrt" });
    else if (c === "²" || c === "³") out.push({ k: "op", v: "^" }, { k: "num", v: c === "²" ? 2 : 3 });
    else if ("+-−".includes(c)) out.push({ k: "op", v: c === "+" ? "+" : "-" });
    else if ("*×·".includes(c)) out.push({ k: "op", v: "*" });
    else if ("/÷:".includes(c)) out.push({ k: "op", v: "/" });
    else if ("^%()".includes(c)) out.push({ k: "op", v: c });
    else throw Error(`Tanınmayan karakter: ${c}`);
    i++;
  }
  return out;
}

function evaluate(src, deg, ans) {
  const T = tokenize(src);
  if (!T.length) return null;
  let p = 0;
  const peek = () => T[p], next = () => T[p++];
  const isOp = (t, v) => t && t.k === "op" && t.v === v;
  const toRad = x => deg ? x * Math.PI / 180 : x;
  const fromRad = x => deg ? x * 180 / Math.PI : x;
  const snap = x => Math.abs(x - Math.round(x)) < 1e-12 ? Math.round(x) : x;
  const FN = {
    sin: x => snap(Math.sin(toRad(x))),
    cos: x => snap(Math.cos(toRad(x))),
    tan: x => {
      if (Math.abs(snap(Math.cos(toRad(x)))) === 0) throw Error("tan bu açıda tanımsız");
      return snap(Math.tan(toRad(x)));
    },
    asin: x => fromRad(Math.asin(x)), acos: x => fromRad(Math.acos(x)), atan: x => fromRad(Math.atan(x)),
    sqrt: x => { if (x < 0) throw Error("Negatif sayının karekökü alınamaz"); return Math.sqrt(x); },
    log: x => Math.log10(x), ln: x => Math.log(x), exp: x => Math.exp(x), abs: x => Math.abs(x)
  };
  const startsPrimary = t => t && (t.k === "num" || t.k === "const" || t.k === "fn" || isOp(t, "("));

  function expr() {
    let [v] = term();
    while (isOp(peek(), "+") || isOp(peek(), "-")) {
      const op = next().v;
      const [r, pct] = term();
      // 200 + 10% = 220 (yüzde, soldaki sayının yüzdesi olarak eklenir)
      v = pct ? v * (op === "+" ? 1 + r : 1 - r) : op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let [v, pct] = unary();
    for (;;) {
      const t = peek();
      if (isOp(t, "*") || isOp(t, "/")) {
        next();
        const [r] = unary();
        if (t.v === "/" && r === 0) throw Error("Sıfıra bölme tanımsız");
        v = t.v === "*" ? v * r : v / r;
        pct = false;
      } else if (startsPrimary(t)) {
        if (t.k === "num" && T[p - 1]?.k === "num") throw Error("Hatalı sayı yazımı");
        const [r] = unary();
        v *= r;
        pct = false;
      } else break;
    }
    return [v, pct];
  }
  function unary() {
    if (isOp(peek(), "-")) { next(); const [v, pc] = unary(); return [-v, pc]; }
    if (isOp(peek(), "+")) { next(); return unary(); }
    return power();
  }
  function power() {
    const [b, pc] = postfix();
    if (isOp(peek(), "^")) { next(); const [e] = unary(); return [Math.pow(b, e), false]; }
    return [b, pc];
  }
  function postfix() {
    let v = primary(), pct = false;
    while (isOp(peek(), "%")) { next(); v /= 100; pct = true; }
    return [v, pct];
  }
  function primary() {
    const t = next();
    if (!t) throw Error("İfade eksik");
    if (t.k === "num") return t.v;
    if (t.k === "const") return t.v === "ans" ? (ans ?? 0) : t.v;
    if (t.k === "fn") return FN[t.v](primary());
    if (isOp(t, "(")) {
      const v = expr();
      if (isOp(peek(), ")")) next();
      else if (peek()) throw Error("Parantez hatası");
      return v;
    }
    throw Error("İfade eksik veya hatalı");
  }

  const v = expr();
  if (p < T.length) throw Error(isOp(peek(), ")") ? "Fazladan kapanan parantez" : "Hatalı ifade");
  if (!isFinite(v)) throw Error(isNaN(v) ? "Tanımsız sonuç" : "Sonuç çok büyük");
  return v;
}

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const sci = x => { const a = Math.abs(x); return a !== 0 && (a >= 1e15 || a < 1e-7); };
function fmt(x) {
  if (sci(x)) {
    const [m, e] = x.toExponential(8).split("e");
    return `${(+m).toLocaleString("tr-TR", { maximumFractionDigits: 8 })} × 10${String(+e).replace(/./g, c => SUP[c])}`;
  }
  return (+x.toPrecision(12)).toLocaleString("tr-TR", { maximumFractionDigits: 12 });
}
// İfadeye geri yazılabilen biçim
function plain(x) {
  if (sci(x)) {
    const [m, e] = x.toExponential(10).split("e");
    return `${String(+m).replace(".", ",")}×10^(${+e})`;
  }
  return fmt(x);
}

const KEYS = [
  ["sin", "sin(", "fn sci"], ["cos", "cos(", "fn sci"], ["tan", "tan(", "fn sci"], ["log", "log(", "fn sci"], ["ln", "ln(", "fn sci"],
  ["sin⁻¹", "asin(", "fn sci"], ["cos⁻¹", "acos(", "fn sci"], ["tan⁻¹", "atan(", "fn sci"], ["10ˣ", "10^(", "fn sci"], ["π", "π", "fn sci"],
  ["(", "("], [")", ")"], ["%", "%"], ["AC", ":clear", "del"], ["⌫", ":back", "del"],
  ["7"], ["8"], ["9"], ["÷", "÷", "op"], ["√", "√(", "op"],
  ["4"], ["5"], ["6"], ["×", "×", "op"], ["x²", "^2", "op"],
  ["1"], ["2"], ["3"], ["−", "−", "op"], ["xʸ", "^", "op"],
  ["0"], [",", ","], ["Ans", "Ans", "fn"], ["+", "+", "op"], ["=", ":eq", "eq"]
];
const KEY_LABEL = { "÷": "böl", "×": "çarp", "−": "eksi", "+": "artı", "⌫": "son karakteri sil", "AC": "tümünü temizle", "x²": "kare", "xʸ": "üs", "√": "karekök", "10ˣ": "10 üzeri", "%": "yüzde", "=": "eşittir", "Ans": "son sonuç", ",": "virgül" };
const CONSTS = [
  ["√3", "√3", "3 faz", "Üç fazlı güç: P = √3 · U · I · cosφ"],
  ["860", "860", "kcal/kWh", "1 kWh elektrik = 860 kcal"],
  ["8.250", "8250", "kcal/m³", "Doğal gaz alt ısıl değeri"],
  ["10⁷", "10^7", "kcal/TEP", "1 TEP = 10.000.000 kcal"],
  ["4,1868", "4,1868", "kJ/kcal", "1 kcal = 4,1868 kJ"],
  ["3,6", "3,6", "MJ/kWh", "1 kWh = 3,6 MJ"]
];
// Enerji birimlerinin kcal karşılığı. Elektrikte yönetmelikteki 1 kWh = 860 kcal değeri kullanılır.
const UNITS = [
  ["TEP", 1e7], ["kcal", 1], ["Mcal", 1e3], ["Gcal", 1e6], ["kWh", 860], ["MWh", 860000],
  ["kJ", 1 / 4.1868], ["MJ", 1000 / 4.1868], ["GJ", 1e6 / 4.1868], ["BTU", 0.251996]
];

function makeCalc() {
  const t = panel("hesap", "Hesap makinesi", "calc");
  const cfg = store.get("enerji-hesap", {});
  let deg = cfg.deg !== false, sciOn = cfg.sci ?? wide(), ans = cfg.ans, hist = store.get("enerji-hesap-gecmis", []);
  let freshResult = false;
  const saveCfg = () => store.set("enerji-hesap", { deg, sci: sciOn, ans });

  t.body.innerHTML = `
    <div class="cx-tabs" role="tablist" aria-label="Hesap makinesi bölümleri">
      <button type="button" role="tab" data-tab="hesap" aria-selected="true">Hesap</button>
      <button type="button" role="tab" data-tab="birim" aria-selected="false">Birim çevirici</button>
    </div>
    <div class="cx-pane" data-pane="hesap">
      <div class="cx-screen">
        <div class="cx-top">
          <button type="button" class="cx-tg" data-act="ang" title="Trigonometrik işlemlerde açı birimi"></button>
          <button type="button" class="cx-tg" data-act="sci" title="Bilimsel tuşları göster/gizle">fx</button>
          <span class="cx-last" aria-live="polite"></span>
        </div>
        <input class="cx-in" type="text" inputmode="none" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="İşlem" placeholder="0">
        <div class="cx-out">
          <output class="cx-prev" aria-live="polite"></output>
          <button type="button" class="tp-btn sm" data-act="copy" title="Sonucu kopyala" aria-label="Sonucu kopyala">${svg("copy")}</button>
        </div>
      </div>
      <div class="cx-consts" aria-label="Sık kullanılan değerler">
        ${CONSTS.map(([lb, ins, u, tip]) => `<button type="button" data-ins="${ins}" title="${tip}"><b>${lb}</b><span>${u}</span></button>`).join("")}
      </div>
      <div class="cx-keys">
        ${KEYS.map(([lb, ins = lb, cls = "num"]) => `<button type="button" class="k ${cls}" data-key="${ins}"${KEY_LABEL[lb] ? ` aria-label="${KEY_LABEL[lb]}"` : ""}>${lb}</button>`).join("")}
      </div>
      <details class="cx-hist">
        <summary>Geçmiş <span class="cx-hn"></span></summary>
        <ol></ol>
        <button type="button" class="cx-link" data-act="hclear">Geçmişi temizle</button>
      </details>
      <p class="cx-hint">Ondalık için virgül: <b>4,1868</b>. Nokta binlik ayırır: <b>8.250</b> = 8250. Klavyeden de yazabilirsiniz; <kbd>Enter</kbd> hesaplar.</p>
    </div>
    <div class="cx-pane" data-pane="birim" hidden>
      <div class="cv-in">
        <label><span>Değer</span><input class="cv-val" type="text" inputmode="decimal" autocomplete="off" value="1" aria-label="Çevrilecek değer"></label>
        <label><span>Birim</span><select class="cv-unit" aria-label="Birim">${UNITS.map(([u]) => `<option>${u}</option>`).join("")}</select></label>
      </div>
      <ul class="cv-list"></ul>
      <p class="cx-hint">Bir satıra dokunun, değer hesap makinesine aktarılsın. Elektrikte yönetmelikteki <b>1 kWh = 860 kcal</b> değeri kullanılır; bu yüzden kWh ↔ kJ çevirisi 3.600 yerine 3.600,6 verir.</p>
    </div>`;

  const $ = s => t.body.querySelector(s);
  const inp = $(".cx-in"), prev = $(".cx-prev"), last = $(".cx-last");
  let caret = null;

  function syncTop() {
    $('[data-act="ang"]').textContent = deg ? "DEG" : "RAD";
    $('[data-act="sci"]').setAttribute("aria-pressed", sciOn);
    t.body.classList.toggle("sci-off", !sciOn);
  }
  function preview() {
    prev.classList.remove("err");
    try {
      const v = evaluate(inp.value, deg, ans);
      prev.textContent = v == null ? "" : "= " + fmt(v);
    } catch (e) { prev.textContent = ""; }
  }
  function renderHist() {
    $(".cx-hn").textContent = hist.length ? `(${hist.length})` : "";
    $(".cx-hist ol").innerHTML = hist.map((h, i) =>
      `<li><button type="button" data-h="${i}" title="Sonucu işleme ekle"><span>${h.e.replace(/</g, "&lt;")}</span><b>= ${fmt(h.r)}</b></button></li>`).join("")
      || `<li class="cx-empty">Henüz hesap yok.</li>`;
    $('[data-act="hclear"]').hidden = !hist.length;
  }
  function focusInput() { if (matchMedia("(pointer: fine)").matches) inp.focus({ preventScroll: true }); }
  function insert(s) {
    const isOp = /^[×÷−+^%)]/.test(s);
    if (freshResult && !isOp) inp.value = "";
    freshResult = false;
    const a = caret?.[0] ?? inp.value.length, b = caret?.[1] ?? inp.value.length;
    inp.value = inp.value.slice(0, a) + s + inp.value.slice(b);
    const c = a + s.length;
    caret = [c, c];
    try { inp.setSelectionRange(c, c); } catch (e) {}
    focusInput();
    preview();
  }
  function backspace() {
    freshResult = false;
    let a = caret?.[0] ?? inp.value.length, b = caret?.[1] ?? inp.value.length;
    if (a === b) {
      if (!a) return;
      // İşlev adlarını tek seferde sil: "sin(" vb.
      const m = inp.value.slice(0, a).match(/(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|10\^\(|Ans)$/);
      a -= m ? m[0].length : 1;
    }
    inp.value = inp.value.slice(0, a) + inp.value.slice(b);
    caret = [a, a];
    try { inp.setSelectionRange(a, a); } catch (e) {}
    focusInput();
    preview();
  }
  function clearAll() { inp.value = ""; caret = null; freshResult = false; prev.textContent = ""; prev.classList.remove("err"); last.textContent = ""; focusInput(); }
  function equals() {
    const src = inp.value.trim();
    if (!src) return;
    try {
      const v = evaluate(src, deg, ans);
      if (v == null) return;
      ans = v;
      saveCfg();
      if (!hist.length || hist[0].e !== src || hist[0].r !== v) {
        hist.unshift({ e: src, r: v });
        hist = hist.slice(0, 30);
        store.set("enerji-hesap-gecmis", hist);
        renderHist();
      }
      last.textContent = src + " =";
      inp.value = plain(v);
      caret = null;
      prev.textContent = "";
      freshResult = true;
      focusInput();
    } catch (e) {
      prev.textContent = e.message;
      prev.classList.add("err");
    }
  }

  ["keyup", "click", "select", "input"].forEach(ev => inp.addEventListener(ev, () => { caret = [inp.selectionStart, inp.selectionEnd]; }));
  inp.addEventListener("input", () => {
    // Klavyeden yazılan işaretleri tuşlardaki simgelere çevir (uzunluk aynı kaldığı için imleç kaymaz)
    const s = inp.selectionStart, v = inp.value.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
    if (v !== inp.value) { inp.value = v; inp.setSelectionRange(s, s); }
    freshResult = false;
    preview();
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === "=") { e.preventDefault(); return equals(); }
    if (e.key === "Escape" && inp.value) { e.preventDefault(); e.stopPropagation(); return clearAll(); }
    if (freshResult && e.key.length === 1 && /[\d.,(a-zπ√]/i.test(e.key) && !e.ctrlKey && !e.metaKey) { inp.select(); }
  });

  t.body.addEventListener("mousedown", e => { if (e.target.closest(".cx-keys button, .cx-consts button")) e.preventDefault(); });
  t.body.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.key) {
      const k = b.dataset.key;
      if (k === ":eq") return equals();
      if (k === ":clear") return clearAll();
      if (k === ":back") return backspace();
      return insert(k);
    }
    if (b.dataset.ins) return insert(b.dataset.ins);
    if (b.dataset.h) return insert(plain(hist[+b.dataset.h].r));
    if (b.dataset.tab) return tab(b.dataset.tab);
    if (b.dataset.cv) { tab("hesap"); return insert(b.dataset.cv); }
    switch (b.dataset.act) {
      case "ang": deg = !deg; saveCfg(); syncTop(); return preview();
      case "sci": sciOn = !sciOn; saveCfg(); return syncTop();
      case "hclear": hist = []; store.set("enerji-hesap-gecmis", hist); return renderHist();
      case "copy": {
        let v = null;
        try { v = evaluate(inp.value, deg, ans); } catch (err) {}
        if (v == null) return;
        navigator.clipboard?.writeText(plain(v)).then(() => {
          b.innerHTML = svg("check");
          setTimeout(() => { b.innerHTML = svg("copy"); }, 1200);
        }).catch(() => {});
      }
    }
  });

  function tab(name) {
    t.body.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
    t.body.querySelectorAll("[data-pane]").forEach(p => { p.hidden = p.dataset.pane !== name; });
    if (name === "birim") convert();
  }

  const cvVal = $(".cv-val"), cvUnit = $(".cv-unit"), cvList = $(".cv-list");
  function convert() {
    let v = null;
    try { v = evaluate(cvVal.value, deg, ans); } catch (e) {}
    const from = UNITS.find(u => u[0] === cvUnit.value);
    if (v == null) { cvList.innerHTML = `<li class="cx-empty">Geçerli bir sayı girin.</li>`; return; }
    const kcal = v * from[1];
    cvList.innerHTML = UNITS.filter(u => u !== from).map(([u, f]) => {
      const r = kcal / f;
      return `<li><button type="button" data-cv="${plain(r)}" title="Hesap makinesine aktar"><span>${u}</span><b>${fmt(r)}</b></button></li>`;
    }).join("");
  }
  cvVal.addEventListener("input", convert);
  cvUnit.addEventListener("change", convert);

  t.onOpen = () => { if (!t.el.querySelector('[data-pane="hesap"]').hidden) focusInput(); };
  syncTop();
  renderHist();
  return t;
}

/* ---------- Yazı tahtası ---------- */
const INKS = {
  ink: ["#14262d", "#e9eff1", "Siyah"],
  blue: ["#1f5fd1", "#86b4ff", "Mavi"],
  red: ["#c7322b", "#ff8d84", "Kırmızı"],
  green: ["#1b7a45", "#6fd6a0", "Yeşil"],
  amber: ["#b06f00", "#f2b84b", "Turuncu"]
};
const SIZES = [[2, "İnce"], [4, "Orta"], [8, "Kalın"]];
const BGS = [["kareli", "Kareli"], ["cizgili", "Çizgili"], ["bos", "Boş"]];

function makeBoard() {
  const t = panel("tahta", "Yazı tahtası", "board");
  const saved = store.get("enerji-tahta", {});
  let strokes = Array.isArray(saved.s) ? saved.s : [];
  let bg = BGS.some(b => b[0] === saved.bg) ? saved.bg : "kareli";
  let tool = "p", ink = "ink", size = 4;
  const undo = [], redo = [];

  t.el.querySelector(".tp-extra").innerHTML =
    `<button type="button" class="tp-btn" data-act="full" aria-label="Tam ekran" title="Tam ekran">${svg("expand")}</button>`;
  t.body.innerHTML = `
    <div class="wb-bar" role="toolbar" aria-label="Tahta araçları">
      <div class="wb-grp">
        <button type="button" class="wb-b" data-tool="p" title="Kalem" aria-label="Kalem">${svg("pen")}</button>
        <button type="button" class="wb-b" data-tool="e" title="Silgi" aria-label="Silgi">${svg("eraser")}</button>
      </div>
      <div class="wb-grp">
        ${Object.entries(INKS).map(([k, v]) => `<button type="button" class="wb-sw" data-ink="${k}" title="${v[2]}" aria-label="${v[2]} kalem"><i></i></button>`).join("")}
      </div>
      <div class="wb-grp">
        ${SIZES.map(([w, n]) => `<button type="button" class="wb-b" data-size="${w}" title="${n} uç" aria-label="${n} uç"><i style="width:${w + 3}px;height:${w + 3}px"></i></button>`).join("")}
      </div>
      <span class="grow"></span>
      <div class="wb-grp">
        <button type="button" class="wb-b" data-act="undo" title="Geri al (Ctrl+Z)" aria-label="Geri al">${svg("undo")}</button>
        <button type="button" class="wb-b" data-act="redo" title="Yinele (Ctrl+Y)" aria-label="Yinele">${svg("redo")}</button>
        <button type="button" class="wb-b" data-act="bg" title="Zemin: kareli, çizgili, boş" aria-label="Zemini değiştir">${svg("grid")}</button>
        <button type="button" class="wb-b" data-act="png" title="Resim olarak indir" aria-label="Resim olarak indir">${svg("download")}</button>
        <button type="button" class="wb-b danger" data-act="clear" title="Tahtayı temizle (geri alınabilir)" aria-label="Tahtayı temizle">${svg("trash")}</button>
      </div>
    </div>
    <div class="wb-stage">
      <canvas aria-label="Çizim alanı"></canvas>
      <p class="wb-empty">Parmakla, kalemle veya fareyle yazın.<br>Silgi ve geri al düğmeleri üst çubukta.</p>
    </div>`;

  const stage = t.body.querySelector(".wb-stage"), cv = stage.querySelector("canvas"), ctx = cv.getContext("2d");
  const empty = stage.querySelector(".wb-empty");
  let W = 0, H = 0, cur = null, pid = null, penSeen = false, saveTimer = 0;

  const color = k => (INKS[k] || INKS.ink)[theme() === "dark" ? 1 : 0];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  function style(s) {
    ctx.globalCompositeOperation = s.t === "e" ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = s.t === "e" ? "#000" : color(s.c);
    ctx.lineWidth = s.w;
    ctx.lineCap = ctx.lineJoin = "round";
  }
  function dot(s, q) { ctx.beginPath(); ctx.arc(q[0], q[1], s.w / 2, 0, Math.PI * 2); ctx.fill(); }
  function drawStroke(s) {
    const P = s.p;
    style(s);
    if (P.length < 2) return dot(s, P[0]);
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) { const m = mid(P[i], P[i + 1]); ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]); }
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    ctx.stroke();
  }
  // Çizim sürerken yalnızca yeni parçayı çiz
  function drawPiece(s, i) {
    const P = s.p;
    style(s);
    if (i === 0) return dot(s, P[0]);
    const a = i === 1 ? P[0] : mid(P[i - 2], P[i - 1]), c = P[i - 1], b = mid(P[i - 1], P[i]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    ctx.stroke();
  }
  function redraw() {
    if (!W) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    strokes.forEach(drawStroke);
    if (cur) drawStroke(cur);
    ctx.restore();
    sync();
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = devicePixelRatio || 1;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  new ResizeObserver(fit).observe(stage);

  function sync() {
    t.body.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === tool));
    t.body.querySelectorAll("[data-ink]").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.ink === ink);
      b.querySelector("i").style.background = color(b.dataset.ink);
    });
    t.body.querySelectorAll("[data-size]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.size === size));
    t.body.querySelector('[data-act="undo"]').disabled = !undo.length;
    t.body.querySelector('[data-act="redo"]').disabled = !redo.length;
    t.body.querySelector('[data-act="clear"]').disabled = !strokes.length;
    stage.dataset.bg = bg;
    stage.dataset.tool = tool;
    empty.hidden = strokes.length > 0 || !!cur;
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set("enerji-tahta", { s: strokes, bg }), 300);
  }

  const pt = e => {
    const r = cv.getBoundingClientRect();
    return [Math.round((e.clientX - r.left) * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10];
  };
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "pen") penSeen = true;
    if (e.pointerType === "touch" && penSeen) return; // kalem kullanılırken avuç temasını yok say
    if (cur) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    pid = e.pointerId;
    cur = { t: tool, c: ink, w: tool === "e" ? size * 5 : size, p: [pt(e)] };
    ctx.save(); drawPiece(cur, 0); ctx.restore();
    empty.hidden = true;
  });
  cv.addEventListener("pointermove", e => {
    if (!cur || e.pointerId !== pid) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    ctx.save();
    for (const ev of evs.length ? evs : [e]) {
      const q = pt(ev), l = cur.p[cur.p.length - 1];
      if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 0.8) continue;
      cur.p.push(q);
      drawPiece(cur, cur.p.length - 1);
    }
    ctx.restore();
  });
  function end(e) {
    if (!cur || e.pointerId !== pid) return;
    const s = cur;
    cur = null; pid = null;
    strokes.push(s);
    undo.push({ a: "add" });
    redo.length = 0;
    redraw();
    persist();
  }
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);

  function doUndo() {
    const op = undo.pop();
    if (!op) return;
    if (op.a === "add") redo.push({ a: "add", s: strokes.pop() });
    else { redo.push({ a: "clear" }); strokes = op.prev; }
    redraw(); persist();
  }
  function doRedo() {
    const op = redo.pop();
    if (!op) return;
    if (op.a === "add") { strokes.push(op.s); undo.push({ a: "add" }); }
    else { undo.push({ a: "clear", prev: strokes }); strokes = []; }
    redraw(); persist();
  }
  function clearBoard() {
    if (!strokes.length) return;
    undo.push({ a: "clear", prev: strokes });
    redo.length = 0;
    strokes = [];
    redraw(); persist();
  }
  function png() {
    const o = document.createElement("canvas");
    o.width = cv.width; o.height = cv.height;
    const c = o.getContext("2d");
    c.fillStyle = getComputedStyle(stage).backgroundColor || "#fff";
    c.fillRect(0, 0, o.width, o.height);
    c.drawImage(cv, 0, 0);
    o.toBlob(b => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "yazi-tahtasi.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  t.el.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.tool) { tool = b.dataset.tool; return sync(); }
    if (b.dataset.ink) { ink = b.dataset.ink; tool = "p"; return sync(); }
    if (b.dataset.size) { size = +b.dataset.size; return sync(); }
    switch (b.dataset.act) {
      case "undo": return doUndo();
      case "redo": return doRedo();
      case "clear": return clearBoard();
      case "png": return png();
      case "bg": bg = BGS[(BGS.findIndex(x => x[0] === bg) + 1) % BGS.length][0]; persist(); return sync();
      case "full": {
        const f = t.el.classList.toggle("full");
        b.innerHTML = svg(f ? "shrink" : "expand");
        b.title = f ? "Tam ekrandan çık" : "Tam ekran";
        b.setAttribute("aria-label", b.title);
        front(t.el);
      }
    }
  });
  document.addEventListener("keydown", e => {
    if (t.el.hidden || !(e.ctrlKey || e.metaKey) || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); doRedo(); }
  });

  // Masaüstünde yeniden boyutlandırılan tahtanın ölçüsünü hatırla
  new ResizeObserver(() => {
    if (t.el.hidden || !wide() || t.el.classList.contains("full") || t.el.classList.contains("min")) return;
    pos.tahta = Object.assign(pos.tahta || {}, { w: t.el.offsetWidth, h: t.el.offsetHeight });
    clearTimeout(t.rt);
    t.rt = setTimeout(() => store.set("enerji-arac-konum", pos), 300);
  }).observe(t.el);

  t.redraw = redraw;
  t.onOpen = fit;
  sync();
  return t;
}

/* ---------- Başlat ---------- */
let board = null;
function init() {
  mountButtons();
  makeCalc();
  board = makeBoard();
  ["hesap", "tahta"].forEach(k => { if (openState[k]) openTool(k, true); });
  syncButtons();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();
