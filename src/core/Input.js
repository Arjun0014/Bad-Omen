// Keyboard + mouse input with pointer lock, action mapping and press buffering.
// Presses are queued with timestamps so the fixed-step simulation never drops a tap.

const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  swipe: ['Mouse0', 'KeyJ'],
  pounce: ['Mouse2', 'KeyK'],
  interact: ['KeyE'],
  taunt: ['KeyF'],
  crouch: ['KeyC'], // not Ctrl: holding it and pressing W (sneaking forward) is Ctrl+W, which closes the browser tab
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  skip: ['Space', 'Enter', 'Escape'],
  debug: ['Backquote'],
};

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.down = new Set();
    this.queue = []; // {code, t}
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.lockedAt = -1e9;
    this.enabled = true;
    this.sensitivity = 1;
    this.invertY = false;
    this.onPauseRequest = null;
    this.onLockChange = null;
    this.touchMode = false;      // phones/tablets: no pointer lock; TouchControls feed the stick, keys and look
    this.stick = { x: 0, y: 0 }; // analog move from the touch stick (y forward)
    this._bind();
  }

  _now() { return performance.now() / 1000; }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (this._isGameKey(e.code)) e.preventDefault(); return; }
      if (this._isGameKey(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.queue.push({ code: e.code, t: this._now() });
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPauseRequest?.(e.code);
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.onBlur?.(); });
    this.dom.addEventListener('mousedown', (e) => {
      const code = 'Mouse' + e.button;
      this.down.add(code);
      this.queue.push({ code, t: this._now() });
      if (!this.locked && this.wantLock) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => { this.down.delete('Mouse' + e.button); });
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Chromium can report one huge movement right as the pointer locks (the distance to the lock centre):
      // ignore the first moments, then clamp absurd spikes
      if (performance.now() - this.lockedAt < 80) return;
      const dx = Math.max(-200, Math.min(200, e.movementX || 0));
      const dy = Math.max(-200, Math.min(200, e.movementY || 0));
      this.mouseDX += dx;
      this.mouseDY += dy;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.locked) this.lockedAt = performance.now();
      this.onLockChange?.(this.locked);
    });
  }

  _isGameKey(code) {
    return ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code);
  }

  requestLock() {
    if (this.touchMode) return; // touch screens look by swiping, not with a locked pointer
    // without a recent click/key the browser refuses (and logs an error); the next click on the canvas asks again
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    try {
      const p = this.dom.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.dom.requestPointerLock(); } catch (_) { /* ignore */ } });
    } catch (_) {
      try { this.dom.requestPointerLock(); } catch (__) { /* ignore */ }
    }
  }

  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  held(action) {
    if (!this.enabled) return false;
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  /** Consume a press of `action` that happened within `window` seconds. */
  consume(action, window = 0.2) {
    if (!this.enabled) return false;
    const now = this._now();
    const codes = BINDINGS[action];
    for (let i = 0; i < this.queue.length; i++) {
      const q = this.queue[i];
      if (codes.includes(q.code) && now - q.t <= window) {
        this.queue.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /** Peek without consuming (used for jump buffering). */
  pressedWithin(action, window) {
    const now = this._now();
    const codes = BINDINGS[action];
    return this.queue.some((q) => codes.includes(q.code) && now - q.t <= window);
  }

  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    // the touch stick is analog: a slight tilt walks slowly
    if (Math.hypot(this.stick.x, this.stick.y) > 0.12) return { x: this.stick.x, y: this.stick.y };
    let x = 0, y = 0;
    if (this.held('forward')) y += 1;
    if (this.held('back')) y -= 1;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  takeMouse() {
    const d = { x: this.mouseDX * this.sensitivity, y: this.mouseDY * this.sensitivity * (this.invertY ? -1 : 1) };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  /** Drop stale presses (called once per render frame). */
  prune() {
    const now = this._now();
    if (this.queue.length) this.queue = this.queue.filter((q) => now - q.t < 0.35);
  }

  /** Look deltas from a touch swipe (in mouse-pixel units). */
  addLook(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }

  /** A touch button acting like a key: held while pressed, one queued press per touch. */
  press(code, on) {
    if (on) { if (!this.down.has(code)) this.queue.push({ code, t: this._now() }); this.down.add(code); }
    else this.down.delete(code);
  }

  clear() { this.queue.length = 0; this.mouseDX = 0; this.mouseDY = 0; }
}
