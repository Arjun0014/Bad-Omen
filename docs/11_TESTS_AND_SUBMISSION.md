# 11 — QA Matrix, Judging Plan, Gameplay Video, Pitch and Submission

## Practical acceptance checks
Automation and/or manual browser walkthrough on actual production build. Mark each `PASS/FAIL/NOT TESTED`; never convert not-tested to passed merely because build succeeds.

### Cat and movement
- [ ] Cat shows correct black fur, white paws/chest/tail tip and amber eyes; model rig not T-posing.
- [ ] Cat idles, walks, sprints, jumps, pounces, swats, crouches, taunts with readable movement.
- [ ] Sprint/jump feels responsive: no WASD stutter, no camera clipping, no horrible foot-slide, jump works near edges (coyote/buffer).
- [ ] Cat can hop onto dining table, kitchen counter, up stairs, onto bedroom furniture; mantle works on marked edges.
- [ ] Camera remains usable close to walls, stairs, courtyard and after cinematic.

### Destruction and score
- [ ] 30+ breakable instances across >=6 archetype families; every object has distinct permanent damage state.
- [ ] Cat directly breaks small items; pounce knocks furniture by physics; particles/audio match material.
- [ ] Grandma attack breaks a fixture/weak beam, triggers `GRANNY DID IT` bonus.
- [ ] Duplicate debris collisions never award the same object twice; combo expires and maxes correctly.
- [ ] Chandelier/floor/kitchen hero events each run exactly once, have sound/camera, leave the world altered.
- [ ] Fire spreads only among authored local targets; game remains passable after ignition; fire sound persists as needed.
- [ ] Final roof collapse works even if scene props are pre-broken; handles skipped cinematic and safety properly.

### Grandma
- [ ] Detects sound or line of sight, chases, loses target, searches, reacquires.
- [ ] Moves from foyer to kitchen, up and down stairs, outside to garden without indefinitely stuck.
- [ ] Rage visible and threshold changes real attack logic.
- [ ] Pan/axe/spear throws telegraph >0.6s, use animation release event, collide with intended targets.
- [ ] Cat can dodge, hide, get caught, recover without losing all run progress.
- [ ] Grandma doesn't walk into active fire forever; during finale, she is narratively safe outside.

### User experience and tech
- [ ] Title + Start -> short skippable intro -> controls -> 7–10 min playable run -> end card -> Restart.
- [ ] Dialogue/subtitles match events; mute toggle works; no overlapping voice spam; scene sound effects distinct.
- [ ] Pause/Resume, focus loss, pointer lock, browser resize, no error spam or uncontrolled physics explosion.
- [ ] Actual `npm run build` and `npm run preview` work; no external/private API keys in `dist`.
- [ ] Browser runs after refresh / online static asset fetch, console has no fatal error and assets load.
- [ ] On modest desktop, scene stays responsive during big debris/cutscenes; frame spike brief and bounded.

## Smoke route through game (7 min)
1. Start game, see Komur model, walk/jump to table; smash tutorial vase; score rises.
2. Meow; Grandma investigates; sprint past her; use hiding spot; verify search then chase resumes.
3. Raise Rage to heavy throw, bait at SP01 chandelier, dodge, see staged destruction+score.
4. Enter kitchen; trigger embers/Granny hit for fire SP02; run upstairs and verify fire doesn't softlock.
5. Break study binding, bait Grandma heavy axe to tip wardrobe through floor SP03; navigate the new hole.
6. Bring Rage to final threshold, bait final hit on roof brace, see collapse and punchline.
7. Result screen displays rank/score, personal best if implemented; replay resets score, props, Rage and hazard.

## Bugs that block submission (P0)
Cat invisible/T-pose/falls through floor; input broken; scoreboard never updates; Granny cannot chase/hit props; critical doors/stairs blocked; finale impossible; missing assets crash startup; build fails; controls locked after cinematic; unhandled JavaScript errors; deployment not actually accessible.

## Judging pitch deck (5 slides, or 5-minute live pitch)
**Slide 1 — BAD OMEN:** big screenshot of black cat/witchy cottage. Logline 'Use Grandma's anger to destroy her house.' Logo/title/one short sentence.

