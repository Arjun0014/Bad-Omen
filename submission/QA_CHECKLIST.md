# BAD OMEN — QA checklist (docs/11 acceptance checks)

Honest status of every acceptance check in `docs/11_TESTS_AND_SUBMISSION.md`. **PASS** means a test was actually
run and observed passing (the evidence column says which); **NOT TESTED** means nobody checked it; nothing is
marked PASS because the build compiles. Automated browser tests drive the system Edge (Chromium) through
Playwright, muted, at 1280x720 unless noted.

Test machine: Windows 11, AMD Radeon integrated graphics (Renoir iGPU, ANGLE/D3D11) — a modest desktop GPU.
Test scripts: `browser_smoke.mjs` (16 end-to-end checks), `qa_probe.mjs` (27 extra probes), `input_test.mjs`
(real mouse/keyboard), `stress_test.mjs` (mass destruction, soak, every set piece), `music_test.mjs` (12 music checks),
`mobile_test.mjs` (15 checks with real multi-touch in Edge's phone emulation), `first_line_test.mjs`, `npm test`
(9 unit tests).
Latest results: `project_notes/TEST_RESULTS.md`.

Last full pass: **18 Oct 2026, session 8, on the `v1.5-jam` zip** (see the release section at the bottom). Re-checked in
session 9 (13:27–13:45 IST): the zip is unchanged and a rebuild from its tag is byte-identical to it; smoke 16/16 and
QA probes 27/27 on it again.

## Cat and movement

| Check | Status | Evidence |
|---|---|---|
| Black fur, white paws/chest/tail tip, amber eyes; rig not T-posing | PASS | Smoke `assets` (42 cat clips playing); every screenshot / video frame; deck portrait |
| Idles, walks, sprints, jumps, pounces, swats, crouches, taunts readably | PASS | `input_test` (real keys: gallop 3.9 m/s, jump, swipe, taunt, pounce); `qa_probe crouch_sneak` (C → Sneak clip at 0.75 m/s); idle soak (fidgets, sit, loaf); session 9 (user request): standing still, the paw lick at ~3 s, sits at ~6 s, then the sitting loop (in-game event log and screenshots) |
| Responsive sprint/jump: no WASD stutter, no camera clipping, no foot slide, jump near edges (coyote/buffer) | PASS | KCC stall fix measured (constant 1.45 / 3.9 m/s, `move_and_jump`); gait playback = speed / measured clip speed; coyote 0.12 s + jump buffer 0.16 s in `Cat.js`; camera collides with walls only, tail droops when the camera is pressed close |
| Onto dining table, kitchen counter, up stairs, onto bedroom furniture; mantle on marked edges | PASS | Smoke `mantle_onto_counter`; session-2 leap sweep (bed, mantel via climb, tables, sideboards, piano, desk, potion bench); stairs up/down never airborne |
| Camera usable close to walls, stairs, courtyard and after cinematics | PASS | Smoke returns control after all 5 cutscenes; tour screenshots of every room incl. stairs and yard; start position re-framed in session 4 (camera no longer jammed behind the tail by the front door); session 6: Grandma is not drawn while the gameplay camera is right at her (`qa_probe granny_at_the_lens`: hidden at the lens, back 1.8 m ahead, no flicker, never hidden in a cutscene) |

## Destruction and score

| Check | Status | Evidence |
|---|---|---|
| 30+ breakables across ≥6 archetype families, permanent damage | PASS | 375 breakables, 55 prop archetypes, 8 materials (wood, ceramic, glass, metal, fabric, plant, paper, wax); fragments freeze into persistent debris (`stress_test`: 700 debris meshes) |
| Cat breaks small items directly; pounce shoves furniture; particles/audio by material | PASS | Smoke `swipe_vase_scores`; `qa_probe pounce_moves_furniture` (chair shoved 0.24 m by a real pounce input); per-material shards/dust and break sounds (`Destruction.js`, `breakSound`) |
| Jumping or galloping into a window breaks the glass and carries Komur through (playtest 3) | PASS | `qa_probe jump_through_window` (real W + Space from 1.1 m inside: pane broken by `cat_pounce`, Komur 0.84 m outside) |
| Grandma's attack breaks a fixture/weak point and pays GRANNY DID IT | PASS | Smoke `granny_throw_breaks_chandelier` (real windup → release → weak point → SP01, banner "+15,000 · GRANNY DID IT x2") |
| No double awards from debris collisions; combo expires and caps | PASS | Unit tests (duplicate guard, combo ladder, 5x cap, timeout); smoke `no_double_score` |
| Hero events run exactly once, with sound and camera, and leave the world altered | PASS | Smoke: SP01 dining table destroyed, SP02 5 fire clusters, SP03 floor hole, SP10 glass roof gone, SP04 roof collapse; `done` flags block re-triggers |
| Fire spreads only among authored local targets; still passable; fire sound persists | PASS | Kitchen fire = fixed authored clusters (`SetPieces.js`), damage radius ≤ 1 m; `qa_probe granny_vs_fire` and smoke keep playing after SP02; fire loop plays while any cluster burns |
| Final roof collapse works with pre-broken props; skipped cinematic safe | PASS | `stress_test` (80% of props broken first, then every set piece + finale → results); `qa_probe skip_finale_cutscene` (both cutscenes skipped → results, roof down) |

## Grandma

| Check | Status | Evidence |
|---|---|---|
| Hears/sees, chases, loses the cat, searches, reacquires | PASS | Smoke state logs (`windup>recover>search>spotted>chase`); hiding test in `input_test` |
| Foyer → kitchen, up/down stairs, out to the garden without getting stuck | PASS | Smoke `nav_between_floors`; `qa_probe garden_nav` (foyer → garden 4.6 s → living room 5.1 s); `stress_test` 60 s soak on the v1.5-jam zip: 6 rooms, longest stand-still 2.1 s, 2 witch's-puff exits (the stuck watchdog's last resort, next row). Session 4 fixed path shortcuts that ran under table tops (she stalled ~2 s at the dining table) |
| Grandma never stands stuck (playtest 5: seen against the living-room sofa) | PASS | `qa_probe granny_never_stuck` (23 walks: the sofa pocket, Komur last seen on the sofa's back / the dining table, a sofa knocked loose, destinations inside furniture, wedged in the hearth, a wrecked ground floor): longest stall 2.3 s, one witch's-puff exit; the old code stood 5.2 s at the sofa (and on screen could stay for good) |
| Rage visible; thresholds change real attack logic | PASS | HUD rage meter + phase names; weapon tier by phase (teapot/plate → pan → axe/spear), shorter cooldowns and longer telegraphs at higher rage (`Grandma.js`) |
| Pan/axe/spear throws telegraph > 0.6 s, release on the animation frame, hit intended targets | PASS | Windup 0.95–1.7 s with a glowing arc; release frame measured in Blender (`grandmaEvents.json`); smoke SP01/SP03/SP10/SP04 all triggered by real thrown weapons |
| Cat can dodge, hide and get caught: a tutorial catch is a toss (run continues); after the tutorial a catch ends the run with the cauldron scene and CAUGHT results (score kept) | PASS | Smoke `catch_and_recover` (bait stage: caught, tossed, back to normal) and `caught_ending` (wreck stage: cauldron scene → results with the CAUGHT header); `catDodged` events in the chandelier test; session 6: Komur no longer blows out to a green-white blob over the cauldron (brew light moved, A/B screenshots) |
| A thrown weapon that hits Komur stuns him ~2 s (no control) and Grandma can catch him | PASS | `qa_probe stun_then_catch` (pan launched at him: stunned, W ignored, stars up, caught ≈1 s later, recovers from the tutorial toss) |
| Grandma doesn't walk into fire forever; safe outside during the finale | PASS | `qa_probe granny_at_stove` (the kitchen fire lit at her feet: out of it after the cutscene; dropped into the flames mid-chase: out in 0.12–0.18 s — the old code kept her there 10 s with 11 flinches) and `granny_vs_fire` (15 s chase around the burning stove: 0 s inside a fire); outro stages her in the garden |

## User experience and tech

| Check | Status | Evidence |
|---|---|---|
| Title → Start → skippable intro → controls → playable run → end card → restart | PASS | `input_test` (real clicks: menu, Controls, Play, Space skips the intro); smoke `finale_and_results`, `restart_resets`; `qa_probe quit_to_menu_and_play` (Pause → Main menu → Play → Space, real buttons). Run length: the finale unlocks at ~55% doom + 2 disasters (relaxing after 6–9 min), so a run is player-paced; a human playthrough timed against the intended 8–12 min was **NOT TESTED** in session 4 (the developer played earlier builds) |
| Endings: the finale's (garden at dawn, Grandma's tantrum, THE END card) and the caught ending (kitchen cauldron) play, are skippable and reach the results | PASS | Smoke `finale_and_results`, `caught_ending`; `qa_probe skip_finale_cutscene` and `ending_plays_through` (unskipped: dawn, the tantrum, 3 falling beams, THE END card, results in 22.6 s); screenshots of every beat of both (session 5) |
| Achievements unlock, persist, never interrupt a cutscene, and show on the results and in the menu | PASS | `qa_probe achievements_unlock` (vase → "Bad Omen" card, saved, no double unlock), `ending_plays_through` (results line "Achievements 7 / 16 · ★ …"), `achievements_persist` (after a reload the menu's Achievements screen lists the same 7 of 16, Back works); cards wait out cutscenes (session 5 screenshots) |
| Dialogue/subtitles match events; mute works; no overlapping voice spam; distinct SFX | PASS | Dialogue rules (no repeats within 5 s, queued replies expire, priority lines); skipping a cutscene now stops its remaining lines; `input_test` mute (M); subtitles above the letterbox in cutscenes |
| Random real input for 6 minutes across the whole house (release build) | PASS | `monkey_test.mjs` on the v1.5-jam zip (session 8): 6 min, 303 samples, 0 errors, 0 NaN, 0 falls through the world, Komur never stuck in a non-normal state > 2.2 s, caught 8× (fatal catches → cauldron → results → restart, 5 restarts), Grandma 1 witch's-puff exit (longest stand-still while walking ~3 s), 77 fps average (min 42); on v1.0-jam random play also reached the finale |
| Pause/resume, focus loss, pointer lock, resize; no error spam or physics explosions | PASS | `input_test` (pointer lock, Esc pause, Resume); `qa_probe focus_loss_pauses`, `resize` (960x540 and back, canvas + aspect follow); console clean in every run |
| `npm run build` / `npm run preview` work; no API keys in `dist` | PASS | Build OK (`v1.5-jam`: 159 files, 29.1 MB zipped; session 9: a rebuild from the tagged source is byte-identical to the zip's contents); `check_secrets` OK; the release checks below run on the build itself |
| Loads from a case-sensitive host like itch.io's CDN (Windows, where every other test ran, ignores the case of file names) | PASS | Session 9: the v1.5-jam zip served by `scripts/itch_like_server.mjs` (exact-case names, 403 on a path ending in "/"): smoke 16/16 and the JPG fallback (`?ktx2=0`) through it, 154 of 159 files requested, 0 wrong-case or missing paths; never requested: 3 licence notices and Vite's 2 unused copies of the KTX2 transcoder; nothing loads from another host. A deliberately wrong-case request is caught |
| Runs after a refresh; assets load; no fatal console errors | PASS | `qa_probe refresh` (reload → boots to play again); 0 console errors in every suite and, since session 4, 0 console warnings at 5 window sizes |
| Responsive on a modest desktop during big debris/cutscenes; spikes brief | PASS (this iGPU) | 50–56 fps headless at 1280x720 with bloom; table smash worst frame 51 ms (was 5.2 s); `stress_test` on the v1.5-jam zip (session 8): 58 fps at the start, 310/370 broken + 111 debris → 62 fps (95 on Low), every set piece and the finale → results, 0 errors (session 4: 305/370 + 700 debris → 54 fps; v1.3-jam on a busier machine: 40 fps); auto quality drops to Low below 45 fps. Other hardware: NOT TESTED |
| Restarts don't leak memory | PASS | `qa_probe restart_memory`: 4 restarts, geometries / textures / shader programs / JS heap (after GC) flat (a ~11-texture-per-restart leak was found and fixed in session 4) |

## Playtest 4, music and phones (session 7)

| Check | Status | Evidence |
|---|---|---|
| Title screen: logo bigger and higher, description bigger; the menu fits small windows | PASS | `scripts/menu_shots.mjs` at 1920x1080, 1280x720, 960x540 (the old menu overflowed 960x540); `mobile_test` at 844x390 and 740x360 |
| The intro's first line is voiced on a first run | PASS | `first_line_test` (fresh page, Play clicked as soon as the menu shows; also on a throttled connection in session 7): on the v1.5-jam zip 91 sounds decoded when Play is clicked and the first line starts 0.86 s later; fails on the old code (`G_INTRO_01` from no buffer) |
| Komur faces the camera in the intro's meow shot and on the well in the outro | PASS | Screenshots of both shots |
| The intro ends with Komur bolting into the house; play starts in the dining room, away from Grandma | PASS | `qa_probe tutorial_flow` (start in the dining room, Grandma 7.6 m away and active); screenshots of the dash |
| A caught Komur hangs in Grandma's hand (catch, CAUGHT beat, cauldron) and her fingers never sink into him (playtest 5) | PASS | `qa_probe catch_hold`, measured on the skinned meshes in a catch and in the cauldron close-up: 0 hand vertices inside him, touching (within 5 cm since session 9), held 1 m off the floor; the old code had ~100 vertices up to 11 cm inside him. Close-ups and wide shots checked by eye |
| ...and he hangs steady, no glitching (playtest 6) | PASS (measured) | Session 9: per-frame trace of the hold: the way out of her hand used to flip every few frames (53 flips in the cauldron scene, jumps of 20–35 cm between frames); now 0 flips, his frame-to-frame motion against her grip p95 2.7 cm in the cauldron scene and 4 cm in a catch (her shake), 0 hand vertices in him. The trailer's stinger was re-made from the fixed build |
| The head never spins round | PASS | `qa_probe head_never_spins` (loafing, sitting with Grandma near, stunned: under 100° from the body; the old code: 178.7°) |
| No fragments left in the air after big events | PASS | `qa_probe no_floating_fragments` (SP01, SP10: 0 floating shards, 0 roof pieces; the old code: up to 166 and 7) |
| Tutorial: move → leap → swipe the GOOD vase → meow → dodge, skippable (TAB / SKIP TUTORIAL); controls listed top right | PASS | `qa_probe tutorial_flow` (real input through every step, TAB); `mobile_test skip_tutorial_by_touch`; screenshots |
| Every ground-floor window breaks when Komur jumps at it (the kitchen window too) | PASS | `qa_probe ground_floor_windows` (12 windows, real W + Space; the one behind the conservatory bookcase stays shut and he stays inside) |
| Grandma reacts to noise and sight from the start | PASS | Browser check: an out-of-sight break → she investigates; Komur in front of her → spotted in 0.38 s; `tutorial_flow` (patrolling, active, at the start) |
| F plays one sound; recorded hiss, pounce and jump | PASS | Browser check: F → one hiss, Space → `cat_jump`, right click → `cat_pounce` (the sounds were checked by measurement: envelope, loudness) |
| SP03 leaves a broken hole Komur can drop through | PASS | `qa_probe sp03_floor_hole` (nothing left in the opening, the rim shown, he falls to the foyer); screenshots from above and below |
| Music: waltz on the title screen after the first click, chase music on a hunt (its 20–60 s part), MELTDOWN music at rage 90, each resuming where it left off, on the beat, no flapping, no gaps or doubled level in a crossfade | PASS (measured) | `music_test` 12/12 (positions saved and resumed exactly; one switch over 12 s of on/off hunting; level through every crossfade within -4.2/+1.8 dB). A listening check by a person: **NOT TESTED** (automated runs are muted) |
| Phones and tablets in landscape: touch controls (stick + look at once, rim gallop, every button, toggles), pause, skip, tutorial skip, phone HUD, audio after the first tap | PASS (emulated) | `mobile_test` 15/15 at 844x390 and 740x360 (Edge mobile emulation with real multi-touch events); screenshots |
| Portrait shows the rotate screen and holds the game; landscape resumes it unchanged | PASS (emulated) | `mobile_test` (game time frozen, audio suspended; back in landscape: same time, score, stage and position) |
| Real phones (iOS Safari, Android Chrome): performance, fullscreen/orientation lock, audio unlock | **NOT TESTED** | No phone available to the agent; emulation runs on the desktop GPU |
| Desktop unaffected by the touch layer | PASS | On the v1.5-jam zip: smoke 16/16 (Edge, Chrome, Firefox), `qa_probe` 27/27, `input_test` PASS; in the game on a desktop (session 9): no `touch` class, touch mode off, the `#touch` overlay not displayed, the full pool of 12 real lights |

## Release build that ships: `v1.8-jam`

`submission/bad-omen-web.zip` (159 files, 29.1 MB; built from commit 2dce0ea, tag `v1.8-jam`; sha256 `d07797c7…958dc08`)
= `v1.7-jam` with the FPS readout showing only the frame rate (user request): smoke **16/16** on the extracted zip
through the itch.io-like server, 0 problems; the readout checked in the game ("37 fps"); the zip's stored names
checked byte by byte (all "/", no backslash; a planted backslash is caught), every CRC good, and Windows' libarchive
extracts it identical to `dist/`.

`v1.7-jam` (9629d22, sha256 `c83e5cb0…172215`) = `v1.6-jam` with crouch on C only (holding Ctrl and pressing W was Ctrl+W, which closes the browser tab and cannot be
blocked by a page): smoke **16/16** on the extracted zip through the itch.io-like server, 0 problems.

`v1.6-jam` (5f0a84b, sha256 `7b76fe86…cc5b19`) = `v1.5-jam` + playtest 6 (Komur held steady in her grip, the idle paw lick and sit). At the user's request (submit soon,
no long runs) only these ran on v1.6: smoke **16/16** on the extracted zip through the itch.io-like case-sensitive
server (0 problems), `qa_probe catch_hold` / `head_never_spins` and the hold-jitter and idle checks on dev, `npm test`
9/9, `check_secrets` OK. The full suite below ran on `v1.5-jam`, which differs only in the hold and the idle timing.

`v1.5-jam`: (159 files, 29.1 MB; built from commit 6d47ee0; sha256
`fa9da23a…941aab`), tested **as extracted from the zip** under a nested path (`/html/12345/`, like itch.io): smoke 16/16
in Edge, 16/16 in Chrome, 16/16 in Firefox; QA probes 27/27 (incl. Grandma never stuck); real-input test PASS; music
12/12; phone emulation 15/15 at two landscape sizes; the first intro line voiced; monkey (6 min) and stress tests PASS;
no secrets in the build; 0 console errors (session 8, `project_notes/TEST_RESULTS.md`). Browsers: Edge, Chrome and
Firefox **PASS**; Safari and real phones **NOT TESTED**. Earlier tags: `v1.4-jam` (the same but for the hold fix),
`v1.3-jam` (before playtest 4, the music and phones), `v1.2-jam`, `v1.1-jam`, `v1.0-jam`.

## Submission checklist (docs/11)

| Item | Status |
|---|---|
| Game URL or downloadable build; private/incognito access verified | Build + itch.io zip ready; **upload and incognito check need the developer's account (not done by the agent)** |
| Start-to-finish gameplay capture (MP4) | `submission/video/` (recorded from the real game) |
| Title / description / tech / Komur's role / controls / credits | `submission/SUBMISSION.md`, `CREDITS.md` |
| 5-slide pitch deck (PDF/PPTX) | `submission/deck/bad-omen-pitch.pdf` / `.pptx` |
| Re-confirm the official form fields before upload | Developer, at upload time |
| Upload ≥ 30 min before 15:30 IST | Developer |
