import { describe, it, expect } from 'vitest';
import { ScoreKeeper, RageMeter, finaleReady, RULES, isGrannySource } from '../src/game/Rules.js';

describe('ScoreKeeper', () => {
  it('awards each property only once (no duplicate farming)', () => {
    const s = new ScoreKeeper();
    expect(s.award({ id: 'vase_1', base: 50, source: 'cat_swipe' })).not.toBeNull();
    expect(s.award({ id: 'vase_1', base: 50, source: 'cat_swipe' })).toBeNull();
    expect(s.score).toBe(50);
    expect(s.breaks).toBe(1);
  });

  it('doubles Grandma-caused destruction', () => {
    const s = new ScoreKeeper();
    const r = s.award({ id: 'cab', base: 600, source: 'granny_throw' });
    expect(r.granny).toBe(true);
    expect(r.points).toBe(1200);
    expect(s.grannyBreaks).toBe(1);
    expect(isGrannySource('granny_charge')).toBe(true);
    expect(isGrannySource('cat_pounce')).toBe(false);
  });

  it('builds combo multiplier within the window and caps at 5x', () => {
    const s = new ScoreKeeper();
    const mults = [];
    for (let i = 0; i < 10; i++) {
      mults.push(s.award({ id: 'p' + i, base: 100, source: 'cat_swipe' }).multiplier);
      s.update(1.0);
    }
    expect(mults.slice(0, 7)).toEqual(RULES.comboSteps);
    expect(Math.max(...mults)).toBe(5);
    expect(s.maxMultiplier).toBe(5);
  });

  it('combo expires after the window', () => {
    const s = new ScoreKeeper();
    s.award({ id: 'a', base: 100, source: 'cat_swipe' });
    s.award({ id: 'b', base: 100, source: 'cat_swipe' });
    expect(s.multiplier).toBe(1.5);
    s.update(RULES.comboWindow + 0.01);
    expect(s.multiplier).toBe(1);
    const r = s.award({ id: 'c', base: 100, source: 'cat_swipe' });
    expect(r.multiplier).toBe(1);
  });

  it('catch penalty resets combo and never goes negative', () => {
    const s = new ScoreKeeper();
    s.award({ id: 'a', base: 100, source: 'cat_swipe' });
    expect(s.caught()).toBe(100);
    expect(s.score).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.catchCount).toBe(1);
  });

  it('chained set pieces get a bonus', () => {
    const s = new ScoreKeeper();
    s.award({ id: 'SP01', base: 1500, source: 'granny_throw', setpiece: 'SP01', ruin: 12 });
    s.update(5);
    const r = s.award({ id: 'SP03', base: 3000, source: 'granny_throw', setpiece: 'SP03', ruin: 16 });
    expect(r.chainBonus).toBe(RULES.setpieceChainBonus);
    expect(s.setpieces).toEqual(['SP01', 'SP03']);
    expect(s.ruinPercent).toBe(28);
  });

  it('ranks by score', () => {
    const s = new ScoreKeeper();
    expect(s.rank(0)).toBe('Mildly Inconvenient');
    expect(s.rank(250000)).toBe('BAD OMEN');
    expect(s.rank(100000)).toBe('Menace');
  });
});

describe('RageMeter', () => {
  it('clamps, respects floors and reports phases', () => {
    const r = new RageMeter();
    r.add(30);
    expect(r.phase).toBe(1);
    expect(r.checkPhaseUp()).toBe(1);
    r.add(200);
    expect(r.value).toBe(100);
    expect(r.phase).toBe(4);
    r.setFloor(60);
    r.add(-100);
    expect(r.value).toBe(60);
    r.decay(100, 'idle');
    expect(r.value).toBe(60);
  });
});

describe('finaleReady', () => {
  it('requires ruin, set pieces and rage, with adaptive relaxation', () => {
    expect(finaleReady({ ruinPercent: 60, setpiecesDone: 2, rage: 80, elapsed: 100 })).toBe(true);
    expect(finaleReady({ ruinPercent: 30, setpiecesDone: 2, rage: 80, elapsed: 100 })).toBe(false);
    expect(finaleReady({ ruinPercent: 40, setpiecesDone: 1, rage: 55, elapsed: 600 })).toBe(true);
  });
});
