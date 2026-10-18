// Pure game rules: score, combo, Grandma provenance bonus, ruin, rage.  No three.js here (unit tested).

export const RULES = {
  comboWindow: 4.0,
  comboSteps: [1, 1.5, 2, 2.5, 3, 4, 5],
  grannyBonus: 2,
  catchPenalty: 400,
  setpieceChainWindow: 12,
  setpieceChainBonus: 2500,
  ruinTarget: 100,
  ranks: [
    [0, 'Mildly Inconvenient'],
    [20000, 'Household Pest'],
    [60000, 'Menace'],
    [120000, 'Walking Curse'],
    [200000, 'BAD OMEN'],
  ],
  rage: {
    thresholds: [25, 50, 75, 90],
    decaySearching: 0.6,
    decayIdle: 1.5,
  },
};

export function isGrannySource(source) {
  return typeof source === 'string' && source.startsWith('granny');
}

export class ScoreKeeper {
  constructor(rules = RULES) {
    this.rules = rules;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;            // index into comboSteps
    this.comboTimer = 0;
    this.maxMultiplier = 1;
    this.maxCombo = 0;
    this.chain = 0;            // events in current combo
    this.scored = new Set();
    this.breaks = 0;
    this.grannyBreaks = 0;
    this.grannyPoints = 0;
    this.catchCount = 0;
    this.ruin = 0;
    this.setpieces = [];
    this.lastSetpieceTime = -1e9;
    this.time = 0;
    this.log = [];
  }

  get multiplier() { return this.comboTimer > 0 ? this.rules.comboSteps[this.combo] : 1; }

  /**
   * Award a unique property event.  Returns null for duplicates.
   * ev: {id, base, source, ruin, label, setpiece}
   */
  award(ev) {
    const key = ev.id;
    if (key != null) {
      if (this.scored.has(key)) return null;
      this.scored.add(key);
    }
    if (this.comboTimer > 0) {
      this.combo = Math.min(this.combo + 1, this.rules.comboSteps.length - 1);
      this.chain++;
    } else {
      this.combo = 0;
      this.chain = 1;
    }
    this.comboTimer = this.rules.comboWindow;
    const mult = this.rules.comboSteps[this.combo];
    const granny = isGrannySource(ev.source);
    let points = Math.round((ev.base || 0) * mult * (granny ? this.rules.grannyBonus : 1));
    let chainBonus = 0;
    if (ev.setpiece) {
      if (this.time - this.lastSetpieceTime <= this.rules.setpieceChainWindow) chainBonus = this.rules.setpieceChainBonus;
      this.lastSetpieceTime = this.time;
      this.setpieces.push(ev.setpiece);
    }
    points += chainBonus;
    this.score += points;
    this.ruin = Math.min(this.rules.ruinTarget, this.ruin + (ev.ruin || 0));
    if (!ev.setpiece) { this.breaks++; if (granny) this.grannyBreaks++; }
    if (granny) this.grannyPoints += points;
    this.maxMultiplier = Math.max(this.maxMultiplier, mult);
    this.maxCombo = Math.max(this.maxCombo, this.chain);
    const result = { points, multiplier: mult, granny, chain: this.chain, chainBonus, label: ev.label };
    this.log.push({ t: this.time, id: key, ...result });
    return result;
  }

  update(dt) {
    this.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.comboTimer = 0; this.combo = 0; this.chain = 0; }
    }
  }

  caught() {
    const penalty = Math.min(this.score, this.rules.catchPenalty);
    this.score -= penalty;
    this.combo = 0; this.chain = 0; this.comboTimer = 0;
    this.catchCount++;
    return penalty;
  }

  get ruinPercent() { return Math.round((this.ruin / this.rules.ruinTarget) * 100); }

  get grannyShare() { return this.score > 0 ? Math.round((this.grannyPoints / Math.max(1, this.score + this.catchCount * this.rules.catchPenalty)) * 100) : 0; }

  rank(score = this.score) {
    let r = this.rules.ranks[0][1];
    for (const [s, name] of this.rules.ranks) if (score >= s) r = name;
    return r;
  }
}

export class RageMeter {
  constructor(rules = RULES) {
    this.rules = rules;
    this.reset();
  }
  reset() { this.value = 0; this.floor = 0; this.lastPhase = 0; }
  add(amount) {
    this.value = Math.max(this.floor, Math.min(100, this.value + amount));
    return this.value;
  }
  setFloor(f) { this.floor = Math.max(this.floor, f); this.value = Math.max(this.value, this.floor); }
  decay(dt, mode) {
    const r = mode === 'idle' ? this.rules.rage.decayIdle : mode === 'none' ? 0 : this.rules.rage.decaySearching;
    this.value = Math.max(this.floor, this.value - r * dt);
  }
  get phase() {
    let p = 0;
    for (const t of this.rules.rage.thresholds) if (this.value >= t) p++;
    return p; // 0 suspicious, 1 hunting, 2 enraged, 3 furious, 4 meltdown
  }
  /** returns new phase if it increased since last call, else null */
  checkPhaseUp() {
    const p = this.phase;
    if (p > this.lastPhase) { this.lastPhase = p; return p; }
    if (p < this.lastPhase) this.lastPhase = p;
    return null;
  }
}

/** Finale eligibility: ruin%, completed set pieces, rage — with adaptive help after long runs. */
export function finaleReady({ ruinPercent, setpiecesDone, rage, elapsed }) {
  const relax = elapsed > 480 ? 0.7 : elapsed > 360 ? 0.85 : 1;
  return ruinPercent >= 55 * relax && setpiecesDone >= (elapsed > 540 ? 1 : 2) && rage >= 75 * relax;
}
