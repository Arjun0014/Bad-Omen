# 06 — Headless Blender: Komur Cat + Grandma Animation Plan

## First task is real rig inspection, not blind animation generation
User supplies cat as `.blend` with a skeletal rig and some base idle/look/sit/stand/walk actions. **Mixamo does not solve quadruped retargeting.** The Grandma Mixamo character is humanoid and separately supports retargeted biped animation FBXs. Do not assume bone names, axis mapping, action clip names or object scaling before probing actual input files.

## Pipeline Step 0: Inventory and validate input
- Find Blender binary/version and source files under `assets_inbox/`, check dependencies and external texture paths. Save pristine source; operate on copied `.blend`.
- Run headless Blender `blender -b path/to/komur.blend --python scripts/inspect_cat_rig.py` (script to author in project), print *sanitized* skeleton report to JSON/text: armatures, rig object, mesh count, skinned vertices, bones+parents+roll/rest transforms, Actions, durations, NLA strips, pose constraints, missing textures, origin and scale.
- Inspect the existing clips by sampling bone position/rotation and render a tiny contact sheet/thumbnail sequence in Eevee or direct GLB+Three preview. Bone existence doesn't prove animation quality.
- Identify spine, hips, all four upper/lower legs/paws, neck/head, tail (may be several segments), jaw if present, and ears if present. Fallback behavior if no jaw bone: use head tilt/meow audio rather than unrealistic mouth animation.
- Preserve correct world orientation (Three +Y up) and mesh normals. Align playback using root object rather than rewriting rig.

## Step 1: Author CAT animations FIRST (minimum pack for playable controller)
**Priority 0:** 12 named useful actions, built/derived using actual cat rig mapping:

| Clip | Creation approach | Critical visual check |
|---|---|---|
| `Idle` | existing | still, breathing, ears/tail secondary |
| `Walk` | existing clip | feet match velocity, no sliding |
| `Sprint` | amplified/run gait from walk via procedural keyframe gait | consistent four-paw contact, animated body bounce |
| `TurnLeft`/`TurnRight` | small directional shoulders/head/tail bend (can use procedural blend) | not 180deg snap |
| `JumpTakeoff` | crouch/push off | rear-leg extension matches first frame of airborne motion |
| `JumpAir` | extended forelegs, tail counterbalance | no ground-pedaling |
| `Fall` | raised paws, arched body, tail | exit clean to land |
| `Land` | compress legs, recover | quick with satisfying recoil |
| `Pounce` | lean, spring, front-paws out | impact timing aligns with collision |
| `Swipe` | quick foreleg smack, head follow | paw reaches actual object |
| `Crouch` | belly lowered and paws tucked | does not clip floor |
| `MeowTaunt` | head tilt, lifted chin, tail flick | comic readable silhouette |
| `HitOrCaught` | startled pose, legs wriggle | return to Idle without rig explosion |

Treat Left/Right turns as optional variants if time short. Reuse current Sit, Stand and Look actions without regenerating. Strip irrelevant action tracks if imported scenes have multiple rigs.

## Step 2: Rich follow-up library after vertical slice
**Priority 1:** `JogStart`, `SprintStart`, `SprintStop/Skid`, `JumpLandHard`, `PounceCharge`, `PounceImpact`, `SwipeLeft`, `SwipeRight`, `ScratchLoop`, `SneakWalk`, `MantleStart`, `MantleUp`, `HideEnter`, `HideExit`, `MeowShort`, `MeowAngry`, `ShakeOff`, `RecoverTumble`, `PerchBalance`, `VictoriousSit`.

**Priority 2 / stretch:** `ClimbShort`, `ClimbHigh`, `LeapGap`, `SlideUnder`, `CurtainCling`, `TailFlick`, `LickPaw`, `HeadRub`, `Sleep`, `DodgeRoll`, `WetShake`, `FireStartle`, `CuriousInspect`, `GrandmaMock`, `OutroSmug`.

A high-quality set of 12–20 animations is superior to 40 broken clips. Distinct gameplay states can share core rig action with additive layers (tail, head, front paw) when needed.