**Slide 2 — The mechanic:** show loop **TAUNT -> DODGE -> GRANNY SMASHES -> COMBO**. Explain that the cat cannot directly break the big beams; the angry homeowner does it for him. Show a trajectory graphic screenshot.

**Slide 3 — Technical creative execution:** 3D browser, rigged cat movement, Grandma state machine, physics-based breakables, staged chained house destruction, dynamic fire and expressive voiceover.

**Slide 4 — Progression and replayability:** 2 floors + garden, increasing Rage, escalating throwable weapons, 3+ hero setpieces, persistent visible destruction and score multipliers.

**Slide 5 — Why Komur matters:** black cat superstition subverted, the cat's agility/taunt is the mechanic, comedic outro about who really caused bad luck. Show final wreckage screenshot; controls + playable link + credited assets.

If slides must be produced as actual PPTX/PDF later, use appropriate artifact tools; for now this MD document supplies deck content. Do not spend the jam trying to make a complex slide deck before the game is playable.

## Gameplay video — ~60 seconds (record early)
- **00:00–00:05** Komur leap onto dining table, title overlay 'BAD OMEN'.
- **00:05–00:13** swat dishes, rapid cuts, combo counter and breakage SFX.
- **00:13–00:23** Grandma appears furious; quick taunt/cat dodge, giant pan/axe whoosh destroys a weak fixture. Overlay 'MAKE HER MAD'.
- **00:23–00:36** chandelier cascade: slow-mo impact and smiling/smug Komur.
- **00:36–00:45** kitchen fire, upstairs leap, floor breach and debris fall. Overlay 'BREAK EVERYTHING'.
- **00:45–00:56** final enraged throw, roof collapse, Granny's final line and cat's dry quip.
- **00:56–01:00** scoring card, playable link/credits, 'ONE CAT. TWO FLOORS. NO DEPOSIT REFUNDS.'

Capture gameplay, not only cinematic screenshots. Prefer 1080p or 720p desktop capture, 30fps minimum. Trim/cut using whatever local tool is available; if none, record a live 1-minute single take plus title card. Gameplay video must be accurate to implemented mechanics, not rendered concept promises.

## Ready-to-use project submission copy

**Title:** BAD OMEN

**Genre:** Third-person 3D physics comedy / chaotic arcade sandbox

**Short description (2 sentences):** You are Komur, a mischievous black cat trapped inside a witchy Grandma's wooden cottage. Run, leap, smash everything you can—and bait her into doing the BIG destruction for you.

**Full description:** In BAD OMEN, a superstition-obsessed Granny has finally caught a black cat inside her house. Bad idea. Explore a two-storey cottage and enclosed garden, pull off feline parkour, break furniture, and deliberately raise Grandma's anger until she starts throwing heavy objects. Dodge her attacks so they crash into unstable fixtures, unleash wild chain reactions, and trigger spectacular house-wide disasters. How much destruction can one tiny cat blame on a furious Grandma? Built as a solo game-jam entry in Three.js, Rapier and Blender with licensed/pre-made base assets and newly created gameplay/systems during the jam.

**Controls:** WASD move; mouse camera; Shift sprint; Space jump; left click swat; right click pounce; E interact/hide/scratch; F meow/taunt; C crouch; Esc pause.

**Credit statement:** Clearly credit original cat model/author, Mixamo character/animations, CC0 environmental/voice/SFX sources as documented in generated CREDITS.md. Do not claim all source character art was original to this jam.

## Submission checklist
- [ ] Game URL or downloadable desktop build; private/incognito browser access verified.
- [ ] Start-to-finish gameplay screen-record and exported MP4.
- [ ] Title/description, engine/technologies, cat role, gameplay instructions, screenshots and credits.
- [ ] Simple 5-slide pitch deck or equivalent PDF (if required).
- [ ] Reconfirm official submission form fields directly before upload; don't invent required metadata.
- [ ] Upload with at least 30-min margin ahead of **15:30 IST** cutoff; video deadline **16:30 IST**, but try to submit it with project if possible.
