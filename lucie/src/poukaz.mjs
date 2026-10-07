// Dárkový poukaz – tisková předloha ve formátu DL (210 × 99 mm) se spadávkou 3 mm.
// Údaje bere ze src/site.mjs: po změně telefonu nebo adresy stačí spustit znovu.
// Údaje provozovatele ani IČO na poukazu nejsou (rozhodnutí klienta, 1. 10. 2026).
// Výstup do tisk/: poukaz-<minuty>.html (předloha), .pdf (pro tiskárnu: přední + zadní strana, 216 × 105 mm),
// -orezove-znacky.pdf (totéž se značkami ořezu, pro tiskárny, které je chtějí)
// a -predni.png / -zadni.png (náhledy po ořezu, třeba k odeslání SMS nebo e-mailem).
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { site as s } from './site.mjs';
import { czechTypo, OLIVE } from './common.mjs';

const out = resolve(import.meta.dirname, '../tisk');
const assets = '../public/assets/';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Pevné řezy písem z tisk/fonts (vytváří src/tiskova-pisma.py). Proměnná webová písma by Chrome vložil do PDF jako Type3.
const fonts = [['Editorial', 'editorial', 'normal', [300, 400, 500]], ['Editorial', 'editorial-italic', 'italic', [400]], ['Manrope', 'manrope', 'normal', [400, 500, 600]]]
  .flatMap(([family, stem, style, weights]) => weights.map(weight => `@font-face { font-family: ${family}; src: url('fonts/${stem}-${weight}.woff2') format('woff2'); font-style: ${style}; font-weight: ${weight}; }`))
  .join('\n');

