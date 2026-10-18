// QA probes for the docs/11 acceptance items the smoke suite doesn't cover: focus loss, resize, crouch, pounce
// into furniture, jumping through a window, stun → catch, Grandma at the lens, Grandma's garden route, Grandma at
// the stove / vs the kitchen fire, skipping the finale cutscene, props on their legs, debris losing its support,
// memory across restarts, Pause → Main menu → Play, page refresh, achievements (unlock, saved, menu screen),
// the unskipped ending and Grandma never standing stuck (playtest 5).
// Usage: node scripts/qa_probe.mjs [baseUrl] [--only a,b]   (writes test-results/qa_probe.json)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg >= 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;
const OUT = path.resolve('test-results');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (fn, arg) => page.evaluate(fn, arg);
const results = [];
async function test(name, fn) {
  if (only && !only.has(name)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true, ms: Date.now() - t0, detail });
    console.log(`PASS ${name}`, detail ? JSON.stringify(detail).slice(0, 260) : '');
  } catch (e) {
    results.push({ name, pass: false, ms: Date.now() - t0, error: String(e.message ?? e) });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
    await page.screenshot({ path: path.join(OUT, `QA_FAIL_${name}.png`) }).catch(() => {});
  }
}
function assert(c, msg) { if (!c) throw new Error(msg); }
// helpers injected into the page (game-time waits survive a throttled tab)
// game time stands still on the results screen and in the menu: every game-time wait bails out there (a catch after
// the tutorial now ends the run, and a probe waiting for game time to pass would hang for good)
const PRE = `const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const V = g.cat.position.constructor;
  const frozen = () => g.state === 'results' || g.state === 'menu';
  const waitG = async (s) => { const t0 = g.time; while (g.time - t0 < s && !frozen()) await sleep(15); };`;
const run = (body) => ev(new Function(`return (async () => { ${PRE} ${body} })()`));

await page.goto(base + '?debug&autostart&skipintro');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
await sleep(2000);

await test('focus_loss_pauses', async () => {
  const r = await run(`
    window.dispatchEvent(new Event('blur'));
    await sleep(100);
    const paused = g.state, screen = g.ui.current;
    g.resume();
    await sleep(100);
    return { paused, screen, resumed: g.state };`);
  assert(r.paused === 'paused' && r.screen === 'pause', 'blur did not pause: ' + JSON.stringify(r));
  assert(r.resumed === 'playing', 'did not resume');
  return r;
});

