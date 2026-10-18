// Run a JS snippet inside the running game (Edge via Playwright) and print the result. Dev tool.
// Usage: node scripts/debug_eval.mjs <file-with-async-body.js> [baseUrl] [--shot] [--size 1280x720] [--query extra=params]
// The snippet body gets `g` (the game), `V` (THREE.Vector3), `sleep(ms)`, `waitG(gameSeconds)` and
// `shot(name)` (saves test-results/debug_<name>.png).
import { chromium } from 'playwright';
import fs from 'node:fs';
const body = fs.readFileSync(process.argv[2], 'utf8');
const base = process.argv.slice(3).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/';
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const [w, h] = (arg('--size') ?? '1280x720').split('x').map(Number);
const extra = arg('--query');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
fs.mkdirSync('test-results', { recursive: true });
await page.exposeFunction('__shot', async (name) => { await page.screenshot({ path: `test-results/debug_${name}.png` }); return true; });
await page.goto(base + '?debug&autostart&skipintro' + (extra ? '&' + extra : ''));
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
const fn = new Function(`return (async () => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const V = g.cat.position.constructor;
  const waitG = async (s) => { const t0 = g.time; while (g.time - t0 < s) await sleep(15); };
  const shot = (name) => window.__shot(name);
  ${body}
})()`);
const res = await page.evaluate(fn);
console.log(JSON.stringify(res, null, 1));
if (process.argv.includes('--shot')) await page.screenshot({ path: 'test-results/debug.png' });
if (errors.length) console.log('ERRORS', errors.slice(0, 5));
await browser.close();