## Technique: rig-aware procedural action generator
- Write headless `scripts/generate_cat_actions.py` operating on a copied `.blend`: canonical semantic bone map built from hierarchy/aliases plus manual override JSON. Never insert keyframes blindly on bones with unsupported constraints. Use quaternion pose channels carefully and rest-transform-aware rotations. Maintain floor contacts by offsetting root and paw tracks.
- For gait: keyframe four paw lift cycles at staggered offsets, spine bob ~0.02–0.05m, head stabilization, tail lag. Preserve as much of provided Walk as possible; use time-remap + body lean to create Sprint instead of completely inventing quadruped locomotion if base clip works.
- For static/short animations: pose targets interpolated by Bézier/F-curve, gentle settle/overshoot; no robotic Euler flipping. For locomotion, root motion in-place for engine-driven controller (extract/discard translational root motion consistently).
- Bake constraints to exported actions if required; ensure Blender glTF export includes `animations`, skinned mesh, textures and named clips. If actions are not exported automatically, put them on NLA tracks and validate each clip in Three.js AnimationMixer. Avoid exporting duplicate or empty clips.
- Generate GLB to `public/assets/characters/komur.glb` or suitable asset path; keep raw `.blend` in source but exclude if too large for browser.

## Animation verification gate
- Headless JSON report each clip `name, duration, animatedBoneCount, poseChangeMagnitude, loopStatus`; reject empty or zero-duration clips.
- Manual or scripted 4-frame contact sheets: idle, stride contact, jump apex, land, pounce midframe, scratch end, taunt. Confirm paws do not invert, spine stays coherent, mesh has proper skin weights, eyes and tail retained.
- Run actual browser AnimationMixer test: crossfade 0.08–0.18s, no pose snapping on state transitions; sync stride speed to locomotion (avoid foot slide). Verify cat physics root not driven by additive gait translation.
- If any procedural clip looks terrible, replace with a short pose blend/procedural additive; do not derail jam trying to retarget human motion to cat.

## Grandma — Mixamo import and 10 suggested clips
- Main full-body character: export as **FBX With Skin**; all added clips ideally **FBX Without Skin** to share skeleton. Rigs may have mismatches; detect bone names/scale and retarget if needed. Convert to combined `.glb` with named animation clips.
- Clip search descriptions (actual site labels differ): `Idle`, `Walk`, `Run` or `Charge`, `Angry`/`Arguing`, `Throw`/`Overhand Throw`, `Swing`/`Weapon Attack`, `Pick Up`, `Stumble`/`Hit Reaction`, `Stand Up`, `Threaten`/`Victory`. Prefer **throw and swing** over idle variants.
- Procedurally keyframe/overlay 2–4 attack poses if clips absent: aim shoulder/casting arm toward cat and hand-held weapon; angry lean/tremble; huge final overhead swing. Use bone attachment marker for held prop and physically spawn/detach projectile on release keyframe.
- Retain animation events as JSON times `windupStart`, `release`, `recoverEnd`; sync gameplay hits on release, not arbitrary sound playback start.
- Grandma's root/world motion is driven by AI controller; imported animations mostly in-place. Animate facial expressions via available blend shapes, eyebrows/head nods, jaw if available; if not, strong gestures + voice sell performance.

## Tools and example commands
- Headless Blender: `blender -b assets_inbox/komur/cat.blend --python scripts/inspect_cat_rig.py` **after actual filename is found**.
- Cat action creation: `blender -b path/to/source.blend --python scripts/generate_cat_actions.py`.
- Grandma conversion: `blender -b -t 2 --python scripts/import_mixamo_and_export.py`.
- Validate logs and glTF in Three.js. Check Blender `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB')` parameters against installed Blender version instead of guessing.
- Avoid multiprocessing Blender jobs, huge render previews, dense mesh subdivision; use `-t 2` and simple Eevee renders/contact sheets.

## Acceptance
Cat runs, sprints, jumps, pounces, swats, taunts and lands visibly with no T-posing; Grandma uses several visually different chase/throw/swing states, and projectiles launch exactly during animation release. Character rigs stay intact in exported WebGL build.