await test('resize', async () => {
  await page.setViewportSize({ width: 960, height: 540 });
  await sleep(600);
  const r = await run(`
    const c = g.renderer.domElement; const pr = g.renderer.getPixelRatio();
    return { css: [c.clientWidth, c.clientHeight], buffer: [c.width, c.height], pr, aspect: +g.camera.aspect.toFixed(3), state: g.state };`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await sleep(600);
  const back = await run(`return { aspect: +g.camera.aspect.toFixed(3), buffer: [g.renderer.domElement.width, g.renderer.domElement.height] };`);
  assert(r.css[0] === 960 && r.css[1] === 540, 'canvas did not follow the window: ' + r.css);
  assert(Math.abs(r.aspect - 960 / 540) < 0.01, 'camera aspect stale: ' + r.aspect);
  assert(Math.abs(r.buffer[0] - Math.round(960 * r.pr)) <= 1, 'drawing buffer not resized: ' + r.buffer);
  assert(Math.abs(back.aspect - 1280 / 720) < 0.01, 'aspect not restored: ' + back.aspect);
  return { ...r, back };
});

await test('crouch_sneak', async () => {
  const r = await run(`
    g.granny.setState('scripted'); g.granny.teleport(new V(-4.0, 0, -9.0));
    g.cat.teleport(new V(2.0, 0.02, 0.95), Math.PI / 2); g.followCam.yaw = -Math.PI / 2;
    await waitG(0.3);
    g.input.down.add('KeyC'); g.input.down.add('KeyW');
    await waitG(1.2);
    const out = { crouching: g.cat.crouching, speed: +Math.hypot(g.cat.vel.x, g.cat.vel.z).toFixed(2), clip: g.cat.currentName };
    g.input.down.delete('KeyC'); g.input.down.delete('KeyW');
    await waitG(0.5);
    out.after = g.cat.crouching;
    return out;`);
  assert(r.crouching, 'C did not crouch');
  assert(r.speed > 0.5 && r.speed < 0.9, 'sneak speed should be ~0.75 m/s: ' + r.speed);
  assert(!r.after, 'still crouching after release');
  return r;
});

await test('pounce_moves_furniture', async () => {
  const r = await run(`
    // Komur 1.3 m in front of a dining chair (3.7, 0, 0.3), facing it, then a real pounce input
    const chair = g.destruction.get('dining_chair1');
    const p0 = chair.body ? { ...chair.body.translation() } : chair.group.position.clone();
    g.cat.teleport(new V(3.7, 0.02, 1.6), Math.PI); g.followCam.yaw = 0;
    await waitG(0.4);
    g.input.down.add('KeyW');
    // a queued press lives 0.18 s of real time: re-press until the pounce starts (a frame hitch right after the
    // resize probe could let one press expire before the fixed step read it)
    let pounced = false, presses = 0;
    for (; presses < 5 && !pounced; presses++) {
      g.input.queue.push({ code: 'Mouse2', t: performance.now() / 1000 });
      const t0 = g.time; while (g.time - t0 < 0.12 && !pounced && !frozen()) { await sleep(10); pounced = g.cat.mode === 'pounce'; }
    }
    await waitG(1.2);
    g.input.down.delete('KeyW');
    const p1 = chair.body ? chair.body.translation() : chair.group.position;
    return { pounced, presses, moved: +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2), broken: chair.broken, lastHit: chair.lastHit?.source ?? null, catMode: g.cat.mode };`);
  assert(r.pounced, 'the pounce never started');
  assert(r.moved > 0.08 || r.broken, 'pounce did not move or break the chair: ' + JSON.stringify(r));
  return r;
});

await test('jump_through_window', async () => {
  // playtest 3: jumping into a window didn't break the glass, only a swipe did.  Real input: W + Space at window 5
  // from 1.1 m inside (re-pressed: the leap may land on the sill first).
  const r = await run(`
    g.granny.setState('scripted'); g.granny.teleport(new V(-4.0, 0, -9.0));
    const i = 5, w = g.house.windows[i], rec = g.destruction.get('window_' + i);
    const n = w.alongX ? { x: 0, z: -Math.sign(w.cz) } : { x: -Math.sign(w.cx), z: 0 };
    const yaw = Math.atan2(-n.x, -n.z);
    g.cat.teleport(new V(w.cx + n.x * 1.1, 0.02, w.cz + n.z * 1.1), yaw); g.cat.vel.set(0, 0, 0); g.followCam.yaw = yaw - Math.PI;
    await waitG(0.5);
    g.input.down.add('KeyW');
    let presses = 0; const t0 = g.time;
    while (!rec.broken && g.time - t0 < 3.5 && !frozen()) {
      if (g.cat.grounded && g.cat.mode === 'normal') { g.input.queue.push({ code: 'Space', t: performance.now() / 1000 }); presses++; }
      const t1 = g.time; while (g.time - t1 < 0.5 && !rec.broken) await sleep(15);
    }
    const tBreak = +(g.time - t0).toFixed(2);
    await waitG(0.8);
    g.input.down.delete('KeyW');
    const p = g.cat.position;
    const out = { broken: rec.broken, source: rec.lastHit?.source ?? null, presses, tBreak, outside: +((p.x - w.cx) * -n.x + (p.z - w.cz) * -n.z).toFixed(2) };
    g.cat.teleport(new V(-4.4, 0.02, 3.1), 0); g.granny.setState('patrol');
    return out;`);
  assert(r.broken && r.source === 'cat_pounce', 'jumping into the window did not break it: ' + JSON.stringify(r));
  assert(r.outside > 0.2, 'Komur did not go through the broken window: ' + JSON.stringify(r));
  return r;
});

await test('stun_then_catch', async () => {
  // playtest 3: a thrown weapon that hits Komur stuns him ~2 s (no control) and Grandma can catch him then.
  // A tutorial stage: the catch is a toss and he recovers (after the tutorial it would end the run).
  const r = await run(`
    const gr = g.granny, cat = g.cat;
    const stage = g.director.stage; g.director.stage = 'bait'; g.director.firstCollateral = true;
    g.rage.setFloor(30);
    cat.invuln = 0; cat.teleport(new V(5.6, 0.02, 2.6), Math.PI);
    gr.teleport(new V(5.65, 0, -0.45), 0); gr.throwCd = 30; gr.swingCd = 3; gr.catchCd = 0;
    gr.lastSeen = cat.position.clone(); gr.lastSeenT = g.time; gr.setState('chase');
    await waitG(0.3);
    let stunAt = null, caughtAt = null, noControl = null;
    const offS = g.events.on('catStunned', () => { stunAt = g.time; });
    const offC = g.events.on('catCaught', () => { caughtAt = g.time; });
    const c = cat.position.clone(); c.y += 0.3;
    g.projectiles.launch({ type: 'pan', from: new V(c.x - 1.6, c.y + 0.5, c.z + 0.3), target: c, source: 'granny_throw', thrower: gr });
    const t0 = g.time;
    while (!stunAt && g.time - t0 < 2 && !frozen()) await sleep(10);
    if (stunAt) {
      // input is ignored while the stars are up (measured once the knockback flight is over)
      const tk = g.time; while (cat.mode === 'stumble' && g.time - tk < 1.2 && !frozen()) await sleep(10);
      g.input.down.add('KeyW'); const p0 = cat.position.clone(); await waitG(0.25);
      noControl = { stunT: +cat.stunT.toFixed(2), stars: cat.stars.visible, moved: +cat.position.distanceTo(p0).toFixed(3), mode: cat.mode };
      g.input.down.delete('KeyW');
    }
    while (!caughtAt && g.time - t0 < 6 && !frozen()) await sleep(20);
    offS(); offC();
    await waitG(3.5);
    const out = { stunned: !!stunAt, noControl, stunToCatch: stunAt && caughtAt ? +(caughtAt - stunAt).toFixed(2) : null, after: { mode: cat.mode, state: g.state, stunT: cat.stunT } };
    if (g.director.stage === 'bait') g.director.stage = stage;
    return out;`);
  assert(r.stunned, 'the pan did not stun Komur: ' + JSON.stringify(r));
  assert(r.noControl && (r.noControl.mode === 'caught' || (r.noControl.moved < 0.05 && r.noControl.stars)), 'Komur could move while stunned: ' + JSON.stringify(r));
  assert(r.stunToCatch !== null && r.stunToCatch < 2.5, 'Grandma did not catch the stunned cat: ' + JSON.stringify(r));
  assert(r.after.mode === 'normal' && r.after.state === 'playing', 'no recovery after a tutorial catch: ' + JSON.stringify(r));
  return r;
});

await test('granny_at_the_lens', async () => {
  // session 6: walking past the follow camera on her way to Komur, Grandma's hat and broom filled the screen.  She
  // walks a straight line through the lens (one step per rendered frame): not drawn inside ~0.8 m, drawn again ~1 m
  // ahead, no flicker; a cutscene camera right at her face keeps her drawn.
  const r = await run(`
    const gr = g.granny, cat = g.cat;
    cat.teleport(new V(2.0, 0.02, -11.0), Math.PI); g.followCam.yaw = 0; g.followCam.pitch = -0.2; g.followCam.smoothTarget.copy(cat.root.position);
    gr.setState('scripted'); gr.scriptAnim = true; gr.play('Walk', 0.1); gr.teleport(new V(-4.0, 0, -9.0), 0);
    await waitG(1.0);
    const cam = g.camera.position.clone();
    const dir = new V(cat.position.x - cam.x, 0, cat.position.z - cam.z).normalize();
    const start = cam.clone().addScaledVector(dir, -1.5); start.y = 0;
    const total = 1.5 + Math.hypot(cat.position.x - cam.x, cat.position.z - cam.z) - 0.7;
    const frame = async () => { const t = g.time; while (g.time === t && !frozen()) await sleep(4); };
    let toggles = 0, last = gr.root.visible, atLens = null;
    for (let s = 0; s <= total && !frozen(); s += 0.035) {
      gr.teleport(start.clone().addScaledVector(dir, s), Math.atan2(dir.x, dir.z));
      await frame(); await frame();
      if (gr.root.visible !== last) { toggles++; last = gr.root.visible; }
      if (atLens === null && s >= 1.5) atLens = gr.root.visible;   // at the lens
    }
    // the end of the walk: 0.7 m short of Komur, between him and the lens
    const ahead = gr.root.visible, aheadD = +Math.hypot(gr.position.x - g.camera.position.x, gr.position.z - g.camera.position.z).toFixed(2);
    // a cutscene shot with the camera 0.5 m from her face: she stays drawn
    const hp = gr.position.clone(); hp.y += 1.5;
    g.followCam.cinematic = { pos: hp.clone().add(new V(0, 0, 0.5)), look: hp, fov: 50, snap: true };
    await waitG(0.3);
    const inCutscene = gr.root.visible;
    g.followCam.cinematic = null;
    await waitG(0.2);
    gr.setState('patrol');
    return { toggles, atLens, ahead, aheadD, inCutscene, total: +total.toFixed(2) };`);
  assert(r.atLens === false, 'Grandma is drawn right at the lens: ' + JSON.stringify(r));
  assert(r.aheadD > 1.1 && r.ahead === true && r.toggles === 2, 'Grandma did not come back cleanly (or flickered): ' + JSON.stringify(r));
  assert(r.inCutscene === true, 'a cutscene camera hid Grandma: ' + JSON.stringify(r));
  return r;
});

await test('garden_nav', async () => {
  const r = await run(`
    const gr = g.granny;
    g.cat.teleport(new V(9.8, 0.8, 0.0), 0);
    gr.teleport(new V(-4.5, 0, 2.6));
    // the Director turns any scripted walk longer than 9 s into a patrol (a safety net): keep re-issuing it,
    // this probe is about the route, not that timeout
    const go = async (target, limit = 40) => {
      const t0 = g.time;
      while (g.time - t0 < limit && !frozen()) {
        if (Math.hypot(gr.position.x - target.x, gr.position.z - target.z) < 0.9 && Math.abs(gr.position.y - target.y) < 0.5) break;
        if (gr.state !== 'scriptMove') gr.setState('scriptMove', { target, speed: 3.0 });
        await sleep(100);
      }
      return { at: gr.position.toArray().map((v) => +v.toFixed(1)), t: +(g.time - t0).toFixed(1) };
    };
    const yard = await go(new V(-2.0, 0, -9.0));
    const back = await go(new V(5.5, 0, 1.6)); // living room, open floor by the fireplace
    gr.setState('scripted');
    return { yard: yard.at, yardT: yard.t, back: back.at, backT: back.t };`);
  assert(Math.hypot(r.yard[0] + 2.0, r.yard[2] + 9.0) < 1.0, 'Grandma never reached the garden: ' + r.yard);
  assert(Math.hypot(r.back[0] - 5.5, r.back[2] - 1.6) < 1.0, 'Grandma never got back to the living room: ' + r.back);
  return r;
});

await test('granny_at_stove', async () => {
  // playtest 3: she smashed the stove standing next to it, the kitchen fire started at her feet and she flinched in
  // place for good.  1) SP02 lit with her at the stove; 2) dropped into the flames mid-chase.
  const r = await run(`
    const gr = g.granny;
    const out = {};
    if (!g.setPieces.done.SP02) {
      g.cat.teleport(new V(-3.3, 0.02, -0.6), Math.PI);
      gr.teleport(new V(-5.55, 0, -2.6), -Math.PI / 2); g.rage.setFloor(30);
      gr.setState('chase'); gr.lastSeen = g.cat.position.clone(); gr.lastSeenT = g.time;
      await waitG(0.2);
      g.setPieces.state.sp02Ember = true; g.setPieces.state.sp02Stove = true;
      g.setPieces.trigger('SP02', 'granny_charge');
      const t0 = g.time; while (g.state !== 'playing' && g.time - t0 < 20 && !frozen()) await sleep(50);
      out.afterCutscene = { hot: !!g.fire.isHot(gr.position, 0.25), at: gr.position.toArray().map((v) => +v.toFixed(2)) };
    }
    // mid-chase, standing in the stove fire, Komur beyond the kindling-crate fire
    g.cat.invuln = 99; gr.throwCd = 99;
    g.cat.teleport(new V(-6.5, 0.02, -0.3), 0);
    gr.teleport(new V(-5.7, 0, -2.4), -Math.PI / 2);
    gr.singeCd = 0; gr.setState('chase'); gr.lastSeen = g.cat.position.clone(); gr.lastSeenT = g.time;
    let singed = 0; const off = g.events.on('grannySinged', () => singed++);
    let firstOut = null, run = 0, maxRun = 0, last = g.time; const t0 = g.time;
    while (g.time - t0 < 10 && !frozen()) {
      await sleep(50);
      const dt = g.time - last; last = g.time;
      const hot = !!g.fire.isHot(gr.position, 0.25);
      if (!hot && firstOut === null) firstOut = +(g.time - t0).toFixed(2);
      if (hot) { run += dt; maxRun = Math.max(maxRun, run); } else run = 0;
    }
    off(); g.cat.invuln = 0; gr.throwCd = 3;
    return { ...out, firstOut, maxRun: +maxRun.toFixed(2), singed, state: gr.state };`);
  if (r.afterCutscene) assert(!r.afterCutscene.hot, 'Grandma still in the flames after the kitchen cutscene: ' + JSON.stringify(r));
  assert(r.firstOut !== null && r.firstOut < 1.0, 'Grandma did not get out of the fire within 1 s: ' + JSON.stringify(r));
  assert(r.maxRun < 1.2 && r.singed <= 3, 'Grandma stays in / keeps walking into the fire: ' + JSON.stringify(r));
  return r;
});

await test('granny_vs_fire', async () => {
  const r = await run(`
    g.setPieces.state.sp02Ember = true; g.setPieces.trigger('SP02', 'granny_throw');
    let t0 = g.time; while (g.state !== 'playing' && g.time - t0 < 20 && !frozen()) await sleep(100);
    // Komur in the kitchen's far corner beyond the stove fires; Grandma hunting him from the hall.  A tutorial
    // stage for the length of the probe: a catch is a toss there, not the end of the run (that's caught_ending)
    const gr = g.granny;
    const stage = g.director.stage; g.director.stage = 'bait'; g.director.firstCollateral = true;
    g.cat.invuln = 0;
    g.cat.teleport(new V(-6.5, 0.02, -0.3), 0);
    gr.teleport(new V(-1.1, 0, -2.0)); g.rage.setFloor(30); gr.throwCd = 6;
    gr.lastSeen = g.cat.position.clone(); gr.lastSeenT = g.time;
    gr.setState('chase');
    let singed = 0; const off = g.events.on('grannySinged', () => singed++);
    let hot = 0, maxHotRun = 0, run = 0; const states = new Set();
    t0 = g.time;
    while (g.time - t0 < 15 && !frozen()) {
      const tA = g.time; await sleep(100); const dt = g.time - tA;
      states.add(gr.state);
      if (g.fire.isHot(gr.position, 0.25)) { hot += dt; run += dt; maxHotRun = Math.max(maxHotRun, run); } else run = 0;
    }
    off();
    if (g.director.stage === 'bait') g.director.stage = stage;
    return { burning: g.fire.burning, clusters: g.fire.clusters.length, singed, hot: +hot.toFixed(1), maxHotRun: +maxHotRun.toFixed(1), states: [...states].join(','), granny: gr.position.toArray().map((v) => +v.toFixed(1)) };`);
  assert(r.burning, 'kitchen fire not burning');
  assert(r.maxHotRun < 3 && r.singed <= 6, 'Grandma keeps walking into the fire: ' + JSON.stringify(r));
  return r;
});

await test('skip_finale_cutscene', async () => {
  await run(`
    g.granny.setState('chase'); g.score.ruin = Math.max(g.score.ruin, 70); g.rage.add(100);
    if (g.setPieces.count < 2) { g.setPieces.done.SP01 = true; g.setPieces.done.SP02 = true; }
    if (g.director.stage !== 'finale') g.director.stage = 'wreck';`);
  await page.waitForFunction(() => window.__game.setPieces.state.finaleUnlocked, null, { timeout: 10000 });
  const r = await run(`
    g.setPieces.trigger('SP04', 'granny_throw');
    await sleep(1200);
    let skips = 0; const t0 = performance.now();
    while (g.state !== 'results' && performance.now() - t0 < 30000) {
      if (g.state === 'cinematic' && g.sequence?.skippable) { g.sequence.skip(); skips++; }
      await sleep(250);
    }
    return { state: g.state, skips, roofBroken: !!g.house.roofBroken, rank: g.score.rank(), score: g.score.score };`);
  assert(r.state === 'results', 'skipping the finale cutscenes did not reach the results: ' + JSON.stringify(r));
  assert(r.roofBroken, 'roof not collapsed after skip');
  return r;
});

// a fresh, untouched house (the probes before these set fires, collapse the roof and end on the results screen)
async function freshWorld() {
  await ev(() => window.__game.restart());
  await sleep(1200);
  await ev(() => window.__game.sequence?.skip());
  await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 30000 });
  await sleep(500);
}

