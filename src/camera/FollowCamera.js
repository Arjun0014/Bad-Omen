import * as THREE from 'three';
import { Q } from '../core/Physics.js';

// Furniture that blocks the view is faded with a shared transparent twin of its material.
const FADE = new Map(); // original material -> transparent twin
function fadeMatFor(m) {
  let f = FADE.get(m);
  if (!f) {
    f = m.clone();
    f.transparent = true;
    f.opacity = Math.min(m.opacity ?? 1, 0.22);
    f.depthWrite = false;
    FADE.set(m, f);
  }
  return f;
}
// furniture right at the lens is not drawn at all (see _fadeOccluders)
const GHOST = new Map();
function ghostMatFor(m) {
  let f = GHOST.get(m);
  if (!f) { f = m.clone(); f.visible = false; GHOST.set(m, f); }
  return f;
}

/*
  Third-person orbit camera.  The follow distance is constant: it does not zoom with speed and it only
  collides with architecture (walls, floors, ceilings), so it no longer pumps in and out around chairs and
  tables.  Furniture between the lens and the cat fades out instead.  Shake + cinematic override.
*/
export class FollowCamera {
  constructor(camera, physics) {
    this.camera = camera;
    this.physics = physics;
    this.yaw = 0;          // camera yaw (radians); 0 looks toward -Z
    this.pitch = -0.34;    // negative looks down
    this.distance = 2.6;
    this.minDist = 0.45;
    this.curDist = 2.6;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.baseFov = 62;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.cinematic = null; // {pos, look, fov}
    this.blendBack = 0;
    this.recenterDelay = 0;
    this.lift = 0;
    this.faded = new Map(); // rec -> { t: seconds of grace left, mode: 'fade' | 'ghost' }
    this._tmp = new THREE.Vector3();
  }

  snapBehind(yawOfCat) {
    // camera behind cat: cat faces +Z when yaw=0 -> camera yaw should look along cat forward
    this.yaw = yawOfCat + Math.PI;
  }

  /** Hard cut to the follow framing (end of a cutscene that also moved the cat): no blend, no spring. */
  cut(cat) {
    this.blendBack = 0;
    this.lift = 0;
    this.curDist = this.distance;
    this.smoothTarget.set(cat.position.x, cat.position.y + 0.72, cat.position.z);
    this._look = null;
  }

