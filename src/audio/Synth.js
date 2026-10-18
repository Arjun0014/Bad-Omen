// Procedural sound synthesis into AudioBuffers (no samples needed).

function rnd(a, b) { return a + Math.random() * (b - a); }

function makeBuf(ctx, dur, fn, channels = 1) {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(dur * sr));
  const buf = ctx.createBuffer(channels, n, sr);
  for (let c = 0; c < channels; c++) {
    const d = buf.getChannelData(c);
    fn(d, sr, c);
  }
  normalize(buf, 0.9);
  return buf;
}

function normalize(buf, peak) {
  let m = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
  if (m < 1e-6) return;
  const k = peak / m;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
}

// simple one-pole / biquad helpers operating on arrays
function biquad(d, sr, type, f, q = 0.7) {
  const w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), a = sn / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + a; a1 = -2 * cs; a2 = 1 - a; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + a; a1 = -2 * cs; a2 = 1 - a; }
  else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * cs; a2 = 1 - a; } // bandpass
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
  }
}

function noise(d, from = 0, to = d.length, amp = 1) { for (let i = from; i < to; i++) d[i] += (Math.random() * 2 - 1) * amp; }

function env(i, sr, attack, decay) {
  const t = i / sr;
  return t < attack ? t / attack : Math.exp(-(t - attack) / decay);
}

function pings(d, sr, count, fLo, fHi, spread, decayLo, decayHi, amp) {
  for (let k = 0; k < count; k++) {
    const f = rnd(fLo, fHi), start = Math.floor(rnd(0, spread) * sr), dec = rnd(decayLo, decayHi), a = amp * rnd(0.4, 1);
    for (let i = start; i < d.length; i++) {
      const t = (i - start) / sr;
      const e = Math.exp(-t / dec);
      if (e < 0.001) break;
      d[i] += Math.sin(2 * Math.PI * f * t) * e * a;
    }
  }
}

