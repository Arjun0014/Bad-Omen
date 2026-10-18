// End-to-end browser smoke test for BAD OMEN (Playwright + Chromium).
// Usage: node scripts/browser_smoke.mjs [baseUrl] [--headed] [--only name,name] [--chrome | --firefox]
// Requires the game to be served (npm run dev / npm run preview).  Writes test-results/smoke.json + screenshots.
// --firefox uses Playwright's Firefox (PW_FIREFOX=<path to firefox.exe> to pick a cached build), muted by pref.
import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const headed = args.includes('--headed');
const onlyArg = args.indexOf('--only');
const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null;
const OUT = path.resolve('test-results');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const channel = args.includes('--chrome') ? 'chrome' : 'msedge'; // use the system browser (GPU) instead of a downloaded build
const browser = args.includes('--firefox')
  ? await firefox.launch({
    headless: !headed,
    executablePath: process.env.PW_FIREFOX || undefined,
    // silent: Firefox has no --mute-audio; a zero volume scale mutes every media element and WebAudio output
    firefoxUserPrefs: { 'media.volume_scale': '0.0', 'media.autoplay.default': 0, 'media.autoplay.blocking_policy': 0, 'webgl.force-enabled': true },
  })
  : await chromium.launch({
    channel,
    headless: !headed,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

async function shot(name) { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ev(fn, arg) { return page.evaluate(fn, arg); }
async function waitFor(fn, arg, timeout = 15000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await ev(fn, arg)) return true;
    await sleep(step);
  }
  return false;
}
async function test(name, fn) {
  if (only && !only.has(name)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true, ms: Date.now() - t0, detail });
    console.log(`PASS ${name}`, detail ? JSON.stringify(detail).slice(0, 220) : '');
  } catch (e) {
    results.push({ name, pass: false, ms: Date.now() - t0, error: String(e.message ?? e) });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
    await shot(`FAIL_${name}`).catch(() => {});
  }
}
function assert(c, msg) { if (!c) throw new Error(msg); }

// ---------------------------------------------------------------- boot
await page.goto(base + '?debug&autostart&skipintro', { waitUntil: 'domcontentloaded' });
const booted = await waitFor(() => window.__game?.state === 'playing', null, 60000);

await test('boot', async () => {
  assert(booted, 'game did not reach playing state');
  await sleep(2500);
  const info = await ev(() => ({ fps: Math.round(window.__game._fps), items: window.__game.destruction.items.length, post: !!window.__game.post?.enabled }));
  await shot('01_start');
  return info;
});

await test('assets', async () => {
  const r = await ev(() => {
    const g = window.__game;
    return { catClips: Object.keys(g.cat.clips).length, grannyClips: Object.keys(g.granny.clips).length, catAnim: g.cat.currentName, grannyAnim: g.granny.currentName };
  });
  assert(r.catClips >= 20, 'cat clips missing ' + r.catClips);
  assert(r.grannyClips >= 20, 'granny clips missing ' + r.grannyClips);
  return r;
});

await test('move_and_jump', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    g.granny.setState('scripted'); g.granny.teleport(new g.cat.position.constructor(-5.2, 0, -3.3));
    const V = g.cat.position.constructor;
    // open floor in the living room, running along +x (camera yaw -PI/2 looks toward +x)
    g.cat.teleport(new V(2.0, 0.02, 0.95), Math.PI / 2); g.followCam.yaw = -Math.PI / 2;
    await sleep(200);
    const p0 = g.cat.position.clone();
    g.input.down.add('KeyW');
    // measure in game time (first frames after boot can hitch while shaders compile)
    const t0 = g.time;
    while (g.time - t0 < 0.9) await sleep(30);
    const speed = Math.hypot(g.cat.vel.x, g.cat.vel.z);
    const gait = g.cat.currentName;
    g.input.down.delete('KeyW');
    await sleep(500);
    const moved = g.cat.position.distanceTo(p0);
    g.cat.teleport(new V(3.0, 0.02, 0.95), Math.PI);
    await sleep(300);
    let maxY = 0;
    g.input.queue.push({ code: 'Space', t: performance.now() / 1000 });
    g.input.down.add('Space');
    for (let i = 0; i < 30; i++) { await sleep(25); maxY = Math.max(maxY, g.cat.position.y); }
    g.input.down.delete('Space');
    await sleep(800);
    return { moved: +moved.toFixed(2), speed: +speed.toFixed(2), gait, maxY: +maxY.toFixed(2), landed: g.cat.grounded };
  });
  assert(r.moved > 1.0, 'cat did not move: ' + r.moved);
  assert(r.speed > 1.3 && r.speed < 1.6 && r.gait === 'Walk', 'default gait should be the ~1.45 m/s catwalk: ' + r.speed + ' ' + r.gait);
  assert(r.maxY > 0.7, 'jump too low: ' + r.maxY);
  assert(r.landed, 'cat did not land');
  return r;
});

