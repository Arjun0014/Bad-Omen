# 03 — Destruction, Physics, Fire, Water and Scoring Contract

## Architectural principle
**Simulate the parts the player touches; author the spectacles.** Almost all furnishings are interactable; fragile props genuinely use collision impulses. Large architecture transitions through a small number of stable predefined states. Full continuous house destruction with hundreds of live constraints is a time trap in a 24h jam.

## Five damage tiers
| Tier | Category | Example | Mechanism |
|---|---|---|---|
| A: fragile | plate, bottle, cup, crystal, window | cat paw | lightweight rigid body until impact threshold; particle glass shards + fractured asset |
| B: movable | chair, pan, crate, picture, book stack | paw/pounce/granny | dynamic rigid body, knock over, scatter, optional two-piece fracture |
| C: breakable fixture | table, cabinet, wardrobe, shelf, clock | repeated impacts or granny | fixture static/kinematic until HP exhausted; swap to 3–7 detached fragments |
| D: structural | banister, balcony panel, selected column, roof brace | primarily granny heavy attack | strict weak-point register; stages intact -> cracked -> broken; replace collider with fragments and safe navigation patch |
| E: authored spectacle | chandelier, upstairs floor rupture, roof fall | setpiece preconditions | timeline script coordinates several tier objects, camera/sound/time-dilation; low simulated debris count |

## Minimum object families and population target
At least **30 placed breakable instances** from at least **6 distinct families**. Aspirational density 60–100 placed objects with many reused families:
- 12–20 glass/ceramic vessels, 6–12 books, 8–10 portraits/windows, 6–10 chairs/stools, 3–6 shelves/cabinets, 3–5 tables/desks, 4–8 hanging/balcony/wooden structural features, 3–6 large mechanical fixtures (clock, chandelier, cauldron, pipe, stove, wardrobe), 6–10 garden objects.
- Minimum should prioritize repeated cheap instances and 6 clear audio/particle signatures over dozens of unique meshes.

## Unified data model
Every breakable registered by unique `id` and scene `zone`, never duplicate credit:

```ts
interface BreakableDef {
  id: string; zone: string;
  tier: 'fragile'|'movable'|'fixture'|'structural'|'spectacle';
  kind: string; maxHP: number; mass: number;
  hitThreshold: number; scoreBase: number; ruinWeight: number;
  intactPrefab: string; crackedPrefab?: string; brokenPrefab?: string;
  weakPoint?: boolean; requiresGranny?: boolean;
  setpieceId?: string; materialTag: 'glass'|'wood'|'metal'|'ceramic'|'fabric';
  chainTags?: string[];
}
interface DamageEvent {
  targetId: string; amount: number;
  source: 'cat_swipe'|'cat_pounce'|'granny_throw'|'granny_charge'|'falling_prop'|'fire'|'water'|'script';
  parentEventId?: string; worldPosition: [number,number,number]; tick: number;
}
```

Data-driven type is illustrative: implement JavaScript/TypeScript in the real repo and keep object mappings and runtime state consistent.

## Impact algorithm
1. Rapier rigid-body collision event supplies collider handles; pair maps to registered object. For force/intensity, use contact force events where configured or relative-speed + mass approximation. Do not treat a generic overlap as heavy impact.
2. Enqueue normalized `DamageEvent` with source provenance, tick, cooldown. Cat's pounce directly applies impulse/damage to target. Grandma heavy throws apply substantially higher impulse or explicit support hit.
3. On damage threshold update one or more stages and event tags; fracture replacement once; spawn particles and selected debris; remove/rebuild colliders properly; award **exactly one destruction score** on first permanent break.
4. Dispatch chain trigger to authored setpiece controller for linked targets. Use queue depth guard and event budget per frame so no infinite recursion or browser stall.
5. Persist changes for remainder of run; save snapshots for QA/debug. No need disk save across restarts.

