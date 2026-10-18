// Renders presentation.html (2 pages, 16:9) to submission/bad-omen-presentation.pdf and preview PNGs, in headless Edge.
// Usage: node submission/presentation/build_presentation.mjs [--link https://you.itch.io/bad-omen]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(DIR, '..', 'bad-omen-presentation.pdf');
const i = process.argv.indexOf('--link');
const link = i >= 0 ? process.argv[i + 1] : '';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(path.join(DIR, 'presentation.html')).href);
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((im) => im.decode().catch(() => {}))); });
await page.evaluate((l) => {
  if (!l) return;
  const el = document.getElementById('play');
  el.innerHTML = '<b>Play it in the browser on itch.io:</b> ';
  el.append(Object.assign(document.createElement('span'), { textContent: l }));
}, link);
// overflow check: nothing may run past its page
const overflow = await page.evaluate(() => [...document.querySelectorAll('.page')].flatMap((pg, n) => {
  const r = pg.getBoundingClientRect();
  return [...pg.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.bottom > r.bottom + 0.5 || b.right > r.right + 0.5); })
    .map((e) => `page ${n + 1}: ${e.tagName.toLowerCase()}.${e.className} "${(e.textContent || '').trim().slice(0, 40)}"`);
}));
const missing = await page.evaluate(() => [...document.images].filter((im) => !im.naturalWidth).map((im) => im.src));
fs.mkdirSync(path.join(DIR, 'preview'), { recursive: true });
const pages = await page.locator('section.page').count();
for (let n = 0; n < pages; n++) await page.locator('section.page').nth(n).screenshot({ path: path.join(DIR, 'preview', `page-${n + 1}.png`) });
await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`${OUT}  ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB, ${pages} pages; link: ${link || '(none)'}`);
console.log(overflow.length ? `OVERFLOW:\n  ${overflow.join('\n  ')}` : 'no overflow');
console.log(missing.length ? `MISSING IMAGES: ${missing.join(', ')}` : 'all images loaded');
