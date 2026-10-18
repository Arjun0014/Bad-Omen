// Phones (user request): BAD OMEN on a landscape phone with real multi-touch (CDP Input.dispatchTouchEvent).  The
// title screen fits, Play starts the audio and the intro, Skip works, the stick walks and (pushed to its rim)
// gallops while a second finger turns the camera, every button acts, Pause/Resume, the tutorial skip, and turning
// the phone to portrait holds the game behind the rotate screen and resumes it unchanged.  Silent.
// Usage: node scripts/mobile_test.mjs [baseUrl] [--size 844x390]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const sizeArg = process.argv.indexOf('--size');
const [W, H] = (sizeArg >= 0 ? process.argv[sizeArg + 1] : '844x390').split('x').map(Number);
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(detail ?? '').slice(0, 260)); };
const shot = (n) => page.screenshot({ path: `test-results/mobile_${n}.png` });
// multi-touch: the fingers currently down, by id
const fingers = new Map();
const touch = async (type, changes) => {
  for (const [id, x, y] of changes) { if (type === 'touchEnd') fingers.delete(id); else fingers.set(id, { x, y, id }); }
  const pts = type === 'touchEnd' ? [...fingers.values()] : [...fingers.values()];
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' && pts.length === 0 ? [] : pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 })) });
};
const tap = async (x, y, id = 9) => { await touch('touchStart', [[id, x, y]]); await sleep(70); await touch('touchEnd', [[id, x, y]]); await sleep(60); };
const center = (sel) => ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), r.width, r.height]; }, sel);
const waitG = (s) => ev(async (secs) => { const g = window.__game; const t0 = g.time; while (g.time - t0 < secs) await new Promise((r) => setTimeout(r, 15)); }, s);

await page.goto(base);
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 120000 });
await sleep(1200);
const menu = await ev(() => {
  const btns = [...document.querySelectorAll('#menu button.bo')].map((b) => b.getBoundingClientRect());
  return { touchClass: document.documentElement.classList.contains('touch'), hq: window.__game.ui.settings.hq, lastBottom: Math.round(btns[btns.length - 1].bottom), vh: innerHeight, logoTop: Math.round(document.querySelector('#menu .logo').getBoundingClientRect().top) };
});
await shot('menu');
check('touch_mode_and_low_quality', menu.touchClass && menu.hq === false, menu);
check('menu_fits_the_screen', menu.lastBottom <= menu.vh && menu.logoTop >= 0, menu);

// Play by touch: audio starts, intro runs, Skip by touch
const [px, py] = await center('#menu button[data-act="play"]');
await tap(px, py);
await page.waitForFunction(() => window.__game.state === 'cinematic', null, { timeout: 20000 });
await sleep(1500);
const skipVisible = await ev(() => { const s = document.querySelector('#skip'); return !s.classList.contains('hidden') && getComputedStyle(s.querySelector('.touchOnly')).display !== 'none'; });
await shot('intro');
const [sx, sy] = await center('#skip');
await tap(sx, sy);
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 15000 }).catch(() => {});
const afterSkip = await ev(() => ({ state: window.__game.state, audio: window.__game.audio.ctx?.state, music: window.__game.audio.music.current }));
check('play_and_skip_by_touch', skipVisible && afterSkip.state === 'playing', { skipVisible, ...afterSkip });
check('audio_running_after_tap', afterSkip.audio === 'running', afterSkip);
await sleep(600);
await ev(() => { const g = window.__game; g.granny.setState('scripted'); g.granny.teleport(new g.cat.position.constructor(-6, 0, -9)); });
const hud = await ev(() => ({ touchShown: !document.querySelector('#touch').classList.contains('hidden'), skipTut: !document.querySelector('#touch .t-skiptut').classList.contains('hidden'), prompt: window.__game.ui._prompt, obj: window.__game.ui._obj }));
await shot('play');
check('touch_controls_shown_with_touch_prompts', hud.touchShown && hud.skipTut && /LEFT THUMB/.test(hud.prompt ?? ''), hud);

