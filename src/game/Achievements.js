// Achievements: kept for good in localStorage (best effort: storage can be blocked) and announced with a card and a
// chime.  The game's events are cleared for every new world, so wire() runs once per run; per-run counters reset there.

export const ACHIEVEMENTS = [
  { id: 'vase', name: 'Bad Omen', desc: "Smash Grandma's good vase" },
  { id: 'weapon', name: "She's the Weapon", desc: 'Get Grandma to break her own things' },
  { id: 'sp01', name: 'The Last Supper', desc: 'Bring down the dining-room chandelier' },
  { id: 'sp02', name: 'Kitchen Nightmare', desc: 'Set the kitchen on fire' },
  { id: 'sp03', name: 'Load-Bearing', desc: 'Send the wardrobe through the floor' },
  { id: 'sp10', name: 'Fresh Air', desc: 'Shatter the glass house' },
  { id: 'sp04', name: 'Roof? What Roof?', desc: 'Bring the roof down' },
  { id: 'chain', name: 'Pure Chaos', desc: 'Chain 10 breaks into one combo' },
  { id: 'matador', name: 'Matador', desc: "Dodge 5 of Grandma's throws in one run" },
  { id: 'glazier', name: "Glazier's Nightmare", desc: 'Break 10 windows in one run' },
  { id: 'pest', name: 'Professional Pest', desc: 'Meow at Grandma 15 times in one run' },
  { id: 'hide', name: 'Wrong Spot', desc: 'Stay hidden while Grandma searches the wrong hiding place' },
  { id: 'cauldron', name: 'Needs Salt', desc: 'Get caught and dangled over the cauldron' },
  { id: 'ninelives', name: 'Nine Lives', desc: 'Bring the roof down without ever being caught' },
  { id: 'speed', name: 'Demolition Express', desc: 'Bring the roof down in under 6 minutes' },
  { id: 'doom', name: 'Condemned', desc: 'Reach 100% house doom' },
];

const KEY = 'badomen.achievements';

export class Achievements {
  constructor(game) {
    this.game = game;
    this.unlocked = new Set();
    try { for (const id of JSON.parse(localStorage.getItem(KEY) || '[]')) this.unlocked.add(id); } catch (_) { /* no storage */ }
    this.run = [];
    this.fresh = [];
  }

  get total() { return ACHIEVEMENTS.length; }

  /** Subscribe to this run's events (call after every buildWorld). */
  wire() {
    const g = this.game, ev = g.events;
    this.run = [];
    this.fresh = [];
    const n = { dodges: 0, windows: 0, taunts: 0 };
    ev.on('propBroken', ({ rec }) => {
      if (rec.id === 'tut_vase') this.unlock('vase');
      if (rec.kind === 'window' && ++n.windows >= 10) this.unlock('glazier');
    });
    ev.on('scored', (r) => {
      if (r.granny) this.unlock('weapon');
      if (r.chain >= 10) this.unlock('chain');
      if (g.score.ruinPercent >= 100) this.unlock('doom');
    });
    ev.on('setpieceTriggered', ({ id }) => {
      if (['SP01', 'SP02', 'SP03', 'SP10', 'SP04'].includes(id)) this.unlock(id.toLowerCase());
      if (id === 'SP04') {
        if (g.score.catchCount === 0) this.unlock('ninelives');
        if ((g.director?.elapsed ?? Infinity) < 360) this.unlock('speed');
      }
    });
    ev.on('catDodged', () => { if (++n.dodges >= 5) this.unlock('matador'); });
    ev.on('catTaunt', () => { if (++n.taunts >= 15) this.unlock('pest'); });
    ev.on('grannySearchSpot', ({ spot }) => { if (g.cat.hidden && g.cat.hideSpot !== spot) this.unlock('hide'); });
    ev.on('caughtEnding', () => this.unlock('cauldron'));
  }

  unlock(id) {
    if (this.run.includes(id)) return false;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return false;
    const isNew = !this.unlocked.has(id);
    this.run.push(id);
    if (!isNew) return false; // already earned in an earlier run: listed for this run, not announced again
    this.unlocked.add(id);
    this.fresh.push(id);
    try { localStorage.setItem(KEY, JSON.stringify([...this.unlocked])); } catch (_) { /* private mode */ }
    this.game.ui?.achievement(a);
    this.game.events.emit('achievement', { id, name: a.name });
    return true;
  }

  /** For the results screen: what this run earned (first-time unlocks flagged) and the overall count. */
  summary() {
    const byId = (id) => ACHIEVEMENTS.find((a) => a.id === id);
    return { run: this.run.map((id) => ({ ...byId(id), fresh: this.fresh.includes(id) })), got: this.unlocked.size, total: this.total };
  }

  list() { return ACHIEVEMENTS.map((a) => ({ ...a, got: this.unlocked.has(a.id) })); }
}
