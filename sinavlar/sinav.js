// Ortak sınav motoru. Her sınav sayfası bu dosyadan önce SINAV = { key, topics, Q } tanımlar.
// Soru alanları: t konu, s slayt, q soru, o şıklar, a doğru şık, e açıklama, n öğretici not,
// g (isteğe bağlı) sunumdaki eski veriyle güncel veri: { eski, yeni, kaynak }.
const Q = SINAV.Q, TOPICS = SINAV.topics, KEY = SINAV.key;
const LET = ["A", "B", "C", "D", "E"];
const $ = id => document.getElementById(id);

let S;

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function fresh(ids, mode) {
  const order = shuffle(ids || Q.map((_, i) => i));
  const perm = {};
  order.forEach(i => { perm[i] = shuffle([0, 1, 2, 3, 4]); });
  return { n: Q.length, mode: mode || "pr", order, perm, ans: {}, cur: 0, done: false, view: "q", ask: false, filter: "all" };
}
function valid(s) {
  return s && s.n === Q.length && Array.isArray(s.order) && s.order.length > 0 &&
    s.order.every(i => Q[i] && Array.isArray(s.perm?.[i])) && typeof s.ans === "object";
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    // Ana sayfadaki ilerleme kartları için kısa özet
    const all = JSON.parse(localStorage.getItem("enerji-ozet") || "{}"), c = counts();
    all[KEY] = { n: N(), cevap: answered(), dogru: c.ok, bitti: S.done, t: Date.now() };
    localStorage.setItem("enerji-ozet", JSON.stringify(all));
  } catch (e) {}
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return valid(s) ? s : null; } catch (e) { return null; } }

const N = () => S.order.length;
const answered = () => S.order.filter(i => S.ans[i] !== undefined).length;
const HINT = {
  pr: "Her cevaptan sonra doğru şık, açıklama ve öğretici not gösterilir.",
  ex: "Cevaplar sınav bitince açılır; bitirmeden önce işaretinizi değiştirebilirsiniz."
};
const revealed = i => S.done || (S.mode === "pr" && S.ans[i] !== undefined);
function status(i) {
  if (S.ans[i] === undefined) return "blank";
  return S.ans[i] === Q[i].a ? "ok" : "bad";
}
function counts() {
  const c = { ok: 0, bad: 0, blank: 0 };
  S.order.forEach(i => c[status(i)]++);
  return c;
}

function render() {
  $("m-pr").setAttribute("aria-pressed", S.mode === "pr");
  $("m-ex").setAttribute("aria-pressed", S.mode === "ex");
  const na = answered();
  $("pg").style.width = (na / N() * 100) + "%";
  if ($("mhint")) $("mhint").textContent = S.done ? "Deneme tamamlandı. Sorulara dönüp açıklamaları inceleyebilirsiniz." : HINT[S.mode];
  const pc = `<span class="pc"><b>${na}</b> / ${N()} cevaplandı</span>`;
  if (S.mode === "pr" || S.done) {
    let ok = 0, bad = 0;
    S.order.forEach(i => { if (revealed(i) && S.ans[i] !== undefined) (S.ans[i] === Q[i].a ? ok++ : bad++); });
    $("tally").innerHTML = `<span class="ok"><b>${ok}</b> doğru</span><span class="bad"><b>${bad}</b> yanlış</span><span><b>${N() - na}</b> boş</span>${pc}`;
  } else {
    $("tally").innerHTML = `<span class="mk"><b>${na}</b> / ${N()} işaretlendi</span><span class="pc">sonuçlar sınav bitince</span>`;
  }
  $("quiz").hidden = S.view !== "q";
  $("results").hidden = S.view !== "res";
  if (S.view === "q") renderQ(); else renderRes();
  renderMap();
}

