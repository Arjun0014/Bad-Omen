// Build-time sound-effect generation (ElevenLabs sound generation).  Key read from .env in Node only.
// Usage: node scripts/generate_sfx.mjs [--only id,id] [--dry] [--key ELEVENLABS_API_KEY]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/audio/sfx');
const MANIFEST = path.join(OUT, 'manifest.json');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

export const SFX = {
  meow_short: { text: 'A single short friendly domestic cat meow, close microphone, clean, no background', dur: 1.0 },
  meow_taunt: { text: 'A sassy drawn-out domestic cat meow, mischievous and cheeky, "mrrreow", close mic, no background noise', dur: 1.4 },
  meow_annoyed: { text: 'An annoyed cat yowl and short hiss, cartoonish, close mic, no background', dur: 1.3 },
  meow_chirp: { text: 'A happy cat chirp and trill, "brrrp", quick, close mic, clean', dur: 0.8 },
  glass_crash: { text: 'A glass window shattering into many pieces, sharp crash with tinkling shards falling on a wooden floor', dur: 1.6 },
  wood_crash: { text: 'Heavy wooden furniture breaking apart, loud splintering crack and thud of planks on a wooden floor', dur: 1.8 },
  chandelier: { text: 'A huge chandelier falls and smashes onto a wooden dining table, metal clanging, glass and crystals shattering, wood breaking', dur: 3.0 },
  collapse: { text: 'Old wooden house roof collapsing, massive timber cracking, beams falling, rumble and dust, cinematic', dur: 4.0 },
  fire_whoosh: { text: 'Fire suddenly igniting with a big whoosh, then crackling flames', dur: 2.2 },
  thunder: { text: 'Distant rolling thunder on a stormy night, deep rumble', dur: 4.0 },
  witch_cackle: { text: 'An old witch cackling wickedly, short theatrical laugh', dur: 2.0 },
  // playtest 4: Komur's own hiss, pounce and jump (the synthesised ones read as noise)
  hiss: { text: 'A domestic cat hissing angrily: one sharp breathy defensive hiss with a short spit at the end, close microphone, no background', dur: 1.0 },
  cat_pounce: { text: 'A cat pouncing: a quick scrabble of claws on a wooden floor, a swift leap and a soft thump as it lands, close microphone, no background', dur: 0.9 },
  cat_jump: { text: 'A cat jumping up: a light push-off of paws on a wooden floor and a soft airy whoosh, very short, close microphone, no background', dur: 0.6 },
};

const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const todo = Object.entries(SFX).filter(([id, s]) => (!only || only.has(id)) && !(manifest[id]?.hash === hash(s) && fs.existsSync(path.join(OUT, `${id}.mp3`))));
function hash(s) { return crypto.createHash('sha1').update(`${s.text}|${s.dur}`).digest('hex').slice(0, 12); }
console.log('to generate:', todo.map((t) => t[0]).join(', ') || '(none)');
if (args.includes('--dry') || !todo.length) process.exit(0);
const key = opt('--key') ? env[opt('--key')] : (env.ELEVENLABS_API_KEY_2 || env.ELEVENLABS_API_KEY);
async function left() {
  const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } });
  const j = await r.json(); return j.character_limit - j.character_count;
}
let before = await left();
console.log('credits left', before);
for (const [id, s] of todo) {
  if (before < 300) { console.log('stopping: low credits'); break; }
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: s.text, duration_seconds: s.dur, prompt_influence: 0.55 }),
  });
  if (!r.ok) { console.log('FAILED', id, r.status, (await r.text()).slice(0, 200)); continue; }
  const file = path.join(OUT, `${id}.mp3`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  let duration = null;
  try { duration = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString()); } catch (_) { /* ignore */ }
  manifest[id] = { file: `${id}.mp3`, duration, hash: hash(s), source: 'ElevenLabs sound generation', prompt: s.text };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  const now = await left();
  console.log('ok', id, duration, 'cost', before - now);
  before = now;
}