const css = `
${fonts}
@page { size: 216mm 105mm; margin: 0; }
:root { --emerald: #064E3B; --emerald-deep: #043628; --champagne: #F8E7C9; --champagne-light: #FCF4E6; --gold: #C9B083; --gold-soft: #E6CFA2; --bronze: #76602F; --ink-soft: #2F5E4E; --on-dark-soft: #C3C5AA; --serif: Editorial, "Cormorant Garamond", Georgia, serif; --sans: Manrope, "Segoe UI", sans-serif; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-synthesis: none; }
body { font-family: var(--sans); color: var(--emerald); -webkit-font-smoothing: antialiased; }
h1, h2 { font-family: var(--serif); font-weight: 400; }
svg { display: block; overflow: visible; }
.plate { position: relative; break-after: page; }
.plate:last-child { break-after: auto; }
.sheet { position: relative; width: 216mm; height: 105mm; overflow: hidden; }
/* Varianta se značkami ořezu: kolem spadávky je 8 mm volného okraje se značkami. */
.crop { display: none; }
.marks .plate { width: 232mm; height: 121mm; padding: 8mm; }
.marks .crop { display: block; position: absolute; inset: 0; width: 232mm; height: 121mm; }
/* Plocha po ořezu je 210 × 99 mm; texty drží nejméně 8 mm od hrany ořezu. */
.trim { position: absolute; left: 3mm; top: 3mm; width: 210mm; height: 99mm; }
.eyebrow { display: flex; align-items: center; gap: 2.6mm; font: 600 5.5pt/1 var(--sans); letter-spacing: .32em; text-transform: uppercase; }
.eyebrow::before { content: ""; width: 8mm; height: .25mm; background: currentColor; opacity: .6; }
.sprig { fill: none; stroke-linecap: round; }
@media screen {
  body { display: grid; justify-content: center; gap: 12mm; padding: 14mm; background: #E4DCCB; }
  .sheet { box-shadow: 0 6mm 14mm -6mm rgba(2, 30, 22, .45); }
}

/* ---------- Přední strana ---------- */
.front { background: var(--emerald); color: var(--champagne); }
.light { position: absolute; inset: 0; background:
  radial-gradient(60% 85% at 84% 6%, rgba(248, 231, 201, .16), transparent 62%),
  linear-gradient(112deg, transparent 0 26%, rgba(248, 231, 201, .07) 33%, transparent 41%),
  linear-gradient(112deg, transparent 0 47%, rgba(248, 231, 201, .05) 52%, transparent 58%); }
.arch { position: absolute; right: 17mm; bottom: 0; width: 60mm; height: 84mm; overflow: hidden; border-radius: 30mm 30mm 0 0; background: var(--emerald-deep); box-shadow: 0 4mm 10mm rgba(2, 30, 22, .35); }
.arch img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 62%; }
.arch::after { content: ""; position: absolute; inset: 2.2mm 2.2mm -1mm; border: .25mm solid rgba(248, 231, 201, .55); border-radius: 27.8mm 27.8mm 0 0; }
.seal { position: absolute; left: 123.5mm; top: 20.5mm; z-index: 2; width: 31mm; height: 31mm; filter: drop-shadow(0 1.5mm 2.5mm rgba(2, 30, 22, .4)); }
.front-copy { display: flex; flex-direction: column; justify-content: space-between; width: 110mm; padding: 12mm 0 11mm 14mm; }
.brand-name { display: block; font: 500 15pt/1 var(--serif); }
.brand-sub { display: block; margin-top: 1.8mm; color: var(--gold); font: 600 5.5pt/1 var(--sans); letter-spacing: .38em; text-transform: uppercase; }
.front h1 { font-size: 46pt; line-height: 1.04; letter-spacing: -.01em; }
.front h1 em { display: block; color: var(--gold-soft); }
.service-time { display: flex; align-items: baseline; gap: 2mm; font-family: var(--serif); }
.service-time span { font-size: 30pt; font-weight: 300; line-height: .9; font-variant-numeric: lining-nums; }
.service-time em { color: var(--gold-soft); font-size: 13pt; }
.service-name { margin-top: 2mm; color: var(--on-dark-soft); font: 600 6pt/1 var(--sans); letter-spacing: .3em; text-transform: uppercase; }

/* ---------- Zadní strana ---------- */
.back { background: var(--champagne-light); }
.back-copy { display: flex; flex-direction: column; width: 118mm; padding: 11mm 0 8mm 14mm; }
.back-copy .eyebrow { color: var(--bronze); }
.back h2 { margin-top: 3mm; font-size: 22pt; line-height: 1.1; }
.back h2 em { color: var(--ink-soft); }
.back-service { margin-top: 2.2mm; color: var(--ink-soft); font: 600 6pt/1.4 var(--sans); letter-spacing: .2em; text-transform: uppercase; }
.fields { display: grid; grid-template-columns: max-content 1fr max-content 1fr; align-items: end; gap: 3.2mm 2.5mm; margin-top: 6mm; }
.label { padding-bottom: .9mm; color: var(--ink-soft); font: 600 5pt/1 var(--sans); letter-spacing: .24em; text-transform: uppercase; }
.label.second { margin-left: 4.5mm; }
.line { height: 8.5mm; border-bottom: .25mm solid rgba(6, 78, 59, .45); }
.line.wide { grid-column: 2 / -1; }
.fine { margin-top: auto; max-width: 104mm; color: var(--ink-soft); font: 400 5.6pt/1.5 var(--sans); }
.info { position: absolute; right: 17mm; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 64mm; height: 88mm; padding: 20mm 5mm 9mm; border-radius: 32mm 32mm 0 0; background: var(--emerald); color: var(--champagne); text-align: center; }
.info::before { content: ""; position: absolute; inset: 2.2mm 2.2mm -1mm; border: .25mm solid rgba(248, 231, 201, .3); border-radius: 29.8mm 29.8mm 0 0; }
.info .sprig { width: 22mm; height: 8.8mm; margin-bottom: 3.5mm; stroke: var(--gold); }
.info .eyebrow { justify-content: center; color: var(--gold); letter-spacing: .28em; }
.info .eyebrow::before { display: none; }
.info-text { margin-top: 3mm; color: var(--on-dark-soft); font: 400 6.6pt/1.6 var(--sans); }
.phone { margin-top: 3.5mm; color: var(--gold-soft); font: 400 21pt/1 var(--serif); font-variant-numeric: lining-nums; }
.address { margin-top: 2.4mm; font: 500 7pt/1.4 var(--sans); }
`;

