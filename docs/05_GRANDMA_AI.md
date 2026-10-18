# 05 — Grandma AI, Rage, Projectiles, Pursuit and Catching

## Character design
A witchy old woman with perhaps goblin-like angular features, apron or shawl, angry posture, huge gestures, and broom/weapon rack. Can be legitimately menacing for a moment then hilariously melodramatic. An emotional, voiced, animated character rather than generic chase capsule. Grandma's powers cause damage to *property*, not to the player in a graphic way.

**The player wins by steering Grandma.** Aiming the thrown heavy objects at structural weak points should demand spatial positioning and timing but offer generous telegraphs.

## States and transitions

```text
          suspicious noise / meow
PATROL ----------------------------> INVESTIGATE
  ^                                     |
  | timeout / calm                       | line of sight
  |                                     v
SEARCH <--------------------------- CHASE / THREATEN
  ^           lost sight                  |
  |                                       +-> THROW_WINDUP -> THROW_RELEASE -> RECOVER -> CHASE
  |                                       +-> SWING -> RECOVER
  |  post-impact                          +-> RAGE_TANTRUM -> STUNNED/RECOVER
  +---------------------------------------+
                    catch near target -> CAT_CAUGHT (brief) -> SEARCH

                Final trigger -> FINAL_ATTACK -> ESCAPE -> OUTRO
```

Represent per-state behavior, animation, sound cooldown, last known cat position, path waypoint, current target, Rage, and carried projectile. Don't rely on generative language at runtime.

## Perception
- **Sight:** 90–130 degree forward cone, 9–15m range, line-of-sight raycast through collision-filtered static geometry; fails if cat fully hidden under defined hide spot; decreased in smoke.
- **Hearing:** impact events emit radius based on noise category; glass shatter ~9m, heavy cabinet collapse ~18m, Komur `F` meow 12m, pounce impact 6m. Grandma investigates nearest recent loud event; inspect even if cat vanished.
- **Memory:** pursue last known location for 5–8s after losing sight. Search near hideables and mutter clues. Return to patrol only after deliberate cooldown.
- **Navigation:** coarse room portal/waypoint graph for kitchen, foyer, stairs, landing, study, yard, bedroom. Within room steering/collision avoidance and separation from large debris; use a small obstacle map, not expensive dynamic navmesh rebuilding. If stuck >2s, use alternate waypoint; if >5s and off-camera, place near a legal room waypoint. Never teleport in player's face.

## Grandma Rage thresholds (example, tune)
| Rage | Phase | Grandma behavior | Throws |
|---|---|---|---|
| 0–24 | Suspicious | mutters, checks noises, broom carry | none |
| 25–49 | Hunting | fast walk/chase, sweeps furniture unintentionally | broom shove / tossed teapot occasionally |
| 50–74 | Enraged | more direct chase, faster recovery, loud swearing | cast-iron pan and heavy pot, ~1 every 6–9s |
| 75–89 | Furious | aggressive pathing, threatening telegraphs | **axe** and **garden spear/pitchfork**, ~1 every 5–7s |
| 90–100 | Meltdown | theatrical tantrum, costly miss damage, large final attack eligible | giant enchanted axe or heavy charge, 5–6s telegraph/cooldown |

Rage example events: +5 small break heard, +8 medium break, +12 high-value household item, +6 meow in range, +8 successful close dodge after throw, +1 per second visible chase; decay -0.6/s when searching, -1.5/s while fully idle. Clamp 0–100. Avoid needing repetitive grinding: after first big setpiece raise minimum Rage floor to ~35, after second ~60.

