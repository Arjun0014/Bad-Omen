# 02 — Two-Storey Cottage + Walled Backyard

## Level concept
Build **one contiguous playable scene** at stylized human scale, but lay it out around a tiny agile cat. The whole world fits inside a rectangular perimeter, with high stone walls, ivy, storm fog and black trees beyond the walls (facades only). **No exterior streaming/open world.** A compact, dense environment beats an empty mansion.

Recommended approximate footprint (adjust to cat model and engine): house **16m x 13m**, 2 floors ~3.1m each, ridge ~8m; courtyard **12m x 11m** behind; outer wall ~4–5m high. All dimensions provisional; require 20s traversal from furthest downstairs to furthest upstairs if sprinting.

## Schematic — top-down connectivity (not scale)

```
      CLOSED WITCHY COURTYARD / GARDEN (high perimeter wall)
      [shed/woodpile]   [glass greenhouse]   [well/barrels]
                         BACK DOOR
 +----------------------------------------------------------------+
 | KITCHEN / PANTRY            | STAIR / HALL  | LIVING / DINING    |
 | stove, sink, shelves       | clock, rails  | piano, chandelier  |
 | fire chain, cookware       | drop/ramp     | shelves, cabinets  |
 +----------------------------+--------------+--------------------+
 | FOYER / ENTRY              | LOUNGE / FIREPLACE, PORTRAITS       |
 | cat enters from porch      | cat-sized shortcut under furniture |
 +----------------------------------------------------------------+
                   STREET GATE LOCKED / OPENING CINEMATIC
```

```
              SECOND FLOOR (stair connects; cat shortcuts)
 +----------------------------------------------------------------+
 | UPSTAIRS BEDROOM   | LANDING / WEAK BALCONY | STUDY / WARDROBE   |
 | bed, chests, lamp  | chandelier below       | stacked books       |
 | hiding, climb      | collapse setpiece      | big throw target    |
 +----------------------------------------------------------------+
 | ATTIC-EAVE WALKWAY / BEAM PERCHES / ROOF BRACE (limited access)  |
 +----------------------------------------------------------------+
```

Optional 3rd height slice is *not* a real third floor: accessible attic beam walkway for cat, used only for final roof fracture. It may be a narrow high shelf under the roof.

## Mandatory zones and major fixtures

### Ground floor
- **Foyer:** tutorial vase, rug, boot stand, coats, stained window, Grandma intro line, accessible exit to courtyard through kitchen after tutorial.
- **Living/dining:** central fireplace, grandfather clock, chandelier over dining table, bookcase, glass cabinet, chairs, portraits, old grand piano-like bench / sideboard; many vertical routes.
- **Kitchen/pantry:** swinging cabinet doors, shelf racks packed with plates, hanging copper pots, cast-iron pans, cupboard cat hole, stove/coal hearth or enchanted brazier, old water pipe and sink, direct backyard door. This is the fire/water playground.
- **Central stairs:** generous run + mid-landing, wooden banister to smash, a reproducible Grandma nav path and cat shortcut through open gaps. Preserve an alternate safe route when rail drops.

### Upper floor
- **Bedroom:** bed and under-bed hide trigger, fragile mirror, stacked picture frames, curtains, drawers, lamp, wardrobe climb route.
- **Study:** large wardrobe/bookcase aimed toward weak balcony/landing floor, ink bottles/potion jars, desk, sliding chest, hidden cat collectible optional.
- **Landing:** guarded edge looking down into dining room; fractured floor panels; sturdy enough that cat and Grandma can't softlock when the large section breaks.
- **Attic beam strip:** final weak roof support, pitch-dark broken tiles, dangling charm strings, access by cat-only shelves; Grandma targets from landing/dining, not required to enter cat-only corridor.

### Backyard
- Enclosed `12m x 11m` overgrown garden with crooked hedge/ivy, crows, rain puddles, soil patches, barrels, shed/woodpile, wheelbarrow, overturned plant pots, optional glass greenhouse.
- Outer world invisible behind 4–5m perimeter wall. Curved/dark sky material, fog, nearby tree silhouettes within yard, loud thunder; never see roads/town. Free use of enclosed environment supports game-feel and performance.
- A cat-sized exit passage or safe final chair/perch. Grandpa escape not needed; Grandma evacuates to courtyard in story finale.

## Traversal affordances / playable geometry
- At least **3 ground-floor paths** from foyer to kitchen: corridor, dining side, tabletop/shelf high route.
- From downstairs to upstairs: full main staircase for cat/Grandma + optional shortcut by intermediate shelves/rail with mantle (can be partial).
- Cat can climb or jump onto kitchen counter, dining table, fireplace mantel, bookcase middle shelf, window sill, bed, wardrobe ledge. Mark collision ramps/surfaces explicitly; don't rely on small details as nav supports.
- Hiding spots: behind foyer umbrella chest, under dining table, under bedroom bed, behind garden barrel.
- Avoid invisible wall on large breakables. After collapse, rebuild solid collision based on damaged state, add ramps/planks so cat/Grandma still reach required objective zones.
- Grandma must use known coarse waypoint graph room portals + stairs; do not require expensive runtime navmesh rebuilding with every fragment.

## Art direction and palette
- **Architecture:** old timber-frame cottage, wide plank floors, exposed beams, cracked ochre plaster, slanted roof, worn stone chimney, curled wallpaper, carved doors, dusty glass, slightly crooked furniture.
- **Evil-comic witch details:** crow statues, bat silhouette, charm jars, spiderweb corners, living eyes in portraits, bubbling cauldron, crooked broom rack, glowing curse glyph near roof brace.
- **Lighting:** warm amber inside; teal/blue moonlight and rain outside; carefully used violet/green enchantment accents; volumetric-looking fog as cheap layered sprites, not GPU-heavy true volume.
- **Destruction readability:** fragile items glint, weak beams have recognizable glowing stress cracks, projectile trajectories have red/orange warning arcs. Cut polished surfaces before readability.
- **Performance:** use repeated meshes/instancing for common intact plates/wood planks, active physics only near player, pooled debris, LOD/simple proxy colliders; dynamic light count limited.

## Build strategy
- Geometry **modular**: floorTile, wallBay, beam, pillar, doorFrame, staircase, rail, roofPanel. Structural support marked with an authored ID and break thresholds.
- Assets source pipeline: headless Blender generates wooden beams, trim, props and fractured variants, exports grouped GLB assets; Three.js assembles scene from data. A procedural fallback generator in Three.js is acceptable if Blender isn't installed.
- Block out ALL rooms first with proportion + navigability; decorate after mechanics. Test camera and cat platform height after each architecture change.
