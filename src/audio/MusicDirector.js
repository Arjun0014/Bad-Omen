// Recorded music with per-track playback positions, beat-aware crossfades and seamless loops (user request,
// playtest 4): the waltz for the menu and calm play, Grandma's chase, and her MELTDOWN.  Each track keeps its own
// position: leaving the waltz at 0:20 for a chase and coming back resumes it at 0:20.  A switch waits for the
// playing track's next bar (or beat) and the incoming track enters on one of its own beats; the fade is
// equal-power.  Loops are native AudioBufferSourceNode loops over whole bars, with the wrap crossfaded into the
// buffer itself, so they are sample-accurate and click-free.

// tempo and beat phase measured on the files (onset autocorrelation + a fine grid search over tempo and phase);
// loop regions are whole bars: the waltz's 38 bars before its fade-out, the chase's bars 12-35 (20.57-60.0 s:
// only its 20-60 s part is used, as asked), the berserk track's first 37 bars.  'pre' blends the loop's last
// moments into what comes just before its start; 'tail' blends what follows its end into its first moments.
export const MUSIC = {
  main: { file: 'waltz.mp3', bpm: 110, perBar: 3, phase: 0.2727, loop: [0.2727, 62.4545], wrap: 'tail', wrapFade: 0.35 },
  chase: { file: 'chase.mp3', bpm: 140, perBar: 4, phase: 0, loop: [20.5714, 60.0], wrap: 'pre', wrapFade: 0.06 },
  berserk: { file: 'berserk.mp3', bpm: 150, perBar: 4, phase: 0.0083, loop: [0.0083, 59.2083], wrap: 'tail', wrapFade: 0.08 },
};

// Grandma states that count as hunting Komur down
const HUNT = new Set(['spotted', 'chase', 'windup', 'swing', 'catch', 'holding', 'tantrum']);
const BERSERK_ON = 90, BERSERK_OFF = 80; // rage: MELTDOWN starts at 90
const CALM_AFTER = 6;                    // s without a chase (or below BERSERK_OFF) before the music calms down
const DWELL = 4;                         // s a de-escalation waits after the last switch
const ESCALATE_DWELL = 1.5;              // s an escalation waits after the last switch

export class MusicDirector {
  constructor(audio) {
    this.audio = audio;
    this.buffers = {};                           // name -> AudioBuffer (loop wrap baked in)
    this.pos = { main: MUSIC.main.loop[0], chase: MUSIC.chase.loop[0], berserk: MUSIC.berserk.loop[0] };
    this.deck = null;                            // { name, src, gain, t0, off }
    this.fading = [];                            // decks on their way out
    this.current = null;                         // the track that is (or is about to be) playing, or null
    this.lastSwitch = -99;
    this.huntT = -99; this.berserk = false; this.calmT = 0;
    this.log = [];                               // switches, for tests: { t, from, to, at, off }
  }

