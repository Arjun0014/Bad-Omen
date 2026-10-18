// The recorded music (MusicDirector): menu waltz after the first click, chase music when Grandma hunts Komur, her
// MELTDOWN music at rage 90, back again — each track resuming where it left off, switches on the beat, no flapping,
// and no gap or doubled level across a crossfade (measured on the music bus with an AnalyserNode).  Silent.
// Usage: node scripts/music_test.mjs [baseUrl]
import { chromium } from 'playwright';

const base = (process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(detail).slice(0, 300)); };

await page.goto(base);
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 90000 });
await page.waitForFunction(() => window.__game.audio.music.ready, null, { timeout: 60000 });
const before = await ev(() => ({ ctx: window.__game.audio.ctx?.state ?? null, current: window.__game.audio.music.current }));
// a click on the title screen (not a button): the first gesture starts the audio and the waltz
await page.mouse.click(640, 690);
await sleep(2500);
const menu = await ev(() => {
  const a = window.__game.audio, m = a.music;
  // level meter on the music bus, sampled every 40 ms
  const an = a.ctx.createAnalyser(); an.fftSize = 2048; a.musicBus.connect(an);
  const buf = new Float32Array(an.fftSize);
  window.__lv = [];
  window.__lvTimer = setInterval(() => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; window.__lv.push([a.ctx.currentTime, Math.sqrt(s / buf.length)]); }, 40);
  return { ctx: a.ctx.state, current: m.current, pos: +m._posAt(m.deck, a.ctx.currentTime).toFixed(2) };
});
check('menu_waltz_after_first_click', before.current === null && menu.ctx === 'running' && menu.current === 'main' && menu.pos > 0.5, { before, menu });

// Play, skip the intro
await page.click('#menu button[data-act="play"]');
await page.waitForFunction(() => window.__game.state === 'cinematic', null, { timeout: 20000 });
await sleep(800);
await page.keyboard.press('Space');
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 20000 });
await sleep(1500);
// no voice lines from here on: their ducking would move the level the crossfade check measures
await ev(() => { const a = window.__game.audio; a.voice = () => 0; a.duck.gain.cancelScheduledValues(0); a.duck.gain.value = 1; });
const intro = await ev(() => ({ current: window.__game.audio.music.current }));
check('waltz_continues_into_play', intro.current === 'main', intro);

// a chase: Grandma hunts him (no catching), for 7 s
const chase = await ev(async () => {
  const g = window.__game, m = g.audio.music, gr = g.granny, V = g.cat.position.constructor;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  g.director.stage = 'bait'; gr.catchCd = 1e9; gr.throwCd = 1e9;
  const mainPos = +m._posAt(m.deck, g.audio.ctx.currentTime).toFixed(2);
  gr.teleport(new V(g.cat.position.x + 6, 0, g.cat.position.z), 0);
  const t0 = performance.now();
  let switched = null;
  while (performance.now() - t0 < 7000) {
    if (!['chase', 'spotted'].includes(gr.state)) { gr.lastSeen = g.cat.position.clone(); gr.lastSeenT = g.time; gr.setState('chase'); }
    if (!switched && m.current === 'chase') switched = +((performance.now() - t0) / 1000).toFixed(2);
    await sleep(50);
  }
  const entry = m.log.filter((e) => e.to === 'chase').pop();
  return { mainPos, switched, entry, savedMain: +m.pos.main.toFixed(2), current: m.current };
});
check('chase_music_starts', chase.current === 'chase' && chase.switched !== null && chase.switched < 3.5, chase);
check('chase_enters_at_its_20s_part', chase.entry && Math.abs(chase.entry.off - 20.57) < 0.05, chase.entry);
check('waltz_position_saved', Math.abs(chase.savedMain - chase.mainPos) < 3, { mainPos: chase.mainPos, saved: chase.savedMain });

