// Rebuild the character GLBs with headless Blender (source packs are unzipped under the git-ignored work/extracted/).
// Usage: node scripts/build_assets.mjs [komur] [grandma]      (default: both)
// Env: BLENDER=<path to blender.exe> (defaults to Blender 5.2 in Program Files)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const want = process.argv.slice(2);
const jobs = want.length ? want : ['komur', 'grandma'];
const abs = (p) => path.join(ROOT, p); // Blender resolves relative output paths against the drive root: always absolute

function run(args) {
  console.log('>', path.basename(BLENDER), args.join(' '));
  const r = spawnSync(BLENDER, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  for (const line of out.split(/\r?\n/)) if (/^(EXPORTED|ACTIONS|META|GAIT|SAVED|EVENTS|Traceback|\s+File|\w*Error)/.test(line)) console.log('  ' + line);
  if (r.status !== 0 || /Traceback/.test(out)) { console.error('Blender failed'); process.exit(1); }
}

if (jobs.includes('komur')) {
  const src = abs('work/extracted/anim_somali-cat-animated-ver-12/source/SomaliCatNewMirror3.blend');
  if (!fs.existsSync(src)) { console.error('missing ' + src + ' (unzip assets_inbox/characters and animations/somali-cat-animated-ver-12.zip there)'); process.exit(1); }
  run(['-b', '-Y', '--factory-startup', '-t', '2', src, '--python', abs('tools/blender/build_komur.py'), '--',
    '--out', abs('public/assets/characters/komur.glb'), '--tex', abs('work/komur_fur.png'),
    '--save', abs('work/komur_built.blend'), '--meta', abs('src/data/komurAnims.json')]);
}
if (jobs.includes('grandma')) {
  run(['-b', '-Y', '--factory-startup', '-t', '2', '--python', abs('tools/blender/build_grandma.py'), '--',
    '--root', ROOT, '--out', 'public/assets/characters/grandma.glb', '--events', 'src/data/grandmaEvents.json']);
}
