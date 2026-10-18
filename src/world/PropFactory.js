import * as THREE from 'three';
import { boxGeo, woodMat, colorMat, Mats, rng } from './Materials.js';

/*
  Procedural prop builder.  Every prop is a THREE.Group whose origin sits at the
  bottom centre.  Parts are recorded so the destruction system can turn them into
  physical fragments, and parts flagged `col` become collider shapes.
*/

const TIERS = {
  fragile: { dynamic: true, hp: 1, breakDv: 3.0, score: 50, ruin: 0.3, noise: 9 },
  movable: { dynamic: true, hp: 40, breakDv: 8.5, score: 150, ruin: 0.7, noise: 7 },
  fixture: { dynamic: false, hp: 90, breakDv: 99, score: 350, ruin: 2.5, noise: 14 },
  structural: { dynamic: false, hp: 100, breakDv: 99, score: 1000, ruin: 6, noise: 18, requiresGranny: true },
  spectacle: { dynamic: false, hp: 9999, breakDv: 99, score: 0, ruin: 0, noise: 18 },
};

export class PartBuilder {
  constructor() {
    this.group = new THREE.Group();
    this.parts = [];
  }
  _add(mesh, info) {
    mesh.castShadow = info.shadow !== false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.parts.push({ mesh, ...info });
    return mesh;
  }
  box(mat, x, y, z, w, h, d, o = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, o.tile ?? 0.8), mat);
    m.position.set(x, y, z);
    if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    return this._add(m, { type: 'box', w, h, d, col: o.col !== false, frag: o.frag ?? 'wood', shadow: o.shadow });
  }
  cyl(mat, x, y, z, rt, rb, h, o = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 12), mat);
    m.position.set(x, y, z);
    if (o.rx || o.ry || o.rz) m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    const r = Math.max(rt, rb);
    return this._add(m, { type: 'cyl', r, h, w: r * 2, d: r * 2, col: o.col !== false, frag: o.frag ?? 'wood', shadow: o.shadow });
  }
  sphere(mat, x, y, z, r, o = {}) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 12, Math.max(6, (o.seg ?? 12) - 4)), mat);
    m.position.set(x, y, z);
    if (o.sy) m.scale.y = o.sy;
    return this._add(m, { type: 'ball', r, w: r * 2, h: r * 2 * (o.sy ?? 1), d: r * 2, col: o.col !== false, frag: o.frag ?? 'ceramic', shadow: o.shadow });
  }
  lathe(mat, profile, x, y, z, o = {}) {
    const pts = profile.map(([r, h]) => new THREE.Vector2(r, h));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, o.seg ?? 14), mat);
    m.position.set(x, y, z);
    const r = Math.max(...profile.map((p) => p[0]));
    const h = Math.max(...profile.map((p) => p[1]));
    return this._add(m, { type: 'cylLathe', r, h, w: r * 2, d: r * 2, cy: h / 2, col: o.col !== false, frag: o.frag ?? 'ceramic', shadow: o.shadow });
  }
  deco(obj) { this.group.add(obj); return obj; } // non-part visual (light, sprite)
}

const W = () => ({
  dark: woodMat('wood_table', { tint: 0x7a5a48, key: 'propDark' }),
  mid: woodMat('wood_table', { tint: 0xb89878, key: 'propMid' }),
  rough: woodMat('rough_wood', { tint: 0x9a8070, key: 'propRough' }),
  planks: woodMat('brown_planks_09', { tint: 0xa08870, key: 'propPlanks' }),
  moss: woodMat('moss_wood', { key: 'propMoss' }),
});

const C = {
  porcelain: () => colorMat(0xe8e4dc, { rough: 0.25, key: 'porcelain' }),
  bluePorcelain: () => colorMat(0x3a5ea8, { rough: 0.25, key: 'bluePorc' }),
  greenGlaze: () => colorMat(0x3f7a52, { rough: 0.3, key: 'greenGlaze' }),
  purpleGlaze: () => colorMat(0x6a3a8a, { rough: 0.3, key: 'purpleGlaze' }),
  terracotta: () => colorMat(0xa0522d, { rough: 0.85, key: 'terracotta' }),
  bottleGreen: () => colorMat(0x2f6b3a, { rough: 0.1, metal: 0.1, transparent: true, opacity: 0.75, key: 'bottleGreen' }),
  bottleBrown: () => colorMat(0x6b3f1f, { rough: 0.1, metal: 0.1, transparent: true, opacity: 0.8, key: 'bottleBrown' }),
  glass: () => colorMat(0xbfe3ef, { rough: 0.05, metal: 0.2, transparent: true, opacity: 0.32, key: 'propGlass' }),
  potionGreen: () => colorMat(0x55ff66, { rough: 0.2, emissive: 0x33dd44, emissiveIntensity: 1.4, key: 'potG' }),
  potionPurple: () => colorMat(0xb055ff, { rough: 0.2, emissive: 0x8833dd, emissiveIntensity: 1.4, key: 'potP' }),
  potionOrange: () => colorMat(0xff9a33, { rough: 0.2, emissive: 0xdd6611, emissiveIntensity: 1.4, key: 'potO' }),
  iron: () => colorMat(0x2b2b30, { rough: 0.45, metal: 0.85, key: 'propIron' }),
  copper: () => colorMat(0xb06a3a, { rough: 0.35, metal: 0.9, key: 'copper' }),
  brass: () => colorMat(0xc9a04a, { rough: 0.3, metal: 0.9, key: 'brass' }),
  wax: () => colorMat(0xf2ead2, { rough: 0.6, key: 'wax' }),
  flame: () => colorMat(0xffb040, { emissive: 0xff9020, emissiveIntensity: 3, key: 'flame' }),
  fabricRed: () => colorMat(0x6a1a24, { rough: 1, key: 'fabRed' }),
  fabricPurple: () => colorMat(0x5a3a6e, { rough: 0.95, key: 'fabPurple' }),
  fabricGreen: () => colorMat(0x4f6b4a, { rough: 0.95, key: 'fabGreen' }),
  fabricGreenLight: () => colorMat(0x62805a, { rough: 0.95, key: 'fabGreenL' }),
  linen: () => colorMat(0xcfc6b0, { rough: 1, key: 'linen' }),
  bone: () => colorMat(0xe6dcc0, { rough: 0.6, key: 'bone' }),
  black: () => colorMat(0x111111, { rough: 0.8, key: 'propBlack' }),
  gold: () => colorMat(0xd4a83a, { rough: 0.3, metal: 1, key: 'gold' }),
  stone: () => Mats.stone(),
  herb: () => colorMat(0x5a6a2a, { rough: 1, key: 'herb' }),
  pumpkin: () => colorMat(0xd2691e, { rough: 0.7, key: 'pumpkin' }),
  mirror: () => colorMat(0xd8e8f0, { rough: 0.02, metal: 1, key: 'mirror' }),
  bookColors: [0x5a1a1a, 0x1a3a5a, 0x2a4a1a, 0x4a3a1a, 0x3a1a4a, 0x6a4a2a],
};

