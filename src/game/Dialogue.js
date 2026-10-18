import { LINES, TEXT_ONLY, SPEAKERS } from '../data/dialogue.js';

// Line selection with per-speaker and per-line cooldowns; voice when available, subtitles always.
export class Dialogue {
  constructor(game) {
    this.game = game;
    this.lastSpeaker = { G: -99, K: -99 };
    this.lastLine = new Map();
    this.busyUntil = 0;
    this.time = 0;
    this.queue = [];
  }

  update(dt) {
    this.time += dt;
    // a queued reply that couldn't be said within a few seconds is out of context by now: drop it
    while (this.queue.length && this.time > this.queue[0].expires) this.queue.shift();
    if (this.queue.length && this.time >= this.busyUntil) {
      const q = this.queue.shift();
      this._play(q.id, q.opts);
    }
  }

  /** Someone is talking right now. */
  get busy() { return this.time < this.busyUntil - 0.1; }

  canSay(id, { gap, lineGap = 75 } = {}) {
    const l = LINES[id] ?? TEXT_ONLY[id];
    if (!l) return false;
    if (this.time - (this.lastLine.get(id) ?? -999) < lineGap) return false;
    // Komur talks at intervals and at the moments that matter (priority lines); Grandma rants freely (playtest 3)
    if (this.time - this.lastSpeaker[l.s] < (gap ?? (l.s === 'K' ? 14 : 6))) return false;
    if (this.time < this.busyUntil - 0.2) return false;
    return true;
  }

  /** Say a catalogued line.  opts: {priority, queue, chance, gap, lineGap} */
  say(id, opts = {}) {
    const l = LINES[id] ?? TEXT_ONLY[id];
    if (!l) return false;
    if (opts.chance !== undefined && Math.random() > opts.chance) return false;
    // the same line twice in a row (two triggers in one moment, e.g. max rage + finale unlock) is never said twice
    const since = this.time - (this.lastLine.get(id) ?? -999);
    if (since < 5) return false;
    if (!opts.priority && !this.canSay(id, opts)) {
      // queue it to follow whoever is talking now (unless it was said recently anyway)
      if (opts.queue && since >= (opts.lineGap ?? 75) && this.queue.length < 2 && !this.queue.some((q) => q.id === id)) {
        this.queue.push({ id, expires: this.time + (opts.maxWait ?? 4.5), opts: { ...opts, queue: false, priority: true } });
      }
      return false;
    }
    return this._play(id, opts);
  }

  _play(id, opts) {
    const l = LINES[id] ?? TEXT_ONLY[id];
    const audio = this.game.audio;
    let dur = 0;
    if (LINES[id] && audio) dur = audio.voice(id, { priority: !!opts.priority });
    if (dur <= 0) {
      dur = Math.max(1.6, l.text.length * 0.055);
      // a grunt / meow so text-only barks still have a voice
      if (l.s === 'K') audio?.play(Math.random() < 0.5 ? 'meow_chirp' : 'meow_short', { pos: this.game.cat?.position, volume: 0.7 });
    }
    this.game.ui.subtitle(SPEAKERS[l.s], l.text, Math.max(2.2, dur + 0.6), l.s === 'K');
    this.lastSpeaker[l.s] = this.time;
    this.lastLine.set(id, this.time);
    this.busyUntil = this.time + dur;
    this.game.events.emit('dialogue', { id, speaker: l.s, dur });
    return true;
  }

  /** A skipped cutscene: stop the line being spoken, drop queued replies, clear the subtitles. */
  hush() {
    this.game.audio?.stopVoice?.();
    this.queue.length = 0;
    this.busyUntil = this.time;
    this.game.ui.clearSubtitles();
  }

  /** Free text (e.g. contextual hints in Komur's voice) — subtitle + small vocal. */
  sayText(s, text, { dur } = {}) {
    const d = dur ?? Math.max(2.4, text.length * 0.055);
    this.game.ui.subtitle(SPEAKERS[s], text, d + 0.4, s === 'K');
    if (s === 'K') this.game.audio?.play('meow_chirp', { pos: this.game.cat?.position, volume: 0.5 });
    this.lastSpeaker[s] = this.time;
    this.busyUntil = Math.max(this.busyUntil, this.time + d * 0.6);
  }
}