function renderQ() {
  const qi = S.order[S.cur], q = Q[qi], p = S.perm[qi], a = S.ans[qi], rev = revealed(qi);
  const locked = S.done || (S.mode === "pr" && a !== undefined);
  const opts = p.map((oi, k) => {
    let cls = "opt";
    if (rev) {
      if (oi === q.a) cls += " ok";
      else if (a === oi) cls += " bad";
      else cls += " dim";
    } else if (a === oi) cls += " sel";
    return `<li><button type="button" class="${cls}" data-k="${k}" ${locked ? "disabled" : ""} aria-pressed="${a === oi}"><span class="lt">${LET[k]}</span><span class="tx">${q.o[oi]}</span></button></li>`;
  }).join("");
  let fb = "";
  if (rev) {
    const right = LET[p.indexOf(q.a)];
    const st = status(qi);
    const head = st === "ok" ? "Doğru." : st === "bad" ? `Yanlış. Doğru cevap ${right}.` : `Boş bırakıldı. Doğru cevap ${right}.`;
    fb = `<div class="fb ${st}"><strong>${head}</strong><p>${q.e}</p></div>${extras(q)}`;
  }
  const last = S.cur === N() - 1;
  const allDone = answered() === N();
  let nav = `<button type="button" class="btn" id="prev" ${S.cur === 0 ? "disabled" : ""}>← Önceki</button><span class="grow"></span>`;
  if (S.done) {
    nav += `<button type="button" class="btn" id="tores">Sonuçlar</button>`;
    nav += `<button type="button" class="btn primary" id="next" ${last ? "disabled" : ""}>Sonraki →</button>`;
  } else if (S.mode === "ex") {
    if (S.ask) {
      nav = `<span class="note"><b>${N() - answered()} soru boş.</b> Boş sorular net hesabında yanlış sayılmaz.</span><span class="grow"></span>
        <button type="button" class="btn" id="cancel">Sorulara dön</button><button type="button" class="btn primary" id="finish2">Yine de bitir</button>`;
    } else {
      nav += `<button type="button" class="btn warn" id="finish">Sınavı bitir</button>`;
      if (!last) nav += `<button type="button" class="btn primary" id="next">Sonraki →</button>`;
    }
  } else {
    if (allDone) nav += `<button type="button" class="btn ${last ? "primary" : ""}" id="finish2">Sonuçları gör</button>`;
    if (!last) nav += `<button type="button" class="btn primary" id="next">Sonraki →</button>`;
  }
  $("quiz").innerHTML = `
    <div class="qhead"><span class="qnum">Soru ${S.cur + 1} <small>/ ${N()}</small></span><span class="chip">${TOPICS[q.t]}</span>${rev ? `<span class="chip src">sunumda slayt ${q.s}</span>` : ""}</div>
    <p class="qtext">${q.q}</p>
    <ul class="opts">${opts}</ul>
    ${fb}
    <div class="nav">${nav}</div>`;
}

// Cevaptan sonra gösterilen öğretici not ve güncel veri kutuları
function extras(q) {
  let h = `<div class="tip"><strong>Öğretici not</strong><p>${q.n}</p></div>`;
  if (q.g) h += `<div class="upd"><strong>Güncellendi</strong><p><span class="old">Sunumdaki veri: ${q.g.eski}</span><span>Güncel veri: ${q.g.yeni}</span><span class="srcline">Kaynak: ${q.g.kaynak}</span></p></div>`;
  return h;
}

function renderMap() {
  $("map").innerHTML = S.order.map((qi, k) => {
    let cls = "";
    if (revealed(qi) && S.ans[qi] !== undefined) cls = status(qi);
    else if (S.ans[qi] !== undefined) cls = "ans";
    if (S.view === "q" && k === S.cur) cls += " cur";
    return `<button type="button" class="${cls.trim()}" data-go="${k}" aria-label="Soru ${k + 1}">${k + 1}</button>`;
  }).join("");
}

function renderRes() {
  const c = counts(), n = N();
  const net = c.ok - c.bad / 4;
  const pct = Math.round(c.ok / n * 100);
  const verdict = pct >= 85 ? "Sunuma hâkimsiniz." : pct >= 60 ? "İyi gidiyor. Zayıf konuları tekrar edin." : "Sunumu bir kez daha gözden geçirin.";
  const per = TOPICS.map((name, t) => {
    const ids = S.order.filter(i => Q[i].t === t);
    if (!ids.length) return "";
    const ok = ids.filter(i => status(i) === "ok").length;
    const r = ok / ids.length;
    return `<div class="trow"><span class="tn">${name}</span><span class="tv">${ok}/${ids.length}</span><span class="tb"><i class="${r < .5 ? "low" : r < .8 ? "mid" : ""}" style="width:${r * 100}%"></i></span></div>`;
  }).join("");
  const keep = qi => S.filter === "all" || (S.filter === "upd" ? !!Q[qi].g : status(qi) !== "ok");
  const list = S.order.map((qi, k) => ({ qi, k })).filter(({ qi }) => keep(qi)).map(({ qi, k }) => {
    const q = Q[qi], p = S.perm[qi], st = status(qi), a = S.ans[qi];
    const pill = (st === "ok" ? `<span class="pill ok">doğru</span>` : st === "bad" ? `<span class="pill bad">yanlış</span>` : `<span class="pill blank">boş</span>`) + (q.g ? ` <span class="pill upd">güncellendi</span>` : "");
    const yours = a === undefined ? "" : st === "bad" ? `<span>Cevabınız: <span class="wr">${LET[p.indexOf(a)]}) ${q.o[a]}</span></span>` : "";
    return `<li><div class="rq"><span class="n">${k + 1}.</span><p>${q.q} ${pill}</p></div>
      <div class="ra">${yours}<span>Doğru cevap: <b>${LET[p.indexOf(q.a)]}) ${q.o[q.a]}</b></span><span>${q.e} <i>(sunumda slayt ${q.s})</i></span>${extras(q)}</div></li>`;
  }).join("") || `<li><span class="note">${S.filter === "upd" ? "Bu listede güncellenen soru yok." : "Yanlış veya boş soru yok."}</span></li>`;
  const nUpd = S.order.filter(i => Q[i].g).length;
  const miss = c.bad + c.blank;
  $("results").innerHTML = `
    <div class="score">
      <div class="ring" style="--p:${pct};--ring:var(${pct >= 85 ? "--ok" : pct >= 60 ? "--spark" : "--bad"})" role="img" aria-label="${n} sorudan ${c.ok} doğru, yüzde ${pct}"><div><span><b>%${pct}</b><small>${c.ok} / ${n} doğru</small></span></div></div>
      <div class="verdict"><h2>${verdict}</h2>
        <div class="stats"><span><b>%${pct}</b> başarı</span><span><b>${c.ok}</b> doğru</span><span><b>${c.bad}</b> yanlış</span><span><b>${c.blank}</b> boş</span><span>net <b>${net.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</b></span>${nUpd ? `<span><b>${nUpd}</b> soruda veri güncellendi</span>` : ""}</div>
      </div>
    </div>
    <div class="actions">
      ${miss ? `<button type="button" class="btn primary" id="retry">Yanlış ve boşları tekrar çöz (${miss})</button>` : ""}
      <button type="button" class="btn ${miss ? "" : "primary"}" id="restart">Baştan başla, soruları karıştır</button>
      <button type="button" class="btn" id="back">Sorulara dön</button>
      <a class="btn" href="../index.html">Ana sayfa</a>
    </div>
    <h3>Konulara göre</h3>
    <div class="topics">${per}</div>
    <div class="rvhead"><h3>Cevap anahtarı ve açıklamalar</h3>
      <div class="seg" role="group" aria-label="Liste filtresi">
        <button type="button" data-f="all" aria-pressed="${S.filter === "all"}">Tümü</button>
        <button type="button" data-f="miss" aria-pressed="${S.filter === "miss"}">Yanlış ve boş</button>
        ${nUpd ? `<button type="button" data-f="upd" aria-pressed="${S.filter === "upd"}">Güncellenenler</button>` : ""}
      </div></div>
    <ul class="review">${list}</ul>`;
}

