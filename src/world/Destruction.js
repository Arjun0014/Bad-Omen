import * as THREE from 'three';
import { buildProp } from './PropFactory.js';
import { boxGeo } from './Materials.js';
import { GROUPS, G, Q, groups, quatY } from '../core/Physics.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _ws = new THREE.Vector3();
const _corners = Array.from({ length: 8 }, () => new THREE.Vector3());
const _m = new THREE.Matrix4();

const FRAG_COLORS = { wood: 0x7a5a40, ceramic: 0xe8e0d0, glass: 0xcfefff, metal: 0x555560, cloth: 0x6a3040, plant: 0x5a7a30, paper: 0xe8e0c8, wax: 0xf0e8d0, stone: 0x777777 };

export class Destruction {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.R = game.physics.R;
    this.scene = game.scene;
    this.items = [];
    this.byId = new Map();
    this.dynamic = [];
    this.debris = [];       // {mesh, body, age, frozen}
    this.fxQueue = [];      // breaks waiting for their fragments/particles (see _drainFx)
    this.maxActiveDebris = 90;
    this.maxDebrisMeshes = 700;
    this.time = 0;
    this.armTime = 1.5;     // ignore settling impacts at load
    this.root = new THREE.Group();
    this.root.name = 'Props';
    this.scene.add(this.root);
    this.physics.forceHandlers.push((h1, h2, a, b, f) => this._onForce(a, b, f));
  }

  // ------------------------------------------------------------------ spawning
  spawn(def) {
    const { group, parts, meta } = buildProp(def.kind, def.opts ?? {});
    Object.assign(meta, def.meta ?? {});
    const id = def.id ?? `${def.kind}_${this.items.length}`;
    if (this.byId.has(id)) throw new Error('duplicate breakable id ' + id);
    const [x, y, z] = def.pos;
    group.position.set(x, y, z);
    group.rotation.y = def.rotY ?? 0;
    if (def.scale) group.scale.setScalar(def.scale);
    group.name = id;
    // the moon is the only shadow-casting light and the roof keeps it out of the house: only props in the
    // yard and under the conservatory's glass roof can show a shadow (saves ~800 shadow-pass draw calls).
    // Small parts there (books, cups, plant pots) cast none either: a speck of shadow each, but a shadow-pass
    // draw call apiece (~2 ms of the moon's ~2.3 ms CPU per frame went on 362 prop casters).
    const lit = Destruction.moonlit(x, z, def.zone);
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (!lit) { o.castShadow = false; return; }
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const s = o.getWorldScale(_ws);
      if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.12) o.castShadow = false;
    });
    this.root.add(group);
    const rec = {
      id, kind: def.kind, meta, group, parts, zone: def.zone ?? 'house', tags: new Set([...(meta.tags ?? []), ...(def.tags ?? [])]),
      hp: meta.hp ?? 1, maxHp: meta.hp ?? 1, broken: false, dynamic: !!meta.dynamic && !def.static,
      lastHit: null, prevVel: new THREE.Vector3(), colliders: [], body: null, isBreakable: true,
      onBreak: [], setpiece: def.setpiece, pinned: !!meta.wallHung, scored: false, def,
    };
    if (meta.tier !== 'decor') this._makeBody(rec, def);
    this.items.push(rec);
    this.byId.set(id, rec);
    if (rec.dynamic) this.dynamic.push(rec);
    if (meta.flame) this._addFlameLight(rec);
    return rec;
  }

  _addFlameLight(rec) {
    // a virtual light that follows the candle (the LightRig only lights the ones near the cat/camera)
    // soft and a little above the flame: a point light's falloff right next to it burnt Komur's fur white
    rec.light = this.game.lightRig.add({ color: 0xffa040, intensity: 1.1, distance: 3.5, decay: 1.6, follow: rec.group, offset: new THREE.Vector3(0, 0.45, 0), priority: 0.8 });
  }

  _shapesFor(rec) {
    const shapes = [];
    const R = this.R;
    for (const p of rec.parts) {
      if (!p.col || rec.meta.noCollide) continue;
      const m = p.mesh;
      const sc = rec.group.scale.x;
      let desc;
      let pos = m.position.clone().multiplyScalar(sc);
      const rot = m.quaternion.clone();
      if (p.type === 'box') desc = R.ColliderDesc.cuboid(p.w / 2 * sc, p.h / 2 * sc, p.d / 2 * sc);
      else if (p.type === 'cyl') desc = R.ColliderDesc.cylinder(p.h / 2 * sc, p.r * sc);
      else if (p.type === 'ball') desc = R.ColliderDesc.ball(Math.max(p.r, p.h / 2) * sc);
      else if (p.type === 'cylLathe') { desc = R.ColliderDesc.cylinder(p.h / 2 * sc, p.r * sc); pos.y += p.h / 2 * sc; }
      if (!desc) continue;
      desc.setTranslation(pos.x, pos.y, pos.z).setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
      const vol = p.type === 'box' ? p.w * p.h * p.d : Math.PI * p.r * p.r * p.h;
      shapes.push({ desc, vol: vol * sc * sc * sc });
    }
    // thin legs, wheels and stands don't collide, so a dynamic prop settled on its lowest collider and sank
    // through the floor, legs and all (playtest 3: "chairs have no legs": chairs 0.43 m, stools 0.48 m, the
    // wheelbarrow 0.18 m).  A light support block under the lowest collider keeps it standing on its legs.
    if (rec.dynamic && shapes.length && !rec.meta.noCollide) {
      let low = null, lowBottom = Infinity;
      for (const p of rec.parts) {
        if (!p.col) continue;
        const b = p.mesh.position.y - (p.type === 'cylLathe' ? 0 : p.type === 'ball' ? Math.max(p.r, p.h / 2) : p.h / 2);
        if (b < lowBottom) { lowBottom = b; low = p; }
      }
      if (low && lowBottom > 0.03) {
        const sc = rec.group.scale.x;
        const hw = Math.max(0.03, (low.w ?? 0.2) * 0.42) * sc, hd = Math.max(0.03, (low.d ?? low.w ?? 0.2) * 0.42) * sc;
        const hh = (lowBottom / 2) * sc;
        const desc = R.ColliderDesc.cuboid(hw, hh, hd).setTranslation(low.mesh.position.x * sc, hh, low.mesh.position.z * sc);
        shapes.push({ desc, vol: hw * hh * hd * 8 * 0.25 }); // mostly air between the legs: a light share of the mass
      }
    }
    return shapes;
  }

  _makeBody(rec, def) {
    const R = this.R;
    const g = rec.group;
    const shapes = this._shapesFor(rec);
    if (!shapes.length) return;
    const dyn = rec.dynamic && !rec.pinned;
    const bd = dyn ? R.RigidBodyDesc.dynamic() : R.RigidBodyDesc.fixed();
    bd.setTranslation(g.position.x, g.position.y, g.position.z).setRotation(quatY(g.rotation.y));
    if (dyn) {
      bd.setLinearDamping(0.08).setAngularDamping(0.35);
      if ((rec.meta.mass ?? 1) < 2.5) bd.setCcdEnabled(true);
    }
    const body = this.physics.world.createRigidBody(bd);
    const totalVol = shapes.reduce((a, s) => a + s.vol, 0) || 1;
    const density = (rec.meta.mass ?? 5) / totalVol;
    const fixtureGroups = rec.meta.tier === 'fixture' || rec.meta.tier === 'structural' || rec.meta.tier === 'spectacle';
    for (const s of shapes) {
      s.desc.setCollisionGroups(rec.dynamic ? GROUPS.prop : (fixtureGroups ? GROUPS.fixture : GROUPS.static))
        .setFriction(0.65).setRestitution(0.12).setDensity(density);
      if (rec.dynamic) s.desc.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(60);
      const c = this.physics.world.createCollider(s.desc, body);
      this.physics.setOwner(c, rec);
      rec.colliders.push(c);
    }
    rec.body = body;
  }

  /** Register a custom object (structural beams, set-piece parts) built elsewhere. */
  registerCustom(rec) {
    rec.isBreakable = true;
    rec.broken = false;
    rec.hp ??= rec.meta.hp ?? 100;
    rec.maxHp ??= rec.hp;
    rec.tags ??= new Set();
    rec.onBreak ??= [];
    rec.prevVel = new THREE.Vector3();
    rec.colliders ??= [];
    rec.parts ??= [];
    for (const c of rec.colliders) this.physics.setOwner(c, rec);
    this.items.push(rec);
    this.byId.set(rec.id, rec);
    if (rec.dynamic) this.dynamic.push(rec);
    return rec;
  }

  get(id) { return this.byId.get(id); }

  /** Can moonlight reach this spot (yard, porch, glass-roofed conservatory) rather than the roofed house? */
  static moonlit(x, z, zone) {
    if (zone === 'yard' || zone === 'wing') return true;
    if (zone && zone !== 'windows') return false;
    return !(x > -7.2 && x < 7.2 && z > -5.2 && z < 5.2);
  }

  // ------------------------------------------------------------------ provenance
  touch(rec, source, strength = 1) {
    if (!rec || rec.broken) return;
    // Grandma provenance is sticky over weaker cat touches for a short while
    const now = this.time;
    if (rec.lastHit && rec.lastHit.source.startsWith('granny') && !source.startsWith('granny') && now - rec.lastHit.t < 1.5) return;
    rec.lastHit = { source, t: now, strength };
  }

  sourceOf(rec, fallback = 'physics') {
    if (rec.lastHit && this.time - rec.lastHit.t < 4) return rec.lastHit.source;
    return fallback;
  }

  // ------------------------------------------------------------------ damage
  damage(rec, amount, source, point, dir) {
    if (!rec || rec.broken || amount <= 0) return false;
    if (rec.meta.unbreakable) { this._rattle(rec, point, 0.5); return false; }
    if (rec.meta.requiresGranny && !(source.startsWith('granny') || source === 'script' || source === 'falling_heavy' || source === 'fire')) {
      this._rattle(rec, point, 0.4);
      this.game.events.emit('immuneHit', { rec, source, point });
      return false;
    }
    this.touch(rec, source);
    rec.hp -= amount;
    this.game.events.emit('propDamaged', { rec, amount, source, point });
    if (rec.hp <= 0) { this.breakIt(rec, source, point, dir); return true; }
    this._rattle(rec, point, Math.min(1, amount / Math.max(20, rec.maxHp)));
    if (rec.hp < rec.maxHp * 0.5 && !rec.cracked) { rec.cracked = true; this._crack(rec); }
    return false;
  }

  _rattle(rec, point, k = 0.5) {
    rec.shake = Math.max(rec.shake ?? 0, 0.25 * k + 0.05);
    if (point) this.game.fx.dust(point, 3, { size: 0.15, spread: 0.3 });
  }

  _crack(rec) {
    // darken + emissive cracks hint
    rec.group.traverse((o) => {
      if (o.isMesh && o.material && !o.material.transparent && !o.userData.crackMat) {
        o.material = o.material.clone();
        o.material.color?.multiplyScalar(0.8);
        o.userData.crackMat = true;
      }
    });
    this.game.events.emit('propCracked', { rec });
  }

  knockLoose(rec, impulse) {
    if (!rec.pinned || rec.broken || !rec.body) return;
    rec.pinned = false;
    rec.dynamic = true;
    rec.body.setBodyType(this.R.RigidBodyType.Dynamic, true);
    for (const c of rec.colliders) {
      c.setCollisionGroups(GROUPS.prop);
      c.setActiveEvents(this.R.ActiveEvents.CONTACT_FORCE_EVENTS);
      c.setContactForceEventThreshold(60);
    }
    if (!this.dynamic.includes(rec)) this.dynamic.push(rec);
    rec.prevVel.set(0, 0, 0);
    if (impulse) rec.body.applyImpulse(impulse, true);
    this.game.events.emit('propLoose', { rec });
  }

  breakIt(rec, source = 'physics', point, dir, opts = {}) {
    if (rec.broken) return;
    rec.broken = true;
    rec.hp = 0;
    const bbox = new THREE.Box3().setFromObject(rec.group);
    const center = bbox.getCenter(new THREE.Vector3());
    point = point ? new THREE.Vector3(point.x, point.y, point.z) : center.clone();
    dir = dir ? new THREE.Vector3(dir.x, dir.y ?? 0, dir.z) : new THREE.Vector3();
    // capture velocity of dynamic bodies for fragments
    const v = rec.body && rec.dynamic ? rec.body.linvel() : { x: 0, y: 0, z: 0 };
    const vel = { x: v.x, y: v.y, z: v.z };
    // physics removal (+ wake things resting on it)
    if (rec.body) { this.physics.removeBody(rec.body); rec.body = null; }
    else for (const c of rec.colliders) this.physics.removeCollider(c);
    rec.colliders = [];
    this.wakeAround(bbox, source);
    this._recheckAbove(bbox); // frozen debris that lay on it falls now, not a second later
    // fragments + particles go through a per-frame time budget (a 13-prop chain reaction used to build
    // ~50 debris meshes/bodies and all their particles in one frame).  The prop stays visible, frozen in
    // place, until its own fragments appear; score, noise and set-piece consequences below are immediate.
    const power = source.startsWith('granny') ? 1.6 : (source === 'script' ? 1.3 : 1);
    if (opts.noFragments && opts.silent) rec.group.visible = false;
    else {
      rec.group.updateMatrixWorld(true);
      this.fxQueue.push({ rec, point, dir, vel, power, center, fragments: !opts.noFragments, fx: !opts.silent });
    }
    if (rec.light) { this.game.lightRig.remove(rec.light); rec.light = null; }
    const noise = rec.meta.noise ?? 9;
    this.game.events.emit('noise', { pos: center.clone(), radius: noise, source, kind: 'break', rec });
    this.game.events.emit('propBroken', { rec, source, point: center.clone() });
    for (const fn of rec.onBreak) { try { fn(rec, source); } catch (e) { console.error(e); } }
  }

  wakeAround(bbox, source) {
    const b = bbox.clone().expandByScalar(0.35);
    for (const d of this.dynamic) {
      if (d.broken || !d.body) continue;
      const t = d.body.translation();
      if (t.x > b.min.x && t.x < b.max.x && t.y > b.min.y - 0.1 && t.y < b.max.y + 0.6 && t.z > b.min.z && t.z < b.max.z) {
        d.body.wakeUp();
        if (source) this.touch(d, source);
      }
    }
  }

  _breakFx(rec, c) {
    const fx = this.game.fx;
    const mat = rec.meta.material ?? 'wood';
    if (mat === 'glass') { fx.shardBurst(c, 16, { color: 0xd8f4ff }); fx.dust(c, 4, { color: [0.8, 0.85, 0.9], size: 0.18 }); }
    else if (mat === 'ceramic') { fx.shardBurst(c, 14, { color: FRAG_COLORS.ceramic }); fx.dust(c, 5, { color: [0.85, 0.82, 0.75], size: 0.2 }); }
    else if (mat === 'wood') { fx.splinterBurst(c, rec.meta.tier === 'fixture' ? 22 : 10, { color: 0x8a6a48 }); fx.dust(c, rec.meta.tier === 'fixture' ? 18 : 8, { size: 0.4 }); }
    else if (mat === 'metal') fx.sparks(c, 16);
    else if (mat === 'plant') fx.dust(c, 10, { color: [0.4, 0.55, 0.2], size: 0.2 });
    else if (mat === 'paper') { fx.splinterBurst(c, 10, { color: 0xe8e0c8, size: 0.05 }); }
    else if (mat === 'fabric') fx.dust(c, 10, { color: [0.5, 0.2, 0.25], size: 0.25 });
    else if (mat === 'wax') fx.shardBurst(c, 6, { color: FRAG_COLORS.wax });
    if (rec.meta.glow) fx.magic(c, 16, new THREE.Color(rec.meta.glow).toArray());
    this.game.events.emit('breakSound', { rec, material: mat, pos: c, tier: rec.meta.tier });
  }

  _fragment(rec, point, dir, vel, power) {
    const R = this.R;
    rec.group.updateMatrixWorld(true);
    for (const p of rec.parts) {
      const kind = p.frag ?? 'wood';
      if (kind === 'cloth' || kind === 'plant' || kind === 'paper' && p.w < 0.1) continue;
      p.mesh.updateMatrixWorld(true);
      p.mesh.matrixWorld.decompose(_v, _q, _s);
      const sx = (p.w ?? 0.1) * _s.x, sy = (p.h ?? 0.1) * _s.y, sz = (p.d ?? 0.1) * _s.z;
      const mat = p.mesh.userData.fadeOrig ?? p.mesh.material; // never inherit the camera's see-through twin
      const pieces = [];
      if (kind === 'ceramic' || kind === 'glass' || kind === 'wax') {
        const n = Math.min(4, 1 + Math.floor((sx + sy + sz) * 4));
        for (let i = 0; i < n; i++) {
          const s = Math.max(0.03, Math.min(0.09, (sx + sy + sz) / 6));
          pieces.push({ off: new THREE.Vector3((Math.random() - 0.5) * sx, (Math.random() - 0.3) * sy, (Math.random() - 0.5) * sz), size: [s * (0.7 + Math.random() * 0.6), s * 0.35, s * (0.6 + Math.random() * 0.6)], mat });
        }
      } else {
        // split the longest axis in two for boards bigger than ~0.5m
        const dims = [sx, sy, sz];
        const longest = dims.indexOf(Math.max(...dims));
        const split = dims[longest] > 0.5 ? 2 : 1;
        for (let i = 0; i < split; i++) {
          const size = [...dims];
          size[longest] = dims[longest] / split;
          const off = new THREE.Vector3();
          off.setComponent(longest, (i - (split - 1) / 2) * size[longest]);
          off.applyQuaternion(_q);
          pieces.push({ off, size, mat, quat: _q.clone() });
        }
      }
      for (const pc of pieces) {
        const pos = _v.clone().add(pc.off);
        const quat = pc.quat ?? new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
        const out = pos.clone().sub(point); out.y = Math.abs(out.y) + 0.3; out.normalize();
        const speed = (kind === 'wood' ? 2.2 : 1.6) * power;
        const v = new THREE.Vector3(vel.x * 0.6, vel.y * 0.4, vel.z * 0.6).addScaledVector(out, speed * (0.5 + Math.random())).addScaledVector(dir, 2.5 * power);
        this.spawnDebris(pos, quat, pc.size, pc.mat, v, kind);
      }
    }
  }

  spawnDebris(pos, quat, size, mat, vel, kind = 'wood', life = 5) {
    const R = this.R;
    const [w, h, d] = size.map((s) => Math.max(0.02, s));
    const mesh = new THREE.Mesh(boxGeo(w, h, d, 0.8), mat);
    mesh.position.copy(pos); mesh.quaternion.copy(quat);
    mesh.castShadow = w * h * d > 0.004 && Destruction.moonlit(pos.x, pos.z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    const bd = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinvel(vel.x, vel.y, vel.z).setAngvel({ x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 10 })
      .setLinearDamping(0.1).setAngularDamping(0.4);
    const body = this.physics.world.createRigidBody(bd);
    const heavy = w * h * d > 0.02;
    const cd = R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setDensity(kind === 'wood' ? 500 : 900).setFriction(0.8).setRestitution(0.15)
      .setCollisionGroups(heavy ? GROUPS.prop : GROUPS.debris);
    const col = this.physics.world.createCollider(cd, body);
    this.physics.setOwner(col, { kind: 'debris' });
    this.debris.push({ mesh, body, age: 0, life, frozen: false, heavy, size: [w, h, d], kind });
    this._capActive();
    if (this.debris.length > this.maxDebrisMeshes) this._removeDebris(this.debris[0]);
    return { mesh, body };
  }

  /** Too many live debris bodies: the oldest one at rest freezes for good; if none is at rest the oldest is
   *  removed instead (playtest 3: freezing pieces in flight left planks hanging in the air). */
  _capActive() {
    let active = 0;
    for (const d of this.debris) if (!d.frozen) active++;
    while (active > this.maxActiveDebris) {
      let victim = null, oldest = null;
      for (const d of this.debris) {
        if (d.frozen) continue;
        if (!oldest || (oldest.age < 0.3 && d.age >= 0.3)) oldest = d;
        const v = d.body.linvel();
        // at rest AND lying on something: a piece just let go of (its support broke) has no speed yet, and freezing
        // it again at once left it hanging in the air for good (qa_probe no_floating_fragments after SP10)
        if ((d.body.isSleeping() || Math.hypot(v.x, v.y, v.z) < 0.25) && d.age >= 0.3 && this._supported(d)) { victim = d; break; }
      }
      if (victim) this._freeze(victim);
      else this._removeDebris(oldest);
      active--;
    }
  }

  _removeDebris(d) {
    if (!d) return;
    if (d.body) this.physics.removeBody(d.body);
    d.body = null;
    this.root.remove(d.mesh);
    d.mesh.geometry.dispose();
    const i = this.debris.indexOf(d);
    if (i >= 0) this.debris.splice(i, 1);
  }

  /** Is a frozen piece still resting on something?  Rays down from its three lowest corners. */
  _supported(d) {
    const [w, h, dd] = d.size;
    const m = d.mesh.matrixWorld;
    let k = 0;
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) _corners[k++].set(sx * w, sy * h, sz * dd).applyMatrix4(m);
    _corners.sort((a, b) => a.y - b.y);
    for (let i = 0; i < 3; i++) {
      const c = _corners[i];
      if (this.physics.raycast(c.x, c.y + 0.03, c.z, 0, -1, 0, 0.14, Q.solid)) return true;
    }
    return false;
  }

  /** A frozen piece whose support went away (the table under it broke, a chair got shoved) falls again. */
  _unfreeze(d) {
    const R = this.R;
    const p = d.mesh.position, q = d.mesh.quaternion;
    const body = this.physics.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setLinearDamping(0.1).setAngularDamping(0.4));
    const [w, h, dd] = d.size;
    const col = this.physics.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, dd / 2).setDensity(d.kind === 'wood' ? 500 : 900)
      .setFriction(0.8).setRestitution(0.15).setCollisionGroups(d.heavy ? GROUPS.prop : GROUPS.debris), body);
    this.physics.setOwner(col, { kind: 'debris' });
    d.body = body; d.frozen = false; d.age = 0; d.life = 5;
    d.mesh.matrixAutoUpdate = true;
    this._capActive();
  }

  /** Round-robin support check of frozen debris, a few pieces per step (cheap: up to three short rays each). */
  _checkSupport(perStep = 16) {
    const n = this.debris.length;
    let checks = 0;
    for (let k = 0; k < n && checks < perStep; k++) {
      this._supIdx = ((this._supIdx ?? 0) + 1) % n;
      const d = this.debris[this._supIdx];
      if (!d?.frozen) continue;
      checks++;
      if (!this._supported(d)) this._unfreeze(d);
    }
  }

  /** Right after something breaks: re-check the frozen debris that may have been lying on it. */
  _recheckAbove(bbox) {
    for (const d of [...this.debris]) {
      if (!d.frozen) continue;
      const p = d.mesh.position;
      if (p.x < bbox.min.x - 0.15 || p.x > bbox.max.x + 0.15 || p.z < bbox.min.z - 0.15 || p.z > bbox.max.z + 0.15) continue;
      if (p.y < bbox.min.y - 0.1 || p.y > bbox.max.y + 0.6) continue;
      if (!this._supported(d)) this._unfreeze(d);
    }
  }

  _freeze(d) {
    if (d.frozen) return;
    const t = d.body.translation(), r = d.body.rotation();
    d.mesh.position.set(t.x, t.y, t.z); d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    this.physics.removeBody(d.body);
    d.body = null;
    d.frozen = true;
    d.mesh.matrixAutoUpdate = false;
    d.mesh.updateMatrix();
  }

  /** Radial impulse (tantrum stomps, explosions, crashes). */
  blast(point, radius, strength, source, { damage = 0, up = 0.5 } = {}) {
    for (const rec of this.items) {
      if (rec.broken) continue;
      const c = rec.body ? rec.body.translation() : rec.group.position;
      const dx = c.x - point.x, dy = c.y - point.y, dz = c.z - point.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > radius) continue;
      const k = 1 - dist / radius;
      if (rec.pinned && k > 0.3) this.knockLoose(rec);
      if (rec.dynamic && rec.body) {
        const m = rec.body.mass();
        const n = Math.max(dist, 0.2);
        this.touch(rec, source);
        rec.body.applyImpulse({ x: dx / n * strength * k * m, y: (up + Math.random() * 0.3) * strength * k * m, z: dz / n * strength * k * m }, true);
      }
      if (damage > 0) this.damage(rec, damage * k, source, c, { x: dx, y: 0, z: dz });
    }
    for (const d of this.debris) if (!d.frozen && d.body) {
      const t = d.body.translation();
      const dist = Math.hypot(t.x - point.x, t.y - point.y, t.z - point.z);
      if (dist < radius) d.body.applyImpulse({ x: (t.x - point.x) * 0.2, y: 0.3, z: (t.z - point.z) * 0.2 }, true);
    }
  }

  // ------------------------------------------------------------------ cat interactions
  catSwipe(cat, center, radius, dir) {
    let hits = 0;
    const cols = this.physics.overlapSphere(center.x, center.y, center.z, radius, groups(0xffff, G.PROP | G.FIXTURE));
    const seen = new Set();
    for (const c of cols) {
      const rec = this.physics.ownerOf(c);
      if (!rec || !rec.isBreakable || rec.broken || seen.has(rec)) continue;
      seen.add(rec);
      hits++;
      this.touch(rec, 'cat_swipe');
      if (rec.pinned) this.knockLoose(rec, { x: dir.x * 1.5, y: 0.5, z: dir.z * 1.5 });
      else if (rec.dynamic && rec.body) {
        const m = rec.body.mass();
        const k = Math.min(m, 4) * 2.6;
        rec.body.applyImpulse({ x: dir.x * k, y: 1.0 * Math.min(m, 4), z: dir.z * k }, true);
        rec.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.1 * m, y: (Math.random() - 0.5) * 0.1 * m, z: (Math.random() - 0.5) * 0.1 * m }, true);
      } else if (rec.meta.catBreakable) this.damage(rec, 999, 'cat_swipe', center, dir);
      else this.damage(rec, 4, 'cat_swipe', center, dir);
      this.game.events.emit('catHit', { rec, kind: 'swipe', point: center });
    }
    return hits;
  }

  catPounce(cat, center, radius, dir, speed) {
    const cols = this.physics.overlapSphere(center.x, center.y, center.z, radius, groups(0xffff, G.PROP | G.FIXTURE));
    for (const c of cols) {
      const rec = this.physics.ownerOf(c);
      if (!rec || !rec.isBreakable || rec.broken || cat.pounceHits.has(rec)) continue;
      cat.pounceHits.add(rec);
      this.touch(rec, 'cat_pounce');
      if (rec.pinned) this.knockLoose(rec, { x: dir.x * 3, y: 1, z: dir.z * 3 });
      else if (rec.dynamic && rec.body) {
        const m = rec.body.mass();
        const k = Math.min(m, 10) * speed * 0.55;
        rec.body.applyImpulse({ x: dir.x * k, y: Math.min(m, 10) * 1.6, z: dir.z * k }, true);
        if (rec.meta.tier === 'movable' && m < 12) this.damage(rec, 6, 'cat_pounce', center, dir);
      } else if (rec.meta.catBreakable) this.damage(rec, 999, 'cat_pounce', center, dir);
      else this.damage(rec, 10, 'cat_pounce', center, dir);
      this.game.events.emit('catHit', { rec, kind: 'pounce', point: center });
    }
  }

  // ------------------------------------------------------------------ physics events
  _onForce(a, b, f) {
    // fixtures hit hard by heavy dynamic objects take damage (windows shatter from thrown props)
    const pairs = [[a, b], [b, a]];
    for (const [fix, other] of pairs) {
      if (!fix?.isBreakable || fix.broken || fix.dynamic) continue;
      if (!other) continue;
      const otherIsMover = other.isBreakable ? other.dynamic : other.kind === 'debris' || other.kind === 'projectile';
      if (!otherIsMover) continue;
      const thresh = fix.meta.catBreakable ? 120 : 2400;
      if (f < thresh) continue;
      const src = other.isBreakable ? this.sourceOf(other, 'falling_prop') : (other.source ?? 'falling_prop');
      const heavy = f > 9000 ? 'falling_heavy' : src;
      this.damage(fix, fix.meta.catBreakable ? 999 : (f / 2400) * 12, heavy === 'falling_heavy' && src.startsWith('granny') ? src : heavy, null);
    }
  }

  // ------------------------------------------------------------------ update
  fixedUpdate(dt) {
    this.time += dt;
    const armed = this.time > this.armTime;
    for (const rec of this.dynamic) {
      if (rec.broken || !rec.body || rec.pinned) continue;
      if (rec.body.isSleeping()) { rec.prevVel.set(0, 0, 0); continue; }
      const v = rec.body.linvel();
      const dv = Math.hypot(v.x - rec.prevVel.x, v.y - rec.prevVel.y, v.z - rec.prevVel.z);
      rec.prevVel.set(v.x, v.y, v.z);
      if (!armed || rec.meta.unbreakable) continue;
      if (dv > (rec.meta.breakDv ?? 3) && dv < 60) {
        const src = this.sourceOf(rec, 'physics');
        const t = rec.body.translation();
        const amount = rec.meta.tier === 'fragile' ? 999 : (dv - rec.meta.breakDv + 1) * 14;
        this.damage(rec, amount, src, t, { x: v.x, y: 0, z: v.z });
      }
      if (rec.broken || !rec.body) continue;
      // fell out of the world
      const t = rec.body.translation();
      if (t.y < -6) this.breakIt(rec, 'physics');
    }
    let expired = null;
    for (const d of this.debris) {
      if (d.frozen) continue;
      d.age += dt;
      if (d.age > 1.2 && d.body.isSleeping()) { this._freeze(d); continue; }
      if (d.age > d.life) {
        // freeze only once it has (nearly) stopped: freezing a piece still in flight left it hanging in the air
        const v = d.body.linvel();
        if (Math.hypot(v.x, v.y, v.z) < 0.3) this._freeze(d);
        else if (d.age > d.life + 6) (expired ??= []).push(d); // still tumbling after 11 s: let it go
      }
    }
    if (expired) for (const d of expired) this._removeDebris(d);
    this._checkSupport();
  }

  /** Spawn queued fragments/particles within a small per-frame budget (at least one break per frame). */
  _drainFx(budgetMs = 4) {
    const t0 = performance.now();
    while (this.fxQueue.length) {
      const j = this.fxQueue.shift();
      if (j.fragments) this._fragment(j.rec, j.point, j.dir, j.vel, j.power);
      if (j.fx) this._breakFx(j.rec, j.center);
      j.rec.group.visible = false;
      if (performance.now() - t0 > budgetMs) break;
    }
  }

  update(dt) {
    this._drainFx();
    for (const rec of this.dynamic) {
      if (rec.broken || !rec.body) continue;
      const t = rec.body.translation(), r = rec.body.rotation();
      rec.group.position.set(t.x, t.y, t.z);
      rec.group.quaternion.set(r.x, r.y, r.z, r.w);
    }
    for (const d of this.debris) {
      if (d.frozen || !d.body) continue;
      const t = d.body.translation(), r = d.body.rotation();
      d.mesh.position.set(t.x, t.y, t.z);
      d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    for (const rec of this.items) {
      if (rec.shake > 0 && !rec.broken) {
        rec.shake = Math.max(0, rec.shake - dt);
        const s = rec.shake * 0.25;
        if (!rec.dynamic) {
          rec._base ??= rec.group.position.clone();
          rec.group.position.set(rec._base.x + (Math.random() - 0.5) * s, rec._base.y, rec._base.z + (Math.random() - 0.5) * s);
          if (rec.shake === 0) rec.group.position.copy(rec._base);
        }
      }
    }
  }

  stats() {
    let total = 0, broken = 0;
    for (const r of this.items) if (r.meta.score > 0) { total++; if (r.broken) broken++; }
    return { total, broken, activeDebris: this.debris.filter((d) => !d.frozen).length, debris: this.debris.length };
  }
}