// the chase ends: back to the waltz where it left off (after the calm-down delay)
const calm = await ev(async () => {
  const g = window.__game, m = g.audio.music, gr = g.granny, V = g.cat.position.constructor;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  gr.setState('scripted'); gr.teleport(new V(-6.0, 0, -9.0));
  const t0 = performance.now(); let back = null;
  while (performance.now() - t0 < 12000 && back === null) { if (m.current === 'main') back = +((performance.now() - t0) / 1000).toFixed(2); await sleep(50); }
  const entry = m.log.filter((e) => e.to === 'main').pop();
  return { back, entry, chasePos: +m.pos.chase.toFixed(2) };
});
check('waltz_resumes_after_chase', calm.back !== null && calm.back > 4 && calm.back < 11, calm);
check('waltz_resumes_at_saved_position', calm.entry && Math.abs(calm.entry.off - chase.savedMain) < 0.6, { saved: chase.savedMain, resumedAt: calm.entry?.off });

// MELTDOWN: berserk music, then back when her rage drops
const berserk = await ev(async () => {
  const g = window.__game, m = g.audio.music;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(4500); // past the dwell after the last switch
  g.rage.add(100);
  const t0 = performance.now(); let on = null;
  while (performance.now() - t0 < 5000 && on === null) { if (m.current === 'berserk') on = +((performance.now() - t0) / 1000).toFixed(2); await sleep(50); }
  g.rage.floor = 0; g.rage.value = 30;
  const t1 = performance.now(); let off = null;
  while (performance.now() - t1 < 14000 && off === null) { if (m.current !== 'berserk') off = +((performance.now() - t1) / 1000).toFixed(2); await sleep(50); }
  return { on, off, now: m.current, entry: m.log.filter((e) => e.to === 'berserk').pop() };
});
check('berserk_music_at_meltdown', berserk.on !== null && berserk.on < 2.5, berserk);
check('berserk_ends_when_rage_drops', berserk.off !== null && berserk.off > 4 && berserk.now === 'main', berserk);

// no flapping: Grandma loses and finds him every 1.5 s for 12 s
const flap = await ev(async () => {
  const g = window.__game, m = g.audio.music, gr = g.granny, V = g.cat.position.constructor;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(4500);
  const n0 = m.log.length;
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) { gr.teleport(new V(g.cat.position.x + 6, 0, g.cat.position.z), 0); gr.lastSeen = g.cat.position.clone(); gr.setState('chase'); }
    else { gr.setState('scripted'); gr.teleport(new V(-6.0, 0, -9.0)); }
    await sleep(1500);
  }
  return { switches: m.log.length - n0, log: m.log.slice(n0).map((e) => `${e.from}->${e.to}`) };
});
check('no_flapping', flap.switches <= 2, flap);

// the level across every crossfade, against both tracks' own levels around it (the tracks differ: the waltz has
// quiet bars, the chase is dense): no hole (9 dB under the quieter one) and no doubling (4 dB over the louder one)
const level = await ev(() => {
  clearInterval(window.__lvTimer);
  const lv = window.__lv, m = window.__game.audio.music;
  const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const out = [];
  for (const e of m.log) {
    if (!e.to || !e.from) continue;
    const fade = ({ null: 0, main: 1, chase: 2, berserk: 3 }[e.to] > { null: 0, main: 1, chase: 2, berserk: 3 }[e.from]) ? 0.9 : 2.4;
    const win = (a, b) => lv.filter(([t]) => t >= e.at + a && t < e.at + b).map(([, v]) => db(v));
    const pre = win(-2.0, 0), during = win(0, fade), post = win(fade + 0.3, fade + 2.3);
    if (pre.length < 10 || during.length < 5 || post.length < 10) continue;
    const lo = Math.min(med(pre), med(post)), hi = Math.max(med(pre), med(post));
    // a 200 ms window minimum: single quiet frames between notes are not a hole
    let minWin = 99;
    for (let i = 0; i + 5 <= during.length; i++) minWin = Math.min(minWin, Math.max(...during.slice(i, i + 5)));
    // doubling raises the body of the fade, not single drum hits: median against median, 90th percentile against 90th
    const p90 = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * 0.9)];
    const over = Math.max(med(during) - hi, p90(during) - Math.max(p90(pre), p90(post)));
    out.push({ sw: `${e.from}->${e.to}`, pre: +med(pre).toFixed(1), post: +med(post).toFixed(1), holeDb: +(minWin - lo).toFixed(1), overDb: +over.toFixed(1) });
  }
  return out;
});
check('crossfades_no_hole_no_doubling', level.length >= 3 && level.every((x) => x.holeDb > -9 && x.overDb < 4), level);
check('no_console_errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
