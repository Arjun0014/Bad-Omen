# 10 — Autonomous 24h Production Schedule / Scope Gates

## Hard external deadline
- **Game playable/submission:** 18 October 2026, **15:30 IST** (13:00 Istanbul).
- **Gameplay video due:** 18 October 2026, **16:30 IST**; reserve time to export before main deadline if form asks for it.
- Prepare project title/description, credits, build link, video, and short presentation early. Avoid leaving final form upload to the last five minutes.

This document is a rolling plan. **At session start compare actual system local time** to these deadlines; don't blindly assume the whole 24h remains. If fewer hours remain, proportionally cut stretches and preserve the core.

## Production board (single agent, no subagents)
Suggested durations from a fresh start total ~19h of active work, with remaining time reserved for review/submission buffer. Each phase should end with a demonstrable executable checkpoint.

| Phase | Budget | Concrete output | Gate to advance |
|---|---:|---|---|
| 0. Recon, tools, asset inventory | 0.5h | installed versions, source file map, architecture, PROGRESS | rig paths known or proxy fallback chosen |
| 1. Komur rig + motion pipeline FIRST | 1.5h | inspected/converted cat, minimum animation pack, preview | cat GLB renders, clips not empty, walk/jump usable |
| 2. Slice: cat + room physics | 2.5h | responsive traversal, jump/sprint/pounce, 10 breakables, score | run 2 mins and break at least 5 props |
| 3. Grandma agent/throw | 2.5h | chase/rage, two projectile types, break points, catch/hide | lure a thrown object into a weak fixture |
| 4. Full world blockout + dressing | 2.0h | 2 floors, stairs, perimeter garden, 30+ props | navigation between all areas; no camera snag |
| 5. Major authored chaos | 3.5h | 3 hero setpieces + triggered final collapse, fire | begin-to-end run possible |
| 6. Story/audio/polish | 2.0h | intro/outro, voicelines/subtitles, SFX, HUD/menu | first 40s hooks a tester; restart and audio works |
| 7. Test/optimize/fix | 2.5h | production build, collision recovery, browser smoke, stable score | final end-to-end test + build passes |
| 8. Deploy + submission assets | 2.0h | playable URL, gameplay capture, deck, credits, project info | actual opened build link and ready-to-paste form info |
| **Total** | **19h** | plus remaining buffer | |

**Hard time-of-day milestones recommended if actual clock permits:** freeze core features around **18 Oct 12:00 IST**, publish/test final browser build by **13:30**, video and deck ready by **14:30**, submit project by **15:00** for 30-minute buffer. If the real time is already later, prioritize immediate release.

## Feature tiers: do not confuse ambition with MVP
**P0 (must):** functioning Third Person Komur with actual rig/animations, pounce+swat+taunt, one floor of breakable objects, score, Grandma anger/chase/heavy throw, one chain reaction, restart, browser build. Build this first.

**P1 (strong jam entry):** second floor and garden, 30+ breakable props/6 families, 3 major events, small fire system, full final roof collapse, 15+ voice clips, subtitles, comic story+end card, HUD, audio, video. Target this.

**P2 (only after full run works):** up to 12 setpieces, flooding, second companion cat, 25+ custom cat animations, extended destructible roof/wall sections, more ambient details, interactive garden props, local high score, sound mixing controls.

## Required early vertical slice
In first ~4.5h, do not model 100 chairs. Make one polished room with real controller, 10 breakables, Granny prototype (can initially be a capsule) and a clearly hittable destructible pillar. Test in Chromium, verify score, pounce, swipe, grab recovery. Record 10-second play footage/screenshots. The risk is **gameplay feel**, not roof geometry.

## Autonomous behavior contract
- Keep moving without asking the user trivial questions. When user assets aren't found, use explicit placeholder meshes/animation fallback and leave simple swap-in instructions.
- No subagents/parallel competing plans. No 5-minute speculative research detours on niche packages. Check official docs only for critical integration/versions.
- Every 1–2 hours write `project_notes/PROGRESS.md` with date/time, built/tested items, command results, issue priority, next step. Maintain `NEXT_SESSION_PROMPT.md` at every stable checkpoint.
- If a test fails, reproduce and fix. If it costs >25m and work around exists, build reliable fallback and record limitation. Never intentionally break already playable game to pursue prettier effects.
- Do not overbuild scripts for animations/rendering without checking the result. A 10-second clip preview is more useful than ten unreviewed exported Actions.
- Keep resource pressure low: no large simultaneous Blender jobs, low-res 1K materials, no continuous dev video capture, limited physics active bodies. Avoid high mesh subdivision.
- Do not push to remote GitHub or deploy to an account without the user's authorization/access; if deployment credentials exist with permission, deploy then test. Otherwise package static `dist` and provide exact upload instructions. Do not misrepresent an un-deployed build as published.

## Decision tree when running out of time
- **<8h remain to submission:** stop new setpieces; finish one floor with very high-quality destruction, Grandma+score, simple two-floor geometry/garden if already built; harden web build.
- **<5h remain:** focus bug fixes, story/audio, browser build, gameplay video capture; no animation expansion, flooding, new AI modes.
- **<3h remain:** freeze features, only regressions and packaging. Prepare submission deck/text and shoot video from stable build.
- **<1h remain:** stop coding except fatal release bug, upload now, confirm actual links and files.

## Known top risks and mitigations
1. **Rig doesn't support clean generated quadruped poses:** use original animations, additive head/tail, limited authored action set; ensure playable movement is never blocked.
2. **Blender export makes empty clips:** NLA/bake named actions, test AnimationMixer with instrumented clip list; use static animation blending fallback.
3. **Grandma pathing fails between floors:** explicit authored stairs nav waypoints + recover from stuck, not dynamic mesh.
4. **Thousands of debris objects tank FPS:** <=80 active dynamic objects, cosmetic particle pools, fracture max 3–7 chunks per object, never every beam awake.
5. **Finale can't trigger because rooms already destroyed:** setpiece triggers inspect event state plus alternate final target, scripted fallbacks, accessible markers.
6. **ElevenLabs unavailable/quota:** subtitles + procedural voice/meow fallback; never block release on external audio provider.
7. **Download/web restrictions:** procedural models and basic materials; no dependency on scraping external asset sites.
8. **24h deadline:** build and record a working proof early; deploy/test before hours of final polish.

## Checkpoint evidence format
For each milestone record: `UTC/IST time`, `commands run`, `files changed`, `manual browser test performed?`, `screenshot/video path`, `feature pass/fail`, `bugs`, `next action`. When running out of context, create complete state in `project_notes/NEXT_SESSION_PROMPT.md` using docs/12.