await test('props_stand_on_legs', async () => {
  // playtest 3: chairs/stools whose legs don't collide sank 0.43-0.48 m into the floor
  await freshWorld();
  const r = await run(`
    await waitG(2);
    const sunk = [];
    for (const p of g.destruction.items) {
      if (!p.body || !p.dynamic || p.broken) continue;
      const y0 = p.def?.pos?.[1]; if (y0 === undefined) continue;
      const y = p.body.translation().y;
      if (y0 - y > 0.05) sunk.push(p.id + ' ' + (y0 - y).toFixed(2));
    }
    return { sunk };`);
  assert(r.sunk.length === 0, 'props sank below where they stand: ' + r.sunk.join(', '));
  return r;
});

await test('debris_falls_when_support_breaks', async () => {
  // playtest 3: frozen debris stayed in the air when the table under it broke
  if (await ev(() => window.__game.state !== 'playing' || !window.__game.destruction.get('dining_table') || window.__game.destruction.get('dining_table').broken)) await freshWorld();
  const r = await run(`
    g.granny.setState('scripted'); g.granny.teleport(new V(-4.0, 0, -9.0));
    const D = g.destruction;
    for (const id of ['dining_plate0', 'dining_plate1', 'dining_plate2', 'dining_cup0', 'dining_cup1', 'dining_teapot']) { const p = D.get(id); if (p && !p.broken) D.breakIt(p, 'cat_swipe'); }
    await waitG(4);
    const onTable = D.debris.filter((d) => d.frozen && Math.abs(d.mesh.position.x - 4.4) < 1 && Math.abs(d.mesh.position.z + 0.5) < 0.6 && d.mesh.position.y > 0.6).length;
    const table = D.get('dining_table'); if (!table.broken) D.breakIt(table, 'granny_throw');
    await waitG(4);
    const stillHigh = D.debris.filter((d) => Math.abs(d.mesh.position.x - 4.4) < 1.2 && Math.abs(d.mesh.position.z + 0.5) < 0.9 && d.mesh.position.y > 0.6).length;
    const floating = D.debris.filter((d) => d.frozen && !D._supported(d)).length;
    return { onTable, stillHigh, floating };`);
  assert(r.onTable > 0, 'no debris settled on the table to test with');
  assert(r.stillHigh === 0 && r.floating === 0, 'debris left in the air: ' + JSON.stringify(r));
  return r;
});

