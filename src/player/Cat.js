import * as THREE from 'three';
import { GROUPS, G, groups } from '../core/Physics.js';
import ANIM from '../data/komurAnims.json';

/*
  Komur — a cat, not a capsule that hops.

  Locomotion: walk -> trot -> gallop with momentum.  At speed the velocity steers through arcs (the body
  banks and the spine bends into the turn); a hard reversal at speed becomes a Tom-and-Jerry drift: claws
  scrabbling, sliding on, whipping round, then launching the new way.  Sprinting from a standstill winds up
  (legs a blur) before it bites.

  Jumping is aimed like a real cat: Space looks for the surface ahead (table, counter, bed, mantel, shelf),
  settles onto the haunches to gauge it, leaps on a ballistic arc and lands forepaws-first with the hinds
  tucked after them.  Ledges too high for a clean landing get a hook-and-scramble climb; walking off an
  edge is a deliberate hop down; free jumps still exist for gaps and bravado.

  On top of the clips, a procedural layer bends the spine into turns, swings the tail as a counterweight,
  turns the head toward Grandma and pitches the body with stairs and jump arcs.
*/
export const CAT = {
  radius: 0.15, halfHeight: 0.09,
  // gaits (m/s).  Playtest 2: the default is an unhurried catwalk (long-stride Walk clip, ~1.9 strides/s)
  // and the sprint a gallop that still outruns Grandma at full rage (3.2 m/s); the trot is only the
  // transition between them.
  sneakSpeed: 0.75, walkSpeed: 1.45, sprintSpeed: 3.9,
  walkToTrot: 2.1, trotToWalk: 1.85, trotToGallop: 3.2, gallopToTrot: 2.9,
  accel: 7.5, sprintAccel: 5.0, burstAccel: 12, decel: 9, brakeDecel: 7.0, airAccel: 6,
  steerTrot: 8.5, steerGallop: 4.2,            // max rate the velocity direction can swing (rad/s)
  driftMinSpeed: 3.0, driftAngle: 1.85, driftDecel: 9.0,
  // jumping
  gravity: 26, fallMult: 1.25, jumpCut: 2.4, hopHeight: 0.95, maxFall: 22,
  coyote: 0.12, buffer: 0.16,
  leapMinRise: 0.25, leapMaxRise: 1.85, leapMaxDist: 2.3, leapGravity: 24, climbAbove: 1.3,
  pounceSpeed: 7.4, pounceUp: 4.3, pounceCooldown: 0.85,
  swipeTime: 0.34, swipeHitAt: 0.1,
  mantleReach: 0.82, climbTime: 0.42,
  tauntCooldown: 2.4,
  modelScale: 0.15, modelYOffset: 0.2631,
};

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _r = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();

// natural ground speed of each gait clip at timeScale 1 (m/s): playback rate = speed / natural (no foot slide)
const GAIT = Object.fromEntries(Object.entries(ANIM.gaits).map(([k, g]) => [k, g.speed_u * CAT.modelScale]));
const CLIP = ANIM.clips;

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function turnToward(a, b, maxStep) {
  const d = angDiff(b, a);
  return a + THREE.MathUtils.clamp(d, -maxStep, maxStep);
}
/** Rotate a bone by a world-space rotation (axis, angle), keeping its parent untouched. */
// bones the procedural layer rotates on top of the clips (see _proceduralLayer)
const PROC_BONES = ['spineUp', 'spineLow', 'tail0', 'tail1', 'neck', 'head'];

function rotateBoneWorld(bone, axis, angle) {
  if (!bone || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_pq);
  _r.setFromAxisAngle(axis, angle);
  _q.copy(_pq).invert().multiply(_r).multiply(_pq);
  bone.quaternion.premultiply(_q);
  bone.updateMatrixWorld(true);
}