export const RECIPES = {
  glass: (ctx) => makeBuf(ctx, 0.9, (d, sr) => {
    noise(d, 0, Math.floor(0.12 * sr), 0.8);
    for (let i = 0; i < d.length; i++) d[i] *= env(i, sr, 0.002, 0.05);
    biquad(d, sr, 'hp', 2500);
    pings(d, sr, 26, 2400, 7800, 0.45, 0.03, 0.18, 0.35);
  }),
  ceramic: (ctx) => makeBuf(ctx, 0.7, (d, sr) => {
    noise(d, 0, Math.floor(0.06 * sr), 1);
    for (let i = 0; i < d.length; i++) d[i] *= env(i, sr, 0.001, 0.025);
    biquad(d, sr, 'bp', 2200, 1.2);
    pings(d, sr, 14, 1300, 4200, 0.3, 0.02, 0.09, 0.5);
  }),
  wood: (ctx) => makeBuf(ctx, 0.6, (d, sr) => {
    const crack = new Float32Array(d.length);
    noise(crack, 0, Math.floor(0.2 * sr), 1);
    for (let i = 0; i < crack.length; i++) crack[i] *= env(i, sr, 0.001, 0.04);
    biquad(crack, sr, 'bp', rnd(700, 1400), 0.9);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      d[i] = crack[i] * 1.2 + Math.sin(2 * Math.PI * (95 - 40 * t) * t) * Math.exp(-t / 0.09) * 0.8;
    }
  }),
  woodbig: (ctx) => makeBuf(ctx, 1.6, (d, sr) => {
    for (let k = 0; k < 6; k++) {
      const s = Math.floor(rnd(0, 0.7) * sr), len = Math.floor(0.25 * sr);
      const tmp = new Float32Array(len);
      noise(tmp);
      for (let i = 0; i < len; i++) tmp[i] *= env(i, sr, 0.001, rnd(0.03, 0.08));
      biquad(tmp, sr, 'bp', rnd(400, 1600), 0.8);
      for (let i = 0; i < len && s + i < d.length; i++) d[s + i] += tmp[i] * rnd(0.5, 1);
    }
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] += Math.sin(2 * Math.PI * (70 - 25 * t) * t) * Math.exp(-t / 0.4) * 0.9; }
    const r = new Float32Array(d.length); noise(r); biquad(r, sr, 'lp', 180);
    for (let i = 0; i < d.length; i++) d[i] += r[i] * Math.exp(-(i / sr) / 0.6) * 1.5;
  }),
  metal: (ctx) => makeBuf(ctx, 1.4, (d, sr) => {
    const f = rnd(320, 520);
    const parts = [[1, 1, 0.9], [2.76, 0.6, 0.6], [5.4, 0.4, 0.35], [8.93, 0.25, 0.2]];
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      let v = 0;
      for (const [r, a, dec] of parts) v += Math.sin(2 * Math.PI * f * r * t) * a * Math.exp(-t / dec);
      d[i] = v * (t < 0.002 ? t / 0.002 : 1);
    }
    noise(d, 0, Math.floor(0.02 * sr), 0.6);
  }),
  thud: (ctx) => makeBuf(ctx, 0.5, (d, sr) => {
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (80 - 50 * t) * t) * Math.exp(-t / 0.08); }
    noise(d, 0, Math.floor(0.03 * sr), 0.4); biquad(d, sr, 'lp', 900);
  }),
  whoosh: (ctx) => makeBuf(ctx, 0.42, (d, sr) => {
    noise(d);
    const out = new Float32Array(d.length);
    // swept bandpass approximated by chunks
    const chunks = 12;
    for (let c = 0; c < chunks; c++) {
      const a = Math.floor(c * d.length / chunks), b = Math.floor((c + 1) * d.length / chunks);
      const seg = d.slice(a, b);
      biquad(seg, sr, 'bp', 400 + 2200 * (c / chunks), 1.5);
      out.set(seg, a);
    }
    for (let i = 0; i < d.length; i++) d[i] = out[i] * Math.sin(Math.PI * i / d.length);
  }),
  swipe: (ctx) => makeBuf(ctx, 0.16, (d, sr) => {
    noise(d); biquad(d, sr, 'bp', 3200, 1.2);
    for (let i = 0; i < d.length; i++) d[i] *= Math.sin(Math.PI * i / d.length) ** 2;
  }),
  tap: (ctx) => makeBuf(ctx, 0.05, (d, sr) => {
    noise(d); biquad(d, sr, 'lp', 1800);
    for (let i = 0; i < d.length; i++) d[i] *= env(i, sr, 0.001, 0.008);
  }),
  stomp: (ctx) => makeBuf(ctx, 0.3, (d, sr) => {
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * (70 - 30 * t) * t) * Math.exp(-t / 0.05); }
    noise(d, 0, Math.floor(0.015 * sr), 0.5); biquad(d, sr, 'lp', 1200);
  }),
  creak: (ctx) => makeBuf(ctx, 0.9, (d, sr) => {
    let ph = 0;
    const f0 = rnd(70, 140);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const f = f0 * (1 + 0.25 * Math.sin(2 * Math.PI * 1.3 * t) + 0.05 * Math.sin(2 * Math.PI * 7 * t));
      ph += f / sr;
      const saw = (ph % 1) * 2 - 1;
      // stick-slip: pulsed amplitude
      const pulse = Math.max(0, Math.sin(2 * Math.PI * f * 0.5 * t)) ** 6;
      d[i] = saw * 0.4 + pulse * 0.8;
      d[i] *= Math.sin(Math.PI * t / 0.9);
    }
    biquad(d, sr, 'bp', 900, 2.5);
  }),
  scratch: (ctx) => makeBuf(ctx, 0.5, (d, sr) => {
    noise(d); biquad(d, sr, 'bp', 2800, 0.9);
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] *= (0.5 + 0.5 * Math.sin(2 * Math.PI * 14 * t)) ** 2; }
  }),
  paper: (ctx) => makeBuf(ctx, 0.35, (d, sr) => {
    noise(d); biquad(d, sr, 'hp', 1800);
    for (let i = 0; i < d.length; i++) d[i] *= env(i, sr, 0.01, 0.08) * (0.6 + 0.4 * Math.random());
  }),
  fireLoop: (ctx) => makeBuf(ctx, 3.0, (d, sr) => {
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }
    for (let k = 0; k < 90; k++) {
      const s = Math.floor(Math.random() * (d.length - 400));
      for (let i = 0; i < 300; i++) d[s + i] += (Math.random() * 2 - 1) * Math.exp(-i / 40) * rnd(0.3, 1);
    }
    // seamless loop: crossfade ends
    const x = Math.floor(0.1 * sr);
    for (let i = 0; i < x; i++) { const a = i / x; d[i] = d[i] * a + d[d.length - x + i] * (1 - a); }
  }),
  rainLoop: (ctx) => makeBuf(ctx, 4.0, (d, sr, c) => {
    noise(d, 0, d.length, 0.5); biquad(d, sr, 'hp', 1200); biquad(d, sr, 'lp', 7000);
    for (let k = 0; k < 500; k++) {
      const s = Math.floor(Math.random() * (d.length - 200));
      const f = rnd(2500, 6000);
      for (let i = 0; i < 150; i++) d[s + i] += Math.sin(2 * Math.PI * f * i / sr) * Math.exp(-i / 25) * 0.25;
    }
    const x = Math.floor(0.2 * sr);
    for (let i = 0; i < x; i++) { const a = i / x; d[i] = d[i] * a + d[d.length - x + i] * (1 - a); }
  }, 2),
  // a cauldron on the boil: rising "bloop" sweeps over a low simmer (seamless loop)
  bubbleLoop: (ctx) => makeBuf(ctx, 2.6, (d, sr) => {
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = b * 0.995 + (Math.random() * 2 - 1) * 0.02; d[i] = b; }
    for (let k = 0; k < 26; k++) {
      const len = Math.floor(rnd(0.04, 0.1) * sr), s = Math.floor(Math.random() * (d.length - len)), f0 = rnd(160, 420), a = rnd(0.25, 0.7);
      let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / len; ph += f0 * (1 + 1.8 * t) / sr; d[s + i] += Math.sin(2 * Math.PI * ph) * Math.sin(Math.PI * t) * a; }
    }
    biquad(d, sr, 'lp', 1400);
    const x = Math.floor(0.12 * sr);
    for (let i = 0; i < x; i++) { const a = i / x; d[i] = d[i] * a + d[d.length - x + i] * (1 - a); }
  }),
  rumble: (ctx) => makeBuf(ctx, 2.5, (d, sr) => {
    noise(d); biquad(d, sr, 'lp', 120); biquad(d, sr, 'lp', 160);
    for (let i = 0; i < d.length; i++) d[i] *= env(i, sr, 0.05, 0.9);
  }),
  magic: (ctx) => makeBuf(ctx, 0.9, (d, sr) => {
    pings(d, sr, 18, 1200, 4800, 0.6, 0.08, 0.25, 0.4);
    for (let i = 0; i < d.length; i++) d[i] *= Math.sin(Math.PI * i / d.length);
  }),
  bell: (ctx) => makeBuf(ctx, 0.6, (d, sr) => {
    const f = 1320;
    for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.4 * t)) * Math.exp(-t / 0.18); }
  }),
  sting: (ctx) => makeBuf(ctx, 2.2, (d, sr) => {
    const notes = [73.42, 87.31, 110, 146.83, 174.61, 207.65]; // Dm add tritone
    for (const f of notes) {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        ph += f * (1 + 0.003 * Math.sin(5 * t)) / sr;
        d[i] += ((ph % 1) * 2 - 1) * 0.2 * env(i, sr, 0.02, 0.8);
      }
    }
    biquad(d, sr, 'lp', 1800);
  }),
  click: (ctx) => makeBuf(ctx, 0.04, (d, sr) => { for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 1800 * i / sr) * env(i, sr, 0.001, 0.008); }),
  hover: (ctx) => makeBuf(ctx, 0.05, (d, sr) => { for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 900 * i / sr) * env(i, sr, 0.002, 0.012) * 0.5; }),
  splash: (ctx) => makeBuf(ctx, 0.6, (d, sr) => { noise(d); biquad(d, sr, 'bp', 1500, 0.6); for (let i = 0; i < d.length; i++) d[i] *= env(i, sr, 0.005, 0.15); }),
  // cat hiss: breathy band-limited noise with a sharp onset and a spitting stutter
  hiss: (ctx) => makeBuf(ctx, 0.75, (d, sr) => {
    noise(d); biquad(d, sr, 'bp', 4200, 0.5); biquad(d, sr, 'hp', 1800);
    for (let i = 0; i < d.length; i++) {
      const t = i / sr;
      const a = Math.min(1, t / 0.025) * Math.max(0, 1 - Math.max(0, t - 0.45) / 0.3);
      d[i] *= a * (0.75 + 0.25 * Math.sin(2 * Math.PI * 23 * t)) * (t > 0.08 && t < 0.11 ? 0.35 : 1);
    }
  }),
  // claws skittering on floorboards: rapid irregular ticks over a scrape
  skitter: (ctx) => makeBuf(ctx, 0.45, (d, sr) => {
    noise(d, 0, d.length, 0.25); biquad(d, sr, 'bp', 3200, 1.2);
    let next = 0;
    for (let i = 0; i < d.length; i++) {
      if (i >= next) { const len = Math.floor(sr * 0.004); for (let k = 0; k < len && i + k < d.length; k++) d[i + k] += (Math.random() * 2 - 1) * (1 - k / len); next = i + Math.floor(sr * rnd(0.018, 0.04)); }
      d[i] *= Math.sin(Math.PI * i / d.length);
    }
  }),
};

export function makeAll(ctx) {
  const out = {};
  for (const [k, fn] of Object.entries(RECIPES)) {
    const variants = ['glass', 'ceramic', 'wood', 'metal', 'creak'].includes(k) ? 3 : 1;
    out[k] = [];
    for (let v = 0; v < variants; v++) out[k].push(fn(ctx));
  }
  return out;
}
