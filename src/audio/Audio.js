import * as THREE from 'three';
import { makeAll } from './Synth.js';
import { MusicDirector } from './MusicDirector.js';

const BASE = (import.meta.env?.BASE_URL ?? '/') + 'audio/';

// WebAudio manager: buses, positional one-shots, voice with ducking, loops, recorded music (MusicDirector).
export class AudioManager {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.buffers = {};   // name -> AudioBuffer (files)
    this.synth = {};     // name -> [AudioBuffer]
    this.voiceManifest = {};
    this.sfxManifest = {};
    this.muted = false;
    this.voiceBusy = 0;
    this.loops = new Map();
    this.lastPlay = new Map();
    this.music = new MusicDirector(this);
  }

  /** Must be called from a user gesture (autoplay policy). */
  async unlock() {
    // iOS: play through the ringer switch like any game would (Safari 17+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* unsupported */ }
    if (this.ctx) { if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {}); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.voiceBus = c.createGain(); this.voiceBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    this.duck = c.createGain(); this.duck.connect(this.musicBus);
    this.synth = makeAll(c);
    this.applySettings(this.game.ui?.settings ?? {});
    // no OfflineAudioContext (very old browsers): decode with the real context now; gameplay never blocks on audio
    if (!this.loading) this.loading = this.loadAll(c);
  }

  /** Fetch and decode every voice line and SFX file at boot, before any click.  An OfflineAudioContext decodes
   *  without a user gesture (no autoplay warning) and its AudioBuffers play in the real context later.  Decoding
   *  only after the Play click left the intro's first line (0.4 s in) silent on a first run (playtest 4). */
  preload() {
    if (this.loading) return this.loading;
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let dec = null;
    try { dec = Off ? new Off(1, 1, 48000) : null; } catch (_) { dec = null; }
    if (dec) this.loading = this.loadAll(dec);
    return this.loading ?? null;
  }

  /** Resolves once these voice lines are decoded, loading has finished, or `maxMs` has passed. */
  async whenVoices(ids, maxMs = 2500) {
    const t0 = performance.now();
    while (!this.loaded && ids.some((id) => !this.buffers['v:' + id]) && performance.now() - t0 < maxMs) {
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  async loadAll(dec) {
    try {
      const [vm, sm] = await Promise.all([
        fetch(BASE + 'voice/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch(BASE + 'sfx/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      this.voiceManifest = vm; this.sfxManifest = sm;
      const jobs = [];
      for (const [id, e] of Object.entries(sm)) jobs.push(this._load(dec, id, BASE + 'sfx/' + e.file));
      for (const [id, e] of Object.entries(vm)) jobs.push(this._load(dec, 'v:' + id, BASE + 'voice/' + e.file));
      await Promise.all(jobs);
    } catch (e) { console.warn('audio load', e); }
    this.loaded = true;
    // the music after the voices (the intro needs those first); touch devices decode it at 32 kHz to save memory
    const touch = matchMedia?.('(pointer: coarse)').matches;
    await this.music.load(BASE + 'music/', touch ? 32000 : 44100);
  }

  async _load(dec, name, url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return;
      const ab = await r.arrayBuffer();
      this.buffers[name] = await dec.decodeAudioData(ab);
    } catch (e) { console.warn('audio decode failed', url); }
  }

  applySettings(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : (s.master ?? 0.85), t, 0.05);
    this.musicBus.gain.setTargetAtTime((s.music ?? 0.55) * 1.0, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx ?? 0.85, t, 0.05);
    this.voiceBus.gain.setTargetAtTime((s.voice ?? 1) * 1.15, t, 0.05);
    this.ambBus.gain.setTargetAtTime((s.sfx ?? 0.85) * 0.6, t, 0.05);
  }

  toggleMute() { this.muted = !this.muted; this.applySettings(this.game.ui?.settings ?? {}); return this.muted; }

  _buffer(name) {
    if (this.buffers[name]) return this.buffers[name];
    const v = this.synth[name];
    if (v && v.length) return v[Math.floor(Math.random() * v.length)];
    return null;
  }

  /** Play a one-shot.  opts: {pos, volume, rate, jitter, bus, minGap} */
  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    const buf = this._buffer(name);
    if (!buf) return null;
    const now = this.ctx.currentTime;
    const gap = opts.minGap ?? 0.03;
    const key = name + (opts.pos ? Math.round(opts.pos.x) + ':' + Math.round(opts.pos.z) : '');
    if (now - (this.lastPlay.get(key) ?? -1) < gap) return null;
    this.lastPlay.set(key, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() - 0.5) * (opts.jitter ?? 0.12));
    const g = this.ctx.createGain();
    let vol = opts.volume ?? 1;
    let out = g;
    if (opts.pos) {
      const cam = this.game.camera;
      const d = cam.position.distanceTo(opts.pos);
      vol *= 1 / (1 + Math.max(0, d - 1.5) * 0.18);
      const pan = this.ctx.createStereoPanner();
      const rel = opts.pos.clone().sub(cam.position);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      pan.pan.value = THREE.MathUtils.clamp(rel.normalize().dot(right), -1, 1) * 0.8;
      g.connect(pan);
      out = pan;
    }
    g.gain.value = vol;
    src.connect(g);
    out.connect(opts.bus === 'amb' ? this.ambBus : opts.bus === 'voice' ? this.voiceBus : this.sfxBus);
    src.start();
    return src;
  }

  /** Play a voice line; returns duration (s) or 0 if not available. */
  voice(id, { priority = false } = {}) {
    const name = 'v:' + id;
    const buf = this.buffers[name];
    if (!this.ctx || !buf) return 0;
    const now = this.ctx.currentTime;
    if (this.voiceSrc && !priority && now < this.voiceBusy) return -1;
    if (this.voiceSrc && priority) { try { this.voiceSrc.stop(); } catch (_) { /* ended */ } }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.voiceBus);
    src.start();
    this.voiceSrc = src;
    this.voiceBusy = now + buf.duration;
    // duck music under dialogue
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(0.45, now, 0.08);
    this.duck.gain.setTargetAtTime(1, now + buf.duration, 0.4);
    return buf.duration;
  }

  /** Cut the line being spoken (a skipped cutscene) and lift the music duck. */
  stopVoice() {
    if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch (_) { /* ended */ } }
    this.voiceSrc = null;
    this.voiceBusy = 0;
    if (this.ctx) { const now = this.ctx.currentTime; this.duck.gain.cancelScheduledValues(now); this.duck.gain.setTargetAtTime(1, now, 0.2); }
  }

  hasVoice(id) { return !!this.buffers['v:' + id]; }

  loop(name, { volume = 0.5, bus = 'amb', pos = null } = {}) {
    if (!this.ctx) return null;
    if (this.loops.has(name)) return this.loops.get(name);
    const buf = this._buffer(name);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(bus === 'sfx' ? this.sfxBus : this.ambBus);
    src.start();
    g.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.5);
    const h = { src, g, base: volume, pos };
    this.loops.set(name, h);
    return h;
  }

  setLoopVolume(name, v) { const h = this.loops.get(name); if (h) h.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); }

  stopLoop(name) {
    const h = this.loops.get(name);
    if (!h) return;
    h.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => { try { h.src.stop(); } catch (_) { /* ok */ } }, 1500);
    this.loops.delete(name);
  }

  ui(kind) { this.play(kind === 'hover' ? 'hover' : 'click', { volume: kind === 'hover' ? 0.15 : 0.35, minGap: 0.05 }); }

  update() {
    if (!this.ctx) return;
    this.music.update();
  }
}