  /** Decode the tracks (an OfflineAudioContext: no user gesture needed) and bake each loop's wrap crossfade. */
  async load(base, rate) {
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Off) return;
    let dec;
    try { dec = new Off(2, 1, rate); } catch (_) { return; }
    await Promise.all(Object.entries(MUSIC).map(async ([name, m]) => {
      try {
        const r = await fetch(base + m.file);
        if (!r.ok) return;
        const buf = await dec.decodeAudioData(await r.arrayBuffer());
        bakeLoop(buf, m);
        this.buffers[name] = buf;
      } catch (e) { console.warn('music decode failed', m.file); }
    }));
  }

  get ready() { return !!this.buffers.main; }

  /** Seconds into the track (file timeline) a deck is at, at context time t. */
  _posAt(d, t) {
    const [A, B] = MUSIC[d.name].loop;
    const p = d.off + Math.max(0, t - d.t0);
    return p < B ? p : A + ((p - A) % (B - A));
  }

  /** The context time of the playing track's next bar line (or next beat when the bar is far off). */
  _nextBoundary(d, t) {
    const m = MUSIC[d.name], beat = 60 / m.bpm, [, B] = m.loop;
    const p = this._posAt(d, t);
    const kb = Math.ceil((p - m.phase) / beat + 1e-6);
    const nextBeat = Math.min(m.phase + kb * beat, B);
    const bar = beat * m.perBar;
    const nextBar = Math.min(m.phase + Math.ceil((p - m.phase) / bar + 1e-6) * bar, B);
    return t + ((nextBar - p) <= 1.0 ? nextBar - p : nextBeat - p);
  }

  /** A position on the track's own beat grid inside its loop. */
  _snap(name, p) {
    const m = MUSIC[name], beat = 60 / m.bpm, [A, B] = m.loop;
    let s = m.phase + Math.round((p - m.phase) / beat) * beat;
    if (s < A) s = A;
    if (s >= B - 0.05) s = A;
    return s;
  }

  /** Crossfade to `name` (null: fade to silence) on the next bar/beat of what is playing. */
  switchTo(name, fade) {
    const a = this.audio, ctx = a.ctx;
    if (!ctx || name === this.current || (name && !this.buffers[name])) return;
    const now = ctx.currentTime;
    const out = this.deck;
    const at = out ? this._nextBoundary(out, now + 0.06) : now + 0.05;
    if (out) {
      this.pos[out.name] = this._posAt(out, at); // where it resumes next time
      const g = out.gain.gain;
      const level = g.value;
      g.cancelScheduledValues(now);
      g.setValueAtTime(level, now); // holds until the boundary (a curve may not overlap another event)
      g.setValueCurveAtTime(curve(false, level), at, fade);
      try { out.src.stop(at + fade + 0.05); } catch (_) { /* stopped */ }
      this.fading.push(out);
      setTimeout(() => { this.fading = this.fading.filter((d) => d !== out); try { out.gain.disconnect(); } catch (_) { /* gone */ } }, (at - now + fade + 0.3) * 1000);
    }
    this.log.push({ t: +now.toFixed(2), from: this.current, to: name, at: +at.toFixed(2), off: name ? +this._snap(name, this.pos[name]).toFixed(2) : null });
    if (this.log.length > 40) this.log.shift();
    this.current = name;
    this.lastSwitch = now;
    this.deck = null;
    if (!name) return;
    const m = MUSIC[name];
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = true;
    src.loopStart = m.loop[0];
    src.loopEnd = m.loop[1];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueCurveAtTime(curve(true, 1), at, fade);
    src.connect(gain);
    gain.connect(a.duck);
    const off = this._snap(name, this.pos[name]);
    src.start(at, off);
    this.deck = { name, src, gain, t0: at, off };
  }

  /** What the music should be now, with hysteresis so it never flips back and forth. */
  update() {
    const a = this.audio, g = a.game, ctx = a.ctx;
    if (!ctx || ctx.state !== 'running' || !this.ready) return;
    const now = ctx.currentTime;
    const st = g.state, stage = g.director?.stage;
    let want;
    if (st === 'menu' || st === 'results' || st === 'loading') want = 'main';
    else if (stage === 'outro' || stage === 'caught') want = null; // the endings play to their own stingers
    else {
      const rage = g.rage?.value ?? 0;
      if (rage >= BERSERK_ON || stage === 'finale') { this.berserk = true; this.calmT = now; }
      else if (rage >= BERSERK_OFF) this.calmT = now;
      else if (this.berserk && now - this.calmT > CALM_AFTER) this.berserk = false;
      if (g.granny && HUNT.has(g.granny.state)) this.huntT = now;
      const hunting = now - this.huntT < CALM_AFTER;
      want = this.berserk ? 'berserk' : hunting ? 'chase' : 'main';
    }
    if (want === this.current) return;
    const rank = { null: 0, main: 1, chase: 2, berserk: 3 };
    const up = (rank[want] ?? 0) > (rank[this.current] ?? 0);
    if (now - this.lastSwitch < (up ? ESCALATE_DWELL : DWELL) && this.current) return;
    this.switchTo(want, want === null ? 1.6 : up ? 0.9 : 2.4);
  }

  // the old procedural music's interface: the director decides by itself now
  start() {}
  stop() {}
  set intensity(_) {}
}

/** Equal-power fade curve from 0 to `to` (in) or from `from` to 0 (out). */
function curve(fadeIn, level) {
  const n = 64, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    c[i] = level * (fadeIn ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2));
  }
  return c;
}

/** Bake a loop's wrap into the buffer so a native loop over [A, B) is seamless. */
function bakeLoop(buf, m) {
  const sr = buf.sampleRate, [A, B] = m.loop;
  const a = Math.round(A * sr), b = Math.min(Math.round(B * sr), buf.length), n = Math.round(m.wrapFade * sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    if (m.wrap === 'pre' && a - n >= 0) {
      // the loop's last n samples fade into the n samples that lead into its start
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n;
        d[b - n + i] = d[b - n + i] * Math.cos(x * Math.PI / 2) + d[a - n + i] * Math.sin(x * Math.PI / 2);
      }
    } else if (b + n <= d.length) {
      // what rings on after the loop's end fades out over the loop's first n samples
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) / n;
        d[a + i] = d[a + i] * Math.sin(x * Math.PI / 2) + d[b + i] * Math.cos(x * Math.PI / 2);
      }
    }
  }
}