function render(svc) {
  const lower = svc.name[0].toLowerCase() + svc.name.slice(1);
  const ring = `DÁRKOVÝ POUKAZ · MASÁŽE · ${s.city.toUpperCase()} ·`;
  const seal = `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><path id="ring" d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0"/></defs><circle cx="100" cy="100" r="99" fill="#043628"/><circle cx="100" cy="100" r="91" fill="none" stroke="rgba(248,231,201,.35)" stroke-width="1"/><text fill="#F8E7C9" font-family="Manrope" font-size="13" font-weight="600"><textPath href="#ring" textLength="452" lengthAdjust="spacing">${ring}</textPath></text><text x="100" y="114" text-anchor="middle" fill="#E6CFA2" font-family="Editorial" font-size="46" font-style="italic">LK</text></svg>`;
  const sprig = `<svg class="sprig" viewBox="0 0 120 48" aria-hidden="true">${OLIVE}</svg>`;
  // Značky ořezu (jen ve variantě pro tiskárny, které je chtějí); končí 3 mm před spadávkou.
  const crop = '<svg class="crop" viewBox="0 0 232 121" aria-hidden="true"><path d="M11 0V5M221 0V5M11 116V121M221 116V121M0 11H5M0 110H5M227 11H232M227 110H232" stroke="#000" stroke-width=".1" fill="none"/></svg>';
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><title>Dárkový poukaz – ${esc(svc.name)}, ${svc.minutes} minut | ${esc(s.name)}</title><style>${css}</style></head><body>
<div class="plate">${crop}<section class="sheet front" data-name="predni"><div class="light"></div><figure class="arch"><img src="${assets}wellness.webp" alt=""></figure><div class="seal">${seal}</div><div class="trim front-copy"><p class="brand"><span class="brand-name">${esc(s.name)}</span><span class="brand-sub">Masáže · ${esc(s.city)}</span></p><h1>Dárkový <em>poukaz</em></h1><div class="service"><p class="service-time"><span>${svc.minutes}</span><em>minut</em></p><p class="service-name">${esc(svc.name)}</p></div></div></section></div>
<div class="plate">${crop}<section class="sheet back" data-name="zadni"><div class="trim back-copy"><p class="eyebrow">Dárkový poukaz</p><h2>Chvíle <em>jen pro sebe.</em></h2><p class="back-service">${esc(svc.name)} · ${svc.minutes} minut</p><div class="fields"><span class="label">Pro</span><span class="line wide"></span><span class="label">Od</span><span class="line wide"></span><span class="label">Číslo poukazu</span><span class="line"></span><span class="label second">Platnost do</span><span class="line"></span><span class="label">Vystaveno dne</span><span class="line"></span><span class="label second">Podpis / razítko</span><span class="line"></span></div><p class="fine">Poukaz na ${esc(lower)} v délce ${svc.minutes} minut. ${esc(s.name)} · ${esc(s.address)}, ${esc(s.city)}.</p></div><div class="info">${sprig}<p class="eyebrow">Jak poukaz uplatnit</p><p class="info-text">Termín si domluvte telefonem nebo SMS.<br>Při objednání uveďte číslo poukazu.</p><p class="phone">${esc(s.phone)}</p><p class="address">${esc(s.address)}, ${esc(s.city)}</p></div></section></div>
</body></html>`;
}

function findChrome() {
  return [process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].find(path => path && existsSync(path));
}

// Chrome zaokrouhluje velikost stránky a nezapisuje tiskové rámečky. Tady se doplní přesný MediaBox,
// BleedBox (spadávka 216 × 105 mm) a TrimBox (formát po ořezu 210 × 99 mm) a přepočítá se tabulka xref.
// Obsah Chrome kreslí od horní hrany stránky, proto se rámečky měří od ní. Neznámou strukturu PDF nechá beze změny.
function finishPdf(buf, { width, height, offset }) {
  const pt = mm => mm * 72 / 25.4;
  const num = v => String(Math.round(v * 1000) / 1000);
  const box = (x, y, w, h, top) => `[${num(pt(x))} ${num(top - pt(y + h))} ${num(pt(x + w))} ${num(top - pt(y))}]`;
  const pdf = buf.toString('latin1');
  const xrefAt = Number(/startxref\s+(\d+)\s*%%EOF\s*$/.exec(pdf)?.[1]);
  const table = Number.isFinite(xrefAt) && /^xref\r?\n([\s\S]*?)trailer([\s\S]*?)startxref/.exec(pdf.slice(xrefAt));
  if (!table) return buf;
  const edits = [];
  const head = pdf.slice(0, xrefAt).replace(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g, (match, x0, y0, x1, y1, at) => {
    const top = Number(y1);
    const boxes = `/MediaBox [0 ${num(top - pt(height))} ${num(pt(width))} ${num(top)}] /BleedBox ${box(offset, offset, 216, 105, top)} /TrimBox ${box(offset + 3, offset + 3, 210, 99, top)}`;
    edits.push({ at, delta: boxes.length - match.length });
    return boxes;
  });
  const shift = position => edits.reduce((sum, edit) => sum + (edit.at < position ? edit.delta : 0), 0);
  const rows = table[1].split('\n').map(row => row.trim()).filter(Boolean);
  let xref = 'xref\n';
  for (let i = 0; i < rows.length;) {
    const [start, count] = rows[i++].split(/\s+/).map(Number);
    xref += `${start} ${count}\n`;
    for (let k = 0; k < count; k++, i++) {
      const [position, generation, type] = rows[i].split(/\s+/);
      xref += `${String(Number(position) + (type === 'n' ? shift(Number(position)) : 0)).padStart(10, '0')} ${generation} ${type} \n`;
    }
  }
  return Buffer.from(`${head}${xref}trailer\n${table[2].trim()}\nstartxref\n${head.length}\n%%EOF\n`, 'latin1');
}

// PDF a náhledy vykreslí Chrome bez okna, s dočasným profilem (nesahá na profil uživatele).
async function renderFiles(files) {
  const chrome = findChrome();
  if (!chrome) { console.log('HTML předlohy jsou hotové. PDF a PNG vyžadují Chrome nebo Edge (cestu lze zadat proměnnou CHROME).'); return; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const profile = mkdtempSync(join(tmpdir(), 'poukaz-'));
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  try {
    let port;
    for (let i = 0; i < 150 && !port; i++) { await sleep(100); try { port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {} }
    if (!port) throw new Error('Chrome se nepodařilo spustit.');
    const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise((ok, fail) => { const i = ++id; pending.set(i, m => m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
    const inch = mm => mm / 25.4;
    // Velikost stránky určuje CSS (@page), jinak by Chrome obsah centroval a zmenšoval na papír.
    // Stránka je o 0,5 mm větší, aby po zaokrouhlení v Chromu nic nepřeteklo; finishPdf ji ořízne přesně od levého horního rohu.
    const print = async (width, height) => {
      await evaluate(`(() => { const style = document.getElementById('page-size') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'page-size' })); style.textContent = '@page { size: ${width + 0.5}mm ${height + 0.5}mm; margin: 0; }'; })()`);
      return Buffer.from((await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 })).data, 'base64');
    };
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 2, mobile: false });
    for (const file of files) {
      const url = pathToFileURL(file).href;
      await send('Page.navigate', { url });
      for (let i = 0; i < 100 && !(await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`)); i++) await sleep(50);
      await evaluate('document.fonts.ready.then(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))');
      writeFileSync(file.replace(/\.html$/, '.pdf'), finishPdf(await print(216, 105), { width: 216, height: 105, offset: 0 }));
      await evaluate("document.body.classList.add('marks')");
      writeFileSync(file.replace(/\.html$/, '-orezove-znacky.pdf'), finishPdf(await print(232, 121), { width: 232, height: 121, offset: 8 }));
      await evaluate("document.body.classList.remove('marks')");
      const sides = await evaluate(`[...document.querySelectorAll('.sheet')].map(el => { const r = el.getBoundingClientRect(); return { name: el.dataset.name, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })`);
      for (const side of sides) {
        const bleed = side.w * 3 / 216; // spadávka se v náhledu ořízne
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: side.x + bleed, y: side.y + bleed, width: side.w - 2 * bleed, height: side.h - 2 * bleed, scale: 1 } });
        writeFileSync(file.replace(/\.html$/, `-${side.name}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    // Řádné zavření ukončí i pomocné procesy Chromu, které by jinak držely dočasný profil.
    await Promise.race([send('Browser.close').catch(() => {}), sleep(3000)]);
    ws.close();
  } finally {
    if (proc.exitCode === null) { proc.kill(); await new Promise(r => { proc.once('exit', r); setTimeout(r, 3000); }); }
    // Úklid nesmí shodit hotové výstupy; Windows může soubory profilu ještě chvíli držet.
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); }
    catch { console.log(`Dočasný profil Chromu se nepodařilo smazat (lze smazat ručně): ${profile}`); }
  }
}

mkdirSync(out, { recursive: true });
const files = s.services.map(svc => {
  const file = resolve(out, `poukaz-${svc.minutes}.html`);
  writeFileSync(file, czechTypo(render(svc)));
  return file;
});
await renderFiles(files);
console.log(`Dárkové poukazy: ${s.services.map(x => x.minutes + ' min').join(', ')} → tisk/ (HTML, PDF pro tiskárnu, PNG náhledy).`);