await test('ground_floor_windows', async () => {
  // playtest 4: the kitchen window didn't break when Komur jumped at it (a leap at its sill turned into a climb, and
  // the climb carried him through the glass).  Real input (W + Space) at every ground-floor window: the pane breaks;
  // where furniture stands in front of one, he at least never ends up outside behind intact glass (he used to climb
  // the conservatory bookcase onto the wall top and drop into the yard).
  if (await ev(() => window.__game.state !== 'playing')) await freshWorld();
  const r = await run(`
    g.granny.setState('scripted'); g.granny.teleport(new V(-4.0, 0, -9.0));
    const stage = g.director.stage; g.director.stage = 'bait';
    const out = [];
    for (let i = 0; i < g.house.windows.length; i++) {
      const w = g.house.windows[i], rec = g.destruction.get('window_' + i);
      if (w.cy > 3.2 || !rec || rec.broken) continue;
      const n = w.alongX ? { x: 0, z: -Math.sign(w.cz) } : { x: -Math.sign(w.cx), z: 0 }; // toward the inside
      const sx = w.cx + n.x * 1.1, sz = w.cz + n.z * 1.1;
      const block = g.physics.raycast(sx, w.cy - w.h / 2 + 0.35, sz, -n.x, 0, -n.z, 1.3);
      const blockedBy = block && block.owner !== rec ? (block.owner?.id ?? 'static') : null;
      const yaw = Math.atan2(-n.x, -n.z);
      g.cat.teleport(new V(sx, 0.02, sz), yaw); g.cat.vel.set(0, 0, 0); g.followCam.yaw = yaw - Math.PI;
      await waitG(0.5);
      g.input.down.add('KeyW');
      let presses = 0; const t0 = g.time;
      while (!rec.broken && g.time - t0 < 4 && !frozen()) {
        if (g.cat.grounded && g.cat.mode === 'normal') { g.input.queue.push({ code: 'Space', t: performance.now() / 1000 }); presses++; }
        const t1 = g.time; while (g.time - t1 < 0.5 && !rec.broken) await sleep(15);
      }
      g.input.down.delete('KeyW');
      await waitG(0.3);
      const p = g.cat.position;
      const outside = +((p.x - w.cx) * -n.x + (p.z - w.cz) * -n.z).toFixed(2);
      out.push({ i, blockedBy, broken: rec.broken, source: rec.lastHit?.source ?? null, presses, outside });
    }
    g.director.stage = stage;
    g.cat.teleport(new V(-4.4, 0.02, 3.1), 0); g.granny.setState('patrol');
    return out;`);
  const bad = r.filter((w) => (!w.blockedBy && !(w.broken && w.source === 'cat_pounce')) || (!w.broken && w.outside > 0.1));
  assert(r.length >= 8, 'expected the ground-floor windows: ' + JSON.stringify(r));
  assert(bad.length === 0, 'windows that did not break (or that he passed behind intact glass): ' + JSON.stringify(bad));
  return { windows: r.length, broken: r.filter((w) => w.broken).length, blocked: r.filter((w) => w.blockedBy).map((w) => `${w.i}:${w.blockedBy}`) };
});

await test('head_never_spins', async () => {
  // playtest 4: "the neck still does a 360".  three.js's mixer skips bones whose sampled value didn't change, so on a
  // still pose the procedural layer (head look-at, stun wobble) piled up frame after frame: loafing or sitting with
  // Grandma patrolling nearby turned the head 180° away from the body.  The head's rotation in the body frame,
  // against an Idle calibration, must stay under 100° while loafing, sitting and stunned.
  if (await ev(() => window.__game.state !== 'playing')) await freshWorld();
  const r = await run(`
    const cat = g.cat, gr = g.granny, b = cat.bones;
    const Q = cat.model.quaternion.constructor;
    const qb = new Q(), qh = new Q(), q0 = new Q(), qr = new Q();
    const rel = (o) => { cat.model.getWorldQuaternion(qb); b.head.getWorldQuaternion(qh); return o.copy(qb).invert().multiply(qh); };
    const ang = () => { rel(qr); return 2 * Math.acos(Math.min(1, Math.abs(qr.dot(q0)))) * 180 / Math.PI; };
    const sample = async (s) => { let mx = 0; const t0 = g.time; while (g.time - t0 < s && !frozen()) { mx = Math.max(mx, ang()); await sleep(16); } return +mx.toFixed(1); };
    const stage = g.director.stage; g.director.stage = 'bait';
    gr.setState('scripted'); gr.teleport(new V(-4.0, 0, -9.0));
    const home = new V(4.0, 0.02, 2.4);
    cat.teleport(home, Math.PI); g.followCam.yaw = 0;
    await waitG(1.2);
    cat.play('Idle', 0.01); await waitG(0.6); rel(q0);
    const out = { idle: await sample(1) };
    const near = async (stg, clip, idleTime, dx) => {
      cat.idleTime = idleTime; cat.idleStage = stg; cat.idleNext = 999; cat._lowPose = true; cat.play(clip, 0.3);
      await waitG(1.0);
      gr.teleport(new V(home.x + dx, 0, home.z - 2.4), 0); gr.setState('patrol');
      const m = await sample(3);
      gr.setState('scripted'); gr.teleport(new V(-4.0, 0, -9.0));
      cat.idleTime = 0; cat.idleStage = 0; cat._lowPose = false; cat.play('Idle', 0.2);
      await waitG(1.2);
      return m;
    };
    out.loaf = await near(3, 'Loaf', 31, 0.8);
    out.sit = await near(2, 'SittingIdle', 20, -0.8);
    cat.invuln = 0; cat.teleport(new V(5.6, 0.02, 2.6), Math.PI); await waitG(0.4);
    const c = cat.position.clone(); c.y += 0.3;
    g.projectiles.launch({ type: 'pan', from: new V(c.x - 1.6, c.y + 0.5, c.z + 0.3), target: c, source: 'granny_throw', thrower: gr });
    const t0 = g.time; while (cat.stunT <= 0 && g.time - t0 < 2 && !frozen()) await sleep(10);
    out.stunned = cat.stunT > 0;
    out.stun = await sample(2.4);
    g.director.stage = stage;
    cat.teleport(new V(-4.4, 0.02, 3.1), 0); gr.setState('patrol');
    return out;`);
  assert(r.stunned, 'the pan never stunned him: ' + JSON.stringify(r));
  assert(r.loaf < 100 && r.sit < 100 && r.stun < 100, 'the head turned too far from the body: ' + JSON.stringify(r));
  return r;
});

