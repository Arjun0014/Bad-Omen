import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// Shared materials + procedural canvas textures for the cottage.

const loader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 4;

export function setAnisotropy(n) { maxAniso = Math.min(8, n); }

function setupTex(t, srgb) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function loadTex(url, srgb) {
  if (texCache.has(url)) return texCache.get(url);
  const t = setupTex(loader.load(url), srgb);
  texCache.set(url, t);
  return t;
}

const ASSETS = (import.meta.env?.BASE_URL ?? '/') + 'assets/';
const BASE = ASSETS + 'textures/';
const WOOD_SETS = ['bamboo_wall_03', 'bark_brown_02', 'brown_planks_09', 'moss_wood', 'rough_wood', 'wood_table', 'wood_trunk_wall', 'wooden_floor_02'];

/** KTX2 (Basis Universal) versions of the wood textures, transcoded on load to the GPU's block compression (BC7 on
 *  desktop): a quarter of the video memory of the JPGs, which upload as RGBA8 (measured: 112 -> 28 MB, ~2% more
 *  fps, no visible difference).  Loaded once before the first world is built; loadTex() then hands out the cached
 *  textures under the JPG urls.  All or nothing: on any failure or a stall the JPGs are used instead. */
export async function preloadCompressedTextures(renderer, timeoutMs = 45000) {
  const ktx = new KTX2Loader().setTranscoderPath(`${ASSETS}basis/`).detectSupport(renderer);
  let timer;
  try {
    const jobs = [];
    for (const name of WOOD_SETS) {
      for (const [suffix, srgb] of [['diff', true], ['nor', false], ['arm', false]]) {
        const url = `${BASE}${name}_${suffix}.jpg`;
        jobs.push(ktx.loadAsync(`${BASE}ktx2/${name}_${suffix}.ktx2`).then((t) => { t.userData.jpgUrl = url; return { url, t: setupTex(t, srgb) }; }));
      }
    }
    const all = Promise.all(jobs);
    all.catch(() => {}); // a late failure after a timeout must not surface as an unhandled rejection
    const done = await Promise.race([all, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('KTX2 textures timed out')), timeoutMs); })]);
    for (const { url, t } of done) texCache.set(url, t);
  } finally {
    clearTimeout(timer);
    ktx.dispose(); // its transcoder workers
  }
}

export function woodSet(name) {
  return {
    map: loadTex(`${BASE}${name}_diff.jpg`, true),
    normalMap: loadTex(`${BASE}${name}_nor.jpg`, false),
    arm: loadTex(`${BASE}${name}_arm.jpg`, false),
  };
}

const matCache = new Map();
export function woodMat(name, { tint = 0xffffff, rough = 1, normal = 0.9, emissive = 0x000000, key } = {}) {
  const k = key || `${name}|${tint}|${rough}|${normal}|${emissive}`;
  if (matCache.has(k)) return matCache.get(k);
  const s = woodSet(name);
  const m = new THREE.MeshStandardMaterial({
    map: s.map, normalMap: s.normalMap, roughnessMap: s.arm, aoMap: s.arm, metalnessMap: s.arm,
    color: tint, roughness: rough, metalness: 1.0, emissive,
  });
  m.normalScale.set(normal, normal);
  m.aoMapIntensity = 0.8;
  matCache.set(k, m);
  return m;
}

export function colorMat(color, { rough = 0.8, metal = 0, emissive = 0x000000, emissiveIntensity = 1, transparent = false, opacity = 1, side, key, flat = false } = {}) {
  const k = key || `c|${color}|${rough}|${metal}|${emissive}|${emissiveIntensity}|${transparent}|${opacity}|${side}|${flat}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity, transparent, opacity, flatShading: flat });
  if (side !== undefined) m.side = side;
  if (transparent) m.depthWrite = false;
  matCache.set(k, m);
  return m;
}

export function canvasMat(key, draw, size = 512, opts = {}) {
  if (matCache.has(key)) return matCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: opts.rough ?? 0.9, metalness: 0, color: opts.tint ?? 0xffffff,
    emissive: opts.emissive ?? 0x000000, emissiveMap: opts.emissive ? t : null, emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent, side: opts.side ?? THREE.FrontSide });
  if (opts.transparent) m.alphaTest = 0.05;
  matCache.set(key, m);
  return m;
}

// ---- seeded random for deterministic procedural art
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s & 0xffffff) / 0x1000000; };
}

function noiseFill(ctx, size, base, spread, seed, alpha = 0.06, count = 1800) {
  const r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const v = Math.floor((r() - 0.5) * spread);
    ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 240 : 0},${v > 0 ? 220 : 0},${Math.abs(v) / spread * alpha * 2})`;
    const s = 2 + r() * 18;
    ctx.fillRect(r() * size, r() * size, s, s * (0.3 + r()));
  }
}

