import * as THREE from 'three';

/*
  A fixed pool of real point lights fed by any number of "virtual" lights.

  three.js compiles one shader variant per light COUNT, so adding, removing or hiding a light at runtime
  recompiles every material in view (measured: a 5.2 s freeze when a candle broke on the dining table,
  49 -> 64 shader programs).  The scene therefore always holds exactly `size` point lights; every frame
  they take on the virtual lights that matter most near the cat and the camera, fading in and out so
  nothing pops.  Fewer lights per pixel is also cheaper (24 -> 12 point lights per fragment).

  A virtual light behaves like a PointLight for the code that owns it: set .intensity / .color freely,
  park it with intensity 0, or have it follow an object (candle, chandelier, the enchanted axe).
*/
export class VirtualLight {
  constructor(o) {
    this.color = new THREE.Color(o.color ?? 0xffffff);
    this.intensity = o.intensity ?? 1;
    this.distance = o.distance ?? 6;
    this.decay = o.decay ?? 1.6;
    this.position = o.position ? o.position.clone() : new THREE.Vector3();
    this.follow = o.follow ?? null;             // Object3D to track (light sits at follow * offset)
    this.offset = o.offset ? o.offset.clone() : new THREE.Vector3();
    this.priority = o.priority ?? 1;            // >1 keeps set-piece / fire lights in the pool
    this.enabled = true;
    this.slot = null;
    this.score = 0;
    this._wp = new THREE.Vector3();
  }

  worldPosition(out = this._wp) {
    if (!this.follow) return out.copy(this.position);
    this.follow.updateWorldMatrix(true, false);
    return out.copy(this.offset).applyMatrix4(this.follow.matrixWorld);
  }
}

export class LightRig {
  constructor(scene, size = 12) {
    this.size = size;
    this.lights = [];
    this.slots = [];
    this.first = true;
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 2);
      light.castShadow = false;
      light.position.set(0, -50, 0);
      light.name = `rig${i}`;
      scene.add(light);
      this.slots.push({ light, v: null, w: 0, fading: false });
    }
  }

  add(o) {
    const v = new VirtualLight(o);
    this.lights.push(v);
    return v;
  }

  remove(v) {
    if (!v) return;
    const i = this.lights.indexOf(v);
    if (i >= 0) this.lights.splice(i, 1);
    v.enabled = false; // a slot still holding it fades it out, then frees itself
  }

  /** Pick the lights that matter near `a` (the cat) or `b` (the camera) and feed them to the pool. */
  update(dt, a, b) {
    const cand = [];
    for (const v of this.lights) {
      v.score = 0;
      if (!v.enabled || !(v.intensity > 0.001)) continue;
      const p = v.worldPosition();
      const d = Math.min(p.distanceTo(a), b ? p.distanceTo(b) : Infinity);
      const reach = v.distance + 2.0;
      if (d > reach) continue;
      v.score = (1 - d / reach) * Math.min(3, Math.sqrt(v.intensity)) * v.priority + (v.slot ? 0.2 : 0); // hysteresis
      cand.push(v);
    }
    cand.sort((x, y) => y.score - x.score);
    const want = new Set(cand.length > this.size ? cand.slice(0, this.size) : cand);
    for (const s of this.slots) s.fading = !!s.v && !want.has(s.v);
    for (const v of want) {
      if (v.slot) continue;
      const s = this.slots.find((x) => !x.v);
      if (!s) break; // a fading slot frees up in a moment
      s.v = v; s.w = this.first ? 1 : 0; s.fading = false; v.slot = s;
    }
    this.first = false;
    const k = Math.min(1, dt / 0.3);
    for (const s of this.slots) {
      const l = s.light;
      if (!s.v) { l.intensity = 0; continue; }
      if (s.fading) {
        s.w = Math.max(0, s.w - k);
        if (s.w <= 0) { s.v.slot = null; s.v = null; l.intensity = 0; continue; }
      } else s.w = Math.min(1, s.w + k);
      const v = s.v;
      v.worldPosition(l.position);
      l.color.copy(v.color);
      l.distance = v.distance;
      l.decay = v.decay;
      l.intensity = Math.max(0, v.intensity) * s.w;
    }
  }

  /** Debug: which virtual lights are live right now. */
  active() { return this.slots.filter((s) => s.v).map((s) => ({ w: +s.w.toFixed(2), i: +s.v.intensity.toFixed(1), at: s.light.position.toArray().map((x) => +x.toFixed(1)) })); }
}
