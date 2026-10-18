// Timed, skippable sequence of steps (cinematics).  Steps must be safe to fast-forward.
export class Sequence {
  constructor(game, steps, { skippable = true, onEnd = null, name = 'seq' } = {}) {
    this.game = game;
    this.steps = [...steps].sort((a, b) => a.t - b.t);
    this.t = 0;
    this.i = 0;
    this.done = false;
    this.skippable = skippable;
    this.onEnd = onEnd;
    this.name = name;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    while (this.i < this.steps.length && this.steps[this.i].t <= this.t) this._run(this.steps[this.i++]);
    if (this.i >= this.steps.length) this.finish();
  }

  _run(step) {
    try { step.fn?.(this.t, false); } catch (e) { console.error(`[${this.name}] step failed`, e); }
  }

  skip() {
    if (this.done || !this.skippable) return;
    while (this.i < this.steps.length) {
      const s = this.steps[this.i++];
      try { (s.skip ?? s.fn)?.(this.t, true); } catch (e) { console.error(`[${this.name}] skip step failed`, e); }
    }
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    try { this.onEnd?.(); } catch (e) { console.error(`[${this.name}] end failed`, e); }
  }
}
