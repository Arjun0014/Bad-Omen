// Probe ElevenLabs account capabilities without ever printing secrets.
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const keys = ['ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY_2'].filter((k) => env[k]);
for (const k of keys) {
  const h = { 'xi-api-key': env[k] };
  const sub = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: h });
  const sj = sub.ok ? await sub.json() : { status: sub.status, body: (await sub.text()).slice(0, 200) };
  console.log(k, 'subscription:', sub.ok ? { tier: sj.tier, used: sj.character_count, limit: sj.character_limit, reset: sj.next_character_count_reset_unix, status: sj.status } : sj);
}
const h = { 'xi-api-key': env[keys[0]] };
const m = await fetch('https://api.elevenlabs.io/v1/models', { headers: h });
if (m.ok) { const mj = await m.json(); console.log('models:', mj.map((x) => `${x.model_id}${x.can_do_text_to_speech ? '' : '(no-tts)'}`).join(', ')); } else console.log('models err', m.status);
const v = await fetch('https://api.elevenlabs.io/v1/voices', { headers: h });
if (v.ok) { const vj = await v.json(); console.log('voices:', vj.voices.length); for (const x of vj.voices.slice(0, 60)) console.log(' ', x.voice_id, '|', x.name, '|', x.category, '|', JSON.stringify(x.labels || {})); } else console.log('voices err', v.status, (await v.text()).slice(0, 200));
