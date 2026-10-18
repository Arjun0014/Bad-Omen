# 04 — Authored Set Pieces, Chain Reactions and Cinematic Grammar

**Primary design insight:** the PLAYER decides where the large, telegraphed Granny attacks land. The player's fun is not a cutscene button. Each spectacle has a discoverable target, a bait action and a timing challenge; the 1–3s directed camera only celebrates a causal result.

## Common event contract
Every setpiece has `id`, `zone`, `priority`, `preconditions`, `weakPoints`, `triggerSources`, `telegraph`, `stages`, `score`, `cooldown`, `fallbackTimeout`, `cameraPath`, `exitSafePositions`, `changedColliders`, `completed`. Gameplay remains in full control until the successful trigger. When activated: mark atomic completion, protect cat+Grandma from lethal/hard collisions, run staged impacts with physics and particles, optionally 0.5x time scale for ~0.6s, camera tracks center for <=3s, return to latest valid gameplay camera, resume control. Skip action on Esc/Space if needed. Preserve props' destroyed state.

**UI:** provide subtle environmental clues (cracked trim, glowing stress crack, shaky fixture, little exposed hinge) and dynamically emphasize the impact point only when Grandma begins a heavy windup. *No invisible pixel-perfect targeting.* Allow a generous radius around weak spots.

## MVP setpieces — implement ALL 4 (3 chains + finale)

### SP01 — THE LAST SUPPER (Dining room chandelier)
- **Setup:** fragile chandelier with heavy iron frame above an old dining table; dangling support chain/ceiling anchor; plates on table and nearby glass cabinet. Cat can hop onto dining table and climb a counter/window sill.
- **Discovery:** chandelier squeaks and the anchor visibly cracks when the cat jumps onto hanging tassel. Old portrait hints 'Careful above the table'.
- **Trigger:** player taunts Grandma from the dining table and dodges as her **heavy thrown pan/axe** strikes within ~1.2m of the anchor. Alternate cat can scratch hanging cord first to reduce anchor threshold. A strong heavy impact is the key, never only a button press.
- **Reaction, 2.5s:** chain snaps -> chandelier crashes into table -> table breaks into 4 chunks -> plates launch/shatter -> lamp briefly flickers out -> Granny covers head while Komur lands on chair.
- **Score:** base unique props + 1,500 event + Granny collateral source bonus; ruin weight +~12.
- **After state:** hole/mark in ceiling, missing chandelier, shattered table; collision ring around table removed, cat route still available. If physics hangs, staged fracture at 1.2s.
- **Camera:** short low angle tracking falling fixture then snap to cat's smug face. **High reveal in trailer.**

### SP02 — THE KITCHEN CURSE (Fire chain)
- **Setup:** kitchen full of cookware, candles/coal stove, dry hanging herb bundles/curtains, loose iron pot, vulnerable overhead spice shelf. Fiery glow distinguishes flammable weak point.
- **Trigger:** cat swats/knocks a candle into nearby kindling or pulls an old lever, THEN Grandma chases/throws a cast iron pan at a cracked stove hood/pot rack, dropping burning embers onto the prepared fuel. Either ordering is accepted through an explicit two-key condition with forgiving timing.
- **Reaction, ~2s cinematic:** stove coughs sparks -> hanging herbs ignite -> pot rack tumbles -> dishes shatter -> burning zone expands over 1–2 minutes to a handful of safe surfaces. Granny yells and waves broom at the smoke.
- **Score:** 2,000 event + distinct destroyed items; +~10 ruin.
- **After state:** persistent contained stylized fire, soot, smoke, kitchen path partly blocked but stair/backyard route remains open. Cat has a safe passage along counter or upper shelves. The game never models real household fire chemistry or unrestricted propagation.
- **Trailer beat:** flame silhouette around Komur, who calmly meows.

### SP03 — THE BEDROOM BELOW (Wardrobe through floor)
- **Setup:** upstairs study/bedroom heavy wardrobe near obviously cracked landing floor, scattered books, vases below. One support timber visible through old floorboards.
- **Trigger:** Komur scratches old support binding / knocks door loose (primer) and taunts Grandma into an **axe or spear throw** at the wardrobe's weakened leg/support from line of sight. Alternatively Granny enraged charge hits wardrobe. A heavy attack knocks furniture against weakened floor.
- **Reaction, ~3s cinematic:** wardrobe tips -> splinters along floor seam -> 2–3 floor panels give way -> wardrobe and books crash down into ground-floor lounge -> mini shockwave scatters frames and ceramic objects -> dust plume reveals a dramatic hole.
- **Score:** 3,000 event + collateral; +~16 ruin.
- **After state:** persistent hole bounded by rails/safe collision; stair route preserved and cat gets an alternate broken-plank ramp near edge. Grandma can navigate via landing or remap to stairs. Falling into hole as cat is a safe tumble, not a softlock.
- **Camera:** overhead to falling furniture then lower-floor impact. **Best technical showcase.**