## Grandma vs Komur destruction contrast
- Cat swat: fragile items, paintings, dangling handles, taps switches.
- Cat sprint/pounce: small furniture, tableware, curtain ties, cracked door, critical distractions.
- Granny's cast-iron pan: cabinets and weaker structural stress marks.
- Granny's axe/spear: upper rail, wooden post, hanging-chain anchor, cracked floor, roof brace. Heavy attack windup and trajectory preview; **player baits these**.
- Grandma's charge/broom tantrum: mows movable furniture, smashes tables and shelves; can trigger domino cascades.
- Heavy pieces falling from above transfer impact to smaller objects below and optionally one linked structural target.

## Apparent 'whole house destructibility' without simulating everything
- Author modular, visible `damageStates` for every major wall/beam/door/floor tile, but only 6–10 principal supports need true break transitions. Other planks can decal crack/scorch, shed boards, rattle and replace texture/material on proximity or ruin %. This keeps the house looking devastated even if the load-bearing navigation backbone survives.
- Structural states: `intact`, `splintered`, `shattered`, `removed`. Define exact per-section stage, attached shards and collision swap. Never change main stairs so nobody can finish.
- Cosmetic ruin/tilt stage applied throughout house when Doom thresholds cross 20%, 45%, 70%: peeling wallpaper, dust plumes, creaks, falling ornaments, flickering lamps, exposed beams. One global threshold affects ambience, not score.
- Every chain reaction should have an authored fallback if physics stalls (e.g. chandelier clips on table). Time out and snap break to intended result after 1–2s, retaining particles/impact for believability.

## Fire hazard: GAME-LEVEL, not CFD
- Selected zones/subcells: `UNLIT`, `EMBER`, `BURNING`, `CHARRED`. Fire starts from authored kitchen lamp/stove event or thrown object striking flammable curtains. Optional deterministic propagation to 2–5 adjacent combustible props every 5–8s. Limit active fire clusters ~8.
- Visuals: low-poly flame billboards/mesh planes, emissive orange edges, smoke sprite strips, scorch material, crackle SFX, heat shimmer optional. Fixed particle pool 150–300 max in close area; avoid dozens of dynamic lights.
- Gameplay: burning zones lower traction/deny hiding, singe props, frighten Grandma, force reroute; cat coughs and darts safely away. **No graphic animal injury, no loss-of-life objective.** Grandma pathfinding can retreat to courtyard if all safe routes close. Fire never softlocks required end objective.
- Spread is **authored/limited** rather than burning unlimited connected real-world planks. Main structural collapse still triggered via authored conditions.

## Water / flooding: stretch after playable build
- Upstairs pipe/sink break or kettle spill starts shallow animated water plane in one or two room sections; timed expansion 0–10cm, visible splashes, drip decals, wet footfall, floating lightweight props if desired. No volumetric fluid solver.
- Fire/water interaction: in overlapping authored area, water extinguishes ember/burning state (neat tactical comedy beat). Slippery floor can send Grandma skidding into a cabinet, at most one robust gameplay modifier.

## VFX/SFX/comedy rules
- Distinct wood crack, porcelain shatter, metal clang, glass cascade, heavy rumble and animal scramble. Impact shake scaled by distance+size; localized dust puff, splinters, sparks. Floating scores must not flood screen: aggregate score events within 0.2s.
- Cinematic collapse can freeze/reduce simulation to 0.4x briefly and camera pan while player input pauses, then re-enable controller and ensure collision at correct state.
- Maintain stable frame budget, cap active rigid bodies and shard count, sleep distant bodies, garbage-collect pooled debris after 5–10s while retaining broken fixture state. Debris removal may not undo damage score.

## Destruction QA invariants
1. Any intact object only awards its value once.
2. Grandma projectile collider properly changes/recycles on stuck/disintegrated projectile.
3. Cat always has an exit route from any upper/lower room after trigger.
4. Triggering fire then water or doing roof early/late must not crash.
5. Triggered cinematic never leaves character or camera disabled.
6. Grandma cannot be permanently trapped by newly dropped debris; warp to sensible checkpoint when navigation is unrecoverable, off camera.
7. Final cutscene safe even if every prop is already broken.
