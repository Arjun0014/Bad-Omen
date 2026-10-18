// Screenshot the main menu at several window sizes (layout check). Dev tool.
// Usage: node scripts/menu_shots.mjs [baseUrl] [--out prefix]
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/';
const i = process.argv.indexOf('--out');
const prefix = i >= 0 ? process.argv[i + 1] : 'menu';
const sizes = [[1920, 1080], [1280, 720], [960, 540]];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
fs.mkdirSync('test-results', { recursive: true });
const errors = [];
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const box = await page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] : null; };
    const btns = [...document.querySelectorAll('#menu button.bo')].map((b) => b.getBoundingClientRect());
    return { logo: r('#menu .logo'), sub: r('#menu .sub'), eyes: r('#menu .eyes'), lastBtn: btns.length ? Math.round(btns[btns.length - 1].bottom) : null, foot: r('#menuFoot'), vh: innerHeight };
  });
  console.log(`${w}x${h}`, JSON.stringify(box));
  await page.screenshot({ path: `test-results/${prefix}_${w}x${h}.png` });
  await page.close();
}
if (errors.length) console.log('ERRORS', errors.slice(0, 5));
await browser.close();
