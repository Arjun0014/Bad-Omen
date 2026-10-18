import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxGeo, woodMat, colorMat, Mats } from './Materials.js';
import { GROUPS, G, groups, quatY } from '../core/Physics.js';

/*
  World layout (metres).  +Y up, front door faces +Z, backyard is -Z.
  House footprint x[-7,7] z[-5,5].  Ground floor y 0..3.0, slab 3.0..3.2, upper floor 3.2..6.0, roof ridge 8.6.
  Ground: Foyer x[-7,-2] z[0.5,5] | Kitchen x[-7,-2] z[-5,0.5] | Hall x[-2,1.2] | Living (double height) x[1.2,7]
  Upper:  Bedroom x[-7,-2] z[0.5,5] | Study x[-7,-2] z[-5,0.5] | Landing x[-2,1.2] | Gallery x[1.2,2.6]
  Stairs: x[-0.2,1.2], bottom z=3.6 (y0) -> top z=-3.0 (y3.2)
  Conservatory wing (glass lean-to roof): x[7,12.4] z[-5,5], doors from the living room at z=0 and z=4.1
  Yard: x[-10,13] z[-17,-5] ; Porch: z[5,8]
*/
export const WING = { x0: 7, x1: 12.4, z0: -5, z1: 5, eave: 3.2, roofHigh: 4.6 };
export const FLOOR2 = 3.2;
export const STAIRS = { x0: -0.2, x1: 1.2, zBottom: 3.6, zTop: -3.0, rise: FLOOR2 };

export class House {
  constructor(scene, physics, rig) {
    this.scene = scene;
    this.physics = physics;
    this.rig = rig; // LightRig: room lights are virtual (fixed pool of real lights, see LightRig.js)
    this.buckets = new Map(); // material -> [geometry]
    this.group = new THREE.Group();
    this.group.name = 'House';
    scene.add(this.group);
    this.colliders = [];
    this.lights = [];
    this.flicker = [];
    this.weakFloor = null;
    this.mat = {
      floor: woodMat('wooden_floor_02', { tint: 0xc8b49a }),
      floorDark: woodMat('wooden_floor_02', { tint: 0x8a7766, key: 'floorDark' }),
      planks: woodMat('brown_planks_09', { tint: 0xb8a088 }),
      beam: woodMat('rough_wood', { tint: 0x9a8070 }),
      trunk: woodMat('wood_trunk_wall', { tint: 0xa89080 }),
      table: woodMat('wood_table', { tint: 0xd0b8a0 }),
      moss: woodMat('moss_wood', { tint: 0xc0c0b0 }),
      bark: woodMat('bark_brown_02'),
      bamboo: woodMat('bamboo_wall_03', { tint: 0x9a8a70 }),
      wallpaper: Mats.wallpaper(),
      plaster: Mats.plaster(),
      stone: Mats.stone(),
      shingles: Mats.shingles(),
      grass: Mats.grass(),
      rug: Mats.rug(),
      glass: colorMat(0x9fc3d0, { rough: 0.05, metal: 0.2, transparent: true, opacity: 0.28, key: 'glass' }),
      dark: colorMat(0x0b0b10, { rough: 1, key: 'void' }),
      iron: colorMat(0x2a2a2e, { rough: 0.5, metal: 0.8, key: 'iron' }),
    };
  }