await test('no_floating_fragments', async () => {
  // playtest 4: "triangular slices left floating in the air after big events".  Glass shards and splinters settled
  // at the height of the surface under their burst (a table top, the conservatory's invisible ceiling) wherever they
  // landed, and SP10's roof panes settled on that ceiling.  Trigger SP01 and SP10 and watch for 10 s each.
  await freshWorld();
  const r = await run(`
    const gr = g.granny, D = g.destruction, fx = g.fx;
    gr.setState('scripted'); gr.teleport(new V(-4.0, 0, -9.0));
    g.director.stage = 'bait';
    g.cat.teleport(new V(2.4, 0.02, 3.6), Math.PI);
    const vis = (col) => !g.physics.ownerOf(col)?.invisible;
    const floorAt = (x, y, z) => { const h = g.physics.raycast(x, y + 0.05, z, 0, -1, 0, 8, undefined, undefined, undefined, vis); return h ? h.point.y + 0.01 : 0; };
    const floating = () => { let n = 0; for (const pool of [fx.shards, fx.splinters]) for (const c of pool.c) if (c.alive && c.rest && floorAt(c.x, c.y + 0.05, c.z) < c.y - 0.05) n++; return n; };
    const out = {};
    for (const id of ['SP01', 'SP10']) {
      g.setPieces.trigger(id, 'granny_throw');
      const t0 = g.time; let maxF = 0, roof = 0, k = 0;
      while (g.time - t0 < 10 && !frozen()) {
        if (g.state === 'cinematic' && g.sequence?.skippable && g.time - t0 > 6) g.sequence.skip();
        if (++k % 8 === 0) { maxF = Math.max(maxF, floating()); if (g.time - t0 > 4) roof = Math.max(roof, D.debris.filter((d) => d.mesh.position.x > 7 && d.mesh.position.y > 2.9).length); }
        await sleep(30);
      }
      out[id] = { floatingChunks: maxF, roofDebris: roof, frozenUnsupported: D.debris.filter((d) => d.frozen && !D._supported(d)).length };
    }
    return out;`);
  const bad = Object.entries(r).filter(([, v]) => v.floatingChunks > 3 || v.roofDebris > 0 || v.frozenUnsupported > 0);
  assert(bad.length === 0, 'fragments left in the air: ' + JSON.stringify(r));
  return r;
});

await test('sp03_floor_hole', async () => {
  // playtest 4: after the wardrobe fell there was no hole: the boards' fragments filled the opening exactly and froze
  // there.  After SP03 nothing may lie in the opening, its rim must show, and Komur put over it falls to the foyer.
  if (await ev(() => window.__game.state !== 'playing' || window.__game.setPieces.done.SP03)) await freshWorld();
  const r = await run(`
    const gr = g.granny, D = g.destruction, h = g.house.weakFloor;
    gr.setState('scripted'); gr.teleport(new V(-4.0, 0, -9.0));
    g.director.stage = 'bait';
    g.cat.teleport(new V(-3.0, 0.02, -2.0), 0);
    g.setPieces.state.sp03Primed = true;
    g.setPieces.trigger('SP03', 'granny_throw');
    const t0 = g.time;
    while ((g.state === 'cinematic' || g.setPieces.busy) && g.time - t0 < 12 && !frozen()) await sleep(30);
    await waitG(2.0);
    const inHole = D.debris.filter((d) => { const p = d.mesh.position; return p.y > h.y - 0.6 && p.x > h.x0 - 0.05 && p.x < h.x1 + 0.05 && p.z > h.z0 - 0.05 && p.z < h.z1 + 0.05; }).length;
    const rim = D.get('sp03_floor').rim;
    g.cat.teleport(new V((h.x0 + h.x1) / 2, h.y + 0.1, (h.z0 + h.z1) / 2), 0);
    await waitG(2.0);
    const out = { inHole, rimShown: !!rim?.stubs.visible && rim.decal.material.opacity > 0.5, catY: +g.cat.position.y.toFixed(2) };
    g.cat.teleport(new V(-4.4, 0.02, 3.1), 0); gr.setState('patrol');
    return out;`);
  assert(r.inHole === 0, 'debris left lying in the opening: ' + JSON.stringify(r));
  assert(r.rimShown, 'the broken rim is not shown: ' + JSON.stringify(r));
  assert(r.catY < 0.5, 'Komur did not drop through the hole to the floor below: ' + JSON.stringify(r));
  return r;
});

await test('catch_hold', async () => {
  // playtest 4: caught, Komur floated under Grandma's hand or sank into her arm (he was put 0.45 m below her hand bone
  // whatever the poses).  Playtest 5: her fingers ran through his neck and head (in a catch and in the cauldron
  // close-up).  Measured on the meshes: her hand's skinned vertices against his neck and skull (around the axis
  // upper spine -> head, the median distance of his own neck/head vertices per slice is his surface).  In a
  // (tutorial) catch and in the caught ending's close-up her hand must touch him but not sink into him, and he must
  // be held up off the floor.
  if (await ev(() => window.__game.state !== 'playing')) await freshWorld();
  const MEASURE = `
    const skinVerts = (root, pick) => { const out = []; root.traverse((o) => { if (!o.isSkinnedMesh || !o.visible) return;
      const sk = o.skeleton, si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
      for (let i = 0; i < si.count; i++) { let best = -1, bw = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        if (pick(sk.bones[best])) { const v = new V(); o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); out.push(v); } } }); return out; };
    const handSet = new Set(); gr.hand.traverse((o) => { if (o.isBone) handSet.add(o); });
    // his surface per slice along the axis lower spine -> head (and past it) and per 45-degree sector around it:
    // the 75th percentile distance of his own back/neck/head vertices there (a non-round body: chest vs back)
    const measure = () => {
      g.scene.updateMatrixWorld(true);
      const b = cat.bones, A = b.spineLow.getWorldPosition(new V()), H = b.head.getWorldPosition(new V());
      const ax = H.clone().sub(A), L = ax.length() + 0.12; ax.normalize();
      const p0 = new V(0, 1, 0).addScaledVector(ax, -ax.y); if (p0.lengthSq() < 1e-4) p0.set(1, 0, 0).addScaledVector(ax, -ax.x); p0.normalize();
      const p1 = new V().crossVectors(ax, p0);
      const NB = 16, NS = 8, tmp = new V(), w = new V();
      const key = (p) => { const t = tmp.copy(p).sub(A).dot(ax); if (t <= -0.04 || t >= L) return null;
        const c = tmp.copy(A).addScaledVector(ax, t); w.copy(p).sub(c); const d = w.length();
        const s = Math.floor(((Math.atan2(w.dot(p1), w.dot(p0)) + Math.PI) / (2 * Math.PI)) * NS) % NS;
        return { k: Math.min(NB - 1, Math.floor((t + 0.04) / (L + 0.04) * NB)) * NS + s, d }; };
      const bins = Array.from({ length: NB * NS }, () => []), upper = new Set([b.spineLow, b.spineUp, b.neck, b.head]);
      for (const v of skinVerts(cat.root, (x) => upper.has(x))) { const q = key(v); if (q && q.d < 0.15) bins[q.k].push(q.d); }
      const R = bins.map((a) => { if (a.length < 3) return 0; a.sort((x, y) => x - y); return a[Math.floor(a.length * 0.75)]; });
      let deep = 0, inside = 0, gap = 1;
      for (const v of skinVerts(gr.root, (x) => handSet.has(x))) {
        const q = key(v); if (!q) continue; const r = R[q.k]; if (!r) continue;
        if (r - q.d > 0.005) { inside++; deep = Math.max(deep, r - q.d); } gap = Math.min(gap, Math.max(0, q.d - r));
      }
      return { inside, deepCm: +(deep * 100).toFixed(1), gapCm: +(gap * 100).toFixed(1) };
    };`;
  const r = await run(`
    const cat = g.cat, gr = g.granny;
    ${MEASURE}
    const stage = g.director.stage; g.director.stage = 'bait';
    cat.teleport(new V(9.0, 0.02, -1.6), Math.PI); cat.invuln = 0;
    gr.teleport(new V(9.0, 0, -2.6), 0); gr.setState('chase');
    await waitG(0.4);
    gr._grabCat();
    let minFeet = 9, n = 0; const hold = [];
    await waitG(0.35);
    const t0 = g.time;
    while (cat.mode === 'caught' && g.time - t0 < 1.0 && !frozen()) {
      minFeet = Math.min(minFeet, cat.root.position.y - gr.position.y); n++;
      if (n % 15 === 1) hold.push(measure());
      await sleep(16);
    }
    while (cat.mode === 'caught' && g.time - t0 < 3 && !frozen()) await sleep(20);
    const released = cat.mode === 'normal';
    // the caught ending (after the tutorial): the cauldron close-up
    g.director.stage = 'wreck'; g.director.firstCollateral = true; gr.catchCd = 0; cat.invuln = 0;
    cat.teleport(new V(9.0, 0.02, -1.6), Math.PI); gr.teleport(new V(9.0, 0, -2.6), 0);
    await waitG(0.3);
    gr._grabCat();
    const t1 = g.time; let cauldron = null;
    while (g.time - t1 < 11.2 && g.state !== 'results') { await sleep(30); if (!cauldron && g.time - t1 > 10.6) cauldron = measure(); }
    g.director.stage = stage;
    return { samples: n, minFeetAboveHers: +minFeet.toFixed(2), released, hold, cauldron };`);
  // touching: within 5 cm (playtest 6: the hold gives its push back gently instead of shaking him, so her fingers can
  // be a few cm off his scruff for a moment; floating, the old bug, was 45 cm)
  const bad = [...r.hold, r.cauldron].filter((m) => !m || m.deepCm > 1.5 || m.inside > 8 || m.gapCm > 5);
  assert(r.samples > 10, 'he was not held long enough to measure: ' + JSON.stringify(r));
  assert(bad.length === 0, 'her hand sinks into him (or does not touch him): ' + JSON.stringify(r));
  assert(r.minFeetAboveHers > 0.6, 'he is not held up off the floor: ' + JSON.stringify(r));
  assert(r.released, 'the tutorial catch never tossed him: ' + JSON.stringify(r));
  if (await ev(() => window.__game.state !== 'playing')) await freshWorld();
  return r;
});

