// Build-time voice generation (ElevenLabs).  Reads the API key from .env in Node only — never shipped.
// Usage: node scripts/generate_voiceover.mjs [--only ID,ID] [--dry] [--key ENV_NAME] [--out dir] [--voice-g ID] [--voice-k ID] [--model eleven_v4]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LINES } from '../src/data/dialogue.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const OUT = path.resolve(ROOT, opt('--out', 'public/audio/voice'));
const MANIFEST = path.join(OUT, 'manifest.json');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const MODEL = opt('--model', env.ELEVENLABS_MODEL_ID || 'eleven_v4');
const VOICES = {
  G: opt('--voice-g', env.ELEVENLABS_GRANDMA_VOICE_ID || 'JSIqdqOB9ZIcrBFOti5d'), // 'Cthulu female - v4 narrator' (account voice)
  K: opt('--voice-k', env.ELEVENLABS_KOMUR_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'), // 'George' premade (warm British storyteller)
};
const CAP = 8000;

async function pickKey(needed) {
  // --key NAME: a custom voice (Grandma's) exists only in the account it was made in
  for (const name of opt('--key') ? [opt('--key')] : ['ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY_2']) {
    const k = env[name];
    if (!k) continue;
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': k } });
    if (!r.ok) continue;
    const j = await r.json();
    const left = j.character_limit - j.character_count;
    console.log(`${name}: ${left} characters left (${j.tier})`);
    if (left >= needed) return { key: k, left };
  }
  return null;
}

function hashOf(l, voice) { return crypto.createHash('sha1').update(`${MODEL}|${voice}|${l.tts}`).digest('hex').slice(0, 12); }

function durationOf(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim();
    return Math.round(parseFloat(out) * 100) / 100;
  } catch (_) { return null; }
}

async function tts(key, voice, text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_96`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL }),
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const body = (await r.text()).slice(0, 300);
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1500 * 2 ** attempt)); continue; }
    throw new Error(`TTS ${r.status}: ${body}`);
  }
  throw new Error('TTS failed after retries');
}

const only = opt('--only') ? new Set(opt('--only').split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const todo = [];
for (const [id, l] of Object.entries(LINES)) {
  if (only && !only.has(id)) continue;
  const voice = VOICES[l.s];
  const h = hashOf(l, voice);
  const file = path.join(OUT, `${id}.mp3`);
  if (manifest[id]?.hash === h && fs.existsSync(file)) continue;
  todo.push({ id, l, voice, h, file });
}
const chars = todo.reduce((a, t) => a + t.l.tts.length, 0);
console.log(`model=${MODEL} lines to generate=${todo.length} chars=${chars}`);
if (chars > CAP) { console.error('Refusing: batch exceeds cap'); process.exit(1); }
if (DRY || !todo.length) process.exit(0);
const picked = await pickKey(chars);
if (!picked) { console.error('No API key with enough quota; keeping subtitles-only fallback.'); process.exit(2); }
let made = 0;
for (const t of todo) {
  try {
    const buf = await tts(picked.key, t.voice, t.l.tts);
    fs.writeFileSync(t.file, buf);
    manifest[t.id] = { file: `${t.id}.mp3`, speaker: t.l.s, text: t.l.text, duration: durationOf(t.file), model: MODEL, voice: t.voice, hash: t.h };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    made++;
    console.log(`ok ${t.id} ${manifest[t.id].duration}s`);
  } catch (e) {
    console.error(`FAILED ${t.id}: ${e.message}`);
  }
}
console.log(`generated ${made}/${todo.length}`);
