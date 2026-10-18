// Clip review: plays named Komur clips in place under a 3/4 camera and writes a contact sheet per clip
// (test-results/clips/<Clip>.png).  Dev tool.
// Usage: node scripts/capture_clips.mjs [baseUrl] [--clips LieDown,Loaf,Sniff] [--fps 8] [--out dir]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', 'test-results/clips'));
const clips = arg('--clips', 'LieDown,Loaf,Sniff,ChaseTail,Nudge,Groom').split(',');
const fps = Number(arg('--fps', '8'));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
await page.goto(base + '?debug&autostart&skipintro&noauto');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
const cdp = await context.newCDPSession(page);
for (const name of clips) {
  const dur = await page.evaluate((name) => {
    const g = window.__game; const V = g.cat.position.constructor;
    g.granny.setState('scripted'); g.granny.teleport(new V(-8.5, 0, -15));
    g.cat.teleport(new V(1.5, 0.02, 6.4), 2.6);
    g.cat.mode = 'cinematic'; // freeze the controller: only the clip drives the pose
    g.cat.play('Idle', 0);
    const c = g.cat.position;
    g.followCam.cinematic = { pos: new V(c.x + 1.15, c.y + 0.75, c.z + 1.1), look: new V(c.x, c.y + 0.22, c.z), fov: 45, snap: true };
    const a = g.cat.clips[name];
    return a ? a.duration : 0;
  }, name);
  if (!dur) { console.log('missing clip', name); continue; }
  await page.waitForTimeout(500);
  const frames = [];
  const onFrame = async (f) => { frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) { /* closed */ } };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 });
  const playFor = Math.max(dur, 1.0) + 0.4;
  await page.evaluate(async ([name, playFor]) => {
    const g = window.__game;
    g.cat.play(name, 0.1, { once: !['Loaf', 'ChaseTail', 'Walk', 'Trot', 'Gallop', 'Sneak'].includes(name), interruptAfter: 0 });
    const t0 = g.time; while (g.time - t0 < playFor) await new Promise((r) => setTimeout(r, 15));
  }, [name, playFor]);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(4, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(f.data, 'base64'));
    const d = i + 1 < frames.length ? frames[i + 1].t - f.t : 0.033;
    lines.push(`file '${file}'`, `duration ${Math.max(0.005, d).toFixed(4)}`);
  });
  fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
  const n = Math.min(24, Math.max(6, Math.round(playFor * fps)));
  const cols = 6, rows = Math.ceil(n / cols);
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
      '-vf', `fps=${(n / playFor).toFixed(3)},crop=560:360:200:120,scale=300:-1,tile=${cols}x${rows}`, '-frames:v', '1', path.join(OUT, `${name}.png`)]);
  } catch (e) { console.log('ffmpeg failed', e.message); }
  console.log(name, 'dur', dur.toFixed(2), 'frames', frames.length);
}
await context.close();
await browser.close();