### SP04 — THE FINAL STRAW (Grandma-driven roof collapse)
- **Preconditions:** ideally Doom>=60, 2 nonfinal setpieces complete, Rage>=80. If run goes >8 minutes, use generous adaptive assistance; never make player spend 20 minutes farming plates.
- **Setup:** roof center brace and 2 cracked support indicators, overhead loose wood tiles, Grandma's final huge enchanted axe/spear with comically oversized windup, clearly marked impact plane. During setup play rumble/voice line: 'KEEP STILL, YOU LITTLE CURSE!'
- **Player action:** stand/move near visible brace marker as Grandma winds up, taunt, **dodge** sideways; she hurls weapon or swings into roof brace. Slight trajectory magnetism in last 0.3s ensures a visibly good dodge is successful. Not a passive progress-triggered collapse.
- **Reaction, 4–5s finale cinematic (exception to 3s rule):** brace snaps -> rooftop cracks in stages -> 4–7 large lightweight roof sections and pooled particle showers fall -> shelves tumble, dust/embers bloom, exterior chimney leans -> Granny dashes to yard as Komur springs to safe garden/window perch. Cat silhouette against broken roof and moon.
- **Ending:** Grandma is safe, looks back at the devastated home; Komur sits smugly. Grandma: 'I KNEW THAT CAT WAS BAD LUCK!' Komur inner voice: 'I barely lifted a paw.' Smash cut to score card.
- **Score:** +5,000 event; no per-debris score flood; + remaining structural ruin to ~85–95% feel. Do not actually remove global roof collision if it traps player in intro/outro.
- **Safety:** fully choreograph safe positions and post-camera placement. If Grandma can't reach anchor due to earlier damage, use an alternate marker and canned cast.

## Additional setpieces — data design now, build only after the MVP is stable

### SP05 — CLOCKWORK TANTRUM (Hall)
- Cat knocks a clock weight loose; Grandma's enraged charge knocks grandfather clock; clock hits rail/weak banister; rail splinters into stairs; rolling gears and ticking acceleration SFX. 1.5s focus, ~1,200 bonus. Stairs main walking surface unaffected.

### SP06 — THE BOOKCASE AVALANCHE (Living room)
- Cat pulls an exposed lace binding from tall bookcase; Granny hurls spear into support foot; shelves topple into display case, dishes and books scatter. 1.8s cinematic, +1,000, one route preserved.

### SP07 — BATH TIME FOR EVERYONE (Upstairs flooding)
- Cat paws a rusty water valve to loosen, Grandma throws axe through marked pipe, escaping water rains through floorboards to kitchen, wet floor leads to Grandma slip/slide and impact cabinet. Use a simple local animated water plane and splash sprites; +1,500.

### SP08 — THE CAULDRON ROLLS (Kitchen to courtyard)
- Cat pulls cauldron stand catch; enraged Grandma collides with a wheel/crate, cauldron topples and rolls, slamming into garden shed crates. Stylized purple smoke and squash/slosh VFX rather than fluid, +1,100.

### SP09 — THE PIANO OF DOOM (Lounge)
- Heavy throw clips suspension hinge on grand piano/sideboard, lid slams and keyboard/contents burst; falling frame hits table, eerie 3-note musical sting. +1,000. A cheaper replacement is an upright piano whose back panel drops.

### SP10 — GREENHOUSE HYSTERIA (Backyard)
- Grandma throws axe at taunting cat atop old greenhouse; cat dodges; thin wood/glass frame collapses into a heap of plants and shards with a burst of moths/particles. +1,400. Backyard is enclosed; no off-map debris.

### SP11 — WITCH'S WALL (Landing portrait)
- Cat swats a cursed portrait; eyes follow, weak magic seal appears; Grandma attacks picture/old wooden panel, hidden broom-and-bottle cupboard explodes in harmless green smoke, +700. This is a novelty scare/gag, not major structural drama.

### SP12 — GARDEN DOMINO (Yard firewood)
- Cat nudges small stone toward stacked lumber; Granny chases and kicks wheelbarrow; it rolls down garden slope into firewood stacks and fence decorations; wooden chaos spills without real boundary destruction, +800.

## Recommended implement order
1. SP01 for immediately rewarding trailer gameplay.
2. SP03 to prove multi-floor destruction and Grandma baiting.
3. SP02 for audiovisual fire spectacle and environmental dynamics.
4. SP04 final roof + story payout.
5. If >3 hours spare, SP05 and SP06 (cheap variants of known systems).
6. Only then SP07 water and SP10 greenhouse.

## Technical event/timeline example

```js
const setpiece = {
  id:'SP01', completed:false, primed:false,
  trigger:({event,state}) => state.primed &&
    ['granny_throw','granny_charge'].includes(event.source) &&
    isNear(event.worldPosition, anchorPosition, 1.2),
  timeline:[
    {t:0.00, do:'break_anchor'},
    {t:0.12, do:'release_chandelier'},
    {t:0.70, do:'break_dining_table'},
    {t:0.85, do:'dish_cascade'},
    {t:1.35, do:'dust_rumble'},
    {t:2.10, do:'return_camera'}
  ]
};
```

Add physical force/randomness within boundaries for variation; never let the authored outcome silently fail because a rigid body collided unpredictably.
