import * as THREE from 'three';
import { finaleReady } from './Rules.js';
import { FLOOR2 } from '../world/House.js';
import { colorMat, woodMat } from '../world/Materials.js';
import { Q } from '../core/Physics.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const F2 = FLOOR2;

// typographic quotes: the results font (IM Fell English) draws a straight " as a closing quote
const QUOTES = [
  '“I KNEW that cat was bad luck!” — Grandma',
  '“I barely lifted a paw.” — Komur',
  'Grandma has asked us to remind you that she is fine. The house is not.',
  'Insurance does not cover “cat-adjacent witchcraft”.',
];
// the caught ending stays cartoon-safe: nobody gets boiled
const CAUGHT_QUOTES = [
  'No cats were boiled. Grandma just likes the drama.',
  'Komur escaped through the chimney at 3 a.m. The soup was never the same.',
  '“Next time, coal-dust. NEXT TIME.” — Grandma',
  '“Five stars for the sauna. Minus four for the host.” — Komur',
];

// Game flow: intro, tutorial objectives, interactions, reactions, finale, outro.
export class Director {
  constructor(game) {
    this.game = game;
    this.stage = 'intro';
    this.elapsed = 0;
    this.stepAcc = 0;
    this.thunderT = 6 + Math.random() * 10;
    this.creakT = 8;
    this.firstCollateral = false;
    this.flags = {};
    this.doomMarks = new Set();
    this.marker = this._makeMarker();
  }