await test('mantle_onto_counter', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    // in front of the kitchen counter (top 0.925) facing it
    g.cat.teleport(new V(-3.0, 0.02, -3.6), Math.PI); g.followCam.yaw = 0;
    await sleep(300);
    g.input.down.add('KeyW');
    g.input.queue.push({ code: 'Space', t: performance.now() / 1000 }); g.input.down.add('Space');
    await sleep(900);
    g.input.down.delete('Space'); g.input.down.delete('KeyW');
    await sleep(500);
    return { y: +g.cat.position.y.toFixed(2), grounded: g.cat.grounded };
  });
  assert(r.y > 0.85, 'cat did not get onto the counter, y=' + r.y);
  return r;
});

await test('swipe_vase_scores', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    g.granny.setState('scripted'); g.granny.teleport(new V(-5.2, 0, -3.3));
    // on the dining-room sideboard beside Grandma's GOOD vase, facing the wall: the swipe's aim assist turns him
    g.cat.teleport(new V(2.4, 0.9, -4.6), Math.PI);
    // breakage arms 1.5 s into a world (a skipped intro starts the tests sooner than that)
    let t0 = g.time; while (g.time - t0 < 0.4 || g.destruction.time < g.destruction.armTime + 0.1) await sleep(20);
    g.input.queue.push({ code: 'Mouse0', t: performance.now() / 1000 });
    t0 = g.time; while (g.time - t0 < 2.5 && !g.destruction.get('tut_vase').broken) await sleep(30);
    t0 = g.time; while (g.time - t0 < 0.5) await sleep(30);
    const v = g.destruction.get('tut_vase');
    return { broken: v.broken, source: v.lastHit?.source, score: g.score.score, stage: g.director.stage, rage: Math.round(g.rage.value) };
  });
  assert(r.broken, 'vase not broken');
  assert(r.score > 0, 'no score');
  assert(r.stage !== 'vase', 'tutorial did not advance');
  await shot('02_vase');
  return r;
});

await test('no_double_score', async () => {
  const r = await ev(() => {
    const g = window.__game;
    const before = g.score.score;
    const res = g.score.award({ id: 'tut_vase', base: 999, source: 'cat_swipe' });
    return { dup: res === null, same: g.score.score === before };
  });
  assert(r.dup && r.same, 'duplicate award possible');
  return r;
});

await test('granny_throw_breaks_chandelier', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    g.cat.teleport(new V(2.35, 3.22, -0.5), Math.PI / 2);
    g.setPieces._primeRope();
    g.granny.teleport(new V(6.0, 0, 0.9)); g.rage.setFloor(30); g.granny.throwCd = 0;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    const log = [];
    const offs = ['grannyWindup', 'grannyRelease', 'weakPointHit', 'setpieceTriggered', 'projectileHitCat', 'catDodged'].map((n) => g.events.on(n, (e) => log.push(n)));
    const off = g.events.on('grannyRelease', () => setTimeout(() => g.cat.teleport(new V(1.9, 3.22, -2.4), 0), 20));
    for (let i = 0; i < 160 && !g.setPieces.done.SP01; i++) await sleep(100);
    offs.forEach((o) => o()); off();
    return { done: !!g.setPieces.done.SP01, log, state: g.state };
  });
  assert(r.done, 'SP01 not triggered: ' + r.log.join(','));
  await sleep(1500);
  await shot('03_chandelier');
  const back = await waitFor(() => window.__game.state === 'playing', null, 15000);
  assert(back, 'did not return to gameplay after SP01 cinematic');
  const after = await ev(() => ({ cat: window.__game.cat.mode, table: window.__game.destruction.get('dining_table').broken, score: window.__game.score.score, ruin: window.__game.score.ruinPercent }));
  assert(after.cat === 'normal', 'cat controls not restored');
  assert(after.table, 'dining table survived the chandelier');
  return { ...r, ...after };
});