await test('tutorial_flow', async () => {
  // playtest 4: the intro ends with Komur bolting from the foyer, play starts in the dining room away from Grandma
  // (who patrols: she hears and sees him from the start), and a tutorial walks through move, leap, swipe, meow;
  // TAB skips it.  Real input for every step (the swipe relies on its aim assist: the vase is at his shoulder).
  await freshWorld();
  const r = await run(`
    const cat = g.cat, gr = g.granny, d = g.director;
    g.director.startIntro();
    let t0 = performance.now();
    while (g.state === 'cinematic' && performance.now() - t0 < 30000) await sleep(30);
    await waitG(0.3);
    const out = { start: { stage: d.stage, tut: d.tut, room: cat.position.x > 1.2 && cat.position.z < 0.5, grDist: +gr.position.distanceTo(cat.position).toFixed(1), grActive: gr.active, hint: g.ui._tutHint } };
    const press = (code) => g.input.queue.push({ code, t: performance.now() / 1000 });
    g.input.down.add('KeyW'); await waitG(0.9); g.input.down.delete('KeyW'); await waitG(0.2);
    out.afterMove = d.tut;
    g.input.down.add('KeyW');
    t0 = g.time;
    while (d.tut === 'leap' && g.time - t0 < 6 && !frozen()) {
      if (cat.grounded && cat.mode === 'normal' && cat.position.distanceTo(new V(2.3, 0, -4.6)) < 2.0) press('Space');
      const t1 = g.time; while (g.time - t1 < 0.4) await sleep(15);
    }
    g.input.down.delete('KeyW');
    out.afterLeap = { tut: d.tut, y: +cat.position.y.toFixed(2) };
    await waitG(0.4);
    const vase = g.destruction.get('tut_vase');
    for (let k = 0; k < 4 && !vase.broken; k++) { press('Mouse0'); await waitG(0.5); }
    out.vase = { broken: vase.broken, stage: d.stage };
    await waitG(1.2);
    press('KeyF'); await waitG(1.5);
    out.afterMeow = d.stage;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab', key: 'Tab' }));
    await waitG(0.2);
    out.afterTab = { stage: d.stage, hint: g.ui._tutHint };
    return out;`);
  assert(r.start.stage === 'vase' && r.start.tut === 'move' && r.start.room, 'play did not start in the dining room tutorial: ' + JSON.stringify(r));
  assert(r.start.grDist > 5 && r.start.grActive, 'Grandma should start away from him and alert: ' + JSON.stringify(r));
  assert(r.afterMove === 'leap' && r.afterLeap.tut === 'swipe', 'move/leap steps did not complete: ' + JSON.stringify(r));
  assert(r.vase.broken && r.vase.stage === 'taunt', 'the swipe did not break the vase: ' + JSON.stringify(r));
  assert(['bait', 'wreck'].includes(r.afterMeow), 'the meow did not move the tutorial on: ' + JSON.stringify(r));
  assert(r.afterTab.stage === 'wreck' && !r.afterTab.hint, 'TAB did not skip the tutorial: ' + JSON.stringify(r));
  return r;
});

await test('restart_memory', async () => {
  const samples = [];
  for (let i = 0; i < 4; i++) {
    await ev(() => window.__game.restart());
    await sleep(1200);
    await ev(() => window.__game.sequence?.skip());
    await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 30000 });
    await sleep(2500);
    samples.push(await ev(async () => {
      // collect garbage first so the heap figure is live memory, not GC timing
      for (let k = 0; k < 3; k++) { window.gc?.(); await new Promise((r) => setTimeout(r, 100)); }
      const g = window.__game; const m = g.renderer.info.memory;
      // the renderer counts a geometry once it has been drawn, so its total depends on what the camera happened to
      // see (the skipped intro's shots vary): draw one frame without frustum culling (through the composer, so no
      // new shader variants), then compare with the geometries the scene actually holds
      const culled = []; g.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
      g.post.render(g.scene, g.camera, 0.016);
      for (const o of culled) o.frustumCulled = true;
      // reachable from the scene, shown or not (a broken prop's intact mesh is hidden, not removed): anything else
      // the GPU still holds was dropped without dispose()
      const inScene = new Set();
      g.scene.traverse((o) => { if (o.geometry) inScene.add(o.geometry); });
      let meshes = 0; g.scene.traverse((o) => { if (o.isMesh) meshes++; });
      return { geo: m.geometries, outside: m.geometries - inScene.size, tex: m.textures, programs: g.renderer.info.programs?.length ?? -1, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1, items: g.destruction.items.length,
        meshes, broken: g.destruction.items.filter((i) => i.broken).length, debris: g.destruction.debris.length, state: g.state, stage: g.director.stage };
    }));
  }
  const [a, , c, d] = samples;
  // geometries on the GPU but no longer in the scene (= leaked by earlier worlds) must not grow restart to restart
  assert(d.outside <= a.outside + 10, 'geometries leak across restarts (on the GPU, not in the scene): ' + samples.map((s) => `${s.geo}-${s.geo - s.outside}`));
  assert(d.tex <= c.tex + 4, 'textures keep growing across restarts: ' + samples.map((s) => s.tex));
  assert(d.programs <= c.programs + 2, 'shader programs keep growing: ' + samples.map((s) => s.programs));
  // sampled after forced GC (--expose-gc): live heap, so a retained old world would show up here
  assert(d.heapMB < 0 || d.heapMB <= a.heapMB * 1.2 + 10, 'JS heap keeps growing: ' + samples.map((s) => s.heapMB));
  return { samples };
});