## Attack grammar / fair telegraph
1. Grandma picks an attack based on Rage, line of sight, relevant weak-point availability, and current objective. Pause movement, face cat, wind up with strong silhouette for 0.65–1.3s.
2. A **red/orange dotted arc, sweeping danger cone or temporary floor marker** conveys projected impact. Cat can still move/act while Grandma winds up.
3. Calculate target from Komur's **recent position**, not unerring future position. Slight predictive lead, limited randomness; add impact snapping/magnetism only for *author-visible marked weak points* when the player successfully positions and dodges.
4. On release, detach held projectile from hand bone, create Rapier rigid-body (speed 12–20m/s tuned to house scale) with CCD if fast, register source `granny_throw`, impact sound and material-specific effects. Thrown axe/spear can stick temporarily into wood; can be recycled after 5–10s.
5. **The cat can avoid attacks** by running perpendicular, jumping, jumping through cat-only opening, ducking behind table, or pouncing. Collision causes comic 'caught/tumbled', small penalty, brief immunity and recover, not lethal damage.
6. A successful near miss into weakened scenery yields strong immediate feedback `GRANNY DID IT! +...`. Grandma briefly gasps at her damage, then blames cat and becomes angrier.

## Heavy attack varieties
- **Broom swipe (phase 1):** 120deg horizontal telegraphed arc, knocks over chairs and pots, reaches close range only. Cannot take down final beam.
- **Pan toss (phase 2):** broad projectile short arc, shatters cabinet; readable thunk. Can start SP01.
- **Rusty axe (phase 3):** heavy straight/arc throw, knocks loose structural braces, can stick into wall. Cartoon oversized, no gore.
- **Witch spear/pitchfork (phase 3):** straighter faster throw, good for visible weak-point targeting; slower windup and more obvious dodge line.
- **Tantrum/charge (phase 4):** Grandma pounds ground with broom / charges into a tall fixture, affects broad light furniture cone, punishes poor positioning but causes chaos.
- **Final enchanted axe (unique):** scripted heavy windup, player must bait and dodge; structural roof break leads into authored outro.

## Catching and hiding
- Cat caught when close contact + Grandma in non-recovery state + grab animation reaches its contact frame. Avoid catching through wall or while hidden; add 0.6s warning reach.
- Catch animation: Grandma triumphantly grabs scruff, Komur squirms, screen snaps to safe nearby perch, Granny grumbles; subtract ~400 points and reset combo. 2s max downtime, temporary invulnerability 1.5s.
- Hide spot is volume with entry/exit animation; cat can peek/rotate camera. Grandma searches nearest last-known hiding spot if suspicion high, with audible footsteps. Don't invent physically impossible hiding: visible under-bed collision clearance and room to leave.
- Design chase so Cat is faster on direct ground run; Granny threatens by forcing obstacle navigation and throws. This produces fun pursuit rather than unfair unavoidable grabs.

## Grandma 'self destruction' feedback
Every Grandma attack checks impacted property and damage provenance. If she destroys valuable object, she reacts, e.g. `[horrified] MY GRANDFATHER'S CLOCK! YOU MADE ME DO THAT!` A unique gag for first three setpieces sells the game's premise.

## Safety, recovery and optimization
- Grandma cannot perish, burn alive or be physically buried. During setpiece give a short invulnerability/cinematic safe waypoint; when fire spreads, she coughs/evades to adjacent room; during finale she exits yard.
- While physics activates hundreds of fragments, Grandma motion uses simple capsule steering/animation instead of full ragdoll.
- Cache line of sight checks at ~5–10Hz while close; full AI state update 10–20Hz, smooth transform/animation each render frame. Fixed physics tick.
- Implement debug HUD toggles: state, Rage, target, hearing event, path node, intended throw point, cooldown. Remove behind debug flag in release.

## Must-pass acceptance tests
- Meow behind wall attracts only if radius and attenuation allow; Grandma walks toward proper room waypoint.
- Grandma can navigate ground -> stairs -> upstairs and back and reach the garden.
- Cat can escape, hide, and be caught once without permanently losing controls.
- At Rage 80, an axe or spear lands on a weak beam and breaks it; provenance awards Granny damage.
- Roof finale fires when conditions are met regardless of whether some furniture is already broken.