  _makeMarker() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffae1a, transparent: true, opacity: 0.9, depthTest: false }));
    m.scale.y = 1.6;
    m.renderOrder = 20;
    g.add(m);
    g.visible = false;
    this.game.scene.add(g);
    return g;
  }

  setMarker(pos) {
    if (!pos) { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.userData.pos = pos.clone();
  }

  // ------------------------------------------------------------------ wiring
  wire() {
    const g = this.game, ev = g.events, d = g.dialogue, a = g.audio;
    ev.on('scored', (r) => {
      if (r.setpiece) return;
      const p = r.point ?? g.cat.position;
      const txt = r.granny ? `GRANNY DID IT! +${r.points}` : `+${r.points}${r.multiplier > 1 ? ` x${r.multiplier}` : ''}`;
      g.ui.popup(p.clone ? p.clone() : V(p.x, p.y, p.z), txt, r.granny ? 'granny' : r.points >= 500 ? 'big' : '');
      if (r.chain === 5) { g.ui.banner('CHAIN REACTION!', `x${r.multiplier} multiplier`, { dur: 1.4 }); a?.play('bell', { volume: 0.6 }); }
      if (r.chain === 10) { g.ui.banner('PURE CHAOS!', `x${r.multiplier} multiplier`, { dur: 1.6 }); d.say('K_COMBO', { chance: 0.9 }); }
      if (r.granny && !this.firstCollateral && this.stage !== 'intro') {
        this.firstCollateral = true;
        g.ui.banner("SHE'S THE WEAPON.", "YOU'RE THE AIM.", { granny: true, dur: 2.6, priority: 2 });
        d.say('K_DISCOVERY', { priority: true });
        if (this.stage === 'bait' || this.stage === 'taunt' || this.stage === 'vase') this.stage = 'wreck';
      }
    });
    ev.on('propBroken', ({ rec, source }) => {
      if (rec.id === 'tut_vase') this._vaseBroken();
      if (rec.id === 'glass_cabinet') d.say('G_COLLATERAL', { priority: true, queue: true });
      if (rec.id === 'hall_clock') d.say('G_CLOCK', { priority: true, queue: true });
      if (rec.kind === 'mirror') d.say('G_MIRROR', { chance: 0.8 });
      if (rec.id === 'living_piano') d.say('G_PIANO', { chance: 0.9 });
      if (rec.kind === 'broom') d.say('G_BROOM', { chance: 0.9 });
      if (rec.kind === 'window') d.say(source?.startsWith('granny') ? 'G_WINDOW' : 'K_WINDOW', { chance: source?.startsWith('granny') ? 0.6 : 0.45 });
      if (rec.id === 'cons_cakestand') d.say('G_TEAPARTY', { priority: true, queue: true });
      if (rec.kind === 'table' && source?.startsWith('granny')) d.say('G_TABLE', { chance: 0.4 });
    });
    ev.on('breakSound', ({ material, pos, tier }) => {
      const big = tier === 'fixture' || tier === 'structural';
      const name = material === 'glass' ? (big ? 'glass_crash' : 'glass') : material === 'ceramic' ? 'ceramic' : material === 'metal' ? 'metal'
        : material === 'paper' ? 'paper' : material === 'plant' || material === 'fabric' ? 'paper' : big ? (Math.random() < 0.4 ? 'wood_crash' : 'woodbig') : 'wood';
      a?.play(name, { pos, volume: big ? 1.2 : 0.9, minGap: 0.04 });
      if (big) g.followCam.addShake(0.12, 0.25);
    });
    ev.on('grannySpotted', () => d.say('G_FIND', { chance: 0.6 }));
    ev.on('grannyChase', () => {
      const r = g.rage.value;
      const catHigh = g.cat.position.y - g.granny.position.y > 0.6;
      if (catHigh && Math.random() < 0.5) d.say('G_CHASE_01', { chance: 0.6 });
      else d.say(r > 60 && Math.random() < 0.4 ? 'G_CHASE_03' : 'G_CHASE_02', { chance: 0.45 });
    });
    ev.on('grannyWindup', ({ type }) => {
      a?.play('whoosh', { pos: g.granny.position, volume: 0.6, rate: 0.6 });
      if (type === 'bigaxe') { a?.play('magic', { pos: g.granny.position, volume: 1 }); return; }
      if (!this.flags.firstThrow) { this.flags.firstThrow = true; d.say('K_THROW1', { priority: true }); return; }
      d.say(type === 'axe' || type === 'spear' ? 'G_THROW_AXE' : 'G_THROW', { chance: 0.6 });
      if (Math.random() < 0.15) d.say('G_SPELL', { chance: 1 });
    });
    ev.on('grannyRelease', () => a?.play('whoosh', { pos: g.granny.position, volume: 1.0, rate: 0.9 }));
    ev.on('projectileImpact', ({ proj, point, owner }) => {
      a?.play(proj.type === 'teapot' || proj.type === 'plate' ? 'ceramic' : 'metal', { pos: point, volume: 1.0 });
      a?.play('thud', { pos: point, volume: 0.8 });
      if (owner?.kind === 'static' && proj.T.heavy) d.say('G_MISS', { chance: 0.3 });
    });
    ev.on('catDodged', () => { g.rage.add(5); d.say(Math.random() < 0.5 ? 'K_DODGE' : 'K_MISSED', { chance: 0.18 }); });
    ev.on('projectileHitCat', () => { a?.play('meow_annoyed', { pos: g.cat.position, volume: 0.9 }); g.ui.flash('#ff3a2a', 0.25); });
    ev.on('catStunned', () => {
      a?.play('bell', { pos: g.cat.position, volume: 0.7, rate: 0.8 });
      a?.play('thud', { pos: g.cat.position, volume: 0.6 });
      g.followCam.addShake(0.18, 0.3);
      g.ui.banner('STUNNED!', 'Shake it off — she is coming for you', { granny: true, dur: 1.8, priority: 1 });
      // one reaction per hit (queuing both outlasted the 2 s stun): her gloat or his daze
      d.say(Math.random() < 0.55 ? 'G_STUN' : 'K_STUNNED', { priority: true });
    });
    ev.on('catCaught', () => {
      a?.play('meow_annoyed', { pos: g.cat.position, volume: 1 });
      a?.play('witch_cackle', { pos: g.granny.position, volume: 0.9 });
      // after the tutorial a catch ends the run: the cauldron (playtest 3)
      if (this._catchIsFatal()) { this.beginCaughtEnding(); return; }
      // tutorial grace: a toss, a penalty and a warning of what comes next
      const penalty = g.score.caught();
      g.rage.add(-8);
      g.ui.flash('#000', 0.5);
      g.ui.popup(g.cat.position.clone().add(V(0, 0.6, 0)), `CAUGHT! -${penalty}`, 'big');
      g.ui.banner('CAUGHT!', "Next time it's the cauldron", { granny: true, dur: 2.4, priority: 2 });
      d.say('G_CAUGHT', { priority: true });
      setTimeout(() => d.say('K_CAUGHT', { queue: true }), 1600);
    });
    ev.on('catTossed', () => { g.ui.flash('#fff', 0.35); a?.play('whoosh', { volume: 0.6 }); if (Math.random() < 0.2) d.say('K_REVIEW', { chance: 1 }); });
    ev.on('catHide', () => { a?.play('paper', { pos: g.cat.position, volume: 0.6 }); d.say('K_HIDE', { chance: this.flags.hid ? 0.12 : 0.6 }); this.flags.hid = true; });
    ev.on('grannySearchSpot', () => d.say(Math.random() < 0.5 ? 'G_SEARCH' : 'G_LOST', { chance: 0.6 }));
    ev.on('grannyFoundCat', () => d.say('G_FIND', { priority: true }));
    ev.on('grannyHeardTaunt', () => {
      if (this.lastTauntHiss) { this.lastTauntHiss = false; d.say('G_HISS', { chance: 0.7 }); }
      else if (!this.flags.meowLine) { this.flags.meowLine = true; d.say('G_MEOW', { priority: true }); }
      else d.say(Math.random() < 0.5 ? 'G_RETORT' : 'G_MEOW', { chance: 0.35 });
      if (this.stage === 'taunt') this._toBait();
    });
    ev.on('catTaunt', ({ pos, hiss }) => {
      this.lastTauntHiss = !!hiss;
      // one sound per taunt (playtest 4: the hiss and a meow played together)
      if (hiss) { a?.play('hiss', { pos, volume: 0.7, jitter: 0.08 }); this.hissT = g.time; } // a recorded hiss (playtest 4)
      else a?.play(Math.random() < 0.6 ? 'meow_taunt' : 'meow_short', { pos, volume: 1, jitter: 0.1 });
      d.say('K_TAUNT', { chance: 0.08 });
    });
    ev.on('catSwipe', () => a?.play('swipe', { pos: g.cat.position, volume: 0.5 }));
    ev.on('catPounce', () => a?.play('cat_pounce', { pos: g.cat.position, volume: 0.85, jitter: 0.06 }));
    ev.on('catJump', ({ leap }) => a?.play('cat_jump', { pos: g.cat.position, volume: leap ? 1.0 : 0.8, jitter: 0.1 }));
    ev.on('catLand', ({ speed, height, onto }) => {
      if (onto) a?.play('tap', { pos: g.cat.position, volume: 0.35, rate: 0.7 });
      else if (speed > 3 || height > 0.6) a?.play('thud', { pos: g.cat.position, volume: Math.min(0.6, Math.max(speed, height * 5) * 0.06), rate: 1.6 });
      if (height > 1.4) g.fx.dust(g.cat.position.clone().setY(g.cat.position.y + 0.05), 6, { size: 0.25, spread: 0.5 });
    });
    ev.on('catStep', ({ speed, crouch, gait }) => a?.play('tap', { pos: g.cat.position, volume: crouch ? 0.06 : 0.08 + speed * 0.025 + (gait === 'Gallop' ? 0.05 : 0), minGap: 0.05 }));
    // Tom-and-Jerry skids, scrabbles and launches
    ev.on('catSkid', () => { a?.play('skitter', { pos: g.cat.position, volume: 0.7, minGap: 0.1 }); a?.play('scratch', { pos: g.cat.position, volume: 0.35, rate: 1.3 }); });
    ev.on('catScrabble', () => {
      a?.play('skitter', { pos: g.cat.position, volume: 0.45, minGap: 0.12, jitter: 0.25 });
      const p = g.cat.position;
      g.fx.dust(new THREE.Vector3(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.04, p.z + (Math.random() - 0.5) * 0.3), 1, { size: 0.12, spread: 0.15, life: 0.6 });
    });
    ev.on('catLaunch', () => { a?.play('whoosh', { pos: g.cat.position, volume: 0.45, rate: 1.7 }); if (g.cat.lastWasDrift) d.say('K_SKID', { chance: 0.12 }); });
    ev.on('catLeap', ({ plan }) => { if (plan?.edge?.rise > 1.0 || plan?.climb) setTimeout(() => d.say('K_LEAP', { chance: 0.15 }), 700); });
    // idle life: Komur comments on what he's doing when nobody is chasing him — now and then, not every fidget
    // (playtest 3: he talked too much; Dialogue also keeps 14 s between his non-priority lines)
    const IDLE_LINES = { Groom: ['K_GROOM', 0.35], Sniff: ['K_IDLE_SNIFF', 0.35], ChaseTail: ['K_IDLE_TAIL', 0.35], ChaseTailEnd: ['K_IDLE_TAIL2', 0.4],
      Stretch: ['K_IDLE_STRETCH', 0.35], LookAround: ['K_IDLE_LOOK', 0.3], SitDown: ['K_IDLE_SIT', 0.4], LieDown: ['K_IDLE_LOAF', 0.5] };
    ev.on('catIdleAnim', ({ name }) => {
      if (name === 'Nudge') { setTimeout(() => { if (g.cat.lastFidget === 'Nudge') d.say('K_IDLE_NUDGE', { chance: 0.4 }); }, 950); return; }
      const l = IDLE_LINES[name];
      if (l && d.say(l[0], { chance: l[1] })) this.idleQuipT = g.time;
    });
    ev.on('catHopDown', () => a?.play('swipe', { pos: g.cat.position, volume: 0.2, rate: 0.5 }));
    // the cat reacts to the world: crashes make it jump, Grandma spotting it gets a hiss
    ev.on('propBroken', ({ rec, source }) => {
      const big = rec.meta.tier === 'fixture' || rec.meta.tier === 'structural' || (rec.meta.score ?? 0) >= 400;
      if (!big || !source?.startsWith('granny')) return;
      const dist = rec.group.position.distanceTo(g.cat.position);
      if (dist < 4.5 && g.time - (this.startleT ?? -99) > 7 && g.cat.react('startle')) {
        this.startleT = g.time;
        if (Math.random() < 0.25) setTimeout(() => (Math.random() < 0.6 ? d.say('K_STARTLE', { chance: 1 }) : d.sayText('K', Math.random() < 0.5 ? 'Not me. Probably.' : 'My whiskers! Was that necessary?')), 700);
      }
    });
    ev.on('grannySpotted', () => {
      if (g.cat.position.distanceTo(g.granny.position) < 7 && g.time - (this.hissT ?? -99) > 10 && g.cat.react('hiss')) {
        this.hissT = g.time;
        a?.play('hiss', { pos: g.cat.position, volume: 0.6 });
      }
    });
    ev.on('catTossed', () => setTimeout(() => g.cat.react('shake'), 450));
    ev.on('catStumble', () => a?.play('meow_annoyed', { pos: g.cat.position, volume: 0.6, rate: 1.15 }));
    ev.on('catSinged', () => { if (!this.flags.singed) { this.flags.singed = true; d.sayText('K', 'Hot. Hot! Not hot. HOT.'); } });
    ev.on('catRescued', () => d.say('K_FALL', { chance: 1 }));
    ev.on('catMantle', () => a?.play('scratch', { pos: g.cat.position, volume: 0.25, rate: 1.4 }));
    ev.on('grannyTantrum', () => { d.say('G_CIRCUS', { chance: 0.7 }); });
    ev.on('noise', (e) => { if (e.kind === 'stomp') { a?.play('stomp', { pos: e.pos, volume: 1.4 }); a?.play('rumble', { pos: e.pos, volume: 0.8 }); } });
    ev.on('finalWindup', () => {
      if (!this.flags.finalLine) { this.flags.finalLine = true; d.say('G_FINAL_ATTACK', { priority: true }); setTimeout(() => d.say('K_BEFORE_FINAL', { queue: true }), 1300); }
      else d.say('G_THROW_AXE', { chance: 0.5 });
      g.ui.banner('DODGE!', 'Let the axe find the brace', { granny: true, dur: 1.4, priority: 2 });
    });
    ev.on('finaleUnlocked', () => {
      g.ui.banner('THE LAST SUPPORT IS CRACKING', 'Make her MISS!', { granny: true, dur: 3.2, priority: 2 });
      a?.play('sting', { volume: 0.8, jitter: 0 });
      d.say('G_MAX_RAGE', { queue: true, gap: 0, maxWait: 6 });
    });
    // Grandma's throw hurt a weak point without finishing it: egg her on (voiced, now and then)
    ev.on('weakPointDamaged', () => d.say('K_FRAY', { queue: true, maxWait: 3, lineGap: 20 }));
    ev.on('setpiecePrimed', ({ id, key }) => {
      a?.play('magic', { pos: g.cat.position, volume: 0.6 });
      if (id === 'SP02' && key === 'ember') g.ui.banner('A SPARK OF GENIUS', 'Now get Grandma to bash the stove', { dur: 2.2 });
    });
  }

  // ------------------------------------------------------------------ intro
  startIntro() {
    const g = this.game;
    this.stage = 'intro';
    const cat = g.cat, gr = g.granny;
    cat.teleport(V(-4.5, 0.02, 7.6), Math.PI);
    cat.mode = 'cinematic';
    gr.setState('scripted');
    gr.teleport(V(-4.3, 0, 1.9), Math.PI);
    gr.scriptAnim = true;
    gr.play('Cast', 0.2, { timeScale: 0.8 });
    gr.setBroom(false); // she casts with bare hands (the broom clipped through them); she fetches it after the intro
    g.house.setFrontDoor?.(true);
    const walk = (from, to, dur) => {
      const st = { t: 0 };
      const speed = from.distanceTo(to) / dur;
      // playback matched to the walk-in speed so the paws don't slide
      if (speed < 2.0) cat.play('Walk', 0.2, { timeScale: cat.gaitScale('Walk', speed) });
      else cat.play('Trot', 0.2, { timeScale: cat.gaitScale('Trot', speed) });
      this.introWalk = (dt) => {
        st.t += dt;
        const k = Math.min(1, st.t / dur);
        const p = from.clone().lerp(to, k);
        cat.teleport(p, Math.atan2(to.x - from.x, to.z - from.z));
        if (k >= 1) { this.introWalk = null; cat.play('Idle', 0.25); }
      };
    };
    const lookAtCat = () => { gr.yaw = Math.atan2(cat.position.x - gr.position.x, cat.position.z - gr.position.z); };
    // timed to the recorded lines (G_INTRO_01 4.6 s, G_INTRO_02 5.4 s, K_INTRO_01 2.0 s): a priority line cuts
    // off the one before it, so each starts only once the previous has finished
    g.startCinematic('intro', [
      { t: 0, fn: () => { g.setShot(V(-2.4, 1.6, 8.0), V(-4.5, 0.6, 6.0), 60, true); this.thunder(true); walk(V(-4.5, 0.02, 7.6), V(-4.5, 0.02, 5.8), 2.6); } },
      // skipping runs every remaining step at once: lines, the meow and the door slam must stay silent then
      { t: 0.4, fn: () => g.dialogue.say('G_INTRO_01', { priority: true }), skip: () => {} },
      { t: 2.8, fn: () => { g.setShot(V(-3.3, 1.25, 1.4), V(-4.5, 0.5, 4.8), 55, true); walk(V(-4.5, 0.02, 5.8), V(-4.5, 0.02, 4.1), 1.6); } },
      { t: 4.8, fn: () => { gr.play('Angry', 0.15, { once: true, timeScale: 1.2 }); lookAtCat(); } },
      { t: 5.05, fn: () => { g.setShot(V(-4.45, 0.45, 3.6), V(-4.3, 1.55, 1.9), 58, true); g.dialogue.say('G_INTRO_02', { priority: true }); }, skip: () => {} },
      // he meows at her face to face: turned to this shot's camera (with yaw 0 he faced the front door, his back to
      // the lens — playtest 4)
      { t: 10.45, fn: () => { g.setShot(V(-3.9, 0.5, 3.1), V(-4.5, 0.32, 4.1), 50, true); cat.yaw = Math.atan2(-3.9 - cat.position.x, 3.1 - cat.position.z); cat.play('Meow', 0.1, { once: true }); g.audio?.play('meow_taunt', { pos: cat.position, volume: 1 }); }, skip: () => {} },
      { t: 10.9, fn: () => g.dialogue.say('K_INTRO_01', { priority: true }), skip: () => {} },
      { t: 12.0, fn: () => { g.house.setFrontDoor?.(false, true); }, skip: () => g.house.setFrontDoor?.(false, false) },
      // "Sounds like a challenge." — and he bolts past her, out through the hall door; she grabs at air.  Play
      // starts in the dining room, well away from her (playtest 4: it began right next to her, no room to learn)
      { t: 12.9, fn: () => {
        g.setShot(V(-5.7, 1.3, 2.7), V(-2.6, 0.6, 3.2), 56, true);
        this._introDash();
        lookAtCat();
        gr.play('PickUp', 0.12, { once: true, timeScale: 1.7 });
        g.audio?.play('skitter', { pos: cat.position, volume: 0.9 });
        g.audio?.play('whoosh', { pos: gr.position, volume: 0.6, rate: 0.8 });
      }, skip: () => {} },
      { t: 13.75, fn: () => { gr.yaw = Math.atan2(-2.0 - gr.position.x, 3.0 - gr.position.z); gr.play('Angry', 0.15, { once: true, timeScale: 1.4 }); }, skip: () => {} },
      { t: 14.6, fn: () => {}, skip: () => g.dialogue.hush() },
    ], () => this._endIntro(), { skippable: true });
  }

  /** The intro's last shot: Komur gallops across the foyer and out through the hall door. */
  _introDash() {
    const cat = this.game.cat;
    const pts = [cat.position.clone(), V(-2.3, 0.02, 3.05), V(-1.25, 0.02, 2.55), V(-1.1, 0.02, 1.0)];
    const speed = 4.4;
    cat.play('Gallop', 0.08, { timeScale: cat.gaitScale('Gallop', speed) });
    let seg = 0, s = 0, yaw = cat.yaw;
    this.introWalk = (dt) => {
      s += speed * dt;
      while (seg < pts.length - 1 && s > pts[seg].distanceTo(pts[seg + 1])) { s -= pts[seg].distanceTo(pts[seg + 1]); seg++; }
      if (seg >= pts.length - 1) { this.introWalk = null; return; }
      const a = pts[seg], b = pts[seg + 1];
      const want = Math.atan2(b.x - a.x, b.z - a.z);
      yaw += (((want - yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * Math.min(1, dt * 14);
      cat.teleport(a.clone().lerp(b, s / a.distanceTo(b)), yaw);
    };
  }

  _endIntro() {
    const g = this.game;
    this.introWalk = null;
    g.cat.mode = 'normal';
    // he got away: play starts in the dining room facing the sideboard with Grandma's GOOD vase on it, the camera
    // with its full distance behind him (DECISIONS #38) and Grandma back in the foyer — the tutorial happens out of
    // her reach.  A hard cut from the intro's last shot hides the move.
    const start = V(2.3, 0.02, -2.2);
    const yaw = Math.PI;
    g.cat.teleport(start, yaw);
    g.followCam.snapBehind(yaw);
    g.followCam.pitch = -0.32;
    g.followCam.cut(g.cat);
    g.house.setFrontDoor?.(false, false);
    const gr = g.granny;
    gr.scriptAnim = false;
    // she lost him at the hall door and goes looking: patrolling, so she hears and sees him from the start (on her
    // scripted errand she ignored everything until the vase broke — playtest 4)
    gr.teleport(V(-3.6, 0, 2.6), Math.atan2(-2.0 + 3.6, 3.0 - 2.6));
    gr.setState('patrol');
    gr.broomDue = true;
    this.stage = 'vase';
    this.stageT = 0;
    this.tut = 'move';
    this.tutFrom = start.clone();
    g.ui.tutorialHint(true);
    // no rain loop: its noise read as a constant buzz (playtest 3)
  }

  /** TAB during the tutorial: straight to the wreck (playtest 4: "a proper skippable tutorial"). */
  skipTutorial() {
    const g = this.game;
    if (!['vase', 'taunt', 'bait'].includes(this.stage) || g.state !== 'playing') return false;
    this.stage = 'wreck';
    this.stageT = 0;
    this.tut = null;
    this.tutPrompt = null;
    this.setMarker(null);
    g.ui.tutorialHint(false);
    g.rage.setFloor(27);
    if (!g.granny.active) g.granny.setState('patrol');
    g.ui.banner('TUTORIAL SKIPPED', 'Wreck the house — and get Grandma to do the heavy lifting', { dur: 2.2, priority: 1 });
    return true;
  }

  _vaseBroken() {
    const g = this.game;
    g.dialogue.say('K_FIRST_BREAK', { priority: true });
    setTimeout(() => g.dialogue.say('G_FIRST_BREAK', { priority: true }), 2800); // after Komur's 2.6 s line
    g.rage.add(18);
    const gr = g.granny;
    const vase = g.destruction.get('tut_vase');
    gr.noiseTarget = vase ? vase.group.position.clone().setY(0) : g.cat.position.clone();
    if (gr.state === 'scripted' || gr.state === 'scriptMove' || gr.state === 'patrol') gr.setState('investigate');
    this.stage = 'taunt';
    this.stageT = 0;
  }

  _toBait() {
    if (this.stage !== 'taunt') return;
    this.stage = 'bait';
    this.stageT = 0;
    this.game.rage.setFloor(27);
    this.game.granny.throwCd = Math.min(this.game.granny.throwCd, 1.5);
  }

  // ------------------------------------------------------------------ per-frame
  update(dt) {
    const g = this.game;
    if (this.introWalk) this.introWalk(dt);
    if (this.caughtTick) this.caughtTick(dt);
    if (this.outroTick) this.outroTick(dt);
    if (g.state !== 'playing' && g.state !== 'cinematic') return;
    this.elapsed += g.state === 'playing' ? dt : 0;
    this.stageT = (this.stageT ?? 0) + dt;
    g.ui.tutorialHint(['vase', 'taunt', 'bait'].includes(this.stage));
    this._objectives();
    this._interactions();
    if (g.state === 'playing') this._proximityHints();
    this._ambience(dt);
    this._grannyFeet(dt);
    // grannie's scripted errand finished -> start hunting
    const gr = g.granny;
    if (gr.state === 'scripted' && gr.stateData?.done && this.stage !== 'intro' && this.stage !== 'outro' && !g.sequence) gr.setState('patrol');
    if (gr.state === 'scriptMove' && gr.stateT > 9) gr.setState('patrol');
    // errand over (or cut short by the vase): she summons her broom back with a flourish
    if (gr.broomDue && gr.active && gr.state !== 'scriptMove') { gr.broomDue = false; gr.setBroom(true, true); }
    // rage phase lines
    const up = g.rage.checkPhaseUp();
    // rage lines wait their turn: they must never cut off a set piece's own line mid-sentence
    if (up === 4) { g.dialogue.say('G_MAX_RAGE', { queue: true, gap: 0 }); g.ui.banner('MELTDOWN', 'Grandma has lost it', { granny: true, dur: 2 }); }
    else if (up === 3) { g.dialogue.say('K_ANGER', { chance: 1 }); g.ui.banner('FURIOUS', 'She found the axes', { granny: true, dur: 1.8 }); }
    else if (up === 2) g.ui.banner('ENRAGED', 'The good china is flying', { granny: true, dur: 1.6 });
    // marker bob
    if (this.marker.visible) {
      const p = this.marker.userData.pos;
      this.marker.position.set(p.x, p.y + 0.35 + Math.sin(g.time * 3) * 0.06, p.z);
      this.marker.rotation.y += dt * 2;
    }
    // a long chase: Komur's aside at 6 s, Grandma running out of breath at 12 s (each at most once a minute)
    if (gr.state === 'chase' && gr.stateT > 6 && !this.flags.chaseQuip) { this.flags.chaseQuip = true; g.dialogue.say('K_CHASE', { chance: 0.5 }); setTimeout(() => { this.flags.chaseQuip = false; }, 60000); }
    if (gr.state === 'chase' && gr.stateT > 12 && !this.flags.pantQuip) { this.flags.pantQuip = true; g.dialogue.say('G_PANT', { chance: 0.8 }); setTimeout(() => { this.flags.pantQuip = false; }, 60000); }
    // left alone for a while: a bored aside now and then (each line at most once per 75 s via Dialogue)
    if (g.state === 'playing' && this.stage !== 'intro' && g.cat.idleTime > 12 && g.time - (this.idleQuipT ?? -99) > 30) {
      const pool = ['K_IDLE_BORED', 'K_IDLE_SCIENCE', 'K_IDLE_TIDY', 'K_IDLE_GRANNY'];
      if (g.dialogue.say(pool[Math.floor(Math.random() * pool.length)], { chance: 0.6 })) this.idleQuipT = g.time;
      else this.idleQuipT = g.time - 20; // try again in a while
    }
    this._questPrompt();
  }

  _objectives() {
    const g = this.game;
    const ui = g.ui;
    const sp = g.setPieces;
    const s = g.score;
    const K = g.keys; // the keyboard's names, or the touch buttons'
    switch (this.stage) {
      case 'vase': {
        // the tutorial's first steps (playtest 4): move, leap up, swipe the vase; then meow (taunt) and dodge (bait)
        const vase = g.destruction.get('tut_vase');
        const at = vase && !vase.broken ? vase.group.position : null;
        const cat = g.cat;
        if (!this.tut) this.tut = 'swipe';
        if (this.tut === 'move') {
          ui.objective(`You got away! Look around — ${K.moveHow}`);
          this.tutPrompt = `<b>${K.move}</b> move · <b>${K.look}</b> look`;
          this.setMarker(null);
          if (cat.position.distanceTo(this.tutFrom ?? cat.position) > 1.2) { this.tut = 'leap'; this.stageT = 0; }
        } else if (this.tut === 'leap') {
          ui.objective(`Leap onto the sideboard — walk up to it and ${K.press} ${K.jump} (the amber ring shows where you land)`);
          if (at) this.setMarker(at.clone().add(V(-0.5, 0.3, 0.07))); // the clear middle of the sideboard
          this.tutPrompt = cat.grounded ? `<b>${K.jump}</b> leap` : null;
          if (cat.grounded && cat.position.y > 0.6) { this.tut = 'swipe'; this.stageT = 0; }
        } else {
          ui.objective(`Now swipe Grandma's GOOD vase off the sideboard — ${K.swipe}`);
          if (at) this.setMarker(at.clone().add(V(0, 0.6, 0)));
          const d = at ? cat.position.distanceTo(at) : 99;
          if (!cat.grounded || d > 2.2) this.tutPrompt = null;
          else this.tutPrompt = cat.position.y > 0.4 ? `<b>${K.swipe}</b> paw swipe` : `<b>${K.jump}</b> jump up first`;
        }
        if (this.stageT > 25 && at) this.tutPrompt = `<b>${K.move}</b> move · <b>${K.jump}</b> jump · <b>${K.swipe}</b> swipe`;
        break;
      }
      case 'taunt':
        this.setMarker(null);
        ui.objective(K.meow === 'F' ? 'Grandma is coming. Press F to MEOW at her and make her angrier' : 'Grandma is coming. Tap MEOW at her and make her angrier');
        this.tutPrompt = this.stageT < 8 ? `<b>${K.meow}</b> meow / taunt` : null;
        if (g.rage.value >= 25 || this.stageT > 22) this._toBait();
        break;
      case 'bait':
        ui.objective('When she winds up a throw — DODGE! Let her break her own stuff');
        this.tutPrompt = this.stageT < 7 ? `<b>${K.pounce}</b> pounce · <b>${K.sprint}</b> sprint` : null;
        if (this.stageT > 40) { this.stage = 'wreck'; this.stageT = 0; }
        break;
      case 'wreck': {
        this.tutPrompt = null;
        const n = sp.count;
        const ready = finaleReady({ ruinPercent: s.ruinPercent, setpiecesDone: n, rage: g.rage.value, elapsed: this.elapsed });
        if (ready) { this._toFinale(); break; }
        const hint = this._nextHint();
        ui.objective(`Wreck the house · Disasters ${n}/4 · Doom ${s.ruinPercent}%${hint ? ' — ' + hint : ''}`);
        if (this.stageT > 70 && n < 4) this.setMarker(this._hintTarget()); else this.setMarker(null);
        break;
      }
      case 'finale': {
        ui.objective('THE ROOF BRACE (upstairs gallery) is cracking — stand near it, taunt, and make Grandma MISS!');
        this.setMarker(V(2.25, F2 + 2.9, 3.0));
        this._finaleLogic();
        break;
      }
      default: break;
    }
  }

  _nextHint() {
    const sp = this.game.setPieces;
    const order = [['SP01', 'claw the CHANDELIER rope on the gallery, then bait a throw at it'],
      ['SP02', 'knock the KITCHEN oil lamp down, then make Grandma smash the stove'],
      ['SP03', 'scratch the WARDROBE upstairs, then bait a heavy throw at it'],
      ['SP10', 'claw the PLANT CHANDELIER rope in the conservatory, then bait a throw at it']];
    const t = Math.floor(this.elapsed / 14) % order.length;
    for (let k = 0; k < order.length; k++) {
      const [id, txt] = order[(t + k) % order.length];
      if (!sp.done[id]) return txt;
    }
    return 'keep smashing until the house is DOOMED';
  }

  _hintTarget() {
    const sp = this.game.setPieces;
    if (!sp.done.SP01) return V(2.4, F2 + 1.2, -0.5);
    if (!sp.done.SP02) return V(-3.45, 1.9, -4.7);
    if (!sp.done.SP03) return V(-5.1, F2 + 2.4, 1.05);
    if (!sp.done.SP10) return V(7.33, 1.25, -1.2);
    return null;
  }

  _toFinale() {
    const g = this.game;
    this.stage = 'finale';
    this.stageT = 0;
    g.setPieces.unlockFinale();
    g.rage.setFloor(90);
    g.rage.add(100);
    this.finaleT = 0;
  }

  _finaleLogic() {
    const g = this.game;
    const gr = g.granny, cat = g.cat;
    if (g.setPieces.done.SP04 || g.setPieces.busy) return;
    this.finaleT += 1 / 60;
    const brace = V(2.25, F2, 3.0);
    const near = cat.position.distanceTo(brace) < 5.5 && Math.abs(cat.position.y - F2) < 1.2;
    if (near && gr.active && gr.seesCat && !['windup', 'holding', 'catch', 'react', 'stunned'].includes(gr.state) && gr.throwCd <= 0.5) {
      gr.lastSeen = cat.position.clone();
      gr.setState('windup', {}); // _beginThrow upgrades this to the enchanted axe
    }
    // keep her coming: if she can't find the cat near the brace for a while, bring her within sight (off-camera)
    if (near && !gr.seesCat) {
      this.finaleWait = (this.finaleWait ?? 0) + 1 / 60;
      if (this.finaleWait > 9 && ['patrol', 'search', 'investigate', 'chase'].includes(gr.state)) {
        this.finaleWait = 0;
        const spot = gr.position.y > 1.6 ? V(1.9, F2, -2.5) : V(4.6, 0, 0.9);
        gr.teleport(spot);
        gr.lastSeen = cat.position.clone(); gr.lastSeenT = g.time;
        gr.setState('chase');
      }
    } else this.finaleWait = 0;
  }

  _interactions() {
    const g = this.game;
    const cat = g.cat;
    if (g.state !== 'playing' || cat.mode === 'caught' || cat.mode === 'cinematic') { g.ui.prompt(this.tutPrompt ?? null); return; }
    const lv = g.level;
    let prompt = this.tutPrompt ?? null;
    this.nearHide = null; this.nearScratch = null;
    if (cat.hidden) { prompt = `Hidden ${cat.hideSpot?.label ?? ''} · <b>move</b> to leave`; }
    else {
      for (const t of lv.scratchTargets) {
        if (!t.valid()) continue;
        if (Math.hypot(t.pos.x - cat.position.x, t.pos.z - cat.position.z) < t.radius && Math.abs(t.pos.y - cat.position.y) < 0.7) { this.nearScratch = t; break; }
      }
      if (!this.nearScratch) for (const h of lv.hideSpots) {
        if (Math.hypot(h.pos.x - cat.position.x, h.pos.z - cat.position.z) < h.radius && Math.abs(h.pos.y - cat.position.y) < 0.4) { this.nearHide = h; break; }
      }
      if (this.nearScratch) {
        const t = this.nearScratch;
        prompt = cat.scratching === t ? `Scratching… ${Math.round(Math.min(1, (t.progress ?? 0) / t.time) * 100)}%` : `<b>${g.keys.holdUse}</b> ${t.label.replace('Hold E: ', '')}`;
      } else if (this.nearHide) prompt = `<b>${g.keys.use}</b> hide ${this.nearHide.label}`;
    }
    g.ui.prompt(prompt);
  }

  onInteract() {
    const g = this.game, cat = g.cat;
    if (cat.hidden) { cat.unhide(); return; }
    if (this.nearScratch) { cat.startScratch(this.nearScratch); return; }
    if (this.nearHide) { cat.hide(this.nearHide); return; }
    // generic scratch: claw whatever is in front
    g.audio?.play('scratch', { pos: cat.position, volume: 0.6 });
    const probe = cat.frontProbe(0.35, 0.3);
    g.destruction.catSwipe(cat, probe.center, probe.radius, probe.dir);
  }

  onScratching(target, dt) {
    const g = this.game;
    target.progress = (target.progress ?? 0) + dt;
    this.scratchSnd = (this.scratchSnd ?? 0) - dt;
    if (this.scratchSnd <= 0) { this.scratchSnd = 0.42; g.audio?.play('scratch', { pos: g.cat.position, volume: 0.7 }); g.fx.splinterBurst(g.cat.position.clone().add(V(0, 0.6, 0)), 2, { size: 0.03, speed: 1 }); }
    g.events.emit('noise', { pos: g.cat.position.clone(), radius: 3.5, source: 'cat_scratch', kind: 'scratch' });
    if (target.progress >= target.time) {
      target.progress = 0;
      g.cat.stopScratch();
      target.onComplete();
      g.ui.popup(g.cat.position.clone().add(V(0, 0.7, 0)), 'WEAKENED!', 'big');
    }
  }

  _proximityHints() {
    const g = this.game, c = g.cat.position, sp = g.setPieces;
    const near = (x, y, z, r) => Math.hypot(c.x - x, c.z - z) < r && Math.abs(c.y - y) < 1.4;
    // voiced quest prompts: each once, when nobody is talking (retried until then), none after its set piece
    const hint = (key, id) => { if (this.flags[key] || g.dialogue.busy) return; this.flags[key] = true; g.dialogue.say(id, { priority: true }); };
    if (this.stage === 'intro' || this.stage === 'vase') return;
    if (!sp.done.SP01 && (near(4.4, 0, -0.5, 2.2) || near(2.3, F2, -0.5, 2.5))) hint('hChand', 'H_CHAND');
    if (!sp.done.SP03 && near(-5.1, F2, 1.6, 2.6)) hint('hWard', 'H_WARD');
    if (!sp.done.SP02 && near(-3.0, 0, -4.4, 2.2)) hint('hLamp', 'H_LAMP');
    if (!sp.done.SP02 && near(-6.3, 0, -2.6, 1.8)) hint('hStove', 'H_STOVE');
    if (sp.state.finaleUnlocked && near(2.25, F2, 3.0, 3)) hint('hBrace', 'H_BRACE');
    if (!sp.done.SP10 && (near(9.8, 0, 0.2, 2.0) || near(7.6, 0, -1.2, 1.6))) hint('hGlass', 'H_GLASS');
  }

  /** Quest prompts: when no disaster has happened for a while, Komur muses (voiced) about the next one that's
   *  still standing.  Never over someone else's line; at most every 45 s; none once all four are done. */
  _questPrompt() {
    const g = this.game, sp = g.setPieces, s = g.score;
    if (g.state !== 'playing' || this.stage !== 'wreck' || this.stageT < 25 || g.dialogue.busy) return;
    if (g.time - (this.promptT ?? -99) < 45 || s.time - (s.lastSetpieceTime ?? -99) < 40) return;
    const order = [['SP01', 'H_CHAND'], ['SP02', sp.state.sp02Ember ? 'H_STOVE' : 'H_LAMP'], ['SP03', 'H_WARD'], ['SP10', 'H_GLASS']];
    const t = Math.floor(this.elapsed / 14) % order.length; // the same rotation as the objective line's hint
    const d = g.dialogue;
    for (let k = 0; k < order.length; k++) {
      const [id, line] = order[(t + k) % order.length];
      if (sp.done[id] || d.time - (d.lastLine.get(line) ?? -999) < 60) continue; // done, or just said (proximity)
      if (d.say(line, { priority: true })) this.promptT = g.time;
      return;
    }
  }

  _ambience(dt) {
    const g = this.game;
    this.thunderT -= dt;
    if (this.thunderT <= 0) { this.thunderT = 18 + Math.random() * 22; this.thunder(); }
    this.creakT -= dt;
    const doom = g.score.ruinPercent;
    if (this.creakT <= 0) {
      this.creakT = Math.max(4, 14 - doom * 0.1) + Math.random() * 6;
      const p = V((Math.random() - 0.5) * 12, 3 + Math.random() * 2, (Math.random() - 0.5) * 8);
      g.audio?.play('creak', { pos: p, volume: 0.5 + doom * 0.006 });
      if (doom > 30) g.fx.dust(p, 6, { size: 0.3, up: -0.2, life: 2.5 });
    }
    for (const mark of [25, 50, 75]) {
      if (doom >= mark && !this.doomMarks.has(mark)) {
        this.doomMarks.add(mark);
        g.audio?.play('rumble', { volume: 0.9 });
        g.followCam.addShake(0.2, 0.8);
        g.house.flickerOut?.(0.8);
        if (mark === 50) g.dialogue.say('K_RENO', { chance: 1 });
        if (mark === 75) g.dialogue.say('K_VENT', { chance: 1 });
      }
    }
  }

  thunder(big = false) {
    const g = this.game;
    g.audio?.play('thunder', { volume: big ? 1 : 0.7, jitter: 0.1 });
    this.lightning = 0.45;
  }

  _grannyFeet(dt) {
    const g = this.game, gr = g.granny;
    const sp = gr.speedNow ?? 0;
    if (sp < 0.4 || !gr.grounded) return;
    this.stepAcc += dt * (1.4 + sp * 0.55);
    if (this.stepAcc > 1) {
      this.stepAcc = 0;
      g.audio?.play('stomp', { pos: gr.position, volume: 0.35 + sp * 0.08, minGap: 0.1 });
      if (Math.random() < 0.08) g.audio?.play('creak', { pos: gr.position, volume: 0.3 });
    }
  }

  // ------------------------------------------------------------------ outro + results
  beginOutro() {
    const g = this.game;
    if (this.stage === 'outro' || this.stage === 'caught') return;
    this.stage = 'outro';
    const cat = g.cat, gr = g.granny;
    g.sequence?.finish?.();
    gr.setState('scripted');
    gr.scriptAnim = true;
    gr.teleport(V(-0.6, 0, -8.0), 0); // in the yard, staring at what's left of her house
    gr.play('Sigh', 0.2, { once: true });
    cat.mode = 'cinematic';
    cat.teleport(V(0.25, 0.92, -12.3), Math.PI * 0.9); // on the well's rim
    cat.play('SitDown', 0.2, { once: true });
    // the punchline happens in the garden: a warm key light from the burning house side so both faces read
    g.lightRig.add({ color: 0xffb070, intensity: 16, distance: 9, decay: 1.6, position: V(0.6, 2.6, -9.6), priority: 3 });
    g.lightRig.add({ color: 0x9fb8ff, intensity: 6, distance: 7, decay: 1.6, position: V(-1.6, 2.2, -12.0), priority: 3 });
    g.baseHemi = 0.9;
    // dawn breaks over the wreck (colours and intensities only: the scene's light count never changes)
    const C = (h) => new THREE.Color(h);
    const dawn = {
      bg: [g.scene.background.clone(), C(0x3a3050), C(0xb0705a)], fog: [g.scene.fog.color.clone(), C(0x40303e), C(0x6a4a50)],
      sky: [g.hemi.color.clone(), C(0xc8a0c0), C(0xffc7a0)], ground: [g.hemi.groundColor.clone(), C(0x2e2420), C(0x3a2a22)],
      moon: [g.moon.color.clone(), C(0xd0b0d8), C(0xffb07a)], density: g.scene.fog.density, baseMoon: g.baseMoon,
    };
    const lerp3 = (out, [a, b, c], k) => (k < 0.5 ? out.lerpColors(a, b, k * 2) : out.lerpColors(b, c, (k - 0.5) * 2));
    let t = 0, plumeAcc = 0, hatAcc = 0;
    const head = new THREE.Vector3();
    this.outroTick = (dt) => {
      t += dt; plumeAcc += dt; hatAcc += dt;
      const k = THREE.MathUtils.smoothstep(t, 0.2, 13.0);
      lerp3(g.scene.background, dawn.bg, k); lerp3(g.scene.fog.color, dawn.fog, k);
      lerp3(g.hemi.color, dawn.sky, k); lerp3(g.hemi.groundColor, dawn.ground, k); lerp3(g.moon.color, dawn.moon, k);
      g.scene.fog.density = dawn.density + (0.018 - dawn.density) * k;
      g.baseMoon = dawn.baseMoon + 0.6 * k; g.baseHemi = 0.9 + 0.3 * k;
      // smoke still pouring out of the hole in the roof, and out of Grandma's hat
      while (plumeAcc > 0.13) {
        plumeAcc -= 0.13;
        g.fx.smoke(V(1.8 + Math.random() * 5.0, 6.4 + Math.random() * 1.2, -3.5 + Math.random() * 7), 1, { size: 1.5, life: 4.5, color: [0.17, 0.15, 0.15], rise: 0.9 });
      }
      while (hatAcc > 0.2) {
        hatAcc -= 0.2;
        if (gr.head) { gr.head.getWorldPosition(head); g.fx.smoke(head.add(V(0, 0.45, 0)), 1, { size: 0.22, life: 1.5, color: [0.12, 0.11, 0.11], rise: 0.55 }); }
      }
    };
    // the last of the roof gives way behind her as she stomps
    const lastBeams = () => {
      const beam = woodMat('rough_wood', { tint: 0x9a8070 });
      for (let i = 0; i < 3; i++) {
        const p = V(-1.6 + i * 1.2, 6.5 + i * 0.3, -4.7);
        g.destruction.spawnDebris(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4 * i, i, 0.6)), [2.2, 0.16, 0.22], beam, V(0.3 * (i - 1), -2.5, -2.2), 'wood', 10);
      }
      g.fx.splinterBurst(V(-0.4, 6.2, -5.0), 30, { color: 0x6a4a30, speed: 4 });
      g.audio?.play('collapse', { pos: V(-0.4, 3, -5.5), volume: 1.1, jitter: 0 });
      g.followCam.addShake(0.45, 0.9);
      setTimeout(() => g.fx.dust(V(-0.5, 0.3, -6.0), 30, { size: 0.9, spread: 2.5, life: 2.4 }), 650);
    };
    g.startCinematic('outro', [
      { t: 0, fn: () => { g.setShot(V(3.6, 2.1, -15.8), V(0.6, 3.4, -4.0), 55, true); g.audio?.play('rumble', { volume: 0.8 }); } },
      { t: 0.4, fn: () => { g.house.flickerOut?.(2.6); g.audio?.play('creak', { volume: 0.8 }); } },
      // timed to the recorded lines (G_OUTRO 2.7 s, K_OUTRO 2.1 s, G_MAX_RAGE 3.0 s)
      { t: 2.2, fn: () => { gr.yaw = Math.PI; gr.play('Angry', 0.2, { once: true }); g.setShot(V(-1.2, 1.5, -10.6), V(-0.6, 1.5, -8.0), 50, true); g.dialogue.say('G_OUTRO', { priority: true }); }, skip: () => {} },
      // his line to the camera (on the rim facing the yard he showed it his back — playtest 4); the cuts hide the turns
      { t: 5.1, fn: () => { g.setShot(V(1.4, 1.0, -11.0), V(0.25, 1.15, -12.3), 46, true); cat.yaw = Math.atan2(1.4 - cat.position.x, -11.0 - cat.position.z); cat.play('Groom', 0.3, { once: true }); } },
      { t: 5.6, fn: () => g.dialogue.say('K_OUTRO', { priority: true }), skip: () => {} },
      { t: 7.7, fn: () => cat.play('SmugSit', 0.3) },
      // then he watches her tantrum with us, from the foreground
      { t: 8.4, fn: () => { g.setShot(V(1.9, 1.6, -14.2), V(-0.5, 2.4, -6.0), 52, true); cat.yaw = Math.atan2(gr.position.x - cat.position.x, gr.position.z - cat.position.z); gr.play('Tantrum', 0.15, { once: true, timeScale: 1.2 }); g.dialogue.say('G_MAX_RAGE', { priority: true }); }, skip: () => {} },
      { t: 9.45, fn: lastBeams, skip: () => {} },
      { t: 10.9, fn: () => gr.play('CoverHead', 0.15, { once: true, timeScale: 1.1 }) },
      // crane up over the ruin at dawn, then the title card
      { t: 11.5, fn: () => { g.followCam.cinematic = { pos: V(4.2, 9.5, -16.6), look: V(1.2, 3.2, -3.0), fov: 55, snap: false, speed: 0.7 }; } },
      { t: 12.8, fn: () => { g.ui.endCard(true); g.audio?.play('bell', { volume: 0.5, rate: 0.75 }); g.audio?.play('meow_chirp', { pos: cat.position, volume: 0.8 }); }, skip: () => {} },
      { t: 15.4, fn: () => g.ui.fade(1, 0.9) },
      { t: 16.4, fn: () => {}, skip: () => g.dialogue.hush() },
    ], () => { this.outroTick = null; g.showResults(); }, { skippable: true });
  }

  // ------------------------------------------------------------------ caught: the cauldron ending
  /** A catch ends the run once the tutorial (vase, taunt, bait) is over; before that it's a toss and a warning. */
  _catchIsFatal() { return !['intro', 'vase', 'taunt', 'bait', 'caught', 'outro'].includes(this.stage); }

  beginCaughtEnding() {
    const g = this.game, cat = g.cat, gr = g.granny;
    if (this.stage === 'caught' || this.stage === 'outro') return;
    this.stage = 'caught';
    this.setMarker(null);
    g.score.catchCount++;
    g.events.emit('caughtEnding', {});
    gr.keepHolding = true;
    g.audio?.play('sting', { volume: 0.8, jitter: 0 });
    // beat 1, where it happened: she holds her prize up (one frame of the throw: arm straight out at chest height,
    // bobbing a little), Komur dangling from her hand
    let bob = 0;
    this.caughtTick = (dt) => {
      bob += dt;
      if (gr.currentName === 'Throwing' && gr.current) gr.current.time = 2.15 + Math.sin(bob * 1.8) * 0.035;
      const hp = gr.handWorld(), cp = g.followCam.cinematic?.pos;
      const face = cp ? Math.atan2(cp.x - hp.x, cp.z - hp.z) : gr.yaw + Math.PI; // glaring at the lens
      cat.teleport(V(hp.x, hp.y - 0.45, hp.z), face + Math.sin(bob * 1.3) * 0.3);
    };
    g.startCinematic('caught', [
      { t: 0, fn: () => {
        gr.setBroom(false); gr.pose('Throwing', 2.15);
        // the frame is a deep forward lean: from her right, at chest height, it's a profile of her holding Komur out
        gr.root.rotation.y = gr.yaw; gr.mixer.update(0); gr.root.updateMatrixWorld(true);
        const hp = gr.handWorld();
        const mid = gr.position.clone().lerp(hp, 0.6).setY(gr.position.y + 1.05);
        g.setShot(this._shotAround(mid, 2.4, gr.yaw, [-1.35, -1.0, -1.75, 1.35, 1.0, -0.5, 0.5, Math.PI], 0.04), mid, 52, true);
        g.ui.banner('CAUGHT!', 'Grandma has plans for you', { granny: true, dur: 2.0, priority: 2 });
        g.dialogue.say('G_CAUGHT', { priority: true });
      }, skip: () => {} },
      // timed to the recorded lines (G_CAUGHT 4.4 s, G_CAULDRON 6.6 s, K_CAULDRON 1.6 s): her gloat finishes over
      // the fade, Komur's reply follows her rant, the cackle and the fade come after his punchline
      { t: 3.5, fn: () => g.ui.fade(1, 0.45) },
      // beat 2, the kitchen: dangled over a bubbling cauldron
      { t: 4.0, fn: () => { this._stageCauldron(); g.ui.fade(0, 0.7); } },
      { t: 4.5, fn: () => g.dialogue.say('G_CAULDRON', { priority: true }), skip: () => {} },
      { t: 9.8, fn: () => this._cauldronCloseUp() },
      { t: 10.0, fn: () => g.dialogue.say('K_CAULDRON', { queue: true, maxWait: 3 }), skip: () => {} },
      { t: 12.7, fn: () => { g.audio?.play('witch_cackle', { pos: gr.position, volume: 1 }); g.ui.fade(1, 1.1); }, skip: () => {} },
      { t: 13.9, fn: () => {}, skip: () => g.dialogue.hush() },
    ], () => {
      this.caughtTick = null;
      g.audio?.stopLoop('bubbleLoop');
      g.showResults({ caught: true });
    }, { skippable: true });
  }

  /** A camera spot ~dist from target with a clear view (walls in the way pull it in); tries the offsets from her
   *  facing in order (negative = her right). */
  _shotAround(target, dist, yaw, offs = [-0.55, 0.55, -0.95, 0.95, 0, -1.5, 1.5, -2.3, 2.3, Math.PI], up = 0.2) {
    const ph = this.game.physics;
    let best = null, bestD = -1;
    for (const off of offs) {
      const a = yaw + off;
      const dir = V(Math.sin(a), up, Math.cos(a)).normalize();
      const hit = ph.raycast(target.x, target.y, target.z, dir.x, dir.y, dir.z, dist, Q.solid); // furniture blocks a shot too
      // a second, low ray: a sofa back just under the sight line would still fill the lower half of the frame
      const low = ph.raycast(target.x, target.y - 0.5, target.z, dir.x, 0, dir.z, dist * 0.8, Q.solid);
      const d = Math.min(hit ? hit.toi - 0.25 : dist, low ? low.toi - 0.25 : dist);
      if (d >= dist * 0.75) return target.clone().addScaledVector(dir, d);
      if (d > bestD) { bestD = d; best = target.clone().addScaledVector(dir, Math.max(0.6, d)); }
    }
    return best;
  }

  _stageCauldron() {
    const g = this.game, cat = g.cat, gr = g.granny;
    // the clear middle of the kitchen: the table south-west, the counters north and east, the stove west
    const P = V(-3.6, 0, -3.3);
    if (!this.cauldron) this.cauldron = this._makeCauldron();
    this.cauldron.position.copy(P);
    this.cauldron.visible = true;
    // Grandma north of the pot facing the foyer, her arm held out over the brew (one frame of the throw: the arm
    // is straight out at chest height), then nudged so that her hand is right over the middle of the pot
    gr.setState('scripted'); gr.scriptAnim = true; gr.setBroom(false);
    gr.teleport(V(P.x + 0.4, 0, P.z - 0.55), 0);
    gr.pose('Throwing', 2.15);
    gr.mixer.update(0);
    gr.root.rotation.y = gr.yaw; // update() only applies the new facing next frame
    gr.root.updateMatrixWorld(true);
    const hp = gr.handWorld();
    gr.teleport(V(gr.position.x + P.x - hp.x, 0, gr.position.z + P.z - hp.z), 0);
    gr.root.updateMatrixWorld(true);
    // green brew light from below, a little fire under the pot (FX and virtual lights only: no recompiles).  The
    // brew light sits on the surface of the brew: at Komur's chest height (1.0 m) his white fur blew out into a
    // green-white blob in both shots
    g.lightRig.add({ color: 0x4dff6a, intensity: 1.6, distance: 3.5, decay: 1.6, position: V(P.x, 0.76, P.z), priority: 3 });
    g.lightRig.add({ color: 0xff8a3a, intensity: 3, distance: 2.5, decay: 1.6, position: V(P.x, 0.25, P.z + 0.1), priority: 3 });
    g.ui.clearSubtitles();
    g.audio?.loop('bubbleLoop', { volume: 0.5, bus: 'sfx' });
    // from the hall-door corner of the kitchen: the brew and Komur in front, Grandma looming behind
    this.camFront = V(-2.55, 1.3, -1.45);
    g.setShot(this.camFront, V(P.x - 0.05, 1.05, P.z - 0.2), 50, true);
    let t = 0, fxAcc = 0;
    this.caughtTick = (dt) => {
      t += dt; fxAcc += dt;
      if (gr.currentName === 'Throwing' && gr.current) gr.current.time = 2.15 + Math.sin(t * 1.8) * 0.03; // she bobs him over the brew
      const h = gr.handWorld();
      // dangling by the scruff, swaying and kicking a little, glaring at the lens
      const sway = Math.sin(t * 2.1) * 0.035;
      const to = this.camFront;
      cat.teleport(V(h.x + sway, h.y - 0.45, h.z + sway * 0.6), Math.atan2(to.x - h.x, to.z - h.z) + Math.sin(t * 1.3) * 0.25);
      while (fxAcc > 0.09) {
        fxAcc -= 0.09;
        const r = Math.random() * 0.35, a = Math.random() * 6.283;
        if (Math.random() < 0.4) g.fx.smoke(V(P.x + Math.cos(a) * r, 0.74, P.z + Math.sin(a) * r), 1, { size: 0.22, life: 1.3, color: [0.12, 0.32, 0.14], rise: 0.45 });
        if (Math.random() < 0.15) g.fx.magic(V(P.x + Math.cos(a) * r, 0.7, P.z + Math.sin(a) * r), 1, [0.35, 0.8, 0.4]);
        g.fx.flame(V(P.x + (Math.random() - 0.5) * 0.4, 0.08, P.z + (Math.random() - 0.5) * 0.4), { size: 0.28 });
      }
      for (const b of this.cauldron.userData.bubbles) {
        b.userData.t += dt * b.userData.speed;
        const k = b.userData.t % 1;
        b.scale.setScalar(0.4 + k * 0.9);
        b.position.y = 0.66 + k * 0.05;
        b.visible = k < 0.92;
      }
    };
  }

  _cauldronCloseUp() {
    const g = this.game, cat = g.cat;
    const c = cat.position.clone();
    const dir = this.camFront.clone().sub(c).setY(0).normalize();
    this.camFront = c.clone().addScaledVector(dir, 1.55).setY(c.y + 0.5);
    g.setShot(this.camFront, V(c.x, c.y + 0.3, c.z), 40, false);
  }

  /** A big witch's cauldron for the caught ending (the kitchen prop may be burning, broken or in the way). */
  _makeCauldron() {
    const g = this.game;
    const grp = new THREE.Group();
    const iron = colorMat(0x1f1f24, { rough: 0.45, metal: 0.85, key: 'chIron' });
    // dimmer than the kitchen prop's brew: in close-ups the full glow bloomed the whole frame white-green
    const brewMat = colorMat(0x3fbf4a, { emissive: 0x1d9a2b, emissiveIntensity: 0.55, key: 'brewScene' });
    const pot = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0.1], [0.32, 0.12], [0.5, 0.32], [0.52, 0.52], [0.46, 0.68], [0.5, 0.72], [0.47, 0.74], [0.42, 0.7]].map(([r, y]) => new THREE.Vector2(r, y)), 28), iron);
    pot.castShadow = true;
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.43, 24), brewMat);
    brew.rotation.x = -Math.PI / 2; brew.position.y = 0.66;
    grp.add(pot, brew);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), iron);
      leg.position.set(Math.cos(a) * 0.36, 0.09, Math.sin(a) * 0.36);
      grp.add(leg);
    }
    grp.userData.bubbles = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), brewMat);
      const a = Math.random() * 6.283, r = Math.random() * 0.32;
      b.position.set(Math.cos(a) * r, 0.66, Math.sin(a) * r);
      b.userData = { t: Math.random(), speed: 0.6 + Math.random() * 0.8 };
      grp.add(b); grp.userData.bubbles.push(b);
    }
    grp.visible = false;
    g.scene.add(grp);
    return grp;
  }

  resultsData({ caught = false } = {}) {
    const g = this.game, s = g.score;
    // storage can throw (sandboxed iframes, blocked site data): the results screen must still appear
    let best = 0;
    try { best = Number(localStorage.getItem('badomen.best') || 0) || 0; } catch (_) { /* no storage */ }
    const newBest = s.score > best;
    try { if (newBest) localStorage.setItem('badomen.best', String(s.score)); } catch (_) { /* private mode */ }
    const t = Math.round(this.elapsed);
    const stats = g.destruction.stats();
    const quotes = caught ? CAUGHT_QUOTES : QUOTES;
    return {
      rank: s.rank(), score: s.score, newBest, caught, achievements: g.achievements?.summary(),
      label: caught ? 'CAUGHT · INTO THE CAULDRON · CHAOS RANK' : 'YOUR CHAOS RANK',
      quote: quotes[Math.floor(Math.random() * quotes.length)],
      stats: [
        ['House doom', `${s.ruinPercent}%`],
        ['Disasters caused', `${s.setpieces.length} / 9`],
        ['Things broken', `${stats.broken} / ${stats.total}`],
        ['Broken by Grandma', `${s.grannyBreaks}`],
        ['Best combo', `x${s.maxMultiplier} (${s.maxCombo} chain)`],
        ['Times caught', `${s.catchCount}`],
        ['Time', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`],
        ['Personal best', `${Math.max(best, s.score).toLocaleString('en-US')}`],
      ],
    };
  }
}