await test('quit_to_menu_and_play', async () => {
  // Pause → Main menu (world rebuilt behind the menu) → Play → skip the intro → playing again, through the real buttons
  const r0 = await run(`g.pause(); await sleep(150); return { state: g.state, screen: g.ui.current };`);
  assert(r0.state === 'paused' && r0.screen === 'pause', 'pause screen not shown: ' + JSON.stringify(r0));
  await page.getByRole('button', { name: 'Main menu' }).first().click();
  const menu = await page.waitForFunction(() => window.__game.state === 'menu' && window.__game.ui.current === 'menu', null, { timeout: 20000 }).then(() => true, () => false);
  assert(menu, 'Main menu did not return to the title screen');
  await page.getByRole('button', { name: 'Play' }).click();
  const cine = await page.waitForFunction(() => window.__game.state === 'cinematic', null, { timeout: 10000 }).then(() => true, () => false);
  assert(cine, 'Play did not start the intro');
  await page.keyboard.press('Space');
  const play = await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 10000 }).then(() => true, () => false);
  assert(play, 'skipping the intro did not reach play');
  return await run(`return { state: g.state, stage: g.director.stage, score: g.score.score, broken: g.destruction.items.filter((i) => i.broken).length };`);
});

await test('refresh', async () => {
  await page.reload();
  const ok = await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 }).then(() => true, () => false);
  assert(ok, 'game did not boot again after a refresh');
  await sleep(1500);
  return await ev(() => ({ state: window.__game.state, items: window.__game.destruction.items.length, fps: Math.round(window.__game._fps) }));
});

await test('achievements_unlock', async () => {
  // 16 achievements (session 5): an unlock shows a card, is saved in localStorage and listed for the run.  Earlier
  // probes unlock some, so start from empty storage: clear it and reload (the game reads it once, at boot).
  await ev(() => { try { localStorage.removeItem('badomen.achievements'); } catch (_) { /* blocked */ } });
  await page.goto(base + '?debug&autostart&skipintro');
  await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
  await sleep(1000);
  const r = await run(`
    const before = g.achievements.unlocked.size;
    const vase = g.destruction.get('tut_vase');
    if (!vase || vase.broken) throw new Error('no intact tutorial vase in a fresh world');
    g.destruction.breakIt(vase, 'cat_swipe');
    let card = null; const t0 = performance.now();
    while (performance.now() - t0 < 3000) {
      const el = g.ui.$('hAch');
      if (!el.classList.contains('hidden')) { card = el.querySelector('.name').textContent; break; }
      await sleep(30);
    }
    let stored = null; try { stored = JSON.parse(localStorage.getItem('badomen.achievements') || '[]'); } catch (_) { /* blocked */ }
    const again = g.achievements.unlock('vase'); // the same achievement twice in one run: a no-op
    return { before, card, run: [...g.achievements.run], fresh: [...g.achievements.fresh], stored, again };`);
  assert(r.before === 0, 'achievements left over after clearing the storage: ' + r.before);
  assert(r.run.includes('vase') && r.fresh.includes('vase'), 'breaking the vase did not unlock "Bad Omen": ' + JSON.stringify(r));
  assert(r.card === 'Bad Omen', 'no unlock card: ' + JSON.stringify(r));
  assert(r.stored?.includes('vase'), 'the unlock was not saved: ' + JSON.stringify(r));
  assert(r.again === false, 'the same achievement unlocked twice in one run');
  return r;
});

await test('ending_plays_through', async () => {
  // the finale's ending (session 5), not skipped (skip_finale_cutscene covers that): the garden at dawn, Grandma's
  // tantrum brings the last beams down, the crane shot and THE END card, then the results with the run's achievements
  await run(`
    g.granny.setState('chase'); g.score.ruin = Math.max(g.score.ruin, 70); g.rage.add(100);
    if (g.setPieces.count < 2) { g.setPieces.done.SP01 = true; g.setPieces.done.SP02 = true; }
    if (g.director.stage !== 'finale') g.director.stage = 'wreck';`);
  await page.waitForFunction(() => window.__game.setPieces.state.finaleUnlocked, null, { timeout: 10000 });
  const r = await run(`
    const D = g.destruction, spawn = D.spawnDebris;
    let beams = 0;
    D.spawnDebris = function (...a) { if (g.director.stage === 'outro') beams++; return spawn.apply(this, a); };
    g.setPieces.trigger('SP04', 'granny_throw');
    const seen = { outro: false, tantrum: false, endCard: false, dawn: 0 };
    let bg0 = null; const t0 = performance.now();
    while (g.state !== 'results' && performance.now() - t0 < 60000) {
      if (g.director.stage === 'outro') {
        if (!seen.outro) { seen.outro = true; bg0 = g.scene.background.clone(); }
        if (g.granny.currentName === 'Tantrum') seen.tantrum = true;
        if (!g.ui.$('endCard').classList.contains('hidden')) seen.endCard = true;
        const b = g.scene.background; seen.dawn = Math.max(seen.dawn, +Math.hypot(b.r - bg0.r, b.g - bg0.g, b.b - bg0.b).toFixed(3));
      }
      await sleep(50);
    }
    D.spawnDebris = spawn;
    return { state: g.state, ...seen, beams, secs: +((performance.now() - t0) / 1000).toFixed(1), ach: g.ui.$('rAch').textContent, run: [...g.achievements.run] };`);
  assert(r.state === 'results', 'the ending did not reach the results: ' + JSON.stringify(r));
  assert(r.outro && r.tantrum && r.endCard, 'ending beats missing: ' + JSON.stringify(r));
  assert(r.dawn > 0.1, 'no dawn over the garden: ' + JSON.stringify(r));
  assert(r.beams >= 3, "Grandma's tantrum did not bring the last beams down: " + JSON.stringify(r));
  assert(/Achievements \d+ \/ 16/.test(r.ach) && r.ach.includes('Bad Omen') && r.ach.includes('Roof? What Roof?'), 'results achievements line: ' + r.ach);
  return r;
});

await test('achievements_persist', async () => {
  // after a reload, the title screen's Achievements screen (the real button) lists what was earned above
  await page.goto(base + '?debug');
  await page.waitForFunction(() => window.__game?.state === 'menu' && window.__game.ui.current === 'menu', null, { timeout: 60000 });
  await page.locator('#menu button[data-act="achievements"]').click();
  await page.waitForFunction(() => window.__game.ui.current === 'achievements', null, { timeout: 5000 });
  const r = await ev(() => ({
    count: document.getElementById('achCount').textContent,
    got: [...document.querySelectorAll('#achList .ach.got .n')].map((e) => e.textContent),
    all: document.querySelectorAll('#achList .ach').length,
    stored: (() => { try { return JSON.parse(localStorage.getItem('badomen.achievements') || '[]'); } catch (_) { return null; } })(),
  }));
  await page.locator('#achievements button[data-act="back"]').click();
  const back = await page.waitForFunction(() => window.__game.ui.current === 'menu', null, { timeout: 5000 }).then(() => true, () => false);
  assert(r.all === 16, 'the Achievements screen should list all 16: ' + r.all);
  assert(r.got.includes('Bad Omen') && r.got.includes('Roof? What Roof?'), 'earned achievements not listed after a reload: ' + JSON.stringify(r));
  assert(r.count === `${r.got.length} / 16` && r.stored?.length === r.got.length, 'count / storage mismatch: ' + JSON.stringify(r));
  assert(back, 'Back did not return to the menu');
  return { ...r, back };
});

