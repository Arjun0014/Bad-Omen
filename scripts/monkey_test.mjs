// Random-input playtest: real keyboard/mouse-button input through the game's input path for several minutes,
// hopping between rooms, while Grandma plays normally. Checks for page errors, NaN/escaped positions, Komur or
// Grandma stuck in a non-normal state, and the frame rate.  Usage: node scripts/monkey_test.mjs [url] [--minutes 5]
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const mi = process.argv.indexOf('--minutes');
const minutes = mi >= 0 ? Number(process.argv[mi + 1]) : 5;
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(url + '?debug&autostart&skipintro');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });

// in-page monkey: presses go through Input exactly like real keydown/mousedown events (down set + timed queue)
const report = await page.evaluate(async (minutes) => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const V = g.cat.position.constructor;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const press = (code) => { g.input.down.add(code); g.input.queue.push({ code, t: performance.now() / 1000 }); };
  const release = (code) => g.input.down.delete(code);
  // walkable spots in every area (both floors, wing, yard)
  const spots = [[-4.4, 0.02, 3.1], [-3.4, 0.02, -0.8], [-1.1, 0.02, 1.0], [2.2, 0.02, 2.8], [2.6, 0.02, -2.4], [5.6, 0.02, 1.4],
    [1.9, 3.22, 0.0], [-2.8, 3.22, 2.6], [-3.5, 3.22, -2.4], [-1.1, 3.22, -1.0], [8.2, 0.02, 2.6], [9.6, 0.02, -1.8],
    [-4.5, 0.02, -7.0], [2.0, 0.02, -12.0], [9.6, 0.02, -7.5]];
  const out = { samples: 0, maxNonNormal: 0, escapes: 0, nan: 0, catModes: {}, grannyStates: {}, minFps: 999, fpsSum: 0, broken0: g.destruction.items.filter((i) => i.broken).length,
    setpieces: [], caught: 0, rescued: 0, grannyUnstuck: 0, longestGrannyStill: 0 };
  // a restart rebuilds the world and clears every listener: register again after each one
  const listen = () => {
    g.events.on('catCaught', () => out.caught++);
    g.events.on('catRescued', () => out.rescued++);
    g.events.on('grannyUnstuck', () => out.grannyUnstuck++);
    g.events.on('setpieceTriggered', (e) => out.setpieces.push(e?.id ?? '?'));
  };
  listen();
  out.restarts = 0;
  const end = performance.now() + minutes * 60000;
  let nonNormalSince = null, nextHop = 0, gStill = 0, gLast = g.granny.position.clone(), lastSample = 0;
  const held = new Set();
  while (performance.now() < end) {
    // results / outro reached: start a fresh run and keep going
    if (g.state === 'results') { await g.restart(); await sleep(400); g.sequence?.skip(); await sleep(400); listen(); out.restarts++; continue; }
    if (g.state === 'cinematic') { if (Math.random() < 0.3) g.sequence?.skip(); await sleep(200); continue; }
    if (g.state !== 'playing') { if (g.state === 'paused') g.resume(); await sleep(200); continue; }
    // hop to another area now and then (and the camera behind him)
    if (performance.now() > nextHop) {
      nextHop = performance.now() + rnd(15000, 30000);
      const s = pick(spots); g.cat.teleport(new V(...s), rnd(-Math.PI, Math.PI));
    }
    // random action
    const r = Math.random();
    if (r < 0.45) {
      for (const k of held) release(k); held.clear();
      const keys = [pick(['KeyW', 'KeyW', 'KeyW', 'KeyA', 'KeyD', 'KeyS'])];
      if (Math.random() < 0.4) keys.push(pick(['KeyA', 'KeyD']));
      if (Math.random() < 0.35) keys.push('ShiftLeft');
      if (Math.random() < 0.1) keys.push('KeyC');
      for (const k of keys) { press(k); held.add(k); }
    } else if (r < 0.6) press('Space');
    else if (r < 0.72) press('Mouse0');
    else if (r < 0.78) press('Mouse2');
    else if (r < 0.85) press('KeyF');
    else if (r < 0.9) { press('KeyE'); setTimeout(() => release('KeyE'), rnd(200, 1800)); }
    else if (r < 0.95) g.followCam.yaw += rnd(-1.2, 1.2);
    else { for (const k of held) release(k); held.clear(); }
    setTimeout(() => { release('Space'); release('Mouse0'); release('Mouse2'); release('KeyF'); }, 80);
    await sleep(rnd(120, 450));
    // sample once a second
    if (performance.now() - lastSample > 1000) {
      lastSample = performance.now();
      out.samples++;
      const p = g.cat.position, gp = g.granny.position;
      if (![p.x, p.y, p.z, gp.x, gp.y, gp.z].every(Number.isFinite)) out.nan++;
      if (p.y < -1.5 || Math.abs(p.x) > 40 || Math.abs(p.z) > 40) out.escapes++;
      out.catModes[g.cat.mode] = (out.catModes[g.cat.mode] ?? 0) + 1;
      out.grannyStates[g.granny.state] = (out.grannyStates[g.granny.state] ?? 0) + 1;
      if (g.cat.mode !== 'normal' && g.cat.mode !== 'caught') { nonNormalSince ??= performance.now(); out.maxNonNormal = Math.max(out.maxNonNormal, (performance.now() - nonNormalSince) / 1000); }
      else nonNormalSince = null;
      const moving = !['scripted', 'holding', 'react', 'stunned', 'windup', 'swing', 'catch', 'tantrum', 'search', 'investigate', 'spotted', 'recover'].includes(g.granny.state);
      if (moving && gp.distanceTo(gLast) < 0.05) { gStill++; out.longestGrannyStill = Math.max(out.longestGrannyStill, gStill); } else gStill = 0;
      gLast.copy(gp);
      const fps = g._fps; out.minFps = Math.min(out.minFps, Math.round(fps)); out.fpsSum += fps;
    }
  }
  for (const k of held) release(k);
  out.avgFps = Math.round(out.fpsSum / Math.max(1, out.samples)); delete out.fpsSum;
  out.broken = g.destruction.items.filter((i) => i.broken).length;
  out.score = g.score.score; out.state = g.state;
  return out;
}, minutes);
await page.screenshot({ path: 'test-results/monkey_end.png' });
await browser.close();
const ok = errors.length === 0 && report.nan === 0 && report.escapes === 0 && report.maxNonNormal < 12;
console.log(JSON.stringify({ ...report, errors: errors.slice(0, 5) }, null, 1));
console.log(ok ? 'MONKEY PASS' : 'MONKEY FAIL');
process.exit(ok ? 0 : 1);
