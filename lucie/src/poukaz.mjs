// Dárkový poukaz – tisková předloha ve formátu DL (210 × 99 mm) se spadávkou 3 mm.
// Údaje bere ze src/site.mjs: po doplnění skutečného telefonu a provozovatele stačí spustit znovu.
// Výstup do tisk/: poukaz-<minuty>.html (předloha), .pdf (pro tiskárnu, přední + zadní strana)
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

const css = `
@font-face { font-family: Editorial; src: url('${assets}fonts/editorial.woff2') format('woff2'); font-style: normal; font-weight: 300 700; }
@font-face { font-family: Editorial; src: url('${assets}fonts/editorial-italic.woff2') format('woff2'); font-style: italic; font-weight: 300 700; }
@font-face { font-family: Manrope; src: url('${assets}fonts/text.woff2') format('woff2'); font-style: normal; font-weight: 200 800; }
@page { size: 216mm 105mm; margin: 0; }
:root { --emerald: #064E3B; --emerald-deep: #043628; --champagne: #F8E7C9; --champagne-light: #FCF4E6; --gold: #C9B083; --gold-soft: #E6CFA2; --bronze: #76602F; --ink-soft: #2F5E4E; --on-dark-soft: #C3C5AA; --serif: Editorial, "Cormorant Garamond", Georgia, serif; --sans: Manrope, "Segoe UI", sans-serif; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: var(--sans); color: var(--emerald); -webkit-font-smoothing: antialiased; }
h1, h2 { font-family: var(--serif); font-weight: 400; }
svg { display: block; overflow: visible; }
.sheet { position: relative; width: 216mm; height: 105mm; overflow: hidden; break-after: page; }
.sheet:last-child { break-after: auto; }
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
  const testNote = s.staging ? ' Testovací údaje – před tiskem doplníme skutečné.' : '';
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><title>Dárkový poukaz – ${esc(svc.name)}, ${svc.minutes} minut | ${esc(s.name)}</title><style>${css}</style></head><body>
<section class="sheet front" data-name="predni"><div class="light"></div><figure class="arch"><img src="${assets}wellness.webp" alt=""></figure><div class="seal">${seal}</div><div class="trim front-copy"><p class="brand"><span class="brand-name">${esc(s.name)}</span><span class="brand-sub">Masáže · ${esc(s.city)}</span></p><h1>Dárkový <em>poukaz</em></h1><div class="service"><p class="service-time"><span>${svc.minutes}</span><em>minut</em></p><p class="service-name">${esc(svc.name)}</p></div></div></section>
<section class="sheet back" data-name="zadni"><div class="trim back-copy"><p class="eyebrow">Dárkový poukaz</p><h2>Chvíle <em>jen pro sebe.</em></h2><p class="back-service">${esc(svc.name)} · ${svc.minutes} minut</p><div class="fields"><span class="label">Pro</span><span class="line wide"></span><span class="label">Od</span><span class="line wide"></span><span class="label">Číslo poukazu</span><span class="line"></span><span class="label second">Platnost do</span><span class="line"></span><span class="label">Vystaveno dne</span><span class="line"></span><span class="label second">Podpis / razítko</span><span class="line"></span></div><p class="fine">Poukaz na ${esc(lower)} v délce ${svc.minutes} minut. ${esc(s.name)} · ${esc(s.address)}, ${esc(s.city)} · provozovatel ${esc(s.businessName)}, IČO ${esc(s.businessId)}.${testNote}</p></div><div class="info">${sprig}<p class="eyebrow">Jak poukaz uplatnit</p><p class="info-text">Termín si domluvte telefonem nebo SMS.<br>Při objednání uveďte číslo poukazu.</p><p class="phone">${esc(s.phone)}</p><p class="address">${esc(s.address)}, ${esc(s.city)}</p></div></section>
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
    await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 2, mobile: false });
    for (const file of files) {
      const url = pathToFileURL(file).href;
      await send('Page.navigate', { url });
      for (let i = 0; i < 100 && !(await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`)); i++) await sleep(50);
      await evaluate('document.fonts.ready.then(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))');
      const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
      writeFileSync(file.replace(/\.html$/, '.pdf'), Buffer.from(pdf.data, 'base64'));
      const sides = await evaluate(`[...document.querySelectorAll('.sheet')].map(el => { const r = el.getBoundingClientRect(); return { name: el.dataset.name, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })`);
      for (const side of sides) {
        const bleed = side.w * 3 / 216; // spadávka se v náhledu ořízne
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: side.x + bleed, y: side.y + bleed, width: side.w - 2 * bleed, height: side.h - 2 * bleed, scale: 1 } });
        writeFileSync(file.replace(/\.html$/, `-${side.name}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    ws.close();
  } finally {
    proc.kill();
    if (proc.exitCode === null) await new Promise(r => { proc.once('exit', r); setTimeout(r, 3000); });
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

mkdirSync(out, { recursive: true });
const files = s.services.map(svc => {
  const file = resolve(out, `poukaz-${svc.minutes}.html`);
  writeFileSync(file, czechTypo(render(svc)));
  return file;
});
await renderFiles(files);
console.log(`Dárkové poukazy: ${s.services.map(x => x.minutes + ' min').join(', ')} → tisk/ (HTML, PDF pro tiskárnu, PNG náhledy). Testovací údaje: ${s.staging}`);
