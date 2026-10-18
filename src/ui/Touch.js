// Touch controls for phones and tablets, landscape only (user request): a floating stick under the left thumb,
// swipe-to-look on the right, a thumb cluster of action buttons, a pause button and a cutscene skip button.  It all
// feeds the same Input the keyboard and mouse use (key codes held, queued presses, look deltas), so the game logic
// can't tell the difference.  Every control tracks its own pointer, so moving, looking and pressing work together.

/** What prompts call each control, on a keyboard and on a touch screen. */
export const KEYS = {
  desk: { move: 'W A S D', look: 'MOUSE', moveHow: 'WASD to move, the mouse to look', jump: 'SPACE', swipe: 'LEFT CLICK', pounce: 'RIGHT CLICK',
    sprint: 'SHIFT', meow: 'F', use: 'E', holdUse: 'Hold E', press: 'press' },
  touch: { move: 'LEFT THUMB', look: 'RIGHT THUMB', moveHow: 'drag on the left to move, on the right to look', jump: 'JUMP', swipe: 'SWIPE',
    pounce: 'POUNCE', sprint: 'GALLOP', meow: 'MEOW', use: 'HIDE', holdUse: 'Hold CLAW', press: 'tap' },
};

const STICK_R = 54;         // px: knob travel
const GALLOP_AT = 0.96;     // stick pushed to the rim gallops
const LOOK_GAIN = 1.45;     // touch px -> mouse px (a full-width swipe turns ~180 deg)

/** Is this a touch-first device (phone, tablet)?  `?touch` forces it, `?notouch` turns it off. */
export function isTouchDevice() {
  const q = new URLSearchParams(location.search);
  if (q.has('notouch')) return false;
  if (q.has('touch')) return true;
  const coarse = matchMedia?.('(pointer: coarse)').matches;
  const noHover = matchMedia?.('(hover: none)').matches;
  return !!(coarse || (navigator.maxTouchPoints > 0 && noHover));
}

export class TouchControls {
  constructor(game, root) {
    this.game = game;
    this.input = game.input;
    this.on = false;
    this.move = null;        // { id, x0, y0 }
    this.look = null;        // { id, x, y }
    this.gallop = false;     // the Gallop toggle
    this.crouch = false;     // the Crouch toggle
    const el = document.createElement('div');
    el.id = 'touch';
    el.className = 'hidden';
    el.innerHTML = `
      <div class="tz tz-move"></div>
      <div class="tz tz-look"></div>
      <div class="stick hidden"><div class="ring"></div><div class="knob"></div></div>
      <button class="tb t-swipe" data-code="Mouse0" aria-label="Swipe"><span>SWIPE</span></button>
      <button class="tb t-jump" data-code="Space" aria-label="Jump"><span>JUMP</span></button>
      <button class="tb t-pounce" data-code="Mouse2" aria-label="Pounce"><span>POUNCE</span></button>
      <button class="tb t-meow" data-code="KeyF" aria-label="Meow"><span>MEOW</span></button>
      <button class="tb t-hide" data-code="KeyE" aria-label="Hide or claw"><span>HIDE<br>CLAW</span></button>
      <button class="tb t-gallop" data-toggle="gallop" aria-label="Gallop"><span>GALLOP</span></button>
      <button class="tb t-crouch" data-toggle="crouch" aria-label="Crouch"><span>CROUCH</span></button>
      <button class="tb t-pause" data-act="pause" aria-label="Pause"><span>❚❚</span></button>
      <button class="tb t-skiptut hidden" data-act="skiptut" aria-label="Skip the tutorial"><span>SKIP TUTORIAL</span></button>`;
    root.appendChild(el);
    this.el = el;
    this.stick = el.querySelector('.stick');
    this.knob = el.querySelector('.knob');
    this._bind();
  }

  /** Touch mode on: no pointer lock, touch-sized HUD, controls shown while playing. */
  enable() {
    if (this.on) return;
    this.on = true;
    this.input.touchMode = true;
    document.documentElement.classList.add('touch');
  }