  // ------------------------------------------------------------------ primitives
  add(mat, geo) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(geo);
  }

  /** Static textured box (merged), with optional collider. */
  box(mat, cx, cy, cz, w, h, d, o = {}) {
    const g = boxGeo(w, h, d, o.tile ?? 1.5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (o.rotY) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rotY);
    if (o.quat) q.copy(o.quat);
    m.compose(new THREE.Vector3(cx, cy, cz), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    this.add(mat, g);
    if (o.collider !== false) {
      const col = this.physics.addStaticBox(cx, cy, cz, w / 2, h / 2, d / 2, {
        quat: o.quat ? { x: q.x, y: q.y, z: q.z, w: q.w } : undefined, rotY: o.quat ? undefined : o.rotY,
        groups: o.groups ?? GROUPS.static, owner: o.owner ?? { kind: 'static', surface: o.surface ?? 'wood' },
        friction: o.friction,
      });
      this.colliders.push(col);
      return col;
    }
    return null;
  }

  /** Collider only (invisible). */
  solid(cx, cy, cz, w, h, d, o = {}) {
    const col = this.physics.addStaticBox(cx, cy, cz, w / 2, h / 2, d / 2, {
      rotY: o.rotY, quat: o.quat, groups: o.groups ?? GROUPS.static, owner: o.owner ?? { kind: 'static', surface: 'wood' },
    });
    this.colliders.push(col);
    return col;
  }

  /**
   * Axis-aligned wall from (x1,z1) to (x2,z2) (must be axis-aligned), between y0 and y1.
   * openings: [{at, w, y0, y1, window}] where `at` is the centre distance along the wall from (x1,z1).
   */
  wall(x1, z1, x2, z2, y0, y1, t, mat, openings = [], o = {}) {
    const alongX = Math.abs(z2 - z1) < 1e-6;
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const dir = alongX ? Math.sign(x2 - x1) : Math.sign(z2 - z1);
    const ops = [...openings].sort((a, b) => a.at - b.at);
    const seg = (s0, s1, ya, yb) => {
      if (s1 - s0 < 0.01 || yb - ya < 0.01) return;
      const mid = (s0 + s1) / 2, l = s1 - s0, h = yb - ya, cy = (ya + yb) / 2;
      if (alongX) this.box(mat, x1 + dir * mid, cy, z1, l, h, t, o);
      else this.box(mat, x1, cy, z1 + dir * mid, t, h, l, o);
    };
    let cursor = 0;
    for (const op of ops) {
      const a = op.at - op.w / 2, b = op.at + op.w / 2;
      seg(cursor, a, y0, y1);
      seg(a, b, y0, op.y0 ?? y0);           // below opening (windows)
      seg(a, b, op.y1 ?? y1, y1);           // lintel above
      if (op.window) this.windowPane(alongX, x1 + (alongX ? dir * op.at : 0), z1 + (alongX ? 0 : dir * op.at), op, t);
      if (o.frame !== false) this.doorFrame(alongX, x1 + (alongX ? dir * op.at : 0), z1 + (alongX ? 0 : dir * op.at), op, t, y0);
      cursor = b;
    }
    seg(cursor, len, y0, y1);
  }

  doorFrame(alongX, cx, cz, op, t, floorY) {
    const fy0 = op.y0 ?? floorY, fy1 = op.y1;
    const fw = 0.1, depth = t + 0.06;
    const m = this.mat.beam;
    const h = fy1 - fy0;
    if (alongX) {
      this.box(m, cx - op.w / 2 - fw / 2, fy0 + h / 2, cz, fw, h, depth, { collider: false });
      this.box(m, cx + op.w / 2 + fw / 2, fy0 + h / 2, cz, fw, h, depth, { collider: false });
      this.box(m, cx, fy1 + fw / 2, cz, op.w + fw * 2, fw, depth, { collider: false });
    } else {
      this.box(m, cx, fy0 + h / 2, cz - op.w / 2 - fw / 2, depth, h, fw, { collider: false });
      this.box(m, cx, fy0 + h / 2, cz + op.w / 2 + fw / 2, depth, h, fw, { collider: false });
      this.box(m, cx, fy1 + fw / 2, cz, depth, fw, op.w + fw * 2, { collider: false });
    }
  }

  windowPane(alongX, cx, cz, op, t) {
    // registered later as breakable windows by the prop layer; here: sill + cross bars + collider
    const h = op.y1 - op.y0, cy = (op.y0 + op.y1) / 2;
    const sillD = t + 0.24;
    if (alongX) this.box(this.mat.beam, cx, op.y0 - 0.03, cz, op.w + 0.2, 0.06, sillD, { collider: true });
    else this.box(this.mat.beam, cx, op.y0 - 0.03, cz, sillD, 0.06, op.w + 0.2, { collider: true });
    this.windows ??= [];
    this.windows.push({ alongX, cx, cy, cz, w: op.w, h, t, outward: op.outward ?? 0 });
  }

  floorSlab(x0, z0, x1, z1, yTop, thick, mat, o = {}) {
    this.box(mat, (x0 + x1) / 2, yTop - thick / 2, (z0 + z1) / 2, x1 - x0, thick, z1 - z0, { tile: o.tile ?? 2, ...o });
  }

  // ------------------------------------------------------------------ build
  build() {
    const M = this.mat;
    const T = 0.3; // exterior wall thickness
    const t = 0.18; // interior walls
    const H1 = 3.0, F2 = FLOOR2, H2 = 6.0;

    // ---------------- ground & yard
    this.box(M.grass, 1.5, -0.27, -5.5, 27, 0.5, 28, { tile: 6, surface: 'grass' });
    // ground floor boards (slightly above the yard)
    this.floorSlab(-7, -5, 7, 5, 0.0, 0.1, M.floor, { tile: 2.5, surface: 'wood' });

    // ---------------- exterior walls ground floor (y 0..3.2) and upper (3.2..6.0)
    // back wall z=-5: kitchen back door at x=-4.5, living french door at x=4.2, windows
    const backOps = [
      { at: 2.5, w: 1.1, y0: 0, y1: 2.2 },                        // kitchen back door (x=-4.5)
      { at: 1.0, w: 1.0, y0: 1.1, y1: 2.2, window: true },          // kitchen window x=-6 (curtained)
      { at: 11.2, w: 1.6, y0: 0, y1: 2.4 },                        // living french door x=4.2
      { at: 13.0, w: 0.9, y0: 1.0, y1: 2.4, window: true },
    ];
    this.wall(-7, -5, 7, -5, 0, F2, T, M.trunk, backOps);
    this.wall(-7, -5, 7, -5, F2, H2, T, M.trunk, [
      { at: 2.0, w: 1.0, y0: F2 + 1.0, y1: F2 + 2.1, window: true },
      { at: 8.0, w: 1.2, y0: F2 + 0.9, y1: F2 + 2.2, window: true },
      { at: 12.0, w: 1.2, y0: F2 + 0.9, y1: F2 + 2.2, window: true },
    ]);
    // front wall z=+5: front door x=-4.5, windows
    this.wall(-7, 5, 7, 5, 0, F2, T, M.trunk, [
      { at: 2.5, w: 1.2, y0: 0, y1: 2.3 },
      { at: 0.9, w: 0.8, y0: 1.0, y1: 2.2, window: true },
      { at: 9.0, w: 1.2, y0: 0.9, y1: 2.4, window: true },
      { at: 12.2, w: 1.2, y0: 0.9, y1: 2.4, window: true },
    ]);
    this.wall(-7, 5, 7, 5, F2, H2, T, M.trunk, [
      { at: 2.5, w: 1.2, y0: F2 + 0.9, y1: F2 + 2.1, window: true },
      { at: 10.5, w: 1.6, y0: F2 + 0.7, y1: F2 + 2.4, window: true },
    ]);
    // west wall x=-7
    this.wall(-7, -5, -7, 5, 0, F2, T, M.trunk, [{ at: 7.6, w: 1.0, y0: 1.0, y1: 2.2, window: true }]);
    this.wall(-7, -5, -7, 5, F2, H2, T, M.trunk, [
      { at: 2.5, w: 1.0, y0: F2 + 1.0, y1: F2 + 2.1, window: true },
      { at: 7.5, w: 1.0, y0: F2 + 1.0, y1: F2 + 2.1, window: true },
    ]);
    // east wall x=+7 (fireplace on inside at z=2.2)
    this.wall(7, -5, 7, 5, 0, H2, T, M.trunk, [{ at: 5.0, w: 1.3, y0: 0, y1: 2.4 }, { at: 9.1, w: 1.1, y0: 0, y1: 2.3 }]);
    this.conservatory();

    // ---------------- interior ground floor walls (y 0..3.0)
    // foyer/kitchen divider z=0.5, doorway at x=-5
    this.wall(-7, 0.5, -2, 0.5, 0, H1, t, M.wallpaper, [{ at: 2.0, w: 1.2, y0: 0, y1: 2.2 }]);
    // west hall wall x=-2: foyer door z=3.0 ; kitchen door z=-2.0
    this.wall(-2, -5, -2, 5, 0, H1, t, M.wallpaper, [{ at: 3.0, w: 1.3, y0: 0, y1: 2.2 }, { at: 8.0, w: 1.3, y0: 0, y1: 2.2 }]);
    // hall/living wall x=1.2 (ground floor only; above is open gallery): doors z=-4.1 and z=4.3
    this.wall(1.2, -5, 1.2, 5, 0, H1, t, M.plaster, [{ at: 0.9, w: 1.3, y0: 0, y1: 2.3 }, { at: 9.3, w: 1.1, y0: 0, y1: 2.3 }]);

    // ---------------- upper floor slab (y 3.0..3.2) with stairwell hole and weak bedroom patch
    const s = STAIRS;
    // bedroom/study block x[-7,-2]; the weak patch x[-6.0,-4.2] z[0.7,2.4] is built separately
    this.floorSlab(-7, -5, -2, 0.7, F2, 0.2, M.floor, { tile: 2.5 });                 // study + strip
    this.floorSlab(-7, 2.4, -2, 5, F2, 0.2, M.floor, { tile: 2.5 });                  // bedroom front
    this.floorSlab(-7, 0.7, -6.0, 2.4, F2, 0.2, M.floor, { tile: 2.5 });              // bedroom west strip
    this.floorSlab(-4.2, 0.7, -2, 2.4, F2, 0.2, M.floor, { tile: 2.5 });              // bedroom east strip
    this.weakFloor = { x0: -6.0, x1: -4.2, z0: 0.7, z1: 2.4, y: F2 };
    // landing corridor x[-2,-0.2], top landing z[-5,-3], front strip z[3.6,5], gallery x[1.2,2.6]
    this.floorSlab(-2, -5, s.x0, 5, F2, 0.2, M.floor, { tile: 2.5 });
    this.floorSlab(s.x0, -5, s.x1, s.zTop, F2, 0.2, M.floor, { tile: 2.5 });
    this.floorSlab(s.x0, s.zBottom, s.x1, 5, F2, 0.2, M.floor, { tile: 2.5 });
    this.floorSlab(s.x1, -5, 2.6, 5, F2, 0.2, M.floor, { tile: 2.5 });
    // gallery edge beam (visual)
    this.box(M.beam, 2.6, F2 - 0.25, 0, 0.25, 0.3, 10, { collider: false });
    // ceilings of ground floor (visual underside is the slab) + upper ceiling y=6
    this.box(M.planks, -2.3, H2 + 0.1, 0, 9.4, 0.2, 10.6, { tile: 2 });
    this.livingCeiling = new THREE.Mesh(boxGeo(5.2, 0.2, 10.6, 2), M.planks);
    this.livingCeiling.position.set(4.4, H2 + 0.1, 0);
    this.livingCeiling.receiveShadow = true;
    this.group.add(this.livingCeiling);

    // ---------------- interior upper walls (3.2..6.0)
    this.wall(-7, 0.5, -2, 0.5, F2, H2, t, M.wallpaper, [{ at: 3.8, w: 1.1, y0: F2, y1: F2 + 2.2 }]); // bedroom<->study door at x=-3.2 (clear of the weak floor patch)
    this.wall(-2, -5, -2, 5, F2, H2, t, M.wallpaper, [{ at: 2.8, w: 1.2, y0: F2, y1: F2 + 2.2 }, { at: 7.8, w: 1.2, y0: F2, y1: F2 + 2.2 }]);

    // ---------------- stairs (ramp collider + visual treads)
    this.stairs();

    // railings (stairwell + gallery).  Breakable gallery rail sections are registered by props layer.
    this.railing(s.x0, F2, s.zTop, s.x0, F2, s.zBottom);          // west edge of stairwell (upper)
    this.railing(s.x0, F2, s.zBottom, s.x1, F2, s.zBottom);       // front edge of stairwell
    this.railing(s.x1, F2, s.zTop + 0.05, s.x1, F2, s.zBottom);   // east edge (gallery side)
    // stair-side banister on the open (west) side going down
    this.banister();

    // ---------------- roof
    this.roof();

    // ---------------- fireplace (living room east wall) + chimney
    this.box(M.stone, 6.72, 1.0, 2.2, 0.46, 2.0, 2.2, { tile: 1.2, surface: 'stone' });  // hearth block (mantel juts out 0.45m: a cat perch)
    this.box(M.stone, 6.75, 4.0, 2.2, 0.5, 4.0, 1.6, { tile: 1.2, surface: 'stone' });   // chimney breast
    this.box(M.beam, 6.25, 1.25, 2.2, 0.5, 0.12, 2.6, { surface: 'wood' });            // mantel shelf (cat perch 1.25m)
    this.box(M.dark, 6.47, 0.5, 2.2, 0.05, 0.8, 1.2, { collider: false });             // firebox opening
    this.fireplaceLight = this.light(0xff7a2a, 2.6, 7, 5.9, 0.6, 2.2, true);

    // ---------------- yard perimeter (stone walls 4.5m) and porch
    const WH = 4.6;
    this.box(M.stone, 1.5, WH / 2, -17, 23.6, WH, 0.6, { tile: 2 });
    this.box(M.stone, -10, WH / 2, -4.4, 0.6, WH, 25.8, { tile: 2 });
    this.box(M.stone, 13, WH / 2, -4.4, 0.6, WH, 25.8, { tile: 2 });
    this.box(M.stone, 1.5, WH / 2, 5.2 + 3.0, 23.6, WH, 0.6, { tile: 2 });
    // short wall closing the gap beside the house on the west (yard <-> porch blocked; the wing closes the east)
    this.box(M.stone, -8.5, WH / 2, 0, 2.6, WH, 0.6, { tile: 2 });
    // front gate (closed) on porch wall
    this.box(M.iron, -4.5, 1.4, 8.0, 1.6, 2.8, 0.1, { collider: false });

    // ---------------- front door (open during the intro, slammed shut after)
    this._buildFrontDoor();

    // ---------------- lights
    this.light(0xffb469, 1.6, 6, -4.5, 2.4, 3.0, true);   // foyer
    this.light(0xffa050, 1.7, 7, -4.6, 2.5, -2.2, true);  // kitchen
    this.light(0xffb469, 1.2, 6, -0.6, 2.5, 0.0, true);   // hall
    this.light(0xffc27a, 1.4, 7, -4.5, 5.4, 3.0, true);   // bedroom
    this.light(0x9f7aff, 1.0, 6, -4.5, 5.4, -2.5, true);  // study (witchy violet)
    this.light(0xffb469, 1.0, 6, -0.9, 5.5, 0.0, true);   // landing
    this.light(0x8fd18f, 0.6, 7, 5.5, 1.0, -4.0, true);   // living potion glow
    // garden lanterns so the yard reads at night
    this.light(0xffa860, 1.3, 8, -4.5, 2.5, -5.7, true);   // back door lantern
    this.light(0xffa860, 1.0, 8, -6.6, 2.1, -12.6, true);  // shed lantern
    this.light(0x9fd0ff, 0.9, 10, 1.5, 3.0, -11.0, false); // moonlit well area
    for (const [x, y, z] of [[-4.5, 2.5, -5.55], [-6.6, 2.15, -12.85]]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), colorMat(0xffc070, { emissive: 0xffa040, emissiveIntensity: 2.5, key: 'lantern' }));
      lamp.position.set(x, y, z);
      this.group.add(lamp);
    }

    this.finalize();
    return this;
  }

  /** Glass-roofed conservatory / library wing on the east side of the living room. */
  conservatory() {
    const M = this.mat, W = WING, T = 0.3;
    this.floorSlab(W.x0, W.z0, W.x1 + 0.15, W.z1, 0.0, 0.1, M.floor, { tile: 2.5, surface: 'wood' });
    // east wall: three tall windows onto the storm
    this.wall(W.x1, -5, W.x1, 5, 0, W.eave, T, M.trunk, [
      { at: 2.2, w: 1.6, y0: 0.7, y1: 2.6, window: true }, { at: 5.6, w: 1.6, y0: 0.7, y1: 2.6, window: true },
      { at: 8.6, w: 1.4, y0: 0.7, y1: 2.6, window: true }]);
    // front (z=5) and back (z=-5): windows, and a back door out to the yard
    this.wall(W.x0, 5, W.x1, 5, 0, W.eave, T, M.trunk, [{ at: 1.6, w: 1.2, y0: 0.8, y1: 2.5, window: true }, { at: 3.9, w: 1.4, y0: 0.8, y1: 2.5, window: true }]);
    this.wall(W.x0, -5, W.x1, -5, 0, W.eave, T, M.trunk, [{ at: 2.6, w: 1.3, y0: 0, y1: 2.3 }, { at: 4.6, w: 0.9, y0: 0.9, y1: 2.3, window: true }]);
    // gable infill above the side walls up to the lean-to roof line
    for (const z of [5, -5]) {
      const sh = new THREE.Shape();
      sh.moveTo(W.x0, W.eave); sh.lineTo(W.x1 + 0.15, W.eave); sh.lineTo(W.x0, W.roofHigh + 0.05); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false });
      g.translate(0, 0, z - T / 2);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5);
      this.add(M.trunk, g);
    }
    // lean-to glass roof on timber rafters, high against the house, low at the east wall
    const run = W.x1 + 0.2 - (W.x0 + 0.15), rise = W.roofHigh - W.eave;
    const len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
    const cx = W.x0 + 0.15 + run / 2, cy = W.eave + rise / 2 + 0.06;
    this.box(M.glass, cx, cy, 0, len, 0.03, 10.3, { quat: q, collider: false });
    for (let z = -5; z <= 5.01; z += 1.25) this.box(M.beam, cx, cy - 0.06, z, len, 0.12, 0.1, { quat: q, collider: false });
    this.box(M.beam, W.x0 + 0.2, W.roofHigh - 0.05, 0, 0.18, 0.16, 10.3, { collider: false });
    this.box(M.beam, W.x1 + 0.1, W.eave + 0.05, 0, 0.2, 0.14, 10.3, { collider: false });
    // a ceiling collider keeps leaping cats (and props, projectiles) inside; it covers the tops of the walls too (a cat
    // climbing the bookcase used to stand on the back wall's outer half and drop into the yard through the roof).
    // Debris passes through it: SP10's roof panes and rafters start above it and used to settle on it, floating
    // where the roof had been (playtest 4); effects ignore it too (`invisible`)
    this.solid((W.x0 + W.x1 + T) / 2, W.eave + 0.15, 0, W.x1 - W.x0 + T, 0.1, 10 + T + 0.1, {
      groups: groups(G.STATIC, G.PROP | G.CAT | G.GRANNY | G.PROJ), owner: { kind: 'static', surface: 'wood', invisible: true },
    });
    this.light(0xffc27a, 1.3, 8, 9.7, 2.6, 0.3, true);   // conservatory lamps
    this.light(0x7dff7a, 0.35, 4, 11.4, 1.9, 1.4, true); // potion bench glow
    this.light(0xffa860, 1.0, 8, 9.6, 2.5, -5.7, true);  // lantern over the conservatory's yard door
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), colorMat(0xffc070, { emissive: 0xffa040, emissiveIntensity: 2.5, key: 'lantern' }));
    lamp.position.set(9.6, 2.5, -5.55);
    this.group.add(lamp);
  }

  _buildFrontDoor() {
    const M = this.mat;
    this.door = new THREE.Group();
    this.door.position.set(-5.1, 0, 5.0); // hinge on the west side of the doorway
    const panel = new THREE.Mesh(boxGeo(1.18, 2.28, 0.08, 1), M.planks);
    panel.position.set(0.6, 1.14, 0);
    panel.castShadow = true;
    this.door.add(panel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), colorMat(0xc9a04a, { metal: 1, rough: 0.3, key: 'brass' }));
    knob.position.set(1.05, 1.05, 0.06);
    this.door.add(knob);
    // the cat flap (a dark hinged panel in a little brass frame)
    for (const zz of [1, -1]) {
      const rim = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.36), colorMat(0xc9a04a, { metal: 1, rough: 0.35, key: 'brassFrame', side: THREE.DoubleSide }));
      rim.position.set(0.6, 0.19, 0.042 * zz);
      const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), colorMat(0x1a1410, { rough: 0.9, key: 'catflap', side: THREE.DoubleSide }));
      flap.position.set(0.6, 0.19, 0.046 * zz);
      this.door.add(rim, flap);
    }
    this.group.add(this.door);
    this.doorCol = null;
    this.doorAnim = null;
  }

  setFrontDoor(open, slam = false) {
    const target = open ? -Math.PI * 0.55 : 0;
    if (slam) this.doorAnim = { from: this.door.rotation.y, to: target, t: 0, dur: 0.22 };
    else { this.door.rotation.y = target; this.doorAnim = null; }
    if (!open && !this.doorCol) {
      // closed door with a cat flap at the bottom: Komur can always get back in from the porch, Grandma can't follow
      const own = { owner: { kind: 'static', surface: 'wood' } };
      this.doorCol = [
        this.physics.addStaticBox(-4.925, 1.15, 5.0, 0.175, 1.15, 0.06, own),
        this.physics.addStaticBox(-4.075, 1.15, 5.0, 0.175, 1.15, 0.06, own),
        this.physics.addStaticBox(-4.5, 1.32, 5.0, 0.25, 0.98, 0.06, own),
        this.physics.addStaticBox(-4.5, 0.17, 5.0, 0.25, 0.17, 0.06, { groups: GROUPS.grannyBlock }),
      ];
    }
    if (open && this.doorCol) { for (const c of this.doorCol) this.physics.removeCollider(c); this.doorCol = null; }
    this.doorSlam = slam;
  }

  flickerOut(dur = 1) { this.blackout = Math.max(this.blackout ?? 0, dur); }

  breakRoof() {
    if (this.roofBroken) return;
    this.roofBroken = true;
    if (this.livingCeiling) this.livingCeiling.visible = false;
    // hide the intact shingle roof and replace it with a broken silhouette
    this.group.traverse((o) => { if (o.isMesh && o.material === this.mat.shingles) o.visible = false; });
    const M = this.mat;
    const ridgeY = 8.6, eaveY = 6.0, half = 5.6;
    const slopeLen = Math.hypot(half, ridgeY - eaveY);
    const ang = Math.atan2(ridgeY - eaveY, half);
    const add = (x, w, side, sag = 0, cut = 1) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), side * (ang + sag));
      const m = new THREE.Mesh(boxGeo(w, 0.18, slopeLen * cut, 2), M.shingles);
      m.quaternion.copy(q);
      m.position.set(x, (ridgeY + eaveY) / 2 + 0.1 - sag * 2, side * half / 2 * (cut < 1 ? 1.2 : 1));
      m.castShadow = true;
      this.group.add(m);
    };
    // west half intact, east half shattered with gaps and sagging stubs
    add(-3.15, 8.7, -1); add(-3.15, 8.7, 1);
    add(1.9, 1.4, -1, 0.15, 0.7); add(2.6, 1.2, 1, 0.25, 0.55);
    add(6.4, 1.3, -1, -0.1, 0.6); add(5.9, 1.0, 1, 0.3, 0.45);
  }

  light(color, intensity, distance, x, y, z, flicker = false) {
    const l = this.rig.add({ color, intensity: intensity * 6, distance, decay: 1.6, position: new THREE.Vector3(x, y, z) });
    this.lights.push(l);
    if (flicker) this.flicker.push({ light: l, base: l.intensity, phase: Math.random() * 10, speed: 6 + Math.random() * 6 });
    return l;
  }

  stairs() {
    const s = STAIRS, M = this.mat;
    const run = s.zBottom - s.zTop; // 6.6
    const angle = Math.atan2(s.rise, run);
    const len = Math.hypot(run, s.rise);
    const w = s.x1 - s.x0;
    const cx = (s.x0 + s.x1) / 2, cz = (s.zBottom + s.zTop) / 2;
    // ramp collider: box rotated about X.  Top surface passes through (zBottom,0) and (zTop,rise).
    const th = 0.2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    const nrm = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const center = new THREE.Vector3(cx, s.rise / 2, cz).addScaledVector(nrm, -th / 2);
    this.physics.addStaticBox(center.x, center.y, center.z, w / 2, th / 2, len / 2, { quat: { x: q.x, y: q.y, z: q.z, w: q.w }, owner: { kind: 'static', surface: 'wood', stairs: true } });
    // treads
    const steps = 16;
    const stepRun = run / steps, stepRise = s.rise / steps;
    for (let i = 0; i < steps; i++) {
      const z = s.zBottom - (i + 0.5) * stepRun;
      const yTop = (i + 0.62) * stepRise;
      this.box(M.floorDark, cx, yTop - 0.04, z, w, 0.08, stepRun + 0.03, { collider: false, tile: 1 });
      this.box(M.planks, cx, yTop - stepRise / 2 - 0.04, z + stepRun / 2 - 0.02, w, stepRise, 0.04, { collider: false, tile: 1 });
    }
    // stringers
    const sq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    const sc = new THREE.Vector3(0, s.rise / 2 - 0.15, cz);
    this.box(M.beam, s.x0 - 0.04, sc.y, sc.z, 0.08, 0.4, len, { collider: false, quat: sq });
    // under-stair cupboard wall (hide spot behind) - partial panel on the west side, low area
    this.box(M.planks, s.x0 - 0.05, 0.6, s.zTop + 1.6, 0.06, 1.2, 2.6, { tile: 1 });
  }

  railing(x0, y, z0, x1, _y1, z1, o = {}) {
    const M = this.mat;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = Math.abs(z1 - z0) < 1e-6;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const h = 0.95;
    // top rail + collider (blocks walking off but cat can jump onto/over rail: rail top at y+0.95)
    if (alongX) this.box(M.beam, cx, y + h, cz, len, 0.08, 0.1, { surface: 'wood', groups: GROUPS.rail });
    else this.box(M.beam, cx, y + h, cz, 0.1, 0.08, len, { surface: 'wood', groups: GROUPS.rail });
    // invisible blocker so nobody walks off the edge under the rail (cat can still hop onto the rail)
    if (alongX) this.solid(cx, y + 0.45, cz, len, 0.9, 0.08, { groups: GROUPS.rail });
    else this.solid(cx, y + 0.45, cz, 0.08, 0.9, len, { groups: GROUPS.rail });
    const n = Math.max(2, Math.round(len / 0.32));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f;
      const post = i % 4 === 0;
      this.box(M.beam, px, y + h / 2, pz, post ? 0.1 : 0.04, h, post ? 0.1 : 0.04, { collider: false });
    }
  }

  banister() {
    // simple sloped hand-rail on the open west side of the stairs
    const s = STAIRS, M = this.mat;
    const run = s.zBottom - s.zTop;
    const angle = Math.atan2(s.rise, run);
    const len = Math.hypot(run, s.rise);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    this.box(M.beam, s.x0, s.rise / 2 + 0.9, (s.zBottom + s.zTop) / 2, 0.08, 0.08, len, { collider: false, quat: q });
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const z = s.zBottom - run * f, y = s.rise * f;
      this.box(M.beam, s.x0, y + 0.45, z, 0.04, 0.9, 0.04, { collider: false });
    }
    // invisible side blocker so the cat/grandma don't fall off the open stair side (cat can still jump)
    const center = new THREE.Vector3(s.x0 - 0.02, s.rise / 2 + 0.35, (s.zBottom + s.zTop) / 2);
    this.physics.addStaticBox(center.x, center.y, center.z, 0.04, 0.35, len / 2, { quat: { x: q.x, y: q.y, z: q.z, w: q.w }, groups: GROUPS.rail });
  }

  roof() {
    const M = this.mat;
    const ridgeY = 8.6, eaveY = 6.0, half = 5.6, span = 15.0;
    const slopeLen = Math.hypot(half, ridgeY - eaveY);
    const ang = Math.atan2(ridgeY - eaveY, half);
    for (const side of [-1, 1]) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), side * ang);
      const cz = side * half / 2, cy = (ridgeY + eaveY) / 2 + 0.1;
      this.box(M.shingles, 0, cy, cz, span, 0.18, slopeLen + 0.3, { quat: q, collider: false, tile: 2 });
    }
    // gable ends
    for (const x of [-7.3, 7.3]) {
      const shape = new THREE.Shape();
      shape.moveTo(-5.4, 0); shape.lineTo(5.4, 0); shape.lineTo(0, ridgeY - eaveY); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
      g.rotateY(Math.PI / 2);
      g.translate(x - 0.15, eaveY, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5);
      this.add(M.trunk, g);
    }
    // attic tie beams across the living room (visual drama; finale breaks some)
    for (const z of [-3.5, 0, 3.5]) this.box(M.beam, 4.1, 6.0, z, 6.0, 0.3, 0.3, { collider: false });
    this.box(M.beam, 0, ridgeY - 0.2, 0, 14.4, 0.35, 0.35, { collider: false });
  }

  finalize() {
    for (const [mat, list] of this.buckets) {
      const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
      const merged = mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !mat.transparent;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      if (mat === this.mat.glass) this.glassRoof = mesh; // the conservatory roof (SP10 shatters it)
      geos.forEach((g) => g.dispose());
      list.forEach((g) => g.dispose());
    }
    this.buckets.clear();
  }

  update(dt, time) {
    if (this.blackout > 0) this.blackout -= dt;
    const out = this.blackout > 0 ? (Math.random() < 0.6 ? 0.08 : 0.6) : 1;
    for (const f of this.flicker) {
      const n = Math.sin(time * f.speed + f.phase) * 0.06 + Math.sin(time * f.speed * 2.7 + f.phase * 3) * 0.04;
      f.light.intensity = f.base * (1 + n) * (f.dim ?? 1) * out;
    }
    if (this.doorAnim) {
      const a = this.doorAnim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      this.door.rotation.y = a.from + (a.to - a.from) * k * k;
      if (k >= 1) { this.doorAnim = null; this.onDoorSlam?.(); }
    }
  }
}
