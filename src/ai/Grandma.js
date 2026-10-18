import * as THREE from 'three';
import { GROUPS, G, groups, Q } from '../core/Physics.js';
import { colorMat } from '../world/Materials.js';
import { segmentCrosses } from '../world/Fire.js';
import EVENTS from '../data/grandmaEvents.json';

export const GR = {
  radius: 0.3, halfHeight: 0.55, modelHeight: 1.74,
  // the cat walks at 1.45 and gallops at 3.9 m/s: Grandma's chase (2.05 calm .. 3.2 at full rage) runs down a
  // walking cat but never a galloping one — when she's coming, sprint
  walk: 1.3, investigate: 1.8, chaseBase: 2.05, chaseRage: 0.0115,
  turn: 8, sight: 15, fovCos: Math.cos(THREE.MathUtils.degToRad(68)), eye: 1.55,
  catchRange: 1.05, swingRange: 1.75, throwMin: 2.4, throwMax: 15,
  memory: 6,
  // fire: she is singed within a cluster's radius + firePad and keeps fireMargin more clear when she walks
  firePad: 0.25, fireMargin: 0.2,
};

const tmp = new THREE.Vector3();
const _grip = new THREE.Vector3(), _gripB = new THREE.Vector3(), _scruff = new THREE.Vector3();
// holding Komur clear of her hand (_clearOfHand): his surface binned along his neck axis and around it
const HOLD = { slices: 16, sectors: 8, before: 0.04, past: 0.12, reach: 0.15, skin: 0.005 };
const _hw = new THREE.Vector3(), _hq = new THREE.Vector3(), _hoff = new THREE.Vector3(), _hu = new THREE.Vector3();
const _ca = new THREE.Vector3(), _ch = new THREE.Vector3(), _hx = new THREE.Vector3(), _hp0 = new THREE.Vector3(), _hp1 = new THREE.Vector3();
const _hdirs = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _htarget = new THREE.Vector3();

function weaponForPhase(phase) {
  if (phase >= 4) return Math.random() < 0.5 ? 'axe' : 'spear';
  if (phase >= 3) return Math.random() < 0.55 ? 'axe' : 'spear';
  if (phase >= 2) return Math.random() < 0.7 ? 'pan' : 'teapot';
  return Math.random() < 0.6 ? 'teapot' : 'plate';
}