// ----------------------------------------------------------------------------- kinds
export const KINDS = {
  // ---------------- fragile (tier A)
  vase(pb, o) {
    const mats = [C.bluePorcelain, C.greenGlaze, C.purpleGlaze, C.porcelain];
    const m = mats[(o.variant ?? 0) % mats.length]();
    pb.lathe(m, [[0.0, 0], [0.07, 0.0], [0.1, 0.06], [0.11, 0.16], [0.06, 0.28], [0.05, 0.33], [0.075, 0.36], [0.0, 0.36]], 0, 0, 0);
    return { tier: 'fragile', family: 'ceramics', material: 'ceramic', mass: 1.2, score: 60 };
  },
  urn(pb, o) {
    pb.lathe(o.variant ? C.greenGlaze() : C.purpleGlaze(), [[0, 0], [0.12, 0], [0.18, 0.1], [0.2, 0.3], [0.12, 0.5], [0.1, 0.56], [0.14, 0.6], [0, 0.6]], 0, 0, 0);
    return { tier: 'fragile', family: 'ceramics', material: 'ceramic', mass: 4, score: 120, breakDv: 3.0 };
  },
  plate(pb) {
    pb.cyl(C.porcelain(), 0, 0.01, 0, 0.12, 0.09, 0.02, { seg: 14, frag: 'ceramic' });
    pb.cyl(C.bluePorcelain(), 0, 0.021, 0, 0.07, 0.07, 0.002, { seg: 14, col: false, frag: 'ceramic', shadow: false });
    return { tier: 'fragile', family: 'tableware', material: 'ceramic', mass: 0.4, score: 40, breakDv: 2.6 };
  },
  cup(pb) {
    pb.lathe(C.porcelain(), [[0, 0], [0.035, 0], [0.045, 0.07], [0.048, 0.08], [0, 0.08]], 0, 0, 0, { seg: 10 });
    return { tier: 'fragile', family: 'tableware', material: 'ceramic', mass: 0.2, score: 30, breakDv: 2.6 };
  },
  teapot(pb) {
    pb.sphere(C.bluePorcelain(), 0, 0.09, 0, 0.09, { sy: 0.85 });
    pb.cyl(C.bluePorcelain(), 0.1, 0.1, 0, 0.012, 0.02, 0.1, { rz: -0.9, col: false, frag: 'ceramic' });
    pb.sphere(C.porcelain(), 0, 0.17, 0, 0.025, { col: false });
    return { tier: 'fragile', family: 'tableware', material: 'ceramic', mass: 0.8, score: 80 };
  },
  bottle(pb, o) {
    pb.lathe(o.variant ? C.bottleBrown() : C.bottleGreen(), [[0, 0], [0.045, 0], [0.05, 0.16], [0.02, 0.22], [0.016, 0.28], [0, 0.28]], 0, 0, 0, { frag: 'glass' });
    return { tier: 'fragile', family: 'glassware', material: 'glass', mass: 0.5, score: 40 };
  },
  potion(pb, o) {
    const liquid = [C.potionGreen, C.potionPurple, C.potionOrange][(o.variant ?? 0) % 3]();
    pb.sphere(C.glass(), 0, 0.07, 0, 0.07, { frag: 'glass' });
    pb.sphere(liquid, 0, 0.06, 0, 0.055, { col: false, frag: 'glass', shadow: false });
    pb.cyl(C.glass(), 0, 0.15, 0, 0.018, 0.022, 0.06, { col: false, frag: 'glass' });
    return { tier: 'fragile', family: 'glassware', material: 'glass', mass: 0.4, score: 70, glow: liquid.color.getHex() };
  },
  jar(pb) {
    pb.cyl(C.glass(), 0, 0.1, 0, 0.07, 0.07, 0.2, { frag: 'glass' });
    pb.cyl(C.iron(), 0, 0.21, 0, 0.075, 0.075, 0.02, { col: false });
    for (let i = 0; i < 3; i++) pb.sphere(C.bone(), (i - 1) * 0.03, 0.05 + i * 0.03, 0.01, 0.022, { col: false, shadow: false }); // pickled eyeballs
    return { tier: 'fragile', family: 'glassware', material: 'glass', mass: 0.8, score: 70 };
  },
  candle(pb) {
    pb.cyl(C.brass(), 0, 0.015, 0, 0.05, 0.06, 0.03, { frag: 'metal' });
    pb.cyl(C.wax(), 0, 0.12, 0, 0.022, 0.025, 0.18, { frag: 'wax' });
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), C.flame()); f.position.set(0, 0.225, 0); f.scale.y = 1.8;
    pb.deco(f);
    return { tier: 'fragile', family: 'candles', material: 'wax', mass: 0.4, score: 30, breakDv: 3.5, flame: true };
  },
  oillamp(pb) {
    pb.cyl(C.brass(), 0, 0.03, 0, 0.06, 0.07, 0.06, { frag: 'metal' });
    pb.sphere(C.glass(), 0, 0.12, 0, 0.06, { frag: 'glass' });
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), C.flame()); f.position.set(0, 0.12, 0); f.scale.y = 1.6;
    pb.deco(f);
    return { tier: 'fragile', family: 'candles', material: 'glass', mass: 0.6, score: 90, flame: true, tags: ['ignite'] };
  },
  skull(pb) {
    pb.sphere(C.bone(), 0, 0.08, 0, 0.08, { sy: 0.95 });
    pb.box(C.bone(), 0, 0.03, 0.04, 0.09, 0.05, 0.07, { col: false, frag: 'ceramic' });
    pb.sphere(C.black(), -0.03, 0.09, 0.07, 0.018, { col: false, shadow: false });
    pb.sphere(C.black(), 0.03, 0.09, 0.07, 0.018, { col: false, shadow: false });
    return { tier: 'fragile', family: 'curios', material: 'ceramic', mass: 1, score: 90 };
  },
  crystalball(pb) {
    pb.cyl(C.brass(), 0, 0.03, 0, 0.07, 0.09, 0.06, { frag: 'metal' });
    const ball = pb.sphere(colorMat(0x9fd8ff, { rough: 0.05, emissive: 0x4a7aff, emissiveIntensity: 1.2, transparent: true, opacity: 0.8, key: 'crystal' }), 0, 0.15, 0, 0.09, { frag: 'glass' });
    ball.castShadow = false;
    return { tier: 'fragile', family: 'curios', material: 'glass', mass: 2, score: 150, glow: 0x6a9aff };
  },
  flowerpot(pb) {
    pb.lathe(C.terracotta(), [[0, 0], [0.1, 0], [0.13, 0.2], [0.14, 0.22], [0, 0.22]], 0, 0, 0);
    pb.sphere(C.herb(), 0, 0.27, 0, 0.11, { col: false, frag: 'plant' });
    return { tier: 'fragile', family: 'garden', material: 'ceramic', mass: 3, score: 60, breakDv: 3.6 };
  },
  pumpkin(pb) {
    pb.sphere(C.pumpkin(), 0, 0.13, 0, 0.17, { sy: 0.75, frag: 'plant' });
    pb.cyl(C.herb(), 0, 0.27, 0, 0.015, 0.02, 0.06, { col: false });
    return { tier: 'fragile', family: 'garden', material: 'plant', mass: 4, score: 80, breakDv: 4.2 };
  },

  // ---------------- movable (tier B)
  chair(pb, o) {
    const w = W();
    const m = o.variant ? w.mid : w.dark;
    pb.box(m, 0, 0.45, 0, 0.44, 0.05, 0.44);
    for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) pb.box(m, x, 0.21, z, 0.045, 0.43, 0.045, { col: false });
    pb.box(m, 0, 0.78, -0.2, 0.44, 0.6, 0.045);
    pb.box(m, 0, 0.98, -0.2, 0.5, 0.1, 0.06, { col: false });
    return { tier: 'movable', family: 'chairs', material: 'wood', mass: 6, score: 180, hp: 35, solidBottom: true };
  },
  stool(pb) {
    const w = W();
    pb.cyl(w.mid, 0, 0.5, 0, 0.18, 0.18, 0.05, { seg: 10 });
    for (let i = 0; i < 3; i++) { const a = i * 2.094; pb.box(w.dark, Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12, 0.04, 0.48, 0.04, { col: false }); }
    return { tier: 'movable', family: 'chairs', material: 'wood', mass: 3, score: 120, hp: 25, solidBottom: true };
  },
  book(pb, o) {
    const col = C.bookColors[(o.variant ?? 0) % C.bookColors.length];
    const h = 0.2 + ((o.variant ?? 0) % 3) * 0.03;
    pb.box(colorMat(col, { rough: 0.8, key: 'book' + col }), 0, h / 2, 0, 0.05, h, 0.16, { frag: 'paper' });
    pb.box(C.linen(), 0.003, h / 2, 0.005, 0.044, h - 0.01, 0.15, { col: false, frag: 'paper', shadow: false });
    return { tier: 'fragile', family: 'books', material: 'paper', mass: 0.6, score: 25, breakDv: 6.5, noise: 4 };
  },
  pan(pb) {
    pb.cyl(C.iron(), 0, 0.025, 0, 0.14, 0.12, 0.05, { frag: 'metal' });
    pb.box(C.iron(), 0.25, 0.04, 0, 0.22, 0.025, 0.035, { frag: 'metal' });
    return { tier: 'movable', family: 'cookware', material: 'metal', mass: 2.5, score: 60, hp: 999, unbreakable: true };
  },
  pot(pb) {
    pb.cyl(C.copper(), 0, 0.09, 0, 0.13, 0.12, 0.18, { frag: 'metal' });
    pb.box(C.copper(), 0.15, 0.15, 0, 0.06, 0.02, 0.03, { col: false });
    pb.box(C.copper(), -0.15, 0.15, 0, 0.06, 0.02, 0.03, { col: false });
    return { tier: 'movable', family: 'cookware', material: 'metal', mass: 3, score: 60, hp: 999, unbreakable: true };
  },
  crate(pb) {
    const w = W();
    pb.box(w.planks, 0, 0.25, 0, 0.5, 0.5, 0.5);
    return { tier: 'movable', family: 'crates', material: 'wood', mass: 9, score: 150, hp: 30 };
  },
  bucket(pb) {
    pb.cyl(W().planks, 0, 0.15, 0, 0.15, 0.12, 0.3);
    return { tier: 'movable', family: 'crates', material: 'wood', mass: 3, score: 60, hp: 20 };
  },
  umbrellastand(pb) {
    pb.lathe(C.bluePorcelain(), [[0, 0], [0.13, 0], [0.14, 0.5], [0.15, 0.55], [0, 0.55]], 0, 0, 0);
    pb.cyl(C.black(), 0.04, 0.75, 0, 0.012, 0.012, 0.6, { rz: 0.12, col: false, frag: 'wood' });
    pb.cyl(C.fabricPurple(), -0.04, 0.72, 0.02, 0.012, 0.012, 0.55, { rz: -0.1, col: false, frag: 'wood' });
    return { tier: 'fragile', family: 'ceramics', material: 'ceramic', mass: 5, score: 140, breakDv: 3.4 };
  },
  coatstand(pb) {
    const w = W();
    pb.cyl(w.dark, 0, 0.9, 0, 0.03, 0.035, 1.8, { seg: 8 });
    pb.cyl(w.dark, 0, 0.03, 0, 0.25, 0.25, 0.05, { seg: 10 });
    pb.box(C.fabricPurple(), 0.08, 1.35, 0, 0.12, 0.6, 0.28, { col: false, frag: 'cloth' }); // shawl
    pb.cyl(C.black(), -0.05, 1.82, 0, 0.13, 0.13, 0.03, { col: false }); // witch hat brim
    pb.cyl(C.black(), -0.05, 2.0, 0, 0.0, 0.09, 0.32, { col: false });
    return { tier: 'movable', family: 'chairs', material: 'wood', mass: 7, score: 160, hp: 30 };
  },
  broom(pb) {
    const w = W();
    pb.cyl(w.rough, 0, 0.75, 0, 0.018, 0.018, 1.2, { seg: 6 });
    pb.cyl(colorMat(0xb8a060, { rough: 1, key: 'straw' }), 0, 0.12, 0, 0.04, 0.12, 0.28, { seg: 8, frag: 'plant' });
    return { tier: 'movable', family: 'tools', material: 'wood', mass: 1.5, score: 50, hp: 15 };
  },
  barrel(pb) {
    pb.lathe(W().planks, [[0, 0], [0.24, 0], [0.29, 0.4], [0.24, 0.8], [0, 0.8]], 0, 0, 0, { seg: 12, frag: 'wood' });
    pb.cyl(C.iron(), 0, 0.2, 0, 0.275, 0.275, 0.03, { col: false, seg: 12 });
    pb.cyl(C.iron(), 0, 0.6, 0, 0.275, 0.275, 0.03, { col: false, seg: 12 });
    return { tier: 'movable', family: 'crates', material: 'wood', mass: 30, score: 200, hp: 40 };
  },
  wheelbarrow(pb) {
    const w = W();
    pb.box(w.planks, 0, 0.45, 0, 0.6, 0.25, 0.8);
    pb.cyl(C.iron(), 0, 0.15, 0.45, 0.15, 0.15, 0.06, { rz: Math.PI / 2, frag: 'metal' });
    pb.box(w.rough, -0.25, 0.35, -0.55, 0.04, 0.04, 0.6, { col: false });
    pb.box(w.rough, 0.25, 0.35, -0.55, 0.04, 0.04, 0.6, { col: false });
    // the two rest legs at the back (it used to tip back onto its tray)
    pb.box(w.rough, -0.22, 0.165, -0.3, 0.045, 0.33, 0.045);
    pb.box(w.rough, 0.22, 0.165, -0.3, 0.045, 0.33, 0.045);
    return { tier: 'movable', family: 'garden', material: 'wood', mass: 18, score: 220, hp: 40 };
  },

  // ---------------- fixtures (tier C)  — static until broken
  table(pb, o) {
    const w = W();
    const L = o.len ?? 1.8, D = o.depth ?? 0.95, H = o.h ?? 0.76;
    pb.box(w.mid, 0, H - 0.03, 0, L, 0.06, D);
    for (const [x, z] of [[-L / 2 + 0.08, -D / 2 + 0.08], [L / 2 - 0.08, -D / 2 + 0.08], [-L / 2 + 0.08, D / 2 - 0.08], [L / 2 - 0.08, D / 2 - 0.08]])
      pb.box(w.dark, x, (H - 0.06) / 2, z, 0.08, H - 0.06, 0.08);
    pb.box(w.dark, 0, H - 0.1, 0, L - 0.2, 0.08, 0.04, { col: false });
    return { tier: 'fixture', family: 'tables', material: 'wood', score: 300, hp: 70, hideUnder: L > 1 };
  },
  roundtable(pb) {
    const w = W();
    pb.cyl(w.mid, 0, 0.6, 0, 0.36, 0.36, 0.04, { seg: 14 });
    pb.cyl(w.dark, 0, 0.3, 0, 0.04, 0.06, 0.58, { seg: 8 });
    pb.cyl(w.dark, 0, 0.02, 0, 0.2, 0.22, 0.04, { seg: 10 });
    return { tier: 'fixture', family: 'tables', material: 'wood', score: 220, hp: 45 };
  },
  desk(pb) {
    const w = W();
    pb.box(w.dark, 0, 0.74, 0, 1.3, 0.05, 0.65);
    pb.box(w.dark, -0.5, 0.36, 0, 0.3, 0.72, 0.6);
    pb.box(w.dark, 0.6, 0.36, 0, 0.06, 0.72, 0.6);
    return { tier: 'fixture', family: 'tables', material: 'wood', score: 320, hp: 70 };
  },
  cabinet(pb) { // glass display cabinet with shelves (cups/plates placed separately)
    const w = W();
    const Wd = 1.0, D = 0.42, H = 1.9;
    pb.box(w.dark, 0, 0.05, 0, Wd, 0.1, D);
    pb.box(w.dark, 0, H - 0.04, 0, Wd + 0.06, 0.08, D + 0.04);
    pb.box(w.dark, -Wd / 2 + 0.03, H / 2, 0, 0.06, H, D);
    pb.box(w.dark, Wd / 2 - 0.03, H / 2, 0, 0.06, H, D);
    pb.box(w.dark, 0, H / 2, -D / 2 + 0.02, Wd, H, 0.04);
    for (const y of [0.55, 1.0, 1.45]) pb.box(w.mid, 0, y, 0, Wd - 0.1, 0.03, D - 0.06);
    pb.box(C.glass(), 0, H / 2, D / 2 - 0.01, Wd - 0.1, H - 0.2, 0.01, { col: true, frag: 'glass', shadow: false });
    return { tier: 'fixture', family: 'cabinets', material: 'wood', score: 600, hp: 90, glassFront: true };
  },
  bookcase(pb) {
    const w = W();
    const Wd = 1.2, D = 0.34, H = 2.2;
    pb.box(w.dark, -Wd / 2 + 0.03, H / 2, 0, 0.06, H, D);
    pb.box(w.dark, Wd / 2 - 0.03, H / 2, 0, 0.06, H, D);
    pb.box(w.dark, 0, H / 2, -D / 2 + 0.015, Wd, H, 0.03);
    for (const y of [0.04, 0.55, 1.05, 1.55, 2.17]) pb.box(w.mid, 0, y, 0, Wd - 0.06, 0.05, D);
    return { tier: 'fixture', family: 'cabinets', material: 'wood', score: 600, hp: 100, shelves: [0.065, 0.575, 1.075, 1.575] };
  },
  shelf(pb, o) { // wall shelf; origin at bottom centre of the board
    const w = W();
    const L = o.len ?? 1.2;
    pb.box(w.mid, 0, 0.02, 0, L, 0.04, 0.24);
    pb.box(w.dark, -L / 2 + 0.1, -0.1, -0.08, 0.04, 0.2, 0.06, { col: false });
    pb.box(w.dark, L / 2 - 0.1, -0.1, -0.08, 0.04, 0.2, 0.06, { col: false });
    return { tier: 'fixture', family: 'shelves', material: 'wood', score: 200, hp: 40 };
  },
  wardrobe(pb) {
    const w = W();
    const Wd = 1.3, D = 0.62, H = 2.15;
    pb.box(w.dark, 0, H / 2, 0, Wd, H, D);
    pb.box(w.mid, -Wd / 4, H / 2 + 0.05, D / 2 + 0.01, Wd / 2 - 0.04, H - 0.3, 0.02, { col: false });
    pb.box(w.mid, Wd / 4, H / 2 + 0.05, D / 2 + 0.01, Wd / 2 - 0.04, H - 0.3, 0.02, { col: false });
    pb.box(w.dark, 0, H + 0.05, 0, Wd + 0.1, 0.1, D + 0.06, { col: false });
    pb.sphere(C.brass(), -0.05, 1.1, D / 2 + 0.03, 0.025, { col: false });
    pb.sphere(C.brass(), 0.05, 1.1, D / 2 + 0.03, 0.025, { col: false });
    return { tier: 'fixture', family: 'cabinets', material: 'wood', score: 700, hp: 140 };
  },
  bed(pb) {
    const w = W();
    const L = 2.0, Wd = 1.45, clr = 0.6;
    pb.box(w.dark, 0, clr + 0.05, 0, Wd, 0.1, L);
    pb.box(C.linen(), 0, clr + 0.2, 0.05, Wd - 0.08, 0.2, L - 0.15, { frag: 'cloth' });
    pb.box(C.fabricPurple(), 0, clr + 0.32, 0.25, Wd - 0.04, 0.06, L - 0.6, { col: false, frag: 'cloth' });
    pb.box(C.linen(), 0, clr + 0.36, -L / 2 + 0.3, 0.6, 0.12, 0.3, { col: false, frag: 'cloth' });
    pb.box(w.dark, 0, 0.75, -L / 2 + 0.03, Wd, 1.5, 0.08);
    pb.box(w.dark, 0, 0.5, L / 2 - 0.03, Wd, 1.0, 0.06, { col: false });
    for (const [x, z] of [[-Wd / 2 + 0.05, -L / 2 + 0.05], [Wd / 2 - 0.05, -L / 2 + 0.05], [-Wd / 2 + 0.05, L / 2 - 0.05], [Wd / 2 - 0.05, L / 2 - 0.05]])
      pb.box(w.dark, x, clr / 2, z, 0.08, clr, 0.08);
    return { tier: 'fixture', family: 'beds', material: 'wood', score: 500, hp: 120, hideUnder: true };
  },
  counter(pb, o) {
    const w = W();
    const L = o.len ?? 2.4;
    pb.box(w.planks, 0, 0.44, 0, L, 0.88, 0.6);
    pb.box(w.mid, 0, 0.9, 0, L + 0.04, 0.05, 0.64);
    return { tier: 'fixture', family: 'cabinets', material: 'wood', score: 350, hp: 150 };
  },
  sideboard(pb) {
    const w = W();
    pb.box(w.dark, 0, 0.42, 0, 1.6, 0.84, 0.5);
    pb.box(w.mid, 0, 0.86, 0, 1.66, 0.04, 0.54);
    return { tier: 'fixture', family: 'cabinets', material: 'wood', score: 400, hp: 90 };
  },
  sofa(pb) {
    // a Victorian chesterfield-ish sofa: the follow camera mostly sees its back, so that gets a rounded
    // top roll and feet instead of reading as a flat green slab
    const fab = C.fabricGreen(), cush = C.fabricGreenLight(), wd = W().dark;
    pb.box(fab, 0, 0.27, 0, 2.0, 0.38, 0.85, { frag: 'cloth' });
    pb.box(fab, 0, 0.66, -0.35, 2.0, 0.5, 0.18, { frag: 'cloth' });
    pb.box(fab, -0.95, 0.56, 0, 0.14, 0.3, 0.85, { frag: 'cloth' });
    pb.box(fab, 0.95, 0.56, 0, 0.14, 0.3, 0.85, { frag: 'cloth' });
    pb.cyl(fab, 0, 0.91, -0.35, 0.1, 0.1, 2.0, { rz: Math.PI / 2, seg: 12, frag: 'cloth' });         // rounded back top
    for (const x of [-0.95, 0.95]) pb.cyl(fab, x, 0.72, 0.0, 0.085, 0.085, 0.85, { rx: Math.PI / 2, seg: 10, frag: 'cloth' }); // rolled arms
    for (const x of [-0.44, 0.44]) {
      pb.box(cush, x, 0.515, 0.06, 0.84, 0.11, 0.66, { frag: 'cloth' });                                  // seat cushions
      pb.box(cush, x, 0.75, -0.21, 0.82, 0.34, 0.12, { rx: -0.14, col: false, frag: 'cloth' });            // back cushions
    }
    for (const [x, z] of [[-0.9, 0.34], [0.9, 0.34], [-0.9, -0.36], [0.9, -0.36]]) pb.box(wd, x, 0.04, z, 0.08, 0.08, 0.08, { col: false });
    return { tier: 'fixture', family: 'seating', material: 'fabric', score: 300, hp: 80 };
  },
  clock(pb) {
    const w = W();
    pb.box(w.dark, 0, 0.3, 0, 0.6, 0.6, 0.4);
    pb.box(w.dark, 0, 1.1, 0, 0.45, 1.0, 0.32);
    pb.box(w.dark, 0, 1.85, 0, 0.6, 0.5, 0.38);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), colorMat(0xe8dcc0, { rough: 0.5, key: 'clockface' }));
    face.position.set(0, 1.85, 0.195);
    pb.deco(face);
    pb.box(C.black(), 0.04, 1.88, 0.2, 0.02, 0.14, 0.01, { col: false, shadow: false });
    pb.box(C.black(), -0.02, 1.85, 0.2, 0.1, 0.015, 0.01, { col: false, shadow: false, rz: 0.4 });
    pb.cyl(C.brass(), 0, 0.95, 0.17, 0.08, 0.08, 0.02, { rx: Math.PI / 2, col: false, frag: 'metal' });
    return { tier: 'fixture', family: 'clocks', material: 'wood', score: 800, hp: 110 };
  },
  piano(pb) {
    const w = W();
    pb.box(colorMat(0x15100c, { rough: 0.3, key: 'pianoBlack' }), 0, 0.65, 0, 1.5, 1.3, 0.6);
    pb.box(C.porcelain(), 0, 0.74, 0.34, 1.3, 0.04, 0.16, { col: false });
    pb.box(colorMat(0x15100c, { rough: 0.3, key: 'pianoBlack' }), 0, 0.7, 0.36, 1.5, 0.1, 0.2);
    return { tier: 'fixture', family: 'cabinets', material: 'wood', score: 700, hp: 120 };
  },
  stove(pb) {
    pb.box(C.iron(), 0, 0.45, 0, 1.0, 0.9, 0.7, { frag: 'metal' });
    pb.box(C.iron(), 0, 0.92, 0, 1.04, 0.04, 0.74, { frag: 'metal' });
    pb.cyl(C.iron(), -0.25, 2.0, -0.2, 0.09, 0.09, 2.2, { col: false, frag: 'metal' });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), colorMat(0xff5a10, { emissive: 0xff4a00, emissiveIntensity: 2.5, key: 'stoveGlow' }));
    glow.position.set(0, 0.35, 0.351);
    pb.deco(glow);
    return { tier: 'fixture', family: 'stove', material: 'metal', score: 500, hp: 9999, unbreakable: true };
  },
  cauldron(pb) {
    pb.lathe(C.iron(), [[0, 0], [0.25, 0.02], [0.38, 0.2], [0.36, 0.45], [0.3, 0.52], [0, 0.52]], 0, 0.12, 0, { frag: 'metal' });
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), colorMat(0x55ff55, { emissive: 0x22cc33, emissiveIntensity: 1.6, key: 'brew' }));
    brew.rotation.x = -Math.PI / 2; brew.position.y = 0.6;
    pb.deco(brew);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; pb.box(C.iron(), Math.cos(a) * 0.28, 0.08, Math.sin(a) * 0.28, 0.05, 0.16, 0.05, { col: false }); }
    return { tier: 'fixture', family: 'cauldron', material: 'metal', score: 400, hp: 9999, unbreakable: true };
  },
  portrait(pb, o) {
    const w = W();
    const Wd = o.w ?? 0.6, H = o.h ?? 0.8;
    pb.box(w.dark, 0, H / 2, 0, Wd, H, 0.05);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.12, H - 0.12), Mats.portrait(o.variant ?? 0));
    pic.position.set(0, H / 2, 0.027);
    pb.deco(pic);
    return { tier: 'fragile', family: 'portraits', material: 'wood', mass: 3, score: 150, wallHung: true, breakDv: 4.5 };
  },
  mirror(pb) {
    const w = W();
    pb.box(w.dark, 0, 0.45, 0, 0.6, 0.9, 0.05);
    pb.box(C.mirror(), 0, 0.45, 0.027, 0.5, 0.8, 0.005, { col: false, frag: 'glass', shadow: false });
    return { tier: 'fragile', family: 'portraits', material: 'glass', mass: 4, score: 200, wallHung: true, breakDv: 4 };
  },
  window(pb, o) { // static pane; breaks on any decent hit
    pb.box(C.glass(), 0, 0, 0, o.w ?? 1, o.h ?? 1.2, 0.02, { frag: 'glass', shadow: false });
    pb.box(W().dark, 0, 0, 0.0, 0.04, o.h ?? 1.2, 0.05, { col: false });
    pb.box(W().dark, 0, 0, 0.0, o.w ?? 1, 0.04, 0.05, { col: false });
    return { tier: 'fixture', family: 'windows', material: 'glass', score: 150, hp: 10, ruin: 0.8, catBreakable: true, noise: 11 };
  },
  herbs(pb) { // hanging herb bundle (fuel)
    for (let i = 0; i < 4; i++) pb.cyl(C.herb(), (i - 1.5) * 0.12, -0.15, 0, 0.04, 0.01, 0.3, { col: false, frag: 'plant' });
    pb.box(W().rough, 0, 0.02, 0, 0.6, 0.03, 0.03, { col: false });
    return { tier: 'fixture', family: 'fuel', material: 'plant', score: 60, hp: 5, tags: ['flammable'] };
  },
  curtain(pb, o) {
    const H = o.h ?? 1.6;
    pb.box(C.fabricRed(), -0.3, -H / 2, 0, 0.5, H, 0.04, { col: false, frag: 'cloth' });
    pb.box(C.fabricRed(), 0.3, -H / 2, 0, 0.5, H, 0.04, { col: false, frag: 'cloth' });
    pb.cyl(C.brass(), 0, 0.02, 0, 0.015, 0.015, 1.3, { rz: Math.PI / 2, col: false });
    return { tier: 'fixture', family: 'fuel', material: 'fabric', score: 80, hp: 15, tags: ['flammable'], noCollide: true };
  },
  rug(pb, o) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w ?? 2.4, o.d ?? 1.6), Mats.rug());
    m.rotation.x = -Math.PI / 2; m.position.y = 0.005; m.receiveShadow = true;
    pb.deco(m);
    return { tier: 'decor', family: 'decor' };
  },
  firewood(pb) {
    const w = W();
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      pb.cyl(w.rough, 0, 0.09 + row * 0.17, (col - 1) * 0.19 + (row % 2) * 0.05, 0.08, 0.08, 0.9, { rz: Math.PI / 2, seg: 7, col: i === 0 });
    }
    pb.box(w.rough, 0, 0.26, 0, 0.9, 0.52, 0.55, { col: true, frag: 'wood' }).visible = false;
    return { tier: 'fixture', family: 'garden', material: 'wood', score: 250, hp: 40 };
  },
  shedpost(pb) {
    pb.box(W().rough, 0, 1.2, 0, 0.16, 2.4, 0.16);
    return { tier: 'structural', family: 'supports', material: 'wood', score: 900, hp: 60 };
  },

  // ---------------- conservatory / library / garden (wing content)
  armchair(pb, o) {
    const fab = o.variant ? C.fabricPurple() : C.fabricRed();
    pb.box(fab, 0, 0.24, 0, 0.8, 0.3, 0.78, { frag: 'cloth' });
    pb.box(fab, 0, 0.42, 0.04, 0.66, 0.08, 0.62, { col: false, frag: 'cloth' });
    pb.box(fab, 0, 0.72, -0.34, 0.8, 0.7, 0.14, { frag: 'cloth' });
    pb.box(fab, -0.37, 0.5, 0.02, 0.1, 0.32, 0.72, { frag: 'cloth' });
    pb.box(fab, 0.37, 0.5, 0.02, 0.1, 0.32, 0.72, { frag: 'cloth' });
    for (const [x, z] of [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]]) pb.box(W().dark, x, 0.05, z, 0.06, 0.1, 0.06, { col: false });
    return { tier: 'fixture', family: 'seating', material: 'fabric', score: 350, hp: 70 };
  },
  cakestand(pb) { // three tiers of the good china
    const p = C.porcelain();
    for (const [y, r] of [[0.02, 0.17], [0.16, 0.13], [0.29, 0.09]]) pb.cyl(p, 0, y, 0, r, r * 0.85, 0.02, { seg: 14, frag: 'ceramic' });
    pb.cyl(C.gold(), 0, 0.17, 0, 0.012, 0.012, 0.32, { col: false, frag: 'metal' });
    for (let i = 0; i < 5; i++) pb.sphere(colorMat(0xe8a0c0, { rough: 0.6, key: 'cake' }), Math.cos(i * 1.26) * 0.1, 0.06, Math.sin(i * 1.26) * 0.1, 0.03, { col: false, shadow: false, frag: 'plant' });
    return { tier: 'fragile', family: 'tableware', material: 'ceramic', mass: 1.4, score: 160, breakDv: 2.8 };
  },
  plantstand(pb) { // three-step wooden plant stand (pots placed separately on the steps)
    const w = W();
    for (const [y, z, d] of [[0.3, 0.22, 0.26], [0.62, 0.0, 0.26], [0.94, -0.22, 0.26]]) pb.box(w.mid, 0, y, z, 1.1, 0.04, d);
    pb.box(w.dark, -0.53, 0.48, 0, 0.05, 0.96, 0.7, { col: false });
    pb.box(w.dark, 0.53, 0.48, 0, 0.05, 0.96, 0.7, { col: false });
    return { tier: 'fixture', family: 'shelves', material: 'wood', score: 220, hp: 40, steps: [[0.32, 0.22], [0.64, 0.0], [0.96, -0.22]] };
  },
  birdcage(pb) {
    const brass = C.brass();
    pb.cyl(W().dark, 0, 0.6, 0, 0.03, 0.04, 1.2, { seg: 8 });
    pb.cyl(W().dark, 0, 0.02, 0, 0.24, 0.26, 0.04, { seg: 10 });
    pb.cyl(brass, 0, 1.24, 0, 0.2, 0.2, 0.03, { seg: 14, frag: 'metal' });
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; pb.cyl(brass, Math.cos(a) * 0.19, 1.45, Math.sin(a) * 0.19, 0.006, 0.006, 0.42, { col: false, frag: 'metal', shadow: false }); }
    pb.sphere(brass, 0, 1.66, 0, 0.2, { sy: 0.4, frag: 'metal' });
    pb.sphere(C.black(), 0.02, 1.36, 0, 0.06, { col: false, frag: 'plant' }); // a very judgemental stuffed crow
    pb.cyl(colorMat(0xffb020, { rough: 0.5, key: 'beak' }), 0.08, 1.37, 0, 0.0, 0.015, 0.05, { rz: -Math.PI / 2, col: false, shadow: false });
    return { tier: 'movable', family: 'curios', material: 'metal', mass: 6, score: 260, hp: 25 };
  },
  telescope(pb) {
    const brass = C.brass();
    for (let i = 0; i < 3; i++) { const a = i * 2.094; pb.cyl(W().dark, Math.cos(a) * 0.2, 0.55, Math.sin(a) * 0.2, 0.015, 0.02, 1.15, { rx: Math.sin(a) * 0.32, rz: -Math.cos(a) * 0.32, col: false, seg: 6 }); }
    pb.cyl(brass, 0.05, 1.18, 0, 0.055, 0.075, 0.95, { rz: -1.15, frag: 'metal' });
    pb.cyl(C.glass(), 0.46, 1.38, 0, 0.06, 0.06, 0.02, { rz: -1.15, col: false, frag: 'glass' });
    pb.box(W().dark, 0, 0.08, 0, 0.3, 0.16, 0.3, { shadow: false });
    return { tier: 'movable', family: 'curios', material: 'metal', mass: 7, score: 300, hp: 30 };
  },
  gramophone(pb) {
    pb.box(W().dark, 0, 0.07, 0, 0.34, 0.14, 0.34);
    pb.cyl(C.black(), 0, 0.15, 0, 0.14, 0.14, 0.01, { col: false, frag: 'paper' });
    pb.cyl(C.brass(), 0.1, 0.32, 0, 0.012, 0.012, 0.3, { rz: 0.3, col: false, frag: 'metal' });
    pb.cyl(C.brass(), 0.2, 0.5, 0, 0.2, 0.03, 0.34, { rz: -0.9, frag: 'metal' });
    return { tier: 'fragile', family: 'curios', material: 'metal', mass: 3, score: 240, breakDv: 3.2 };
  },
  globe(pb) {
    pb.cyl(W().dark, 0, 0.45, 0, 0.03, 0.05, 0.9, { seg: 8 });
    pb.cyl(W().dark, 0, 0.03, 0, 0.2, 0.22, 0.06, { seg: 10 });
    pb.sphere(colorMat(0x6a8a5a, { rough: 0.6, key: 'globe' }), 0, 1.05, 0, 0.22, { frag: 'paper' });
    pb.cyl(C.brass(), 0, 1.05, 0, 0.25, 0.25, 0.02, { rx: Math.PI / 2 - 0.4, col: false, frag: 'metal' });
    return { tier: 'movable', family: 'curios', material: 'wood', mass: 5, score: 220, hp: 25 };
  },
  terrarium(pb) { // glass case with a carnivorous plant and a mouse skull
    pb.box(W().dark, 0, 0.04, 0, 0.6, 0.08, 0.4);
    pb.box(C.glass(), 0, 0.33, 0, 0.56, 0.5, 0.36, { frag: 'glass', shadow: false });
    pb.sphere(C.herb(), -0.1, 0.18, 0, 0.12, { col: false, frag: 'plant' });
    pb.sphere(colorMat(0xb02040, { rough: 0.5, key: 'flytrap' }), 0.12, 0.25, 0.04, 0.06, { col: false, frag: 'plant' });
    pb.sphere(C.bone(), 0.12, 0.12, -0.08, 0.035, { col: false, frag: 'ceramic' });
    return { tier: 'fragile', family: 'glassware', material: 'glass', mass: 4, score: 260, breakDv: 3.0, glow: 0x55ff66 };
  },
  alembic(pb) { // bubbling alchemy glassware
    pb.sphere(C.glass(), 0, 0.09, 0, 0.09, { frag: 'glass' });
    pb.sphere(C.potionPurple(), 0, 0.08, 0, 0.07, { col: false, frag: 'glass', shadow: false });
    pb.cyl(C.glass(), 0, 0.22, 0, 0.02, 0.03, 0.12, { col: false, frag: 'glass' });
    pb.cyl(C.glass(), 0.1, 0.28, 0, 0.008, 0.008, 0.26, { rz: -1.0, col: false, frag: 'glass', shadow: false });
    pb.cyl(C.brass(), 0, 0.0, 0, 0.07, 0.08, 0.02, { col: false, frag: 'metal' });
    return { tier: 'fragile', family: 'glassware', material: 'glass', mass: 0.8, score: 140, glow: 0xb055ff };
  },
  birdbath(pb) {
    pb.cyl(C.stone(), 0, 0.35, 0, 0.08, 0.12, 0.7, { seg: 10, frag: 'ceramic' });
    pb.cyl(C.stone(), 0, 0.73, 0, 0.32, 0.22, 0.08, { seg: 14, frag: 'ceramic' });
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.27, 14), colorMat(0x4a6a8a, { rough: 0.05, metal: 0.3, key: 'water' }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.775; pb.deco(water);
    return { tier: 'fixture', family: 'garden', material: 'ceramic', score: 260, hp: 35 };
  },
  scarecrow(pb) {
    const w = W();
    pb.cyl(w.rough, 0, 0.9, 0, 0.03, 0.03, 1.8, { seg: 6 });
    pb.cyl(w.rough, 0, 1.35, 0, 0.025, 0.025, 1.1, { rz: Math.PI / 2, col: false, seg: 6 });
    pb.box(colorMat(0x5a4a2a, { rough: 1, key: 'sack' }), 0, 1.15, 0, 0.42, 0.55, 0.2, { frag: 'cloth' });
    pb.sphere(colorMat(0xc8a060, { rough: 1, key: 'sackHead' }), 0, 1.6, 0, 0.14, { frag: 'cloth' });
    pb.cyl(C.black(), 0, 1.74, 0, 0.18, 0.18, 0.02, { col: false });
    pb.cyl(C.black(), 0, 1.86, 0, 0.0, 0.1, 0.24, { col: false });
    return { tier: 'movable', family: 'garden', material: 'wood', mass: 8, score: 280, hp: 30 };
  },
  bench(pb) {
    const w = W();
    pb.box(w.planks, 0, 0.44, 0, 1.4, 0.06, 0.42);
    pb.box(w.planks, 0, 0.72, -0.2, 1.4, 0.36, 0.05);
    for (const x of [-0.6, 0.6]) pb.box(C.iron(), x, 0.22, 0, 0.06, 0.44, 0.4, { frag: 'metal' });
    return { tier: 'fixture', family: 'seating', material: 'wood', score: 260, hp: 45 };
  },
};

export function buildProp(kind, opts = {}) {
  const fn = KINDS[kind];
  if (!fn) throw new Error('Unknown prop kind ' + kind);
  const pb = new PartBuilder();
  const meta = fn(pb, opts) || {};
  const tier = TIERS[meta.tier] ?? {};
  return { group: pb.group, parts: pb.parts, meta: { ...tier, ...meta, kind } };
}

export { TIERS, C as PropColors, W as PropWoods, rng };
