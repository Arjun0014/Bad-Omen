import * as THREE from 'three';
import { Q, GROUPS } from '../core/Physics.js';
import { colorMat, woodMat } from '../world/Materials.js';

export const PROJ_TYPES = {
  teapot: { speed: 11, gravity: 9, damage: 30, radius: 0.15, spin: 9, label: 'teapot', heavy: false },
  plate: { speed: 12, gravity: 8, damage: 20, radius: 0.14, spin: 16, label: 'plate', heavy: false },
  pan: { speed: 12.5, gravity: 9, damage: 60, radius: 0.22, spin: 12, label: 'frying pan', heavy: true },
  axe: { speed: 14, gravity: 7, damage: 130, radius: 0.28, spin: 15, label: 'axe', heavy: true, sticks: true, structural: true },
  spear: { speed: 17, gravity: 4.5, damage: 120, radius: 0.24, spin: 0, label: 'pitchfork', heavy: true, sticks: true, structural: true },
  bigaxe: { speed: 13, gravity: 5, damage: 999, radius: 0.5, spin: 9, label: 'ENCHANTED AXE', heavy: true, structural: true, giant: true },
};

/** Every throw builds its own weapon geometry (materials are shared): free it when the mesh leaves the scene. */
export function disposeGeometry(obj) { obj?.traverse((o) => o.geometry?.dispose()); }

function makeMesh(type) {
  const g = new THREE.Group();
  const iron = colorMat(0x3a3a40, { rough: 0.35, metal: 0.9, key: 'projIron' });
  const wood = woodMat('rough_wood', { tint: 0x9a7a60, key: 'projWood' });
  if (type === 'teapot') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), colorMat(0x3a5ea8, { rough: 0.3, key: 'bluePorc' })); b.scale.y = 0.85; g.add(b);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 6), b.material); sp.position.set(0.11, 0.02, 0); sp.rotation.z = -0.9; g.add(sp);
  } else if (type === 'plate') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.02, 14), colorMat(0xe8e4dc, { rough: 0.25, key: 'porcelain' })));
  } else if (type === 'pan') {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.05, 14), iron); g.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.04), iron); h.position.x = 0.28; g.add(h);
  } else if (type === 'axe' || type === 'bigaxe') {
    const s = type === 'bigaxe' ? 2.6 : 1;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 0.75 * s, 6), wood); g.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.2 * s, 0.03 * s), type === 'bigaxe'
      ? colorMat(0x7dff7a, { rough: 0.2, metal: 0.6, emissive: 0x2aff40, emissiveIntensity: 1.6, key: 'enchantBlade' }) : iron);
    blade.position.set(0.12 * s, 0.3 * s, 0); g.add(blade);
    // (the bigaxe's green glow is a LightRig virtual light added in launch(): a real light here would
    //  change the scene's light count and recompile every shader mid-finale)
  } else if (type === 'spear') {
    // built along +Z so lookAt() flies it point-first
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), wood); pole.rotation.x = Math.PI / 2; g.add(pole);
    for (const dx of [-0.06, 0, 0.06]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.22, 5), iron); t.rotation.x = Math.PI / 2; t.position.set(dx, 0, 0.8); g.add(t); }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Solve launch velocity for a ballistic arc (low solution). */
export function solveBallistic(from, to, speed, g) {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
  const d = Math.hypot(dx, dz);
  const v2 = speed * speed;
  const disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
  let angle;
  if (disc < 0 || d < 0.01) angle = Math.PI / 4;
  else angle = Math.atan2(v2 - Math.sqrt(disc), g * d);
  const hx = d > 0.01 ? dx / d : 0, hz = d > 0.01 ? dz / d : 0;
  return new THREE.Vector3(hx * speed * Math.cos(angle), speed * Math.sin(angle), hz * speed * Math.cos(angle));
}

