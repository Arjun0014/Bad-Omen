import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Physics } from '../core/Physics.js';
import { Input } from '../core/Input.js';
import { Events } from '../core/Events.js';
import { House } from '../world/House.js';
import { LightRig } from '../world/LightRig.js';
import { setAnisotropy, sharedTextures, TEX_SLOTS, preloadCompressedTextures } from '../world/Materials.js';
import { Cat } from '../player/Cat.js';
import { FollowCamera } from '../camera/FollowCamera.js';
import { FX } from '../fx/FX.js';
import { Post } from '../fx/Post.js';
import { Destruction } from '../world/Destruction.js';
import { FireSystem } from '../world/Fire.js';
import { buildLevel } from '../world/Level.js';
import { ScoreKeeper, RageMeter } from './Rules.js';
import { Grandma } from '../ai/Grandma.js';
import { NavGraph } from '../ai/NavGraph.js';
import { Projectiles } from '../ai/Projectiles.js';
import { SetPieces } from './SetPieces.js';
import { Director } from './Director.js';
import { Dialogue } from './Dialogue.js';
import { Sequence } from './Sequence.js';
import { Achievements } from './Achievements.js';
import { UI } from '../ui/UI.js';
import { TouchControls, isTouchDevice, KEYS } from '../ui/Touch.js';
import { AudioManager } from '../audio/Audio.js';
import { CREDITS_HTML } from '../data/credits.js';