await test('kitchen_fire_chain', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    // key 1: the cat knocks the oil lamp off the shelf
    const lamp = g.destruction.get('kitchen_oillamp');
    g.destruction.knockLoose?.(lamp);
    g.destruction.touch(lamp, 'cat_swipe');
    lamp.body.applyImpulse({ x: 0, y: 0.5, z: 1.2 }, true);
    for (let i = 0; i < 40 && !lamp.broken; i++) await sleep(100);
    const ember = g.setPieces.state.sp02Ember;
    // key 2: Grandma's throw hits the stove
    g.setPieces._kitchenStoveHit('granny_throw');
    for (let i = 0; i < 20 && !g.setPieces.done.SP02; i++) await sleep(100);
    return { lampBroken: lamp.broken, ember, done: !!g.setPieces.done.SP02 };
  });
  assert(r.lampBroken && r.ember, 'lamp/ember key failed ' + JSON.stringify(r));
  assert(r.done, 'SP02 not triggered');
  await sleep(1800);
  await shot('04_kitchen_fire');
  const back = await waitFor(() => window.__game.state === 'playing', null, 15000);
  assert(back, 'did not return to gameplay after SP02');
  const f = await ev(() => ({ clusters: window.__game.fire.clusters.length, burning: window.__game.fire.burning }));
  assert(f.burning, 'no fire burning');
  return { ...r, ...f };
});

await test('wardrobe_through_floor', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    g.cat.teleport(new V(-5.1, 3.22, 2.0), 0);
    g.setPieces._primeWardrobe();
    // Grandma just inside the bedroom door, ~3.1 m away and facing the cat: beyond swing/catch range
    // (1.75 / 1.05 m) and past throwMin (2.4 m), so she winds up a real throw instead of closing in to swing.
    // (From the landing outside the door her lob hits the wall above the door frame.)
    const gp = new V(-2.35, 3.2, 3.5);
    // rage phase 3 (>= 75): heavy weapons only (axe/spear). A phase-2 teapot only cracks the primed floor further.
    const prevFloor = g.rage.floor;
    g.granny.teleport(gp, Math.atan2(g.cat.position.x - gp.x, g.cat.position.z - gp.z)); g.rage.setFloor(76); g.granny.throwCd = 0;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    let weapon = null;
    const off = g.events.on('grannyRelease', (e) => { weapon ??= e.type; setTimeout(() => g.cat.teleport(new V(-6.3, 3.22, 3.6), 0), 20); });
    const states = [];
    const offS = g.events.on('grannyState', (e) => { if (states.length < 14) states.push(e.state); });
    for (let i = 0; i < 160 && !g.setPieces.done.SP03; i++) await sleep(100);
    off(); offS();
    const viaThrow = !!g.setPieces.done.SP03;
    if (!g.setPieces.done.SP03) g.setPieces.trigger('SP03', 'granny_throw'); // fall back so later tests still run
    // later tests ran at rage floor 55 (phase 2) before this re-staging: restore that, not phase 3
    g.rage.floor = Math.max(prevFloor, 55); g.rage.value = Math.max(g.rage.floor, Math.min(g.rage.value, 74));
    return { viaThrow, weapon, done: !!g.setPieces.done.SP03, states: states.join('>'), cat: g.cat.position.toArray().map((v) => +v.toFixed(1)) };
  });
  await sleep(2200);
  await shot('05_floor');
  const back = await waitFor(() => window.__game.state === 'playing', null, 15000);
  assert(back, 'did not return to gameplay after SP03');
  const after = await ev(() => ({ floorBroken: window.__game.level.named.weakFloor.broken, ruin: window.__game.score.ruinPercent }));
  assert(after.floorBroken, 'weak floor intact');
  // checked last: the fallback trigger above already kept the world consistent for the tests that follow
  assert(r.viaThrow, 'SP03 needed the fallback trigger (no real throw broke it): ' + r.states);
  return { ...r, ...after };
});

