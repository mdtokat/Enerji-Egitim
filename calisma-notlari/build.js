// Bölüm HTML parçalarını birleştirip web sürümünü (tum-notlar.html) ve Chromium ile tek PDF üretir.
// Kullanım: node build.js         (web + PDF, playwright gerekir)
//           node build.js --html  (yalnızca web sürümü, bağımlılık gerekmez)
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const parts = fs.readdirSync(path.join(dir, 'bolumler')).filter(f => f.endsWith('.html')).sort();
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
let body = parts.map(f => fs.readFileSync(path.join(dir, 'bolumler', f), 'utf8')).join('\n');

// İçindekiler: h1/h2 başlıklarından otomatik
const strip = s => s.replace(/<span class="kaynak">.*?<\/span>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const toc = [];
body = body.replace(/<(h1|h2)>([\s\S]*?)<\/\1>/g, (m, tag, inner) => {
  if (m.includes('ENERJİ YÖNETİCİLİĞİ<br>')) return m;
  const id = 'b' + toc.length;
  toc.push(`<div class="${tag === 'h1' ? 'b1' : 'b2'}"><a href="#${id}" style="color:inherit;text-decoration:none">${strip(inner)}</a></div>`);
  return `<${tag} id="${id}">${inner}</${tag}>`;
});
const tocHtml = `<div id="icindekiler" style="break-after:page"><div class="toc-baslik">İÇİNDEKİLER</div><div class="icindekiler">${toc.join('')}</div></div>`;
body = body.replace('<!--TOC-->', tocHtml);
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Enerji Yöneticiliği Çalışma Notları</title><style>${css}</style></head><body>${body}</body></html>`;

// Web sürümü: ortak tema, üst çubuk ve araçlar (hesap makinesi, yazı tahtası) eklenir. Ekran stilleri style.css içinde @media screen altında.
const web = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Enerji Yöneticiliği Çalışma Notları</title>
<script>try{var t=localStorage.getItem("enerji-tema");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@500&family=Source+Sans+3:wght@400;600;700&display=swap">
<link rel="stylesheet" href="../ortak/tema.css">
<link rel="stylesheet" href="../ortak/araclar.css">
<style>${css}</style></head><body class="web">
<nav class="topbar" aria-label="Sayfa çubuğu">
  <a class="ibtn back" href="../index.html" title="Ana sayfa"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg><span class="lbl">Ana sayfa</span></a>
  <span class="brand"><span>Çalışma notları</span></span>
  <a class="ibtn" href="#icindekiler" title="İçindekiler"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg><span class="lbl">İçindekiler</span></a>
  <span class="grow"></span>
  <div class="tools-slot"></div>
</nav>
<main class="notes">${body}</main>
<script src="../ortak/araclar.js"></script>
</body></html>`;
fs.writeFileSync(path.join(dir, 'tum-notlar.html'), web);
if (process.argv.includes('--html')) {
  console.log('Web sürümü hazır:', parts.length, 'parça');
  process.exit(0);
}

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({
    path: path.join(dir, '..', 'Enerji_Yoneticiligi_Calisma_Notlari.pdf'),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:7pt;width:100%;text-align:center;color:#888;font-family:DejaVu Sans">Enerji Yöneticiliği Çalışma Notları — <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '14mm', bottom: '16mm', left: '13mm', right: '13mm' },
  });
  await browser.close();
  console.log('PDF hazır:', parts.length, 'parça');
})();
