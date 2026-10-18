// Record a scripted movement showcase (video + frame strip) to review cat motion quality.  Dev tool.
// Usage: node scripts/capture_moves.mjs [baseUrl] [--out test-results/moves]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const oi = process.argv.indexOf('--out');
const OUT = path.resolve(oi >= 0 ? process.argv[oi + 1] : 'test-results/moves');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
// CDP screencast -> numbered JPEG frames (Playwright's own video recorder needs a separate ffmpeg download)
const FR = path.join(OUT, 'frames');
fs.rmSync(FR, { recursive: true, force: true });
fs.mkdirSync(FR, { recursive: true });
const cdp = await context.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) { /* closed */ }
});
await page.goto(base + '?debug&autostart&skipintro&noauto');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 });
const t0 = Date.now();
const marks = [];
const mark = (label) => marks.push({ label, t: (Date.now() - t0) / 1000 });
await page.evaluate(async () => {
  const g = window.__game; const V = g.cat.position.constructor;
  g.granny.setState('scripted'); g.granny.teleport(new V(-5.2, 0, -3.3));
  g.cat.teleport(new V(2.2, 0.02, 3.4), Math.PI); g.followCam.yaw = 0; g.followCam.pitch = -0.28;
});
const waitG = (s) => page.evaluate(async (s) => { const g = window.__game; const t0 = g.time; while (g.time - t0 < s) await new Promise((r) => setTimeout(r, 15)); }, s);
const key = (code, down) => page.evaluate(([c, d]) => { const i = window.__game.input; if (d) { i.down.add(c); i.queue.push({ code: c, t: performance.now() / 1000 }); } else i.down.delete(c); }, [code, down]);
await waitG(1.0);
mark('idle'); await waitG(0.8);
mark('trot'); await key('KeyW', true); await waitG(1.6);
mark('turn'); await key('KeyD', true); await waitG(0.7); await key('KeyD', false); await waitG(0.4);
await key('KeyW', false); await waitG(0.8);
mark('sprint windup'); await key('ShiftLeft', true); await key('KeyW', true); await waitG(1.2);
mark('drift'); await key('KeyW', false); await key('KeyS', true); await waitG(1.4);
await key('KeyS', false); await key('ShiftLeft', false); await waitG(0.8);
// leap onto the dining table
await page.evaluate(() => { const g = window.__game; const V = g.cat.position.constructor; g.cat.teleport(new V(4.4, 0.02, 1.25), Math.PI); g.followCam.yaw = -0.6; g.followCam.pitch = -0.22; });
await waitG(0.8);
mark('leap onto table'); await key('Space', true); await waitG(0.15); await key('Space', false); await waitG(1.4);
mark('hop down'); await key('KeyW', true); await waitG(1.2); await key('KeyW', false); await waitG(0.8);
// leap onto the kitchen counter
await page.evaluate(() => { const g = window.__game; const V = g.cat.position.constructor; g.cat.teleport(new V(-3.0, 0.02, -3.2), Math.PI); g.followCam.yaw = 0.9; g.followCam.pitch = -0.2; });
await waitG(0.8);
mark('leap onto counter'); await key('Space', true); await waitG(0.15); await key('Space', false); await waitG(1.4);
mark('startle'); await page.evaluate(() => window.__game.cat.react('startle')); await waitG(1.3);
mark('hiss'); await page.evaluate(() => window.__game.cat.react('hiss')); await waitG(1.4);
mark('groom'); await page.evaluate(() => window.__game.cat.play('Groom', 0.3, { once: true })); await waitG(2.0);
mark('end');
await cdp.send('Page.stopScreencast');
await context.close();
await browser.close();
// frames arrive at irregular times: write them with their timestamps, then let ffmpeg resample to 30 fps
const lines = [];
frames.forEach((f, i) => {
  const name = `f${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(FR, name), Buffer.from(f.data, 'base64'));
  const dur = i + 1 < frames.length ? frames[i + 1].t - f.t : 0.033;
  lines.push(`file '${name}'`, `duration ${Math.max(0.005, dur).toFixed(4)}`);
});
fs.writeFileSync(path.join(FR, 'list.txt'), lines.join('\n'));
const mp4 = path.join(OUT, 'moves.mp4');
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 1));
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(FR, 'list.txt'), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'fps=4,scale=320:-1,tile=6x8', '-frames:v', '1', path.join(OUT, 'strip.png')]);
} catch (e) { console.log('ffmpeg failed', e.message); }
console.log('frames', frames.length);
console.log(JSON.stringify(marks));
console.log('video', mp4);
