# 13 — Full Prop, Breakable and Modular Destruction Asset Manifest

## Purpose
This is the **authoring inventory** so the agent does not forget that the entire cottage should feel interactive and disorderly. It is not a promise that every screw is independently simulated. Generate recognizable, cheap stylized prefabs in headless Blender or Three.js, repeat them in carefully staged compositions, and add visually different damage states. Register every breakable with a unique gameplay ID in the central destructible registry.

## Modeling style and performance constraints
- Distinct silhouettes first: warped beams, bulbous cabinets, leaning clock, pot-bellied cauldron, delicate chandelier, jagged old wood; believable materials second.
- Geometry: bevel low-poly primitives, box extrusion for planks, mesh bevel edges and cracked-overlay decals. House furniture must resemble *an eccentric witch's home*, not generic cubes. Add crooked trim, gothic handles, spiderweb patterns and worn wood.
- Common pottery/glass: intact mesh + 4–8 simplified shards/fragments on break; spawn no more than ~4 collision shards per item, rest as GPU particles.
- Furniture: `intact.glb` + `broken.glb` with pre-fractured 3–7 pieces; hinge/door may detach with Rapier rigid body. Chunk collider may simply be box/convex hull, not full triangle mesh.
- Structural modular pieces: create and register named bay supports with **authored weak points**; swap collision to predefined hole or damaged shape; keep collision backbone for safe navigation.
- Audio material tag and default collision scale are part of prefab data; place a varied number of repeats. Damage score and triggers come from *IDs*, not appearance.

## Inventory targets (P0=minimum, P1=core, P2=stretch)
| Zone | Object / prefab family | Place target | Damage tier | Implementation priority | Notes |
|---|---|---:|---|---|---|
| Foyer | Ceramic umbrella stand + umbrellas | 1+3 | A/B | P0 | tutorial smash, hide behind chest |
| Foyer | Teacup/vase small | 3 | A | P0 | first smash point popup |
| Foyer | Hanging coat stand | 1 | B | P1 | topple to block Granny temporarily |
| Foyer | Old mirror + wood frame | 1 | A/C | P1 | split glass VFX |
| Foyer | Portrait, eye glint | 2 | A | P1 | crack/swing, cursed gag optional |
| Foyer | Entrance shoes/hat | 3 | B | P2 | floating/wobble only |
| Dining | Round wooden table + chairs | 1+5 | C/B | P0 | SP01 impact landing |
| Dining | Dishware, plates, bowls | 12 | A | P0 | clustered cascade, instance/pool |
| Dining | Hanging chandelier + anchor | 1 | E/D | P0 | SP01 hero asset |
| Dining | Glass cabinet + shelves | 1 | C | P0 | collateral on chandelier impact |
| Dining | Bookcase + books | 1+10 | C/A | P1 | SP06 optional |
| Dining | Fireplace stone hearth | 1 | indestructible core | P1 | safe route; cosmetic soot |
| Dining | Fireplace iron tools | 3 | B | P1 | Granny weapon comic item |
| Dining | Tall candles + wax holders | 5 | A/B | P1 | knock-over VFX, no real combustion everywhere |
| Living | Grandfather clock | 1 | C/E | P1 | SP05 falling rail impact |
| Living | Picture frames | 4 | A | P1 | can chain into shelf |
| Living | Sideboard / upright piano | 1 | C | P1 | SP09 optional |
| Living | Books and potion bottles | 12 | A | P0 | easy feedback loop |
| Living | Old carpet/curtain strips | 3 | fabric | P1 | scratch/tear; no cloth physics necessary |
| Living | Sofa and side table | 1+1 | B/C | P1 | hiding and impact |
| Living | Ornate window panes | 3 | A | P1 | glass shards/wood frame |
| Kitchen | Kitchen counter w/ cupboards | 1+3 | C | P0 | many small collide/scratch surfaces |
| Kitchen | Ceramic pots/bottles | 10 | A | P0 | deliberate swat targets |
| Kitchen | Hanging pan rack + pans | 1+5 | B/C | P0 | dropped props and Granny projectile pickups |
| Kitchen | Coal stove/witch hearth | 1 | E | P0 | SP02 fire trigger |
| Kitchen | Herb bundles/curtains | 3 | fuel/fabric | P0 | fire transitions ember/charred |
| Kitchen | Copper cauldron + stand | 1 | B/E | P1 | SP08 cauldron roll |
| Kitchen | Spice rack / pantry shelf | 2 | C | P1 | plate avalanche |
| Kitchen | Sink/pipe/water valve | 1 | C/optional hazard | P2 | localized flood demo |
| Staircase | Main treads/landings | 2 runs | stable backbone | P0 | never destroy required traversable floor |
| Staircase | Banishable banister rails | 4 bays | D | P1 | falls into space beside staircase |
| Staircase | Carved support newel | 2 | D | P1 | Grandma-only weak point |
| Upstairs hall | Weak floor panels | 3 segments | D/E | P0 | SP03 floor breach, alternate route |
| Upstairs hall | Hanging paintings + candles | 4+3 | A | P1 | cat high route decorations |
| Bedroom | Wardrobe (heavy) | 1 | C/E | P0 | SP03 prime target |
| Bedroom | Bed + side tables | 1+2 | B/C | P0 | under-bed hide; pounce platform |
| Bedroom | Mirror, bottles, photo frame | 1+4 | A | P1 | easy smash |
| Bedroom | Curtains + tie | 2+1 | fabric | P1 | scratch to weaken tie |
| Study | Large cabinet/bookcase | 1 | C | P1 | secondary attack target |
| Study | Desk and chair | 1+1 | C/B | P1 | Granny tantrum can scatter |
| Study | Book stacks, ink bottles, cursed jars | 6+5 | A | P1 | small breakables |
| Study | Cat-shaped charm cage | 1 | C | P2 | extra companion cat rescue reward |
| Attic/eaves | Roof brace / weak rafters | 3 | D/E | P0 | SP04 finale, strongly readable |
| Attic/eaves | Hanging bells/charms | 5 | A/B | P1 | react to quake |
| Attic/eaves | Roof segment chunks | 5–8 | E | P0 | scripted major collapse physics pieces |
| Garden | Tall enclosing stone/ivy wall | all sides | stable | P0 | hide outside world, do not fully break boundary |
| Garden | Barrel, flowerpots, stones | 4+8 | B/A | P1 | wild chase obstacle course |
| Garden | Lumber stack/shed | 1+1 | C | P1 | SP12 optional event |
| Garden | Wheelbarrow | 1 | B | P1 | rolling physics havoc |
| Garden | Small greenhouse | 1 | E | P2 | SP10 optional |
| Garden | Twisted shrubs/vines/weeds | 10 | cosmetic | P1 | instanced or simple mesh |
| All | Doors + brass handles | 5+5 | C/B | P1 | swing open, scratch, partial crack |
| All | Ceiling timber supports/wall bays | 12–20 modules | D/cosmetic | P1 | only flagged weak modules detach |
| All | Dust/wood fragments/debris pools | pooled | cosmetic | P0 | recyclable, no repeat score |
| All | Grandma projectile props: pan, axe, spear | 3+ | B/D impact sources | P0 | CCD, weapon attach release events |

