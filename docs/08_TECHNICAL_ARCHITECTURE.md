# 08 — Technical Architecture / Three.js, Rapier, Blender and Deployment

## Choose one stack decisively
- **Vite + TypeScript or modern JavaScript + Three.js** for 3D scene, GLTFLoader, AnimationMixer, renderer/shader passes, raycast and camera.
- **`@dimforge/rapier3d-compat` or current maintained Rapier JS package**, verify documented version and initialization. Fixed physics step **1/60s** with capped catch-up accumulator to prevent spiral of death under frame stalls.
- **Blender headless `bpy`** for cat rig/action inspection/generation, humanoid Mixamo consolidation, modular props and fractured variants, simple scene asset exports.
- Browser native audio + lightweight wrapper or Howler if convenient. Pre-generated ElevenLabs MP3, no TTS network calls at runtime.
- Playwright Chromium for browser smoke/regression if installed; else run a real browser via available means and log honest gaps.

## Proposed code layout (create in the real working repo)

```text
src/
  main.ts                       # boot/loading/menu/game state
  app/Game.ts                   # scene lifecycle, clocks, global events
  scene/HouseBuilder.ts         # two-floor room mesh/collider setup
  scene/PropsRegistry.ts        # many instances from data definitions
  physics/PhysicsWorld.ts       # Rapier init, fixed update, event queue
  physics/CollisionLayers.ts    # cat/grandma/props/static/triggers
  player/CatController.ts       # responsive grounded movement & abilities
  player/CatAnimation.ts        # animation state machine/clip blending
  camera/ThirdPersonCamera.ts   # anti-clipping spring follow
  ai/GrandmaAI.ts               # state graph, chase/navigation, telegraph
  ai/HouseNavGraph.ts           # coarse room + stairs waypoints
  combat/ThrownWeapon.ts        # projectiles, release events, hit logic
  destruction/DamageSystem.ts   # normalized event provenance & fracture
  destruction/SetPieceManager.ts# authored condition/timeline/camera calls
  destruction/FireSystem.ts     # tiny local fire state graph
  destruction/WaterSystem.ts    # optional stylized flooding
  data/Breakables.ts            # placed item archetypes, thresholds
  data/SetPieces.ts             # stage specs, trigger IDs and positions
  ui/Hud.ts                     # Rage, Doom, score, combos, prompts
  ui/Menu.ts                    # title, instructions, settings, end card
  audio/SoundDirector.ts        # voice/subtitle/SFX/music arbitration
  util/DebugOverlay.ts          # fps, rigidbodies, AI/animation states
public/
  assets/characters/komur.glb
  assets/characters/grandma.glb
  assets/environment/*.glb
  assets/materials/*
  audio/voices/*.mp3
  audio/sfx/*
scripts/
  inspect_cat_rig.py
  generate_cat_actions.py
  combine_mixamo.py
  generate_house_assets.py
  generate_voiceover.mjs          # reads .env only in Node
  inspect_assets.mjs
  browser_smoke.mjs
project_notes/
  PROGRESS.md
  NEXT_SESSION_PROMPT.md
CREDITS.md
package.json
index.html
```

No need to slavishly match path names, but keep subsystem boundaries clear and runnable scripts documented.

## Timing loop
- Initialise Rapier once; instantiate world `gravity=(0,-9.81,0)`. Use `dt=1/60`; clamp `frameDt` to 0.05s; no more than 3–4 catch-up steps on slower hardware. Movement input buffered per render, consumed by fixed-step controller; interpolated view/camera when possible.
- Cat: kinematic capsule/controller with custom air control, variable-height jump/coyote/buffer, ledge checks, impulse to dynamic objects. Rapier's character controller may apply impulses to other bodies if enabled; otherwise apply calculated impulses manually.
- Granny: kinematic steering/capsule + procedural aim/facing and animation. Projectiles are dynamic rigid bodies with CCD. Every breakable registers collider handle -> property ID. Contact force event flags must be enabled on the colliders for force events; test it.
- Destruction: event bus with dedupe key `(targetId, destructionStage)`, one-time permanent credit, physics spawn budget; sequence order deterministic enough for cutscene. `world.step(eventQueue)`, then drain collision/contact force events; handle object deletion only at safe point in update.

