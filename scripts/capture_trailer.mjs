// Gameplay video for the submission: the real game, played by a script, with its own audio.
//  record: CDP screencast frames (they include the HUD, subtitles and banners) + a MediaRecorder on the game's
//          WebAudio master bus (works while the browser itself is muted, so capturing stays silent here);
//          a scripted sequence of shots marks the good bits.            -> submission/video/raw/
//          The game's music is muted while recording (voices, effects and ambience stay): the music goes in
//          afterwards, so a cut never jumps in the middle of a bar (user request, session 8).
//  edit:   cut lists pick windows out of those shots, add captions and an end card, mux audio, concat, then lay
//          the game's waltz under the whole video.                     -> submission/video/bad-omen-*.mp4
// Usage: node scripts/capture_trailer.mjs [baseUrl] [--size 1280x720] [--out dir] [--raw dir] [--clean]
//          [--record-only | --edit-only (gameplay cuts) | --trailer-only | --gifs-only]: just that step
//   --raw    where the recording lives (default <out>/raw): the trailer and GIFs come from a --clean take
//            (submission/video/raw_clean), the gameplay cuts from the take with the HUD (submission/video/raw)
//   --clean  record without the gameplay HUD (score, meters, objective, prompts, achievement cards, skip hint);
//            subtitles, banners and score pop-ups stay
//   --shot-raw caught=<dir>[,name=<dir>]  (editing steps) take those shots from another take: after a fix only the
//            affected shot is re-recorded, every other part of each cut keeps its frames exactly
// (--record-only --size 1920x1080 --raw <dir> records stills material without cutting any video)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const base = (process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:5173/').replace(/\/?$/, '/');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const has = (f) => process.argv.includes(f);
const OUT = path.resolve(arg('--out', 'submission/video'));
const RAW = path.resolve(arg('--raw', path.join(OUT, 'raw')));
const FR = path.join(RAW, 'frames');
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
// two-pass EBU R128 normalisation of a finished video to -14 LUFS (the level YouTube plays at), true peak -1.5 dBTP;
// linear (one gain for the whole file, no pumping).  The game mix came out at -11 LUFS.
function loudnorm(file) {
  const target = 'I=-14:TP=-1.5:LRA=20';
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
  const tmp = file.replace(/\.mp4$/, '.norm.mp4');
  ff(['-i', file, '-map', '0', '-c:v', 'copy', '-af', `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
    '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, file);
  return `${(+m.input_i).toFixed(1)} -> -14 LUFS`;
}
/** Frames, audio and shot times per shot: from the main take, or from another take for shots named in --shot-raw. */
function takeSources(raw) {
  const load = (dir) => ({ FR: path.join(dir, 'frames'), audio: path.join(dir, 'audio.wav'),
    S: JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf8')), frames: JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8')) });
  const base = load(raw), over = {};
  for (const spec of String(arg('--shot-raw', '')).split(',').filter(Boolean)) { const [name, dir] = spec.split('='); over[name] = load(path.resolve(dir)); }
  return (name) => { const t = over[name] ?? base; return { ...t, shot: t.S.shots.find((x) => x.name === name) }; };
}
const probeDur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).toString().trim();

// ---------------------------------------------------------------------------------------------- music in post
// The videos use the game's waltz alone (user request, session 8), laid under takes recorded with the game music
// muted.  Its tempo, beat phase and loop come from src/audio/MusicDirector.js (measured on the file).
const WALTZ = { file: path.resolve('public/audio/music/waltz.mp3'), bpm: 110, perBar: 3, phase: 0.2727, loopEnd: 62.4545, dur: 65.776 };
const BEAT = 60 / WALTZ.bpm, BAR = BEAT * WALTZ.perBar;
/** The waltz as a `len` s bed.  fromStart: begin at the track's first bar (a trailer's cold open) and, when the
 *  video is longer than the loop, jump back on a bar line so the track's own ending lands at the end; otherwise
 *  start a whole number of bars in so that ending (the tail after its loop) lands at `len`.  Joins crossfade 60 ms. */
function waltzBed(len, out, { fromStart = false, padTo = len } = {}) {
  const snap = (x) => WALTZ.phase + Math.round((x - WALTZ.phase) / BAR) * BAR;
  const segs = [];
  if (!fromStart && len <= WALTZ.dur) segs.push({ from: Math.max(0, snap(WALTZ.dur - len)), len });
  else if (len <= WALTZ.dur) segs.push({ from: 0, len });
  else {
    const first = WALTZ.loopEnd;                     // the whole loop once, from the track's start
    const x = Math.max(WALTZ.phase, snap(WALTZ.dur - (len - first) + 0.03)); // back to a bar line, ending in the tail
    segs.push({ from: 0, len: first + 0.06 }, { from: x, len: Math.min(WALTZ.dur - x, len - first + 0.06) });
  }
  const ins = [], fl = [];
  segs.forEach((s, i) => { ins.push('-ss', s.from.toFixed(4), '-t', s.len.toFixed(4), '-i', WALTZ.file); fl.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo[s${i}]`); });
  let last = 's0';
  for (let i = 1; i < segs.length; i++) { fl.push(`[${last}][s${i}]acrossfade=d=0.06:c1=tri:c2=tri[j${i}]`); last = `j${i}`; }
  // fade in from silence; a cut-short ending (a bed shorter than the track) fades over its last 2.5 s
  const cutShort = segs.length === 1 && segs[0].from + len < WALTZ.dur - 0.5;
  // (padTo: silence after the music to the video's full length, so the mix never runs out of bed)
  fl.push(`[${last}]afade=t=in:d=0.6${cutShort ? `,afade=t=out:st=${Math.max(0, len - 2.5).toFixed(3)}:d=2.5` : ''},atrim=0:${len.toFixed(3)},apad,atrim=0:${Math.max(len, padTo).toFixed(3)}[out]`);
  ff([...ins, '-filter_complex', fl.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', out]);
  return segs;
}
/** A piecewise-linear gain curve [[t, gain], ...] as an ffmpeg volume expression (evaluated per frame). */
function gainExpr(keys) {
  let e = String(keys[keys.length - 1][1]);
  for (let i = keys.length - 2; i >= 0; i--) {
    const [t0, g0] = keys[i], [t1, g1] = keys[i + 1];
    const seg = t1 - t0 < 1e-3 ? String(g1) : `${g0}+(${g1 - g0})*(t-${t0.toFixed(3)})/${(t1 - t0).toFixed(3)}`;
    e = `if(lt(t,${t1.toFixed(3)}),${seg},${e})`;
  }
  return `if(lt(t,${keys[0][0].toFixed(3)}),${keys[0][1]},${e})`;
}
/** Lay a music bed under a finished video: the bed ducks under the game's voices and crashes (sidechain), the game
 *  audio stays as recorded.  Extra one-shot effects (impacts) mix in at given times. */
function mixBed(video, bed, out, { bedGain = '0.6', game = 1.0, impacts = [] } = {}) {
  const ins = ['-i', video, '-i', bed], fl = [];
  impacts.forEach((h, i) => { ins.push('-i', h.file); fl.push(`[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,${h.filter ?? 'anull'},volume=${h.gain ?? 1},adelay=${Math.round(h.t * 1000)}|${Math.round(h.t * 1000)}[h${i}]`); });
  fl.push(`[0:a]volume=${game},asplit=2[g][key]`);
  fl.push(`[1:a]volume='${bedGain}':eval=frame[b]`);
  fl.push('[b][key]sidechaincompress=threshold=0.035:ratio=5:attack=15:release=380[bd]');
  const hs = impacts.map((_, i) => `[h${i}]`).join('');
  fl.push(`[g][bd]${hs}amix=inputs=${2 + impacts.length}:normalize=0:duration=first,alimiter=limit=0.95[a]`);
  ff([...ins, '-filter_complex', fl.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out]);
}
const THUNDER = path.resolve('public/audio/sfx/thunder.mp3');
// (the steps run at the end of the file, once the cut lists below are initialised)

// ============================================================================================ record
async function record() {
  const [W, H] = arg('--size', '1280x720').split('x').map(Number);
  fs.rmSync(RAW, { recursive: true, force: true });
  fs.mkdirSync(FR, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(base + '?debug&noauto');
  await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 60000 });
  await page.evaluate(([m]) => { window.PI = Math.PI; window.__keepMusic = m; }, [has('--music')]); // the scripted in-page blocks below use PI too
  if (has('--clean')) {
    await page.addStyleTag({ content: '#hud .tl, #hud .tr, #hud .objective, #hud .prompt, #hud .hint, #hud .lockhint, #hud .achCard, #hud .fps, #skip { visibility: hidden !important; }' });
  }

  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const i = frames.length;
    frames.push({ i, t: f.metadata.timestamp });
    fs.writeFileSync(path.join(FR, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(f.data, 'base64'));
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) { /* closed */ }
  });
  const audioT0 = await page.evaluate(async () => {
    const a = window.__game.audio;
    await a.unlock();
    if (a.ctx.state !== 'running') await a.ctx.resume();
    const dest = a.ctx.createMediaStreamDestination();
    a.comp.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 160000 });
    window.__recChunks = [];
    rec.ondataavailable = (e) => window.__recChunks.push(e.data);
    window.__rec = rec;
    rec.start(500);
    return Date.now() / 1000;
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

  const ev = (fn, a) => page.evaluate(fn, a);
  const waitG = (s) => ev(async (s) => { const g = window.__game; const t0 = g.time; while (g.time - t0 < s) await new Promise((r) => setTimeout(r, 10)); }, s);
  const waitReal = (ms) => page.waitForTimeout(ms);
  const waitState = (st, ms = 20000) => page.waitForFunction((st) => window.__game.state === st, st, { timeout: ms }).catch(() => null);
  const down = (c) => ev((c) => { const i = window.__game.input; i.down.add(c); i.queue.push({ code: c, t: performance.now() / 1000 }); }, c);
  const up = (c) => ev((c) => window.__game.input.down.delete(c), c);
  const tap = async (c, ms = 60) => { await down(c); await waitReal(ms); await up(c); };
  const shots = [];
  let cur = null;
  // every shot starts clean: no voice line or subtitle carried over from the previous scene (cut lists may skip it)
  const hush = () => ev(() => {
    const g = window.__game;
    try { g.audio.voiceSrc?.stop(); } catch (_) { /* ended */ }
    g.dialogue.queue.length = 0; g.dialogue.busyUntil = 0;
    g.ui.el.subs.innerHTML = '';
    g.ui.el.banner.classList.add('hidden'); g.ui._bannerUntil = 0; // a banner from the last shot (STUNNED!) opened the next
  });
  const begin = async (name, caption = null) => {
    // the intro follows the silent title screen: a hush there raced its first line and could cut it
    if (shots.length && name !== 'intro') { await hush(); await waitReal(120); }
    // a catch after the tutorial ends the run: every later shot would be recorded over the results screen
    if (name !== 'caught' && await ev(() => window.__game.state === 'results')) throw new Error(`the run ended before the "${name}" shot: re-record`);
    cur = { name, caption, t0: Date.now() / 1000 };
  };
  const end = () => { cur.t1 = Date.now() / 1000; shots.push(cur); console.log('shot', cur.name, (cur.t1 - cur.t0).toFixed(1) + 's'); cur = null; };
  const cam = (yaw, pitch) => ev(([y, p]) => { const g = window.__game; g.followCam.yaw = y; g.followCam.pitch = p; g.followCam.smoothTarget.copy(g.cat.root.position); }, [yaw, pitch]);
  const park = () => ev(() => { const g = window.__game; const V = g.cat.position.constructor; g.granny.setState('scripted'); g.granny.teleport(new V(-6.3, 0, -0.6)); });
  const PI = Math.PI;

  // the trailer lays the soundtrack over the cut itself: its (clean) take records the voices and effects without the
  // game's music; --music keeps the music in (the gameplay video's take: it plays the real dynamic score)
  if (!has('--music')) await ev(() => { const g = window.__game; g.ui.settings.music = 0; g.audio.applySettings(g.ui.settings); });

  // ---- 1. title menu
  await waitReal(1500);
  await begin('menu');
  await waitReal(3300);
  end();

  // ---- 2. intro cinematic
  await page.click('button[data-act="play"]');
  await waitState('cinematic');
  await begin('intro');
  await waitState('playing', 30000);
  end();
  // no catches in this run (a catch after the tutorial ends it, and one did in a take): her catch cooldown is the
  // only way into a catch, and nothing but a catch resets it.  The caught shot plays in a fresh world.
  await ev(() => { window.__game.granny.catchCd = 1e9; });
  // the video shows the disasters in its own order: hold the game's finale until the finale shot
  await ev(() => { const g = window.__game; const o = g.director._toFinale.bind(g.director); g.director._toFinale = () => { if (window.__allowFinale) o(); }; });

  // ---- 3. the good vase (on the dining-room sideboard since playtest 4: play starts there)
  await ev(() => { const g = window.__game; const V = g.cat.position.constructor; g.cat.teleport(new V(2.3, 0.02, -3.0), PI); g.followCam.distance = 1.9; }); // closer: the vase read small
  await cam(0, -0.26);
  await waitG(0.4);
  await begin('vase', 'KNOCK THINGS OFF THINGS');
  await down('KeyW'); await waitG(0.35); await up('KeyW');
  await waitG(0.15);
  await tap('Space');
  await waitG(1.0);
  const onTable = await ev(() => window.__game.cat.position.y > 0.5);
  if (!onTable) await ev(() => { const g = window.__game; const V = g.cat.position.constructor; g.cat.teleport(new V(2.3, 0.9, -4.6), PI); });
  await waitG(0.3);
  await tap('Mouse0');
  await waitG(7.6); // "Oh. That was expensive." then Grandma's "MY GOOD VASE! It survived three wars!"
  end();
  await ev(() => { window.__game.followCam.distance = 2.6; });

  // (no tail-chase shot: the user disliked that idle — playtest 3)

  // ---- 4. through the window: gallop at a pane and leap, seen from outside as the glass bursts toward the lens
  await park();
  const win = await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    // window 6 (living room, front wall): from 4.5 m with the leap at 1.2 m he bursts out onto the porch (session 8:
    // window 5 from 3.4 m left him sitting on the sill since the leap aims at ledges)
    const w = g.house.windows[6];
    const n = w.alongX ? { x: 0, z: -Math.sign(w.cz) } : { x: -Math.sign(w.cx), z: 0 }; // into the house
    const yaw = Math.atan2(-n.x, -n.z);
    g.cat.teleport(new V(w.cx + n.x * 4.5, 0.02, w.cz + n.z * 4.5), yaw);
    g.followCam.yaw = yaw - Math.PI;
    const out = new V(w.cx - n.x * 2.7, w.cy - 0.15, w.cz - n.z * 2.7);
    g.followCam.cinematic = { pos: out.clone().add(new V(n.z * 0.9, 0, -n.x * 0.9)), look: new V(w.cx + n.x * 0.6, w.cy - 0.35, w.cz + n.z * 0.6), fov: 50, snap: true, speed: 99 };
    return { cx: w.cx, cz: w.cz, nx: n.x, nz: n.z };
  });
  await waitG(0.5);
  await begin('window');
  await down('ShiftLeft'); await down('KeyW');
  for (let i = 0; i < 60; i++) {
    const d = await ev(([cx, cz]) => { const p = window.__game.cat.position; return Math.hypot(p.x - cx, p.z - cz); }, [win.cx, win.cz]);
    if (d < 1.2) break;
    await waitReal(20);
  }
  await tap('Space');
  await waitG(0.6);
  await up('ShiftLeft'); await up('KeyW');
  await waitG(2.0);
  end();
  await ev(() => { window.__game.followCam.cinematic = null; });

  // ---- 5. gallop + leap onto the dining table, plates go flying (tracking side camera: the follow camera
  //         would sit inside the hall wall behind this run)
  await park();
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    // (session 8: from (1.7, -0.55) the leap met the candle at the table's end and he never got up; this line lands
    // him on the table and his swipes send 6-8 plates and cups flying)
    g.cat.teleport(new V(2.0, 0.02, -0.25), PI / 2);
    g.followCam.yaw = -PI / 2; g.followCam.pitch = -0.24;
    const track = () => { const c = g.cat.root.position; g.followCam.cinematic = { pos: new V(c.x - 0.5, c.y + 1.3, c.z + 2.8), look: new V(c.x + 0.6, c.y + 0.3, c.z - 0.2), fov: 52, snap: true }; };
    track(); window.__track = setInterval(track, 4);
  });
  await waitG(0.5);
  await begin('dining', 'GALLOP, LEAP, SWIPE');
  await down('ShiftLeft'); await down('KeyW');
  await waitG(0.5);
  await tap('Space');
  await up('ShiftLeft'); await up('KeyW');
  await waitG(0.9);
  for (let i = 0; i < 6; i++) {
    if (i === 2) await down('KeyW');
    await tap('Mouse0'); await waitG(0.34);
  }
  await up('KeyW');
  await waitG(1.4);
  end();
  await ev(() => { clearInterval(window.__track); window.__game.followCam.cinematic = null; });

  // ---- 6. claw the rope, taunt, dodge: the chandelier
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    g.cat.teleport(new V(2.32, 3.22, -0.5), PI / 2);
    g.granny.teleport(new V(6.0, 0, 0.9)); g.granny.yaw = -PI / 2;
    // she waits where the smoke test's real throws come from: left patrolling during the claw she wandered out of
    // sight of the gallery, and a windup needs her to see him (a take had her climb the stairs and swing instead)
    g.rage.setFloor(32); g.granny.throwCd = 30; g.granny.setState('scripted');
  });
  await cam(-PI / 2, -0.33);
  await waitG(0.5);
  await begin('bait', 'CLAW IT, TAUNT HER...');
  await down('KeyE'); await waitG(1.6); await up('KeyE');
  await waitG(0.4);
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    // dodge on the release: gallop along the gallery out of the throw's path (a real dodge, not a teleport)
    window.__dodge = g.events.on('grannyRelease', () => { g.input.down.add('ShiftLeft'); g.input.down.add('KeyD'); setTimeout(() => { g.input.down.delete('ShiftLeft'); g.input.down.delete('KeyD'); }, 650); });
    g.granny.teleport(new V(6.0, 0, 0.9)); g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
  });
  await tap('KeyF');
  await ev(() => { const g = window.__game; g.granny.throwCd = 0; if (!['windup', 'chase', 'spotted'].includes(g.granny.state)) g.granny.setState('chase'); });
  const sp01 = await page.waitForFunction(() => window.__game.setPieces.done.SP01, null, { timeout: 14000 }).then(() => true).catch(() => false);
  if (!sp01) await ev(() => window.__game.setPieces.trigger('SP01', 'granny_throw'));
  await waitState('playing', 20000);
  await waitG(2.4);
  end();
  await ev(() => window.__dodge?.());

  // ---- 7. the kitchen curse (oil lamp + Grandma's stove)
  await park();
  await ev(() => { const g = window.__game; const V = g.cat.position.constructor; g.cat.teleport(new V(-3.05, 0.94, -4.35), PI); g.director.flags.hLamp = true; });
  await cam(0, -0.32);
  await waitG(0.4);
  await begin('kitchen', '...AND LET HER DO THE REST');
  await tap('Mouse0');
  await ev(() => { const g = window.__game; const lamp = g.destruction.get('kitchen_oillamp'); g.destruction.knockLoose(lamp); g.destruction.touch(lamp, 'cat_swipe'); lamp.body?.applyImpulse({ x: 0.2, y: 0.4, z: 1.1 }, true); });
  await page.waitForFunction(() => window.__game.setPieces.state.sp02Ember, null, { timeout: 6000 }).catch(() => null);
  await waitG(1.6);
  await ev(() => window.__game.setPieces._kitchenStoveHit('granny_throw'));
  await waitState('playing', 20000);
  await waitG(1.0);
  end();

  // ---- 8. the wardrobe through the floor
  await ev(() => { const g = window.__game; const V = g.cat.position.constructor; g.fire.clear(); g.director.flags.hWard = true; g.cat.teleport(new V(-3.6, 3.22, 3.4), -PI / 2); });
  await waitG(0.3);
  await begin('floor');
  await ev(() => { const g = window.__game; g.setPieces._primeWardrobe(); g.setPieces.trigger('SP03', 'granny_throw'); });
  await waitState('playing', 20000);
  await waitG(1.4);
  end();

  // ---- 9. the glass house
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    g.cat.teleport(new V(9.8, 0.8, 0.0), 0);
    g.setPieces._primeGlassRope();
    g.granny.teleport(new V(7.9, 0, 3.6)); g.rage.setFloor(40); g.granny.throwCd = 0;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time;
    g.granny.setState('chase');
    window.__dodge = g.events.on('grannyRelease', () => { g.input.down.add('ShiftLeft'); g.input.down.add('KeyA'); setTimeout(() => { g.input.down.delete('ShiftLeft'); g.input.down.delete('KeyA'); }, 600); });
  });
  await cam(PI * 0.75, -0.3);
  await begin('glass', 'SHE BREAKS WHAT YOUR PAWS CAN\'T');
  const sp10 = await page.waitForFunction(() => window.__game.setPieces.done.SP10, null, { timeout: 8000 }).then(() => true).catch(() => false);
  if (!sp10) await ev(() => window.__game.setPieces.trigger('SP10', 'granny_throw'));
  await waitState('playing', 20000);
  await waitG(2.0);
  end();
  await ev(() => window.__dodge?.());

  // ---- 10. the finale: the last support
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    g.score.ruin = Math.max(g.score.ruin, 75);
    g.director.flags.hBrace = true; // the brace hint would talk over Grandma's finale line
    window.__allowFinale = true;
    g.director._toFinale(); // all four disasters are done: unlock the last brace (rage floor 90)
    g.cat.teleport(new V(2.0, 3.22, 1.9), PI / 2);
    g.granny.teleport(new V(5.2, 0, 2.6)); g.granny.yaw = -PI / 2;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time; g.granny.setState('chase');
  });
  await cam(-PI / 2 + 0.35, -0.3);
  await begin('finale');
  await ev(() => {
    const g = window.__game;
    g.granny.throwCd = 0.6;
    window.__dodge = g.events.on('grannyRelease', () => { g.input.down.add('ShiftLeft'); g.input.down.add('KeyA'); setTimeout(() => { g.input.down.delete('ShiftLeft'); g.input.down.delete('KeyA'); }, 700); });
  });
  const sp04 = await page.waitForFunction(() => window.__game.setPieces.done.SP04, null, { timeout: 25000 }).then(() => true).catch(() => false);
  if (!sp04) await ev(() => window.__game.setPieces.trigger('SP04', 'granny_throw'));
  await waitState('results', 60000); // the whole ending: garden at dawn, the tantrum, THE END
  await waitReal(3500);
  end();
  await ev(() => window.__dodge?.());

  // ---- 11. a fresh run for the stinger: a throw hits him, stars, she grabs him -> the cauldron
  await ev(() => window.__game.restart());
  await waitReal(1500);
  await ev(() => window.__game.sequence?.skip());
  await waitState('playing', 30000);
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    if (!window.__keepMusic) g.audio.applySettings({ ...g.ui.settings, music: 0 });
    g.director.stage = 'wreck'; g.director.firstCollateral = true; g.rage.setFloor(30);
    g.cat.invuln = 0; g.cat.teleport(new V(5.6, 0.02, 2.6), Math.PI);
    g.granny.teleport(new V(5.65, 0, -0.45), 0); g.granny.throwCd = 30; g.granny.swingCd = 3; g.granny.catchCd = 0;
    g.granny.lastSeen = g.cat.position.clone(); g.granny.lastSeenT = g.time; g.granny.setState('chase');
    g.followCam.yaw = Math.PI * 0.75; g.followCam.pitch = -0.3;
  });
  await waitG(0.6);
  await begin('caught');
  await ev(() => {
    const g = window.__game; const V = g.cat.position.constructor;
    const c = g.cat.position.clone(); c.y += 0.3;
    g.projectiles.launch({ type: 'pan', from: g.granny.handWorld(), target: c, source: 'granny_throw', thrower: g.granny });
  });
  await waitState('results', 40000);
  await waitReal(2500);
  end();

  // ---- stop + collect
  await cdp.send('Page.stopScreencast');
  await waitReal(300);
  const audioB64 = await ev(async () => {
    const rec = window.__rec;
    await new Promise((r) => { rec.onstop = r; rec.stop(); });
    const blob = new Blob(window.__recChunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const result = await ev(() => ({ score: window.__game.score.score, rank: window.__game.score.rank(), sp: Object.keys(window.__game.setPieces.done) }));
  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(RAW, 'audio.webm'), Buffer.from(audioB64, 'base64'));
  ff(['-i', path.join(RAW, 'audio.webm'), '-ar', '48000', '-ac', '2', path.join(RAW, 'audio.wav')]);
  fs.writeFileSync(path.join(RAW, 'frames.json'), JSON.stringify(frames));
  fs.writeFileSync(path.join(RAW, 'session.json'), JSON.stringify({ W, H, audioT0, shots, result, errors }, null, 1));
  console.log('recorded', frames.length, 'frames;', JSON.stringify(result), 'errors', errors.length, errors.slice(0, 3));
}

// ============================================================================================ edit
function edit() {
  const S = JSON.parse(fs.readFileSync(path.join(RAW, 'session.json'), 'utf8'));
  const { W, H } = S;
  const font = (f) => path.resolve('src/assets/fonts', f).replace(/\\/g, '/').replace(':', '\\:');
  const CREEP = font('Creepster-Regular.ttf'), FELL = font('IMFellEnglish-Italic.ttf');
  const src = takeSources(RAW);
  // [shot, from, to, opts]: seconds into the shot; `to` <= 0 counts back from the shot's end; opts.caption false
  // drops the shot's caption on that part.  The windows are tuned to the session-8 takes (contact sheets:
  // tools/video/contact_sheets.py; camera cuts: tools/video/find_cuts.py): a new recording shifts the action, so check
  // them again after re-recording.
  // `short` is the ~60 s gameplay video of docs/11 (title, premise, the core loop, the disasters, the ending, results)
  const CUTS = {
    full: [['menu', 0, 0], ['intro', 0, 0], ['vase', 0, 6.2], ['dining', 0.3, 5.2], ['window', 0.6, 3.6], ['bait', 0, 0],
      ['kitchen', 0, -0.3], ['floor', 0, 0], ['glass', 0, 0], ['finale', 0, 27.5], ['caught', 0, -0.5]],
    short: [['menu', 0, 2.2], ['intro', 5.05, 0], ['vase', 0.3, 4.8], ['dining', 0.3, 4.6], ['window', 1.0, 3.2],
      ['bait', 0, 2.6], ['bait', 3.6, 8.2, { caption: false }], ['kitchen', 0.8, 5.8], ['floor', 1.4, 4.6],
      ['finale', 0.3, 8.05], ['finale', 10.35, 16.45], ['finale', 21.0, 23.8], ['finale', 25.0, 27.0]],
  };
  const tmp = path.join(RAW, 'parts');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // end card (shared)
  const card = path.join(tmp, 'card.mp4');
  ff(['-f', 'lavfi', '-i', `color=c=0x0b0710:s=${W}x${H}:d=4.5:r=30`, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', [`drawtext=fontfile='${CREEP}':text='BAD OMEN':fontsize=${Math.round(H * 0.2)}:fontcolor=0xffae1a:x=(w-text_w)/2:y=h*0.2`,
      `drawtext=fontfile='${FELL}':text='ONE CAT. TWO FLOORS. NO DEPOSIT REFUNDS.':fontsize=${Math.round(H * 0.05)}:fontcolor=0xf3e6c8:x=(w-text_w)/2:y=h*0.52`,
      `drawtext=fontfile='${FELL}':text='Play it in your browser  ·  Game Jam Europe 2026':fontsize=${Math.round(H * 0.04)}:fontcolor=0xd9c9a8:x=(w-text_w)/2:y=h*0.68`,
      `drawtext=fontfile='${FELL}':text='three.js  ·  Rapier  ·  Blender  ·  Komur model by DreamNoms (CC BY 4.0)':fontsize=${Math.round(H * 0.03)}:fontcolor=0xb9a98a:x=(w-text_w)/2:y=h*0.8`,
      'fade=t=in:st=0:d=0.5,format=yuv420p'].join(','),
    '-t', '4.5', '-c:v', 'libx264', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', card]);
  for (const [cutName, list] of Object.entries(CUTS)) {
    const parts = [];
    list.forEach(([name, from, to, opts = {}], k) => {
      const T = src(name), s = T.shot;
      const caption = opts.caption === false ? null : s?.caption;
      if (!s) { console.log('missing shot', name); return; }
      const t0 = s.t0 + from, t1 = to > 0 ? s.t0 + to : s.t1 + to;
      const fr = T.frames.filter((f) => f.t >= t0 && f.t <= t1);
      if (fr.length < 5) { console.log('no frames for', name); return; }
      const lines = [];
      fr.forEach((f, i) => {
        const d = i + 1 < fr.length ? fr[i + 1].t - f.t : 1 / 30;
        lines.push(`file '${path.join(T.FR, `f${String(f.i).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'`, `duration ${Math.max(0.004, d).toFixed(4)}`);
      });
      lines.push(`file '${path.join(T.FR, `f${String(fr[fr.length - 1].i).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'`);
      const listFile = path.join(tmp, `${cutName}_${k}.txt`);
      fs.writeFileSync(listFile, lines.join('\n'));
      const dur = fr[fr.length - 1].t - fr[0].t + 1 / 30;
      const aStart = Math.max(0, fr[0].t - T.S.audioT0);
      const capEnd = Math.min(dur - 0.2, 3.6).toFixed(2);
      const cap = caption ? `,drawtext=fontfile='${CREEP}':text='${caption.replace(/'/g, '’')}':fontsize=${Math.round(H * 0.06)}:fontcolor=0xffae1a:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.79:enable='between(t,0.25,${capEnd})'` : '';
      const out = path.join(tmp, `${cutName}_${k}.mp4`);
      ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-ss', aStart.toFixed(3), '-t', dur.toFixed(3), '-i', T.audio,
        '-vf', `fps=30,scale=${W}:${H},format=yuv420p${cap}`,
        '-af', `alimiter=limit=0.89:level=false,volume=0.9,afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, dur - 0.12).toFixed(3)}:d=0.12`,
        '-t', dur.toFixed(3), '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', out]);
      parts.push(out);
    });
    parts.push(card);
    const listAll = path.join(tmp, `${cutName}_all.txt`);
    fs.writeFileSync(listAll, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
    const final = path.join(OUT, `bad-omen-gameplay${cutName === 'full' ? '' : '-60s'}.mp4`);
    const joined = path.join(tmp, `${cutName}_joined.mp4`);
    ff(['-f', 'concat', '-safe', '0', '-i', listAll, '-c', 'copy', joined]);
    // the waltz under the whole cut (the take was recorded with the game music muted): its own ending on the end card
    const bed = path.join(tmp, `${cutName}_waltz.wav`);
    const segs = waltzBed(probeDur(joined), bed);
    mixBed(joined, bed, final, { bedGain: '0.62' });
    const level = loudnorm(final);
    console.log('VIDEO', cutName, final, probeDur(final).toFixed(1) + 's', level, 'waltz from', segs.map((s) => s.from.toFixed(2)).join(' + '));
  }
}

// ============================================================================================ trailer
// A cut built like a game trailer: cold open on Grandma's first line, a title slam, cards between punchy montages,
// slow motion on the big impacts, the roof coming down as the climax, an end card and a post-title stinger.
// The game's own voices and effects (recorded with the game music muted) play over the game's waltz, laid in post:
// every cut lands on one of its beats, it ducks under dialogue, holds its breath under the slow motion and ends with
// the track's own ending on the end card (trailerDynamics).  No other music (user request, session 8).
// Segments: { shot, from, to (<= 0: from the shot's end), speed, mute } | { card, sub, dur, big }.
// Windows tuned on the session-8 clean take (raw_clean, contact sheets at 0.2-0.5 s): re-check after re-recording.
const TRAILER = [
  { card: '', dur: 0.8 },
  { shot: 'intro', from: 0.3, to: 4.85, fadeIn: 0.8, hard: true }, // night, Komur strolls in: "Black cats... seven years of bad luck"
  { card: 'SHE HATES BLACK CATS.', dur: 1.3 },
  { shot: 'intro', from: 5.05, to: 10.25, hard: true },       // "AH! I CAUGHT YOU! You're not leaving this house..."
  { shot: 'intro', from: 10.4, to: 12.72, hard: true },       // "Sounds like a challenge."
  { shot: 'intro', from: 12.82, to: 13.9 },                   // ...and he bolts past her (she grabs air)
  { card: 'BAD OMEN', dur: 2.2, big: true, title: true },
  { montage: 'a' },
  { shot: 'vase', from: 0.5, to: 3.6 },                       // leap onto the sideboard, swipe, the good vase
  { shot: 'dining', from: 0.3, to: 4.6 },                     // gallop, leap onto the table, swipes: CHAIN REACTION
  { shot: 'window', from: 1.2, to: 3.0 },                     // through the window, onto the porch
  { card: 'SHE THROWS THINGS.', dur: 1.1 },
  { shot: 'bait', from: 1.2, to: 3.5, hard: true },           // WEAKENED, "Is she going to THROW that?", the throw
  { card: 'BIGGER THINGS.', dur: 0.9 },
  { shot: 'bait', from: 3.68, to: 4.76, speed: 0.55, mute: true, hard: true }, // the rope snaps, the chandelier drops
  { shot: 'bait', from: 4.82, to: 6.6, hit: true, hard: true }, // it lands: THE LAST SUPPER
  { montage: 'b' },
  { shot: 'kitchen', from: 2.9, to: 5.3 },                    // the stove goes up: THE KITCHEN CURSE
  { shot: 'floor', from: 1.4, to: 3.8 },                     // the wardrobe through the floor
  { shot: 'glass', from: 2.4, to: 4.9 },                      // the chandelier, then the glass roof comes down
  { card: "YOU DON'T BREAK THE HOUSE.", dur: 1.2 },
  { card: 'SHE DOES.', dur: 1.0 },
  { riser: 4.1 },                                             // the waltz builds over the dodge into the collapse
  { shot: 'finale', from: 0.0, to: 1.86, hard: true },        // DODGE! the enchanted axe
  { shot: 'finale', from: 1.98, to: 3.0, speed: 0.5, mute: true }, // it bites into the roof brace
  { shot: 'finale', from: 3.0, to: 5.1, hit: true, hard: true }, // THE FINAL STRAW
  { shot: 'finale', from: 5.27, to: 8.05, hard: true },       // Grandma under the falling roof
  { shot: 'finale', from: 10.35, to: 13.15, hard: true },     // "I KNEW that cat was bad luck!"
  { shot: 'finale', from: 13.3, to: 16.47, hard: true },     // "I barely lifted a paw."
  { shot: 'finale', from: 17.4, to: 20.6 },                   // dawn: her tantrum brings the last beams down
  { shot: 'finale', from: 21.2, to: 23.9 },                   // THE END (of the house)
  { card: 'BAD OMEN', sub: 'Play it free in your browser  ·  itch.io', dur: 4.2, big: true, title: true, endCard: true },
  { shot: 'caught', from: 6.1, to: 14.4, stinger: true },     // the cauldron: "Black cat stew..." "Needs salt."
  { card: '', dur: 0.6 },
];

function trailer() {
  const sessionFile = path.join(RAW, 'session.json');
  if (!fs.existsSync(sessionFile)) { console.log('trailer: no recording'); return; }
  const S = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const { W, H } = S;
  const src = takeSources(RAW);
  const font = (f) => path.resolve('src/assets/fonts', f).replace(/\\/g, '/').replace(':', '\\:');
  const CREEP = font('Creepster-Regular.ttf'), FELL = font('IMFellEnglish-Italic.ttf');
  const tmp = path.join(RAW, 'trailer');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const parts = [], events = { hits: [], risers: [], slow: [] };
  let t = 0, pendingRiser = 0;
  const enc = ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];
  // every cut lands on a beat of the waltz (the bed starts with the track at t = 0): a segment's end moves to the
  // nearest beat, by less than half a beat (0.27 s)
  // (hard: the segment ends at a camera cut, so it may only get shorter — a frame of the next angle reads as a glitch)
  const onBeat = (t0, d, hard) => {
    let b = WALTZ.phase + Math.round((t0 + d - WALTZ.phase) / BEAT) * BEAT;
    if (hard && b > t0 + d + 1e-6) b -= BEAT;
    return b - t0 > 0.35 ? b - t0 : d;
  };
  TRAILER.forEach((seg, k) => {
    if (seg.montage) return;
    if (seg.riser) { pendingRiser = seg.riser; return; }
    const out = path.join(tmp, `p${String(k).padStart(2, '0')}.mp4`);
    let dur;
    if (seg.card !== undefined) {
      dur = events.stinger !== undefined ? seg.dur : onBeat(t, seg.dur); // (after the stinger the music is over)
      const big = seg.big ? 0.2 : 0.085;
      // drawn at twice the frame size, then a slow push-in (zoompan) down to the frame, like a trailer card: smooth
      // sub-pixel motion.  (Animating drawtext's fontsize instead segfaults this ffmpeg build, 8.1.1.)
      const X2 = 2, n = Math.round(dur * 30), vf = [];
      if (seg.card) vf.push(`drawtext=fontfile='${CREEP}':text='${seg.card.replace(/'/g, '’')}':fontsize=${Math.round(H * X2 * big)}:fontcolor=0xffae1a:shadowcolor=0x000000:shadowx=0:shadowy=${4 * X2}:x=(w-text_w)/2:y=(h-text_h)/2-${seg.sub ? Math.round(H * X2 * 0.06) : 0}`);
      if (seg.sub) vf.push(`drawtext=fontfile='${FELL}':text='${seg.sub.replace(/'/g, '’')}':fontsize=${Math.round(H * X2 * 0.045)}:fontcolor=0xf3e6c8:x=(w-text_w)/2:y=h*0.64`);
      if (seg.endCard) vf.push(`drawtext=fontfile='${FELL}':text='Game Jam Europe 2026':fontsize=${Math.round(H * X2 * 0.032)}:fontcolor=0xb9a98a:x=(w-text_w)/2:y=h*0.74`);
      vf.push(`zoompan=z='1+0.05*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30`);
      vf.push(`fade=t=in:st=0:d=${seg.card ? 0.1 : 0.01},fade=t=out:st=${Math.max(0, dur - 0.12)}:d=0.12`);
      ff(['-f', 'lavfi', '-i', `color=c=0x07050b:s=${W * X2}x${H * X2}:d=${dur}:r=30`, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', vf.join(','), '-t', String(dur), ...enc, out]);
      if (seg.card) events.hits.push({ t, big: !!seg.title });
      if (seg.title && !seg.endCard && events.titleT === undefined) events.titleT = t;
      if (seg.endCard) { events.endT = t; events.endDur = dur; }
    } else {
      const T = src(seg.shot), s = T.shot;
      if (!s) { console.log('trailer: missing shot', seg.shot); return; }
      const speed = seg.speed ?? 1;
      const st = seg.from >= 0 ? s.t0 + seg.from : s.t1 + seg.from;
      let en = seg.to > 0 ? s.t0 + seg.to : s.t1 + seg.to;
      dur = seg.stinger ? (en - st) / speed : onBeat(t, (en - st) / speed, seg.hard);
      en = st + dur * speed;
      const fr = T.frames.filter((f) => f.t >= st && f.t <= en);
      if (fr.length < 5) { console.log('trailer: no frames for', seg.shot, seg.from, seg.to); return; }
      const lines = [];
      fr.forEach((f, i) => {
        const d = i + 1 < fr.length ? fr[i + 1].t - f.t : 1 / 30;
        lines.push(`file '${path.join(T.FR, `f${String(f.i).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'`, `duration ${Math.max(0.004, d).toFixed(4)}`);
      });
      lines.push(`file '${path.join(T.FR, `f${String(fr[fr.length - 1].i).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'`);
      const listFile = path.join(tmp, `p${k}.txt`);
      fs.writeFileSync(listFile, lines.join('\n'));
      const aStart = Math.max(0, fr[0].t - T.S.audioT0);
      // the last frame holds (tpad) so a segment is exactly as long as its beat-snapped duration
      const vfx = [`setpts=PTS/${speed}`, 'fps=30', `scale=${W}:${H}`, 'tpad=stop_mode=clone:stop_duration=1'];
      if (seg.fadeIn) vfx.push(`fade=t=in:st=0:d=${seg.fadeIn}`);
      else if (seg.hit) vfx.push('fade=t=in:st=0:d=0.2:color=white'); // a white flash on the impact
      vfx.push(`fade=t=out:st=${Math.max(0, dur - 0.06).toFixed(3)}:d=0.06`);
      const args = ['-f', 'concat', '-safe', '0', '-i', listFile];
      if (seg.mute || speed !== 1) args.push('-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
      else args.push('-ss', aStart.toFixed(3), '-t', dur.toFixed(3), '-i', T.audio);
      const af = seg.mute || speed !== 1 ? 'anull' : `apad,afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, dur - 0.08).toFixed(3)}:d=0.08`;
      ff([...args, '-vf', vfx.join(','), '-af', af, '-t', dur.toFixed(3), ...enc, out]);
      if (pendingRiser) { events.risers.push({ t0: t, t1: t + pendingRiser }); pendingRiser = 0; }
      if (seg.hit) events.hits.push({ t, big: true, shot: true });
      if (seg.mute || speed !== 1) events.slow.push({ t0: t, t1: t + dur });
      if (seg.stinger) events.stinger = t;
    }
    parts.push(out);
    t += dur;
  });
  const total = t;
  const listAll = path.join(tmp, 'all.txt');
  fs.writeFileSync(listAll, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const joined = path.join(tmp, 'joined.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', listAll, '-c', 'copy', joined]);
  // the waltz from the cold open to the end card (its own ending lands there); the stinger plays on the game's sound
  const musicLen = (events.endT ?? total) + (events.endDur ?? 0);
  const bed = path.join(tmp, 'waltz.wav');
  const segs = waltzBed(musicLen, bed, { fromStart: true, padTo: total + 0.2 });
  const { keys, impacts } = trailerDynamics(events, musicLen);
  const final = path.join(OUT, 'bad-omen-trailer.mp4');
  mixBed(joined, bed, final, { bedGain: gainExpr(keys), game: 1.1, impacts });
  console.log('trailer level', loudnorm(final));
  console.log('TRAILER', final, total.toFixed(1) + 's', 'waltz', musicLen.toFixed(1) + 's from', segs.map((s) => s.from.toFixed(2)).join(' + '),
    JSON.stringify({ hits: events.hits.length, slow: events.slow.length, risers: events.risers.length, title: events.titleT?.toFixed(2), end: events.endT?.toFixed(2) }));
}

/** The trailer's dynamics on the one track (no other music: user request): hushed under the cold open, a breath and
 *  then the title slam at full level, a build over the finale's dodge, near-silence under each slow-motion moment
 *  with the music slamming back on the impact, and the waltz's own ending under the end card.  Impacts are the
 *  game's own thunder: its rumble builds under the dash into the title, short low booms on the other cards. */
function trailerDynamics(ev, len) {
  const keys = [[0, 0.5]];
  const add = (...kv) => { for (const [t, g] of kv) if (t >= 0 && t <= len) keys.push([t, g]); };
  if (ev.titleT !== undefined) add([ev.titleT - 0.9, 0.5], [ev.titleT - 0.1, 0.2], [ev.titleT, 1.0]);
  for (const r of ev.risers) add([r.t0, 0.85], [r.t1 - 0.05, 1.2]);
  for (const s of ev.slow) add([s.t0 - 0.08, 1.0], [s.t0 + 0.06, 0.12], [s.t1 - 0.02, 0.12], [s.t1 + 0.02, 1.1], [s.t1 + 1.6, 1.0]);
  add([len, 1.0]);
  keys.sort((a, b) => a[0] - b[0]);
  // later keys win where spans overlap: drop a key that lands inside 30 ms of the previous one
  const k2 = keys.filter((k, i) => i === 0 || k[0] - keys[i - 1][0] > 0.03);
  const thunderPeak = 1.58; // s into thunder.mp3 (its crack; measured)
  const impacts = [];
  for (const h of ev.hits) {
    if (h.t === ev.titleT) impacts.push({ file: THUNDER, t: Math.max(0, h.t - thunderPeak), gain: 1.0 });
    else if (h.t === ev.endT) impacts.push({ file: THUNDER, t: Math.max(0, h.t - 0.25), gain: 0.55, filter: `atrim=${thunderPeak - 0.25}:4,asetpts=PTS-STARTPTS` });
    else impacts.push({ file: THUNDER, t: Math.max(0, h.t - 0.04), gain: h.shot ? 1.1 : 0.85,
      filter: `atrim=${thunderPeak - 0.04}:${thunderPeak + 1.5},asetpts=PTS-STARTPTS,lowpass=f=230,lowpass=f=230,afade=t=out:st=0.5:d=1.0` });
  }
  return { keys: k2, impacts };
}

// ============================================================================================ GIFs
// Short loops for the itch.io page: 15 s or less, small (palette per clip, 10 fps, 480 px wide).
const GIFS = [
  { name: 'chandelier', shot: 'bait', from: 1.0, to: 8.0 },
  { name: 'dining-chaos', shot: 'dining', from: 0.3, to: 4.8 },
  { name: 'window-crash', shot: 'window', from: 0.9, to: 3.6 },
  { name: 'kitchen-fire', shot: 'kitchen', from: 0.8, to: 7.2 },
  { name: 'glass-house', shot: 'glass', from: 0.3, to: 6.2 },
  { name: 'roof', shot: 'finale', from: 0.0, to: 8.05 },
  { name: 'the-end', shot: 'finale', from: 17.2, to: 24.0 },
  { name: 'caught', shot: 'caught', from: 0.2, to: 14.4 },
];

function gifs() {
  const sessionFile = path.join(RAW, 'session.json');
  if (!fs.existsSync(sessionFile)) return;
  const src = takeSources(RAW);
  const dir = path.join(OUT, 'gifs');
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(RAW, 'gif');
  fs.mkdirSync(tmp, { recursive: true });
  for (const gdef of GIFS) {
    const T = src(gdef.shot), s = T.shot;
    if (!s) { console.log('gif: missing shot', gdef.shot); continue; }
    const st = gdef.from >= 0 ? s.t0 + gdef.from : s.t1 + gdef.from;
    const en = Math.min(st + 15, gdef.to > 0 ? s.t0 + gdef.to : s.t1 + gdef.to);
    const fr = T.frames.filter((f) => f.t >= st && f.t <= en);
    if (fr.length < 5) { console.log('gif: no frames for', gdef.name); continue; }
    const lines = [];
    fr.forEach((f, i) => {
      const d = i + 1 < fr.length ? fr[i + 1].t - f.t : 1 / 30;
      lines.push(`file '${path.join(T.FR, `f${String(f.i).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'`, `duration ${Math.max(0.004, d).toFixed(4)}`);
    });
    const listFile = path.join(tmp, `${gdef.name}.txt`);
    fs.writeFileSync(listFile, lines.join('\n'));
    const out = path.join(dir, `bad-omen-${gdef.name}.gif`);
    // 3 MB budget: shrink until it fits (itch.io is happiest with small GIFs)
    for (const [w, fps, colors] of [[480, 10, 128], [420, 10, 96], [360, 9, 80]]) {
      ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf',
        `fps=${fps},scale=${w}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
        '-loop', '0', out]);
      if (fs.statSync(out).size <= 3e6) break; // 3 MB in decimal: safe whichever way a site counts
    }
    console.log('GIF', path.basename(out), (fs.statSync(out).size / 1048576).toFixed(2) + ' MB', (fr[fr.length - 1].t - fr[0].t).toFixed(1) + 's');
  }
}

// ============================================================================================ run
// no flag: record, then the gameplay cuts, the trailer and the GIFs from that one take; an --x-only flag runs one step
const only = ['--record-only', '--edit-only', '--trailer-only', '--gifs-only'].find(has);
if (!only || only === '--record-only') await record();
if (!only || only === '--edit-only') edit();
if (!only || only === '--trailer-only') trailer();
if (!only || only === '--gifs-only') gifs();