  _bind() {
    const el = this.el, inp = this.input;
    const opts = { passive: false };
    // the stick: wherever the left thumb lands in its zone
    const mz = el.querySelector('.tz-move');
    mz.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.move) return;
      mz.setPointerCapture?.(e.pointerId);
      const r = el.getBoundingClientRect();
      const x0 = Math.max(STICK_R + 12, Math.min(e.clientX, r.width * 0.42 - STICK_R));
      const y0 = Math.max(STICK_R + 12, Math.min(e.clientY, r.height - STICK_R - 12));
      // the ring is drawn inside the screen (x0, y0), but the stick reads the finger's motion from where it landed:
      // a thumb near the edge doesn't jolt Komur off on touch
      this.move = { id: e.pointerId, x0, y0, ox: e.clientX, oy: e.clientY };
      this.stick.style.left = `${x0}px`; this.stick.style.top = `${y0}px`;
      this.stick.classList.remove('hidden');
      this._stickTo(e.clientX, e.clientY);
      this._wake();
    }, opts);
    mz.addEventListener('pointermove', (e) => { if (this.move?.id === e.pointerId) { e.preventDefault(); this._stickTo(e.clientX, e.clientY); } }, opts);
    const endMove = (e) => { if (this.move?.id !== e.pointerId) return; this.move = null; this._stickReset(); };
    mz.addEventListener('pointerup', endMove); mz.addEventListener('pointercancel', endMove);
    // looking: drag anywhere on the right
    const lz = el.querySelector('.tz-look');
    lz.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.look) return; lz.setPointerCapture?.(e.pointerId); this.look = { id: e.pointerId, x: e.clientX, y: e.clientY }; this._wake(); }, opts);
    lz.addEventListener('pointermove', (e) => {
      if (this.look?.id !== e.pointerId) return;
      e.preventDefault();
      inp.addLook((e.clientX - this.look.x) * LOOK_GAIN, (e.clientY - this.look.y) * LOOK_GAIN);
      this.look.x = e.clientX; this.look.y = e.clientY;
    }, opts);
    const endLook = (e) => { if (this.look?.id === e.pointerId) this.look = null; };
    lz.addEventListener('pointerup', endLook); lz.addEventListener('pointercancel', endLook);
    // buttons: held while the finger is on them (any number at once)
    for (const b of el.querySelectorAll('.tb')) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture?.(e.pointerId);
        b.classList.add('down');
        this._wake();
        if (b.dataset.code) inp.press(b.dataset.code, true);
        else if (b.dataset.toggle === 'gallop') { this.gallop = !this.gallop; b.classList.toggle('lit', this.gallop); this._syncHeld(); }
        else if (b.dataset.toggle === 'crouch') { this.crouch = !this.crouch; b.classList.toggle('lit', this.crouch); this._syncHeld(); }
        else if (b.dataset.act === 'pause' && this.game.state === 'playing') this.game.pause();
        else if (b.dataset.act === 'skiptut') this.game.director?.skipTutorial();
      }, opts);
      const up = (e) => { b.classList.remove('down'); if (b.dataset.code) inp.press(b.dataset.code, false); e.preventDefault(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  /** The audio context can be suspended again by the OS (a call, the app switcher): any touch wakes it. */
  _wake() {
    const a = this.game.audio;
    if (a.ctx && a.ctx.state !== 'running' && this.game.state !== 'paused') a.ctx.resume().catch(() => {});
  }

  _stickTo(x, y) {
    const m = this.move;
    let dx = x - m.ox, dy = y - m.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.min(1, d / STICK_R);
    this.input.stick.x = (dx / STICK_R);
    this.input.stick.y = -(dy / STICK_R);
    this.rim = k >= GALLOP_AT;
    this.stick.classList.toggle('gallop', this.rim || this.gallop);
    this._syncHeld();
  }

  _stickReset() {
    this.input.stick.x = 0; this.input.stick.y = 0;
    this.rim = false;
    this.knob.style.transform = '';
    this.stick.classList.add('hidden');
    this.stick.classList.remove('gallop');
    // the gallop toggle ends with the run
    if (this.gallop) { this.gallop = false; this.el.querySelector('.t-gallop').classList.remove('lit'); }
    this._syncHeld();
  }

  /** Toggles and the stick's rim become held keys. */
  _syncHeld() {
    const inp = this.input;
    if ((this.gallop || this.rim) && this.move) inp.down.add('ShiftLeft'); else inp.down.delete('ShiftLeft');
    if (this.crouch) inp.down.add('KeyC'); else inp.down.delete('KeyC');
  }

  /** Release everything (pause, cutscenes, menus). */
  releaseAll() {
    this.move = null; this.look = null;
    this._stickReset();
    if (this.crouch) { this.crouch = false; this.el.querySelector('.t-crouch').classList.remove('lit'); }
    for (const b of this.el.querySelectorAll('.tb.down')) b.classList.remove('down');
    for (const c of ['Mouse0', 'Mouse2', 'Space', 'KeyF', 'KeyE', 'KeyC', 'ShiftLeft']) this.input.down.delete(c);
  }

  /** Once a frame: shown only while playing. */
  update() {
    if (!this.on) return;
    const tut = ['vase', 'taunt', 'bait'].includes(this.game.director?.stage);
    if (tut !== this._tut) { this._tut = tut; this.el.querySelector('.t-skiptut').classList.toggle('hidden', !tut); }
    const show = this.game.state === 'playing';
    if (show === this._shown) return;
    this._shown = show;
    this.el.classList.toggle('hidden', !show);
    if (!show) this.releaseAll();
  }
}