const FIXED = 1 / 60;
const BASE = import.meta.env?.BASE_URL ?? '/';
const DEBUG = new URLSearchParams(location.search).has('debug');

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#game');
    this.events = new Events();
    this.time = 0;
    this.timeScale = 1;
    this.state = 'loading';
    this.acc = 0;
    this.debug = DEBUG;
  }

  async boot() {
    this.ui = new UI(this.root.querySelector('#ui'), this);
    // phones and tablets (user request): touch controls, a phone-sized HUD, landscape only, lighter rendering
    this.isTouch = isTouchDevice();
    if (this.isTouch) {
      document.documentElement.classList.add('touch');
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('badomen.settings') || '{}'); } catch (_) { /* blocked */ }
      if (saved.hq === undefined) this.ui.settings.hq = false; // Low effects unless the player chose otherwise
    }
    this.achievements = new Achievements(this);
    this.ui.show('loading');
    this.ui.loading(0.05, 'Lighting the candles…');
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap; // three r186 dropped PCFSoft (it fell back to PCF with a warning)
    this.renderer = r;
    setAnisotropy(r.capabilities.getMaxAnisotropy());
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 120);
    window.addEventListener('resize', () => this.onResize());
    this.post = new Post(r, null, this.camera, this.ui.settings.hq !== false);
    this.applyQuality(this.ui.settings.hq !== false);

    this.input = new Input(this.canvas);
    this.touch = new TouchControls(this, this.ui.root);
    if (this.isTouch) this.touch.enable();
    // a touchscreen laptop: the first touch switches to the touch controls
    window.addEventListener('touchstart', () => { if (!this.touch.on) { this.touch.enable(); this._orient(); } }, { once: true, passive: true });
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 120));
    this._orient();
    this.input.onPauseRequest = (code) => this.onPauseKey(code);
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'playing') this.pause(); };
    this.input.onBlur = () => { if (this.state === 'playing') this.pause(); };
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.audio = new AudioManager(this);
    this.audio.preload(); // voices, SFX and music decode while the world loads (no user gesture needed)
    // browsers only start audio from a user gesture: the first click, tap or key anywhere starts it, so the title
    // screen gets its waltz before Play (iOS wants the resume inside touchend/click: keep trying until it runs)
    const gesture = () => {
      this.audio.unlock().then(() => {
        if (this.audio.ctx?.state !== 'running') return;
        for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) window.removeEventListener(t, gesture, true);
      });
    };
    for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(t, gesture, true);
    this.ui.onAction = (a) => this.onUIAction(a);
    this.ui.onSettings = (s) => {
      if ((s.hq !== false) !== this.hq) this.userPickedQuality = true; // the player's choice beats auto quality
      this.applySettings(s);
    };
    this.noAutoQuality = new URLSearchParams(location.search).has('noauto');
    this.ui.setCredits(CREDITS_HTML);
    this.applySettings(this.ui.settings);

    this.ui.loading(0.15, 'Waking the physics…');
    await Physics.initModule();
    // compressed wood textures (a quarter of the video memory); ?ktx2=0 forces the JPGs, which are also the fallback
    if (new URLSearchParams(location.search).get('ktx2') !== '0') {
      this.ui.loading(0.22, 'Varnishing the floorboards…');
      try { await preloadCompressedTextures(r); } catch (e) { console.warn('[ktx2] using the JPG textures:', e?.message ?? e); }
    }
    this.ui.loading(0.3, 'Coaxing Komur out from under the porch…');
    const loader = new GLTFLoader();
    const [catGltf, grannyGltf] = await Promise.all([
      loader.loadAsync(`${BASE}assets/characters/komur.glb`),
      loader.loadAsync(`${BASE}assets/characters/grandma.glb`),
    ]);
    this.catGltf = catGltf;
    this.grannyGltf = grannyGltf;
    this.ui.loading(0.65, 'Building a perfectly nice cottage…');
    await new Promise((res) => setTimeout(res, 30));
    this.buildWorld();
    this.ui.loading(0.95, 'Polishing the good china…');
    this.compileShaders();
    this.ui.loading(1, 'Ready');
    this.toMenu();
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
    // test hooks: ?debug&autostart[&skipintro]
    const q = new URLSearchParams(location.search);
    if (this.debug && q.has('autostart')) {
      await this.startGame();
      if (q.has('skipintro')) this.sequence?.skip();
    }
  }

  /** Pre-compile every material for the composer's render target (the variant actually used). */
  compileShaders() {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.post?.sceneTarget ?? null);
    try { r.compile(this.scene, this.camera); } finally { r.setRenderTarget(prev); }
  }

  // ------------------------------------------------------------------ world lifecycle
  buildWorld() {
    this.events.clear();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1020);
    this.scene.fog = new THREE.FogExp2(0x0d1426, 0.03);
    const hemi = new THREE.HemisphereLight(0x8fa6d8, 0x2a1f18, 0.6);
    const moon = new THREE.DirectionalLight(0xa8c4ff, 1.6);
    moon.position.set(-14, 22, 12);
    moon.target.position.set(0, 0, -3);
    moon.castShadow = true;
    moon.shadow.mapSize.set(this.hq === false ? 1024 : 2048, this.hq === false ? 1024 : 2048);
    Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.03;
    this.scene.add(hemi, moon, moon.target);
    this.hemi = hemi; this.moon = moon;
    this.baseMoon = 1.6; this.baseHemi = 0.6;

    this.physics = new Physics();
    this.physics.createWorld();
    // every point light except Komur's fill goes through the rig: a fixed number of real lights means
    // no shader recompiles when candles break, fires start or set pieces fall (see LightRig.js)
    // phones get 8 real point lights instead of 12 (per-pixel cost on mobile GPUs); fixed for the session either way
    this.lightRig = new LightRig(this.scene, this.isTouch ? 8 : 12);
    this.house = new House(this.scene, this.physics, this.lightRig).build();
    this.fx = new FX(this.scene, this.physics);
    // no rain (playtest 3): the streaks and their noise loop were removed
    this.destruction = new Destruction(this);
    this.weakPoints = [];
    this.level = buildLevel(this);
    this.score = new ScoreKeeper();
    this.rage = new RageMeter();
    this.fire = new FireSystem(this);
    this.dialogue = new Dialogue(this);
    this.spawn = { cat: new THREE.Vector3(-4.5, 0.02, 4.1) };
    this.cat = new Cat(this, { scene: skeletonClone(this.catGltf.scene), animations: this.catGltf.animations });
    this.followCam = new FollowCamera(this.camera, this.physics);
    this.followCam.snapBehind(this.cat.yaw);
    this.projectiles = new Projectiles(this);
    this.nav = new NavGraph(this.level.nav, this.physics);
    this.granny = new Grandma(this, { scene: skeletonClone(this.grannyGltf.scene), animations: this.grannyGltf.animations }, this.nav, this.level.grannySpawn);
    this.setPieces = new SetPieces(this);
    this.setPieces.build();
    this.director = new Director(this);
    this.director.wire();
    this.achievements?.wire(); // the run's counters start again with every world
    this.followCam.warmFade(this.destruction.items, this.renderer, this.scene, this.camera, this.post?.sceneTarget);
    this.house.onDoorSlam = () => { this.audio.play('woodbig', { pos: new THREE.Vector3(-4.5, 1, 5), volume: 1.2 }); this.fx.dust(new THREE.Vector3(-4.5, 1.0, 4.9), 14, { size: 0.4 }); this.followCam.addShake(0.2, 0.3); };
    this.sequence = null;
    this.timeScale = 1;
    this.time = 0;
    this.acc = 0;
    // Rapier only answers ray casts against colliders it has stepped once: on a skipped intro Grandma's very first
    // look went through every wall and she "spotted" Komur across the house
    this.physics.world.step();
    // core interactions
    const ev = this.events;
    ev.on('catSwipeHit', ({ cat, center, radius, dir }) => this.destruction.catSwipe(cat, center, radius, dir));
    ev.on('catPounceProbe', ({ cat, center, radius, dir }) => this.destruction.catPounce(cat, center, radius, dir, Math.hypot(cat.vel.x, cat.vel.z)));
    ev.on('catPounceWall', ({ cat }) => { const p = cat.frontProbe(0.3, 0.35); this.destruction.catPounce(cat, p.center, p.radius, p.dir, 6); });
    ev.on('catInteract', () => this.director.onInteract());
    ev.on('catStumble', () => { this.damageFx = 0.8; });
    ev.on('catCaught', () => { this.damageFx = 1.0; });
    ev.on('catScratching', ({ target, dt }) => this.director.onScratching(target, dt));
    ev.on('catTaunt', ({ pos }) => this.events.emit('noise', { pos, radius: 12, source: 'cat_taunt', kind: 'meow' }));
    ev.on('catPounce', ({ cat }) => this.events.emit('noise', { pos: cat.position.clone(), radius: 5, source: 'cat_pounce', kind: 'pounce' }));
    ev.on('propBroken', ({ rec, source, point }) => {
      const m = rec.meta;
      if (!(m.score > 0)) return;
      const res = this.score.award({ id: rec.id, base: m.score, source, ruin: m.ruin ?? 0, label: m.label });
      if (res) this.events.emit('scored', { ...res, rec, source, point });
    });
  }

  disposeWorld() {
    if (!this.scene) return;
    for (const k of [...(this.audio.loops?.keys() ?? [])]) this.audio.stopLoop(k);
    this.projectiles?.clear();
    this.fire?.clear();
    this.events.clear();
    // GPU resources that belong to this world only: geometry, each cloned skeleton's bone texture, the moon's
    // shadow map and per-world canvas textures (the floor cracks).  Cached materials' textures and the
    // characters' GLB textures are reused by the next world and stay.  (Restarts used to leak ~11 textures each.)
    const keep = sharedTextures();
    for (const gltf of [this.catGltf, this.grannyGltf]) {
      gltf?.scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) for (const k of TEX_SLOTS) if (m[k]) keep.add(m[k]); });
    }
    const gone = new Set();
    this.scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isLine) o.geometry?.dispose();
      if (o.isSkinnedMesh) o.skeleton?.dispose();
      for (const m of [].concat(o.material ?? [])) for (const k of TEX_SLOTS) { const t = m[k]; if (t && !keep.has(t) && !gone.has(t)) { gone.add(t); t.dispose(); } }
    });
    this.moon?.shadow?.dispose();
    try { this.physics.world.free(); } catch (_) { /* already freed */ }
    this.scene = null;
  }

  // ------------------------------------------------------------------ states
  toMenu() {
    this.state = 'menu';
    this.ui.setHud(false);
    this.ui.letterbox(false);
    this.ui.endCard(false);
    this.ui.fade(0, 0.01); // nothing left on black from a cutscene
    this.ui.show('menu');
    this.input.wantLock = false;
    this.input.exitLock();
    this.menuT = 0;
    this.granny.setState('scripted');
    this.granny.scriptAnim = true;
    this.granny.teleport(new THREE.Vector3(6.1, 0, -3.4), Math.atan2(4.4 - 6.1, -0.5 + 3.4));
    this.granny.play('Cast', 0.2);
    this.granny.setBroom(false); // spell gestures with the broom on her hand swung it through her fingers
    this.cat.teleport(new THREE.Vector3(4.4, 0.78, -0.5), -1.9);
    this.cat.play('SittingIdle', 0.2);
  }

  async startGame() {
    if (this.starting) return; // a double click on Play while the voices finish decoding
    this.starting = true;
    try {
      await this.audio.unlock();
      this.input.wantLock = true;
      this.input.requestLock(); // while the click still counts as a user gesture
      // the intro opens with Grandma's line 0.4 s in: on a fast click wait (menu still up, at most 2.5 s) for it
      await this.audio.whenVoices(['G_INTRO_01', 'G_INTRO_02', 'K_INTRO_01'], 2500);
      this.applySettings(this.ui.settings);
      this.ui.hideScreens();
      this.ui.setHud(true);
      this.director.startIntro();
    } finally { this.starting = false; }
  }

  async restart() {
    this.ui.hideScreens();
    this.ui.show('loading');
    this.ui.loading(0.5, 'Rebuilding the cottage (again)…');
    await new Promise((r) => setTimeout(r, 30));
    this.disposeWorld();
    this.buildWorld();
    this.ui.shownScore = 0;
    await this.startGame();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
    this.input.exitLock();
    this.input.clear();
    this.audio.ctx?.suspend?.();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.ctx?.resume?.();
    this.ui.hideScreens();
    this.state = 'playing';
    this.input.requestLock();
    this.input.clear();
    this.last = performance.now();
  }

  showResults(opts = {}) {
    this.state = 'results';
    this.sequence = null;
    this.ui.letterbox(false);
    this.ui.setHud(false);
    this.ui.endCard(false);
    this.ui.fade(0, 0.6); // a cutscene may have ended on black
    this.input.exitLock();
    this.input.wantLock = false;
    this.ui.results(this.director.resultsData(opts));
  }

  onUIAction(a) {
    const back = () => this.ui.show(this.state === 'paused' ? 'pause' : this.state === 'results' ? 'results' : 'menu');
    switch (a) {
      case 'play': if (this.touch?.on) this._fullscreen(); this.startGame(); break;
      case 'skip': if (this.state === 'cinematic' && this.sequence?.skippable) this.sequence.skip(); break;
      case 'controls': this.ui.show('controls'); break;
      case 'settings': this.ui.show('settings'); break;
      case 'credits': this.ui.show('credits'); break;
      case 'achievements': this.ui.showAchievements(this.achievements.list()); break;
      case 'back': back(); break;
      case 'resume': this.resume(); break;
      case 'restart': this.restart(); break;
      case 'quit':
        this.ui.show('loading'); this.ui.loading(0.5, 'Tidying up…');
        setTimeout(() => { this.disposeWorld(); this.buildWorld(); this.toMenu(); }, 30);
        break;
    }
  }

  onPauseKey() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused' && this.ui.current === 'pause') this.resume();
    else if (this.state === 'paused') this.ui.show('pause');
    else if (this.state === 'cinematic' && this.sequence?.skippable) this.sequence.skip();
  }

  onKey(e) {
    if (e.code === 'KeyM') this.audio.toggleMute();
    if ((e.code === 'Space' || e.code === 'Enter') && this.state === 'cinematic' && this.sequence?.skippable) this.sequence.skip();
    if (e.code === 'Tab' && this.state === 'playing') this.director.skipTutorial();
    if (e.code === 'Backquote') { this.ui.settings.fps = !this.ui.settings.fps; this.ui.saveSettings(); }
    if (this.debug && this.state === 'playing') {
      if (e.code === 'Digit1') this.setPieces.trigger('SP01', 'granny_throw');
      if (e.code === 'Digit2') { this.setPieces.state.sp02Ember = true; this.setPieces.trigger('SP02', 'granny_throw'); }
      if (e.code === 'Digit3') this.setPieces.trigger('SP03', 'granny_throw');
      if (e.code === 'Digit4') { this.score.ruin = 70; this.setPieces.done.SP01 = this.setPieces.done.SP02 = true; this.rage.add(100); }
      if (e.code === 'Digit9') this.rage.add(25);
    }
  }

  applyQuality(hq) {
    this.hq = hq;
    if (hq) this.lowScale = false;
    this.post?.setHQ(hq);
    this.renderer.setPixelRatio(hq ? Math.min(window.devicePixelRatio, 1.5) : this.lowScale ? 0.75 : 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.post?.setSize(window.innerWidth, window.innerHeight);
    if (this.moon) { const m = hq ? 2048 : 1024; if (this.moon.shadow.mapSize.x !== m) { this.moon.shadow.mapSize.set(m, m); this.moon.shadow.map?.dispose(); this.moon.shadow.map = null; } }
  }

  applySettings(s) {
    if (this.post && (s.hq !== false) !== this.hq) this.applyQuality(s.hq !== false);
    this.input.sensitivity = s.sensitivity ?? 1;
    this.input.invertY = !!s.invertY;
    this.audio.applySettings(s);
  }

  // ------------------------------------------------------------------ cinematics
  startCinematic(name, steps, onEnd, opts = {}) {
    if (this.sequence && !this.sequence.done) this.sequence.skip();
    this.state = 'cinematic';
    this.ui.letterbox(true);
    this.ui.prompt(null);
    if (this.cat.mode !== 'caught') { this.cat.mode = 'cinematic'; this.cat.vel.set(0, 0, 0); this.cat.stopScratch?.(); }
    this.projectiles.hideTelegraph();
    const grannyWasActive = this.granny.active;
    if (['windup', 'swing', 'catch', 'tantrum'].includes(this.granny.state)) { this.granny.hideHeld(); this.granny.attack = null; }
    if (this.granny.active) this.granny.setState('scripted');
    this.sequence = new Sequence(this, steps, {
      name, skippable: opts.skippable ?? true,
      onEnd: () => {
        this.followCam.cinematic = null;
        this.ui.letterbox(false);
        this.setTimeScale(1);
        try { onEnd?.(); } catch (e) { console.error(e); }
        if (this.state === 'cinematic') {
          this.state = 'playing';
          if (this.cat.mode === 'cinematic') this.cat.mode = 'normal';
          if (grannyWasActive && !this.granny.active) this.granny.setState('search');
          this.input.clear();
        }
        this.sequence = null;
      },
    });
  }

  setShot(pos, look, fov = 55, snap = false) {
    this.followCam.cinematic = { pos: pos.clone(), look: look.clone(), fov, snap, speed: snap ? 99 : 4 };
  }

  setTimeScale(s) { this.timeScale = s; }

  // ------------------------------------------------------------------ loop
  /** Button names for prompts: the keyboard's or the touch controls'. */
  get keys() { return this.touch?.on ? KEYS.touch : KEYS.desk; }

  /** Phones play in landscape: in portrait the game holds (simulation and sound) behind the rotate screen, and
   *  carries on from the same moment when the phone turns back. */
  _orient() {
    const portrait = !!this.touch?.on && window.innerHeight > window.innerWidth;
    document.documentElement.classList.toggle('portrait', portrait);
    if (portrait === !!this.rotateHold) return;
    this.rotateHold = portrait;
    if (portrait) { this.input.clear(); this.touch.releaseAll(); this.audio?.ctx?.suspend?.(); }
    else if (this.state !== 'paused') this.audio?.ctx?.resume?.().catch?.(() => {});
    this.last = performance.now();
  }

  /** Touch screens: fullscreen and landscape lock where the browser allows (Android); iOS keeps its bars. */
  _fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    try {
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape')?.catch?.(() => {}))
        .catch(() => {});
    } catch (_) { /* not allowed here */ }
  }

  onResize() {
    this._orient();
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.post?.setSize(window.innerWidth, window.innerHeight);
  }

  frame() {
    const now = performance.now();
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(raw, 0.1);
    this._fps = (this._fps ?? 60) * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    if (!this.scene) return;
    try {
      this._frame(dt);
      this._autoQuality(raw);
    } catch (e) {
      console.error('[frame]', e);
    }
  }

  /**
   * Sustained low frame rate while playing (or in a cinematic) steps quality down once per stage:
   * High -> Low (no bloom/MSAA, pixel ratio 1, 1K shadows) below 45 fps, then 0.75 render scale below 30 fps.
   * Skipped after the player picks a quality themselves, and with ?noauto (video capture).
   */
  _autoQuality(raw) {
    const A = this._aq ?? (this._aq = { warm: 0, t: 0, frames: 0 });
    const active = (this.state === 'playing' || this.state === 'cinematic') && !document.hidden;
    if (!active || raw > 0.25 || this.noAutoQuality) { A.warm = 0; A.t = 0; A.frames = 0; return; }
    A.warm += raw;
    if (A.warm < 2.5) return; // let shaders compile / the world settle after (re)starts and resumes
    A.t += raw; A.frames++;
    if (A.t < 3) return;
    const fps = A.frames / A.t;
    A.t = 0; A.frames = 0;
    if (this.hq && !this.userPickedQuality && fps < 45) {
      this.ui.settings.hq = false;
      this.ui.saveSettings();
      this.ui.syncSettings();
      this.applyQuality(false);
      this.autoLowered = true;
      this.ui.toast(`Running at ${Math.round(fps)} fps: switched to Low quality effects (Settings to change)`);
    } else if (!this.hq && !this.lowScale && fps < 30) {
      this.lowScale = true;
      this.renderer.setPixelRatio(0.75);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.ui.toast(`Running at ${Math.round(fps)} fps: lowered the render resolution`);
    }
  }

  _frame(dt) {
    // a phone turned to portrait holds everything (the rotate screen is up)
    const simulating = (this.state === 'playing' || this.state === 'cinematic') && !this.rotateHold;
    const sdt = simulating ? dt * this.timeScale : 0;
    this.input.prune();
    this.touch?.update();
    if (simulating) {
      this.time += sdt;
      this.acc += sdt;
      let steps = 0;
      while (this.acc >= FIXED && steps < 4) { this.fixedStep(FIXED); this.acc -= FIXED; steps++; }
      if (steps === 4) this.acc = 0;
      this.sequence?.update(dt * Math.max(this.timeScale, 0.5));
    }
    const alpha = this.acc / FIXED;
    if (this.state === 'menu') this.menuCamera(dt);
    this.cat.update(this.state === 'menu' ? dt : sdt, alpha);
    this.granny.update(this.state === 'menu' ? dt : sdt, alpha);
    this.projectiles.update(sdt);
    const mouse = this.state === 'playing' ? this.input.takeMouse() : (this.input.takeMouse(), null);
    if (this.state !== 'menu') this.followCam.update(dt, this.cat, mouse, { comfort: this.ui.settings.comfort });
    this.granny.lensCheck(this.camera.position, (this.state === 'playing' || this.state === 'paused') && !this.followCam.cinematic);
    this.house.update(dt, performance.now() / 1000);
    this.destruction.update(sdt);
    this.fx.update(sdt);
    this.fire.update(sdt, this.time);
    this.setPieces.update(sdt, this.time);
    this.director.update(sdt);
    this.dialogue.update(sdt);
    this.audio.update(dt);
    // a caught Komur hangs from Grandma's grip by the scruff: placed last, once both are posed and scenes have run
    if (this.cat.mode === 'caught') this.granny.holdCat(this.cat, sdt);
    const L = this.director.lightning ?? 0;
    if (L > 0) this.director.lightning = Math.max(0, L - dt);
    const flash = L > 0 ? (Math.sin(L * 60) > 0 ? L * 8 : L * 2) : 0;
    this.moon.intensity = this.baseMoon + flash * 3 + (this.house.roofBroken ? 0.8 : 0);
    this.hemi.intensity = this.baseHemi + flash * 0.6;
    this.lightRig.update(dt, this.cat.root.position, this.camera.position);
    this.ui.update(dt);
    if (this.ui.settings.fps) this.ui.el.fps.textContent = `${Math.round(this._fps)} fps`;
    if (this.post) {
      this.damageFx = Math.max(0, (this.damageFx ?? 0) - dt * 1.8);
      this.post.grade.uniforms.uDamage.value = this.damageFx;
      this.post.render(this.scene, this.camera, dt);
    } else this.renderer.render(this.scene, this.camera);
  }

  fixedStep(dt) {
    const playing = this.state === 'playing';
    this.cat.fixedUpdate(dt, playing ? this.input : null, this.followCam.moveYaw);
    this.granny.fixedUpdate(dt);
    this.projectiles.fixedUpdate(dt);
    this.physics.step();
    this.destruction.fixedUpdate(dt);
    this.fire.fixedUpdate(dt);
    this.score.update(dt);
  }

  /** Title screen: a slow sweep across the open side of the living room; Komur on the dining table framed
   *  in the left third (clear of the centred menu), Grandma brewing trouble behind him. */
  menuCamera(dt) {
    this.menuT += dt;
    const a = THREE.MathUtils.degToRad(188 + Math.sin(this.menuT * 0.1) * 34);
    const cx = 4.4, cz = -0.5;
    const pos = new THREE.Vector3(cx + Math.cos(a) * 2.75, 1.5 + Math.sin(this.menuT * 0.23) * 0.1, cz + Math.sin(a) * 2.75);
    const toCat = new THREE.Vector3(cx - pos.x, 0, cz - pos.z).normalize();
    const right = new THREE.Vector3(-toCat.z, 0, toCat.x);
    const look = new THREE.Vector3(cx, 1.12, cz).addScaledVector(right, 0.95);
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
  }
}