await test('granny_never_stuck', async () => {
  // playtest 5: "Grandma gets stuck at some places; she should never get stuck" (seen behind the living-room sofa,
  // searching for Komur on its other side).  Measures, per trial, the longest time she spends trying to walk without
  // getting 0.3 m anywhere: the pocket from the screenshot, a sofa knocked loose and shoved into the gap,
  // destinations inside furniture, and a soak of walks across a wrecked ground floor.
  await page.goto(base + '?debug&autostart&skipintro');
  await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
  await sleep(1500);
  const r = await run(`
    const gr = g.granny, D = g.destruction;
    g.director.stage = 'wreck'; g.director.firstCollateral = true;
    gr.catchCd = 1e9; gr.throwCd = 1e9; gr.swingCd = 1e9; // walking only
    // Komur out of her sight (upstairs study) so nothing but the destination drives her
    const park = () => { g.cat.teleport(new V(-4.6, 3.22, -2.9), 0); g.cat.invuln = 99; };
    park();
    let relocations = 0;
    g.events.on('grannyUnstuck', () => relocations++);
    const trying = () => {
      if (gr.walking !== undefined) return gr.walking;
      if (gr.state === 'investigate') return !!gr.noiseTarget && !gr.lookT;
      if (gr.state === 'search') return gr.searchPhase === 'goto_last' || (gr.searchPhase === 'spots' && !gr.crouching);
      return gr.state === 'scriptMove' || gr.state === 'patrol';
    };
    // one walk: from -> to, driven by a state ('search' = she lost him at 'to'; 'investigate' = a noise at 'to')
    const trial = async (name, from, to, how = 'investigate', limit = 13) => {
      park();
      gr.teleport(from.clone());
      gr.setState('patrol'); await waitG(0.1);
      if (how === 'search') { gr.lastSeen = to.clone(); gr.lastSeenT = g.time - 1; gr.setState('search'); }
      else { gr.noiseTarget = to.clone(); gr.lookT = 0; gr.setState('investigate'); }
      const t0 = g.time;
      let anchor = gr.position.clone(), anchorT = g.time, maxStill = 0, at = null;
      while (g.time - t0 < limit && !frozen()) {
        await sleep(40);
        if (!trying() || gr.position.distanceTo(anchor) > 0.3) { anchor.copy(gr.position); anchorT = g.time; }
        if (g.time - anchorT > maxStill) { maxStill = g.time - anchorT; at = gr.position.toArray().map((v) => +v.toFixed(2)); }
        if (gr.state !== how) break; // she arrived and looked around, or gave this destination up
      }
      return { name, maxStill: +maxStill.toFixed(2), stuckAt: maxStill > 1.5 ? at : undefined, end: gr.position.toArray().map((v) => +v.toFixed(1)), state: gr.state, t: +(g.time - t0).toFixed(1) };
    };
    const out = [];
    // 1. the screenshot: between the sofa's seat and the hearth, Komur last seen behind the sofa's back
    out.push(await trial('pocket_search', new V(5.35, 0, 2.7), new V(3.3, 0, 2.4), 'search'));
    out.push(await trial('pocket_noise', new V(5.35, 0, 2.7), new V(3.2, 0, 2.0)));
    out.push(await trial('pocket_back', new V(3.2, 0, 2.2), new V(5.4, 0, 2.8)));
    // ...and Komur last seen up on the sofa's back / the middle of the dining table: she can't get within a metre
    // (the old code pressed into the furniture until the 6 s search timeout)
    out.push(await trial('sofa_back_search', new V(5.2, 0, 2.6), new V(3.82, 0.95, 2.4), 'search'));
    const tbl = D.get('dining_table')?.group.position;
    if (tbl) out.push(await trial('table_top_search', new V(tbl.x + 1.5, 0, tbl.z - 1.8), new V(tbl.x, 0.78, tbl.z), 'search'));
    // wedged into the hearth's corner (shoved there): she must get herself out
    out.push(await trial('wedged_hearth', new V(6.6, 0, 1.1), new V(3.0, 0, -2.0)));
    // 2. the sofa knocked loose and shoved toward the hearth (it no longer counts as a fixture)
    const sofa = D.get('living_sofa');
    if (sofa && !sofa.broken) {
      D.knockLoose(sofa);
      sofa.body?.applyImpulse({ x: 160, y: 0, z: 60 }, true);
      sofa.body?.applyTorqueImpulse({ x: 0, y: 70, z: 0 }, true);
      await waitG(2.0);
    }
    out.push(await trial('loose_sofa_a', new V(5.9, 0, 0.9), new V(5.2, 0, 3.7)));
    out.push(await trial('loose_sofa_b', new V(5.2, 0, 3.7), new V(3.0, 0, 1.0)));
    out.push(await trial('loose_sofa_search', new V(5.6, 0, 3.6), new V(3.4, 0, 2.6), 'search'));
    // 3. destinations she cannot stand on: inside furniture
    for (const id of ['dining_table', 'living_piano', 'kitchen_counter_n', 'kitchen_table', 'living_bookcase']) {
      const it = D.get(id); if (!it || it.broken) continue;
      const c = it.group.position.clone(); c.y = 0;
      const n = gr.nav.nearest(c, { requireLos: false });
      const start = n.pos.clone().add(new V(1.5, 0, 0.8));
      out.push(await trial('inside_' + id, gr.nav.nearest(start, { requireLos: false }).pos.clone(), c));
    }
    // 4. a wrecked ground floor (loose furniture, heavy debris), then walks between rooms
    for (const p of [[4.2, 0.6, -0.6], [-3.6, 0.6, -2.4], [1.0, 0.6, 1.2], [-4.4, 0.6, 2.6], [4.6, 0.6, 3.0]]) { D.blast(new V(...p), 3.2, 6, 'granny_charge', { damage: 60, up: 0.6 }); await waitG(0.4); }
    await waitG(3.0);
    const spots = gr.nav.list.filter((n) => n.pos.y < 1 && !['yard', 'conservatory'].includes(n.room) && !gr.nav.disabled.has(n.id));
    for (let i = 0; i < 10; i++) {
      const a = spots[(i * 7 + 3) % spots.length].pos, b = spots[(i * 11 + 5) % spots.length].pos;
      if (a.distanceTo(b) < 3) continue;
      out.push(await trial('wreck_' + i, a.clone(), b.clone().add(new V(0.3, 0, -0.2)), i % 3 === 0 ? 'search' : 'investigate'));
    }
    return { worst: Math.max(...out.map((o) => o.maxStill)), relocations, trials: out };`);
  const bad = r.trials.filter((t) => t.maxStill > 3.6);
  assert(bad.length === 0, 'Grandma stood stuck (> 3.6 s trying to walk without getting anywhere): ' + JSON.stringify(bad));
  return { worst: r.worst, relocations: r.relocations, n: r.trials.length, trials: r.trials.map((t) => `${t.name}:${t.maxStill}`).join(' ') };
});

await test('console_clean', async () => {
  const errs = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/.test(e));
  assert(errs.length === 0, `${errs.length} console errors: ${errs.slice(0, 3).join(' | ')}`);
  return { errors: 0 };
});

await browser.close();
const passed = results.filter((r) => r.pass).length;
fs.writeFileSync(path.join(OUT, 'qa_probe.json'), JSON.stringify({ base, when: new Date().toISOString(), passed, total: results.length, results, consoleErrors }, null, 1));
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
