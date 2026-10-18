// Playtest 4: Grandma's first intro line was silent on a first run (the voices were decoded only after the Play
// click).  A fresh page, Play clicked the moment the menu shows (optionally on a throttled connection): the intro's
// first lines must play from decoded voice buffers.  Silent (--mute-audio).
// Usage: node scripts/first_line_test.mjs [baseUrl] [--slow]   (--slow: ~6 Mbps, 40 ms latency)
import { chromium } from 'playwright';

const base = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/';
const slow = process.argv.includes('--slow');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
if (slow) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 750 * 1024, uploadThroughput: 250 * 1024 });
}
const t0 = Date.now();
await page.goto(base);
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 180000, polling: 20 });
const menuAt = Date.now() - t0;
const atClick = await page.evaluate(() => {
  const g = window.__game, a = g.audio;
  window.__voiceLog = [];
  const voice = a.voice.bind(a);
  a.voice = (id, o) => { const d = voice(id, o); window.__voiceLog.push({ id, dur: +d.toFixed(2), t: +(performance.now() / 1000).toFixed(2) }); return d; };
  window.__clickT = performance.now() / 1000;
  return { loaded: !!a.loaded, decoded: Object.keys(a.buffers).length };
});
await page.click('#menu button[data-act="play"]');
await page.waitForFunction(() => window.__voiceLog.some((v) => v.id === 'K_INTRO_01'), null, { timeout: 30000 }).catch(() => {});
const r = await page.evaluate(() => ({ log: window.__voiceLog, clickT: window.__clickT, state: window.__game.state, stage: window.__game.director.stage }));
await browser.close();
const first = r.log.find((v) => v.id === 'G_INTRO_01');
const ok = ['G_INTRO_01', 'G_INTRO_02', 'K_INTRO_01'].every((id) => r.log.some((v) => v.id === id && v.dur > 0));
console.log(JSON.stringify({ slow, menuAt, atClick, firstLine: first ? { dur: first.dur, after: +(first.t - r.clickT).toFixed(2) } : null, log: r.log.map((v) => `${v.id}:${v.dur}`), errors: errors.slice(0, 3) }));
console.log(ok ? 'PASS first intro lines voiced' : 'FAIL first intro lines not voiced');
process.exit(ok ? 0 : 1);