**The counts above describe a visually dense target, not a required number of unique 3D models.** A reusable plate instance can fill 20 placements with 1 mesh. If time is tight build 30+ breakable placements, 6 families and full P0 core first.

## The 10 unique geometry assets worth craftsmanship
1. Komur character (user-supplied rig, reworked material animation).
2. Grandma's witchy silhouette with distinctive shawl/apron/hat or hair.
3. Chandelier+ceiling anchor.
4. Oversized grandfather clock.
5. Stove/old coal hearth with believable fire emitter.
6. Huge wardrobe/bookcase which crashes through floor.
7. Central staircase and railing, including fracture sections.
8. Multi-state cracked floor and roof timber brace.
9. Crooked fireplace/witch cauldron.
10. Two-level wooden cottage envelope and its high enclosure wall.

Everything else can share 10–15 lightweight primitive prefab recipes and varied material colors/scales.

## Modular material response map
| Surface | Cat impact | Grandma heavy impact | Damage look | Sound |
|---|---|---|---|---|
| ceramic/glass | fracture | instant fracture | shards sparkle | glass/porcelain |
| soft wood | shove/scrape | crack/fracture | ragged splinters | crack + creak |
| heavy timber | scratch marks | damage stage / break if tagged | glowing fissures / snapped | deep wood fracture |
| metal | clang/roll | heavy collision | dents/sparks | resonant clank |
| fabric | scratch tears | gets ripped, catches fire only if tagged | torn strips/char | cloth tear/whiff |
| masonry | little impact | crack decal only | chipped stone | thud/grit |

## Build procedure from this manifest
1. Implement reusable material+mesh recipes for each archetype, generate variants with deterministic seeded randomness and clear pivot/collider positions.
2. Assemble house architecture on a 1m module grid (adjust to cat scale); add valid Grandma room waypoints, cat climb surfaces and named setpiece collision targets.
3. Instantiate prefabs from zone config. Register any `breakable=true` with damage and score data. Log totals `placedBreakables`, `archetypeFamilies`, `structuralWeakPoints`, `setpiecesBound` in dev console.
4. Create staging screenshots showing each room intact and after a test-disaster. Ensure readable pathways and no excessive clutter.
5. For any prefab that takes >20m to model, use a cheaper geometric proxy and return only after gameplay tests pass.

## Test geometry authoring before adding too much content
- Each room visibly communicates a cluster to smash and at least one strategic Granny target.
- Every setpiece has a visible tagged weak point, feasible cat standing position, and clear Grandma line-of-sight path.
- Each hero event has enough loose secondary props to cause impressive spectacle when it collapses (not a lonely falling cube).
- All three key attack families (swipe/pounce/Granny projectile) can interact with these assets and score provenance properly.
