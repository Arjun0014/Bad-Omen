// Side-view gait review: the cat runs straight across the yard at each gait while a camera tracks it from
// the side; writes a contact sheet per gait (test-results/gaits/<name>.png) and a short mp4.  Dev tool.
// Usage: node scripts/capture_gaits.mjs [baseUrl] [--out test-results/gaits] [--only walk,run]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const oi = process.argv.indexOf('--out');
const OUT = path.resolve(oi >= 0 ? process.argv[oi + 1] : 'test-results/gaits');
const only = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1].split(',') : null; })();
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
await page.goto(base + '?debug&autostart&skipintro&noauto');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
const cdp = await context.newCDPSession(page);

// [name, keys held, seconds]  (the yard: a long clear run along +x at z = -9.5)
const runs = [
  ['walk', ['KeyD'], 3.2],
  ['sneak', ['KeyD', 'KeyC'], 3.0],
  ['run', ['KeyD', 'ShiftLeft'], 3.0],
].filter(([n]) => !only || only.includes(n));

for (const [name, keys, secs] of runs) {
  await page.evaluate(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    g.granny.setState('scripted'); g.granny.teleport(new V(-8.5, 0, -15));
    g.cat.teleport(new V(-7.5, 0.02, -9.5), Math.PI / 2);
    g.followCam.yaw = 0; g.followCam.pitch = -0.2;
    // track from the side (cinematic override follows the cat every frame)
    g.__gaitCam = () => { const c = g.cat.root.position; g.followCam.cinematic = { pos: new V(c.x - 0.4, c.y + 0.42, c.z + 2.1), look: new V(c.x + 0.15, c.y + 0.22, c.z), fov: 40, snap: true }; };
    g.__gaitTick = setInterval(g.__gaitCam, 4);
    g.__gaitCam();
  });
  await page.waitForTimeout(600);
  const frames = [];
  const onFrame = async (f) => { frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) { /* closed */ } };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 });
  await page.evaluate((ks) => { const i = window.__game.input; for (const k of ks) { i.down.add(k); i.queue.push({ code: k, t: performance.now() / 1000 }); } }, keys);
  const speeds = await page.evaluate(async (secs) => {
    const g = window.__game; const out = []; const t0 = g.time;
    while (g.time - t0 < secs) { await new Promise((r) => setTimeout(r, 100)); out.push([+(g.time - t0).toFixed(1), +Math.hypot(g.cat.vel.x, g.cat.vel.z).toFixed(2), g.cat.currentName, +(g.cat.current?.timeScale ?? 0).toFixed(2)]); }
    return out;
  }, secs);
  await page.evaluate((ks) => { const g = window.__game; for (const k of ks) g.input.down.delete(k); clearInterval(g.__gaitTick); g.followCam.cinematic = null; }, keys);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(4, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, 'base64'));
    const dur = i + 1 < frames.length ? frames[i + 1].t - f.t : 0.033;
    lines.push(`file '${file}'`, `duration ${Math.max(0.005, dur).toFixed(4)}`);
  });
  fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
  const mp4 = path.join(OUT, `${name}.mp4`);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', mp4]);
    // steady-state section: skip the first ~1.2 s (acceleration), 15 fps, 4x4 tiles
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.4', '-i', mp4, '-vf', 'fps=15,crop=520:300:220:150,scale=320:-1,tile=6x3', '-frames:v', '1', path.join(OUT, `${name}.png`)]);
  } catch (e) { console.log('ffmpeg failed', e.message); }
  console.log(name, 'frames', frames.length, 'speed samples', JSON.stringify(speeds.filter((_, i) => i % 5 === 0)));
}
await context.close();
await browser.close();
