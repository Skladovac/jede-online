import { mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { site as s, faq } from './site.mjs';

const out = resolve(import.meta.dirname, '../dist');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (!s.staging && (s.phoneLink === '+420123456789' || s.businessId === '111111111' || s.businessName === 'DUKE test')) throw new Error('Před ostrým režimem doplňte skutečný telefon a firemní údaje.');
mkdirSync(out, { recursive: true });
cpSync(resolve(import.meta.dirname, '../public'), out, { recursive: true });

// Adresy souborů nesou otisk obsahu (?v=…), takže je server může nechat dlouho v mezipaměti.
const versions = new Map();
const versioned = file => {
  if (!versions.has(file)) versions.set(file, createHash('sha256').update(readFileSync(resolve(out, 'assets', file))).digest('hex').slice(0, 10));
  return `${file}?v=${versions.get(file)}`;
};

const pages = [
  ['', 'Úvod', 'Masáže Vsetín | Lucie Krampotová – 22 let praxe', 'Masáže zad a šíje ve Vsetíně. Lucie Krampotová, 22 let praxe, individuální přístup. Mostecká 361. Objednání telefonem nebo SMS.'],
  ['masaze', 'Masáže', 'Masáž zad a šíje Vsetín | Lucie Krampotová', 'Cílená 30minutová masáž zad a šíje nebo 60 minut individuální péče ve Vsetíně. Domluvte si masáž telefonicky nebo SMS.'],
  ['o-lucii', 'O Lucii', 'O Lucii Krampotové | Masáže Vsetín, 22 let praxe', 'Poznejte přístup Lucie Krampotové k masážím zad. 22 let praxe, individuální péče a odborný přesah vzdělávání v DNS.'],
  ['cenik', 'Ceník', 'Ceník masáží Vsetín | Lucie Krampotová', 'Masáže v délce 30 a 60 minut. Ceny připravujeme a upřesníme je při objednání. Mostecká 361, Vsetín.'],
  ['darkove-poukazy', 'Dárkové poukazy', 'Dárkové poukazy na masáž Vsetín | Lucie Krampotová', 'Darujte čas na odpočinek. Dárkové poukazy na 30 nebo 60 minut masáže ve Vsetíně. Objednání telefonicky nebo SMS.'],
  ['reference', 'Reference', 'Reference | Lucie Krampotová, masáže Vsetín', 'Prostor pro skutečné zkušenosti klientů Lucie Krampotové. Recenze zatím nejsou zveřejněné.'],
  ['faq', 'FAQ', 'Časté otázky k masážím | Lucie Krampotová Vsetín', 'Jak se objednat na masáž, jak vybrat délku a jak domluvit dárkový poukaz. Odpovědi na časté otázky.'],
  ['kontakt', 'Kontakt', 'Kontakt a mapa | Masáže Vsetín, Mostecká 361', 'Lucie Krampotová, masáže zad a šíje. Mostecká 361, Vsetín. Dle objednání, telefon nebo SMS 123 456 789.'],
  ['soukromi', 'Soukromí', 'Informace o webu a soukromí | Lucie Krampotová', 'Informace o testovací verzi webu, kontaktních údajích a načítání mapy.']
];

// Všechny obrázky jsou výřezy jediné ilustrační fotografie – nezobrazují skutečnou provozovnu.
const photos = {
  hero:   { file: 'wellness.webp', small: 'wellness-small.webp', w: 1280, h: 1600, alt: 'Krémové ručníky, lahvička masážního oleje a kámen v teplém světle – ilustrační zátiší' },
  towels: { file: 'crop-towels.webp', w: 600, h: 800, alt: 'Složené froté ručníky s olivovou větvičkou – ilustrační fotografie' },
  oil:    { file: 'crop-oil.webp', w: 600, h: 600, alt: 'Lahvička masážního oleje na kamenné desce – ilustrační fotografie' },
  scene:  { file: 'crop-scene.webp', w: 600, h: 800, alt: 'Lahvička masážního oleje a kamenná miska, v pozadí masážní lůžko – ilustrační fotografie' },
  stone:  { file: 'crop-stone.webp', w: 520, h: 440, alt: 'Hladký kámen na mramorové desce – ilustrační fotografie' },
  olive:  { file: 'crop-olive.webp', w: 580, h: 773, alt: 'Olivová větvička nad složenými ručníky – ilustrační fotografie' }
};

// Ikony a ornament olivové větvičky (lístky leží přesně na křivce stonku).
const sprite = `<svg class="sprite" aria-hidden="true" focusable="false"><defs>
<symbol id="i-arrow" viewBox="0 0 16 16"><path d="M4.5 11.5l7-7M6 4.5h5.5V10"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.6 3.5h2.6l1.4 4-2 1.4a11 11 0 0 0 6.5 6.5l1.4-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></symbol>
<symbol id="i-sms" viewBox="0 0 24 24"><path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z"/><path d="M8 10.8h.01M12 10.8h.01M16 10.8h.01"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/></symbol>
<symbol id="i-plus" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></symbol>
<symbol id="i-olive" viewBox="0 0 120 48"><g stroke-width="1"><path d="M4 42C34 34 70 24 116 7"/><path d="M0 0c6.5 -4.8 18.5 -4.8 25 0c-6.5 4.8 -18.5 4.8 -25 0z" transform="translate(13.2 39.5) rotate(-59.1)"/><path d="M0 0c6.5 -4.8 18.5 -4.8 25 0c-6.5 4.8 -18.5 4.8 -25 0z" transform="translate(22.8 36.9) rotate(20.5)"/><path d="M0 0c6 -4.4 17 -4.4 23 0c-6 4.4 -17 4.4 -23 0z" transform="translate(34.8 33.5) rotate(-60)"/><path d="M0 0c5.7 -4.2 16.3 -4.2 22 0c-5.7 4.2 -16.3 4.2 -22 0z" transform="translate(47.4 29.9) rotate(19.4)"/><path d="M0 0c5.2 -3.8 14.8 -3.8 20 0c-5.2 3.8 -14.8 3.8 -20 0z" transform="translate(60.7 25.8) rotate(-61.3)"/><path d="M0 0c4.7 -3.4 13.3 -3.4 18 0c-4.7 3.4 -13.3 3.4 -18 0z" transform="translate(74.8 21.3) rotate(18)"/><path d="M0 0c4.2 -3 11.8 -3 16 0c-4.2 3 -11.8 3 -16 0z" transform="translate(89.6 16.4) rotate(-62.9)"/><path d="M0 0c3.4 -2.5 9.6 -2.5 13 0c-3.4 2.5 -9.6 2.5 -13 0z" transform="translate(102.5 11.9) rotate(16.4)"/><path d="M0 0c3 -2.2 9 -2.2 12 0c-3 2.2 -9 2.2 -12 0z" transform="translate(113 8) rotate(-20.3)"/></g></symbol>
</defs></svg>`;

function render(route, label, title, description, notFound = false) {
  const base = notFound ? '/' : route ? '../' : './';
  const link = path => `${base}${path ? path + '/' : ''}`;
  const asset = file => `${base}assets/${versioned(file)}`;
  const tel = `tel:${s.phoneLink}`;
  const smsHref = (body = '') => `sms:${s.phoneLink}${body ? '?body=' + encodeURIComponent(body) : ''}`;

  const icon = (name, cls = '') => `<svg class="icon icon-${name}${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  const ornament = (cls = '') => `<svg class="ornament${cls ? ' ' + cls : ''}" viewBox="0 0 120 48" aria-hidden="true" focusable="false"><use href="#i-olive"></use></svg>`;
  const eyebrow = text => `<p class="eyebrow">${text}</p>`;
  const call = (text = 'Domluvit masáž', cls = 'button') => `<a class="${cls}" href="${tel}"><span>${text}</span>${icon('arrow')}</a>`;
  const sms = (text = 'Napsat SMS', body = '', cls = 'button secondary') => `<a class="${cls}" href="${smsHref(body)}"><span>${text}</span>${icon('arrow')}</a>`;
  const textLink = (href, text, cls = 'text-link') => `<a class="${cls}" href="${href}">${text}${icon('arrow')}</a>`;
  const reveal = (d = 0) => ` reveal" style="--d:${d}`;

  const arch = (key, cls = '', { lazy = true, caption = true, priority = false, sizes = '(max-width: 999px) 88vw, 36vw' } = {}) => {
    const p = photos[key];
    const srcset = p.small ? ` srcset="${asset(p.small)} 640w, ${asset(p.file)} ${p.w}w" sizes="${sizes}"` : '';
    const loading = lazy ? ' loading="lazy" decoding="async"' : '';
    const fetch = priority ? ' fetchpriority="high"' : '';
    return `<figure class="arch${cls ? ' ' + cls : ''}"><img src="${asset(p.file)}"${srcset} width="${p.w}" height="${p.h}" alt="${esc(p.alt)}"${loading}${fetch}>${caption ? '<figcaption>Ilustrační foto</figcaption>' : ''}</figure>`;
  };

  const pageHero = (tag, heading, copy, photo = '') => `<section class="page-hero dark"><div class="rays" aria-hidden="true"></div><div class="wrap page-hero-grid has-aside"><div class="page-hero-copy"><nav class="breadcrumb" aria-label="Drobečková navigace"><a href="${link('')}">Úvod</a><span aria-hidden="true">/</span><span aria-current="page">${label}</span></nav>${eyebrow(tag)}<h1>${heading}</h1><p class="lead">${copy}</p></div>${photo ? arch(photo, 'arch-page', { lazy: false }) : ornament('hero-ornament')}</div></section>`;

  const faqList = (items = faq) => `<div class="faq-list">${items.map(([q, a], i) => `<details><summary><span class="question-number">${String(i + 1).padStart(2, '0')}</span><span class="question-text">${q}</span><span class="plus" aria-hidden="true"></span></summary><p>${a}</p></details>`).join('')}</div>`;

  const serviceArch = (x, i, d) => `<article class="service-arch${reveal(d)}"><span class="service-index">0${i + 1}</span><p class="service-time"><span>${x.minutes}</span><em>minut</em></p><h3>${x.name}</h3><p>${x.description}</p><div class="service-price"><span>Cena</span><strong>${esc(x.price)}</strong></div><p class="service-note">Cenu upřesníme při objednání.</p>${textLink(`${link('masaze')}#masaz-${x.minutes}`, 'Více o masáži')}</article>`;

  const steps = () => `<ol class="steps"><li class="${reveal(0).trim()}"><h3>Krátce si promluvíme</h3><p>Řeknete mi, co od masáže očekáváte a čemu chcete věnovat pozornost.</p></li><li class="${reveal(1).trim()}"><h3>Přizpůsobíme péči</h3><p>Společně domluvíme partie i intenzitu. Vaše pohodlí je součástí každé masáže.</p></li><li class="${reveal(2).trim()}"><h3>Čas je jen váš</h3><p>Prostor pro klid a odpočinek. Pokud cokoli potřebujete změnit, stačí říct.</p></li></ol>`;

  const map = () => `<div class="map-panel" data-map-panel><a class="text-link" href="https://www.google.com/maps/search/?api=1&amp;query=Mosteck%C3%A1%20361%2C%20Vset%C3%ADn" target="_blank" rel="noopener noreferrer">Otevřít trasu v Mapách Google${icon('arrow')}</a><div class="map-idle">${icon('pin', 'map-pin')}<h3>Najdete mě <em>ve Vsetíně.</em></h3><p>${s.address}<br>${s.city}</p><button class="button secondary" type="button" data-load-map><span>Zobrazit mapu</span>${icon('plus')}</button><p class="small">Kliknutím se načte mapa od Google.</p></div></div>`;

  const cta = () => `<section class="cta dark dome"><div class="rays" aria-hidden="true"></div><div class="wrap cta-inner">${ornament('ornament-light')}${eyebrow('Váš čas začíná domluvou')}<h2>Dopřejte zádům <em>chvíli pozornosti.</em></h2><p>Vybereme společně termín i délku masáže.</p><div class="actions">${call('Zavolat Lucii')}${sms()}</div><p class="small">${s.phone} · Návštěvy dle objednání</p></div></section>`;

  const seal = `<div class="seal" aria-hidden="true"><svg viewBox="0 0 200 200"><defs><path id="seal-ring" d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0"/></defs><circle class="seal-bg" cx="100" cy="100" r="99"/><circle class="seal-line" cx="100" cy="100" r="91"/><g class="seal-spin"><text class="seal-text"><textPath href="#seal-ring" textLength="452" lengthAdjust="spacing">MASÁŽE ZAD A ŠÍJE · ${s.city.toUpperCase()} · ${s.years} LET PRAXE ·</textPath></text></g><text class="seal-mono" x="100" y="114" text-anchor="middle">LK</text></svg></div>`;

  let body = '';
  if (notFound) body = pageHero('404 · Stránka nenalezena', 'Tady si dáme <em>malou pauzu.</em>', 'Tato stránka tu není. Vše o masážích a objednání najdete na úvodní stránce.') + `<section class="section section-tight"><div class="wrap"><a class="button button-dark" href="${link('')}">Zpět na úvod ${icon('arrow')}</a></div></section>`;

  else if (!route) body = `
<section class="hero dark"><div class="rays" aria-hidden="true"></div><div class="wrap hero-grid"><div class="hero-copy">${eyebrow('Masáže zad a šíje · Vsetín')}<h1>Čas pro vás. <em>Péče pro vaše záda.</em></h1><p class="lead">Odložte na chvíli každodenní shon. Dopřejte si masáž s osobním přístupem a ${s.years} lety zkušeností.</p><div class="actions">${call('Domluvit si masáž')}${textLink(link('masaze'), 'Prohlédnout masáže', 'text-link text-link-light')}</div></div><div class="hero-visual">${arch('hero', 'arch-hero', { lazy: false, priority: true, sizes: '(max-width: 999px) 88vw, 520px' })}${seal}<a class="hero-card" href="${tel}"><span class="hero-card-label">Objednání</span><span class="hero-card-phone">${s.phone}</span><span class="hero-card-note">Telefonem nebo SMS · dle objednání</span></a></div></div></section>
<section class="band" aria-label="V kostce"><ul class="wrap band-list"><li class="${reveal(0).trim()}"><strong>${s.years}</strong><span>let praxe</span></li><li class="${reveal(1).trim()}"><strong>30 / 60</strong><span>minut péče</span></li><li class="${reveal(2).trim()}"><strong>DNS</strong><span>odborný přesah</span></li><li class="${reveal(3).trim()}"><strong><em>Vy</em></strong><span>na prvním místě</span></li></ul></section>
<section class="intro"><div class="wrap intro-inner${reveal(0)}">${ornament()}${eyebrow('Můj přístup')}<p class="statement">Za každou masáží je člověk. <em>A pro mě je důležité věnovat se právě tomu, co potřebujete vy.</em></p><p class="signature">Lucie Krampotová</p></div></section>
<section class="section services" id="masaze"><div class="wrap"><div class="section-head${reveal(0)}"><div>${eyebrow('Péče přesně pro vás')}<h2>Vaše záda. <em>V dobrých rukou.</em></h2></div><p>Po dni u počítače, fyzické práci i sportu. Vyberte si čas, který dnes potřebujete. Vše ostatní si domluvíme společně.</p></div><div class="triptych">${serviceArch(s.services[0], 0, 0)}${arch('oil', 'arch-middle reveal" style="--d:1')}${serviceArch(s.services[1], 1, 2)}</div><div class="services-foot"><p>Délku i intenzitu přizpůsobíme vám.</p>${textLink(link('cenik'), 'Kompletní ceník')}</div></div></section>
<section class="section process light"><div class="wrap"><div class="section-head${reveal(0)}"><div>${eyebrow('Průběh návštěvy')}<h2>Od domluvy <em>k odpočinku.</em></h2></div><p>Každá návštěva začíná krátkým rozhovorem. Masáž pak přizpůsobíme tomu, co vaše záda potřebují.</p></div>${steps()}</div></section>
<section class="section about dark dome"><div class="rays" aria-hidden="true"></div><div class="wrap about-grid"><div class="about-visual${reveal(0)}">${arch('scene', 'arch-about')}<p class="about-years" aria-hidden="true"><span>${s.years}</span><em>let praxe</em></p></div><div class="about-copy${reveal(1)}">${eyebrow('Lucie Krampotová')}<h2>Osobně. Pozorně. <em>S respektem k vám.</em></h2><p class="lead">Protože každá záda mají svůj příběh.</p><p>Masážím se věnuji už ${s.years} let. Mou praxi doplňuje vzdělávání v DNS, ale základem každé návštěvy zůstává domluva a péče přizpůsobená vašemu tělu.</p>${textLink(link('o-lucii'), 'Poznejte můj přístup', 'text-link text-link-light')}</div></div></section>
<section class="section gift"><div class="wrap gift-grid"><div class="gift-copy${reveal(0)}">${eyebrow('Dárkové poukazy')}<h2>Ten nejhezčí dárek? <em>Chvíle jen pro sebe.</em></h2><p>Darujte někomu blízkému 30 nebo 60 minut odpočinku a individuální péče. Poukaz domluvíme telefonicky nebo SMS.</p><div class="actions"><a class="button button-dark" href="${link('darkove-poukazy')}"><span>Darovat masáž</span>${icon('arrow')}</a>${sms('Poptat SMS', 'Dobrý den, mám zájem o dárkový poukaz na masáž. Prosím o informace.', 'button button-outline')}</div></div>${arch('olive', 'arch-gift reveal" style="--d:1')}</div></section>
<section class="honest"><div class="wrap honest-inner${reveal(0)}">${ornament()}${eyebrow('Skutečné zkušenosti')}<h2>Vaše slova <em>mají své místo.</em></h2><p>Zatím zde nejsou zveřejněné žádné recenze. Patřit sem budou pouze skutečná hodnocení klientů.</p>${textLink(link('reference'), 'Reference')}</div></section>
<section class="section faq"><div class="wrap faq-grid"><div class="faq-head${reveal(0)}">${eyebrow('Časté otázky')}<h2>Ať přicházíte <em>v klidu.</em></h2>${textLink(link('faq'), 'Všechny otázky')}</div><div class="${reveal(1).trim()}">${faqList(faq.slice(0, 4))}</div></div></section>
<section class="section contact dark dome"><div class="rays" aria-hidden="true"></div><div class="wrap contact-grid"><div class="contact-copy${reveal(0)}">${eyebrow('Kontakt')}<h2>Vaše zastavení <em>ve Vsetíně.</em></h2><p class="lead">${s.address}, ${s.city}</p><p>Návštěvy dle objednání. Termín domluvíme telefonem nebo SMS.</p><a class="phone-link" href="${tel}">${s.phone}</a><div class="actions">${call('Zavolat')}${sms()}</div></div><div class="${reveal(1).trim()}">${map()}</div></div></section>`;

  else if (route === 'masaze') body = pageHero('Masáže zad a šíje · Vsetín', 'Péče podle toho, <em>co potřebujete.</em>', 'Každý den dává vašim zádům zabrat jinak. Délku, zaměření i intenzitu masáže si společně domluvíme.', 'stone') + `<section class="section"><div class="wrap">${s.services.map((x, i) => `<article id="masaz-${x.minutes}" class="split${i ? ' split-reverse' : ''}">${arch(i ? 'towels' : 'oil', 'arch-split reveal')}<div class="split-copy${reveal(1)}">${eyebrow('0' + (i + 1) + ' · ' + x.minutes + ' minut')}<h2>${x.name}</h2><p class="lead">${x.description}</p><p>${i ? 'Delší návštěva dává prostor věnovat se jednotlivým partiím postupně a bez spěchu. Konkrétní rozsah si určíme po úvodní domluvě.' : 'Kratší návštěva soustředěná na oblast zad a šíje. Zaměření domluvíme podle toho, které partie si zaslouží nejvíce pozornosti.'}</p><div class="detail-price"><span>Cena</span><strong>${esc(x.price)}</strong><span>${x.minutes} minut</span></div><div class="actions">${call('Domluvit ' + x.minutes + ' minut', 'button button-dark')}</div></div></article>`).join('')}</div></section><section class="section process light"><div class="wrap"><div class="section-head${reveal(0)}"><div>${eyebrow('Průběh návštěvy')}<h2>Od domluvy <em>k odpočinku.</em></h2></div></div>${steps()}</div></section>${cta()}`;

  else if (route === 'o-lucii') body = pageHero('O Lucii', 'Zkušenost v rukou. <em>Pozornost k člověku.</em>', `Jsem Lucie Krampotová. Už ${s.years} let se věnuji masážím a péči o namáhaná záda.`, 'towels') + `<section class="section"><div class="wrap editorial"><div class="${reveal(0).trim()}">${ornament('ornament-left')}<h2>Každý člověk přichází <em>s jiným dnem.</em></h2></div><div class="editorial-copy${reveal(1)}"><p class="lead">Někdo celý den seděl. Jiný pracoval rukama, sportoval nebo si zkrátka potřebuje dopřát chvíli klidu.</p><p>Proto je pro mě důležitá osobní domluva. Zajímá mě, kterým partiím chcete věnovat pozornost a jaká intenzita je vám příjemná. Masáž přizpůsobuji vám.</p><p>Najdete mě na Mostecké 361 ve Vsetíně. Návštěvy probíhají dle předchozího objednání, abych na vás měla vyhrazený čas.</p></div></div></section><section class="section section-flush"><div class="wrap"><div class="note-box${reveal(0)}"><div>${eyebrow('Odborný přesah')}<h2>Praxe a vzdělávání <em>patří k sobě.</em></h2></div><div><p class="lead">Součástí mého vzdělávání je také DNS – dynamická neuromuskulární stabilizace.</p><p>Tento odborný přesah doplňuje mou masérskou praxi. Nabízenou službou je masáž; nejedná se o fyzioterapii ani lékařskou péči.</p><p class="muted">Přesné názvy absolvovaných kurzů a podklady ke vzdělání zde doplníme po jejich ověření.</p></div></div></div></section>${cta()}`;

  else if (route === 'cenik') body = pageHero('Ceník', 'Vyberte si <em>svůj čas.</em>', 'Dvě délky návštěvy, stejná osobní pozornost. Ceny právě připravujeme a upřesníme je před potvrzením vašeho termínu.') + `<section class="section"><div class="wrap"><div class="menu-card${reveal(0)}">${ornament()}${eyebrow('Masáže · Vsetín')}<h2>Nabídka <em>masáží</em></h2><ul class="menu-list">${s.services.map(x => `<li><div class="menu-row"><span class="menu-time">${x.minutes} min</span><h3>${x.name}</h3><span class="menu-dots" aria-hidden="true"></span><strong class="menu-price">${esc(x.price)}</strong></div><p>${x.description}</p></li>`).join('')}</ul><p class="menu-note">Cenu i podrobnosti domluvíme při objednání. Způsob platby vám potvrdíme před návštěvou.</p></div></div></section>${cta()}`;

  else if (route === 'darkove-poukazy') body = pageHero('Dárkové poukazy', 'Malé gesto. <em>Velký prostor pro sebe.</em>', 'Darujte masáž někomu, kdo si zaslouží na chvíli vypnout. Osobní dárek pro ženy i muže.', 'olive') + `<section class="section"><div class="wrap editorial"><div class="${reveal(0).trim()}">${ornament('ornament-left')}<h2>30 nebo 60 minut. <em>Radost podle vás.</em></h2><p>Poukaz lze domluvit na kratší masáž zad a šíje i na delší individuální péči.</p></div><div class="gift-options${reveal(1)}"><h3>Jak poukaz objednat</h3><ol><li>Zavolejte nebo napište SMS s požadovanou délkou masáže.</li><li>Domluvíme cenu, podobu, způsob předání a platnost poukazu.</li><li>Obdarovaný si následně objedná svůj termín telefonem nebo SMS.</li></ol><div class="actions">${call('Domluvit poukaz', 'button button-dark')}${sms('Poptat poukaz SMS', 'Dobrý den, mám zájem o dárkový poukaz na masáž. Prosím o informace.', 'button button-outline')}</div><p class="small">Cena a podmínky budou potvrzeny před objednáním.</p></div></div></section>${cta()}`;

  else if (route === 'reference') body = pageHero('Reference', 'Důvěra vyrůstá <em>ze skutečné zkušenosti.</em>', 'Místo pro hodnocení lidí, kteří masáž osobně zažili.') + `<section class="section"><div class="wrap"><div class="empty-reviews${reveal(0)}">${ornament()}<h2>Každá zkušenost <em>má svůj příběh.</em></h2><p>Zatím zde nejsou zveřejněné žádné recenze.</p><p>Až budou k dispozici skutečná hodnocení a souhlas s jejich zveřejněním, najdete je zde. Do té doby se můžete seznámit s mým přístupem k masážím.</p>${textLink(link('o-lucii'), 'Více o Lucii')}</div></div></section>${cta()}`;

  else if (route === 'faq') body = pageHero('Časté otázky', 'Dobré vědět. <em>Ještě než přijdete.</em>', 'Od první objednávky po dárkový poukaz. Tady najdete odpovědi na to nejdůležitější.') + `<section class="section"><div class="wrap narrow${reveal(0)}">${faqList()}</div></section>${cta()}`;

  else if (route === 'kontakt') body = pageHero('Kontakt · Vsetín', 'Ozvěte se. <em>Najdeme váš termín.</em>', 'Objednání je osobní a jednoduché. Stačí zavolat nebo poslat SMS.') + `<section class="section light"><div class="wrap contact-grid"><div class="contact-copy${reveal(0)}"><h2>Lucie Krampotová</h2><p class="lead">Masáže zad a šíje</p><a class="phone-link" href="${tel}">${s.phone}</a><div class="actions">${call('Zavolat', 'button button-dark')}${sms('Napsat SMS', '', 'button button-outline')}</div><dl class="contact-details"><div><dt>Adresa</dt><dd>${s.address}, ${s.city}</dd></div><div><dt>Návštěvy</dt><dd>Dle předchozího objednání</dd></div></dl><p>Do SMS napište své jméno, požadovanou délku masáže a termín, který vám vyhovuje. Vyčkejte prosím na potvrzení.</p></div><div class="${reveal(1).trim()}">${map()}</div></div></section><section class="section section-flush"><div class="wrap"><div class="business-details${reveal(0)}">${eyebrow('Údaje provozovatele')}<h2>${s.businessName}</h2><p>IČO: ${s.businessId}</p><p class="muted">Dočasné testovací údaje. Skutečné údaje provozovatele a kontaktní telefon doplníme před ostrým spuštěním.</p></div></div></section>`;

  else body = pageHero('Informace o webu', 'Soukromí <em>a testovací provoz.</em>', 'Přehled toho, jak je tato verze webu připravena.') + `<section class="section"><div class="wrap narrow prose"><h2>Testovací údaje</h2><p>Tento web je testovací prezentací na lucie.jede.online. Telefon ${s.phone}, název ${s.businessName} a IČO ${s.businessId} jsou dočasné údaje, které musí být před ostrým spuštěním nahrazeny.</p><h2>Bez formuláře a analytiky</h2><p>Web nemá objednávkový formulář, nenastavuje analytické ani reklamní cookies a nepoužívá měřicí nástroje. Telefonní a SMS odkazy otevírají odpovídající aplikaci ve vašem zařízení.</p><h2>Externí mapa</h2><p>Mapa Google se načítá pouze po kliknutí na „Zobrazit mapu“. Při načtení se prohlížeč spojí se službou Google, která získá běžné technické údaje o připojení, například IP adresu. Alternativně můžete otevřít adresu přímo v Mapách Google.</p><h2>Objednávky a hosting</h2><p>Při skutečných objednávkách bude provozovatel zpracovávat údaje nezbytné pro domluvu návštěvy. Úplné informace o správci, zpracování objednávek a případných serverových záznamech doplníme podle skutečného provozovatele a zvoleného hostingu před ostrým spuštěním.</p><h2>Fotografie</h2><p>Všechny fotografie na webu jsou výřezy jedné vytvořené ilustrační fotografie. Nezobrazují skutečnou provozovnu.</p></div></section>`;

  const canonical = `${s.origin}/${route && !notFound ? route + '/' : ''}`;
  const schema = {'@context':'https://schema.org','@graph':[
    {'@type':'LocalBusiness','@id':s.origin+'/#business',name:s.name,description:'Masáže zad a šíje ve Vsetíně. 22 let praxe.',url:s.origin+'/',telephone:s.phoneLink,address:{'@type':'PostalAddress',streetAddress:s.address,addressLocality:s.city,addressCountry:'CZ'},areaServed:{'@type':'City',name:s.city},image:s.origin+'/assets/wellness.webp'},
    {'@type':'WebSite','@id':s.origin+'/#website',url:s.origin+'/',name:'Lucie Krampotová – Masáže Vsetín',inLanguage:'cs'},
    ...(route && !notFound ? [{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Úvod',item:s.origin+'/'},{'@type':'ListItem',position:2,name:label,item:canonical}]}] : [])
  ]};

  const navLinks = pages.slice(1, 8).map(([path, name]) => `<a class="nav-link" href="${link(path)}"${route === path && !notFound ? ' aria-current="page"' : ''}>${name}</a>`).join('');
  const pageClass = notFound ? 'page-404' : `page-${route || 'home'}`;

  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${s.staging || notFound ? 'noindex, follow' : 'index, follow'}"><meta name="theme-color" content="#064E3B"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:locale" content="cs_CZ"><meta property="og:site_name" content="Lucie Krampotová · Masáže Vsetín"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${s.origin}/assets/social.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Ilustrační masážní zátiší v přírodních tónech"><meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/svg+xml" href="${asset('favicon.svg')}"><link rel="preload" href="${asset('fonts/editorial.woff2')}" as="font" type="font/woff2" crossorigin><link rel="preload" href="${asset('fonts/editorial-italic.woff2')}" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="${asset('style.css')}"><script src="${asset('app.js')}" defer></script><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script></head><body class="${pageClass}">
${sprite}
<a class="skip-link" href="#obsah">Přeskočit na obsah</a>${s.staging ? '<div class="test-banner">Testovací verze <span>· Telefon a firemní údaje jsou dočasné.</span></div>' : ''}
<header class="site-header"><div class="wrap masthead"><p class="masthead-note">${s.address} · ${s.city}</p><a class="brand" href="${link('')}" aria-label="Lucie Krampotová – úvod"><span class="brand-name">Lucie Krampotová</span><span class="brand-sub">Masáže · ${s.city}</span></a><div class="masthead-actions"><a class="button button-small" href="${tel}"><span>Objednat se</span>${icon('phone')}</a><button class="menu-toggle" type="button" aria-controls="navigation" aria-expanded="false"><span class="when-closed">Menu</span><span class="when-open">Zavřít</span><span class="menu-lines" aria-hidden="true"></span></button></div></div><nav id="navigation" class="site-nav" aria-label="Hlavní navigace"><div class="wrap nav-inner">${navLinks}<div class="nav-contact"><a href="${tel}">${icon('phone')}${s.phone}</a><a href="${smsHref()}">${icon('sms')}Napsat SMS</a><p>${s.address}, ${s.city}</p></div></div></nav></header>
<main id="obsah" tabindex="-1">${body}</main>
<footer class="site-footer"><div class="wrap"><p class="footer-mark">Lucie <em>Krampotová</em></p><p class="footer-tag">Masáže zad a šíje · ${s.city}</p><div class="footer-cols"><div><p class="eyebrow">Kontakt</p><a class="footer-phone" href="${tel}">${s.phone}</a><a href="${smsHref()}">Napsat SMS</a><p>${s.address}, ${s.city}</p></div><nav aria-label="Stránky webu"><p class="eyebrow">Stránky</p><div class="footer-links">${pages.slice(1, 8).map(([path, name]) => `<a href="${link(path)}">${name}</a>`).join('')}</div></nav><div><p class="eyebrow">Návštěvy</p><p>${s.years} let zkušeností.<br>Čas věnovaný vašim zádům.</p><p>Dle objednání telefonem nebo SMS.</p></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Lucie Krampotová</span><span>${s.businessName} · IČO ${s.businessId}${s.staging ? ' · testovací údaje' : ''}</span><a href="${link('soukromi')}">Soukromí a informace o webu</a></div></div></footer>
<div class="mobile-booking" aria-label="Rychlé objednání"><a href="${tel}">${icon('phone')}Zavolat</a><a href="${smsHref()}">${icon('sms')}Napsat SMS</a></div></body></html>`;
}

// Česká sazba: jednopísmenné předložky a spojky nezůstávají na konci řádku, čísla se nelámou.
// Upravuje jen text mezi značkami; skripty, styly a atributy zůstávají beze změny.
function czechTypo(html) {
  const nbsp = '\u00a0';
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/g).map(part => part.startsWith('<') ? part : part
    .replace(/(?<=^|[\s(„])([kKsSvVzZoOuUaAiI]) (?=\S)/g, `$1${nbsp}`)
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${nbsp}`)
    .replace(/(\d) (?=[\p{L}/])/gu, `$1${nbsp}`)
  ).join('');
}

// Zmenšení CSS pro produkci. Řetězce v uvozovkách (data URI, content) zůstávají beze změny.
function minifyCss(css) {
  const strings = [];
  let text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, m => `\u0000${strings.push(m) - 1}\u0000`);
  text = text.replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/\{([^{}]*)\}/g, (m, decl) => `{${decl.replace(/\s*:\s*/g, ':').replace(/;$/, '')}}`).trim();
  return text.replace(/\u0000(\d+)\u0000/g, (m, i) => strings[Number(i)]);
}

const cssFile = resolve(out, 'assets/style.css');
writeFileSync(cssFile, minifyCss(readFileSync(cssFile, 'utf8')).replace(/url\('fonts\/([^')]+)'\)/g, (m, font) => `url('${versioned('fonts/' + font)}')`));

for (const page of pages) { const directory = resolve(out, page[0]); mkdirSync(directory, { recursive: true }); writeFileSync(resolve(directory, 'index.html'), czechTypo(render(...page))); }
writeFileSync(resolve(out, '404.html'), czechTypo(render('', 'Nenalezeno', 'Stránka nenalezena | Lucie Krampotová', 'Tato stránka nebyla nalezena.', true)));
writeFileSync(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter(p => p[0] !== 'soukromi').map(p => `<url><loc>${s.origin}/${p[0] ? p[0] + '/' : ''}</loc></url>`).join('')}</urlset>\n`);
writeFileSync(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${s.origin}/sitemap.xml\n`);
writeFileSync(resolve(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n${s.staging ? '  X-Robots-Tag: noindex, follow\n' : ''}`);
console.log('Built 9 pages, 404, sitemap, robots and headers. Staging:', s.staging);