export class Grandma {
  constructor(game, gltf, nav, spawn) {
    this.game = game;
    this.physics = game.physics;
    this.nav = nav;
    const R = this.physics.R;

    // ---- visual
    this.root = new THREE.Group();
    this.root.name = 'Grandma';
    this.model = gltf.scene;
    // native goblin height measured in Blender: 2.08m (incl. ears/top-knot); feet at -0.019m
    const NATIVE_H = 2.08;
    this.model.scale.setScalar(GR.modelHeight / NATIVE_H);
    this.model.position.y = 0.019 * (GR.modelHeight / NATIVE_H);
    this.root.add(this.model);
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      if (o.isBone) {
        if (/RightHand$/.test(o.name)) this.hand = o;
        if (/RightHandMiddle1$/.test(o.name)) this.gripA = o;
        if (/RightHandMiddle3$/.test(o.name)) this.gripB = o;
        if (/LeftHand$/.test(o.name)) this.lhand = o;
        if (/Head$/.test(o.name)) this.head = o;
        if (/Spine2$/.test(o.name)) this.chest = o;
      }
    });
    game.scene.add(this.root);
    this._accessorize();

    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const c of gltf.animations) this.clips[c.name] = c;
    this.actions = {};
    this.current = null;

    // ---- physics (kinematic capsule)
    this.position = spawn.clone();
    this.prevPosition = spawn.clone();
    const bd = R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + this.centerOffset, spawn.z);
    this.body = this.physics.world.createRigidBody(bd);
    this.collider = this.physics.world.createCollider(R.ColliderDesc.capsule(GR.halfHeight, GR.radius).setCollisionGroups(GROUPS.granny), this.body);
    this.physics.setOwner(this.collider, { kind: 'granny', granny: this });
    this.kcc = this.physics.world.createCharacterController(0.03);
    this.kcc.enableAutostep(0.28, 0.1, true);
    this.kcc.enableSnapToGround(0.35);
    this.kcc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(90);
    this.moveFilter = groups(0xffff, G.STATIC | G.FIXTURE | G.PROP | G.CATONLY | G.RAIL);
    // her paths prefer routes that don't cross burning fire clusters
    nav.hazard = (a, b) => game.fire?.segmentHot(a, b, GR.firePad + GR.fireMargin);

    this.reset(spawn);
    game.events.on('noise', (e) => this.onNoise(e));
    game.events.on('catTaunt', (e) => this.onTaunt(e));
  }

  get centerOffset() { return GR.radius + GR.halfHeight + 0.03; }

  _accessorize() {
    // Make the goblin read as a witchy Grandma: crooked witch hat, round spectacles, shawl, broom.
    const hatMat = colorMat(0x1c1426, { rough: 0.85, key: 'hat' });
    const bandMat = colorMat(0x7a3a9a, { rough: 0.6, key: 'hatband', emissive: 0x2a0a3a });
    const hat = new THREE.Group();
    // one smooth crooked cone (it read as stacked stovepipes in close-ups) with a softly drooping brim
    const H = 0.54;
    const coneGeo = new THREE.ConeGeometry(0.17, H, 20, 14, true);
    coneGeo.translate(0, H / 2, 0);
    const cp = coneGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const y = cp.getY(i), t = Math.min(1, Math.max(0, y / H)); // float32 rounding leaves the rim at -1e-8: pow(<0, 2.4) = NaN
      cp.setX(i, cp.getX(i) + 0.17 * Math.pow(t, 2.4) + 0.012 * Math.sin(t * 9)); // flops to one side, a little dented
      cp.setY(i, y - 0.07 * Math.pow(t, 3));
      cp.setZ(i, cp.getZ(i) - 0.03 * Math.pow(t, 2));
    }
    coneGeo.computeVertexNormals();
    const cone = new THREE.Mesh(coneGeo, colorMat(0x1c1426, { rough: 0.85, key: 'hatCone', side: THREE.DoubleSide }));
    const brimGeo = new THREE.LatheGeometry([[0.0, 0.012], [0.16, 0.014], [0.26, 0.008], [0.33, -0.006], [0.37, -0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    const brim = new THREE.Mesh(brimGeo, colorMat(0x1c1426, { rough: 0.85, key: 'hatBrim', side: THREE.DoubleSide }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.17, 0.055, 20), bandMat); band.position.y = 0.04;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), colorMat(0xd4a83a, { metal: 1, rough: 0.3, key: 'gold' })); buckle.position.set(0, 0.04, 0.17);
    void hatMat;
    hat.add(brim, cone, band, buckle);
    hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hat = hat;
    const glassMat = colorMat(0xd4a83a, { metal: 1, rough: 0.3, key: 'gold' });
    const specs = new THREE.Group();
    for (const sx of [-0.045, 0.045]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16), glassMat);
      ring.position.x = sx; specs.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), colorMat(0xcfe8ff, { transparent: true, opacity: 0.35, rough: 0.05, key: 'lens', emissive: 0x334455 }));
      lens.position.set(sx, 0, 0.001); specs.add(lens);
    }
    this.specs = specs;
    // broom in her right hand
    const broom = new THREE.Group();
    // hand bone +Y runs along the fingers (down when the arm hangs), so the bristles go on +Y
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6), colorMat(0x5a3e2a, { rough: 0.9, key: 'broomstick' }));
    stick.position.y = 0.2;
    const bristle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.05, 0.32, 8), colorMat(0xb8a060, { rough: 1, key: 'straw' }));
    bristle.position.y = 0.95;
    broom.add(stick, bristle);
    broom.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.broom = broom;
    this.broomOn = true;
    const attach = (bone, obj, pos, rot) => {
      if (!bone) return;
      bone.add(obj);
      this.model.updateMatrixWorld(true);
      const ws = new THREE.Vector3(); bone.getWorldScale(ws);
      obj.scale.setScalar(1 / ws.x);
      obj.position.set(pos[0] / ws.x, pos[1] / ws.x, pos[2] / ws.x);
      if (rot) obj.rotation.set(...rot);
    };
    attach(this.head, hat, [0, 0.2, -0.02], [-0.12, 0, 0.1]);
    attach(this.head, specs, [0, 0.085, 0.12], [0, 0, 0]);
    attach(this.hand, broom, [0, 0.08, 0.03], [0, 0, 0.2]);
    this.heldMesh = null;
  }

  reset(pos) {
    this.position.copy(pos);
    this.prevPosition.copy(pos);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.state = 'scripted';
    this.stateT = 0;
    this.path = null;
    this.pathT = 0;
    this.goal = null;
    this.seesCat = false;
    this.lastSeen = null;
    this.lastSeenT = -99;
    this.perceiveT = 0;
    this.throwCd = 6;
    this.swingCd = 0;
    this.catchCd = 0;
    this.tantrumCd = 20;
    this.noiseTarget = null;
    this.stuckT = 0;
    this.lastProgressPos = pos.clone();
    this.walking = false;   // trying to get somewhere this frame (the stuck watchdog's input)
    this.escape = null;     // { pos, until }: a clear spot to step aside to (watchdog step 2)
    this.stuckEp = null;    // { origin, step, last }: the current stuck episode
    this.searchList = [];
    this.attack = null;
    this.speedNow = 0;
    this.grounded = true;
    this.vy = 0;
    this.flags = {};
    this.singeCd = 0;
    this.hotT = 0;
    this.shoveT = 0;
    this.shoveVel = new THREE.Vector3();
    this.body.setTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z });
    this.root.position.copy(pos);
    this.play('Idle', 0);
  }

  teleport(pos, yaw) {
    this.position.copy(pos);
    this.prevPosition.copy(pos);
    if (yaw !== undefined) this.yaw = yaw;
    this.body.setTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z });
    this.root.position.copy(pos);
    this.path = null;
    this.shoveT = 0;
    this.escape = null;
    this.stuckT = 0;
    this.lastProgressPos.copy(pos);
  }

  // ------------------------------------------------------------------ animation
  action(name) {
    if (!this.actions[name]) {
      const c = this.clips[name];
      if (!c) return null;
      this.actions[name] = this.mixer.clipAction(c);
    }
    return this.actions[name];
  }

  play(name, fade = 0.2, { timeScale = 1, once = false, startAt = 0 } = {}) {
    const a = this.action(name);
    if (!a) return;
    if (this.current === a && !once) { a.timeScale = timeScale; return; }
    a.reset();
    a.enabled = true;
    a.timeScale = timeScale;
    a.setEffectiveWeight(1);
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once;
    a.time = startAt;
    a.play();
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    this.current = a;
    this.currentName = name;
  }

  // ------------------------------------------------------------------ perception
  canSeeCat() {
    const cat = this.game.cat;
    if (cat.mode === 'caught') return true;
    const eye = tmp.set(this.position.x, this.position.y + GR.eye, this.position.z);
    const target = cat.position.clone(); target.y += 0.3;
    const to = target.clone().sub(eye);
    const dist = to.length();
    if (dist > GR.sight) return false;
    if (cat.hidden) {
      // only notices a hidden cat when right on top of it while searching that spot
      return dist < 1.2 && this.state === 'search' && this.searchingSpot === cat.hideSpot;
    }
    const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const close = dist < 2.8;
    if (!close && flat.dot(fwd) < GR.fovCos) return false;
    to.normalize();
    if (!this.physics.raycast(eye.x, eye.y, eye.z, to.x, to.y, to.z, dist - 0.2, Q.sight)) return true;
    // second ray to the cat's head/ears (helps seeing a cat on a gallery or behind low furniture)
    const head = cat.position.clone(); head.y += 0.55;
    const th = head.sub(eye); const dh = th.length(); th.normalize();
    return !this.physics.raycast(eye.x, eye.y, eye.z, th.x, th.y, th.z, dh - 0.2, Q.sight);
  }

  onNoise(e) {
    if (!this.active) return;
    const d = e.pos.distanceTo(this.position);
    const sameFloor = Math.abs(e.pos.y - this.position.y) < 1.8;
    const r = e.radius * (sameFloor ? 1 : 0.55);
    if (d > r) return;
    const ownImpact = e.kind === 'impact' && e.source?.startsWith('granny');
    // rage from hearing her house break
    if (e.kind === 'break' && e.rec) {
      const m = e.rec.meta;
      const amt = (m.score ?? 0) >= 500 ? 12 : m.tier === 'fixture' ? 8 : 5;
      const self = e.source?.startsWith('granny');
      this.game.rage.add(self ? amt * 0.6 : amt);
      this.game.events.emit('grannyHeardBreak', { rec: e.rec, source: e.source, self });
    }
    if (ownImpact) return;
    // (playtest 4's "she ignored Komur wrecking things next to her" came from a scripted errand after the intro: she
    // patrols now instead; scripted walks themselves stay uninterrupted)
    if (['patrol', 'idle', 'investigate', 'search'].includes(this.state)) {
      this.noiseTarget = e.pos.clone();
      if (this.state !== 'investigate') this.setState('investigate');
      else this.path = null;
    }
  }

  onTaunt(e) {
    if (!this.active) return;
    const d = e.pos.distanceTo(this.position);
    const sameFloor = Math.abs(e.pos.y - this.position.y) < 1.8;
    if (d > (sameFloor ? 14 : 8)) return;
    this.game.rage.add(6);
    this.game.events.emit('grannyHeardTaunt', { dist: d });
    if (this.seesCat || this.canSeeCat()) {
      this.lastSeen = this.game.cat.position.clone();
      this.lastSeenT = this.game.time;
      // a taunt in plain view baits her next throw
      if (this.game.rage.value >= 25) this.throwCd = Math.min(this.throwCd, 0.25);
      if (!['windup', 'swing', 'catch', 'holding', 'tantrum', 'stunned', 'scripted', 'final', 'react'].includes(this.state)) this.setState('chase');
    } else if (['patrol', 'idle', 'search'].includes(this.state)) {
      this.noiseTarget = e.pos.clone();
      this.setState('investigate');
    }
  }

  get active() { return !['scripted', 'final', 'off'].includes(this.state); }

  // ------------------------------------------------------------------ state machine
  setState(s, data = {}) {
    const prev = this.state;
    // leaving a windup (released or interrupted): the aim arc, ring and weak-point glow must not linger
    if (prev === 'windup' && this.attack) {
      this.game.projectiles?.hideTelegraph();
      this.attack.magnet?.highlight?.(false);
      if (!this.attack.released) this.hideHeld();
    }
    if (prev === 'scripted' && s !== 'scripted') this.scriptAnim = false;
    this.state = s;
    this.stateT = 0;
    this.stateData = data;
    this.path = null;
    if (prev === 'catch' || prev === 'holding' || s === 'catch' || s === 'holding') this._syncBroom();
    this.game.events.emit('grannyState', { state: s, prev });
    const rage = this.game.rage.value;
    switch (s) {
      case 'patrol': this.goal = null; break;
      case 'investigate': break;
      case 'search': {
        // check hiding spots near where the cat was last seen
        const ref = this.lastSeen ?? this.position;
        this.searchList = (this.game.level.hideSpots ?? []).filter((h) => h.pos.distanceTo(ref) < 9 && Math.abs(h.pos.y - ref.y) < 1.5)
          .sort((a, b) => a.pos.distanceTo(ref) - b.pos.distanceTo(ref)).slice(0, 2);
        this.searchPhase = 'goto_last';
        this.searchingSpot = null;
        break;
      }
      case 'spotted': this.play('Angry', 0.15, { once: true, timeScale: 1.6 }); this.game.events.emit('grannySpotted', {}); break;
      case 'windup': this._beginThrow(data); break;
      case 'swing': this.play(Math.random() < 0.5 ? 'Swing' : 'Swing2', 0.1, { once: true, timeScale: 1.35 }); this.swingDone = false; break;
      case 'catch': this.play('PickUp', 0.1, { once: true, timeScale: 1.25 }); this.catchDone = false; this.game.events.emit('grannyLunge', {}); break;
      case 'holding': this.play('Cocky', 0.2, { once: true, timeScale: 1.1 }); break;
      case 'tantrum': this.play(Math.random() < 0.5 ? 'Tantrum' : 'Tantrum2', 0.15, { once: true, timeScale: 1.2 }); this.stompDone = false; this.game.events.emit('grannyTantrum', {}); break;
      case 'react': this.play(data.anim ?? 'HeadShake', 0.15, { once: true, timeScale: data.timeScale ?? 1.4 }); break;
      case 'stunned': this.play('Stunned', 0.1, { once: true, timeScale: 1.0 }); break;
      case 'recover': break;
      case 'chase': if (prev !== 'spotted' && prev !== 'recover' && rage > 10) this.game.events.emit('grannyChase', {}); break;
    }
  }

  _beginThrow(data) {
    const rage = this.game.rage;
    const sp = this.game.setPieces;
    // finale: once the roof brace is exposed, every throw near it is THE enchanted axe
    if (!data.type && sp?.state.finaleUnlocked && !sp.done.SP04 && this.game.cat.position.distanceTo(sp.wp4.pos) < 6.5) {
      data = { ...data, type: 'bigaxe', windup: 1.7, forced: true };
      this.game.events.emit('finalWindup', {});
    }
    this.attack = {
      type: data.type ?? weaponForPhase(rage.phase),
      t: 0, released: false,
      windup: data.windup ?? (rage.phase >= 4 ? 1.25 : rage.phase >= 3 ? 1.15 : 0.95),
      clip: 'Throwing', target: this.game.cat.position.clone(), forced: !!data.forced, scripted: data.scripted,
    };
    const ev = EVENTS.Throwing;
    const rel = ev?.release ?? 1.6;
    const ts = 1.0;
    // start the clip so that its release frame lines up with the end of our telegraph
    const startAt = Math.max(0, rel - this.attack.windup * ts);
    this.attack.timeScale = rel > this.attack.windup ? ts : rel / this.attack.windup;
    this.play('Throwing', 0.12, { once: true, timeScale: this.attack.timeScale, startAt: rel > this.attack.windup ? startAt : 0 });
    // weapon appears in hand
    this.showHeld(this.attack.type);
    this.game.events.emit('grannyWindup', { type: this.attack.type, granny: this });
  }

  showHeld(type) {
    this.hideHeld();
    if (!this.hand || !type) return;
    const m = this.game.projectiles.constructor.makeHeld?.(type);
    const g = new THREE.Group();
    const iron = colorMat(0x3a3a40, { rough: 0.35, metal: 0.9, key: 'projIron' });
    if (type === 'pan') { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.05, 12), iron); g.add(p); }
    else if (type === 'teapot') g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), colorMat(0x3a5ea8, { rough: 0.3, key: 'bluePorc' })));
    else if (type === 'plate') g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.02, 12), colorMat(0xe8e4dc, { rough: 0.25, key: 'porcelain' })));
    else {
      const s = type === 'bigaxe' ? 2.4 : 1;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, (type === 'spear' ? 1.3 : 0.75) * s, 6), colorMat(0x6a4a30, { key: 'handle' }));
      g.add(handle);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.18 * s, 0.03 * s), type === 'bigaxe'
        ? colorMat(0x7dff7a, { rough: 0.2, metal: 0.6, emissive: 0x2aff40, emissiveIntensity: 1.6, key: 'enchantBlade' }) : iron);
      blade.position.set(0.1 * s, (type === 'spear' ? 0.6 : 0.3) * s, 0);
      g.add(blade);
    }
    void m;
    this.hand.add(g);
    const ws = new THREE.Vector3(); this.hand.getWorldScale(ws);
    g.scale.setScalar(1 / ws.x);
    g.position.set(0, 0.08 / ws.x, 0.04 / ws.x);
    this.heldMesh = g;
    this._syncBroom();
  }

  hideHeld() {
    // each windup builds a fresh weapon (shared materials): free its geometry, or every throw left a few on the GPU
    if (this.heldMesh) { this.heldMesh.parent?.remove(this.heldMesh); this.heldMesh.traverse((o) => o.geometry?.dispose()); this.heldMesh = null; }
    this._syncBroom();
  }

  /** The broom rides on the right hand: none while she casts (the intro/menu spell gestures swing it through her
   *  fingers — playtest 3), while that hand holds a weapon, or while it grabs or holds the cat. */
  setBroom(on, summon = false) {
    this.broomOn = on;
    this._syncBroom();
    if (on && summon && this.hand) {
      const p = this.handWorld();
      this.game.fx?.sparks(p, 18, { color: [0.62, 0.32, 1.0], speed: 2.4, life: 0.7 });
      this.game.audio?.play('magic', { pos: p, volume: 0.45 });
    }
  }

  _syncBroom() {
    if (this.broom) this.broom.visible = this.broomOn && !this.heldMesh && this.state !== 'catch' && this.state !== 'holding';
  }

  /** Not drawn while the gameplay camera is right at her: walking past the lens on her way to the cat, her hat and
   *  broom filled the screen and hid Komur (the first time she comes for him, after the vase).  Like furniture at
   *  the lens, a visibility flip compiles nothing; hysteresis keeps her from flickering at the edge.  Cutscenes
   *  frame her on purpose: `active` is false there. */
  lensCheck(cam, active) {
    let hide = false;
    if (active) {
      // distance from the lens to her body: a vertical segment from the knees to the top of the hat
      const p = this.position;
      const y = THREE.MathUtils.clamp(cam.y, p.y + 0.35, p.y + GR.modelHeight + 0.3);
      hide = Math.hypot(cam.x - p.x, cam.y - y, cam.z - p.z) < (this.root.visible ? 0.8 : 1.0);
    }
    if (this.root.visible === hide) this.root.visible = !hide;
  }

  handWorld() {
    const p = new THREE.Vector3();
    if (this.hand) this.hand.getWorldPosition(p);
    else p.set(this.position.x, this.position.y + 1.5, this.position.z);
    return p;
  }

  /** Where her right hand closes on something: inside the bend of the middle finger. */
  gripWorld(out = new THREE.Vector3()) {
    if (!this.gripA || !this.gripB) return out.copy(this.handWorld());
    this.gripA.getWorldPosition(out);
    this.gripB.getWorldPosition(_gripB);
    return out.lerp(_gripB, 0.5);
  }

  /** A caught Komur hangs from her grip by the scruff.  Run once a frame after both skeletons are posed (and after
   *  scripted scenes have placed him): moves him so his scruff is in her fingers.  He used to be put 0.45 m under
   *  her hand bone, whatever either pose was: floating below her fist or sunk into her arm (playtest 4). */
  holdCat(cat, dt = 1 / 60) {
    const grip = this.gripWorld(_grip);
    const scruff = cat.scruffWorld(_scruff);
    cat.root.position.add(grip.sub(scruff));
    cat.root.updateMatrixWorld(true);
    this._clearOfHand(cat, dt);
    cat.position.copy(cat.root.position);
    cat.prevPosition.copy(cat.root.position);
    cat.body?.setNextKinematicTranslation({ x: cat.position.x, y: cat.position.y + cat.centerOffset, z: cat.position.z });
  }

  /** Her fingers rest ON Komur, never in him (playtest 5: "the hands are clipping into the cat", in her grip and in
   *  the cauldron close-up).  Her goblin hand is 34 cm from wrist to fingertip and his neck about 6 cm thick, so with
   *  his scruff in the bend of her middle finger her fingers ran through his neck, head and back.  Both meshes are
   *  sampled: his neck/head/upper-back vertices and her hand's, skinned each frame.  His surface is binned along the axis upper spine -> head (and past the head) and in 45-degree
   *  sectors around it (a cat is not round: chest vs back); he slides away from her wrist by the least distance
   *  that takes every hand vertex out of him, so her fingers just hold the back of his neck. */
  _clearOfHand(cat, dt) {
    const b = cat.bones;
    if (!this.hand || !b.neck || !b.head || !b.spineUp || !b.spineLow) return;
    // one hold = calls without a gap: it keeps its way out and filters the push (playtest 6, below)
    const H = (this._hold ??= { t: -1, dir: -1, len: 0, u: new THREE.Vector3(), from: new THREE.Vector3(), blend: 0 });
    const fresh = this.game.time - H.t > 0.25;
    H.t = this.game.time;
    if (fresh) { H.dir = -1; H.len = 0; H.blend = 0; }
    const C = this._holdClouds(cat);
    this.root.updateMatrixWorld(true); // her fingers as posed this frame (only the grip's chain was current)
    const { slices: NB, sectors: NS, before, past, reach, skin } = HOLD;
    // the skinned vertices themselves (a rigid one-bone placement was off by 4 cm where bones blend: 0.9 ms a frame)
    for (let i = 0; i < C.body.length; i++) { const e = C.body[i]; e.mesh.getVertexPosition(e.i, C.bodyW[i]).applyMatrix4(e.mesh.matrixWorld); }
    for (let i = 0; i < C.hand.length; i++) { const e = C.hand[i]; e.mesh.getVertexPosition(e.i, C.handW[i]).applyMatrix4(e.mesh.matrixWorld); }
    const A = b.spineLow.getWorldPosition(_ca), ax = b.head.getWorldPosition(_ch).sub(A); // his back, neck and head
    const L = ax.length() + past;
    ax.normalize();
    _hp0.set(0, 1, 0).addScaledVector(ax, -ax.y);
    if (_hp0.lengthSq() < 1e-4) _hp0.set(1, 0, 0).addScaledVector(ax, -ax.x);
    _hp0.normalize();
    _hp1.crossVectors(ax, _hp0);
    let dist = 0;
    const bin = (p) => { // slice * sectors + sector of a point (-1 outside the binned stretch); `dist` = from the axis
      const t = _hx.subVectors(p, A).dot(ax);
      if (t <= -before || t >= L) return -1;
      _hx.addScaledVector(ax, -t);
      dist = _hx.length();
      const sec = Math.floor(((Math.atan2(_hx.dot(_hp1), _hx.dot(_hp0)) + Math.PI) / (2 * Math.PI)) * NS) % NS;
      return Math.min(NB - 1, Math.floor(((t + before) / (L + before)) * NB)) * NS + sec;
    };
    // his surface in each bin: the 75th percentile distance of his own points there
    for (const a of C.bins) a.length = 0;
    for (const p of C.bodyW) { const k = bin(p); if (k >= 0 && dist < reach) C.bins[k].push(dist); }
    for (let k = 0; k < C.bins.length; k++) {
      const a = C.bins[k];
      if (a.length < 3) { C.radius[k] = 0; continue; }
      a.sort((x, y) => x - y);
      C.radius[k] = a[Math.floor(a.length * 0.75)];
    }
    const depth = (off) => { // deepest hand point inside him with the cat moved by `off`
      let worst = -1;
      for (const p of C.handW) {
        const k = bin(_hq.subVectors(p, off));
        if (k < 0 || !C.radius[k]) continue;
        worst = Math.max(worst, C.radius[k] - skin - dist);
      }
      return worst;
    };
    // how far he must slide out of her hand this frame (0 when no finger is in him)
    let need = 0;
    if (depth(_hoff.set(0, 0, 0)) > 0) {
      // the ways out: from her wrist toward the middle of his neck (he hangs at her fingertips), straight down and away
      // from her body.  (Away from the fingers in him was a fourth: it turned from frame to frame with whichever
      // fingers were in him and threw him about, playtest 6.)
      const mid = _hq.copy(b.neck.getWorldPosition(_hq)).lerp(b.head.getWorldPosition(_hw), 0.5);
      _hdirs[0].copy(mid).sub(this.hand.getWorldPosition(_hw));
      _hdirs[1].set(0, -1, 0);
      _hdirs[2].set(mid.x - this.position.x, 0, mid.z - this.position.z);
      _hdirs[3].set(0, 0, 0);
      // a scruff hold: he never goes up into her hand (her palm under him read as him sitting in it)
      for (const u of _hdirs) { if (u.y > 0) u.y = 0; if (u.lengthSq() > 1e-8) u.normalize(); }
      // the shortest way wins, but a hold keeps the way it took: another wins only if 15 cm shorter (playtest 6: ways
      // of similar length won by turns, and he was thrown 20-35 cm back and forth between frames).  A new hold prefers
      // her fingertips on the back of his neck (the first way) unless another is 3 cm shorter.
      const cur = fresh ? -1 : H.dir;
      const bias = (d) => (cur >= 0 ? (d === cur ? 0 : 0.15) : (d === 0 ? 0 : 0.03));
      let best = Infinity, bestDir = -1, bestLen = 0;
      for (const d of cur >= 0 ? [cur, 0, 1, 2, 3] : [0, 1, 2, 3]) {
        const u = _hdirs[d];
        if (u.lengthSq() < 1e-8 || (d === cur && bestDir >= 0)) continue;
        const cap = Math.min(0.45, best - bias(d));
        let lo = 0, hi = 0.03;
        while (hi < cap && depth(_hoff.copy(u).multiplyScalar(hi)) > 0) { lo = hi; hi += 0.03; }
        if (hi >= cap) continue; // no better than one already found
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (depth(_hoff.copy(u).multiplyScalar(m)) > 0) lo = m; else hi = m; }
        if (hi + bias(d) < best) { best = hi + bias(d); bestDir = d; bestLen = hi; }
      }
      if (bestDir < 0) need = H.len; // no way out within 45 cm (rare): he keeps the push he has (it used to throw him 45 cm)
      else {
        if (bestDir !== H.dir) { // a change of way (rare): blended over 0.15 s from where he was
          if (H.dir >= 0) { H.from.copy(H.u).multiplyScalar(H.len); H.blend = 0.15; }
          H.dir = bestDir;
          H.len = 0;
        }
        H.u.copy(_hdirs[bestDir]);
        need = bestLen;
      }
    }
    // the push grows at once (her fingers never sink into him) and gives back gently: following the need down and up
    // again every few frames shook him 4-6 cm in the cauldron close-up (playtest 6).  In a catch (fast, her shake)
    // it follows closely, or her fingers came off him by 3-5 cm.
    const step = Math.max(dt, 0), tau = this.state === 'scripted' ? 0.12 : 0.03;
    H.len = Math.max(need, H.len - (H.len - need) * (1 - Math.exp(-step / tau)));
    _htarget.copy(H.u).multiplyScalar(H.len);
    if (H.blend > 0) { H.blend = Math.max(0, H.blend - step); _htarget.lerp(H.from, H.blend / 0.15); }
    cat.root.position.add(_htarget);
    cat.root.updateMatrixWorld(true);
  }

  /** Which of his vertices belong to his back, neck and head, and which of hers to her right hand (by their
   *  main bone; picked once per world, 2.6 ms). */
  _holdClouds(cat) {
    if (this._clouds?.cat === cat) return this._clouds;
    const grab = (root, pick) => {
      const pts = [];
      root.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, bones = o.skeleton.bones;
        for (let i = 0; i < si.count; i++) {
          let best = 0, bw = 0;
          for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
          if (pick(bones[best])) pts.push({ mesh: o, i });
        }
      });
      return pts;
    };
    const cb = cat.bones, upper = new Set([cb.spineLow, cb.spineUp, cb.neck, cb.head]);
    const hand = new Set();
    this.hand.traverse((o) => { if (o.isBone) hand.add(o); });
    const body = grab(cat.root, (x) => upper.has(x)), handPts = grab(this.model, (x) => hand.has(x));
    const n = HOLD.slices * HOLD.sectors;
    this._clouds = { cat, body, hand: handPts, bodyW: body.map(() => new THREE.Vector3()), handW: handPts.map(() => new THREE.Vector3()),
      bins: Array.from({ length: n }, () => []), radius: new Float32Array(n) };
    return this._clouds;
  }

  fixedUpdate(dt) {
    this.prevPosition.copy(this.position);
    this.stateT += dt;
    this.throwCd = Math.max(0, this.throwCd - dt);
    this.swingCd = Math.max(0, this.swingCd - dt);
    this.catchCd = Math.max(0, this.catchCd - dt);
    this.tantrumCd = Math.max(0, this.tantrumCd - dt);
    this.singeCd = Math.max(0, this.singeCd - dt);
    const game = this.game;
    const cat = game.cat;
    const rage = game.rage;
    // last resort: never left standing in the flames (boxed in, mid-throw, a scripted pose...)
    if (this.state !== 'off' && game.fire?.isHot(this.position, GR.firePad)) {
      this.hotT += dt;
      if (this.hotT > 2.5) { this.hotT = 0; this.escapeFire(true); }
    } else this.hotT = 0;

    // perception at ~8Hz
    this.perceiveT -= dt;
    if (this.perceiveT <= 0 && this.active) {
      this.perceiveT = 0.12;
      const saw = this.seesCat;
      this.seesCat = this.canSeeCat();
      if (this.seesCat) { this.lastSeen = cat.position.clone(); this.lastSeenT = game.time; }
      // seeing him in a calm state spots him: on first sight, or when she entered that state already seeing him (it
      // used to take a fresh sighting, so after a toss or an investigation she could patrol right past him)
      if (this.seesCat && (!saw || this.stateT > 0.3) && ['patrol', 'investigate', 'search', 'idle'].includes(this.state)) this.setState('spotted');
    }
    if (this.seesCat && ['chase', 'windup', 'swing'].includes(this.state)) rage.add(0.9 * dt);
    rage.decay(dt, this.state === 'patrol' ? 'idle' : ['chase', 'windup', 'swing', 'catch', 'tantrum'].includes(this.state) ? 'none' : 'search');

    let moveTarget = null, speed = 0, face = null;
    const distCat = this.position.distanceTo(cat.position);
    const chaseSpeed = GR.chaseBase + rage.value * GR.chaseRage;

    switch (this.state) {
      case 'scripted': case 'final': case 'off': break;
      case 'patrol': {
        if (!this.goal || this.position.distanceTo(this.goal) < 0.7) {
          if (!this.goal) {
            const n = this.nav.randomNode(Math.random() < 0.6 ? this.nav.nearest(this.position)?.room : null);
            this.goal = n?.pos.clone();
            this.pauseT = 0;
          } else {
            this.pauseT = (this.pauseT ?? 0) + dt;
            if (this.pauseT === dt) this.play(Math.random() < 0.5 ? 'LookAround' : 'Idle', 0.3, { once: true });
            if (this.pauseT > 2.4) this.goal = null;
            break;
          }
        }
        if (this.goal) { moveTarget = this.goal; speed = GR.walk; }
        if (rage.value >= 50 && this.stateT > 2) this.setState('search');
        break;
      }
      case 'spotted':
        face = cat.position;
        if (this.stateT > 0.55) this.setState('chase');
        break;
      case 'investigate': {
        if (!this.noiseTarget) { this.setState('patrol'); break; }
        const d = this.position.distanceTo(this._offFire(this.noiseTarget)); // a crash in the flames: their edge
        if (d > 1.3 && this.stateT < 12) { moveTarget = this.noiseTarget; speed = GR.investigate + rage.value * 0.006; }
        else {
          if (!this.lookT) { this.lookT = 0.01; this.play('LookAround', 0.3, { once: true, timeScale: 1.3 }); }
          this.lookT += dt;
          if (this.lookT > 1.8) { this.lookT = 0; this.noiseTarget = null; this.setState(rage.value >= 20 ? 'search' : 'patrol'); }
        }
        break;
      }
      case 'chase': {
        const target = this.seesCat ? cat.position : this.lastSeen;
        if (!target || game.time - this.lastSeenT > GR.memory) { this.setState('search'); break; }
        moveTarget = target; speed = chaseSpeed; face = this.seesCat ? cat.position : null;
        // a stunned cat is hers for the taking: she runs in to grab him instead of swinging or throwing
        const stunned = cat.stunT > 0;
        if (this.seesCat && cat.mode !== 'caught') {
          const catHigh = cat.position.y - this.position.y > 0.65;
          if (distCat < GR.catchRange && !catHigh && cat.invuln <= 0 && !cat.hidden && this.catchCd <= 0) { this.setState('catch'); break; }
          if (!stunned && distCat < GR.swingRange && this.swingCd <= 0) { this.setState('swing'); break; }
          if (!stunned && catHigh && distCat < 2.2 && this.swingCd <= 0) { this.setState('swing'); break; }
          if (!stunned && rage.value >= 25 && this.throwCd <= 0 && distCat > GR.throwMin && distCat < GR.throwMax) { this.setState('windup', {}); break; }
          if (!stunned && rage.value >= 90 && this.tantrumCd <= 0 && distCat < 6) { this.setState('tantrum'); break; }
          if (stunned) speed = chaseSpeed * 1.1;
        }
        if (distCat < 0.9) speed = 0.6;
        break;
      }
      case 'search': {
        if (this.searchPhase === 'goto_last') {
          if (this.lastSeen && this.position.distanceTo(this._offFire(this.lastSeen)) > 1.0 && this.stateT < 6) { moveTarget = this.lastSeen; speed = GR.investigate; }
          else { this.searchPhase = 'spots'; this.stateT = 0; }
        } else if (this.searchPhase === 'spots') {
          const spot = this.searchList[0];
          if (!spot) { this.searchPhase = 'done'; this.stateT = 0; this.play('LookAround', 0.3, { once: true }); break; }
          if (this.position.distanceTo(spot.pos) > 1.3 && this.stateT < 7) { moveTarget = spot.pos; speed = GR.investigate; }
          else {
            this.searchingSpot = spot;
            if (!this.crouching) { this.crouching = true; this.play('CrouchIdle', 0.3); this.game.events.emit('grannySearchSpot', { spot }); }
            face = spot.pos;
            // flush a hidden cat out of this spot
            if (cat.hidden && cat.hideSpot === spot && this.stateT > 0.6) {
              this.crouching = false;
              this.game.events.emit('grannyFoundCat', { spot });
              cat.unhide();
              const away = cat.position.clone().sub(this.position).setY(0).normalize();
              cat.stumble(away, 6);
              rage.add(5);
              this.lastSeen = cat.position.clone(); this.lastSeenT = game.time;
              this.setState('chase');
              break;
            }
            if (this.stateT > 2.0) { this.crouching = false; this.searchList.shift(); this.stateT = 0; this.searchingSpot = null; }
          }
        } else {
          if (this.stateT > 2.2) this.setState('patrol');
        }
        break;
      }
      case 'windup': {
        const a = this.attack;
        a.t += dt;
        face = cat.mode === 'caught' ? null : cat.position;
        // track the cat until shortly before release, with a small lead
        if (a.t < a.windup - 0.22 && !a.scripted) {
          const lead = new THREE.Vector3(cat.vel.x, 0, cat.vel.z).multiplyScalar(0.12);
          a.target.copy(cat.position).add(lead);
          a.target.y += 0.25;
        }
        const from = this.handWorld();
        if (!a.released) {
          const prevMagnet = a.magnet;
          a.magnet = a.scripted?.magnet ?? game.projectiles.findMagnet(from, a.target);
          if (prevMagnet && prevMagnet !== a.magnet) prevMagnet.highlight?.(false);
          // a cat posing in front of a weak point gets the throw aimed THROUGH it at the weak point
          const baited = a.magnet && a.target.distanceTo(a.magnet.pos) < (a.magnet.magnetRadius ?? 1.7) + 0.6;
          a.aim = baited ? a.magnet.pos : a.target;
          game.projectiles.showTelegraph(from, a.aim, a.type, baited ? a.magnet : null, game.time);
          if (a.magnet) a.magnet.highlight?.(true);
        }
        if (a.t >= a.windup && !a.released) {
          a.released = true;
          game.projectiles.hideTelegraph();
          if (a.magnet) a.magnet.highlight?.(false);
          this.hideHeld();
          const aimAt = (a.aim ?? a.target).clone();
          game.projectiles.launch({ type: a.type, from, target: aimAt, magnet: a.magnet, source: 'granny_throw', thrower: this });
          this.game.events.emit('grannyRelease', { type: a.type });
          const ph = rage.phase;
          this.throwCd = ph >= 4 ? 3.6 : ph >= 3 ? 4.4 : ph >= 2 ? 5.5 : 7;
        }
        if (a.released && a.t > a.windup + 0.55) this.setState(a.scripted ? 'scripted' : 'recover');
        break;
      }
      case 'recover':
        if (this.stateT > 0.35) this.setState(this.seesCat ? 'chase' : 'search');
        break;
      case 'swing': {
        face = cat.position;
        const rel = (EVENTS.Swing?.release ?? 0.77) / 1.35;
        if (!this.swingDone && this.stateT >= rel) {
          this.swingDone = true;
          this._swingHit();
        }
        if (this.stateT > rel + 0.5) { this.swingCd = 2.2; this.setState('chase'); }
        break;
      }
      case 'catch': {
        face = cat.position;
        const grabAt = 0.42;
        if (this.stateT < grabAt) { moveTarget = cat.position; speed = 2.5; }
        if (!this.catchDone && this.stateT >= grabAt) {
          this.catchDone = true;
          const ok = this.position.distanceTo(cat.position) < 1.35 && Math.abs(cat.position.y - this.position.y) < 0.9 && cat.invuln <= 0 && !cat.hidden && cat.mode !== 'caught';
          if (ok) { this._grabCat(); break; }
          this.game.events.emit('grannyMissedCatch', {});
          rage.add(3);
        }
        if (this.stateT > 1.0) { this.catchCd = 1.5; this.setState('chase'); }
        break;
      }
      case 'holding': {
        // a catch after the tutorial ends the run (the Director's cauldron scene keeps her holding on)
        if (this.stateT > 1.7 && !this.keepHolding) this._releaseCat();
        break;
      }
      case 'tantrum': {
        const rel = (EVENTS.Tantrum?.release ?? 1.23) / 1.2;
        if (!this.stompDone && this.stateT >= rel) {
          this.stompDone = true;
          game.destruction.blast(this.position.clone().setY(this.position.y + 0.3), 4.5, 5, 'granny_charge', { damage: 45, up: 0.8 });
          game.followCam.addShake(0.35, 0.5);
          game.fx.dust(this.position, 30, { size: 0.6, spread: 2.5, life: 1.8 });
          game.events.emit('noise', { pos: this.position.clone(), radius: 14, source: 'granny_charge', kind: 'stomp' });
          if (distCat < 3.2 && cat.grounded) cat.stumble(cat.position.clone().sub(this.position), 6);
        }
        if (this.stateT > 2.2) { this.tantrumCd = 16; this.setState('chase'); }
        break;
      }
      case 'react':
        if (this.stateT > (this.stateData.dur ?? 1.3)) this.setState(this.stateData.next ?? (this.seesCat ? 'chase' : 'search'));
        break;
      case 'stunned':
        if (this.stateT > (this.stateData.dur ?? 2.0)) this.setState('chase');
        break;
      case 'scriptMove':
        if (this.stateData.target) { moveTarget = this.stateData.target; speed = this.stateData.speed ?? GR.walk; }
        if (this.stateData.target && this.position.distanceTo(this.stateData.target) < 0.5) { this.stateData.done = true; this.state = 'scripted'; }
        break;
    }

    // ---- locomotion
    this._move(dt, moveTarget, speed, face);
    this._animLocomotion(dt);
    // a caught cat stays in her hand: Game places him by the scruff once a frame, after the poses (holdCat)
  }

  _move(dt, target, speed, face) {
    let desired = new THREE.Vector3();
    if (target && speed > 0) {
      target = this._offFire(target);
      // stepping aside from what she was stuck on (watchdog step 2): straight to that clear spot, then plan again
      if (this.escape && (this.game.time > this.escape.until || Math.hypot(this.escape.pos.x - this.position.x, this.escape.pos.z - this.position.z) < 0.3)) {
        this.escape = null; this.path = null;
      }
      let wp;
      if (this.escape) wp = this.escape.pos;
      else {
        this.pathT -= dt;
        if (!this.path || this.pathT <= 0 || (this.pathGoal && this.pathGoal.distanceTo(target) > 1.0)) {
          this.path = this.nav.path(this.position, target);
          this.pathGoal = target.clone();
          this.pathT = 0.5;
        }
        while (this.path.length > 1 && this._reached(this.path[0])) this.path.shift();
        wp = this.path[0];
      }
      if (wp) {
        desired.set(wp.x - this.position.x, 0, wp.z - this.position.z);
        const d = desired.length();
        if (d > 0.05) desired.multiplyScalar(Math.min(speed, d * 4) / d);
        else desired.set(0, 0, 0);
        this._steerAroundFire(desired, wp);
      }
    }
    // smooth velocity (a shove — recoiling from the flames — overrides it)
    const k = 1 - Math.exp(-7 * dt);
    if (this.shoveT > 0) {
      this.shoveT -= dt;
      this.vel.x = this.shoveVel.x; this.vel.z = this.shoveVel.z;
      if (this.shoveT <= 0) this.vel.multiplyScalar(0.3);
    } else {
      this.vel.x += (desired.x - this.vel.x) * k;
      this.vel.z += (desired.z - this.vel.z) * k;
    }
    // gravity
    this.vy = this.grounded ? 0 : Math.max(-20, this.vy - 20 * dt);
    // flat move when grounded: pushing down into the floor makes Rapier's KCC drop whole steps (stutter);
    // snap-to-ground (0.35) follows the stairs
    const mv = { x: this.vel.x * dt, y: this.grounded ? 0 : this.vy * dt, z: this.vel.z * dt };
    if (this.grounded && (mv.x || mv.z)) {
      // on the stairs, request a move along the ramp rather than into it (Rapier's KCC stalls otherwise)
      const g = this.physics.raycast(this.position.x, this.position.y + 0.2, this.position.z, 0, -1, 0, 0.5, Q.world, this.collider);
      if (g && g.normal.y > 0.5 && g.normal.y < 0.995) mv.y = -(g.normal.x * mv.x + g.normal.z * mv.z) / g.normal.y + 0.0005;
    }
    this.kcc.computeColliderMovement(this.collider, mv, this.physics.R.QueryFilterFlags.EXCLUDE_SENSORS, this.moveFilter);
    const c = this.kcc.computedMovement();
    this.grounded = this.kcc.computedGrounded();
    this.position.x += c.x; this.position.y += c.y; this.position.z += c.z;
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + this.centerOffset, z: this.position.z });
    this.speedNow = Math.hypot(c.x, c.z) / dt;
    // facing
    let fy = null;
    if (face) fy = Math.atan2(face.x - this.position.x, face.z - this.position.z);
    else if (this.speedNow > 0.25 && this.shoveT <= 0) fy = Math.atan2(this.vel.x, this.vel.z); // recoils backwards
    if (fy !== null) {
      let d = fy - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      this.yaw += d * (1 - Math.exp(-GR.turn * dt));
    }
    // stuck watchdog (playtest 5: "Grandma should never get stuck"): every 0.8 s she spends trying to walk somewhere
    // without getting 0.3 m anywhere is a step of an escalation — 1) plan again without the waypoint she is pressing
    // on, 2) step aside to the clearest spot toward where she is going, 3) give that destination up (each state moves
    // on to its next idea), 4) a witch's exit: a puff of smoke and she steps out of it at the nearest clear waypoint.
    // The old safety net only teleported her while the camera looked away, so on screen she could stand there for good.
    this.walking = !!target && speed > 0.3 && this.shoveT <= 0 && Math.hypot(target.x - this.position.x, target.z - this.position.z) > 0.9;
    if (this.walking) {
      this.stuckT += dt;
      if (this.stuckT > 0.8) {
        if (this.position.distanceTo(this.lastProgressPos) < 0.3) this._stuckStep(target);
        this.stuckT = 0;
        this.lastProgressPos.copy(this.position);
      }
    } else { this.stuckT = 0; this.lastProgressPos.copy(this.position); }
    // fell out of the world / through a hole: recover at nearest node
    if (this.position.y < -3) this._unstick(true);
  }

  /** One more 0.8 s of trying to walk without getting anywhere (see the watchdog in _move). Stuck again where she
   *  was stuck a moment ago (a detour that leads back into the same trap), the escalation carries on from there. */
  _stuckStep(target) {
    const now = this.game.time;
    let ep = this.stuckEp;
    if (!ep || now - ep.last > 6 || ep.origin.distanceTo(this.position) > 1.6) {
      const again = ep && now - ep.last < 20 && ep.origin.distanceTo(this.position) <= 1.6;
      ep = this.stuckEp = { origin: this.position.clone(), step: again ? ep.step : 0, last: now };
    }
    ep.step++;
    ep.last = now;
    const scripted = this.state === 'scriptMove';
    // furniture between her and a spot a couple of metres away (Komur last seen on the sofa's back, a noise under
    // the table): that is as close as she gets, so she has arrived — no pressing into the sofa for 6 s
    if (ep.step === 1 && !scripted && target && Math.hypot(target.x - this.position.x, target.z - this.position.z) < 2.2) {
      this._closeEnough();
      return;
    }
    if (ep.step === 1) {
      if (this.path && this.path.length > 1) this.path.shift(); else this.path = null;
      this.pathT = 0.5;
    } else if (ep.step === 2) {
      const p = this._escapePoint(target);
      if (p) this.escape = { pos: p, until: now + 1.3 };
      this.path = null;
    } else if (ep.step === 3 && !scripted) {
      this._abandonDestination();
    } else {
      this._relocate();
      if (!scripted) this._abandonDestination();
      ep.last = now; // she may walk back into the same trap: the next stall there goes straight to the exit again
    }
  }

  /** The clearest spot 0.7-1.3 m away to step aside to, preferring the way toward where she is going (straight
   *  ahead is usually what blocks her, so sideways steps score well too). */
  _escapePoint(target) {
    const p0 = this.position;
    let gx = 0, gz = 0;
    if (target) { gx = target.x - p0.x; gz = target.z - p0.z; const n = Math.hypot(gx, gz); if (n > 1e-3) { gx /= n; gz /= n; } }
    const fire = this.game.fire;
    for (const r of [1.0, 0.7, 1.3]) {
      let best = null, bestScore = -Infinity;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.2;
        const dx = Math.sin(a), dz = Math.cos(a);
        const p = new THREE.Vector3(p0.x + dx * r, p0.y, p0.z + dz * r);
        if (!this._clearWalk(p0, p) || (fire?.burning && fire.isHot(p, GR.firePad))) continue;
        const along = dx * gx + dz * gz;
        const score = along * 0.6 + (1 - Math.abs(along)) * 0.5 + Math.random() * 0.25;
        if (score > bestScore) { bestScore = score; best = p; }
      }
      if (best) return best;
    }
    return null;
  }

  /** Blocked a short way from where she was going: count it as arrived (each state's own "got there" branch). */
  _closeEnough() {
    switch (this.state) {
      case 'investigate': this.stateT = Math.max(this.stateT, 12); break; // look around here, then move on
      case 'search': this.stateT = Math.max(this.stateT, this.searchPhase === 'goto_last' ? 6 : 7); break;
      case 'patrol': this.goal = this.position.clone(); break; // a pause like at any patrol point
      default: this._abandonDestination(); break;
    }
    this.path = null;
    this.escape = null;
  }

  /** A destination she can't get to (watchdog step 3): each state moves on to its next idea. */
  _abandonDestination() {
    switch (this.state) {
      case 'patrol': this.goal = null; this.pauseT = 0; break;
      case 'investigate': this.noiseTarget = null; break;
      case 'search':
        if (this.searchPhase === 'goto_last') { this.searchPhase = 'spots'; this.stateT = 0; }
        else if (this.searchPhase === 'spots') { this.searchList.shift(); this.stateT = 0; this.crouching = false; this.searchingSpot = null; }
        break;
      case 'chase':
        // Komur where she can't walk to: it only makes her angrier, and something gets thrown at him sooner
        this.game.rage.add(6);
        this.throwCd = Math.min(this.throwCd, 0.4);
        if (!this.seesCat) this.lastSeenT = -99; // lost him: search from here
        break;
    }
    this.path = null;
    this.escape = null;
  }

  /** Watchdog step 4, a witch's exit: a puff of purple smoke and she steps out of it at the nearest clear waypoint on
   *  her floor (any floor when she fell out of the world). */
  _relocate(anyFloor = false) {
    const p0 = this.position.clone();
    const fl = this.nav.floorOf(p0.y);
    const fire = this.game.fire;
    const cands = this.nav.list
      .filter((n) => !this.nav.disabled.has(n.id) && (anyFloor || this.nav.floorOf(n.pos.y) === fl))
      .map((n) => ({ n, d: n.pos.distanceTo(p0) }))
      .filter((c) => anyFloor || c.d > 1.2)
      .sort((a, b) => a.d - b.d);
    let to = null;
    for (const { n } of cands) {
      if (fire?.burning && fire.isHot(n.pos, GR.firePad + GR.fireMargin)) continue;
      if (this._clearSpot(n.pos)) { to = n.pos.clone(); break; }
    }
    if (!to) to = cands[0]?.n.pos.clone();
    if (!to) return false;
    const fx = this.game.fx;
    for (const p of [p0, to]) {
      fx?.smoke(p.clone().setY(p.y + 0.6), 6, { size: 0.75, life: 1.5, color: [0.3, 0.2, 0.4], rise: 0.6 });
      fx?.magic(p.clone().setY(p.y + 0.9), 16, [0.62, 0.32, 1.0]);
    }
    this.game.audio?.play('magic', { pos: to, volume: 0.6 });
    this.teleport(to);
    this.game.events.emit('grannyUnstuck', {});
    return true;
  }

  /** Room for her to stand: floor under the spot and nothing solid within her radius of it. */
  _clearSpot(p) {
    const ph = this.physics;
    if (!ph.raycast(p.x, p.y + 0.5, p.z, 0, -1, 0, 1.0, Q.world)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      for (const h of [0.35, 0.95]) if (ph.raycast(p.x, p.y + h, p.z, dx, 0, dz, GR.radius + 0.08, Q.solid)) return false;
    }
    return true;
  }

  _reached(p) {
    const dy = Math.abs(p.y - this.position.y);
    return Math.hypot(p.x - this.position.x, p.z - this.position.z) < 0.55 && dy < 1.0;
  }

  // ------------------------------------------------------------------ fire avoidance
  get firePad() { return GR.firePad; }

  /** A destination in the flames (the cat by the stove, the noise of the stove she smashed) becomes the edge of
   *  the fire on her side: walking at it she'd stand in the flames. */
  _offFire(target) {
    const fire = this.game.fire;
    if (!fire?.burning) return target;
    let t = target;
    for (const c of fire.clusters) {
      if (c.state !== 'burning' || Math.abs(t.y - c.pos.y) >= 1.2) continue;
      const R = c.size * 0.9 + GR.firePad + GR.fireMargin;
      if (Math.hypot(t.x - c.pos.x, t.z - c.pos.z) >= R) continue;
      let nx = this.position.x - c.pos.x, nz = this.position.z - c.pos.z, n = Math.hypot(nx, nz);
      if (n < 0.05) { nx = t.x - c.pos.x; nz = t.z - c.pos.z; n = Math.hypot(nx, nz); }
      if (n < 0.05) { nx = 1; nz = 0; n = 1; }
      if (t === target) t = target.clone();
      t.x = c.pos.x + (nx / n) * (R + 0.05);
      t.z = c.pos.z + (nz / n) * (R + 0.05);
    }
    return t;
  }

  /** Walk around a fire that lies between her and the next waypoint: drop the part of the move heading into it
   *  (more the closer she gets) and slide along its edge at the same speed. */
  _steerAroundFire(desired, wp) {
    const fire = this.game.fire;
    const sp = Math.hypot(desired.x, desired.z);
    if (!fire?.burning || sp < 1e-4) return;
    let steered = false;
    for (const c of fire.clusters) {
      if (c.state !== 'burning' || Math.abs(this.position.y - c.pos.y) >= 1.2) continue;
      const R = c.size * 0.9 + GR.firePad + GR.fireMargin;
      const ox = this.position.x - c.pos.x, oz = this.position.z - c.pos.z, d = Math.hypot(ox, oz);
      if (d > R + 0.6 || d < 1e-3 || !segmentCrosses(this.position, wp, c, R)) continue;
      const nx = ox / d, nz = oz / d;
      const inward = -(desired.x * nx + desired.z * nz);
      if (inward <= 0) continue;
      const w = Math.min(1, (R + 0.6 - d) / 0.6);
      desired.x += nx * inward * w; desired.z += nz * inward * w;
      let tx = -nz, tz = nx;
      if (desired.x * tx + desired.z * tz < 0) { tx = -tx; tz = -tz; }
      desired.x += tx * inward * w; desired.z += tz * inward * w;
      steered = true;
    }
    const s2 = Math.hypot(desired.x, desired.z);
    if (steered && s2 > 1e-4) desired.multiplyScalar(sp / s2);
  }

  /** Room to walk from a to b: walls, fixtures and furniture (she collides with props too), floor under b. */
  _clearWalk(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    const ux = dx / len, uz = dz / len, px = -uz * 0.26, pz = ux * 0.26;
    const ph = this.physics;
    for (const [ox, oz, h] of [[0, 0, 0.35], [0, 0, 0.95], [px, pz, 0.35], [-px, -pz, 0.35]]) {
      if (ph.raycast(a.x + ox, a.y + h, a.z + oz, ux, 0, uz, len + GR.radius, Q.solid)) return false;
    }
    return !!ph.raycast(b.x, b.y + 0.4, b.z, 0, -1, 0, 0.9, Q.world);
  }

  /** The nearest spot she can step back to that is clear of every fire (with her walking margin). */
  _fireEscapePoint() {
    const fire = this.game.fire, p0 = this.position;
    const pad = GR.firePad + GR.fireMargin;
    let best = null, bestCost = Infinity;
    for (const r of [0.8, 1.3, 1.9, 2.6]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const p = new THREE.Vector3(p0.x + Math.sin(a) * r, p0.y, p0.z + Math.cos(a) * r);
        if (fire.isHot(p, pad) || fire.segmentHot(p0, p, GR.firePad) || !this._clearWalk(p0, p)) continue;
        // prefer the spot farthest from the flames among the closest ones
        let clear = Infinity;
        for (const c of fire.clusters) if (c.state === 'burning') clear = Math.min(clear, Math.hypot(p.x - c.pos.x, p.z - c.pos.z) - c.size * 0.9);
        const cost = r - Math.min(clear, 2) * 0.5;
        if (cost < bestCost) { bestCost = cost; best = p; }
      }
      if (best) return best;
    }
    // boxed in: the nearest navigation node out of the flames
    let node = null, nd = Infinity;
    for (const n of this.nav.list) {
      if (this.nav.disabled.has(n.id) || this.nav.floorOf(n.pos.y) !== this.nav.floorOf(p0.y) || fire.isHot(n.pos, pad)) continue;
      const d = n.pos.distanceToSquared(p0);
      if (d < nd) { nd = d; node = n; }
    }
    return node ? node.pos.clone() : null;
  }

  /** Fell out of the world (through a hole): back at the nearest clear waypoint, on any floor. */
  _unstick(force = false) {
    this._relocate(force);
  }

  _animLocomotion() {
    const lockedStates = ['spotted', 'windup', 'swing', 'catch', 'holding', 'tantrum', 'react', 'stunned', 'recover'];
    if (lockedStates.includes(this.state)) return;
    if (this.state === 'search' && this.crouching) return;
    if (this.state === 'scripted' && this.scriptAnim) return;
    const sp = this.speedNow;
    const busyOnce = this.current && this.current.loop === THREE.LoopOnce && this.current.isRunning() && sp < 0.3;
    if (busyOnce) return;
    // calm chase = an indignant power-walk, angrier = a run (playback matched to ground speed)
    if (sp > 3.9) this.play('Sprint', 0.2, { timeScale: THREE.MathUtils.clamp(sp / 5.0, 0.8, 1.4) });
    else if (sp > 2.35) this.play('Run', 0.2, { timeScale: THREE.MathUtils.clamp(sp / 3.6, 0.66, 1.4) });
    else if (sp > 0.25) this.play('Walk', 0.25, { timeScale: THREE.MathUtils.clamp(sp / 1.45, 0.7, 1.65) });
    else this.play('Idle', 0.35);
  }

  _swingHit() {
    const game = this.game;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const center = this.position.clone().addScaledVector(fwd, 0.9); center.y += 0.6;
    game.destruction.blast(center, 1.4, 4, 'granny_charge', { damage: 30, up: 0.4 });
    game.fx.dust(center, 6, { size: 0.3 });
    game.events.emit('grannySwing', { pos: center.clone() });
    const cat = game.cat;
    const to = cat.position.clone().sub(this.position); to.y = 0;
    if (to.length() < 2.0 && to.normalize().dot(fwd) > 0.3 && Math.abs(cat.position.y - (this.position.y + 0.4)) < 1.3 && !cat.hidden) {
      if (cat.stumble(to, 7)) game.events.emit('grannySwatCat', {});
    }
  }

  _grabCat() {
    const cat = this.game.cat;
    cat.unhide(); cat.stopScratch();
    cat.mode = 'caught';
    cat.modeTime = 0;
    cat.play('Caught', 0.1);
    this.state = 'holding';
    this.stateT = 0;
    this._syncBroom();
    // she hoists him up at arm's length by the scruff (one frame of her throw: the arm straight out at chest
    // height), glaring at him; with the gloat clip her hand stayed at her hip and he hung with his paws on the floor
    const a = this.action('Throwing');
    if (a) {
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.setEffectiveWeight(1); a.play();
      a.time = 2.15; a.paused = true;
      if (this.current && this.current !== a) a.crossFadeFrom(this.current, 0.25, false);
      this.current = a; this.currentName = 'Throwing';
    } else this.play('Cocky', 0.2, { once: true, timeScale: 1.1 });
    const cam = this.game.camera.position;
    cat.yaw = Math.atan2(cam.x - cat.position.x, cam.z - cat.position.z); // dangling, he glares at the lens
    // the Director decides what a catch costs: a toss and a penalty in the tutorial, the cauldron after it
    this.game.events.emit('catCaught', {});
  }

  /** Hold one frame of a clip (cutscene poses). */
  pose(name, t) {
    const a = this.action(name);
    if (!a) return;
    this.mixer.stopAllAction();
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.setEffectiveWeight(1);
    a.play();
    a.time = t;
    a.paused = true;
    this.current = a;
    this.currentName = name;
    this.scriptAnim = true;
  }

  _releaseCat() {
    const game = this.game;
    const cat = game.cat;
    // drop the cat at the safe spot farthest-but-reasonable from Grandma
    const spots = game.level.safeSpots ?? [];
    let best = null, bestScore = -Infinity;
    for (const s of spots) {
      const d = s.distanceTo(this.position);
      const score = d > 4 ? 20 - Math.abs(d - 7) : d - 10;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    cat.mode = 'normal';
    cat.teleport(best ? best.clone() : cat.lastSafe.clone());
    cat.invuln = 2.2;
    cat.vel.set(0, 2, 0);
    game.events.emit('catTossed', {});
    this.catchCd = 4;
    this.setState('react', { anim: 'Dismiss', dur: 1.4, timeScale: 1.4, next: 'search' });
  }

  // ------------------------------------------------------------------ external hooks
  react(kind) {
    const map = { horrified: 'CoverHead', angry: 'Angry', shake: 'HeadShake', flinch: 'Flinch', stunned: 'Stunned' };
    // set-piece cinematics park Grandma in 'scripted': play the reaction anyway (it's the punchline)
    if (this.state === 'scripted' && this.game.state === 'cinematic') {
      this.scriptAnim = true;
      this.play(map[kind] ?? 'HeadShake', 0.15, { once: true, timeScale: kind === 'horrified' ? 1.1 : 1.3 });
      return;
    }
    if (!this.active || ['holding', 'windup', 'catch'].includes(this.state)) return;
    if (kind === 'stunned') this.setState('stunned', { dur: 2.2 });
    else this.setState('react', { anim: map[kind] ?? 'HeadShake', dur: kind === 'horrified' ? 1.3 : 1.0 });
  }

  /** Singed by a fire cluster: flinch and recoil out of the flames.  False while it can't happen (cooldown,
   *  mid-throw or mid-catch): the fire asks again next step. */
  singe() {
    if (this.singeCd > 0 || !this.active || ['holding', 'windup', 'catch'].includes(this.state)) return false;
    this.singeCd = 3;
    this.setState('react', { anim: 'Flinch', dur: 0.9, timeScale: 1.4 });
    this.escapeFire();
    return true;
  }

  /** Recoil to the nearest spot clear of the flames (a quick backwards hop), or — the last resort — vanish in a
   *  puff of smoke and step out of it there. */
  escapeFire(teleport = false) {
    const p = this._fireEscapePoint();
    if (!p) return false;
    if (teleport) {
      this.game.fx?.smoke(this.position.clone().setY(this.position.y + 0.9), 8, { size: 0.8 });
      this.teleport(p);
      this.game.fx?.smoke(p.clone().setY(p.y + 0.9), 5, { size: 0.7 });
      return true;
    }
    const to = p.sub(this.position).setY(0);
    const d = to.length();
    if (d < 0.05) return true;
    this.shoveVel.copy(to).multiplyScalar(3.0 / d);
    this.shoveT = d / 3.0;
    // in a cutscene nothing else animates her: she flinches as she's blown back
    if (this.state === 'scripted') { this.scriptAnim = true; this.play('Flinch', 0.1, { once: true, timeScale: 1.4 }); }
    return true;
  }

  update(dt, alpha = 1) {
    this.mixer.update(dt);
    this.root.position.lerpVectors(this.prevPosition, this.position, alpha);
    this.root.rotation.y = this.yaw;
  }
}