await test('glass_house', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    // Komur on the conservatory tea table under the primed plant chandelier; Grandma in the doorway
    g.cat.teleport(new V(9.8, 0.8, 0.0), 0);
    g.setPieces._primeGlassRope();
    g.granny.teleport(new V(7.9, 0, 3.6)); g.rage.setFloor(30); g.granny.throwCd = 0;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    const off = g.events.on('grannyRelease', () => setTimeout(() => g.cat.teleport(new V(11.0, 0.02, -1.6), 0), 20));
    const states = [];
    const offS = g.events.on('grannyState', (e) => { if (states.length < 14) states.push(e.state); });
    for (let i = 0; i < 160 && !g.setPieces.done.SP10; i++) await sleep(100);
    off(); offS();
    const viaThrow = !!g.setPieces.done.SP10;
    if (!g.setPieces.done.SP10) g.setPieces.trigger('SP10', 'granny_throw');
    return { viaThrow, states: states.join('>') };
  });
  await sleep(2500);
  await shot('05b_glass_house');
  const back = await waitFor(() => window.__game.state === 'playing', null, 15000);
  assert(back, 'did not return to gameplay after SP10');
  const after = await ev(() => ({ roofGone: window.__game.house.glassRoof?.visible === false, wingOpen: !!window.__game.house.wingOpen, table: window.__game.destruction.get('cons_teatable').broken, disasters: window.__game.setPieces.count }));
  assert(after.roofGone && after.wingOpen, 'glass roof still up');
  assert(after.table, 'tea table survived');
  return { ...r, ...after };
});

await test('catch_and_recover', async () => {
  // a catch during the tutorial (vase / taunt / bait) is a toss and a warning; after it, the run ends (caught_ending)
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    const stage = g.director.stage; g.director.stage = 'bait';
    g.cat.invuln = 0;
    g.cat.teleport(new V(-1.1, 0.02, 1.6), 0);
    g.granny.teleport(new V(-1.1, 0, 0.6)); g.granny.catchCd = 0; g.granny.swingCd = 5;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    let caught = false; const off = g.events.on('catCaught', () => { caught = true; });
    for (let i = 0; i < 60 && !caught; i++) await sleep(100);
    off();
    for (let i = 0; i < 40 && g.cat.mode === 'caught'; i++) await sleep(100);
    const out = { caught, mode: g.cat.mode, catchCount: g.score.catchCount, invuln: g.cat.invuln > 0, state: g.state };
    if (g.director.stage === 'bait') g.director.stage = stage;
    return out;
  });
  assert(r.caught, 'Grandma never caught the cat');
  assert(r.mode === 'normal' && r.state === 'playing', 'tutorial catch did not recover: ' + JSON.stringify(r));
  return r;
});

await test('nav_between_floors', async () => {
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    g.granny.teleport(new V(-1.1, 0, 3.0));
    g.granny.setState('scriptMove', { target: new V(1.9, 3.2, -1.0), speed: 3.0 });
    for (let i = 0; i < 160 && g.granny.state === 'scriptMove'; i++) await sleep(100);
    const up = g.granny.position.y > 2.5;
    const upPos = g.granny.position.clone();
    g.granny.setState('scriptMove', { target: new V(-3.5, 0, -3.0), speed: 3.0 });
    for (let i = 0; i < 200 && g.granny.state === 'scriptMove'; i++) await sleep(100);
    return { up, upPos: upPos.toArray().map((v) => +v.toFixed(1)), down: g.granny.position.y < 0.5, end: g.granny.position.toArray().map((v) => +v.toFixed(1)) };
  });
  assert(r.up, 'Grandma failed to climb the stairs');
  assert(r.down, 'Grandma failed to come back down');
  return r;
});