export const Mats = {
  wallpaper: () => canvasMat('wallpaper', (ctx, s) => {
    noiseFill(ctx, s, '#2d2438', 60, 7, 0.08);
    // creepy damask: moons + eyes + vines
    const r = rng(42);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * s / 4 + (y % 2) * s / 8 + s / 16, cy = y * s / 4 + s / 8;
      ctx.strokeStyle = 'rgba(160,120,70,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, s / 18, s / 11, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(190,150,80,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, s / 60, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(110,150,90,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - s / 12, cy + s / 10);
      ctx.bezierCurveTo(cx - s / 20, cy - s / 30, cx + s / 20, cy + s / 30, cx + s / 12, cy - s / 10); ctx.stroke();
      if (r() < 0.3) { ctx.fillStyle = 'rgba(200,170,90,0.4)'; ctx.font = `${s / 20}px serif`; ctx.fillText('☾', cx + s / 14, cy - s / 14); }
    }
    // water stains
    for (let i = 0; i < 6; i++) {
      const g = ctx.createRadialGradient(r() * s, r() * s, 2, r() * s, r() * s, s / 5);
      g.addColorStop(0, 'rgba(60,40,20,0.25)'); g.addColorStop(1, 'rgba(60,40,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    }
  }, 512, { rough: 0.85 }),
  plaster: () => canvasMat('plaster', (ctx, s) => {
    noiseFill(ctx, s, '#8a7656', 70, 3, 0.1, 2600);
    const r = rng(9);
    ctx.strokeStyle = 'rgba(50,35,20,0.5)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      let x = r() * s, y = r() * s; ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 50; y += r() * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, 512, { rough: 0.95 }),
  stone: () => canvasMat('stone', (ctx, s) => {
    ctx.fillStyle = '#4a4a52'; ctx.fillRect(0, 0, s, s);
    const r = rng(5);
    const rows = 8;
    for (let y = 0; y < rows; y++) {
      let x = -(y % 2) * 30;
      while (x < s) {
        const w = 50 + r() * 60, h = s / rows;
        const g = 70 + Math.floor(r() * 40);
        ctx.fillStyle = `rgb(${g},${g - 2},${g + 6})`;
        ctx.fillRect(x + 3, y * h + 3, w - 6, h - 6);
        ctx.fillStyle = 'rgba(30,60,30,0.25)';
        if (r() < 0.3) ctx.fillRect(x + 3, y * h + h * 0.6, w - 6, h * 0.35);
        x += w;
      }
    }
  }, 512, { rough: 0.95 }),
  shingles: () => canvasMat('shingles', (ctx, s) => {
    ctx.fillStyle = '#231c1c'; ctx.fillRect(0, 0, s, s);
    const r = rng(11);
    const rows = 10, h = s / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = -((y % 2) * 24); x < s; x += 48) {
        const g = 40 + Math.floor(r() * 30);
        ctx.fillStyle = `rgb(${g + 10},${g},${g + 4})`;
        ctx.beginPath(); ctx.moveTo(x + 2, y * h); ctx.lineTo(x + 46, y * h); ctx.lineTo(x + 46, y * h + h - 4);
        ctx.quadraticCurveTo(x + 24, y * h + h + 6, x + 2, y * h + h - 4); ctx.fill();
      }
    }
  }, 512, { rough: 0.9 }),
  rug: () => canvasMat('rug', (ctx, s) => {
    ctx.fillStyle = '#5a1620'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#c99a3c'; ctx.lineWidth = 10; ctx.strokeRect(20, 20, s - 40, s - 40);
    ctx.strokeStyle = '#2a0a10'; ctx.lineWidth = 6; ctx.strokeRect(44, 44, s - 88, s - 88);
    ctx.fillStyle = '#c99a3c';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(s / 2, s / 2, 30 + i * 30, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = i % 2 ? '#2a0a10' : '#c99a3c'; ctx.stroke(); }
    ctx.font = `${s / 5}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☽', s / 2, s / 2);
  }, 512, { rough: 1 }),
  grass: () => canvasMat('grass', (ctx, s) => {
    noiseFill(ctx, s, '#2b3a22', 80, 21, 0.12, 4000);
    const r = rng(77);
    for (let i = 0; i < 2500; i++) {
      ctx.strokeStyle = `rgba(${60 + r() * 50},${90 + r() * 60},${40 + r() * 30},0.6)`;
      const x = r() * s, y = r() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 8); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const g = ctx.createRadialGradient(r() * s, r() * s, 4, r() * s, r() * s, 60);
      g.addColorStop(0, 'rgba(60,45,30,0.6)'); g.addColorStop(1, 'rgba(60,45,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    }
  }, 512, { rough: 1 }),
  portrait: (seed) => canvasMat('portrait' + seed, (ctx, s) => {
    const r = rng(seed * 31 + 7);
    const bg = ['#2b3b2b', '#3b2b3b', '#2b2b3b', '#3b302b'][seed % 4];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
    const g = ctx.createRadialGradient(s / 2, s * 0.4, 10, s / 2, s / 2, s * 0.7);
    g.addColorStop(0, 'rgba(255,220,160,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    // figure: an old relative (or a cat, sometimes)
    const isCat = seed % 3 === 2;
    ctx.fillStyle = isCat ? '#111' : '#4a3a5a';
    ctx.beginPath(); ctx.ellipse(s / 2, s * 0.95, s * 0.32, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isCat ? '#151515' : '#c9a98a';
    ctx.beginPath(); ctx.ellipse(s / 2, s * 0.45, s * 0.17, s * 0.21, 0, 0, Math.PI * 2); ctx.fill();
    if (isCat) {
      ctx.beginPath(); ctx.moveTo(s * 0.36, s * 0.32); ctx.lineTo(s * 0.4, s * 0.16); ctx.lineTo(s * 0.46, s * 0.28); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.64, s * 0.32); ctx.lineTo(s * 0.6, s * 0.16); ctx.lineTo(s * 0.54, s * 0.28); ctx.fill();
      ctx.fillStyle = '#ffae1a';
    } else {
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.ellipse(s / 2, s * 0.28, s * 0.18, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
    }
    // eyes that follow you (well, glow)
    ctx.beginPath(); ctx.arc(s * 0.44, s * 0.44, s * 0.025, 0, Math.PI * 2); ctx.arc(s * 0.56, s * 0.44, s * 0.025, 0, Math.PI * 2); ctx.fill();
    if (!isCat) { ctx.strokeStyle = '#5a3a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s / 2, s * 0.58, s * 0.05, 0.2 * Math.PI, 0.8 * Math.PI, true); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(r() * s, r() * s); ctx.lineTo(r() * s, r() * s); ctx.stroke(); }
  }, 256, { rough: 0.6 }),
  sign: (text, key) => canvasMat('sign' + key, (ctx, s) => {
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, s, s / 2);
    ctx.fillStyle = '#e8d5a0'; ctx.font = `bold ${s / 9}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, s / 2, s / 4 + (i - (lines.length - 1) / 2) * s / 8));
  }, 512, { rough: 0.9 }),
};

export const TEX_SLOTS = ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'lightMap'];

/** Textures every world rebuild reuses (loaded wood sets, glow sprites, cached canvas materials). */
export function sharedTextures() {
  const s = new Set(texCache.values());
  for (const m of matCache.values()) for (const k of TEX_SLOTS) if (m[k]) s.add(m[k]);
  return s;
}

/** Box geometry whose UVs are scaled to world size (tile metres per texture repeat). */
export function boxGeo(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z ; 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su / tile, uv.getY(idx) * sv / tile);
    }
  }
  uv.needsUpdate = true;
  return g;
}

export function glowSpriteTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = 'glow' + inner + outer;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}