export class Cat {
  constructor(game, gltf) {
    this.game = game;
    this.physics = game.physics;
    const R = this.physics.R;

    // ---- visual: root (position) -> pivot (yaw) -> tilt (pitch/roll) -> model
    this.root = new THREE.Group();
    this.root.name = 'Komur';
    this.pivot = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.pivot);
    this.pivot.add(this.tilt);
    this.model = gltf.scene;
    this.model.scale.setScalar(CAT.modelScale);
    this.model.rotation.y = Math.PI;        // model faces -Z; pivot forward is +Z
    this.model.position.y = CAT.modelYOffset;
    this.tilt.add(this.model);
    this.bones = {};
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (o.material && o.material.name === 'KomurFur') this._furify(o.material);
        if (o.material && /Eye/i.test(o.material.name)) { o.material.emissiveIntensity = 1.6; o.castShadow = false; }
        if (o.material && /Whisker/i.test(o.material.name)) o.castShadow = false;
      }
      if (o.isBone) {
        const n = o.name;
        if (/LowerSpine$/.test(n)) this.bones.spineLow = o;
        else if (/UpperSpine$/.test(n)) this.bones.spineUp = o;
        else if (/Neck$/.test(n)) this.bones.neck = o;
        else if (/Head$/.test(n)) this.bones.head = o;
        else if (/TailBase$/.test(n)) this.bones.tail0 = o;
        else if (/TailBaseMiddle$/.test(n)) this.bones.tail1 = o;
        else if (/TailTipMiddle$/.test(n)) this.bones.tail2 = o;
        else if (/EarL$|Ear_L$|Ear\.L$/.test(n)) this.bones.earL = o;
        else if (/EarR$|Ear_R$|Ear\.R$/.test(n)) this.bones.earR = o;
      }
    });
    game.scene.add(this.root);
    // a trimmed Somali tail keeps the follow camera's view clear (the white tip still reads)
    this.model.traverse((o) => { if (o.isBone && /TailBase$/.test(o.name)) o.scale.setScalar(0.78); });
    // rim / fill light so a black cat reads in a dark house.  No distance falloff (decay 0) inside a short
    // 2.4 m reach: with decay 1.6 a white cup or teapot near the lens got ~10x the light his fur gets and bloomed
    // into a white blob in the foreground; flat, it lights him the same and everything near the camera mildly.
    this.fill = new THREE.PointLight(0xffd7a0, 0.75, 2.4, 0);
    game.scene.add(this.fill);
    // where Space would take him: a soft amber ring on the target ledge (what you see is where he leaps)
    this.leapMark = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 28),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.leapMark.rotation.x = -Math.PI / 2;
    this.leapMark.renderOrder = 6;
    this.leapMark.visible = false;
    game.scene.add(this.leapMark);
    this.leapMarkT = 0;
    // seeing stars after a hit (same material setup as the objective marker: that program is already compiled)
    this.stars = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.95, depthTest: false });
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.032, 0), starMat); s.renderOrder = 20; this.stars.add(s); }
    this.stars.visible = false;
    game.scene.add(this.stars);
    this._starPos = new THREE.Vector3();

    // ---- animation
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = {};
    for (const c of gltf.animations) this.clips[c.name] = c;
    this.actions = {};
    this.current = null;
    this.oneShot = null;

    // ---- physics
    const startPos = game.spawn?.cat ?? new THREE.Vector3(-4.5, 0.05, 6.2);
    this.position = startPos.clone();
    this.prevPosition = startPos.clone();
    const bd = R.RigidBodyDesc.kinematicPositionBased().setTranslation(startPos.x, startPos.y + this.centerOffset, startPos.z);
    this.body = this.physics.world.createRigidBody(bd);
    const cd = R.ColliderDesc.capsule(CAT.halfHeight, CAT.radius).setCollisionGroups(GROUPS.cat).setFriction(0.0);
    this.collider = this.physics.world.createCollider(cd, this.body);
    this.physics.setOwner(this.collider, { kind: 'cat', cat: this });
    this.kcc = this.physics.world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(0.16, 0.08, false);
    this.kcc.enableSnapToGround(0.16);
    this.kcc.setMaxSlopeClimbAngle(52 * Math.PI / 180);
    this.kcc.setMinSlopeSlideAngle(40 * Math.PI / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(6);
    this.moveFilter = groups(0xffff, G.STATIC | G.FIXTURE | G.PROP | G.RAIL);
    this.surfaceFilter = groups(0xffff, G.STATIC | G.FIXTURE | G.PROP);   // what a cat can land a leap on
    this.arcFilter = groups(0xffff, G.STATIC | G.FIXTURE | G.RAIL);       // what can block a leap's arc
    // knick-knacks don't stop a cat landing: it lands among them and sends them flying
    this.notFragile = (col) => { const o = this.physics.ownerOf(col); return !(o?.isBreakable && o.meta?.tier === 'fragile'); };
    this.leapMoveFilter = groups(0xffff, G.STATIC | G.FIXTURE | G.RAIL); // mid-leap the cat bowls props over instead of stalling on them

    this.reset(startPos);
  }

  get centerOffset() { return CAT.radius + CAT.halfHeight + 0.02; }

  _furify(mat) {
    // keep the black coat readable: subtle sheen + rim light in the shader
    mat.roughness = 0.82;
    mat.metalness = 0.0;
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rim = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += vec3(0.30, 0.28, 0.42) * pow(rim, 4.0) * 0.35;`);
    };
    mat.needsUpdate = true;
  }

  reset(pos) {
    this.position.copy(pos);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; // face -Z (into the house)
    this.prevYaw = this.yaw;
    this.yawRate = 0;
    this.grounded = false;
    this.coyote = 0;
    this.airTime = 0;
    this.airTop = pos.y;
    this.mode = 'normal';
    this.modeTime = 0;
    this.pounceCd = 0;
    this.swipeT = -1;
    this.swipeDone = false;
    this.swipeLeft = false;
    this.tauntCd = 0;
    this.invuln = 0;
    this.stunT = 0;
    this.hidden = false;
    this.hideSpot = null;
    this.crouching = false;
    this.scratching = null;
    this.scratchT = 0;
    this.lean = 0;
    this.slopePitch = 0;
    this.arcPitch = 0;
    this.bend = 0;
    this.tailSwing = 0;
    this.tailLift = 0;
    this.tailDroop = 0;
    this.look = { yaw: 0, pitch: 0, w: 0 };
    this.idleTime = 0;
    this.idleStage = 0;
    this.stepAcc = 0;
    this.lastSafe = pos.clone();
    this.safeTimer = 0;
    this.pounceHits = new Set();
    this.landLock = 0;
    this.burst = 0;
    this.scrabbleT = 0;
    this.braking = false;
    this.windupCd = 0;
    this.hopping = false;
    this.plan = null;
    this.gait = 'Idle';
    this.chase = null;
    this.nudge = null;
    this.idleNext = undefined;
    this.lastFidget = null;
    this._lowPose = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.body?.setNextKinematicTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z });
    this.body?.setTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z }, true);
    this.root.position.copy(pos);
    this.prevPosition?.copy(pos);
    this.pivot.rotation.set(0, this.yaw, 0);
    this.play('Idle', 0);
  }

  teleport(pos, yaw) {
    this.position.copy(pos);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) { this.yaw = yaw; this.prevYaw = yaw; }
    this.plan = null;
    if (['prep', 'leap', 'climb', 'drift', 'windup'].includes(this.mode)) { this.mode = 'normal'; this.modeTime = 0; }
    this.airTop = pos.y;
    this.body.setTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y + this.centerOffset, z: pos.z });
    this.root.position.copy(pos);
    this.prevPosition.copy(pos);
  }

  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  /** The scruff, where Grandma grabs him: on the back of the neck, a little up from the neck bone toward the head. */
  scruffWorld(out = new THREE.Vector3()) {
    const b = this.bones;
    if (!b.neck || !b.head) return out.copy(this.root.position).add(_v.set(0, 0.35, 0));
    b.neck.getWorldPosition(out);
    b.head.getWorldPosition(_v2);
    out.lerp(_v2, 0.3);
    // the back of the neck: away from the chest (the spine-to-neck line, turned to the cat's back)
    b.spineUp.getWorldPosition(_v3);
    _v4.subVectors(_v2, _v3).normalize();                                      // along the neck
    _v5.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));                      // toward his tail
    _v5.addScaledVector(_v4, -_v5.dot(_v4)).normalize();                       // across the neck, toward the back
    return out.addScaledVector(_v5, 0.035);
  }

  /** Playback rate that makes a gait clip's paws match `speed` m/s on the ground (scripted walks). */
  gaitScale(name, speed) { return speed / (GAIT[name] ?? 1); }
  get forward() { return _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  // ------------------------------------------------------------------ animation helpers
  action(name) {
    if (!this.actions[name]) {
      const clip = this.clips[name];
      if (!clip) return null;
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }

  /**
   * Loop or one-shot.  One-shots hold the pose machine until they end (or are interrupted by
   * `interruptAfter` seconds of movement input).  `dur` stretches/squeezes the clip to a duration.
   */
  play(name, fade = 0.12, { timeScale = 1, once = false, startAt = 0, dur = null, interruptAfter = null, lock = true } = {}) {
    const a = this.action(name);
    if (!a) return;
    if (dur && CLIP[name]) timeScale = Math.max(0.2, (CLIP[name] - startAt) / dur);
    if (once) {
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.time = startAt;
      a.timeScale = timeScale;
      a.enabled = true;
      a.setEffectiveWeight(1);
      if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
      a.play();
      this.current = a;
      this.currentName = name;
      this.oneShot = lock ? { name, action: a, until: (a.getClip().duration - startAt) / timeScale, t: 0, interruptAfter: interruptAfter ?? 0.15 } : null;
      return;
    }
    a.timeScale = timeScale;
    if (this.current === a) return;
    a.reset();
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (this.current) a.crossFadeFrom(this.current, fade, false);
    this.current = a;
    this.currentName = name;
    this.oneShot = null;
  }

  // ------------------------------------------------------------------ simulation
  fixedUpdate(dt, input, camYaw) {
    const g = this.game;
    this.prevPosition.copy(this.position);
    if (this.mode !== 'caught' && this.mode !== 'cinematic') this._paneSafety();
    this.modeTime += dt;
    this.pounceCd = Math.max(0, this.pounceCd - dt);
    this.tauntCd = Math.max(0, this.tauntCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.landLock = Math.max(0, this.landLock - dt);
    this.burst = Math.max(0, this.burst - dt);
    this.scrabbleT = Math.max(0, this.scrabbleT - dt);
    this.windupCd = Math.max(0, this.windupCd - dt);
    const yr = angDiff(this.yaw, this.prevYaw) / dt;
    this.yawRate += (yr - this.yawRate) * (1 - Math.exp(-12 * dt));
    this.prevYaw = this.yaw;

    if (this.mode === 'caught' || this.mode === 'cinematic') {
      this.vel.set(0, 0, 0);
      if (this.chase || this.nudge) this._stopIdle();
      return;
    }
    if (this.mode === 'prep') { this._prepStep(dt); this._animate(dt); return; }
    if (this.mode === 'leap') { this._leapStep(dt); this._animate(dt); return; }
    if (this.mode === 'climb') { this._climbStep(dt); this._animate(dt); return; }

    // stunned (hit by a thrown weapon): no control until the stars clear
    const controls = ['normal', 'pounce', 'drift', 'windup'].includes(this.mode) && this.stunT <= 0;
    const mv = controls && input ? input.moveVector() : { x: 0, y: 0 };
    // camera-relative wish direction
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const wish = _v.set(rx * mv.x + fx * mv.y, 0, rz * mv.x + fz * mv.y);
    let wishLen = Math.min(1, wish.length());
    if (wishLen > 0.001) wish.normalize();
    if (this.landLock > 0) wishLen *= 0.35; // absorbing a landing
    // any intent (move key, button) ends an idle routine at once: no tail-chasing while you steer
    if ((wishLen > 0.1 || (input && input.queue.length)) && (this.chase || this.nudge || this.idleTime > 0)) this._stopIdle();

    // hiding: any movement input leaves the hide spot
    if (this.hidden) {
      if (wishLen > 0.1 || (input && (input.consume('jump') || input.consume('interact')))) this.unhide();
      else { this.vel.set(0, 0, 0); this._animate(dt); return; }
    }

    this.aimDir = wishLen > 0.2 ? wish.clone() : null;
    this.crouching = !!(input && this.mode === 'normal' && input.held('crouch')) && this.grounded;
    const sprint = !!(input && input.held('sprint'));
    const maxSpeed = this.crouching ? CAT.sneakSpeed : (sprint ? CAT.sprintSpeed : CAT.walkSpeed);

    if (this.mode === 'drift') { this._driftStep(dt, wish, wishLen); this._animate(dt); return; }
    if (this.mode === 'windup') { this._windupStep(dt, wish, wishLen, sprint); this._animate(dt); return; }

    // ---- abilities
    if (input && controls && this.mode === 'normal') {
      if (input.consume('pounce', 0.18) && this.pounceCd <= 0) this.startPounce(wishLen > 0.2 ? wish : null);
      if (input.consume('swipe', 0.18) && this.swipeT < 0) {
        this.swipeT = 0; this.swipeDone = false;
        const aim = this._swipeAim();
        if (aim !== null) this.yaw = aim;
        this.swipeLeft = !this.swipeLeft;
        this.play(this.swipeLeft ? 'SwipeL' : 'Swipe', 0.06, { once: true, timeScale: 1.25, interruptAfter: 0.2 });
        g.events.emit('catSwipe', { cat: this });
      }
      if (input.consume('taunt', 0.2) && this.tauntCd <= 0 && this.grounded) this.taunt();
      if (input.consume('interact', 0.2)) g.events.emit('catInteract', { cat: this });
    }
    // scratching (hold E on a scratch target)
    if (this.scratching) {
      if (!input || !input.held('interact') || wishLen > 0.3 || !this.grounded) this.stopScratch();
      else {
        this.scratchT += dt;
        this.vel.x *= 0.5; this.vel.z *= 0.5;
        g.events.emit('catScratching', { cat: this, target: this.scratching, t: this.scratchT, dt });
      }
    }

    // ---- idle routines that move him (tail-chase spin) or touch the world (the nudge)
    if (this.chase || this.nudge) {
      if (this.mode === 'normal' && this.grounded && this.speed < 0.3 && !this.hidden && !this.scratching) this._idleActions(dt);
      else this._stopIdle();
    }

    // ---- sprint wind-up from a standstill (Tom-and-Jerry legs before the zoom)
    if (this.mode === 'normal' && this.grounded && sprint && wishLen > 0.5 && this.speed < 0.6 && !this.crouching && this.windupCd <= 0 && !this.scratching) {
      this.mode = 'windup'; this.modeTime = 0;
      this.play('Scrabble', 0.06, { timeScale: 2.2 });
      g.events.emit('catWindup', { cat: this });
      this._windupStep(dt, wish, wishLen, sprint);
      this._animate(dt);
      return;
    }

    // ---- horizontal velocity
    if (this.mode === 'pounce') {
      const hv = _v2.set(this.vel.x, 0, this.vel.z);
      hv.addScaledVector(wish, CAT.airAccel * 0.35 * dt * wishLen);
      this.vel.x = hv.x; this.vel.z = hv.z;
    } else if (this.mode === 'stumble') {
      this.vel.x *= Math.max(0, 1 - 4 * dt); this.vel.z *= Math.max(0, 1 - 4 * dt);
      if (this.modeTime > 0.55) this.mode = 'normal';
    } else if (this._steer(dt, wish, wishLen, maxSpeed)) {
      this._animate(dt);
      return; // started a drift
    }
    if (this.swipeT >= 0 && this.grounded) { this.vel.x *= 0.94; this.vel.z *= 0.94; }

    // ---- jump: aimed leap onto the surface ahead, else a free hop (buffer + coyote)
    if (this.grounded) this.coyote = CAT.coyote; else this.coyote = Math.max(0, this.coyote - dt);
    if (input && this.mode === 'normal' && this.stunT <= 0 && !this.scratching && input.pressedWithin('jump', CAT.buffer) && (this.grounded || this.coyote > 0)) {
      input.consume('jump', CAT.buffer);
      const dir = wishLen > 0.2 ? wish.clone() : this.forward.clone();
      const plan = this.grounded ? this._planLeap(dir) : null;
      if (plan) { this._startPrep(plan); this._animate(dt); return; }
      this._freeJump();
    }
    // ---- gravity (variable jump height on free hops)
    let grav = CAT.gravity * (this.vel.y < 0 ? CAT.fallMult : 1);
    if (this.vel.y > 0 && this.jumpHeldWindow && !(input && input.held('jump'))) grav *= CAT.jumpCut;
    if (this.vel.y <= 0) this.jumpHeldWindow = false;
    this.vel.y = Math.max(-CAT.maxFall, this.vel.y - grav * dt);

    // ---- airborne into a ledge -> hook and scramble up
    if (!this.grounded && this.mode !== 'stumble' && this.vel.y < 5.5 && wishLen > 0.3 && this.airTime > 0.05) {
      if (this.tryMantle(wish)) { this._animate(dt); return; }
    }

    // ---- swipe timing
    if (this.swipeT >= 0) {
      this.swipeT += dt;
      if (!this.swipeDone && this.swipeT >= CAT.swipeHitAt) { this.swipeDone = true; g.events.emit('catSwipeHit', { cat: this, ...this.frontProbe(0.42, 0.42) }); }
      if (this.swipeT > CAT.swipeTime) this.swipeT = -1;
    }

    // ---- pounce hits
    if (this.mode === 'pounce') {
      const probe = this.frontProbe(0.32, 0.34);
      g.events.emit('catPounceProbe', { cat: this, ...probe });
      if (this.grounded && this.modeTime > 0.12) this.endPounce();
      if (this.modeTime > 1.6) this.endPounce();
    }

    this._move(dt);
    this._postMove(dt);
    this._animate(dt);
  }

  /** Ground steering with momentum.  Returns true if a drift started. */
  _steer(dt, wish, wishLen, maxSpeed) {
    let speed = this.speed;
    if (!this.grounded) {
      // air control: light nudges, no extra speed
      const cap = Math.max(speed, maxSpeed * 0.55);
      this.vel.x += wish.x * CAT.airAccel * dt * wishLen;
      this.vel.z += wish.z * CAT.airAccel * dt * wishLen;
      const s2 = this.speed;
      if (s2 > cap) { this.vel.x *= cap / s2; this.vel.z *= cap / s2; }
      return false;
    }
    if (wishLen > 0.05) {
      this.braking = false;
      let dirA;
      if (speed < 0.4) dirA = Math.atan2(wish.x, wish.z);
      else {
        const cur = Math.atan2(this.vel.x, this.vel.z), want = Math.atan2(wish.x, wish.z);
        const d = angDiff(want, cur);
        if (speed > CAT.driftMinSpeed && Math.abs(d) > CAT.driftAngle && !this.crouching) { this._startDrift(wish); return true; }
        const rate = speed > 3.2 ? CAT.steerGallop : speed > 2.0 ? CAT.steerTrot : 16; // a walking cat turns on a dime
        dirA = cur + THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
        // carving hard at speed costs a little momentum
        speed *= 1 - Math.min(0.5, Math.abs(d) * 0.35) * dt * 2;
      }
      let target = maxSpeed * wishLen;
      if (speed < 1.2) target *= Math.max(0.15, Math.cos(Math.min(Math.PI, Math.abs(angDiff(dirA, this.yaw))))); // square up before setting off
      const acc = this.burst > 0 ? CAT.burstAccel : speed < CAT.walkSpeed ? CAT.accel : CAT.sprintAccel;
      speed = speed < target ? Math.min(target, speed + acc * dt) : Math.max(target, speed - CAT.decel * dt);
      this.vel.x = Math.sin(dirA) * speed;
      this.vel.z = Math.cos(dirA) * speed;
    } else {
      // no input: stop; from a gallop that's a braced skid
      if (speed > 3.3 && !this.braking) { this.braking = true; this.game.events.emit('catSkid', { cat: this, brake: true }); }
      const dec = this.braking ? CAT.brakeDecel : CAT.decel;
      const ns = Math.max(0, speed - dec * dt);
      if (speed > 1e-4) { this.vel.x *= ns / speed; this.vel.z *= ns / speed; }
      if (ns < 0.8) this.braking = false;
    }
    return false;
  }

  _move(dt) {
    // grounded: never drive gravity into the floor.  Rapier's KCC stops at the toi=0 floor contact and
    // intermittently refuses the whole step (measured: ~7 stalled steps per 100 on flat boards), which made
    // running stutter.  A flat move + snap-to-ground keeps us on stairs and slopes instead.
    const glued = this.grounded && this.vel.y <= 0;
    const desired = { x: this.vel.x * dt, y: glued ? 0 : this.vel.y * dt, z: this.vel.z * dt };
    // on a slope (the stairs) move along the surface instead of into it: the same KCC quirk stalls steps
    // whenever the request points into the ground
    const n = this.groundNormal;
    if (glued && n.y > 0.5 && n.y < 0.995) desired.y = -(n.x * desired.x + n.z * desired.z) / n.y + 0.0005;
    this.kcc.computeColliderMovement(this.collider, desired, this.physics.R.QueryFilterFlags.EXCLUDE_SENSORS, this.moveFilter);
    const c = this.kcc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    // jumped or galloped into a window: the pane breaks and he keeps his momentum through the opening next step
    const crashed = this._crashWindow();
    // ceiling bump
    if (desired.y > 0 && c.y < desired.y * 0.5) this.vel.y = Math.min(this.vel.y, 0);
    if (this.grounded && this.vel.y < 0) this.vel.y = 0;
    // walls absorb horizontal velocity (prevents sticky pushing)
    if (dt > 0 && !crashed) {
      const hx = c.x / dt, hz = c.z / dt;
      const want = Math.hypot(this.vel.x, this.vel.z), got = Math.hypot(hx, hz);
      if (want > 0.5 && got < want * 0.6 && this.mode !== 'pounce') { this.vel.x = hx; this.vel.z = hz; }
      if (this.mode === 'pounce' && got < want * 0.3) { this.game.events.emit('catPounceWall', { cat: this }); this.vel.x *= 0.3; this.vel.z *= 0.3; }
    }
    this.position.x += c.x; this.position.y += c.y; this.position.z += c.z;
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + this.centerOffset, z: this.position.z });
    if (!wasGrounded && this.grounded) this._landed();
    if (wasGrounded && !this.grounded && this.vel.y <= 0.05 && this.mode === 'normal') this._walkedOffEdge();
    if (!this.grounded) { this.airTime += dt; this.airTop = Math.max(this.airTop, this.position.y); }
    else { this.airTime = 0; this.airTop = this.position.y; }
  }

  /** Airborne (jump, leap, pounce) or galloping into a window pane: through the glass.  Only a swipe used to break
   *  a window (playtest 3).  Reads the obstacles the last character-controller move ran into. */
  _crashWindow() {
    const sp = this.speed;
    if (this.grounded ? sp < 3.0 : sp < 0.4) return false;
    for (let i = 0, n = this.kcc.numComputedCollisions(); i < n; i++) {
      const hit = this.kcc.computedCollision(i);
      const rec = hit?.collider ? this.physics.ownerOf(hit.collider) : null;
      if (!rec?.isBreakable || rec.broken || rec.meta.family !== 'windows') continue;
      if (-(this.vel.x * hit.normal1.x + this.vel.z * hit.normal1.z) / sp < 0.3) continue; // brushing along it
      this._breakPane(rec, hit.witness1, { x: this.vel.x / sp, y: 0, z: this.vel.z / sp });
      return true;
    }
    return false;
  }

  /** Safety net: if anything ever carries him into a closed pane (a path the crash and climb checks missed: seen
   *  once in a full QA run, conservatory window 14), the glass breaks instead of holding him inside it or behind it.
   *  The sphere sits at his body centre and is smaller than his capsule, so touching the glass from a sill (the
   *  controller keeps the capsule out of it) never triggers it. */
  _paneSafety() {
    const p = this.position;
    for (const c of this.physics.overlapSphere(p.x, p.y + 0.24, p.z, 0.09, groups(0xffff, G.FIXTURE))) {
      const rec = this.physics.ownerOf(c);
      if (!rec?.isBreakable || rec.broken || rec.meta.family !== 'windows') continue;
      const sp = this.speed;
      this._breakPane(rec, { x: p.x, y: p.y + 0.24, z: p.z }, sp > 0.1 ? { x: this.vel.x / sp, y: 0, z: this.vel.z / sp } : this.forward.clone());
      return;
    }
  }

  _breakPane(rec, point, dir) {
    this.game.destruction.damage(rec, 999, 'cat_pounce', point, dir);
    this.game.followCam?.addShake(0.12, 0.2);
    this.game.events.emit('catCrashWindow', { cat: this, rec });
  }

  /** A climb moves him without collisions: a closed window between him and the spot over the lip breaks as he
   *  scrambles through it.  The climb used to carry him straight through the kitchen window's glass when a leap
   *  at its sill turned into a mantle (playtest 4). */
  _clearPaneTo(L) {
    const p = this.position;
    let dx = L.x - p.x, dz = L.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) { dx = Math.sin(this.yaw); dz = Math.cos(this.yaw); } else { dx /= d; dz /= d; }
    const isPane = (col) => { const o = this.physics.ownerOf(col); return !!o?.isBreakable && !o.broken && o.meta?.family === 'windows'; };
    for (const h of [0.12, 0.3]) {
      const hit = this.physics.raycast(p.x, L.y + h, p.z, dx, 0, dz, d + CAT.radius + 0.05, this.moveFilter, this.collider, undefined, isPane);
      if (hit) { this._breakPane(hit.owner, hit.point, { x: dx, y: 0, z: dz }); return true; }
    }
    return false;
  }

  /** Walking off a ledge: a cat doesn't just tip over the edge, it hops down. */
  _walkedOffEdge() {
    const p = this.position;
    const filt = groups(0xffff, G.STATIC | G.FIXTURE | G.PROP);
    // probe under us and a little ahead: the lip we just left can still be under the capsule's centre
    const sp = this.speed;
    const ax = sp > 0.2 ? this.vel.x / sp : Math.sin(this.yaw), az = sp > 0.2 ? this.vel.z / sp : Math.cos(this.yaw);
    let drop = 0;
    for (const ahead of [0, 0.22]) {
      const hit = this.physics.raycast(p.x + ax * ahead, p.y + 0.05, p.z + az * ahead, 0, -1, 0, 8, filt, this.collider);
      drop = Math.max(drop, hit ? p.y - hit.point.y : 8);
    }
    if (drop < 0.42) return;
    this._hopDown(drop);
  }

  /** Aimed hop down off a ledge: a small spring out, forelegs reaching, onto the floor ~0.6m out. */
  _startHopDown(ax, az) {
    const p = this.position;
    const filt = groups(0xffff, G.STATIC | G.FIXTURE | G.PROP);
    for (const out of [0.72, 0.9, 0.55]) {
      const x = p.x + ax * out, z = p.z + az * out;
      const hit = this.physics.raycast(x, p.y + 0.1, z, 0, -1, 0, 8, filt, this.collider);
      if (!hit || hit.normal.y < 0.6 || p.y - hit.point.y < 0.42) continue;
      const L = new THREE.Vector3(x, hit.point.y + 0.01, z);
      const arc = this._arc(p.clone(), L, false);
      if (!this._arcClear(arc, hit.owner)) continue;
      const dir = new THREE.Vector3(ax, 0, az);
      this.plan = { S: p.clone(), L, target: L, climb: false, down: true, dir, arc, yaw: Math.atan2(ax, az), t: 0, edge: { rise: L.y - p.y } };
      this.mode = 'leap';
      this.modeTime = 0;
      this.grounded = false;
      this.airTop = p.y;
      this.play('JumpDown', 0.06, { once: true, dur: arc.T * 1.1 });
      this.game.events.emit('catHopDown', { cat: this, drop: p.y - L.y });
      return true;
    }
    return false;
  }

  _hopDown(drop) {
    if (this.hopping) return;
    const f = this.forward;
    const along = this.vel.x * f.x + this.vel.z * f.z;
    const push = Math.max(along, 1.25);
    this.vel.x = f.x * push; this.vel.z = f.z * push;
    this.vel.y = 1.4;
    this.grounded = false;
    this.airTop = this.position.y;
    this.hopping = true;
    this.play('JumpDown', 0.06, { once: true, timeScale: 1.35, interruptAfter: Infinity });
    this.game.events.emit('catHopDown', { cat: this, drop });
  }

  _landed() {
    const fall = this.airTop - this.position.y;
    const vy = this._lastVy ?? 0;
    this.hopping = false;
    this.game.events.emit('catLand', { cat: this, speed: -vy, height: fall });
    if (this.mode !== 'normal') return;
    if (fall > 1.35 || vy < -7.5) {
      this.play('LandHeavy', 0.05, { once: true, timeScale: 1.25, interruptAfter: 0.22 });
      this.landLock = 0.2;
    } else if (fall > 0.3 || vy < -3.5) {
      this.play('LandSoft', 0.05, { once: true, timeScale: 1.2, interruptAfter: 0.08 });
    }
  }

  _postMove(dt) {
    this._lastVy = this.vel.y;
    // safety: fell out of the world
    if (this.position.y < -4) { this.teleport(this.lastSafe.clone()); this.game.events.emit('catRescued', { cat: this }); }
    if (this.grounded && this.mode === 'normal') {
      this.safeTimer += dt;
      if (this.safeTimer > 0.6) { this.lastSafe.copy(this.position); this.safeTimer = 0; }
    }
    // facing follows the direction of travel (fast at low speed, deliberate at a gallop)
    const sp = this.speed;
    // trotting at the edge of a table/counter/bed: hop down deliberately instead of stepping into the air
    if (this.grounded && this.mode === 'normal' && sp > 0.6 && !this.crouching && this.position.y > 0.3) {
      const p = this.position, ax = this.vel.x / sp, az = this.vel.z / sp;
      const filt = groups(0xffff, G.STATIC | G.FIXTURE);
      const ahead = this.physics.raycast(p.x + ax * 0.26, p.y + 0.1, p.z + az * 0.26, 0, -1, 0, 8, filt, this.collider);
      const dropAhead = ahead ? p.y - ahead.point.y : 8;
      if (dropAhead > 0.42) {
        const near = this.physics.raycast(p.x + ax * 0.06, p.y + 0.1, p.z + az * 0.06, 0, -1, 0, 0.3, filt, this.collider);
        if (near) this._startHopDown(ax, az);
      }
    }
    this.turning = 0;
    if (sp > 0.25 && this.mode !== 'stumble' && !this.braking) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      const rate = sp > 3.2 ? 7 : sp > 2.0 ? 10 : 13;
      this.yaw = turnToward(this.yaw, target, rate * dt);
    } else if (this.aimDir && this.grounded && this.mode === 'normal' && !this.scratching) {
      // a key pressed away from where he faces: turn on the spot toward it, then set off.  _steer holds the
      // speed down until he squares up, and this used to wait for 0.25 m/s first: he never turned and crept
      // backwards (playtest 3: "pressing WASD feels broken")
      const target = Math.atan2(this.aimDir.x, this.aimDir.z);
      const d = angDiff(target, this.yaw);
      this.yaw = turnToward(this.yaw, target, 11 * dt);
      if (Math.abs(d) > 0.35) this.turning = Math.sign(d);
    }
    // bank into turns
    const targetLean = this.grounded ? THREE.MathUtils.clamp(-this.yawRate * sp * 0.016, -0.3, 0.3) : this.lean * 0.98;
    this.lean += (targetLean - this.lean) * (1 - Math.exp(-9 * dt));
    // ground slope (stairs) -> pitch the body with it
    if (this.grounded) {
      const p = this.position;
      const hit = this.physics.raycast(p.x, p.y + 0.12, p.z, 0, -1, 0, 0.4, this.surfaceFilter, this.collider);
      if (hit) this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      else this.groundNormal.set(0, 1, 0);
    } else this.groundNormal.set(0, 1, 0);
    // footsteps, synced to the gait (two pairs of footfalls per stride)
    if (this.grounded && sp > 0.35) {
      const nat = GAIT[this.gait] ?? 0.9;
      this.stepAcc += dt * (sp / nat) * (this.gait === 'Gallop' ? 2 : 4) / (ANIM.gaits[this.gait]?.cycle_s ?? 1);
      if (this.stepAcc > 1) { this.stepAcc = 0; this.game.events.emit('catStep', { cat: this, speed: sp, crouch: this.crouching, gait: this.gait }); }
    }
  }

  // ------------------------------------------------------------------ drift / wind-up
  _startDrift(wish) {
    this.mode = 'drift';
    this.modeTime = 0;
    this.driftDir = wish.clone();
    this.braking = false;
    this.play('Skid', 0.08, { timeScale: 1.8 });
    this.game.events.emit('catSkid', { cat: this, drift: true });
  }

  _driftStep(dt, wish, wishLen) {
    // slide on: the old velocity bleeds away while the body whips round to face the new heading
    const sp = this.speed;
    const ns = Math.max(0, sp - CAT.driftDecel * dt);
    if (sp > 1e-4) { this.vel.x *= ns / sp; this.vel.z *= ns / sp; }
    if (wishLen > 0.2) this.driftDir.copy(wish);
    const want = Math.atan2(this.driftDir.x, this.driftDir.z);
    this.yaw = turnToward(this.yaw, want, 15 * dt);
    this.vel.y = Math.max(-CAT.maxFall, this.vel.y - CAT.gravity * dt);
    this.lean += ((angDiff(want, this.yaw) > 0 ? 0.22 : -0.22) - this.lean) * (1 - Math.exp(-8 * dt));
    this.scratchFx = (this.scratchFx ?? 0) - dt;
    if (this.scratchFx <= 0) { this.scratchFx = 0.07; this.game.events.emit('catScrabble', { cat: this }); }
    this._move(dt);
    this._postMoveLite(dt);
    if (ns < 1.1 || this.modeTime > 0.8 || !this.grounded) {
      // launch the new way: legs a blur for a beat, then gone
      this.mode = 'normal';
      this.modeTime = 0;
      if (wishLen > 0.2) {
        this.vel.x = this.driftDir.x * 1.6; this.vel.z = this.driftDir.z * 1.6;
        this.yaw = want;
        this.scrabbleT = 0.15;
        this.burst = 0.4;
        this.lastWasDrift = true;
        this.game.events.emit('catLaunch', { cat: this });
      }
    }
  }

  _windupStep(dt, wish, wishLen, sprint) {
    if (wishLen > 0.2) {
      const want = Math.atan2(wish.x, wish.z);
      this.yaw = turnToward(this.yaw, want, 18 * dt);
      this.vel.x = wish.x * 0.35; this.vel.z = wish.z * 0.35;
    } else { this.vel.x = 0; this.vel.z = 0; }
    this.vel.y = Math.max(-CAT.maxFall, this.vel.y - CAT.gravity * dt);
    this.scratchFx = (this.scratchFx ?? 0) - dt;
    if (this.scratchFx <= 0) { this.scratchFx = 0.06; this.game.events.emit('catScrabble', { cat: this }); }
    this._move(dt);
    this._postMoveLite(dt);
    if (this.modeTime > 0.2 || wishLen < 0.2 || !sprint) {
      this.mode = 'normal';
      this.modeTime = 0;
      this.windupCd = 1.2;
      if (wishLen > 0.2) {
        const f = this.forward;
        this.vel.x = f.x * 2.4; this.vel.z = f.z * 2.4;
        this.burst = 0.45;
        this.lastWasDrift = false;
        this.game.events.emit('catLaunch', { cat: this });
      }
    }
  }

  _postMoveLite(dt) {
    this._lastVy = this.vel.y;
    if (this.position.y < -4) { this.teleport(this.lastSafe.clone()); this.game.events.emit('catRescued', { cat: this }); }
  }

  // ------------------------------------------------------------------ aimed leaps
  /**
   * Look for a surface to land on in direction `dir`: the lowest ledge ahead that is higher than the
   * floor we stand on, wide enough to stand on and with headroom, reachable along a clear arc.
   */
  _planLeap(dir) {
    const p = this.position, ph = this.physics;
    let edge = null;
    let gapSeen = false;
    for (let d = 0.2; d <= CAT.leapMaxDist; d += 0.07) {
      const x = p.x + dir.x * d, z = p.z + dir.z * d;
      const top = p.y + CAT.leapMaxRise + 0.35;
      const hits = ph.raycastAll(x, top, z, 0, -1, 0, CAT.leapMaxRise + 0.35 + 1.2, this.surfaceFilter, this.collider);
      // standable surfaces under this sample, highest first
      const ys = [];
      for (const h of hits) {
        if (h.toi <= 1e-4 || !h.normal || h.normal.y < 0.7) continue;
        if (h.owner?.isBreakable && h.owner.meta?.tier === 'fragile') continue; // not onto a teacup
        const y = top - h.toi;
        if (y > p.y + CAT.leapMaxRise) continue; // ceilings / out of reach
        ys.push({ y, owner: h.owner });
      }
      const roomy = (y) => !ph.raycast(x, y + 0.03, z, 0, 1, 0, 0.42, this.surfaceFilter, this.collider, undefined, this.notFragile);
      // up: the lowest ledge above us we could land on
      let best = null;
      for (let i = ys.length - 1; i >= 0; i--) {
        const rise = ys[i].y - p.y;
        if (rise < CAT.leapMinRise) continue;
        if (rise > CAT.leapMaxRise) break;
        if (!roomy(ys[i].y)) continue;
        best = { y: ys[i].y, rise, owner: ys[i].owner };
        break;
      }
      // across: something near our own height on the far side of a gap (table to table, bed to dresser)
      if (!best && gapSeen) {
        const near = ys.find((o) => o.y - p.y < 0.25 && o.y - p.y > -0.3);
        if (near && roomy(near.y)) best = { y: near.y, rise: near.y - p.y, owner: near.owner, across: true };
      }
      if (best) {
        const plan = this._planFrom({ d, ...best }, dir);
        if (plan) return plan;
      }
      if (d > 0.25 && (!ys.length || ys[0].y < p.y - 0.4)) gapSeen = true;
      // a wall in the way at body height ends the search
      if (d > 0.3) {
        const wall = ph.raycast(p.x, p.y + 0.3, p.z, dir.x, 0, dir.z, d, this.arcFilter, this.collider);
        if (wall && wall.normal && Math.abs(wall.normal.y) < 0.5 && wall.toi < d - 0.12) break;
      }
    }
    void edge;
    return null;
  }

  /** Landing spot + arc for a candidate ledge, or null. */
  _planFrom(edge, dir) {
    const p = this.position, ph = this.physics;
    // landing spot a little in from the edge, on the same surface
    let land = null;
    for (const inset of [0.2, 0.14, 0.09, 0.3]) {
      const lx = p.x + dir.x * (edge.d + inset), lz = p.z + dir.z * (edge.d + inset);
      const h = ph.raycast(lx, edge.y + 0.5, lz, 0, -1, 0, 0.62, this.surfaceFilter, this.collider, undefined, this.notFragile);
      // same surface, or a soft step up just beyond the lip (mattress above a bed frame, cushion above a seat)
      const dy = h ? h.point.y - edge.y : -1;
      if (h && dy > -0.05 && dy < 0.26 && h.normal.y > 0.7 && h.point.y - p.y <= CAT.leapMaxRise && h.point.y - p.y >= (edge.across ? -0.3 : CAT.leapMinRise - 0.05)) {
        if (ph.raycast(lx, h.point.y + 0.03, lz, 0, 1, 0, 0.4, this.surfaceFilter, this.collider, undefined, this.notFragile)) continue;
        land = new THREE.Vector3(lx, h.point.y + 0.01, lz);
        edge.y = h.point.y; edge.rise = h.point.y - p.y;
        break;
      }
    }
    if (!land) return null;
    const climb = edge.rise > CAT.climbAbove;
    const S = p.clone();
    // climbs aim at a hook point on the face just below the lip
    const target = climb ? new THREE.Vector3(p.x + dir.x * Math.max(0.15, edge.d - 0.22), edge.y - 0.42, p.z + dir.z * Math.max(0.15, edge.d - 0.22)) : land;
    const arc = this._arc(S, target, climb);
    if (!this._arcClear(arc, edge.owner)) return null;
    return { S, L: land, target, edge, climb, arc, dir: dir.clone() };
  }

  _arc(S, L, climb) {
    const g = CAT.leapGravity;
    const dist = Math.hypot(L.x - S.x, L.z - S.z);
    const H = Math.max(S.y, L.y) + (climb ? 0.12 : 0.2 + 0.08 * dist);
    const vy = Math.sqrt(2 * g * (H - S.y));
    const t1 = vy / g;
    const t2 = Math.sqrt(2 * Math.max(0.0001, H - L.y) / g);
    const T = t1 + t2;
    return { S: S.clone(), L: L.clone(), vy, g, T, vx: (L.x - S.x) / T, vz: (L.z - S.z) / T };
  }

  _arcAt(arc, t) {
    return new THREE.Vector3(arc.S.x + arc.vx * t, arc.S.y + arc.vy * t - 0.5 * arc.g * t * t, arc.S.z + arc.vz * t);
  }

  /** Is the flight path clear (body-height rays along the first ~70% of the arc)?  Brushing the very
   *  object we're landing on doesn't count. */
  _arcClear(arc, targetOwner = null) {
    const ph = this.physics;
    let prev = this._arcAt(arc, 0).add(_v2.set(0, 0.2, 0));
    for (let i = 1; i <= 7; i++) {
      const t = arc.T * (0.7 * i / 7);
      const q = this._arcAt(arc, t).add(new THREE.Vector3(0, 0.2, 0));
      const seg = q.clone().sub(prev);
      const len = seg.length();
      if (len > 1e-3) {
        seg.divideScalar(len);
        const hit = ph.raycast(prev.x, prev.y, prev.z, seg.x, seg.y, seg.z, len, this.arcFilter, this.collider);
        if (hit && !(targetOwner && hit.owner === targetOwner)) return false;
      }
      prev = q;
    }
    return true;
  }

  _startPrep(plan) {
    this.plan = plan;
    this.mode = 'prep';
    this.modeTime = 0;
    const running = this.speed > 1.8 && plan.edge.rise < 1.0;
    plan.prep = running ? 0.06 : 0.1 + 0.09 * plan.edge.rise;
    plan.yaw = Math.atan2(plan.dir.x, plan.dir.z);
    if (!running) this.play('JumpPrep', 0.08, { once: true, dur: plan.prep + 0.05 });
    this.game.events.emit('catPrep', { cat: this, plan });
  }

  _prepStep(dt) {
    const plan = this.plan;
    if (!plan) { this.mode = 'normal'; return; }
    // settle: stop, square up to the target
    this.vel.x *= Math.max(0, 1 - 14 * dt); this.vel.z *= Math.max(0, 1 - 14 * dt);
    this.yaw = turnToward(this.yaw, plan.yaw, 14 * dt);
    this.vel.y = 0;
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + this.centerOffset, z: this.position.z });
    if (this.modeTime >= plan.prep) {
      // re-plan from where we actually are (we may have slid a little)
      plan.arc = this._arc(this.position.clone(), plan.target, plan.climb);
      this.mode = 'leap';
      this.modeTime = 0;
      plan.t = 0;
      this.grounded = false;
      this.airTop = this.position.y;
      this.play('JumpUp', 0.05, { once: true, dur: plan.arc.T * (plan.climb ? 1.15 : 1) });
      this.game.events.emit('catJump', { cat: this, leap: true, rise: plan.edge.rise });
      this.game.events.emit('catLeap', { cat: this, plan });
    }
  }

  _leapStep(dt) {
    const plan = this.plan;
    const arc = plan.arc;
    plan.t = Math.min(arc.T, plan.t + dt);
    const want = this._arcAt(arc, plan.t);
    const desired = { x: want.x - this.position.x, y: want.y - this.position.y, z: want.z - this.position.z };
    this.kcc.computeColliderMovement(this.collider, desired, this.physics.R.QueryFilterFlags.EXCLUDE_SENSORS, this.leapMoveFilter);
    const c = this.kcc.computedMovement();
    this.position.x += c.x; this.position.y += c.y; this.position.z += c.z;
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + this.centerOffset, z: this.position.z });
    this.vel.set(arc.vx, arc.vy - arc.g * plan.t, arc.vz);
    this.airTop = Math.max(this.airTop, this.position.y);
    this.yaw = turnToward(this.yaw, plan.yaw, 10 * dt);
    this.arcPitch = THREE.MathUtils.clamp(-Math.atan2(this.vel.y, Math.hypot(arc.vx, arc.vz) + 0.5) * 0.45, -0.4, 0.4);
    const crashed = this._crashWindow(); // a leap through a window pane carries on through the opening
    const hDes = Math.hypot(desired.x, desired.z), hGot = Math.hypot(c.x, c.z);
    const blocked = hDes > 0.004 && hGot < hDes * 0.35 && !crashed;
    plan.blocked = blocked ? (plan.blocked ?? 0) + 1 : 0;
    const descending = plan.t > arc.T * 0.5;
    // only an arrival at the target surface counts (dropping down we may brush the lip we left)
    const touched = descending && this.kcc.computedGrounded() && Math.abs(this.position.y - plan.L.y) < 0.12;
    if (plan.t >= arc.T || touched) {
      if (plan.climb) { this._startClimb(plan.L); return; }
      this.position.y = Math.max(this.position.y, plan.L.y);
      this._finishLeap(plan.down);
      return;
    }
    if (plan.blocked >= 2) {
      // misjudged: something in the way — fall back to physics (and a scramble if there's a ledge)
      this.mode = 'normal';
      this.modeTime = 0;
      this.vel.set(c.x / dt * 0.3, Math.min(this.vel.y, 1), c.z / dt * 0.3);
      this.plan = null;
      if (!this.tryMantle(plan.dir.clone())) this.play('Fall', 0.12);
    }
  }

  _finishLeap(down = false) {
    this.mode = 'normal';
    this.modeTime = 0;
    this.grounded = true;
    const f = this.forward;
    const carry = down ? 1.0 : 0; // dropping down keeps a little forward momentum
    this.vel.set(f.x * carry, 0, f.z * carry);
    this.arcPitch = 0;
    this.plan = null;
    this.landLock = down ? 0.06 : 0.12;
    this.play(down ? 'LandSoft' : 'LandOn', 0.05, { once: true, timeScale: 1.15, interruptAfter: down ? 0.05 : 0.12 });
    this.game.events.emit('catLand', { cat: this, speed: down ? 4 : 3, height: down ? 0.8 : 0, onto: !down });
  }

  _startClimb(L) {
    this._clearPaneTo(L);
    this.mode = 'climb';
    this.modeTime = 0;
    this.climbFrom = this.position.clone();
    this.climbTo = L.clone();
    this.vel.set(0, 0, 0);
    this.plan = null;
    this.arcPitch = 0;
    this.play('Climb', 0.05, { once: true, dur: CAT.climbTime + 0.08 });
    this.game.events.emit('catMantle', { cat: this });
  }

  _climbStep(dt) {
    const t = Math.min(1, this.modeTime / CAT.climbTime);
    const a = this.climbFrom, b = this.climbTo;
    // haul up first (front paws hooked, hinds scrabbling), then over the lip
    const up = THREE.MathUtils.smoothstep(Math.min(1, t * 1.55), 0, 1);
    const fw = THREE.MathUtils.smoothstep(Math.max(0, (t - 0.45) / 0.55), 0, 1);
    this.position.set(a.x + (b.x - a.x) * fw, a.y + (b.y - a.y) * up, a.z + (b.z - a.z) * fw);
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y + this.centerOffset, z: this.position.z });
    if (t >= 1) {
      this.mode = 'normal';
      this.modeTime = 0;
      this.grounded = true;
      this.airTop = this.position.y;
      const f = this.forward;
      this.vel.set(f.x * 0.8, 0, f.z * 0.8);
    }
  }

  _freeJump() {
    this.vel.y = Math.sqrt(2 * CAT.gravity * CAT.hopHeight) * (this.crouching ? 0.85 : 1);
    this.grounded = false;
    this.coyote = 0;
    this.jumpHeldWindow = true;
    this.airTop = this.position.y;
    this.play('JumpTakeoff', 0.05, { once: true, timeScale: 1.7, startAt: 0.06 });
    this.game.events.emit('catJump', { cat: this });
  }

  /** Swipe aim assist: the facing toward the nearest knockable thing within a paw's reach and roughly ahead or to
   *  the side, or null.  Landing on the sideboard he faced the wall with Grandma's vase at his shoulder, and a
   *  swipe straight ahead missed it (playtest 4's tutorial). */
  _swipeAim() {
    const p = this.position;
    const cols = this.physics.overlapSphere(p.x, p.y + 0.3, p.z, 0.75, groups(0xffff, G.PROP));
    let best = null, bestCost = Infinity;
    for (const c of cols) {
      const rec = this.physics.ownerOf(c);
      if (!rec?.isBreakable || rec.broken) continue;
      const t = rec.body ? rec.body.translation() : rec.group.position;
      if (t.y < p.y - 0.25 || t.y > p.y + 0.7) continue;
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) continue;
      const a = Math.atan2(dx, dz), off = Math.abs(angDiff(a, this.yaw));
      if (off > 1.75) continue; // up to about 100 deg: a cat turns to bat at something by its shoulder
      const cost = d * (1 + off) / (1 + (rec.meta.score ?? 0) / 400); // the good china before the candle stub
      if (rec.id === 'tut_vase') { best = a; break; } // the tutorial's target, whenever it's in reach
      if (cost < bestCost) { bestCost = cost; best = a; }
    }
    return best;
  }

  frontProbe(dist, radius) {
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const c = this.position.clone().addScaledVector(fwd, dist);
    c.y += 0.25;
    return { center: c, radius, dir: fwd };
  }

  // ------------------------------------------------------------------ animation state
  _animate(dt) {
    if (this.oneShot) {
      const os = this.oneShot;
      os.until -= dt;
      os.t += dt;
      const moving = this.speed > 0.6 && this.grounded;
      const interrupt = os.interruptAfter != null && os.t > os.interruptAfter && moving;
      if (os.until > 0 && !interrupt && !(os.name === 'JumpTakeoff' && this.grounded && os.until < 0.1)) return;
      this.oneShot = null;
    }
    if (this.hidden) { this.play('CrouchIdle', 0.2); return; }
    switch (this.mode) {
      case 'prep': if (this.currentName !== 'JumpPrep') this.play('Trot', 0.1, { timeScale: 0.5 }); return;
      case 'leap': return;
      case 'climb': return;
      case 'drift': this.play('Skid', 0.08, { timeScale: 1.8 }); return;
      case 'windup': this.play('Scrabble', 0.06, { timeScale: 2.2 }); return;
      case 'pounce': if (this.currentName !== 'Pounce') this.play('Pounce', 0.06, { once: true, startAt: 0.25, timeScale: 1.3 }); return;
      case 'stumble': return;
      default: break;
    }
    if (this.scratching) { this.play('Scratch', 0.12, { timeScale: 1.2 }); return; }
    const sp = this.speed;
    if (!this.grounded && this.airTime > 0.06) {
      if (this.vel.y > 0.5) this.play('JumpAir', 0.15);
      else this.play('Fall', 0.2);
      return;
    }
    if (this.stunT > 0) {
      // dazed on the spot (the procedural layer circles the head and sways the body); no fidgets
      if (this.idleTime || this.idleStage || this.chase) this._stopIdle();
      this.play('Idle', 0.2);
      return;
    }
    if (this.scrabbleT > 0) { this.play('Scrabble', 0.05, { timeScale: 2.2 }); return; }
    if (this.braking && sp > 1.0) { this.play('Skid', 0.1, { timeScale: 1.6 }); return; }
    if (this.crouching) {
      this.idleTime = 0;
      if (sp > 0.15) { this.gait = 'Sneak'; this.play('Sneak', 0.18, { timeScale: THREE.MathUtils.clamp(sp / GAIT.Sneak, 0.4, 2.6) }); }
      else this.play('CrouchIdle', 0.2);
      return;
    }
    // turning on the spot toward the input: step round with the turn clip instead of sliding in the idle pose
    if (this.turning && sp < 0.6) {
      if (this.idleTime || this.idleStage || this.chase) this._stopIdle();
      this.play(this.turning > 0 ? 'TurnL' : 'TurnR', 0.1, { timeScale: 1.5 });
      return;
    }
    if (sp < 0.15) {
      if (!this.chase) this._idle(dt);
      return;
    }
    if (this.idleTime || this.idleStage || this.chase) this._stopIdle();
    // gait selection with hysteresis; playback rate matched to ground speed (no foot sliding)
    let gait = this.gait;
    if (gait === 'Gallop') { if (sp < CAT.gallopToTrot) gait = 'Trot'; }
    else if (gait === 'Trot') { if (sp > CAT.trotToGallop) gait = 'Gallop'; else if (sp < CAT.trotToWalk) gait = 'Walk'; }
    else gait = sp > CAT.trotToGallop ? 'Gallop' : sp > CAT.walkToTrot ? 'Trot' : 'Walk';
    this.gait = gait;
    const ts = THREE.MathUtils.clamp(sp / GAIT[gait], 0.35, 3.8);
    // leaving a lying/sitting pose blends a little slower so he visibly gets up
    const fade = this._lowPose ? 0.32 : gait === 'Gallop' ? 0.16 : 0.2;
    this._lowPose = false;
    this.play(gait, fade, { timeScale: ts });
  }

  /**
   * A cat left alone is never still for long: after a few seconds it licks its paw (or nudges something off the
   * furniture, the classic), soon sits down (playtest 6: "when the cat is not moving for a few seconds let it sit
   * and lick itself"; it used to sit only after 18 s), now and then swishes its tail, and finally lies down in a
   * loaf.  Grandma on the hunt nearby keeps it alert instead.
   */
  _idle(dt) {
    this.gait = 'Idle';
    this.idleTime += dt;
    const gr = this.game.granny;
    const alert = gr?.active && ['chase', 'spotted', 'windup', 'swing', 'catch', 'tantrum'].includes(gr.state) && gr.position.distanceTo(this.position) < 9;
    if (alert || this.game.state !== 'playing') {
      if (alert && this.idleStage > 0) { this.idleStage = 0; this.idleTime = 0; }
      this.idleNext = Math.max(this.idleNext ?? 0, this.idleTime + 2.5);
      this.play('Idle', 0.25);
      return;
    }
    this.idleNext ??= 2.5 + Math.random();
    if (this.idleStage === 3) { this._lowPose = true; this.play('Loaf', 0.4); return; }
    if (this.idleStage === 2) {
      this._lowPose = true;
      if (this.idleTime > 30) {
        this.idleStage = 3;
        this.play('LieDown', 0.35, { once: true, interruptAfter: 0 });
        this.game.events.emit('catIdleAnim', { cat: this, name: 'LieDown' });
        return;
      }
      // sitting: now and then a smug tail swish
      if (this.idleTime > this.idleNext) {
        this.idleNext = this.idleTime + 6 + Math.random() * 4;
        if (Math.random() < 0.5) { this.play('SmugSit', 0.4, { once: true, interruptAfter: 0 }); this.game.events.emit('catIdleAnim', { cat: this, name: 'SmugSit' }); return; }
      }
      this.play('SittingIdle', 0.3);
      return;
    }
    // sits once the first fidget (the paw lick from 2.5-3.5 s; a one-shot holds the idle clock for its 1.7 s) is
    // over: about 6 s after he stopped
    if (this.idleTime > 4.5) {
      this.idleStage = 2;
      this.idleNext = this.idleTime + 4;
      this._lowPose = true;
      this.play('SitDown', 0.4, { once: true, interruptAfter: 0 });
      this.game.events.emit('catIdleAnim', { cat: this, name: 'SitDown' });
      return;
    }
    if (this.idleTime > this.idleNext) {
      const first = this.idleStage === 0;
      this.idleStage = 1;
      // playtest 3: fidgets every 3-5 s read as constant twitching; a calmer 6-10 s
      this.idleNext = this.idleTime + 6 + Math.random() * 4;
      this._fidget(first);
      return;
    }
    this.play('Idle', 0.22);
  }

  _fidget(first = false) {
    // the classic: something knockable right in front of the paws gets a slow, deliberate nudge
    const probe = this.frontProbe(0.3, 0.22);
    const near = this.physics.overlapSphere(probe.center.x, probe.center.y, probe.center.z, probe.radius, groups(0xffff, G.PROP));
    const target = near.map((c) => this.physics.ownerOf(c)).find((o) => o?.isBreakable && !o.broken && o.dynamic && (o.meta?.mass ?? 9) < 4);
    // otherwise the next fidget from a shuffled bag (every one comes up before any repeats)
    if (!this.fidgetBag?.length) {
      // no tail chase here (playtest 3): spinning 2.5 turns on the spot out of nowhere read as a glitch
      this.fidgetBag = ['LookAround', 'Sniff', 'Groom', 'Stretch'].sort(() => Math.random() - 0.5);
      if (this.fidgetBag[0] === this.lastFidget) this.fidgetBag.push(this.fidgetBag.shift());
    }
    // the first one of a still spell is the paw lick
    const pick = target && this.lastFidget !== 'Nudge' && Math.random() < 0.7 ? 'Nudge' : first ? 'Groom' : this.fidgetBag.shift();
    this.lastFidget = pick;
    if (pick === 'ChaseTail') {
      // the clip curls him to his right (head and tail), so he spins clockwise: yaw decreasing
      this.chase = { t: 0, dur: 1.8 + Math.random() * 0.8, dir: -1 };
      this.play('ChaseTail', 0.15, { timeScale: 1.2 });
    } else {
      this.play(pick, 0.3, { once: true, interruptAfter: 0 });
      if (pick === 'Nudge') this.nudge = { t: 0, done: false, target };
    }
    this.game.events.emit('catIdleAnim', { cat: this, name: pick });
  }

  /** Idle actions that act on the world: the tail-chase spin and the nudge that tips things over. */
  _idleActions(dt) {
    if (this.chase) {
      const c = this.chase;
      c.t += dt;
      // spin toward the side the head is turned (the clip bends the body round toward the tail)
      this.yaw += c.dir * 7.5 * dt * Math.min(1, c.t * 4) * Math.min(1, (c.dur - c.t) * 3 + 0.2);
      if (this.currentName !== 'ChaseTail') this.play('ChaseTail', 0.12, { timeScale: 1.2 });
      if (c.t >= c.dur) {
        this.chase = null;
        this.play('ShakeOff', 0.2, { once: true, interruptAfter: 0 });
        this.game.events.emit('catIdleAnim', { cat: this, name: 'ChaseTailEnd' });
      }
    }
    if (this.nudge && this.oneShot?.name === 'Nudge') {
      const n = this.nudge;
      n.t += dt;
      if (!n.done && n.t > 0.74) {
        n.done = true;
        const p = this.frontProbe(0.34, 0.26);
        this.game.events.emit('catSwipeHit', { cat: this, ...p });
      }
    } else this.nudge = null;
  }

  /** Abandon any idle routine (movement, a hit, a cinematic). */
  _stopIdle() {
    this.chase = null;
    this.nudge = null;
    this.idleTime = 0;
    this.idleStage = 0;
    this.idleNext = 2.5 + Math.random();
  }

  /** External reactions (Director): 'startle' | 'hiss' | 'shake'. */
  react(kind) {
    if (this.mode !== 'normal' || !this.grounded || this.hidden || this.scratching || this.swipeT >= 0) return false;
    if (this.oneShot && ['Swipe', 'SwipeL', 'Pounce', 'Meow', 'Hiss', 'LandOn', 'Climb'].includes(this.oneShot.name)) return false;
    const map = { startle: ['Startle', 1.15], hiss: ['Hiss', 1.1], shake: ['ShakeOff', 1.1] };
    const m = map[kind];
    if (!m) return false;
    if (kind !== 'shake' && this.speed > 2.0) return false;
    this._stopIdle();
    this.play(m[0], 0.06, { once: true, timeScale: m[1], interruptAfter: 0.25 });
    return true;
  }

  // ------------------------------------------------------------------ abilities
  startPounce(dir) {
    const d = dir ? dir.clone() : new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    d.y = 0; d.normalize();
    this.yaw = Math.atan2(d.x, d.z);
    const sprintBonus = this.speed > 3.3 ? 1.15 : 1;
    this.vel.x = d.x * CAT.pounceSpeed * sprintBonus;
    this.vel.z = d.z * CAT.pounceSpeed * sprintBonus;
    this.vel.y = Math.max(this.vel.y, CAT.pounceUp);
    this.grounded = false;
    this.mode = 'pounce';
    this.modeTime = 0;
    this.airTop = this.position.y;
    this.pounceCd = CAT.pounceCooldown;
    this.pounceHits.clear();
    this.play('Pounce', 0.05, { once: true, startAt: 0.25, timeScale: 1.3 });
    this.game.events.emit('catPounce', { cat: this });
  }

  endPounce() {
    if (this.mode !== 'pounce') return;
    this.mode = 'normal';
    this.modeTime = 0;
    this.vel.x *= 0.45; this.vel.z *= 0.45;
    this.play('LandSoft', 0.06, { once: true, timeScale: 1.3, interruptAfter: 0.05 });
  }

  taunt() {
    this.tauntCd = CAT.tauntCooldown;
    const gr = this.game.granny;
    const close = gr?.active && gr.position.distanceTo(this.position) < 6.5;
    // a cornered cat hisses; a smug one meows
    this.play(close ? 'Hiss' : 'Meow', 0.1, { once: true, timeScale: close ? 1.25 : 1.25, interruptAfter: 0.3 });
    this.game.events.emit('catTaunt', { cat: this, pos: this.position.clone(), hiss: close });
  }

  startScratch(target) {
    this.scratching = target;
    this.scratchT = 0;
    if (target?.pos) {
      const dx = target.pos.x - this.position.x, dz = target.pos.z - this.position.z;
      if (Math.hypot(dx, dz) > 0.01) this.yaw = Math.atan2(dx, dz);
    }
  }

  stopScratch() {
    if (this.scratching) this.game.events.emit('catScratchEnd', { cat: this, target: this.scratching, t: this.scratchT });
    this.scratching = null;
    this.scratchT = 0;
  }

  hide(spot) {
    this.hidden = true;
    this.hideSpot = spot;
    this.vel.set(0, 0, 0);
    if (spot.pos) this.teleport(new THREE.Vector3(spot.pos.x, this.position.y, spot.pos.z), spot.yaw ?? this.yaw);
    this.game.events.emit('catHide', { cat: this, spot });
  }

  unhide() {
    if (!this.hidden) return;
    this.hidden = false;
    const spot = this.hideSpot;
    this.hideSpot = null;
    this.game.events.emit('catUnhide', { cat: this, spot });
  }

  /** Hit by a thrown weapon: knocked back, then seeing stars for `dur` s with no control — Grandma's chance to
   *  grab him (playtest 3).  Only a moment of invulnerability, so the same throw can't hit twice. */
  stun(fromDir, dur = 2.0) {
    if (this.mode === 'caught') return false;
    this.invuln = 0;
    if (!this.stumble(fromDir, 5.5)) return false;
    this.invuln = 0.35;
    this.stunT = dur;
    this.game.events.emit('catStunned', { cat: this, dur });
    return true;
  }

  stumble(fromDir, strength = 5) {
    if (this.invuln > 0 || this.mode === 'caught') return false;
    this.unhide();
    this.stopScratch();
    this.plan = null;
    this.mode = 'stumble';
    this.modeTime = 0;
    const d = fromDir.clone(); d.y = 0; if (d.lengthSq() < 1e-4) d.set(0, 0, 1); d.normalize();
    this.vel.set(d.x * strength, 4.2, d.z * strength);
    this.grounded = false;
    this.airTop = this.position.y;
    this.invuln = 1.2;
    this.play('Stumble', 0.05, { once: true, timeScale: 1.2 });
    this.game.events.emit('catStumble', { cat: this });
    return true;
  }

  // ------------------------------------------------------------------ mantle (free jump into a ledge)
  tryMantle(wish) {
    const p = this.physics;
    const fwd = wish.clone().setY(0).normalize();
    const feetY = this.position.y;
    // chest-height ray must hit a wall/edge close in front
    const chest = feetY + 0.22;
    const hit = p.raycast(this.position.x, chest, this.position.z, fwd.x, 0, fwd.z, CAT.radius + 0.32, this.moveFilter, this.collider, undefined, this.notFragile);
    if (!hit || hit.normal.y > 0.5) return false;
    // find top surface: cast down from above the ledge
    const topProbeY = feetY + CAT.mantleReach + 0.5;
    const px = hit.point.x + fwd.x * 0.22, pz = hit.point.z + fwd.z * 0.22;
    const down = p.raycast(px, topProbeY, pz, 0, -1, 0, CAT.mantleReach + 0.5, this.moveFilter, this.collider, undefined, this.notFragile);
    if (!down || down.normal.y < 0.7) return false;
    const topY = down.point.y;
    if (topY < feetY + 0.12 || topY > feetY + CAT.mantleReach) return false;
    // headroom on top
    const head = p.raycast(px, topY + 0.05, pz, 0, 1, 0, 0.45, this.moveFilter, this.collider, undefined, this.notFragile);
    if (head) return false;
    this.yaw = Math.atan2(fwd.x, fwd.z);
    this._startClimb(new THREE.Vector3(px + fwd.x * 0.08, topY + 0.01, pz + fwd.z * 0.08));
    return true;
  }

  // ------------------------------------------------------------------ render update
  update(dt, alpha = 1) {
    this.mixer.update(dt);
    // interpolate visual root between the last two fixed steps
    this.root.position.lerpVectors(this.prevPosition, this.position, alpha);
    this.pivot.rotation.set(0, this.yaw, 0);
    // body pitch: stairs/slopes when grounded, the arc of a leap in the air
    const f = this.forward;
    const n = this.groundNormal;
    const slope = this.grounded ? Math.atan2(n.x * f.x + n.z * f.z, n.y) : 0;
    const wantPitch = THREE.MathUtils.clamp(slope, -0.45, 0.45) + (this.mode === 'leap' ? this.arcPitch : 0);
    this.slopePitch += (wantPitch - this.slopePitch) * (1 - Math.exp(-10 * dt));
    this.tilt.rotation.set(this.slopePitch, 0, this.lean);
    if (dt > 0) this._proceduralLayer(dt);
    this._updateLeapMark(dt);
    // stars circling over his head while stunned
    const starsOn = this.stunT > 0 && this.mode !== 'caught' && this.mode !== 'cinematic' && !this.hidden && !!this.bones.head;
    this.stars.visible = starsOn;
    if (starsOn) {
      const hp = this.bones.head.getWorldPosition(this._starPos), t = performance.now() / 1000;
      this.stars.children.forEach((s, i) => {
        const a = t * 4.2 + i * 2.094;
        s.position.set(hp.x + Math.cos(a) * 0.15, hp.y + 0.15 + Math.sin(t * 6 + i * 2) * 0.025, hp.z + Math.sin(a) * 0.15);
        s.rotation.set(0.6, t * 5 + i, 0);
      });
    }
    this.fill.intensity = this.hidden ? 0.24 : 0.75;
    // fill light between camera and cat so the black coat always reads.  It sits well back toward the lens
    // and not much higher than the raised tail: close to the cat it lit the white tail tip ~2x brighter
    // than the body and the tip glowed like a lamp.
    // A fixed 1.3 m out toward the lens: with the camera pressed close (walls, cutscenes) a fraction of the way
    // would sit right on his fur and blow it out white.
    const cam = this.game.camera.position, rp = this.root.position;
    let fx = cam.x - rp.x, fz = cam.z - rp.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    this.fill.position.set(rp.x + fx * 1.3, rp.y + 0.72, rp.z + fz * 1.3);
  }

  _updateLeapMark(dt) {
    const m = this.leapMark;
    const g = this.game;
    const eligible = g.state === 'playing' && this.mode === 'normal' && this.grounded && !this.hidden && this.speed < 3.4 && !this.scratching;
    this.leapMarkT -= dt;
    if (eligible && this.leapMarkT <= 0) {
      this.leapMarkT = 0.15;
      const dir = this.aimDir ?? this.forward.clone();
      const plan = this._planLeap(dir);
      this.markPlan = plan;
    } else if (!eligible) this.markPlan = null;
    const plan = this.markPlan;
    const target = plan ? 0.9 : 0;
    m.material.opacity += (target - m.material.opacity) * (1 - Math.exp(-10 * dt));
    if (plan) {
      m.position.set(plan.L.x, plan.L.y + 0.012, plan.L.z);
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.12;
      m.scale.setScalar(pulse * (plan.climb ? 1.25 : 1));
      m.material.color.setHex(plan.climb ? 0xff8a20 : 0xffb020);
    }
    m.visible = m.material.opacity > 0.02;
  }

  /** Secondary motion on top of the clips: spine into turns, tail counterweight, head tracking Grandma. */
  _proceduralLayer(dt) {
    const b = this.bones;
    if (!b.spineUp || !b.spineLow) return;
    // three.js's mixer only writes a bone whose sampled value changed since the last frame: on a held pose (a still
    // loop such as Loaf or SittingIdle, a clamped one-shot) last frame's layer stayed on the bone and this frame's
    // piled on top, so his head spun round while he loafed with Grandma patrolling nearby (playtest 4: "the neck
    // still does a 360").  A bone the mixer left alone goes back to its pose from before last frame's layer.
    const base = (this._procBase ??= new Map()), after = (this._procAfter ??= new Map());
    for (const k of PROC_BONES) {
      const bone = b[k];
      if (!bone) continue;
      if (!base.has(bone)) { base.set(bone, new THREE.Quaternion()); after.set(bone, new THREE.Quaternion(NaN, NaN, NaN, NaN)); }
      if (bone.quaternion.equals(after.get(bone))) bone.quaternion.copy(base.get(bone));
      base.get(bone).copy(bone.quaternion);
    }
    this.model.updateMatrixWorld(true);
    const sp = this.speed;
    const k = (r) => 1 - Math.exp(-r * dt);
    const busy = ['prep', 'leap', 'climb', 'caught', 'cinematic'].includes(this.mode) || !!this.oneShot;
    // 1) spine bends into the turn (C-curve: head and tail both toward the inside)
    const bendT = busy ? 0 : THREE.MathUtils.clamp(this.yawRate * 0.085 * Math.min(1, sp / 2.2), -0.34, 0.34) * (this.grounded ? 1 : 0.4);
    this.bend += (bendT - this.bend) * k(9);
    rotateBoneWorld(b.spineUp, UP, this.bend * 0.55);
    rotateBoneWorld(b.spineLow, UP, -this.bend * 0.45);
    // 2) tail: lags the body's turning and lifts when dropping (balance)
    const swingT = THREE.MathUtils.clamp(-this.yawRate * 0.07, -0.55, 0.55) + (this.mode === 'drift' ? Math.sin(performance.now() * 0.02) * 0.25 : 0);
    this.tailSwing += (swingT - this.tailSwing) * k(5);
    const right = _v.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const liftT = !this.grounded && this.vel.y < -1.5 ? -0.35 : 0;
    this.tailLift += (liftT - this.tailLift) * k(6);
    // the follow camera pressed close behind him (walls, corners): the raised tail would fill the lens, so it
    // droops back out of the view and rises again as the camera backs off
    let droopT = 0;
    const fc = this.game.followCam;
    if (fc && !fc.cinematic && this.game.state === 'playing') {
      const cam = this.game.camera.position;
      const cx = cam.x - this.position.x, cz = cam.z - this.position.z;
      const cl = Math.hypot(cx, cz) || 1;
      const behind = THREE.MathUtils.clamp(-(cx * Math.sin(this.yaw) + cz * Math.cos(this.yaw)) / cl, 0, 1);
      droopT = THREE.MathUtils.clamp((1.6 - cl) / 0.9, 0, 1) * behind * 0.9;
    }
    this.tailDroop += (droopT - this.tailDroop) * k(5);
    rotateBoneWorld(b.tail0, UP, this.tailSwing * 0.55);
    rotateBoneWorld(b.tail1, UP, this.tailSwing * 0.45);
    rotateBoneWorld(b.tail0, right, this.tailLift + this.tailDroop);
    // 3) head tracks Grandma when she's close and on the hunt (cats watch threats)
    let wantW = 0, wantYaw = 0, wantPitch = 0;
    const gr = this.game.granny;
    if (gr && !busy && this.mode === 'normal' && ['chase', 'spotted', 'windup', 'swing', 'search', 'investigate', 'catch', 'tantrum', 'patrol'].includes(gr.state)) {
      const dx = gr.position.x - this.position.x, dz = gr.position.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      const range = gr.state === 'patrol' ? 4 : 9;
      if (dist < range && dist > 0.3) {
        const rel = angDiff(Math.atan2(dx, dz), this.yaw);
        if (Math.abs(rel) < 2.0) {
          wantYaw = THREE.MathUtils.clamp(rel, -1.0, 1.0);
          wantPitch = THREE.MathUtils.clamp(Math.atan2(gr.position.y + 1.4 - (this.position.y + 0.35), dist), -0.35, 0.5);
          wantW = sp > 3.2 ? 0.35 : 1;
        }
      }
    }
    // turning toward the player's input: the head leads the body round
    if (wantW === 0 && this.aimDir && this.mode === 'normal' && this.grounded) {
      const rel = angDiff(Math.atan2(this.aimDir.x, this.aimDir.z), this.yaw);
      if (Math.abs(rel) > 0.2) { wantYaw = THREE.MathUtils.clamp(rel, -1.0, 1.0); wantW = 1; }
    }
    const L = this.look;
    L.w += (wantW - L.w) * k(5);
    L.yaw += (wantYaw - L.yaw) * k(7);
    L.pitch += (wantPitch - L.pitch) * k(7);
    if (L.w > 0.01) {
      rotateBoneWorld(b.neck, UP, L.yaw * 0.4 * L.w);
      rotateBoneWorld(b.head, UP, L.yaw * 0.6 * L.w);
      rotateBoneWorld(b.head, right, L.pitch * 0.7 * L.w);
    }
    // 4) seeing stars after a hit: the head circles, the shoulders sway (eases out over the last 0.4 s)
    if (this.stunT > 0 && this.mode !== 'caught' && this.mode !== 'cinematic') {
      const t = performance.now() / 1000, w = Math.min(1, this.stunT / 0.4);
      rotateBoneWorld(b.head, UP, Math.sin(t * 5.5) * 0.38 * w);
      rotateBoneWorld(b.head, right, Math.cos(t * 5.5) * 0.2 * w);
      rotateBoneWorld(b.spineUp, UP, Math.sin(t * 2.8) * 0.12 * w);
    }
    for (const k of PROC_BONES) if (b[k]) after.get(b[k]).copy(b[k].quaternion);
  }
}
