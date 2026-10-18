// Visual tour: screenshots from fixed viewpoints and gameplay cameras (dev tool).
// Usage: node scripts/tour.mjs [baseUrl] [--prefix name]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const pi = process.argv.indexOf('--prefix');
const prefix = pi >= 0 ? process.argv[pi + 1] : 'tour';
fs.mkdirSync('test-results/tour', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base + '?debug&autostart&skipintro');
await page.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 60000 });
await page.waitForTimeout(1500);

// [name, catPos, catYaw, camYaw, camPitch]  — gameplay follow-camera views
const views = [
  ['foyer', [-4.5, 0.02, 3.6], Math.PI, 0, -0.3],
  ['kitchen', [-3.4, 0.02, -0.8], Math.PI, 0.5, -0.3],
  ['hall_stairs', [-1.1, 0.02, 3.8], Math.PI, 0.2, -0.2],
  ['living', [2.2, 0.02, 2.8], 2.4, -0.9, -0.25],
  ['dining', [2.6, 0.02, -0.5], Math.PI / 2, -Math.PI / 2, -0.35],
  ['gallery', [1.9, 3.22, 3.5], Math.PI, 0, -0.3],
  ['bedroom', [-2.8, 3.22, 2.6], -Math.PI / 2, Math.PI / 2, -0.3],
  ['study', [-2.8, 3.22, -2.2], -Math.PI / 2, Math.PI / 2, -0.3],
  ['yard', [-4.5, 0.02, -7.0], Math.PI, 0.3, -0.2],
  ['yard_back', [2.0, 0.02, -12.0], 0, Math.PI, -0.2],
  ['conservatory', [8.2, 0.02, 2.6], 2.4, -2.2, -0.22],
  ['library', [9.6, 0.02, -1.8], Math.PI, 0.2, -0.2],
  ['yard_east', [9.6, 0.02, -7.5], Math.PI, Math.PI * 0.85, -0.2],
];
for (const [name, p, yaw, cy, cp] of views) {
  await page.evaluate(([p, yaw, cy, cp]) => {
    const g = window.__game; const V = g.cat.position.constructor;
    g.granny.setState('scripted'); g.granny.teleport(new V(-5.2, 0, -3.3));
    g.cat.teleport(new V(...p), yaw);
    g.followCam.yaw = cy; g.followCam.pitch = cp;
    g.followCam.smoothTarget.copy(g.cat.position);
    g.followCam.curDist = 2.5;
  }, [p, yaw, cy, cp]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/tour/${prefix}_${name}.png` });
  console.log('shot', name);
}
await browser.close();
