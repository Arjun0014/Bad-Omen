# BAD OMEN — Production Progress

Deadline: **18 Oct 2026 15:30 IST** (video 16:30 IST). Session 1 started 17 Oct 18:30 IST; session 2 20:19–22:05;
session 3 22:00–23:45 IST; session 4 23:34–02:55; session 5 02:55–05:07; session 6 05:08–08:22; session 7 08:23–10:05 IST;
session 8 10:12–13:25 IST; session 9 13:26– IST.

## Status at 18 Oct 2026 ~14:45 IST — session 9: RELEASE `v1.8-jam` (FPS readout); the zip checked byte by byte

The FPS readout shows only the frame rate (user request, DECISIONS #96). `v1.8-jam` (2dce0ea, zip sha256
`d07797c7…958dc08`): smoke 16/16 through the itch.io-like server; every stored name in the zip uses "/" (checked on
the raw bytes). Next: the 2-page presentation PDF for the form; then the user uploads.

## Status at 18 Oct 2026 ~14:31 IST — session 9: RELEASE `v1.7-jam` (crouch on C only); waiting for the upload

Crouch was "C / Ctrl": holding Ctrl and pressing W is Ctrl+W, which closes the browser tab. The user approved C only
(DECISIONS #95). `v1.7-jam` (9629d22, zip sha256 `c83e5cb0…172215`): smoke 16/16 through the itch.io-like server.

## Status at 18 Oct 2026 ~14:25 IST — session 9 (later): playtest 6 → RELEASE `v1.6-jam`; waiting for the upload

The user (submitting soon, no long runs) asked for two fixes and the trailer's last part only. Done:
- **Held Komur glitching** in catches and over the cauldron: the hold's way out of her hand flipped every few frames
  and threw him 20-35 cm back and forth; now it keeps its way and eases the push (DECISIONS #93): 0 flips, frame-to-frame
  motion p95 2.7 cm (cauldron) / 4 cm (catch), 0 hand vertices in him.
- **Idle**: the paw lick at ~3 s, sits at ~6 s (was 18 s), loaf at 30 s (DECISIONS #94).
- **Release `v1.6-jam`** (5f0a84b, zip sha256 `7b76fe86…cc5b19`): smoke 16/16 through the itch.io-like server.
- **Trailer**: only the cauldron stinger re-made from v1.6 (its first 66.9 s frame-identical to the approved cut).

## Status at 18 Oct 2026 ~13:45 IST — session 9: the handoff re-checked; waiting for the user's itch.io upload

Nothing in the game changed. `v1.5-jam` was re-verified from scratch (TEST_RESULTS.md): the zip's hash matches and a
rebuild from the tag is byte-identical to it; smoke 16/16 and QA probes 27/27 on the served zip; the media compared
again with the approved cut (video frames identical where they should be; the audio is the same mix, re-normalised by
0.06 dB and re-encoded). The QA checklist rows that quoted older builds' numbers (monkey, stress, Grandma's soak, the
build, the first line, desktop vs the touch layer) now quote v1.5-jam's. The deck's rebuild was
pre-flighted with a dummy link. New check: itch.io's CDN is case-sensitive and every earlier test ran on Windows, so
`scripts/itch_like_server.mjs` serves the zip that way; smoke 16/16 and the JPG fallback through it, 0 wrong-case or
missing paths. Remaining: the user uploads to itch.io; then the link goes into SUBMISSION.md and deck
slide 5.

## Status at 18 Oct 2026 ~13:00 IST — session 8 (later): Grandma's hand no longer clips into Komur → `v1.5-jam`

The user approved the trailer and asked for one fix: "the hands are clipping into the cat" (screenshot: the cauldron
close-up; also in catches), and to update only the last part of the videos. Done:
- `Grandma._clearOfHand` slides him out of her hand every frame he is held, measured on the CPU-skinned vertices of
  his back/neck/head and her hand (DECISIONS #92). `qa_probe catch_hold` measures it: old code ~100 hand vertices up
  to 11 cm inside him, now 0 and touching. Dev: QA 27/27, smoke 16/16.
- Media: new takes on the fixed build; only the caught shot was cut in (`capture_trailer.mjs --shot-raw`): the
  trailer's first 66.6 s are frame-for-frame identical, the 60 s gameplay video byte-identical, the long one
  identical up to 93.3 s, 7 of 8 GIFs byte-identical; the caught GIF and still 11 re-made.
- Release `v1.5-jam` (6d47ee0): zip verified with the full suite (TEST_RESULTS.md), then tagged.

## Status at 18 Oct 2026 ~11:45 IST — session 8: RELEASE `v1.4-jam` verified and tagged; media being re-made

- **v1.4-jam** (84b60f1; zip sha256 `b9408486…83e4dc`, 159 files, 29.1 MB): the whole suite passes on the extracted zip
  (smoke 16/16 in Edge, Chrome and Firefox, QA 27/27, input, music 12/12, phones 15/15 x2, first line, monkey, stress;
  TEST_RESULTS.md). It supersedes three earlier v1.4 zips made this session (the first passed everything too).
- User requests this session, done: the title screen's footer without "Three.js + Rapier + Blender"; **Grandma never
  stuck** (a watchdog that escalates to a witch's puff exit, even on screen; arrival when blocked near the destination;
  her route checks see loose furniture; DECISIONS #88–89; new `qa_probe granny_never_stuck`, failing on the old code at
  the screenshot's spot); the videos with **the game's waltz alone, laid in post** under takes recorded with the game
  music muted (DECISIONS #91), and a better trailer (beat-synced cuts, music dynamics, thunder impacts, white flashes).
- Also fixed: credits (77 voice lines, all three tracks), a debris race that could freeze a piece in mid-air (#90).
- Trailer staging: the dining-table leap (it hit the candle and never got up) and the window crash (he sat on the sill)
  were re-staged from experiments; the vase shot is framed closer. Takes re-recorded on v1.4-jam (:4173).

## Status at 18 Oct 2026 ~10:05 IST — session 7: PLAYTEST 4 COMPLETE (12/12) + dynamic music + phones; v1.4 being verified

All twelve playtest-4 issues are fixed, each verified in the browser; the new probes fail on the old code
(DECISIONS #71-86):
| # | Issue | Fix | Evidence |
|---|---|---|---|
| 1 | menu title | logo ~1.6x bigger at the top, description bigger, sizes by window height | `scripts/menu_shots.mjs` 3 sizes; menu fits 740x360 |
| 2 | first intro line silent | audio decoded at boot (OfflineAudioContext); Play waits <= 2.5 s for the intro lines | `first_line_test` (fails on old code) |
| 3 | Komur faces away | turned to the camera (intro meow, outro line); watches her tantrum | screenshots |
| 4 | intro -> another room | he bolts past Grandma; play starts in the dining room | `qa_probe tutorial_flow` |
| 5 | catch hold | scruff placed in her grip each frame after posing; arm's-length hold | `qa_probe catch_hold` |
| 6 | neck 360 | three.js mixer skips unchanged bones -> layer accumulated; restored per frame | `qa_probe head_never_spins` (old: 178.7°) |
| 7 | floating triangles | FX land on the real floor; ceiling lets debris through | `qa_probe no_floating_fragments` (old: 166 shards) |
| 8 | tutorial + controls | move/leap/swipe/meow/dodge, TAB skip, legend top right | `tutorial_flow`, screenshots |
| 9 | kitchen window | climbs break panes; cauldron moved; pane safety net | `qa_probe ground_floor_windows` (12 windows) |
| 10 | passive Grandma | patrols after the intro, level-triggered sighting, world stepped once | browser check, `tutorial_flow` |
| 11 | sounds | one sound per F; recorded hiss/pounce/jump (ElevenLabs key 1) | browser check |
| 12 | SP03 hole | real hole: planks fall through, broken rim + cracks | `qa_probe sp03_floor_hole` |

User requests during the session, done: **dynamic music** (`src/audio/MusicDirector.js`: waltz / chase 20-60 s /
MELTDOWN; per-track positions, bar-aware equal-power crossfades, seamless bar loops, hysteresis; `music_test` 12/12)
and **phones in landscape** (`src/ui/Touch.js`: stick, swipe-look, buttons, rotate screen holding the game, phone HUD,
touch prompts, Low effects + 8 lights; `mobile_test` 15/15 at 844x390 and 740x360). Real phones: NOT TESTED.

Release: `npm run package` at commit 632975e -> zip sha256 32f1df62...1c8dbf (159 files, 29.1 MB), extracted and
served at :4180. Its suite (log: see NEXT_SESSION_PROMPT.md): smoke Edge 16/16, qa 25/26 (conservatory window 14
once let Komur behind intact glass -> pane safety net in d190127, verified on dev), input PASS, music 12/12, mobile
15/15 x2, first line PASS; Chrome/Firefox smoke, monkey, stress were still running at the handoff.
**Next: rebuild from d190127 (the zip predates the last two fixes), re-verify, tag v1.4-jam, re-record media.**
`v1.3-jam` stays the fallback until then.

## Status at 18 Oct 2026 ~08:25 IST — PLAYTEST 4 RECEIVED (12 issues), investigated, now fixed (session 7, above)

The user played v1.3-jam (~07:20–08:10) and asked for (their words, condensed):
| # | Issue | Finding so far (session 6) |
|---|---|---|
| 1 | title logo bigger and higher on the menu; the description bigger | menu CSS (`#menu .logo`, `.sub` in `src/ui/style.css`); not changed yet |
| 2 | intro: Grandma's first line ("seven years of bad luck") silent the first time only | **cause found**: `AudioManager.unlock()` (Play click) creates the context and only then `loadAll()` fetches + decodes every file; `G_INTRO_01` (t = 0.4 s) has no buffer on the first run |
| 3 | intro and outro: Komur faces away from the camera | intro step t = 10.45 sets `cat.yaw = 0` with the camera at (-3.9, 0.5, 3.1) → turn him to the camera; outro: on the well rim at yaw π·0.9 (`beginOutro`) |
| 4 | after the intro Komur should run into another room so the chase doesn't start at once and players can learn | play starts mid-foyer next to Grandma (`_endIntro`) |
| 5 | caught + cauldron: Grandma's hand and Komur don't match (clipping / floating); fix the hold, else make him float by witchcraft | cat placed at `handWorld() − 0.45 y` (`beginCaughtEnding`, `_stageCauldron`); gameplay `holding` too |
| 6 | the neck still does a 360° sometimes | NOT procedural accumulation (all 42 clips key Neck/Head/spine/tail; the look layer is clamped ±1 rad); cause still to find (watch head vs body during stun, holding, idles, turning) |
| 7 | triangular slices left floating in the air after big events | not investigated (debris frozen in slow motion? FX shards?) |
| 8 | a proper skippable tutorial (jump, destruction, meow/taunt) + controls listed top right, 1–2 words each | design in NEXT_SESSION_PROMPT.md |
| 9 | the kitchen window doesn't break when running through it (others do) | not investigated |
| 10 | without the vase Grandma ignores Komur breaking things next to her | the 'vase' tutorial stage gates her; she should react from the start |
| 11 | better hiss / pounce / jump sounds (sourced properly); F plays hiss and meow at once | `catTaunt` in `Director.wire()` plays `meow_annoyed` (40%) with the hiss |
| 12 | SP03: no hole in the bedroom floor after the wardrobe falls; needs a broken, cracked hole the cat can drop through | not investigated |
Plan, order and verification steps: NEXT_SESSION_PROMPT.md. `v1.3-jam` remains the shippable fallback.

## Status at 18 Oct 2026 ~06:15 IST — session 6: trailer, GIFs, gameplay video, store stills, deck; release v1.3-jam

- **Re-checked v1.1-jam** from its zip first (unit 9/9, smoke 16/16, QA 16/16, input PASS) and added 3 QA probes for
  what had no automated check: `achievements_unlock`, `ending_plays_through` (the unskipped ending: dawn, tantrum,
  beams, THE END, results), `achievements_persist` (menu screen after a reload).
- **Fixes found by reviewing the trailer recordings** (release `v1.2-jam`, DECISIONS #67–68): the cauldron's brew light
  blew Komur's white chest out into a green-white blob (moved to the brew's surface); Grandma's hat and broom filled the
  screen when she walked past the follow camera after the vase (she is not drawn within 0.8 m of the lens; new probe
  `granny_at_the_lens`, which fails on v1.1-jam); the Controls screen said WASD "Run". Then `v1.3-jam`: the results
  quotes opened with a closing quote mark (IM Fell draws `"` that way) → typographic quotes.
- **Media** (all from the real game, `scripts/capture_trailer.mjs`): `bad-omen-trailer.mp4` 78.7 s (clean take, music
  bed, slow-motion impacts, cauldron stinger), `bad-omen-gameplay-60s.mp4` 59.2 s (docs/11's ~60 s video) and
  `bad-omen-gameplay.mp4` 112.8 s (HUD take), all -14 LUFS; 8 GIFs (2.8–14.2 s, 0.9–2.6 MB); 12 new 1080p store
  stills + cover (the old set showed the removed rain, the teapot clipping and the old ending). The recorder had a
  never-run trailer step (crashed), recorded half a take over the results screen when Grandma caught Komur (catches are
  now off outside the caught shot, and a take aborts if a shot starts on the results), lost the intro's first line to a
  between-shot hush, and ffmpeg 8.1.1 segfaults on an animated drawtext fontsize (cards now zoom with zoompan).
- **Deck** rebuilt (validate.py PASSED, no overflow in the HTML render; no PowerPoint/LibreOffice here to render the pptx).
- Still needs the developer: the itch.io upload (then the link goes into SUBMISSION.md and deck slide 5) and the
  playtest-3 #1 confirmation (head turning = tail-chase idle).

## Status at 18 Oct 2026 ~05:00 IST — session 5: PLAYTEST 3 COMPLETE (12/12) + user requests

All twelve playtest-3 issues are fixed, each verified in the browser (details in DECISIONS.md #55–66):
| # | Issue | Fix | Evidence |
|---|---|---|---|
| 12 | Grandma stuck in the kitchen fire | recoil out + 3 s flinch cooldown, fires at her feet blow her out, paths avoid flames, 2.5 s safety net | new `qa_probe granny_at_stove` fails on the old code (10 s in the fire, 11 flinches), passes now (out in 0.12–0.18 s) |
| 2 | title screen: Komur inside the teapot | teapot moved to the free end of the centre row | screenshots at three camera sweeps (1920x1080) |
| 9 | broom through Grandma's hands in the intro | no broom while casting / holding the cat; summoned back with a sparkle | screenshots: intro close-up, menu, holding |
| 8 | jumping into a window didn't break it | airborne/galloping contact with a pane breaks it, momentum kept | new `qa_probe jump_through_window` (real W + Space) |
| 10 | caught should end the game | after the tutorial: CAUGHT beat → kitchen cauldron scene → CAUGHT results (tutorial catches stay a toss) | new smoke `caught_ending`; screenshots of every beat from 3 catch locations |
| 11 | stun + voices + quest hints + less chatter | 2 s stun (stars, no control, Grandma rushes in); 20 new ElevenLabs lines (994 chars); voiced quest prompts; Komur ≥ 14 s between non-priority lines | new `qa_probe stun_then_catch`; dialogue event logs |
| 1, 3–7 | (session 4) | — | still pass (`props_stand_on_legs`, `debris_falls…`, turning, no rain) |
**Ask the user to confirm #1** ("head turns 360°" was read as the ChaseTail idle, now out of the rotation).

User requests during the session, done: **KTX2 textures** (tested, kept: wood-texture VRAM 112 → 28 MB, +2% fps,
no visible change, +4.3 MB download), **16 achievements** (card, results line, menu screen), **a bigger ending**
(garden at dawn, Grandma's tantrum finishes the house off, crane shot, THE END card). In progress: **AAA-style
trailer** + **≤ 15 s / ≤ 3 MB GIFs** for itch.io (`scripts/capture_trailer.mjs`, `scripts/trailer_music.mjs`).

Verified on dev (05:00): npm test 9/9, smoke 16/16, qa_probe 15/15, input test PASS. Release zip rebuilt
(153 files, 25.3 MB); release checks on the extracted zip: see TEST_RESULTS.md.

## Status at 18 Oct 2026 ~02:55 IST — PLAYTEST 3 IN PROGRESS (6 of 12 fixed, commit 1aae28e + probes)

The user played the v1.0-jam build (~01:30–02:30) and reported 12 issues (their words, condensed):
| # | Issue | Status |
|---|---|---|
| 1 | "the cat constantly turns the head 360° randomly" | **Fixed** (interpretation): the ChaseTail idle spin is out of the fidget rotation, fidgets every 6–10 s. No clip turns the head > 69°. **Ask the user to confirm** it's gone. |
| 2 | title screen: Komur clips through a vase/teapot on the dining table | open — `dining_teapot` at (4.4, table top, -0.5) is exactly where `Game.toMenu()` seats him; move him (or it) and re-frame `menuCamera` |
| 3 | remove the "ONE CAT. TWO FLOORS. NO DEPOSIT REFUNDS." menu heading | **Fixed** (menu only; the tagline remains in the video end card, deck and SUBMISSION copy) |
| 4 | constant "zzzz" (rain): remove the rain | **Fixed**: rain streaks + `rainLoop` removed (`src/fx/Rain.js` deleted) |
| 5 | chairs have no legs | **Fixed**: they had sunk 0.43 m (legs don't collide) → support blocks; wheelbarrow got back legs |
| 6 | broken things / debris float in the air | **Fixed**: freeze only when resting, support checks, fall when the support breaks |
| 7 | WASD doesn't change direction properly, "feels broken"; the cat should turn its head and go | **Fixed**: turn on the spot toward the key (TurnL/TurnR, head leads) |
| 8 | jumping through a window doesn't break the glass unless you swipe it | open |
| 9 | intro: the broom clips through Grandma's hands | open — broom is on the right-hand bone along the fingers; plan: no broom during the intro/menu Cast (she "fetches her broom" after), hide during catch/holding |
| 10 | being caught should END the game with a scary/funny "caught" scene (Grandma about to drop Komur into a boiling cauldron) | open — design in NEXT_SESSION_PROMPT.md |
| 11 | a thrown weapon that hits Komur stuns him ~2 s; more ElevenLabs lines (up to ~1000 credits) for taunts and both characters; the set-piece hint texts ("Tempting…") become voiced quest prompts that stop once done; Komur talks only at intervals/important moments | open — check the ElevenLabs balance first (handoff said key 2 had ~880 characters) |
| 12 | Grandma gets stuck in the kitchen fire after smashing the stove (flinching in place) | open — `Fire.js` re-triggers `react('flinch')` every step while she's in a hot zone |

Verified at the checkpoint: smoke 15/15, qa_probe 11/11 (+ 2 new probes PASS), npm test 9/9, build OK. The release
zip `submission/bad-omen-web.zip` and tag `v1.0-jam` are the **pre-playtest-3** build; a new release is needed.

## Status at 18 Oct 2026 ~00:30 IST — session 4: QA pass, first-impression fixes, release candidate

Re-verified the handoff build first (npm test 9/9, build, secrets, smoke 15/15 on the preview). Then a QA pass
(new `scripts/qa_probe.mjs`, re-staged smoke test, screenshots of every room and of the opening) found and fixed:
1. **Opening frame**: after the intro Komur stood 0.9 m from the front door, so the camera was jammed against the
   wall (0.65 m) behind his raised tail and the tutorial vase was off-screen. Play now starts mid-foyer facing the
   vase table (hard camera cut), Grandma exits out of shot, the prompt sits below the cat.
2. **Tail in the lens**: the tail droops when the camera is pressed close behind him (walls, corners).
3. **Blown-out foreground**: Komur's fill light (decay 1.6) blew white cups/teapots near the lens into bloom blobs
   (conservatory); now a flat fill inside 2.4 m.
4. **Subtitles** half under the cutscene letterbox → above it.
5. **Skipping the intro/outro** fired every remaining line, the meow and the door slam at once → silent skips.
6. **Restart leak**: ~11 GPU textures per restart (bone textures, shadow map) → flat.
7. Tests: wardrobe smoke test now gets a real throw 5/5 and requires it; the input test's sprint ran into a wall
   from the new start (0.59 m/s but "PASS") → runs into the hall and asserts 3.9 m/s.
8. Perf check: the game is not draw-call bound on this iGPU (hiding every prop: +2–9 fps), so no prop merging;
   small moonlit parts stopped casting moon shadows.
Also: gameplay video re-recorded (94 s + 66 s, 0 errors, every disaster by a real throw), deck slide 4 corrected
(rage tiers) and rebuilt, `submission/QA_CHECKLIST.md`, itch.io zip packager (`npm run package`).

Later in session 4 (00:25–01:10): Grandma's path shortcuts no longer run under table tops (she stalled ~2 s at the
dining table; garden → living room 15–23 s → 5 s); furniture at the lens is no longer drawn (a pantry top 5 cm under
the lens filled a quarter of the screen); the prompt stays above stacked subtitles; no console warnings at all
(PCFSoft shadow fallback); per-throw weapon geometry is freed; QA probe 11 checks (menu round trip, robust memory
metric); **Firefox 153 runs the whole smoke suite 15/15**; store screenshots + itch.io cover in
`submission/screenshots/`; an AI-tools disclosure note for the developer in `submission/SUBMISSION.md`.
The release zip is re-verified from the extracted zip (see TEST_RESULTS.md) and tagged `v1.0-jam`.

## Status at 17 Oct 2026 ~23:45 IST — playtest-2 fixes done; video, deck and submission copy made (commit 1638b5d + docs)

### Session 3: the user's second playtest (~22:15) asked for, all done and verified in the browser
1. **Frame drop when Grandma smashed the table** — it was the game: a broken candle hid its point light, the
   light count changed and every shader recompiled (measured **5.2 s** single frame, 49 → 64 programs).
   New `src/world/LightRig.js`: a fixed pool of 12 real lights fed by virtual lights. Plus fragments/particles on
   a per-frame budget and WAAPI banner pops. Table smash now: worst frame **51 ms**, break JS 60 → 16 ms, 0 new
   programs. Indoor props/debris no longer cast moon shadows: 1482 → 1023 draw calls; headless frame time
   27.2 → 21.5 ms; stress test 50 fps at 80% destruction (was 40).
2. **Running felt weird / sprint too fast / walk should be a graceful catwalk** — the gait clips had short strides
   and played at ~3× (scurrying), and every procedural gait held the head ~30° up (offsets from the source Idle).
   New long-stride single-track **catwalk** is the default (1.45 m/s, ~1.9 strides/s); gallop 5.1 → 3.9 m/s;
   gaits look ahead; Grandma's chase rebalanced (2.05–3.2 m/s: catches a walker, never a galloper).
3. **Idle life with things to say** — fidgets (look around, sniff, groom, stretch, tail chase, nudging a
   knick-knack off the furniture), sit, lie down in a loaf; 12 new voiced idle quips (57 lines total).
4. Also: HUD fits narrow windows; quality toast under the score; camera framing keeps the tail out of the view;
   no glowing tail tip / white-ghost fur near candles; a proper witch hat and sofa; dialogue lines never cut each
   other off, no duplicates, queued lines expire; disaster banners keep priority; cleat glows switch off after
   their set piece; lit outro; SP03 camera; intro/vase line timings.
5. **Submission**: `submission/SUBMISSION.md` (form copy), `submission/deck/` (5-slide pptx + pdf, validated),
   gameplay video tool `scripts/capture_trailer.mjs` (a ~94 s and a ~66 s cut were made; **the current take
   predates the last lighting fix (fill light / candles) — re-record before submitting**).

### Next (see NEXT_SESSION_PROMPT.md)
Re-record the video; release build + preview smoke + web zip + release tag; fill in the play link once the user
uploads (needs their account); feature freeze 12:00 IST. The user has not yet played the session-3 build.

## Status at 17 Oct 2026 ~22:05 IST — playable, overhauled per user playtest feedback (commit d1203ee + docs)

Complete game loop: title menu → skippable voiced intro → tutorial objectives → free wrecking with hints →
**5 major set pieces** (SP01 chandelier, SP02 kitchen fire, SP03 wardrobe through the floor, **SP10 glass house**,
SP04 roof-collapse finale) + 4 bonus disasters → outro → results (rank, stats, personal best) → restart / menu.

### Session 2: the user played it and asked for (all done, verified in the browser)
1. **Cat movement that feels like a cat** — `src/player/Cat.js` rewritten:
   trot 2.6 m/s / gallop 5.1 m/s with acceleration (was 4.6/7.2, instant); velocity steers through arcs with
   banking; hard reversals at speed = Tom-and-Jerry drift (skid, scrabble, launch); sprint wind-up from a
   standstill; **aimed leaps** (Space plans a leap onto the surface ahead: prep crouch → ballistic arc →
   forepaws-first landing; >1.3 m = hook-and-scramble climb; across-gap leaps; leaps over chairs; lands among
   knick-knacks and bowls them over) with an amber landing ring; aimed hop-down off table/counter edges;
   landing weight by fall height; reactions (startle at crashes, hiss when spotted, shake-off after a toss);
   idle variety (look around, groom, stretch, sit); procedural layer (spine C-curve into turns, tail
   counterweight, head tracks Grandma, body pitch on stairs / leap arcs).
2. **38 animation clips** (was 23): `tools/blender/komur_actions.py` v2 — footfall-pattern gait generator
   (diagonal trot, rotary gallop with spine flex/extension, sneak, scrabble), JumpPrep, JumpUp, LandOn, Climb,
   JumpDown, LandSoft, LandHeavy, Skid, TurnL/R, Swipe/SwipeL, Nudge, Hiss, Startle (puffed tail), ShakeOff,
   Groom, Stretch + originals. Gait speeds measured and exported to `src/data/komurAnims.json` so playback rate
   matches ground speed (no foot sliding). Rebuild: `npm run assets:blender` (new `scripts/build_assets.mjs`).
3. **Camera**: constant distance (no speed zoom/FOV kick), collides only with architecture, fades any furniture
   between it and the cat.
4. **Throw telegraph** no longer lingers after the throw (Grandma kept redrawing it during recover).
5. **Bigger house**: glass-roofed **conservatory/library wing** (5.4×10 m) off the living room (2 doorways + yard
   door): library (40 books), tea table with cake stand and china, potion bench, 2 plant stands (18 pots), crow
   cage, telescope, gramophone, terrarium…; **19 breakable glass windows**; cat flap in the front door (Grandma
   can't use it: porch can never trap the cat); yard widened to x=13 with bird bath, scarecrow, bench, pots;
   extra props in old rooms. **375 breakables** (was 229). Mantel is now a real 0.45 m perch.
6. **SP10 THE GLASS HOUSE**: claw the plant-chandelier rope at the cleat by the wing door, bait a throw at the
   chandelier over the tea table → it wrecks the tea party, rips the rafter, the glass roof comes down and rain
   pours in. Counts as a major disaster (finale needs 2 of 4).
7. **Voices**: 10 new ElevenLabs v4 lines (G_GLASS, K_GLASS, K_LEAP, K_SKID, K_STARTLE, K_WINDOW, K_GROOM, G_WINDOW,
   G_HISS, G_TEAPARTY) → 45 total; synth hiss + claw-skitter SFX.

### Bugs found and fixed in session 2
- Rapier KCC stalls: any grounded move with a downward component intermittently returned ~0 movement (~7% of
  steps) → running stuttered; on the stairs the same when pushing into the ramp. Fix: grounded moves are flat
  (or tangent to the slope) for the cat AND Grandma; snap-to-ground follows stairs. Trot is now a constant 2.6 m/s.
- Switching to Low quality froze rendering ~3 s (bypassing the composer recompiled every material). Low now keeps
  the composer and only drops bloom + MSAA; shaders pre-compile for the composer target at boot.
- Tutorial vase could survive being swiped off its table (table-edge + wall bounce, 3.25 m/s < 3.4 threshold).
- Grandma's reaction anims never played during set-piece cinematics (she is parked in 'scripted').
- White tail tip bloomed like a light bulb (fill light, bloom threshold 0.82→0.9, fur white 0.93→0.84).
- Menu camera stared into walls; now frames Komur on the dining table (left third).

### Verified (see TEST_RESULTS.md)
`npm test` 9/9 · `browser_smoke` **15/15** (dev) · `input_test` PASS · `stress_test` PASS (80% destruction,
700 debris: ~40 fps bloom / ~63 fps low in headless Edge; Grandma 60 s soak no stuck; all set pieces + finale +
results; 0 console errors) · `npm run build` OK (19 MB dist) · `check_secrets` OK.

### Known issues / next priorities (see NEXT_SESSION_PROMPT.md)
1. The user has NOT yet re-played the overhauled build — get their feedback first if they are around.
2. Submission package: gameplay video (with audio), 5-slide deck, title/description/controls, final release build.
3. Possible polish: room light balance, HUD layout under 1100 px wide, Grandma's held-weapon placement.
4. Smoke test `wardrobe_through_floor` occasionally needs its fallback trigger (Grandma's swing/catch randomness).

## Log
- 18:30 Session 1 start, docs read, assets audited. 18:45 Komur pipeline. 19:05 Grandma pipeline.
- 19:10–19:50 engine, cat, house, props, destruction, Grandma AI, UI, audio, set pieces, director.
- 19:55–20:05 smoke suite 14/14 (first playable). 20:05–20:17 camera, bonus disasters, post stack, input test.
- 20:19 Session 2 start; re-verified; fixed tutorial vase; auto quality.
- ~20:55 User playtest feedback (movement gimmicky, camera in/out, telegraph lingers, house small).
- 21:00 telegraph + camera fixes (277b26c). 21:10 movement overhaul + 38 clips (3f35d15).
- 21:20 conservatory wing, windows, cat flap, yard (460c58c). 21:36 leap planner + stairs (827f99b).
- 21:45 SP10 + voices (bc61673). 21:50 menu framing + leap ring (7c9ec7a). 21:58 quality freeze fix + stress test (d1203ee).
- 22:00 Session 3 start; re-verified (npm test 9/9, build, smoke 15/15). ~22:15 user playtest-2 feedback.
- 22:40 light rig + fragment budget + outdoor-only shadows (1fcc7fc, with the catwalk, gallop 3.9, idle life, 12 voices).
- 23:00 HUD/tail/fill (5917a1b); hat, sofa, thresholds (a802e6f); dialogue/banner/outro fixes + video tool (73b54b4).
- 23:30 pitch deck + candle/fill lighting fix (1638b5d). 23:30–23:45 handoff: build, full smoke dev + preview, docs.
- 23:34 Session 4 start; re-verified (9/9, build, smoke 15/15 on the preview). 23:59 opening frame, tail droop,
  subtitles, restart leak, qa_probe (dc9ae82). 00:10 fill light, shadow casters, silent skips, QA checklist
  (62e748d). 00:15 video re-recorded. 00:20 deck fix + zip packager (cef9eca). 00:25 release zip tested under a
  nested path. 00:28 nav LOS fix + Firefox option (d9a34d8). 00:39 furniture-at-lens + screenshots (8e27040).
  00:47 first `v1.0-jam` tag (59d38f7). 00:52 prompt above subtitles, no warnings, menu probe (8c94814). 01:06
  weapon geometry freed, memory probe metric, AI note (1b6eac1). ~01:10 final release zip verification.
- 01:20 input fix + v1.0-jam re-verified (f5269c1, tag 9f73254); 01:27 monkey test PASS (d3b489c).
- ~01:30–02:30 user playtest 3 (12 issues). 02:50 part 1: 6 fixes (1aae28e). 02:55 handoff (context full).
- 02:55–05:07 session 5: playtest-3 fixes 2–12 (5a60275 … f852c2b), KTX2 (9f985ac), achievements + new ending
  (6811c4f), release v1.1-jam, trailer tooling (37803f0), handoff (4ed043e).
- 05:08 session 6 start; v1.1-jam re-checked from its zip + 3 probes (cbcd2c3). 05:14 first trailer take: review →
  cauldron light, Grandma at the lens, controls text (9260392) → v1.2-jam verified + tagged 05:39 (d38de64 tooling).
  05:40–05:57 takes A (HUD), B (clean, ×3: a catch ended one, a hush cut the intro line), C (1080p stills); gameplay
  cuts 59.2 / 112.8 s; trailer 78.7 s; 8 GIFs; store stills + cover (f7931cf); deck (bcac6ed); results quotes →
  v1.3-jam (cfc4bb1). 06:17 v1.3 checks; 06:33 monkey + stress PASS; 06:40 Chrome smoke 16/16.
- ~07:20–08:10 user playtest 4 (12 issues); 08:14–08:25 investigation (no code changes); 08:21 handoff re-check of
  v1.3-jam (unit 9/9, smoke 16/16, achievements/ending probes 4/4); handoff (context full).