  addShake(amp, time = 0.35) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, time);
  }

  /** Compile the faded-furniture shader variants up front so the first fade never hitches. */
  warmFade(items, renderer, scene, camera, target = null) {
    const seen = new Set();
    const dummies = [];
    const geo = new THREE.PlaneGeometry(0.01, 0.01);
    for (const rec of items) {
      rec.group?.traverse((o) => {
        if (!o.isMesh || !o.material || seen.has(o.material)) return;
        seen.add(o.material);
        const d = new THREE.Mesh(geo, fadeMatFor(o.material));
        d.position.copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion));
        d.frustumCulled = false;
        dummies.push(d);
      });
    }
    for (const d of dummies) scene.add(d);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    try { renderer.compile(scene, camera); } finally { renderer.setRenderTarget(prev); for (const d of dummies) scene.remove(d); geo.dispose(); }
  }

  update(dt, cat, mouse, opts = {}) {
    const cam = this.camera;
    if (mouse && !this.cinematic) {
      this.yaw -= mouse.x * 0.0026;
      this.pitch -= mouse.y * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.15, 0.55);
      if (Math.abs(mouse.x) + Math.abs(mouse.y) > 0.5) this.recenterDelay = 2.2;
    }
    this.recenterDelay = Math.max(0, this.recenterDelay - dt);
    // very gentle auto-recenter behind a cat on a long straight gallop (the gallop is 3.9 m/s)
    const speed = Math.hypot(cat.vel.x, cat.vel.z);
    if (!this.cinematic && this.recenterDelay <= 0 && speed > 3.3 && cat.grounded && cat.mode === 'normal') {
      const behind = cat.yaw + Math.PI;
      let d = behind - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) < 1.6) this.yaw += d * (1 - Math.exp(-0.8 * dt));
    }

    // pivot above the cat
    // pivot a little above the raised tail: Komur sits low in the frame and the view ahead stays clear
    const pivotH = cat.crouching || cat.hidden ? 0.55 : 0.72;
    this.target.set(cat.root.position.x, cat.root.position.y + pivotH, cat.root.position.z);
    const k = 1 - Math.exp(-16 * dt);
    if (this.smoothTarget.distanceTo(this.target) > 3) this.smoothTarget.copy(this.target);
    this.smoothTarget.x += (this.target.x - this.smoothTarget.x) * k;
    this.smoothTarget.z += (this.target.z - this.smoothTarget.z) * k;
    this.smoothTarget.y += (this.target.y - this.smoothTarget.y) * (1 - Math.exp(-7 * dt));

    const want = this.distance; // constant: speed-based zoom read as the camera pumping in and out
    const dir = this._tmp.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ); // from pivot towards camera
    // spring arm against walls/floors only (furniture fades instead of pushing the camera)
    let dist = want;
    const hit = this.physics.sphereCast(this.smoothTarget.x, this.smoothTarget.y, this.smoothTarget.z, dir.x, dir.y, dir.z, 0.18, want, Q.cameraWalls);
    if (hit) dist = Math.max(this.minDist, hit.toi - 0.05);
    // come in quickly (never show the inside of a wall), go back out slowly with a little hysteresis
    if (dist < this.curDist) this.curDist += (dist - this.curDist) * (1 - Math.exp(-25 * dt));
    else if (dist > this.curDist + 0.08) this.curDist += (dist - this.curDist) * (1 - Math.exp(-1.6 * dt));
    if (this.curDist > dist + 0.25) this.curDist = dist + 0.25; // hard limit: at most a hair inside geometry for a frame

    const pos = this.smoothTarget.clone().addScaledVector(dir, this.curDist);
    // backed against a wall: lift the camera so it looks over the cat instead of into its tail (smoothed)
    let liftWant = 0;
    if (this.curDist < 1.3) {
      liftWant = (1.3 - this.curDist) * 0.5;
      const up = this.physics.raycast(pos.x, pos.y, pos.z, 0, 1, 0, liftWant + 0.2, Q.cameraWalls);
      if (up) liftWant = Math.max(0, Math.min(liftWant, up.toi - 0.15));
    }
    this.lift += (liftWant - this.lift) * (1 - Math.exp(-6 * dt));
    pos.y += this.lift;
    // shake
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT) * (opts.comfort ? 0.3 : 1);
      sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }

    if (this.cinematic) {
      const c = this.cinematic;
      cam.position.lerp(c.pos, c.snap ? 1 : 1 - Math.exp(-(c.speed ?? 6) * dt));
      this._look = this._look || c.look.clone();
      this._look.lerp(c.look, c.snap ? 1 : 1 - Math.exp(-(c.speed ?? 6) * dt));
      cam.lookAt(this._look);
      cam.fov += ((c.fov ?? this.baseFov) - cam.fov) * (1 - Math.exp(-5 * dt));
      c.snap = false;
      this.blendBack = 1;
      this._fadeOccluders(dt, null);
    } else if (this.blendBack > 0) {
      this.blendBack = Math.max(0, this.blendBack - dt * 2.2);
      cam.position.lerp(pos, 1 - Math.exp(-10 * dt));
      cam.lookAt(this._lookTarget(dir));
      cam.fov += (this.baseFov - cam.fov) * (1 - Math.exp(-6 * dt));
      this._look = null;
      this._fadeOccluders(dt, cat);
    } else {
      cam.position.copy(pos);
      cam.lookAt(this._lookTarget(dir));
      cam.fov = this.baseFov;
      this._fadeOccluders(dt, cat);
    }
    if (sx || sy) { cam.position.x += sx; cam.position.y += sy; }
    cam.updateProjectionMatrix();
  }

  _fadeOccluders(dt, cat) {
    const now = new Map(); // rec -> 'fade' | 'ghost'
    const usable = (rec) => rec?.isBreakable && !rec.broken && rec.group && !rec.pinned;
    if (cat && !cat.hidden) {
      const cp = this.camera.position;
      // furniture right at the lens (the arm only collides with walls) is not drawn at all: faded to 22%, a pantry
      // top 5 cm under the lens still filled a quarter of the screen as a bright translucent sheet.  The piece he
      // stands on only fades, so he never floats.
      const under = this.physics.raycast(cat.position.x, cat.position.y + 0.1, cat.position.z, 0, -1, 0, 0.35, Q.occluders);
      const standingOn = under ? this.physics.ownerOf(under.collider) : null;
      for (const c of this.physics.overlapSphere(cp.x, cp.y, cp.z, 0.4, Q.occluders)) {
        const rec = this.physics.ownerOf(c);
        if (usable(rec)) now.set(rec, rec === standingOn ? 'fade' : 'ghost');
      }
      for (const h of [0.35, 0.12]) {
        const tx = cat.root.position.x - cp.x, ty = cat.root.position.y + h - cp.y, tz = cat.root.position.z - cp.z;
        const len = Math.hypot(tx, ty, tz);
        if (len < 0.4) continue;
        const hits = this.physics.raycastAll(cp.x, cp.y, cp.z, tx / len, ty / len, tz / len, len - 0.25, Q.occluders);
        for (const hit of hits) if (usable(hit.owner) && !now.has(hit.owner)) now.set(hit.owner, 'fade');
      }
    }
    for (const [rec, mode] of now) {
      const st = this.faded.get(rec);
      if (!st || st.mode !== mode) this._setFade(rec, mode);
      this.faded.set(rec, { t: 0.4, mode });
    }
    for (const [rec, st] of this.faded) {
      if (now.has(rec)) continue;
      st.t -= dt;
      if (st.t <= 0 || rec.broken) { this._setFade(rec, null); this.faded.delete(rec); }
    }
  }

  /** mode: 'fade' (shared transparent twin), 'ghost' (not drawn) or null (back to its own materials). */
  _setFade(rec, mode) {
    rec.group.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const orig = o.userData.fadeOrig ?? o.material;
      if (mode) {
        o.userData.fadeOrig = orig;
        o.material = mode === 'ghost' ? ghostMatFor(orig) : fadeMatFor(orig);
      } else if (o.userData.fadeOrig) {
        o.material = o.userData.fadeOrig;
        o.userData.fadeOrig = null;
      }
    });
  }

  /** Restore everything (world rebuild). */
  clearFades() {
    for (const rec of this.faded.keys()) this._setFade(rec, null);
    this.faded.clear();
  }

  _lookTarget(dir) {
    // look a little above and ahead of the cat (dir points from pivot to camera)
    const t = this.smoothTarget.clone();
    t.y += 0.02;
    t.x -= dir.x * 0.45; t.z -= dir.z * 0.45;
    return t;
  }

  /** Camera-forward on the ground plane (for movement). */
  get moveYaw() { return this.yaw; }
}