function segPointDist(a, b, p) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.stuck = [];
    // telegraph visuals
    this.arcGeo = new THREE.BufferGeometry();
    this.arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    this.arcMat = new THREE.LineDashedMaterial({ color: 0xff3a2a, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.95, depthTest: false });
    this.arc = new THREE.Line(this.arcGeo, this.arcMat);
    this.arc.renderOrder = 10;
    this.arc.visible = false;
    this.arc.frustumCulled = false;
    game.scene.add(this.arc);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 28), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    game.scene.add(this.ring);
  }

  findMagnet(from, target) {
    const wps = this.game.weakPoints?.filter((w) => w.armed()) ?? [];
    if (!wps.length) return null;
    const dir = target.clone().sub(from); const len = dir.length(); dir.normalize();
    const far = target.clone().addScaledVector(dir, 3.5);
    let best = null, bestD = Infinity;
    for (const w of wps) {
      const d = segPointDist(from, far, w.pos);
      const limit = w.magnetRadius ?? 1.7;
      if (d < limit && d < bestD) { best = w; bestD = d; }
    }
    return best;
  }

  showTelegraph(from, target, type, magnet, t) {
    const T = PROJ_TYPES[type];
    const v = solveBallistic(from, target, T.speed, T.gravity);
    const pos = this.arcGeo.attributes.position;
    const p = from.clone();
    const vel = v.clone();
    const flight = Math.min(3, from.distanceTo(target) / T.speed * 1.6 + 0.2);
    const dt = flight / 47;
    let last = p.clone();
    for (let i = 0; i < 48; i++) {
      pos.setXYZ(i, p.x, p.y, p.z);
      last.copy(p);
      vel.y -= T.gravity * dt;
      p.addScaledVector(vel, dt);
    }
    pos.needsUpdate = true;
    this.arc.computeLineDistances();
    this.arc.visible = true;
    const col = magnet ? 0xffb020 : 0xff3a2a;
    this.arcMat.color.setHex(col);
    this.ring.material.color.setHex(col);
    this.ring.visible = true;
    const ground = this.game.fx.floorBelow(target.x, target.y + 0.3, target.z);
    this.ring.position.set(target.x, ground + 0.03, target.z);
    const s = (T.giant ? 2.2 : 1) * (1 + 0.15 * Math.sin(t * 18));
    this.ring.scale.setScalar(s);
  }

  hideTelegraph() { this.arc.visible = false; this.ring.visible = false; }

  launch({ type, from, target, magnet, source = 'granny_throw', thrower }) {
    const T = PROJ_TYPES[type];
    const mesh = makeMesh(type);
    mesh.position.copy(from);
    this.game.scene.add(mesh);
    const vel = solveBallistic(from, target, T.speed, T.gravity);
    const p = { type, T, mesh, pos: from.clone(), vel, age: 0, source, magnet, alive: true, thrower, hitCat: false, spinAxis: new THREE.Vector3(Math.random() - 0.5, 0.2, Math.random() - 0.5).normalize(), target: target.clone(), passed: new Set() };
    if (T.giant) p.light = this.game.lightRig?.add({ color: 0x5aff6a, intensity: 6, distance: 6, decay: 1.5, follow: mesh, priority: 2 });
    this.list.push(p);
    this.game.events.emit('projectileLaunched', { proj: p });
    return p;
  }

  fixedUpdate(dt) {
    const game = this.game;
    const cat = game.cat;
    const catC = cat.position.clone(); catC.y += 0.25;
    for (const p of this.list) {
      if (!p.alive) continue;
      p.age += dt;
      const prev = p.pos.clone();
      p.vel.y -= p.T.gravity * dt;
      // gentle magnetism toward an armed weak point in the late part of the flight
      if (p.magnet && p.magnet.armed()) {
        const to = p.magnet.pos.clone().sub(p.pos);
        const dist = to.length();
        if (p.T.giant) {
          // the enchanted axe always finds its mark once the cat has dodged
          const speed = Math.max(p.vel.length(), 11);
          p.vel.lerp(to.normalize().multiplyScalar(speed), Math.min(1, dt * (p.age > 0.25 ? 9 : 3)));
        } else if (dist < 4.5) {
          const speed = p.vel.length();
          const desired = to.normalize().multiplyScalar(Math.max(speed, 9));
          p.vel.lerp(desired, Math.min(1, dt * (dist < 2 ? 14 : 6)));
        }
      }
      const next = p.pos.clone().addScaledVector(p.vel, dt);
      // cat
      if (!p.hitCat && !cat.hidden && cat.mode !== 'caught' && cat.invuln <= 0 && segPointDist(prev, next, catC) < p.T.radius + 0.22) {
        p.hitCat = true;
        game.events.emit('projectileHitCat', { proj: p });
        cat.stun(p.vel.clone().normalize(), 2.0); // knocked back and seeing stars: Grandma can grab him now
        // the throw is spent on the cat: it bounces off instead of reaching the weak point
        if (!p.T.giant) { this.impact(p, catC.clone(), new THREE.Vector3(0, 1, 0), null); continue; }
      }
      // weak points
      let consumed = false;
      for (const w of game.weakPoints ?? []) {
        if (!w.armed() || p.passed.has(w)) continue;
        if (segPointDist(prev, next, w.pos) < (w.radius ?? 0.8)) {
          p.passed.add(w);
          w.onHit({ proj: p, type: p.type, power: p.T.damage, source: p.source, point: w.pos.clone(), dir: p.vel.clone().normalize() });
          game.events.emit('weakPointHit', { wp: w, proj: p });
          this.impact(p, w.pos.clone(), new THREE.Vector3(0, 1, 0), null);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;
      // world / props sweep
      const seg = next.clone().sub(prev);
      const len = seg.length();
      if (len > 1e-5) {
        const dir = seg.clone().divideScalar(len);
        const hit = game.physics.raycast(prev.x, prev.y, prev.z, dir.x, dir.y, dir.z, len + p.T.radius * 0.6, Q.solid);
        if (hit) {
          const owner = hit.owner;
          const point = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
          // the giant axe cleaves straight through railings on its way to the target
          if (p.T.giant && (owner?.kind === 'railing' || (owner?.kind === 'static' && p.magnet?.armed() && p.age < 2.5))) {
            if (owner?.isBreakable && !owner.broken) { p.passed.add(owner); game.destruction.damage(owner, 999, p.source, point, dir); }
            p.pos.copy(next); p.mesh.position.copy(p.pos);
            continue;
          }
          if (owner?.isBreakable && !owner.broken && !p.passed.has(owner)) {
            p.passed.add(owner);
            game.destruction.touch(owner, p.source);
            if (owner.pinned) game.destruction.knockLoose(owner, { x: dir.x * 4, y: 1, z: dir.z * 4 });
            if (owner.dynamic && owner.body && !owner.broken) {
              const m = Math.min(owner.body.mass(), 30);
              owner.body.applyImpulse({ x: dir.x * m * 7, y: m * 2.5, z: dir.z * m * 7 }, true);
            }
            const broke = game.destruction.damage(owner, p.T.damage, p.source, point, dir);
            game.events.emit('projectileHitProp', { proj: p, rec: owner, broke });
            const light = owner.dynamic || (owner.meta.score ?? 0) <= 150;
            if (broke && p.T.heavy && light) {
              p.vel.multiplyScalar(0.75); // smash straight through flimsy things
              p.pos.copy(next);
              p.mesh.position.copy(p.pos);
              continue;
            }
            if (owner.dynamic && p.T.heavy && !broke) { p.vel.multiplyScalar(0.55); p.pos.copy(next); continue; }
          }
          this.impact(p, point, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), owner);
          continue;
        }
      }
      p.pos.copy(next);
      if (p.age > 4 || p.pos.y < -5) this.impact(p, p.pos.clone(), new THREE.Vector3(0, 1, 0), null, true);
    }
    this.list = this.list.filter((p) => p.alive);
    // stuck / settled projectiles expire
    for (const s of this.stuck) {
      s.age += dt;
      if (s.body) {
        const t = s.body.translation(), r = s.body.rotation();
        s.mesh.position.set(t.x, t.y, t.z); s.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
      if (s.age > s.life) {
        if (s.body) game.physics.removeBody(s.body);
        game.scene.remove(s.mesh);
        disposeGeometry(s.mesh);
        s.dead = true;
      }
    }
    this.stuck = this.stuck.filter((s) => !s.dead);
  }

  impact(p, point, normal, owner, silent = false) {
    const game = this.game;
    p.alive = false;
    if (p.light) { game.lightRig?.remove(p.light); p.light = null; }
    if (!silent) {
      const metal = p.type === 'pan' || p.type === 'axe' || p.type === 'spear' || p.type === 'bigaxe';
      if (metal) game.fx.sparks(point, 18);
      game.fx.dust(point, p.T.heavy ? 10 : 5, { size: 0.3 });
      if (p.type === 'teapot' || p.type === 'plate') game.fx.shardBurst(point, 12, { color: p.type === 'plate' ? 0xe8e4dc : 0x3a5ea8 });
      game.events.emit('projectileImpact', { proj: p, point, owner });
      game.events.emit('noise', { pos: point.clone(), radius: p.T.heavy ? 12 : 8, source: p.source, kind: 'impact' });
      game.followCam?.addShake(p.T.giant ? 0.5 : p.T.heavy ? 0.18 : 0.06, 0.3);
      // near miss: the cat was close to the impact and didn't get hit -> "dodge"
      if (!p.hitCat && game.cat.position.distanceTo(point) < 3.2) game.events.emit('catDodged', { proj: p, point });
    }
    if (p.type === 'teapot' || p.type === 'plate') { game.scene.remove(p.mesh); disposeGeometry(p.mesh); return; }
    // embed sticky weapons in walls; others drop as physical junk
    if (p.T.sticks && owner?.kind === 'static' && Math.abs(normal.y) < 0.5 && !silent) {
      p.mesh.position.copy(point).addScaledVector(normal, 0.05);
      this.stuck.push({ mesh: p.mesh, age: 0, life: 9, body: null });
      return;
    }
    const R = game.physics.R;
    const v = p.vel.clone().multiplyScalar(-0.15); v.y = Math.abs(v.y) * 0.3 + 1;
    const pos = point.clone().addScaledVector(normal, 0.15);
    const bd = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinvel(v.x, v.y, v.z).setAngvel({ x: 4, y: 2, z: 3 });
    const body = game.physics.world.createRigidBody(bd);
    const r = p.T.radius * 0.7;
    const col = game.physics.world.createCollider(R.ColliderDesc.cuboid(r, r * 0.4, r).setDensity(800).setCollisionGroups(GROUPS.debris), body);
    game.physics.setOwner(col, { kind: 'debris' });
    p.mesh.position.copy(pos);
    this.stuck.push({ mesh: p.mesh, age: 0, life: 12, body });
  }

  update(dt) {
    for (const p of this.list) {
      p.mesh.position.copy(p.pos);
      if (p.T.spin) p.mesh.rotateOnAxis(p.spinAxis, p.T.spin * dt);
      else p.mesh.lookAt(p.pos.clone().add(p.vel)); // spears fly point-first
    }
  }

  clear() {
    for (const p of this.list) { this.game.scene.remove(p.mesh); disposeGeometry(p.mesh); if (p.light) this.game.lightRig?.remove(p.light); }
    for (const s of this.stuck) { if (s.body) this.game.physics.removeBody(s.body); this.game.scene.remove(s.mesh); disposeGeometry(s.mesh); }
    this.list = []; this.stuck = [];
    this.hideTelegraph();
  }
}
