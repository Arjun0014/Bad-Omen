// Long-run stress / soak test: mass destruction, FPS, Grandma soak patrol, every set piece, finale, results.
// Usage: node scripts/stress_test.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(base + '?debug&autostart&skipintro&noauto');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const out = {};

const fpsOver = (sec) => ev(async (sec) => {
  const t0 = performance.now(); let frames = 0;
  await new Promise((res) => { const tick = () => { frames++; if (performance.now() - t0 < sec * 1000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
  return Math.round(frames / ((performance.now() - t0) / 1000));
}, sec);

await page.waitForTimeout(2500);
out.fpsStart = await fpsOver(3);

// ---- 1) mass destruction: break 80% of everything that scores, in waves (fragments + debris)
out.destruction = await ev(async () => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  g.granny.setState('scripted');
  const items = g.destruction.items.filter((r) => (r.meta.score ?? 0) > 0 && !r.broken && !r.meta.requiresGranny && !r.meta.unbreakable);
  items.sort(() => Math.random() - 0.5);
  const n = Math.floor(items.length * 0.8);
  for (let i = 0; i < n; i++) {
    const r = items[i];
    if (!r.broken) g.destruction.breakIt(r, i % 3 ? 'cat_swipe' : 'granny_throw');
    if (i % 20 === 19) await sleep(150);
  }
  await sleep(4000);
  const s = g.destruction.stats();
  return { broken: s.broken, total: s.total, debris: s.debris, activeDebris: s.activeDebris, score: g.score.score, doom: g.score.ruinPercent };
});
out.fpsAfterDestruction = await fpsOver(4);
await ev(() => { const g = window.__game; g.ui.settings.hq = false; g.applyQuality(false); });
out.fpsAfterDestructionLow = await fpsOver(4);
out.drawCallsLow = await ev(() => window.__game.renderer.info.render.calls);
await ev(() => { const g = window.__game; g.ui.settings.hq = true; g.applyQuality(true); });

// ---- 2) Grandma soak: 60 s of free patrol/search; she must keep moving and never fall out of the world
out.grannySoak = await ev(async () => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const V = g.cat.position.constructor;
  g.cat.teleport(new V(-4.6, 3.22, 3.9), 0); // out of the way on the bed
  g.cat.hide(g.level.hideSpots.find((h) => h.id === 'hide_bed'));
  g.granny.setState('patrol');
  let unstuck = 0; const off = g.events.on('grannyUnstuck', () => unstuck++);
  const rooms = new Set(); let maxStill = 0, still = 0, last = g.granny.position.clone();
  for (let i = 0; i < 600; i++) {
    await sleep(100);
    const p = g.granny.position;
    rooms.add(g.nav.nearest(p, { requireLos: false })?.room);
    if (p.distanceTo(last) < 0.02 && ['patrol', 'investigate', 'search', 'chase'].includes(g.granny.state)) still += 0.1; else still = 0;
    maxStill = Math.max(maxStill, still);
    last = p.clone();
    if (p.y < -1) return { fell: true };
  }
  off();
  g.cat.unhide();
  return { rooms: [...rooms].sort(), unstuckTeleports: unstuck, longestStandStill: +maxStill.toFixed(1), state: g.granny.state };
});

// ---- 3) every set piece in turn (forced), then the finale and results
out.setpieces = await ev(async () => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = {};
  for (const id of ['SP01', 'SP02', 'SP03', 'SP10']) {
    if (id === 'SP02') g.setPieces.state.sp02Ember = true;
    g.setPieces.trigger(id, 'granny_throw');
    for (let i = 0; i < 100 && g.state !== 'playing'; i++) await sleep(100);
    res[id] = { done: !!g.setPieces.done[id], back: g.state };
    await sleep(600);
  }
  return res;
});
out.finale = await ev(async () => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  g.rage.add(100); g.director.stage = 'wreck';
  for (let i = 0; i < 50 && !g.setPieces.state.finaleUnlocked; i++) await sleep(100);
  g.setPieces.trigger('SP04', 'granny_throw');
  for (let i = 0; i < 300 && g.state !== 'results'; i++) await sleep(100);
  return { unlocked: g.setPieces.state.finaleUnlocked, state: g.state, score: g.score.score, rank: g.score.rank(), disasters: g.score.setpieces.join(',') };
});
await page.screenshot({ path: 'test-results/stress_results.png' });
out.fpsResults = await fpsOver(2);
out.errors = errors.slice(0, 8);
console.log(JSON.stringify(out, null, 1));
await browser.close();
const ok = errors.length === 0 && out.finale.state === 'results' && !out.grannySoak.fell && out.grannySoak.longestStandStill < 12;
console.log(ok ? 'STRESS PASS' : 'STRESS FAIL');
process.exit(ok ? 0 : 1);