// stick forward while a second finger turns the camera (both at once)
const s0 = await ev(() => { const g = window.__game; return { p: g.cat.position.clone(), yaw: g.followCam.yaw }; });
const lx = Math.round(W * 0.2), ly = Math.round(H * 0.72), rx = Math.round(W * 0.66), ry = Math.round(H * 0.45);
await touch('touchStart', [[1, lx, ly]]);
await touch('touchStart', [[2, rx, ry]]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[1, lx, ly - 4 * i], [2, rx + 9 * i, ry]]); await sleep(30); }
await waitG(1.0);
const s1 = await ev(() => { const g = window.__game; return { p: g.cat.position.clone(), yaw: g.followCam.yaw, speed: Math.hypot(g.cat.vel.x, g.cat.vel.z), stick: { ...g.input.stick } }; });
const walked = Math.hypot(s1.p.x - s0.p.x, s1.p.z - s0.p.z);
check('stick_walks_and_look_turns_together', walked > 0.5 && Math.abs(s1.yaw - s0.yaw) > 0.15 && s1.speed < 2.5, { walked: +walked.toFixed(2), dyaw: +(s1.yaw - s0.yaw).toFixed(2), speed: +s1.speed.toFixed(2), stick: s1.stick });
// to the rim: gallop (a clear run: the open yard, the camera behind him)
await ev(() => { const g = window.__game; g.cat.teleport(new g.cat.position.constructor(0, 0.02, -8.5), Math.PI); g.followCam.yaw = 0; g.followCam.cut?.(g.cat); });
await touch('touchMove', [[1, lx, ly - 70]]);
await waitG(1.0);
const gal = await ev(() => { const g = window.__game; return { speed: +Math.hypot(g.cat.vel.x, g.cat.vel.z).toFixed(2), shift: g.input.down.has('ShiftLeft'), ring: document.querySelector('#touch .stick').classList.contains('gallop') }; });
check('stick_rim_gallops', gal.speed > 3.0 && gal.shift && gal.ring, gal);
await touch('touchEnd', [[2, rx + 90, ry]]);
await touch('touchEnd', [[1, lx, ly - 70]]);
await waitG(0.6);
const rel = await ev(() => { const g = window.__game; return { stick: { ...g.input.stick }, shift: g.input.down.has('ShiftLeft'), hidden: document.querySelector('#touch .stick').classList.contains('hidden'), speed: +Math.hypot(g.cat.vel.x, g.cat.vel.z).toFixed(2) }; });
check('release_stops', rel.stick.x === 0 && rel.stick.y === 0 && !rel.shift && rel.hidden && rel.speed < 0.6, rel);

// the buttons
const events = await ev(() => { window.__ev = []; const g = window.__game; for (const n of ['catJump', 'catSwipe', 'catTaunt', 'catPounce', 'catInteract']) g.events.on(n, () => window.__ev.push(n)); return true; });
void events;
for (const sel of ['.t-jump', '.t-swipe']) { const [bx, by] = await center(`#touch ${sel}`); await tap(bx, by); await waitG(0.7); }
let [bx, by] = await center('#touch .t-meow'); await tap(bx, by); await waitG(0.9);
[bx, by] = await center('#touch .t-pounce'); await tap(bx, by); await waitG(1.0);
[bx, by] = await center('#touch .t-hide'); await tap(bx, by); await waitG(0.4);
const fired = await ev(() => window.__ev);
check('buttons_act', ['catJump', 'catSwipe', 'catTaunt', 'catPounce', 'catInteract'].every((n) => fired.includes(n)), fired);
[bx, by] = await center('#touch .t-gallop'); await tap(bx, by);
const lit = await ev(() => document.querySelector('#touch .t-gallop').classList.contains('lit'));
await tap(bx, by);
const unlit = await ev(() => !document.querySelector('#touch .t-gallop').classList.contains('lit'));
check('gallop_toggle', lit && unlit, { lit, unlit });

// pause button, resume
[bx, by] = await center('#touch .t-pause'); await tap(bx, by);
await sleep(300);
const paused = await ev(() => ({ state: window.__game.state, screen: window.__game.ui.current, touchHidden: document.querySelector('#touch').classList.contains('hidden') }));
await shot('pause');
const [rbx, rby] = await center('#pause button[data-act="resume"]');
await tap(rbx, rby);
await sleep(300);
const resumed = await ev(() => window.__game.state);
check('pause_and_resume_by_touch', paused.state === 'paused' && paused.screen === 'pause' && paused.touchHidden && resumed === 'playing', { paused, resumed });

// turning the phone: portrait holds the game behind the rotate screen, landscape carries on
const before = await ev(() => { const g = window.__game; return { t: g.time, score: g.score.score, p: g.cat.position.clone(), stage: g.director.stage }; });
await page.setViewportSize({ width: H, height: W });
await sleep(1200);
const portrait = await ev(() => { const g = window.__game; return { t: g.time, rotate: getComputedStyle(document.querySelector('#rotate')).display, cls: document.documentElement.classList.contains('portrait'), audio: g.audio.ctx?.state, state: g.state }; });
await shot('portrait');
await page.setViewportSize({ width: W, height: H });
await sleep(1200);
const back = await ev(() => { const g = window.__game; return { t: g.time, rotate: getComputedStyle(document.querySelector('#rotate')).display, score: g.score.score, p: g.cat.position.clone(), stage: g.director.stage, state: g.state, audio: g.audio.ctx?.state }; });
const held = Math.abs(portrait.t - before.t) < 0.25;
check('portrait_holds_the_game', portrait.rotate === 'flex' && portrait.cls && held && portrait.audio !== 'running', { ...portrait, dt: +(portrait.t - before.t).toFixed(2) });
const moved = Math.hypot(back.p.x - before.p.x, back.p.z - before.p.z);
check('landscape_resumes_unchanged', back.rotate === 'none' && back.state === 'playing' && back.t > portrait.t && back.score === before.score && back.stage === before.stage && moved < 0.3 && back.audio === 'running', { ...back, moved: +moved.toFixed(2) });

// skip the tutorial by touch
[bx, by] = await center('#touch .t-skiptut'); await tap(bx, by); await sleep(300);
const skipped = await ev(() => ({ stage: window.__game.director.stage, btn: document.querySelector('#touch .t-skiptut').classList.contains('hidden') }));
check('skip_tutorial_by_touch', skipped.stage === 'wreck', skipped);
await shot('wreck');
check('no_console_errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed (${W}x${H})`);
process.exit(failed ? 1 : 0);
