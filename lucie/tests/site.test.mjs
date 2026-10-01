import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { site } from '../src/site.mjs';
const root = resolve(import.meta.dirname, '../dist');
const paths = ['', 'masaze', 'o-lucii', 'cenik', 'darkove-poukazy', 'reference', 'faq', 'kontakt', 'soukromi'];
test('All pages provide Czech content, contact actions and test-site SEO', () => {
  for (const path of paths) {
    const file = resolve(root, path, 'index.html');
    assert.ok(existsSync(file), `Missing page: ${path || '/'}`);
    const html = readFileSync(file, 'utf8');
    assert.match(html, /<html lang="cs">/);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
    assert.match(html, /name="robots" content="noindex, follow"/);
    assert.ok(html.includes(`tel:${site.phoneLink}`), `${path || '/'}: chybí odkaz na telefon`);
    assert.ok(html.includes(`sms:${site.phoneLink}`), `${path || '/'}: chybí odkaz na SMS`);
    assert.doesNotMatch(html, /aggregateRating|reviewCount|priceCurrency/);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(json);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(?:https?:|tel:|sms:|data:)/.test(url)) continue;
      let target = resolve(dirname(file), url.split('#')[0].split('?')[0]);
      if (url.endsWith('/')) target = resolve(target, 'index.html');
      assert.ok(existsSync(target), `${path}: missing ${url}`);
    }
  }
});
test('Prices stay unpriced and references remain honest', () => {
  const pricing = readFileSync(resolve(root, 'cenik/index.html'), 'utf8');
  assert.equal((pricing.match(/DOPLNÍME/g) || []).length, 2);
  const reviews = readFileSync(resolve(root, 'reference/index.html'), 'utf8');
  assert.match(reviews, /Zatím zde nejsou zveřejněné žádné recenze/);
});
test('SEO files and map privacy are ready', () => {
  assert.match(readFileSync(resolve(root, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/lucie.jede.online\/sitemap.xml/);
  assert.match(readFileSync(resolve(root, 'sitemap.xml'), 'utf8'), /https:\/\/lucie.jede.online\/masaze\//);
  const contact = readFileSync(resolve(root, 'kontakt/index.html'), 'utf8');
  assert.doesNotMatch(contact, /<iframe/);
  assert.match(contact, /data-load-map/);
});
test('Nested 404 pages can recover to the root and load their stylesheet', () => {
  const html=readFileSync(resolve(root,'404.html'),'utf8');
  assert.match(html,/href="\/assets\/style\.css(?:\?v=[0-9a-f]+)?"/);
  assert.match(html,/href="\/">Zpět na úvod/);
});
test('Dark map panels keep readable light button text even inside light sections', () => {
  const css=readFileSync(resolve(root,'assets/style.css'),'utf8');
  assert.match(css,/\.light \.map-panel \.button\.secondary\{[^}]*color:var\(--cream\)/);
});