Official physics references:
- `https://rapier.rs/docs/user_guides/javascript/character_controller/`
- `https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/`
- `https://rapier.rs/docs/user_guides/javascript/rigid_bodies/`

## Object and collision architecture
- Collision groups include world static floors/stairs, cat player, Granny character, dynamic light/heavy props, fast projectile, trigger zones. Use sensible filtering so decorative debris doesn't snag cat for minutes.
- Heavy projectiles may use sphere/box/simplified convex collider even if visual mesh is axe/spear. Set high movement speed, CCD, single-impact callback and lifetime. Prevent friendly collisions with Grandma's hand until release.
- Breakable fixture starts static/kinematic+collider, on break hide original and spawn visual prefabs plus a small handful of dynamic colliders; mark static geometry damaged and update nav only for authored areas.
- Static architectural walls should be box collider batches; don't use triangle mesh colliders for every plank.
- Automated regression can create 40 objects, shoot 10 projectiles, verify at least 10 unique break events and no duplicate award.

## Render/lighting target
- Enable sRGB/color management, physically plausible materials with stylized color boosting; shadow-casting key directional moonlight + a few point/spot lamps; keep active shadow casters selective. Build at a base render scale, cap device pixel ratio ~1.5 or dynamically lower on slow systems.
- Dust/fire/smoke particles pooled sprites or simple meshes; no volumetric ray-march; transparent overdraw contained.
- Instanced draw calls for intact common pottery/planks/windows/foliage; despawn fragments or put to sleep outside camera after their collision moment.
- Start with no postprocessing. Add modest bloom/color grade if it doesn't hurt 60fps target. Good lighting composition beats expensive effects.

## Dynamic cinematic system
- Each setpiece manager owns condition check + timeline triggers, simple camera spline start/end, and subtitle/impact timing. Cat input may be disabled 1–3s, but physics simulation continues at appropriate scale or stages apply deterministic transforms.
- Camera returns to latest predicted gameplay follow state, not to old camera coords. Store and restore input enable flag in `finally` equivalent. Skip path must fast-forward all state changes and re-enable controls.
- Use camera screen shake curves, impact audio stingers, time-scale independent audio (not slowed randomly).

## Browser performance budgets and fail-safe levels
- Desktop baseline: playable 720p/1080p, aim smooth 60fps on ordinary desktop; tolerable 30fps under final roof collapse if brief, no long freeze.
- Keep **active** dynamic rigid bodies near interaction below about 80 at once; pool/remove tiny shards. Final collapse use no more than 8–12 broad falling physical chunks and cosmetic splinters.
- Texture sets 1K default (2K for cat optionally); compress or atlase where easy. Never spend 2h on KTX2 unless load time demands it.
- Audio assets cap sensible overall size; avoid long silent speech/huge WAV. Preload essential audio; no network requirements after app static load.
- Browser pointer-lock fallback/instruction; pause on focus loss; no double trigger from key repeat; physics fixed-step clamp; resize support.

## Startup and scripts
Expected equivalent commands in resulting game repository:
- `npm install`
- `npm run dev` — local playable game
- `npm run build` — production web bundle
- `npm run preview` — inspect production build
- `npm test` or `npm run test:smoke` — programmatic/basic interactive tests
- Optional build-time `npm run voices` — generate missing voice clips locally from `.env`
- Optional `npm run assets:blender` — headless GLB production after supplied sources available

**Do not package `.env` into `dist/` or copy it under `public/`.** In Vite, only intentionally prefixed `VITE_` variables are shipped; never rename voice API key to that prefix.

## House consistency and stage data
- Source of truth for prop IDs, room transforms, prefab type, scoring and support tags in one `data/` structure. Avoid duplicating setpiece conditions across scene builder and physics callbacks.
- Build debug scene transitions: direct jump to SP01/02/03/finale for tests; `debug=1` query string only while developing, disabled/excluded by default for jam release.
- Commit stable checkpoints: base controller, granny, house, setpieces, release build. Maintain `project_notes/PROGRESS.md` as on-disk transcript of decisions and tests.

## If time is severely limited
Prefer code that yields visual feedback immediately, use procedural Three.js meshes for most furniture and Blender only for characters and 3–6 fracture variants. Exporting entire house through Blender is not required for success.
