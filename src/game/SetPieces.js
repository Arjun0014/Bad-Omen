import * as THREE from 'three';
import { colorMat, woodMat, Mats, boxGeo } from '../world/Materials.js';
import { FLOOR2 } from '../world/House.js';

const F2 = FLOOR2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function rope(a, b, r = 0.014, mat) {
  const d = b.clone().sub(a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/*
  SP01 THE LAST SUPPER  — chandelier rope tied to a cleat on the gallery rail.  Scratch to fray, bait a throw.
  SP02 THE KITCHEN CURSE — oil lamp spill (cat) + Grandma bashing the stove (two keys, any order).
  SP03 THE BEDROOM BELOW — wardrobe on a cracked floor; scratch its wobbly leg, bait a heavy throw.
  SP04 THE FINAL STRAW  — the roof brace: unlocked by doom+rage+disasters; Grandma's enchanted axe does the rest.
  SP10 THE GLASS HOUSE  — conservatory: an iron plant chandelier hangs from the glass roof over the tea table,
                          its rope tied off by the door.  Claw the rope, bait a throw at it: the chandelier
                          smashes the tea party, rips the rafter, and the whole glass roof comes down in the rain.
*/
export class SetPieces {
  constructor(game) {
    this.game = game;
    this.done = {};
    this.state = { sp01Primed: false, sp02Ember: false, sp02Stove: false, sp03Primed: false, sp10Primed: false, finaleUnlocked: false };
    this.anims = [];
    this.fireSource = 'fire';
  }

  static MAJOR = ['SP01', 'SP02', 'SP03', 'SP10'];
  get count() { return SetPieces.MAJOR.filter((k) => this.done[k]).length; }

  build() {
    const g = this.game;
    this.root = new THREE.Group();
    this.root.name = 'SetPieces';
    g.scene.add(this.root);
    this._buildChandelier();
    this._buildPotRack();
    this._buildBrace();
    this._buildGlassHouse();
    this._registerWeakPoints();
    this._registerScratchTargets();
    // listen for the kitchen keys
    g.events.on('propBroken', ({ rec, source }) => {
      if (rec.id === 'kitchen_oillamp' && !this.done.SP02) this._kitchenEmber(rec);
      if (rec.id === 'kitchen_stove') this._kitchenStoveHit(source);
    });
    g.events.on('projectileHitProp', ({ rec }) => { if (rec.id === 'kitchen_stove' || rec.id === 'kitchen_cauldron') this._kitchenStoveHit('granny_throw'); });
    g.events.on('noise', (e) => {
      if (e.kind === 'stomp' && e.pos.distanceTo(V(-6.45, 0, -2.6)) < 3.2) this._kitchenStoveHit('granny_charge');
    });
    g.events.on('grannySwing', ({ pos }) => { if (pos && pos.distanceTo(V(-6.3, 0.9, -2.6)) < 1.9) this._kitchenStoveHit('granny_charge'); });
    // bonus disasters: Grandma wrecking her prized heirlooms
    g.events.on('propBroken', ({ rec, source }) => {
      if (!source?.startsWith('granny')) return;
      const bonus = { hall_clock: ['SP05', 'CLOCKWORK TANTRUM', 1200], living_bookcase: ['SP06', 'BOOKCASE AVALANCHE', 1000], living_piano: ['SP09', 'THE PIANO OF DOOM', 1000], glass_cabinet: ['SP07', "MOTHER'S CABINET", 900] }[rec.id];
      if (!bonus || this.done[bonus[0]]) return;
      this.done[bonus[0]] = true;
      const p = rec.group.position.clone();
      if (bonus[0] === 'SP05') { g.fx.sparks(p.clone().setY(1.6), 40, { color: [1, 0.85, 0.4] }); g.audio?.play('bell', { pos: p, volume: 1, rate: 0.5 }); g.audio?.play('metal', { pos: p, volume: 1.2 }); }
      if (bonus[0] === 'SP09') { g.audio?.play('sting', { pos: p, volume: 0.9, rate: 1.5 }); }
      if (bonus[0] === 'SP06') { g.destruction.blast(p.clone().setY(1.0), 2.5, 3.5, source, { damage: 30, up: 0.4 }); }
      g.followCam.addShake(0.25, 0.4);
      const r = g.score.award({ id: bonus[0], base: bonus[2], source, ruin: 4, label: bonus[1], setpiece: bonus[0] });
      if (r) g.ui.banner(bonus[1], `Bonus disaster +${r.points.toLocaleString('en-US')}`, { granny: true, dur: 2.2, priority: 2 });
      g.events.emit('bonusDisaster', { id: bonus[0] });
    });
  }

  // ------------------------------------------------------------------ SP01 chandelier
  _buildChandelier() {
    const iron = colorMat(0x26262b, { rough: 0.45, metal: 0.85, key: 'chIron' });
    const ropeMat = colorMat(0x8a6a40, { rough: 1, key: 'rope' });
    this.ropeMat = ropeMat.clone();
    const ch = new THREE.Group();
    ch.position.set(4.4, 4.35, -0.5);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 28), iron); ring.rotation.x = Math.PI / 2; ch.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 6, 20), iron); inner.rotation.x = Math.PI / 2; inner.position.y = 0.12; ch.add(inner);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 8), iron); stem.position.y = 0.25; ch.add(stem);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ch.add(rope(V(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6), V(0, 0.48, 0), 0.008, iron));
    }
    const wax = colorMat(0xf2ead2, { rough: 0.6, key: 'wax' });
    const flame = colorMat(0xffb040, { emissive: 0xff9020, emissiveIntensity: 3, key: 'flame' });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 6), wax); c.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62); ch.add(c);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), flame); f.scale.y = 1.8; f.position.set(Math.cos(a) * 0.62, 0.17, Math.sin(a) * 0.62); ch.add(f);
    }
    // crystal drops
    const crystal = colorMat(0xcfefff, { rough: 0.05, metal: 0.3, emissive: 0x334455, key: 'chCrystal' });
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), crystal); d.scale.y = 1.8; d.position.set(Math.cos(a) * 0.5, -0.12, Math.sin(a) * 0.5); ch.add(d);
    }
    // virtual light (LightRig): hiding the chandelier later must not change the real light count
    const light = this.game.lightRig.add({ color: 0xffc070, intensity: 16, distance: 9, decay: 1.6, follow: ch, offset: V(0, 0.1, 0), priority: 1.3 });
    ch.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.root.add(ch);
    this.chandelier = ch;
    this.chLight = light;
    // rope over two pulleys down to the cleat on the gallery rail
    const top = V(4.4, 4.85, -0.5), p1 = V(4.4, 5.92, -0.5), p2 = V(2.62, 5.92, -0.5), cleat = V(2.62, 4.0, -0.5);
    this.ropes = [rope(top, p1, 0.016, this.ropeMat), rope(p1, p2, 0.016, this.ropeMat), rope(p2, cleat, 0.016, this.ropeMat)];
    this.ropes.forEach((r) => this.root.add(r));
    for (const p of [p1, p2]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), iron); w.rotation.x = Math.PI / 2; w.position.copy(p); this.root.add(w);
    }
    const cl = new THREE.Group();
    cl.position.copy(cleat);
    const block = new THREE.Mesh(boxGeo(0.16, 0.22, 0.16, 0.5), woodMat('rough_wood', { tint: 0x7a5a40, key: 'cleat' })); cl.add(block);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 5, 12), this.ropeMat); t.position.y = -0.06 + i * 0.05; t.rotation.x = Math.PI / 2; cl.add(t); }
    this.cleatGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, depthWrite: false }));
    cl.add(this.cleatGlow);
    this.root.add(cl);
    this.cleat = cl;
  }

  // ------------------------------------------------------------------ SP02 pot rack
  _buildPotRack() {
    const iron = colorMat(0x2b2b30, { rough: 0.45, metal: 0.85, key: 'propIron' });
    const copper = colorMat(0xb06a3a, { rough: 0.35, metal: 0.9, key: 'copper' });
    const rack = new THREE.Group();
    rack.position.set(-4.6, 2.35, -1.9);
    const bar = new THREE.Mesh(boxGeo(1.3, 0.06, 0.06), woodMat('rough_wood', { key: 'propRough', tint: 0x9a8070 })); rack.add(bar);
    rack.add(rope(V(-0.6, 0, 0), V(-0.6, 0.65, 0), 0.01, iron), rope(V(0.6, 0, 0), V(0.6, 0.65, 0), 0.01, iron));
    this.rackPans = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Group();
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(i % 2 ? 0.13 : 0.11, i % 2 ? 0.11 : 0.1, 0.05, 12), i % 2 ? copper : iron);
      pan.rotation.x = Math.PI / 2; pan.position.y = -0.22; p.add(pan);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.02), i % 2 ? copper : iron); h.position.y = -0.08; p.add(h);
      p.position.set(-0.45 + i * 0.3, 0, 0);
      rack.add(p);
      this.rackPans.push(p);
    }
    rack.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(rack);
    this.potRack = rack;
  }

  // ------------------------------------------------------------------ SP10 plant chandelier (conservatory)
  _buildGlassHouse() {
    const iron = colorMat(0x26262b, { rough: 0.45, metal: 0.85, key: 'chIron' });
    this.gRopeMat = colorMat(0x8a6a40, { rough: 1, key: 'rope' }).clone();
    const terracotta = colorMat(0xa0522d, { rough: 0.85, key: 'terracotta' });
    const herb = colorMat(0x5a6a2a, { rough: 1, key: 'herb' });
    const ch = new THREE.Group();
    ch.position.set(9.8, 2.35, 0.2);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 26), iron); hoop.rotation.x = Math.PI / 2; ch.add(hoop);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ch.add(rope(V(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), V(0, 0.42, 0), 0.008, iron)); }
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.12, 10), terracotta); pot.position.set(Math.cos(a) * 0.55, -0.16, Math.sin(a) * 0.55); ch.add(pot);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), herb); leaves.position.set(Math.cos(a) * 0.55, -0.24, Math.sin(a) * 0.55); leaves.scale.y = 1.6; ch.add(leaves);
      ch.add(rope(V(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), V(Math.cos(a) * 0.55, -0.1, Math.sin(a) * 0.55), 0.004, iron));
    }
    const flame = colorMat(0xffb040, { emissive: 0xff9020, emissiveIntensity: 3, key: 'flame' });
    const wax = colorMat(0xf2ead2, { rough: 0.6, key: 'wax' });
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 6), wax); c.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55); ch.add(c);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), flame); f.scale.y = 1.8; f.position.set(Math.cos(a) * 0.55, 0.16, Math.sin(a) * 0.55); ch.add(f);
    }
    ch.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.gLight = this.game.lightRig.add({ color: 0xffc070, intensity: 7, distance: 6, decay: 1.7, follow: ch, offset: V(0, 0.1, 0), priority: 1.2 });
    this.root.add(ch);
    this.gChandelier = ch;
    // chain up to the rafter, rope across to the house wall and down to a cleat by the door
    const top = V(9.8, 2.77, 0.2), p1 = V(9.8, 3.82, 0.2), p2 = V(7.35, 4.3, -1.2), cleat = V(7.33, 1.25, -1.2);
    this.gRopes = [rope(top, p1, 0.016, iron), rope(p1, p2, 0.016, this.gRopeMat), rope(p2, cleat, 0.016, this.gRopeMat)];
    this.gRopes.forEach((r) => this.root.add(r));
    for (const p of [p1, p2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), iron); w.rotation.x = Math.PI / 2; w.position.copy(p); this.root.add(w); }
    const cl = new THREE.Group();
    cl.position.copy(cleat);
    cl.add(new THREE.Mesh(boxGeo(0.12, 0.2, 0.16, 0.5), woodMat('rough_wood', { tint: 0x7a5a40, key: 'cleat' })));
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 5, 12), this.gRopeMat); t.position.y = -0.06 + i * 0.05; t.rotation.x = Math.PI / 2; cl.add(t); }
    this.gCleatGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, depthWrite: false }));
    cl.add(this.gCleatGlow);
    this.root.add(cl);
    this.gCleat = cl;
  }

  // ------------------------------------------------------------------ SP04 roof brace
  _buildBrace() {
    const beam = woodMat('rough_wood', { tint: 0x7a6050, key: 'brace' });
    const g = new THREE.Group();
    g.position.set(2.25, F2, 3.0);
    const post = new THREE.Mesh(boxGeo(0.3, 2.8, 0.3, 1), beam); post.position.y = 1.4; g.add(post);
    const s1 = new THREE.Mesh(boxGeo(0.16, 1.5, 0.16, 1), beam); s1.position.set(0.0, 2.3, 0.5); s1.rotation.x = -0.6; g.add(s1);
    const s2 = new THREE.Mesh(boxGeo(0.16, 1.5, 0.16, 1), beam); s2.position.set(0.0, 2.3, -0.5); s2.rotation.x = 0.6; g.add(s2);
    // dangling charms
    const bone = colorMat(0xe6dcc0, { rough: 0.6, key: 'bone' });
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), bone);
      c.position.set(0.2, 1.6 + Math.sin(i) * 0.3, -0.3 + i * 0.15);
      g.add(c);
    }
    // curse glyph (lights up when the finale unlocks)
    const glyphMat = Mats.sign('☠ ✶ ☾\nTHE LAST\nSUPPORT', 'glyph').clone();
    glyphMat.emissive = new THREE.Color(0x7dff7a); glyphMat.emissiveMap = glyphMat.map; glyphMat.emissiveIntensity = 0; glyphMat.transparent = true; glyphMat.opacity = 0;
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), glyphMat);
    glyph.position.set(-0.16, 1.5, 0); glyph.rotation.y = -Math.PI / 2;
    g.add(glyph);
    this.glyph = glyph;
    this.braceGlow = this.game.lightRig.add({ color: 0x7dff7a, intensity: 0, distance: 5, decay: 1.5, follow: g, offset: V(-0.4, 1.6, 0), priority: 1.5 });
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(g);
    this.brace = g;
    // collider so the cat can't walk through the post
    this.braceCol = this.game.physics.addStaticBox(2.25, F2 + 1.4, 3.0, 0.15, 1.4, 0.15, {});
  }

  // ------------------------------------------------------------------ weak points
  _registerWeakPoints() {
    const g = this.game;
    const self = this;
    const dmg = { teapot: 30, plate: 26, pan: 60, axe: 130, spear: 120, bigaxe: 999 };
    const wp = (o) => { g.weakPoints.push(o); return o; };
    this.wp1 = wp({
      id: 'sp01', pos: V(2.62, 4.0, -0.5), radius: 0.85, magnetRadius: 2.0, hp: 100,
      armed: () => !self.done.SP01 && !self.busy,
      onHit: ({ type, source }) => {
        this.wp1.hp -= dmg[type] ?? 40;
        g.fx.sparks(this.wp1.pos, 10, { color: [1, 0.85, 0.5] });
        this._ropeStrain();
        if (this.wp1.hp <= 0) this.trigger('SP01', source);
        else g.events.emit('weakPointDamaged', { id: 'sp01', hp: this.wp1.hp });
      },
      highlight: (on) => { this.cleatGlow.material.opacity = on ? 0.45 : (this.state.sp01Primed ? 0.18 : 0); },
    });
    this.wp2 = wp({
      id: 'sp02', pos: V(-6.4, 1.0, -2.6), radius: 0.9, magnetRadius: 1.8, hp: 1,
      armed: () => !self.done.SP02 && !self.busy,
      onHit: ({ source }) => this._kitchenStoveHit(source),
      highlight: () => {},
    });
    this.wp3 = wp({
      id: 'sp03', pos: V(-5.1, F2 + 1.2, 1.05), radius: 0.95, magnetRadius: 2.2, hp: 130,
      armed: () => !self.done.SP03 && !self.busy && !g.destruction.get('bedroom_wardrobe')?.broken,
      onHit: ({ type, source }) => {
        this.wp3.hp -= dmg[type] ?? 40;
        const w = g.destruction.get('bedroom_wardrobe');
        if (w) { w.shake = 0.6; }
        g.fx.dust(this.wp3.pos, 8, { size: 0.4 });
        g.audio?.play('creak', { pos: this.wp3.pos, volume: 1 });
        if (this.wp3.hp <= 0) this.trigger('SP03', source);
        else g.events.emit('weakPointDamaged', { id: 'sp03', hp: this.wp3.hp });
      },
      highlight: (on) => this._setCracks(on ? 1 : this.state.sp03Primed ? 0.6 : 0),
    });
    this.wp10 = wp({
      id: 'sp10', pos: V(9.8, 2.3, 0.2), radius: 0.9, magnetRadius: 2.2, hp: 100,
      armed: () => !self.done.SP10 && !self.busy,
      onHit: ({ type, source }) => {
        this.wp10.hp -= dmg[type] ?? 40;
        g.fx.sparks(this.wp10.pos, 10, { color: [1, 0.85, 0.5] });
        this.gSwing = 1.0;
        g.audio?.play('creak', { pos: this.gChandelier.position, volume: 1 });
        if (this.wp10.hp <= 0) this.trigger('SP10', source);
        else g.events.emit('weakPointDamaged', { id: 'sp10', hp: this.wp10.hp });
      },
      highlight: (on) => { this.gCleatGlow.material.opacity = on ? 0.45 : (this.state.sp10Primed ? 0.18 : 0); },
    });
    this.wp4 = wp({
      id: 'sp04', pos: V(2.25, F2 + 1.5, 3.0), radius: 1.3, magnetRadius: 3.5, hp: 999,
      armed: () => this.state.finaleUnlocked && !self.done.SP04 && !self.busy,
      onHit: ({ type, source }) => {
        this.wp4.hp -= dmg[type] ?? 40;
        g.fx.splinterBurst(this.wp4.pos, 16, { color: 0x7a5a40 });
        g.followCam.addShake(0.2, 0.3);
        if (this.wp4.hp <= 0) this.trigger('SP04', source);
        else g.events.emit('weakPointDamaged', { id: 'sp04', hp: this.wp4.hp });
      },
      highlight: (on) => { this.braceGlow.intensity = on ? 14 : 6; },
    });
  }

  _registerScratchTargets() {
    const lv = this.game.level;
    lv.scratchTargets.push(
      { id: 'scr_rope', pos: V(2.32, F2, -0.5), radius: 0.75, time: 1.4, label: 'Hold E: claw the chandelier rope',
        valid: () => !this.done.SP01 && !this.state.sp01Primed, onComplete: () => this._primeRope() },
      { id: 'scr_wardrobe', pos: V(-5.1, F2, 1.6), radius: 0.8, time: 1.4, label: 'Hold E: scratch the wobbly wardrobe leg',
        valid: () => !this.done.SP03 && !this.state.sp03Primed, onComplete: () => this._primeWardrobe() },
      { id: 'scr_glass', pos: V(7.62, 0, -1.2), radius: 0.7, time: 1.4, label: 'Hold E: claw the plant chandelier rope',
        valid: () => !this.done.SP10 && !this.state.sp10Primed, onComplete: () => this._primeGlassRope() },
      { id: 'scr_sofa', pos: V(3.55, 0, 2.4), radius: 0.7, time: 1.6, label: 'Hold E: shred the sofa',
        valid: () => !this.game.destruction.get('living_sofa')?.broken, onComplete: () => this.game.destruction.damage(this.game.destruction.get('living_sofa'), 999, 'cat_scratch') },
      { id: 'scr_curtain', pos: V(-6.0, 0, -4.4), radius: 0.7, time: 1.2, label: 'Hold E: shred the curtains',
        valid: () => !this.game.destruction.get('kitchen_curtain')?.broken, onComplete: () => this.game.destruction.damage(this.game.destruction.get('kitchen_curtain'), 999, 'cat_scratch') },
    );
  }

  _primeRope() {
    const g = this.game;
    this.state.sp01Primed = true;
    this.wp1.hp = Math.min(this.wp1.hp, 25); // any Grandma throw now snaps it
    this.ropeMat.color.setHex(0xc9a060);
    this.ropeMat.emissive = new THREE.Color(0x553300);
    this.cleatGlow.material.opacity = 0.18;
    g.fx.splinterBurst(V(2.62, 4.0, -0.5), 10, { color: 0xc9a060, size: 0.04 });
    g.audio?.play('creak', { pos: this.chandelier.position, volume: 1 });
    g.dialogue?.say('K_PRIMED_ROPE', { priority: true });
    g.events.emit('setpiecePrimed', { id: 'SP01' });
  }

  _primeGlassRope() {
    const g = this.game;
    this.state.sp10Primed = true;
    this.wp10.hp = Math.min(this.wp10.hp, 25);
    this.gRopeMat.color.setHex(0xc9a060);
    this.gRopeMat.emissive = new THREE.Color(0x553300);
    this.gCleatGlow.material.opacity = 0.18;
    this.gSwing = 0.8;
    g.fx.splinterBurst(this.gCleat.position.clone(), 10, { color: 0xc9a060, size: 0.04 });
    g.audio?.play('creak', { pos: this.gChandelier.position, volume: 1 });
    g.dialogue?.say('K_PRIMED_GLASS', { priority: true });
    g.events.emit('setpiecePrimed', { id: 'SP10' });
  }

  _primeWardrobe() {
    const g = this.game;
    this.state.sp03Primed = true;
    this.wp3.hp = Math.min(this.wp3.hp, 55);
    this._setCracks(0.6);
    const w = g.destruction.get('bedroom_wardrobe');
    if (w) w.shake = 0.8;
    g.audio?.play('creak', { pos: this.wp3.pos, volume: 1.2 });
    g.dialogue?.say('K_PRIMED_FLOOR', { priority: true });
    g.events.emit('setpiecePrimed', { id: 'SP03' });
  }

  /** SP03: the bedroom floor gives way.  The boards' own fragments filled the opening exactly, froze in place
   *  (a corner over the next slab counted as support) and hid the hole (playtest 4); now the planks come down in
   *  smaller pieces that clear the opening, and broken board ends and cracks mark its rim. */
  _openFloorHole(wf) {
    const g = this.game, hole = g.house.weakFloor;
    if (wf.rim) { wf.rim.stubs.visible = true; wf.rim.decal.material.opacity = 1; }
    const mat = wf.parts[0]?.mesh.material;
    const w = hole.x1 - hole.x0, d = hole.z1 - hole.z0;
    for (let i = 0; i < 9; i++) {
      const x = hole.x0 + 0.3 + Math.random() * (w - 0.6), z = hole.z0 + 0.3 + Math.random() * (d - 0.6);
      g.destruction.spawnDebris(V(x, hole.y - 0.12, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.8, Math.random() * 3, (Math.random() - 0.5) * 0.8)),
        [0.16 + Math.random() * 0.12, 0.05, 0.45 + Math.random() * 0.4], mat, V((Math.random() - 0.5) * 1.2, -1.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1.2), 'wood', 6);
    }
    g.fx.splinterBurst(V((hole.x0 + hole.x1) / 2, hole.y - 0.05, (hole.z0 + hole.z1) / 2), 30, { color: 0x6a4a30, speed: 3 });
    g.fx.dust(V((hole.x0 + hole.x1) / 2, hole.y - 0.2, (hole.z0 + hole.z1) / 2), 24, { size: 0.6, spread: 1.6, life: 2.2 });
  }

  _setCracks(level) {
    const wf = this.game.level.named.weakFloor;
    if (!wf?.cracks) return;
    const m = wf.cracks.material;
    m.opacity = 0.7 * level;
    m.emissiveIntensity = 2 * level;
    if (!m.map) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.strokeStyle = '#ffae40'; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) { let x = 128, y = 128; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 80; y += (Math.random() - 0.5) * 80; ctx.lineTo(x, y); } ctx.stroke(); }
      m.map = new THREE.CanvasTexture(c); m.alphaMap = m.map; m.emissiveMap = m.map; m.needsUpdate = true;
    }
  }

  _ropeStrain() {
    this.chSwing = 1.0;
    this.game.audio?.play('creak', { pos: this.chandelier.position });
  }

  // ------------------------------------------------------------------ SP02 keys
  _kitchenEmber(lampRec) {
    if (this.state.sp02Ember) return;
    const g = this.game;
    this.state.sp02Ember = true;
    const p = lampRec.body ? lampRec.body.translation() : lampRec.group.position;
    const floor = g.fx.floorBelow(p.x, p.y + 0.2, p.z);
    this.emberPos = V(p.x, floor + 0.05, p.z);
    this.ember = g.fire.ignite(this.emberPos, { size: 0.35, light: true, damageRadius: 0.5 });
    g.dialogue?.say('K_EMBER', { priority: true });
    g.events.emit('setpiecePrimed', { id: 'SP02', key: 'ember' });
    if (this.state.sp02Stove) this.trigger('SP02', this.state.sp02StoveSource ?? 'granny_throw');
  }

  _kitchenStoveHit(source) {
    if (this.done.SP02 || !source?.startsWith('granny')) return;
    const g = this.game;
    if (!this.state.sp02Stove) {
      this.state.sp02Stove = true;
      this.state.sp02StoveSource = source;
      g.fx.sparks(V(-6.4, 1.1, -2.6), 24, { color: [1, 0.5, 0.15], speed: 5 });
      g.fx.smoke(V(-6.4, 1.3, -2.6), 6, { color: [0.12, 0.1, 0.1] });
      g.audio?.play('metal', { pos: V(-6.4, 1, -2.6), volume: 1.2 });
      g.events.emit('setpiecePrimed', { id: 'SP02', key: 'stove' });
      // the rack shakes loose a pan
      this.potRackShake = 1.2;
    }
    if (this.state.sp02Ember) this.trigger('SP02', source);
    else g.dialogue?.say('K_SPARKS', { priority: true });
  }

  // ------------------------------------------------------------------ triggering
  trigger(id, source = 'granny_throw') {
    if (this.done[id] || this.busy) return;
    this.done[id] = true;
    const g = this.game;
    g.followCam?.clearFades(); // set pieces clone furniture: it must carry its real materials
    g.events.emit('setpieceTriggered', { id, source });
    const runner = { SP01: () => this._runChandelier(source), SP02: () => this._runKitchen(source), SP03: () => this._runFloor(source), SP04: () => this._runFinale(source), SP10: () => this._runGlassHouse(source) }[id];
    runner?.();
  }

  _award(id, base, ruin, label, source) {
    const g = this.game;
    const r = g.score.award({ id, base, source, ruin, label, setpiece: id });
    if (r) {
      g.ui.banner(label, `+${r.points.toLocaleString('en-US')}${r.granny ? '  ·  GRANNY DID IT x2' : ''}${r.chainBonus ? '  ·  CHAIN BONUS!' : ''}`, { granny: r.granny, dur: 2.6, priority: 2 });
      g.events.emit('scored', { ...r, setpiece: id, point: null });
    }
    // escalate Grandma's floor rage so the game keeps moving
    const n = this.count;
    g.rage.setFloor(n >= 3 ? 75 : n >= 2 ? 60 : n >= 1 ? 35 : 0);
  }

  _runChandelier(source) {
    const g = this.game;
    const ch = this.chandelier;
    const tableTop = 0.76;
    const fall = { t: 0, y0: ch.position.y, y1: tableTop + 0.05, dur: 0.62 };
    this.busy = true;
    const finishFall = () => {
      if (fall.landed) return;
      fall.landed = true;
      ch.position.y = fall.y1; ch.rotation.set(0.25, 0.4, -0.18);
      const table = g.destruction.get('dining_table');
      if (table && !table.broken) g.destruction.breakIt(table, source, V(4.4, 0.8, -0.5), V(0, -1, 0));
      g.destruction.blast(V(4.4, 0.8, -0.5), 2.6, 5, source, { damage: 60, up: 0.9 });
      g.fx.dust(V(4.4, 0.5, -0.5), 34, { size: 0.7, spread: 2.4, life: 2.2 });
      g.fx.shardBurst(V(4.4, 0.9, -0.5), 40, { color: 0xcfefff, speed: 5 });
      g.fx.sparks(V(4.4, 0.9, -0.5), 30, { speed: 6 });
      g.followCam.addShake(0.45, 0.6);
      g.audio?.play('chandelier', { pos: V(4.4, 1, -0.5), volume: 1.4, jitter: 0 });
      g.audio?.play('woodbig', { pos: V(4.4, 1, -0.5), volume: 1 });
      this.chLight.intensity = 0;
      g.house.flickerOut?.(1.2);
      ch.position.y = 0.0; ch.visible = false; // replaced by physical wreckage
      this._wreckChandelier(V(4.4, tableTop * 0.5, -0.5));
      this._award('SP01', 1500, 12, 'THE LAST SUPPER', source);
    };
    const snapRope = () => {
      this.ropes[2].visible = false;
      this.ropes[0].visible = false;
      this.cleatGlow.material.opacity = 0; // the rope is gone: no more glowing weak spot
      g.fx.splinterBurst(V(2.62, 4.0, -0.5), 8, { color: 0xc9a060, size: 0.04 });
      g.audio?.play('whoosh', { pos: ch.position, volume: 1.0, rate: 0.7 });
      this.anims.push({ update: (dt) => {
        if (fall.landed) return true;
        fall.t += dt;
        const k = Math.min(1, fall.t / fall.dur);
        ch.position.y = fall.y0 + (fall.y1 - fall.y0) * k * k;
        ch.rotation.z = k * 0.2; ch.rotation.x = k * 0.15;
        if (k >= 1) { finishFall(); return true; }
        return false;
      } });
    };
    g.startCinematic('SP01', [
      { t: 0.0, fn: () => { g.setShot(V(1.6, 1.0, 2.6), V(4.4, 2.6, -0.5), 55, true); g.setTimeScale(0.55); snapRope(); g.granny.react('horrified'); } },
      { t: 0.45, fn: () => g.setShot(V(2.2, 0.5, 1.6), V(4.4, 0.9, -0.5), 50) },
      { t: 1.0, fn: () => { g.setTimeScale(1); finishFall(); } , skip: () => { snapRope(); finishFall(); } },
      { t: 1.3, fn: () => g.dialogue?.say('G_CHANDELIER', { priority: true }) },
      { t: 2.2, fn: () => { const c = g.cat.root.position; g.setShot(c.clone().add(V(0.9, 0.5, 0.9)), c.clone().add(V(0, 0.3, 0)), 45); } },
      { t: 3.6, fn: () => g.dialogue?.say('K_CHANDELIER', { queue: true }) }, // after Grandma's line, never over it
      { t: 4.0, fn: () => {} },
    ], () => { this.busy = false; g.setTimeScale(1); if (!fall.landed) { snapRope(); finishFall(); } });
  }

  _wreckChandelier(p) {
    const g = this.game;
    const iron = colorMat(0x26262b, { rough: 0.45, metal: 0.85, key: 'chIron' });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      g.destruction.spawnDebris(V(p.x + Math.cos(a) * 0.5, p.y + 0.3, p.z + Math.sin(a) * 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0.3)),
        [0.9, 0.07, 0.07], iron, V(Math.cos(a) * 2, 2, Math.sin(a) * 2), 'metal', 6);
    }
  }

  _runKitchen(source) {
    const g = this.game;
    this.busy = true;
    this.fireSource = source; // flames that Grandma started count as hers
    const stove = V(-6.35, 1.0, -2.6);
    const ignite = () => {
      if (this.kitchenLit) return;
      this.kitchenLit = true;
      g.fire.ignite(V(-6.3, 0.95, -2.6), { size: 0.8, damageRadius: 1.0 });
      g.fire.ignite(V(-6.3, 2.0, -2.6), { size: 0.6, light: false, damageRadius: 0.9 });
      g.fire.ignite(V(-6.0, 1.2, -4.6), { size: 0.7, damageRadius: 0.9 });
      g.fire.ignite(V(-6.45, 0.3, -1.25), { size: 0.6, light: false, damageRadius: 0.8 });
      g.fx.sparks(stove, 60, { color: [1, 0.6, 0.2], speed: 7, life: 1 });
      g.fx.smoke(stove, 14, { size: 0.8 });
      g.audio?.play('fire_whoosh', { pos: stove, volume: 1.4, jitter: 0 });
      g.audio?.play('sting', { volume: 0.5, jitter: 0 });
      // pot rack drops onto the table
      this.anims.push(this._dropRack());
      g.destruction.blast(V(-6.0, 1.0, -2.6), 2.4, 4, source, { damage: 40, up: 0.7 });
      const herbs = g.destruction.get('kitchen_herbs'); if (herbs) g.destruction.damage(herbs, 999, source);
      this._award('SP02', 2000, 10, 'THE KITCHEN CURSE', source);
    };
    g.startCinematic('SP02', [
      { t: 0, fn: () => { g.setShot(V(-3.2, 1.4, -1.1), V(-6.2, 1.0, -2.7), 55, true); g.setTimeScale(0.6); } },
      { t: 0.35, fn: ignite },
      { t: 1.2, fn: () => { g.setTimeScale(1); g.dialogue?.say('G_KITCHEN', { priority: true }); g.granny.react('horrified'); } },
      { t: 2.2, fn: () => g.setShot(V(-3.9, 0.7, -0.4), V(-5.6, 0.9, -2.6), 48) },
      { t: 3.4, fn: () => g.dialogue?.say('K_KITCHEN', { queue: true }) },
      { t: 3.9, fn: () => {} },
    ], () => { this.busy = false; g.setTimeScale(1); ignite(); });
  }

  _dropRack() {
    const g = this.game;
    const rack = this.potRack;
    const st = { t: 0, y0: rack.position.y };
    return { update: (dt) => {
      st.t += dt;
      const k = Math.min(1, st.t / 0.45);
      rack.position.y = st.y0 - (st.y0 - 0.85) * k * k;
      rack.rotation.z = k * 0.4;
      if (k >= 1) {
        rack.visible = false;
        const table = g.destruction.get('kitchen_table');
        if (table && !table.broken) g.destruction.breakIt(table, this.fireSource, V(-4.6, 0.8, -1.9), V(0, -1, 0));
        for (let i = 0; i < 4; i++) g.destruction.spawn({ id: `rack_pan_${i}_${Math.random().toString(36).slice(2, 6)}`, kind: i % 2 ? 'pot' : 'pan', pos: [-5.0 + i * 0.3, 0.9, -1.9], meta: { score: 0 } });
        g.audio?.play('metal', { pos: V(-4.6, 0.9, -1.9), volume: 1.2 });
        g.fx.dust(V(-4.6, 0.6, -1.9), 14, { size: 0.5 });
        return true;
      }
      return false;
    } };
  }

  _runFloor(source) {
    const g = this.game;
    this.busy = true;
    const ward = g.destruction.get('bedroom_wardrobe');
    const wf = g.level.named.weakFloor;
    // animated stand-in for the falling wardrobe
    const stand = ward.group.clone(true);
    stand.visible = true;
    stand.position.copy(ward._base ?? ward.group.position);
    g.scene.add(stand);
    // pivot at the front-bottom edge so it tips forward
    const pivot = new THREE.Group();
    pivot.position.set(stand.position.x, stand.position.y, stand.position.z + 0.31);
    g.scene.add(pivot);
    pivot.attach(stand);
    // the real record: remove collider silently (score comes from the set piece)
    ward.meta.score = 0;
    g.destruction.breakIt(ward, source, undefined, undefined, { noFragments: true, silent: true });
    const st = { t: 0, phase: 0 };
    const breakFloor = () => {
      if (st.floorGone) return;
      st.floorGone = true;
      wf.meta.score = 0;
      g.destruction.breakIt(wf, source, V(-5.1, F2, 1.5), V(0, -1, 0), { noFragments: true });
      this._openFloorHole(wf);
      g.audio?.play('wood_crash', { pos: V(-5.1, F2, 1.5), volume: 1.3, jitter: 0 });
      g.followCam.addShake(0.35, 0.5);
    };
    const land = () => {
      if (st.landed) return;
      st.landed = true;
      st.phase = 3;
      pivot.visible = false;
      const p = V(-5.1, 0.6, 1.6);
      g.fx.dust(p, 40, { size: 0.8, spread: 2.6, life: 2.4 });
      g.fx.splinterBurst(p, 40, { color: 0x6a4a30, speed: 5 });
      g.audio?.play('woodbig', { pos: p, volume: 1.4 });
      g.audio?.play('wood_crash', { pos: p, volume: 1.2, rate: 0.8 });
      g.followCam.addShake(0.5, 0.6);
      g.destruction.blast(p, 2.8, 5, source, { damage: 80, up: 0.8 });
      // wardrobe wreckage (non-blocking debris)
      const mat = ward.parts[0]?.mesh.material;
      for (let i = 0; i < 7; i++) g.destruction.spawnDebris(V(p.x + (Math.random() - 0.5) * 1.2, p.y + Math.random() * 0.6, p.z + (Math.random() - 0.5) * 1.0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)), [0.6 + Math.random() * 0.5, 0.06, 0.3 + Math.random() * 0.3], mat,
        V((Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3), 'wood', 6);
      this._award('SP03', 3000, 16, 'THE BEDROOM BELOW', source);
    };
    this.anims.push({ update: (dt) => {
      st.t += dt;
      if (st.phase === 0) { // tip forward
        const k = Math.min(1, st.t / 0.55);
        pivot.rotation.x = k * k * 1.2;
        if (k >= 1) { st.phase = 1; st.t = 0; breakFloor(); st.vy = 0; }
      } else if (st.phase === 1) { // fall through the floor
        st.vy += 14 * dt;
        pivot.position.y -= st.vy * dt;
        pivot.rotation.x += dt * 1.4;
        if (pivot.position.y <= 0.3) land();
      }
      return st.landed;
    } });
    g.startCinematic('SP03', [
      { t: 0, fn: () => { g.setShot(V(-3.2, 4.6, 3.6), V(-5.1, 4.0, 1.2), 55, true); g.setTimeScale(0.7); g.granny.react('horrified'); } },
      // from the foyer below, wide enough to see it come through the ceiling AND hit the floor
      { t: 0.75, fn: () => { g.setShot(V(-2.5, 1.55, 4.7), V(-5.0, 1.55, 1.5), 64, true); } },
      { t: 1.0, fn: () => g.dialogue?.say('G_FLOOR', { priority: true }) },
      { t: 1.8, fn: () => g.setTimeScale(1) },
      { t: 3.1, fn: () => g.dialogue?.say('K_FLOOR', { queue: true }) },
      { t: 3.9, fn: () => {} },
    ], () => { this.busy = false; g.setTimeScale(1); breakFloor(); land(); if (stand.parent) stand.parent.remove(stand); g.scene.remove(pivot); });
  }

  _runGlassHouse(source) {
    const g = this.game;
    const ch = this.gChandelier;
    const fall = { t: 0, y0: ch.position.y, y1: 0.86, dur: 0.5 };
    this.busy = true;
    const smashTable = () => {
      if (fall.landed) return;
      fall.landed = true;
      ch.visible = false;
      this.gLight.intensity = 0;
      const tp = V(9.8, 0.8, 0.2);
      const table = g.destruction.get('cons_teatable');
      if (table && !table.broken) g.destruction.breakIt(table, source, tp, V(0, -1, 0));
      g.destruction.blast(tp, 2.4, 5, source, { damage: 60, up: 0.9 });
      g.fx.dust(V(9.8, 0.5, 0.2), 30, { size: 0.6, spread: 2.2, life: 2.0 });
      g.fx.shardBurst(V(9.8, 0.9, 0.2), 30, { color: 0xa0522d, speed: 5 });
      g.fx.sparks(V(9.8, 0.9, 0.2), 20, { speed: 5 });
      g.audio?.play('chandelier', { pos: tp, volume: 1.2, jitter: 0 });
      g.audio?.play('woodbig', { pos: tp, volume: 1 });
      g.followCam.addShake(0.4, 0.5);
      const iron = colorMat(0x26262b, { rough: 0.45, metal: 0.85, key: 'chIron' });
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        g.destruction.spawnDebris(V(9.8 + Math.cos(a) * 0.45, 0.6, 0.2 + Math.sin(a) * 0.45), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0.3)),
          [0.75, 0.06, 0.06], iron, V(Math.cos(a) * 2, 2, Math.sin(a) * 2), 'metal', 6);
      }
    };
    const shatterRoof = () => {
      if (this.roofDown) return;
      this.roofDown = true;
      const house = g.house;
      if (house.glassRoof) house.glassRoof.visible = false;
      house.wingOpen = true;
      const glass = colorMat(0xbfe3ef, { rough: 0.05, metal: 0.2, transparent: true, opacity: 0.45, key: 'shardGlass' });
      // the panes come down in big sheets and a thousand small pieces
      for (let i = 0; i < 26; i++) {
        const x = 7.5 + Math.random() * 4.6, z = -4.6 + Math.random() * 9.2;
        const y = 4.5 - (x - 7.15) * 0.24;
        g.destruction.spawnDebris(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.8, Math.random() * 3, Math.random() * 0.8)),
          [0.25 + Math.random() * 0.35, 0.02, 0.2 + Math.random() * 0.3], glass, V((Math.random() - 0.5) * 1.5, -2 - Math.random() * 2, (Math.random() - 0.5) * 1.5), 'glass', 6);
      }
      for (let i = 0; i < 6; i++) g.fx.shardBurst(V(7.8 + i * 0.8, 4.1 - i * 0.18, -3 + (i % 3) * 3), 18, { color: 0xd8f4ff, speed: 3 });
      [0, 0.18, 0.4, 0.7].forEach((dly, i) => setTimeout(() => g.audio?.play(i % 2 ? 'glass' : 'glass_crash', { pos: V(8 + i, 3.5, (i - 1.5) * 2), volume: 1.3, jitter: 0.15 }), dly * 1000));
      g.audio?.play('wood_crash', { pos: V(9.8, 3.9, 0.2), volume: 1.1, jitter: 0 });
      g.audio?.play('thunder', { volume: 1, jitter: 0.05 });
      g.director.lightning = 0.5;
      // rafter wreckage, and the plant stands topple
      const beam = woodMat('rough_wood', { tint: 0x9a8070 });
      for (let i = 0; i < 3; i++) g.destruction.spawnDebris(V(8.4 + i * 1.3, 3.6, -1.5 + i * 1.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, i, 0.2)), [1.6, 0.1, 0.12], beam, V(0, -2, 0), 'wood', 8);
      for (const z of [-2.8, 3.6]) g.destruction.blast(V(11.7, 0.6, z), 1.8, 4, source, { damage: 40, up: 0.6 });
      g.followCam.addShake(0.5, 0.8);
      this._award('SP10', 2500, 12, 'THE GLASS HOUSE', source);
    };
    const snapRope = () => {
      if (fall.snapped) return;
      fall.snapped = true;
      this.gRopes[1].visible = false; this.gRopes[2].visible = false;
      this.gCleatGlow.material.opacity = 0;
      g.fx.splinterBurst(this.gCleat.position.clone(), 8, { color: 0xc9a060, size: 0.04 });
      g.audio?.play('whoosh', { pos: ch.position, volume: 1.0, rate: 0.7 });
      this.anims.push({ update: (dt) => {
        if (fall.landed) return true;
        fall.t += dt;
        const k = Math.min(1, fall.t / fall.dur);
        ch.position.y = fall.y0 + (fall.y1 - fall.y0) * k * k;
        ch.rotation.z = k * 0.25; ch.rotation.x = -k * 0.15;
        if (k >= 1) { smashTable(); return true; }
        return false;
      } });
    };
    // Grandma watches from beside the library armchair (in shot, not in front of the lens)
    const gr = g.granny;
    const grWas = gr.position.clone();
    if (gr.position.x > 6.8 && gr.position.y < 1) { gr.teleport(V(8.4, 0, -1.7)); gr.yaw = Math.atan2(9.8 - 8.4, 0.2 + 1.7); }
    void grWas;
    g.startCinematic('SP10', [
      { t: 0.0, fn: () => { g.setShot(V(8.1, 1.3, 3.6), V(9.8, 2.0, 0.2), 56, true); g.setTimeScale(0.55); snapRope(); g.granny.react('horrified'); } },
      { t: 0.6, fn: () => { g.setTimeScale(1); smashTable(); }, skip: () => { snapRope(); smashTable(); } },
      { t: 1.0, fn: () => { g.setShot(V(8.4, 0.7, 2.4), V(10.4, 4.0, -0.6), 64, true); shatterRoof(); } },
      { t: 1.9, fn: () => g.dialogue?.say('G_GLASS', { priority: true }) },
      { t: 3.0, fn: () => { const c = g.cat.root.position; g.setShot(c.clone().add(V(0.9, 0.55, 0.9)), c.clone().add(V(0, 0.3, 0)), 46); } },
      { t: 3.3, fn: () => g.dialogue?.say('K_GLASS', { queue: true }) },
      { t: 4.6, fn: () => {} },
    ], () => { this.busy = false; g.setTimeScale(1); if (!fall.landed) { snapRope(); smashTable(); } shatterRoof(); });
  }

  // ------------------------------------------------------------------ SP04 finale
  unlockFinale() {
    if (this.state.finaleUnlocked) return;
    this.state.finaleUnlocked = true;
    const m = this.glyph.material;
    m.opacity = 1; m.emissiveIntensity = 1.6;
    this.braceGlow.intensity = 6;
    this.game.events.emit('finaleUnlocked', {});
  }

  _runFinale(source) {
    const g = this.game;
    this.busy = true;
    g.events.emit('finaleCollapse', {});
    const collapse = () => {
      if (this.collapsed) return;
      this.collapsed = true;
      this.brace.visible = false;
      this.braceGlow.intensity = 0;
      g.physics.removeCollider(this.braceCol);
      g.house.breakRoof?.();
      g.fx.splinterBurst(V(2.25, 4.6, 3.0), 50, { color: 0x6a4a30, speed: 6 });
      g.audio?.play('collapse', { volume: 1.6, jitter: 0 });
      g.audio?.play('rumble', { volume: 1.2 });
      g.followCam.addShake(0.8, 2.0);
      // falling roof slabs + beams into the living room
      const sh = Mats.shingles();
      const beam = woodMat('rough_wood', { tint: 0x9a8070 });
      for (let i = 0; i < 9; i++) {
        const p = V(2.6 + Math.random() * 4.0, 6.6 + Math.random() * 1.4, -4 + Math.random() * 8);
        g.destruction.spawnDebris(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() - 0.5, Math.random() * 3, Math.random() - 0.5)),
          [1.0 + Math.random() * 1.2, 0.12, 0.8 + Math.random()], i % 3 ? sh : beam, V((Math.random() - 0.5) * 2, -2, (Math.random() - 0.5) * 2), 'wood', 8);
      }
      g.destruction.blast(V(4.4, 1.0, 0.5), 7, 6, source, { damage: 120, up: 1.0 });
      g.fx.dust(V(4.4, 1.5, 0.5), 60, { size: 1.2, spread: 6, life: 3.5 });
      for (const r of g.level.named ? Object.values(g.level.named) : []) if (r?.id?.startsWith('gallery_rail') && !r.broken) g.destruction.breakIt(r, source);
      this._award('SP04', 5000, 25, 'THE FINAL STRAW', source);
    };
    g.startCinematic('SP04', [
      { t: 0, fn: () => { g.setShot(V(5.6, 1.4, -3.8), V(2.4, 4.8, 2.6), 60, true); g.setTimeScale(0.5); } },
      { t: 0.5, fn: collapse },
      { t: 1.6, fn: () => { g.setShot(V(6.2, 0.8, 4.2), V(3.5, 2.8, -1.0), 62); } },
      { t: 2.6, fn: () => g.setTimeScale(1) },
      { t: 3.6, fn: () => g.director.beginOutro() },
    ], () => { g.setTimeScale(1); collapse(); });
  }

  // ------------------------------------------------------------------ per-frame
  update(dt, time) {
    // chandelier sway (more when the rope is strained/frayed)
    if (this.chandelier && !this.done.SP01) {
      this.chSwing = Math.max(0, (this.chSwing ?? 0) - dt * 0.5);
      const amp = 0.02 + (this.state.sp01Primed ? 0.03 : 0) + this.chSwing * 0.12;
      this.chandelier.rotation.z = Math.sin(time * 1.3) * amp;
      this.chandelier.rotation.x = Math.cos(time * 1.1) * amp * 0.6;
      this.chLight.intensity = 16 * (1 + Math.sin(time * 9) * 0.05);
    }
    if (this.gChandelier && !this.done.SP10) {
      this.gSwing = Math.max(0, (this.gSwing ?? 0) - dt * 0.5);
      const amp = 0.015 + (this.state.sp10Primed ? 0.025 : 0) + this.gSwing * 0.1;
      this.gChandelier.rotation.z = Math.sin(time * 1.1 + 1) * amp;
      this.gChandelier.rotation.x = Math.cos(time * 0.9) * amp * 0.6;
      this.gLight.intensity = 7 * (1 + Math.sin(time * 8) * 0.06);
    }
    if (this.potRack && this.potRackShake > 0 && !this.done.SP02) {
      this.potRackShake -= dt;
      this.potRack.rotation.z = Math.sin(time * 30) * 0.05 * this.potRackShake;
    }
    if (this.state.finaleUnlocked && !this.done.SP04) {
      this.braceGlow.intensity = 5 + Math.sin(time * 5) * 2;
      this.glyph.material.emissiveIntensity = 1.2 + Math.sin(time * 5) * 0.5;
    }
    this.anims = this.anims.filter((a) => !a.update(dt));
  }
}