await test('finale_and_results', async () => {
  await ev(() => {
    const g = window.__game;
    g.granny.setState('chase');
    g.score.ruin = Math.max(g.score.ruin, 70);
    g.rage.add(100);
    // isolated runs: pretend two disasters already happened
    if (g.setPieces.count < 2) { g.setPieces.done.SP01 = true; g.setPieces.done.SP02 = true; }
    if (g.director.stage !== 'finale') g.director.stage = 'wreck';
  });
  const unlocked = await waitFor(() => window.__game.setPieces.state.finaleUnlocked, null, 8000);
  assert(unlocked, 'finale did not unlock');
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    g.cat.teleport(new V(1.9, 3.22, 2.0), 0);
    g.granny.teleport(new V(5.6, 0, 3.4)); g.granny.throwCd = 0;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    const off = g.events.on('grannyRelease', () => setTimeout(() => g.cat.teleport(new V(1.9, 3.22, -2.0), 0), 20));
    for (let i = 0; i < 200 && !g.setPieces.done.SP04; i++) await sleep(100);
    off();
    if (!g.setPieces.done.SP04) return { done: false, granny: g.granny.state, sees: g.granny.seesCat };
    return { done: true };
  });
  assert(r.done, 'SP04 not triggered ' + JSON.stringify(r));
  await sleep(2500);
  await shot('06_collapse');
  const res = await waitFor(() => window.__game.state === 'results', null, 30000);
  assert(res, 'results screen not reached');
  await shot('07_results');
  return await ev(() => ({ score: window.__game.score.score, rank: window.__game.score.rank(), setpieces: window.__game.score.setpieces }));
});

await test('restart_resets', async () => {
  await ev(() => window.__game.restart());
  await sleep(1500);
  await ev(() => window.__game.sequence?.skip());
  const ok = await waitFor(() => window.__game.state === 'playing', null, 20000);
  assert(ok, 'restart did not reach playing');
  const r = await ev(() => ({ score: window.__game.score.score, broken: window.__game.destruction.items.filter((i) => i.broken).length, sp: Object.keys(window.__game.setPieces.done).length, rage: window.__game.rage.value }));
  assert(r.score === 0 && r.broken === 0 && r.sp === 0, 'world not reset ' + JSON.stringify(r));
  return r;
});

await test('caught_ending', async () => {
  // playtest 3: being caught after the tutorial ends the run: cauldron cutscene -> CAUGHT results
  const r = await ev(async () => {
    const g = window.__game; const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const V = g.cat.position.constructor;
    g.director.stage = 'wreck';
    g.cat.invuln = 0;
    g.cat.teleport(new V(-1.1, 0.02, 1.6), 0);
    g.granny.teleport(new V(-1.1, 0, 0.6)); g.granny.catchCd = 0; g.granny.swingCd = 5; g.granny.throwCd = 9;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    let caught = false; const off = g.events.on('catCaught', () => { caught = true; });
    for (let i = 0; i < 60 && !caught; i++) await sleep(100);
    off();
    let sawCauldron = false;
    for (let i = 0; i < 160 && g.state !== 'results'; i++) { await sleep(100); if (g.director.cauldron?.visible) sawCauldron = true; }
    return { caught, sawCauldron, state: g.state, stage: g.director.stage, label: document.getElementById('rLbl')?.textContent ?? '', catchCount: g.score.catchCount };
  });
  assert(r.caught, 'Grandma never caught the cat');
  assert(r.sawCauldron, 'the cauldron scene never played');
  assert(r.state === 'results' && /CAUGHT/.test(r.label), 'caught ending did not reach the CAUGHT results: ' + JSON.stringify(r));
  await shot('08_caught_results');
  return r;
});

await test('console_clean', async () => {
  const errs = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/.test(e));
  assert(errs.length === 0, `${errs.length} console errors: ${errs.slice(0, 3).join(' | ')}`);
  return { errors: 0 };
});

await browser.close();
const passed = results.filter((r) => r.pass).length;
fs.writeFileSync(path.join(OUT, 'smoke.json'), JSON.stringify({ base, when: new Date().toISOString(), passed, total: results.length, results, consoleErrors }, null, 1));
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
