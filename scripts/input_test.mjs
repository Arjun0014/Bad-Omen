// Real-input test: trusted clicks/keys/mouse through the DOM (menu -> intro skip -> play controls).
// Usage: node scripts/input_test.mjs [baseUrl] [--headed]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const headed = process.argv.includes('--headed');
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: !headed, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
const out = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gameTime = () => page.evaluate(() => window.__game.time);
async function waitGame(sec) { const t0 = await gameTime(); while ((await gameTime()) - t0 < sec) await sleep(30); }

await page.goto(base);
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 60000 });
await page.screenshot({ path: 'test-results/input_00_menu.png' });
// menu -> controls -> back -> play (real clicks)
await page.getByRole('button', { name: 'Controls' }).click();
out.controlsShown = await page.evaluate(() => window.__game.ui.current);
await page.getByRole('button', { name: 'Back' }).first().click();
await page.getByRole('button', { name: 'Play' }).click();
await page.waitForFunction(() => window.__game?.state === 'cinematic', null, { timeout: 10000 });
out.audio = await page.evaluate(() => window.__game.audio.ctx?.state);
await sleep(1500);
await page.keyboard.press('Space'); // skip intro
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 10000 });
out.afterSkip = await page.evaluate(() => ({ state: window.__game.state, locked: window.__game.input.locked, stage: window.__game.director.stage }));
// click canvas to (re)acquire pointer lock, then mouse-look
await page.mouse.click(640, 360);
await sleep(300);
const yaw0 = await page.evaluate(() => window.__game.followCam.yaw);
await page.mouse.move(640, 360);
// look left: from the start (mid-foyer, facing the vase table) that lines the run up with the open doorway
// into the hall; turning right pointed it at the front wall 1.8 m away
for (let i = 0; i < 10; i++) { await page.mouse.move(640 - (i + 1) * 30, 360); await sleep(16); }
await sleep(200);
out.mouseLook = { locked: await page.evaluate(() => window.__game.input.locked), yawDelta: +((await page.evaluate(() => window.__game.followCam.yaw)) - yaw0).toFixed(3) };
// run forward with W + sprint.  Headless pointer lock sometimes reports movement relative to the lock centre (one
// run turned 4.6 rad instead of 0.78), so aim the camera at the open doorway into the hall explicitly first.
await page.evaluate(() => { window.__game.followCam.yaw = -1.446; });
const p0 = await page.evaluate(() => window.__game.cat.position.toArray());
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await waitGame(0.8);
const sp = await page.evaluate(() => Math.hypot(window.__game.cat.vel.x, window.__game.cat.vel.z));
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => window.__game.cat.position.toArray());
out.run = { dist: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2), sprintSpeed: +sp.toFixed(2) };
// jump with real Space
await waitGame(0.4);
await page.keyboard.down('Space');
let maxY = 0; const y0 = p1[1];
for (let i = 0; i < 20; i++) { await sleep(20); maxY = Math.max(maxY, await page.evaluate(() => window.__game.cat.position.y)); }
await page.keyboard.up('Space');
out.jump = +(maxY - y0).toFixed(2);
// swipe (left click) + meow (F) + pounce (right click) events
const evs = await page.evaluate(() => { window.__evs = []; for (const n of ['catSwipe', 'catTaunt', 'catPounce']) window.__game.events.on(n, () => window.__evs.push(n)); return true; });
void evs;
await waitGame(0.6);
await page.mouse.down({ button: 'left' }); await sleep(40); await page.mouse.up({ button: 'left' });
await waitGame(0.5);
await page.keyboard.press('KeyF');
await waitGame(0.5);
await page.mouse.down({ button: 'right' }); await sleep(40); await page.mouse.up({ button: 'right' });
await waitGame(0.8);
out.actions = await page.evaluate(() => window.__evs);
// pause with Escape (pointer lock may swallow the first Esc; either path must pause)
await page.keyboard.press('Escape');
await sleep(300);
let st = await page.evaluate(() => window.__game.state);
if (st !== 'paused') { await page.keyboard.press('Escape'); await sleep(300); st = await page.evaluate(() => window.__game.state); }
out.pause = st;
await page.screenshot({ path: 'test-results/input_01_pause.png' });
await page.getByRole('button', { name: 'Resume' }).click();
await sleep(300);
out.resume = await page.evaluate(() => window.__game.state);
// hold E on the chandelier rope (scratch target) -> primed
await page.evaluate(() => { const g = window.__game; const V = g.cat.position.constructor; g.granny.setState('scripted'); g.granny.teleport(new V(-5.2, 0, -3.3)); g.cat.teleport(new V(2.32, 3.22, -0.5), Math.PI / 2); });
await waitGame(0.3);
out.scratchPrompt = await page.evaluate(() => document.querySelector('#hPrompt').innerText);
await page.keyboard.down('KeyE');
await waitGame(1.8);
await page.keyboard.up('KeyE');
out.ropePrimed = await page.evaluate(() => window.__game.setPieces.state.sp01Primed);
// hide under the dining table with E, then leave by moving
await page.evaluate(() => { const g = window.__game; const V = g.cat.position.constructor; g.cat.teleport(new V(4.4, 0.02, -0.5), 0); });
await waitGame(0.3);
out.hidePrompt = await page.evaluate(() => document.querySelector('#hPrompt').innerText);
await page.keyboard.press('KeyE');
await waitGame(0.3);
out.hidden = await page.evaluate(() => window.__game.cat.hidden);
await page.keyboard.down('KeyD'); await waitGame(0.3); await page.keyboard.up('KeyD');
out.unhidden = await page.evaluate(() => !window.__game.cat.hidden);
// mute toggle
await page.keyboard.press('KeyM');
out.muted = await page.evaluate(() => window.__game.audio.muted);
await page.keyboard.press('KeyM');
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
const ok = out.afterSkip.state === 'playing' && out.mouseLook.locked && Math.abs(out.mouseLook.yawDelta) > 0.2
  && out.run.dist > 1.5 && out.run.sprintSpeed > 3.0 && out.jump > 0.6 && out.actions.includes('catSwipe') && out.actions.includes('catTaunt') && out.actions.includes('catPounce')
  && out.pause === 'paused' && out.resume === 'playing' && out.muted === true && out.ropePrimed && out.hidden && out.unhidden && errors.length === 0;
console.log(ok ? 'INPUT TEST PASS' : 'INPUT TEST FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
