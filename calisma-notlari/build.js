// Bölüm HTML parçalarını birleştirip Chromium ile tek PDF üretir.
// Kullanım: node build.js  (playwright gerekir)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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
const tocHtml = `<div style="break-after:page"><div class="toc-baslik">İÇİNDEKİLER</div><div class="icindekiler">${toc.join('')}</div></div>`;
body = body.replace('<!--TOC-->', tocHtml);
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Enerji Yöneticiliği Çalışma Notları</title><style>${css}</style></head><body>${body}</body></html>`;
fs.writeFileSync(path.join(dir, 'tum-notlar.html'), html);

(async () => {
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
