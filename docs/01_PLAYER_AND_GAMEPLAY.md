# 01 — Player Controller, Progression, Scoring, UX

## Core moment-to-moment loop
**Spot fragile objects / dangerous weak points -> sprint, jump, swat or scratch -> make noise -> bait Grandma into pursuing or throwing -> dodge at last second -> heavy impact breaks a larger object/support -> cascading set-piece -> collect a score combo -> escape/hide -> find the next opportunity.**

The cat can create real physical destruction by himself. However, the **largest reward tiers require Grandma's strength** or a staged disaster. A run should always contain many small, spontaneous unscripted accidents even between set pieces.

## Controls, default PC
| Input | Command | Design detail |
|---|---|---|
| WASD | Run, camera-relative | Direction change snappy but not instantaneous at maximum speed |
| Mouse | Orbit/aim camera | pointer lock, mouse sensitivity in pause menu |
| Left Shift | Sprint | no stamina bar, burst of acceleration, increases pounce impact |
| Space | Jump/hold for variable height | grounded/coyote/buffer; auto mantle eligible low ledges |
| LMB | Paw swipe | small impulse near paw; target highlight only within short reach |
| RMB | Pounce/dive | powerful forward leap, cooldown ~1.0s, physical impulse on impact |
| E | Context action | scratch, pull, interact, hide/unhide, push special object |
| F | Meow/taunt | raises Rage, attracts Grandma, audible radius; ~2.5s cooldown |
| C/Ctrl | Crouch | under-bed / through vents / cautious movement |
| Esc | Pause/settings | restart, sound, sensitivity, credits |

Keyboard `R` (unstuck to safe perch) can be included in settings/debug but avoid obvious exploit; penalty resets combo. Controller support and mobile can be cut.

## Locomotion specification
- **Scale:** cat shoulders about 0.4m, collision capsule (or tuned box) about 0.35m high, body ~0.5–0.7m long. Tune after mesh inspection; do not blindly multiply imported scale.
- **Speed targets** (tune after playtest): jog 3.2–4.0m/s; sprint 5.0–6.0m/s; crouch 1.5m/s. Acceleration approx 15–24m/s² and stronger braking. Pounce 6–8m/s horizontal and a modest vertical boost. Do not simply copy these constants without measuring room scale.
- **Jump:** responsive takeoff; coyote time 0.10–0.14s; input buffer 0.10–0.14s; short tap vs held jump. Apex ~1.0–1.4m; horizontal control in air. Landing anticipates from downward velocity.
- **Ledge/mantle:** auto-detect reachable ledge with head clearance and upward clearance, smoothly move collision controller for ~0.2–0.35s and play animation. No impossible need to manually aim at the precise edge.
- **High perches:** tables, counters, shelves, chair arms, window sills, railing and mantelpiece are cat paths, not decoration. Level layout must include surfaces with known heights and recoverable routes. Avoid unintentional pixel-perfect parkour.
- **Impact:** a sprint-pounce should dent weak panels / explode a dish rack, not bulldoze a 200kg wardrobe. Swat impulse low; scratch sustained damage to curtains, wallpaper, old bindings.
- **No death:** falling from a high perch produces tumble/land then controls return; Grandma catch: comical brief grab/screen wipe, cat relocates to nearby safe spawn; combo resets and score penalty of 300–500. Never reset entire run.

## Camera
Third-person spring camera ~1.8–3.5m behind and slightly above cat; camera offsets up on low obstacles/stairs and backs off for fast running. Collision ray/spherecast keeps camera outside geometry. Manual orbit mouse; soft recenter behind sprint direction; avoid disorienting camera cuts except cinematic set-piece moments. Sprint FOV pulses 2–5 degrees, light camera shake on major impacts. Disable intense shake under comfort option if fast to implement.

## Interactions
- Swipe broad small cone, short cooldown, direct prop collision cue.
- Pounce hitbox speed-scaled; impulse transfers to rigid bodies; onHit can activate weak prop with impact threshold.
- Scratch requires near range, 1–2s hold with interruptibility, tears curtains / weakens wooden rope ties / opens cat-sized escape holes.
- Taunt emits sound event to Grandma, raises rage, briefly reveals trajectory of next heavy throw at appropriate Rage; real payoff and risk.
- Hide spots: under bed, under table, inside dark open cupboard, behind backyard barrel. Hiding lowers visibility; Grandma can inspect the last known spot, so not a free stealth bypass.

## Two interacting meters
**Grandma Rage (0–100):** increases when objects break in sight/hearing, player meows near her, she is tricked into missing or losing the cat; decays gradually when idle. Controls aggression and attack selection. Rage is not merely UI: new types of heavy attacks activate at 50 and 75.

**House Doom / Structural Ruin (0–100):** weighted permanent damage of authored objects, supports and setpieces. Not calculated per mesh triangle. Controls environment appearance, music stingers, and eligibility for final collapse; the player should understand how much trouble they've caused.

## Score and combo
Example data-driven base values, tune after testing:
- Plate/book/bottle smash: **50**. Window/portrait: **150**. Table/chair: **250–350**. Cabinet/wardrobe: **600**. Major support: **900–1,200**. Hero setpiece: **1,500–3,000**. Final collapse: **5,000**.
- If another **unique property event** occurs within 4s, combo step increases multiplier from 1.0 to maximum 5.0; reset on timeout/catch. HUD flashes `x2 — CHAIN REACTION!`.
- Any damage sourced from Grandma's projectile or chase collision gets **2x 'GRANNY DID IT' bonus** on that event (not both base property damage and debris copies).
- Structural ruin is scored only once per asset ID. Pieces spawned after fracture are cosmetic/physical, **no duplicate score farming**. Rate limit repeated scrape/collision events.
- Award extra score for two setpieces chained within 12s, if doable. Personal best in localStorage (optional) and rank: Mildly Inconvenient < Menace < Curse < **BAD OMEN**.

## Win/lose conditions
- Primary goal: cause **enough weighted structural ruin** and trigger 2–3 major disasters to unlock finale. Suggested unlock condition: 60% weighted ruin + 2 setpieces completed + Granny Rage >= 80. Tune so novice can complete 8–10min without exact route.
- Final cue displays: `THE LAST SUPPORT IS CRACKING — MAKE HER MISS!` and a strong glowing weak point. Player must dodge a heavily telegraphed attack toward it. Provide aim assist or scripted final trajectory to avoid frustration.
- Player can keep breaking for better score; gently escalate prompts. No hard fail timer except optional arcade challenge mode (cut for jam).
- Final result card: total score, max combo, Grandma-caused damage%, intact furniture count, completion time, rank, restart.

## Readable tutorial embedded in first scene
1. `WASD + MOUSE: MOVE` near foyer. Show obvious vase on table.
2. `SPACE: JUMP` to tabletop. `LMB: SWAT` vase. SFX + big point popup.
3. Grandma enters, speaks, Rage appears. `F: MEOW TO TAUNT` while standing near fragile shelf. She charges.
4. `RMB: POUNCE / DODGE HER THROW!` and arrow target marker on weak cabinet.
5. First mini explosion as she breaks it. Text: **SHE'S THE WEAPON. YOU'RE THE AIM.**

## Nice-to-have extra cats
One trapped cat in upstairs closet can be freed for bonus. Keep it as a passive companion perched at the window, not a second full AI simulation, if time permits. Komur remains the playable star.