function choose(k) {
  if (S.view !== "q" || S.done || S.ask) return;
  const qi = S.order[S.cur];
  if (S.mode === "pr" && S.ans[qi] !== undefined) return;
  S.ans[qi] = S.perm[qi][k];
  commit();
  if (S.mode === "pr") ($("next") || $("finish2"))?.focus();
}
function go(k) {
  if (k < 0 || k >= N()) return;
  S.cur = k; S.view = "q"; S.ask = false; commit();
  // Yeni sorunun başı ekranın üstünde kaldıysa soruyu görünür yap
  const el = $("quiz"), m = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  if (el.getBoundingClientRect().top < m - 20) el.scrollIntoView({ block: "start" });
}
function finish() { S.done = true; S.ask = false; S.view = "res"; S.filter = "all"; commit(); window.scrollTo({ top: 0 }); }
function commit() { save(); render(); }

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.k !== undefined) return choose(+b.dataset.k);
  if (b.dataset.go !== undefined) { go(+b.dataset.go); $("quiz").scrollIntoView({ block: "nearest" }); return; }
  if (b.dataset.f) { S.filter = b.dataset.f; return commit(); }
  switch (b.id) {
    case "m-pr": case "m-ex": {
      const m = b.id === "m-pr" ? "pr" : "ex";
      if (m === S.mode) return;
      // Bitmiş bir denemede biçim değişirse yeni deneme başlar
      S = S.done ? fresh(null, m) : Object.assign(S, { mode: m, ask: false });
      return commit();
    }
    case "prev": return go(S.cur - 1);
    case "next": return go(S.cur + 1);
    case "finish": if (answered() < N()) { S.ask = true; return commit(); } return finish();
    case "finish2": return finish();
    case "cancel": S.ask = false; return commit();
    case "tores": S.view = "res"; return commit();
    case "back": S.view = "q"; return commit();
    case "retry": S = fresh(S.order.filter(i => status(i) !== "ok"), S.mode); window.scrollTo({ top: 0 }); return commit();
    case "restart": S = fresh(null, S.mode); window.scrollTo({ top: 0 }); return commit();
  }
});

document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || S.view !== "q") return;
  // Hesap makinesi veya başka bir alana yazarken kısayolları devre dışı bırak
  if (e.defaultPrevented || e.target.closest?.("input, textarea, select, [contenteditable], .tool-panel")) return;
  const k = e.key.toLowerCase();
  const idx = Math.max("abcde".indexOf(k), "12345".indexOf(k));
  if (k.length === 1 && idx >= 0) { e.preventDefault(); return choose(idx); }
  if (e.key === "ArrowRight") return go(S.cur + 1);
  if (e.key === "ArrowLeft") return go(S.cur - 1);
  if (e.key === "Enter" && e.target === document.body) {
    const qi = S.order[S.cur];
    if (S.ans[qi] !== undefined || S.done) go(S.cur + 1);
  }
});

function start(data) {
  S = valid(data && data.S) ? data.S : (load() || fresh());
  render();
}
window.claude?.hot?.snapshot?.(() => ({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
