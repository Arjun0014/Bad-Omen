# BAD OMEN — Executed Test Results

All results below were produced by actually running the commands; nothing is marked passed without execution.

## 18 Oct 2026 14:35–14:45 IST — session 9: the zip checked byte by byte; RELEASE `v1.8-jam` (FPS readout)

- **Zip layout** (user: backslash paths broke an itch.io build before): a raw parser of the zip's central directory and
  local headers (Python's zipfile turns "\" into "/" when it reads on Windows and would hide the bug): 159 entries,
  every stored name with "/" only, `index.html` at the root, top level `assets/ audio/ index.html licenses/`, no
  directory entries, deflate, longest path 46, every member's CRC and size good. Negative control: a zip with a planted
  `assets\index.js` is flagged (Python's own namelist shows it as `assets/index.js`). Windows' `tar.exe` (libarchive)
  lists 159 and extracts byte-identical to `dist/`.
- **RELEASE `v1.8-jam`** (2dce0ea, user request: the FPS readout without "draws · granny … · rage …"):
  `submission/bad-omen-web.zip` sha256 `d07797c74c8ad4bd72571a8cf121592a4a296ee8da8b2f303e731b669958dc08`, 159 files,
  29.1 MB, `check_secrets` OK, `npm test` 9/9, the byte-level check clean; extracted and served by
  `itch_like_server.mjs`: the readout reads "37 fps" with Show FPS on (screenshot), smoke **16/16**, 0 problems.

## 18 Oct 2026 14:28–14:31 IST — session 9: RELEASE `v1.7-jam` (crouch on C only)

- User-approved: crouch was bound to C and Ctrl; holding Ctrl and pressing W is Ctrl+W, which closes the tab in
  Chrome/Edge (a page cannot block it). Now C only; the Controls screen says "C" (checked in the built bundle).
- **RELEASE `v1.7-jam`** (9629d22, clean tree): `submission/bad-omen-web.zip` sha256
  `c83e5cb0359eca29d782545cbf2e494df3eda89895dd7db149029f21f3172215`, 159 files, 29.1 MB, `check_secrets` OK, `npm test`
  9/9. Extracted, served by `itch_like_server.mjs`: smoke **16/16**, 0 wrong-case/missing requests (the one check the
  user asked for). Media unchanged (the trailer from v1.6 shows no crouch).

## 18 Oct 2026 13:55–14:22 IST — session 9 (later): playtest 6 (the held cat glitching, idle lick-and-sit), RELEASE `v1.6-jam`

The user asked for these two changes and the trailer's last part only, quickly, without long test runs: only the
checks below were run (the full release suite was not re-run on v1.6).
- **Held Komur glitching** (user: "no clipping, but the cat is glitching around" in catches and over the cauldron).
  A per-frame trace of `_clearOfHand` on dev (:5174), `scratchpad/hold_jitter.js`: on the v1.5 code the cauldron scene
  had **53 flips** of the way out in 637 frames, jumps of the push up to 35 cm between frames (p95 26 cm), Komur moving
  up to 40 cm against her grip in one frame; in a catch, jumps of 24-30 cm with the "away from the fingers" way alone
  (it turned with whichever fingers were in him). Fix (DECISIONS #93), then: **0 flips** in both, frame-to-frame motion
  against her grip p50 0.8 cm / p95 2.7 cm in the cauldron scene and p50 1.4 cm / p95 4.1 cm in a catch (her shake);
  one 19 cm jump remains at the cauldron scene's first frame, where the scene re-poses both of them (the push hardly
  changes there: it was there before). Intermediate attempts measured and dropped: easing with a 3 mm / 1 cm safety
  snap (the snap threw him), a 5-frame median (fingers 10 cm in him in a fast catch), 30 cm/s give-back (hand off him).
- `qa_probe --only catch_hold` (dev): 0 hand vertices in him in every run after the fix; the "touching" limit went from
  3 to 5 cm (the hold now gives its push back over 0.12 s in the cauldron scene: her fingers 3-5 cm off his scruff for a
  moment in 1 of 3 runs); final runs: PASS x2 and one at gap 4.9 cm before the limit change. `head_never_spins` PASS.
- **Idle** (user: "let it sit and lick itself"): in game, standing still with Grandma away: the paw lick (Groom) at
  2.8 s, sits down at 6.3 s, then SittingIdle (was: a random fidget at 3.5-5.5 s, sitting only after 18 s); screenshots.
- **RELEASE `v1.6-jam`** (5f0a84b, clean tree): `submission/bad-omen-web.zip` sha256
  `7b76fe86554e08816752697deb1253130c5699675c56a2038000b96c29cc5b19`, 159 files, 29.1 MB, `check_secrets` OK, `npm test`
  9/9; vs v1.5 only the main JS bundle and index.html differ. Extracted and served by `itch_like_server.mjs`
  (case-sensitive): smoke **16/16**, 0 wrong-case/missing requests.
- **Trailer, only its last part** (the cauldron stinger): a clean take recorded from v1.6 (:4173, 5,830 frames, 0
  errors, `submission/video/raw_clean_v16`), cut in with `--shot-raw caught=submission/video/raw_clean_v16`:
  75.7 s; its first 2,004 frames (66.9 s) are identical to the approved trailer (`ffmpeg -f framemd5`), the audio there
  is the same mix (within 0.16 dB in every 400 ms window, re-normalised +0.02 dB); the new stinger reviewed on a contact
  sheet and 16 consecutive close-up frames (he holds his place by her hand). The gameplay videos, the GIFs and the
  stills were not changed (the long gameplay video's ending, the caught GIF and still 11 come from v1.5).

## 18 Oct 2026 13:26–13:55 IST — session 9: handoff re-check of `v1.5-jam` (the zip, a rebuild, smoke, probes, media, an itch.io-like host)

Logs in the session-9 scratchpad (`smoke_s9_edge.log`, `qa_s9.log`). Nothing in the game changed.
- **The release zip is unchanged and reproducible**: `submission/bad-omen-web.zip` sha256 `fa9da23a…941aab` (matches the
  v1.5-jam record), 159 files; the copy served on :4180 and `dist/` are byte-identical to its contents (`diff -rq`);
  `git diff v1.5-jam HEAD -- src public index.html package*.json vite.config.js` is empty; **a fresh `vite build` of
  HEAD into a scratch folder is byte-identical to the zip's 159 files**; `check_secrets` OK; `npm test` 9/9.
- **On the served zip (:4180)**: smoke Edge **16/16** (console clean); `qa_probe` **27/27** (catch_hold: 0 hand vertices
  inside him, gap 0–1 cm, cauldron 0.2 cm; granny_never_stuck: worst 2.35 s, one puff exit in 23 walks;
  no_floating_fragments: SP01 0, SP10 3 shards resting above their surface, which is the probe's limit (the release run
  had 1); console clean). Desktop, no touch emulation: no `touch` class, touch mode off, `#touch` not displayed, 12 real
  lights in the pool (31 virtual).
- **Media vs the approved v1.4 cut** (the session-8 backups, `media_v14/`): the 60 s gameplay video and 7 of 8 GIFs are
  byte-identical (the caught GIF is the re-made one); `ffmpeg -f framemd5` on the video streams: the trailer is identical
  for its first 2,004 frames (66.9 s of 75.9 s), the long gameplay video for 2,799 frames (93.3 s of 114.9 s). Their
  **audio is not bit-identical but is the same mix**: sample-aligned (lag 0), the level within 0.14 dB in every 400 ms
  window (0.07 dB in 3 s windows), a constant -0.06 dB (trailer) / -0.02 dB (long video) from the whole-file loudness
  normalisation re-run after the caught shot changed, and a residual that rises with frequency (-26.5 dB below 2 kHz,
  -8 dB above 8 kHz, each relative to its band): AAC re-encoding noise, not an audible change. Durations, formats and
  sizes as in SUBMISSION.md (1280x720 30 fps H.264 + AAC 48 kHz); all 8 GIFs under 3,000,000 bytes.
- **Deck rebuild pre-flight**: `build_deck.cjs` on a scratch copy with a dummy link on slide 5: built, no overflowing
  text boxes, `validate.py` PASSED, slide 5 reviewed (the link fits on one line). The real deck waits for the itch.io
  link.
- **Case-sensitive host (itch.io's CDN)**: itch.io's HTML5 docs (read 13:50): file names are case-sensitive, a path
  ending in "/" gets a 403, relative paths only, at most 1,000 files / 500 MB extracted / 200 MB per file / 240-character
  paths, external resources over HTTPS. Every earlier test ran on Windows (case-insensitive). New
  `scripts/itch_like_server.mjs` serves a folder that way under `/html/12345/` and reports problems and the files no
  test requested. On a fresh extraction of the v1.5-jam zip: smoke **16/16** through it, plus the JPG fallback
  (`?ktx2=0`: the 24 JPGs, the game playing): **154 of 159 files requested, 0 wrong-case / missing / trailing-slash
  requests**; never requested: 3 licence notices (nothing links to them) and Vite's 2 unused hashed copies of the Basis
  transcoder (the game loads `assets/basis/`); a deliberately wrong-case request is caught (404 "WRONG CASE"). The zip:
  159 files, 36 MB extracted, longest path 46 characters, `index.html` at the root; the bundle loads nothing from
  another host (its URLs are credit links, a comment and XML namespaces).

## 18 Oct 2026 12:15–13:25 IST — session 8 (later): the hold fix, RELEASE `v1.5-jam`, the caught shot re-made

- **Hand clipping** (user screenshot: the cauldron close-up; also in catches). Measured on the meshes: her hand's
  skinned vertices against his surface (binned along his spine and in 45-degree sectors, the 75th percentile of his own
  back/neck/head vertices per bin). Old code (stash): ~100 hand vertices up to 10–11 cm inside him in a catch, 64 (9.3
  cm) in the close-up. Attempts: capsules (still 4–7 cm at his shoulders), a one-bone rigid vertex placement (its own
  model saw no overlap while the skinned mesh had 4 cm: bones blend), then skinned vertices (DECISIONS #92): 0 inside,
  touching (gap 0–1 cm) in 24 dense samples of a catch and in the close-up; an upward push (her palm under him) is ruled
  out. Dev: `qa_probe` 27/27 (catch_hold rewritten to this measure), smoke 16/16, `npm test` 9/9; close-ups and wide
  shots checked by eye.
- **RELEASE `v1.5-jam`** (6d47ee0, clean tree): `submission/bad-omen-web.zip` sha256
  `fa9da23abf5b0dfd7ecca1b6ad2a7a3f2c053b33b27c493fca857e4782941aab`, 159 files, 29.1 MB, `check_secrets` OK; vs
  `v1.4-jam` only the main JS bundle and index.html differ. Extracted to a fresh `itch/html/12345/` (hash-compared
  with `dist/`), :4180 (`release_v15.log`, 12:59–13:21): smoke Edge **16/16**, `qa_probe` **27/27** (catch_hold: 0 inside,
  gap 0–1 cm; granny_never_stuck worst 2.26 s), input PASS, music **12/12**, mobile **15/15** x2, first line PASS,
  smoke Chrome **16/16**, Firefox **16/16**, monkey **PASS** (303 samples, 0 errors, 0 NaN, 0 escapes, caught 8x, 1
  puff exit), stress **PASS** (58 fps at the start, 62 after 310/370 broken + 111 debris, 95 on Low, Grandma soak 2 puff
  exits / longest stand-still 2.1 s, 0 errors). Tagged `v1.5-jam`.
- **Media, only the caught shot re-made** (user: "update the last part, don't change anything else"): new takes on
  v1.5-jam (clean 5,975 frames, HUD 5,907, 1080p 2,938, 0 errors), cut in with `capture_trailer.mjs --shot-raw
  caught=<dir>`. Checked against backups of the approved files: the trailer's first 66.6 s (1,994 frames, `ffmpeg -f
  framemd5`) identical, the 60 s gameplay video byte-identical, the long one identical up to 93.3 s (where its caught
  part starts; 114.9 s now), 7 of 8 GIFs byte-identical (caught.gif 2.05 MB, 14.2 s); the new stinger and still 11
  reviewed.

## 18 Oct 2026 10:12– IST — session 8: v1.4 zips, Grandma never stuck, media with the waltz in post

Logs in the session scratchpad (`release_v14b.log`, `release_v14_final.log`, `qa_fix.log`, `smoke_fix.log`).
- **Zip 2 of v1.4** (`npm run package` at c1986a3, the session-7 handoff; sha256 `3c79d026…d85f53`, 159 files, 29.1 MB,
  `check_secrets` OK), extracted to a fresh `itch/html/12345/` (hash-compared with `dist/`: identical), :4180: smoke Edge
  **16/16**, `qa_probe` **26/26** (ground_floor_windows passes now: 12 windows, conservatory window 14 included),
  `input_test` PASS, `music_test` **12/12**, `mobile_test` **15/15** (844x390) and **15/15** (740x360), `first_line_test`
  PASS (91 sounds decoded at the click, first line 4.56 s), smoke **Chrome 16/16** and **Firefox 16/16** (the session-7
  nav_between_floors regression is gone). Superseded by two text changes (title footer, credits): monkey/stress not run.
- **Zip 3** (at 1da453a: title footer without "Three.js + Rapier + Blender", credits with 77 lines and all three tracks;
  sha256 `6949e68d…1aa3`; vs zip 2 only the main JS bundle and index.html differ): smoke Edge **16/16**, `qa_probe`
  **25/26** — FAIL no_floating_fragments (one frozen piece without support after SP10; it passed on zip 2: a race, fixed
  below), input PASS, music **12/12**, mobile **15/15** x2, first line PASS, smoke Chrome **16/16**, Firefox **16/16**,
  `monkey_test --minutes 6` **PASS** (0 errors; Grandma needed 3 off-screen unstuck teleports: stalls of 4+ s),
  `stress_test` **PASS** (56 fps at the start, 63 after 317/370 broken + 291 debris, 111 on Low, every set piece and the
  finale to the results, Grandma soak 0 teleports / longest stand-still 2.3 s, 0 errors). The Credits screen and the
  footer were checked in the browser (menu_shots at 3 sizes; Credits opened from the menu: fits, links kept).
- **Grandma stuck** (user report with a screenshot: against the sofa's seat side, searching): new `qa_probe
  granny_never_stuck` (23 walks). On the old code (stash) **FAIL**: 5.19 s stuck at (4.91, 0, 2.38), the screenshot's
  spot, when Komur was last seen on the sofa's back; 4.8 s on another walk. With the watchdog (DECISIONS #88–89):
  **PASS**, worst 2.32 s (wedged in the hearth corner: one puff exit), the sofa case 1.49 s. A 4-minute instrumented
  random-play run on the old code logged no stall over 2 s (the stalls need specific spots: the probe stages them).
- **Debris race** (DECISIONS #90): no_floating_fragments passes on the fix (dev).
- Dev (:5174) after both fixes (84b60f1): `qa_probe` **27/27**, smoke **16/16**, `npm test` 9/9.
- **RELEASE `v1.4-jam`** = zip 4, `npm run package` at **84b60f1** from a clean tree: `submission/bad-omen-web.zip`
  sha256 `b9408486594af290a96590e189d049a0e961e155fd75658cce8d50138f83e4dc`, 159 files, 29.1 MB, `check_secrets` OK;
  extracted to a fresh `itch/html/12345/` (hash-compared with `dist/`: identical; vs zip 3 only the main JS bundle and
  index.html differ), served on :4180 (`release_v14_84b60f1.log`, 11:19–11:41):
  | Check | Result |
  |---|---|
  | Smoke, Edge | **16/16** |
  | QA probes | **27/27** (granny_never_stuck worst 2.27 s, one puff exit; no_floating_fragments 0/0/0) |
  | Real input | PASS |
  | Music | **12/12** |
  | Phone emulation (real multi-touch) | **15/15** at 844x390, **15/15** at 740x360 |
  | First intro line voiced | PASS |
  | Smoke, Chrome (installed, headless, own profile) | **16/16** |
  | Smoke, Firefox | **16/16** |
  | `monkey_test --minutes 6` | **PASS**: 307 samples, 0 errors, 0 NaN, 0 escapes, longest odd state 2.5 s, caught 6x, 4 restarts, Grandma rescue teleports **0** (3 on zip 3) |
  | `stress_test` | **PASS**: 301/370 broken + 113 debris, 56 fps at the start, 59 after, 100 on Low; Grandma soak 2 puff exits, longest stand-still 2.1 s; every set piece + the finale to the results; 0 errors |
  Monkey and stress overlapped two short staging experiments for the trailer on the dev server (same machine): their
  fps figures are low-side; zip 3's (56/63/111 fps, same rendering code) are the clean reference. Tagged `v1.4-jam`.
- **Media from `v1.4-jam`** (:4173 serving its `dist/`), game music muted while recording, the waltz laid in post:
  takes recorded twice (the first showed a failed dining-table leap and a window crash ending on the sill: re-staged
  from two experiments that measured the landing and the knocked props/pane with live state); final takes: clean 6,048
  frames, HUD 5,755, 1080p 3,027, 0 page errors each. Outputs: trailer 75.9 s (title slam 14.45 s, end card 62.45 s,
  9 impacts, 2 slow-motion breaths; -11.1 → -14 LUFS), gameplay 61.3 s and 115.0 s (-12.9/-12.5 → -14 LUFS; the waltz
  ends with its own ending on the end card / loops once on a bar line), 8 GIFs 0.9–2.7 MB (all < 3,000,000 bytes),
  11 new 1080p stills. Checked: 1-fps contact sheets of the trailer and the 60 s video (every beat in order, no stray
  frames of the next camera angle at segment ends: windows placed with `tools/video/find_cuts.py`), loudness curves
  (integrated -13.9 LUFS, true peak -0.9 dBTP; music up on the cards, ducked under dialogue, silent under the stinger),
  the stills one by one. **Not listened to** (no audio output here): the mix is checked by measurement only.
- Deck rebuilt (slide 2's image from the new take, music/phones/credits text): `validate.py` All validations PASSED,
  no overflowing text boxes in the HTML render, slides 2 and 5 reviewed.

## 18 Oct 2026 08:30–10:05 IST — session 7: playtest 4, dynamic music, phones; first v1.4 zip

Dev (:5174, the no-HMR probe server) during the session: `npm test` 9/9 (again at 10:03 on d190127); smoke **16/16**
(after the music system); `qa_probe` **26/26** (6 new probes: ground_floor_windows, head_never_spins,
no_floating_fragments, sp03_floor_hole, catch_hold, tutorial_flow); `input_test` PASS; `music_test` **12/12**
(crossfade level within -4.2/+1.8 dB of the tracks around it); `mobile_test` **15/15** at 844x390 and 740x360;
`first_line_test` PASS, also `--slow` (88 sounds decoded before the menu even on ~6 Mbps). Failing on the old code
(stash checks): head_never_spins (sit 178.7°), no_floating_fragments (166 shards, 7 roof pieces), sp03_floor_hole
(6 planks in the opening), first_line_test (G_INTRO_01 played from no buffer). After the last commit (d190127: pane
safety net, stick origin): `qa_probe --only ground_floor_windows,jump_through_window` 2/2, `mobile_test` 15/15.

First v1.4 zip — `npm run package` at commit **632975e** (sha256 `32f1df62bb9d9f3018db8c2f7017a04e10aa36226223333335a4ae5d091c8dbf`,
159 files, 29.1 MB, `check_secrets` OK), extracted to the session scratchpad `itch/html/12345/`, served on :4180;
log `release_v14.log` in that scratchpad: smoke Edge **16/16**; `qa_probe` **25/26** — FAIL ground_floor_windows:
conservatory window 14 stayed intact with Komur 0.13 m past the glass plane (not reproduced in 4 direct traces;
fixed in d190127 by a pane safety net, so this zip is superseded); `input_test` PASS; `music_test` **12/12**;
`mobile_test` **15/15** (844x390) and **15/15** (740x360); `first_line_test` PASS; smoke **Chrome 15/16** — FAIL
nav_between_floors ("Grandma failed to come back down"): scripted walks had become interruptible by noise and
sight in this session; reverted in the handoff commit b434390 (dev: nav_between_floors 1/1, tutorial_flow 1/1);
smoke **Firefox 15/16** (the same nav_between_floors failure, same cause); `monkey_test --minutes 6` **PASS**
(0 errors, Grandma unstuck 4x); `stress_test` **PASS** (65 fps at the start, 66 after mass destruction, 107 on Low,
every set piece and the finale to the results, 0 errors). Suite finished 10:11.

## 18 Oct 2026 08:18–08:21 IST — handoff re-check of `v1.3-jam` (session 6 end, `test-results/s6_handoff_check.log`)

No game code changed since the tag (`git diff v1.3-jam HEAD -- src public index.html package*.json vite.config.js` empty,
clean tree). `npm test` 9/9; on the extracted zip (:4180): smoke Edge **16/16**, 0 console errors; `qa_probe --only
achievements_unlock,ending_plays_through,achievements_persist,console_clean` **4/4**. Media present: trailer 78.66 s,
gameplay 59.24 s / 112.84 s, 8 GIFs 0.97–2.65 MB, 12 stills + cover; zip sha256 `e75637f6…6dc7b1` (= v1.3-jam).
The user's playtest 4 (12 issues, PROGRESS.md) was received after this build: **no fixes made yet**.

## 18 Oct 2026 06:10–06:20 IST — RELEASE `v1.3-jam` (code of commit cfc4bb1), the itch.io zip itself — SHIPS

`v1.2-jam` + typographic quotation marks on the results screen. `npm test` 9/9; `npm run package` →
`submission/bad-omen-web.zip` (153 files, 25.3 MB, sha256 `e75637f6…6dc7b1`), extracted under a fresh
`<scratch>/itch/html/12345/` (hash-compared: identical), served on :4180 (`test-results/s6_release_v13.log`):
| Check | Result |
|---|---|
| Secrets | OK, no .env values in 153 files |
| Smoke, Edge | **16/16**, 0 console errors |
| QA probes | **20/20** |
| Real input | PASS |
| Smoke, Firefox 153 | **16/16**, 0 console errors |
| Smoke, Chrome (`--chrome`: the installed Google Chrome, headless, own profile; `s6_smoke_chrome_v13.log`) | **16/16**, 0 console errors (first Chrome run of the project; boot 100 fps) |
| Results quote (debug_eval, 1920x1080) | “I barely lifted a paw.” — Komur / “I KNEW that cat was bad luck!” — Grandma: opening and closing marks correct (`submission/screenshots/10_results.jpg`) |
| Random-input playtest (`monkey_test.mjs --minutes 6`, `s6_monkey_stress_v13.log`) | **PASS**: 308 samples, 0 page errors, 0 NaN, 0 falls out of the world, longest non-normal cat state 2.4 s; caught 5× (one fatal catch → cauldron → results → restart), Grandma 0 unstuck teleports, longest stand-still 3 samples; random play triggered SP01; 62 fps avg / 24 min (headless iGPU) |
| Stress (`stress_test.mjs`) | **PASS**: 322/370 broken + 294 debris (60 active): 40 fps with bloom (39 before any destruction on this busier machine), 61 on Low; Grandma soak 0 unstuck teleports, longest stand-still 2.1 s; SP01/02/03/10 + finale → results (BAD OMEN, 426,960, bonus disasters SP06/07/09 too); 0 errors |

## 18 Oct 2026 05:40–06:10 IST — session 6 media from the real game (v1.2-jam build on :4173)

| Output | Result |
|---|---|
| Takes (`capture_trailer.mjs --record-only`) | A: HUD, 3,879 frames, 0 page errors; B: clean, 3 attempts (B1: a catch ended the run mid-take, B2: the intro's first line cut by a hush, B3 good: 4,037 frames, 0 errors); C: 1920x1080, 2,099 frames, 0 errors |
| Gameplay cuts (take A) | `bad-omen-gameplay-60s.mp4` 59.2 s, `bad-omen-gameplay.mp4` 112.8 s; normalised -11.0/-11.2 → -14.0 LUFS, true peak -2.4 dBFS; frame grid reviewed |
| Trailer (take B3) | `bad-omen-trailer.mp4` 78.7 s, 9 braams, 2 pulses, 1 riser, -10.7 → -14 LUFS; frame grid reviewed; short-term loudness -10…-15 LUFS under dialogue, -16…-25 on bed-only cards, no dropouts. **Not listened to** (no audio output here): the mix was checked by measurement only |
| GIFs (take B3) | 8 GIFs, 2.8–14.2 s, 0.97–2.65 MB (all < 3,000,000 bytes), 360–480 px wide; frames reviewed |
| Store stills (take C + staged) | 12 at 1920x1080 + 630x500 cover, each reviewed |
| Deck | `validate.py`: All validations PASSED; HTML render: no overflowing text boxes; 5 slides reviewed |
| Tool bugs found and fixed | trailer step crashed (TDZ); catch ended a take; hush raced the intro line; ffmpeg 8.1.1 segfault on an animated drawtext fontsize (exit 0xC0000005, reproduced in isolation; zoompan instead) |

## 18 Oct 2026 05:30–05:40 IST — RELEASE `v1.2-jam` (code of commit 9260392), the itch.io zip itself

Fixes from the trailer review (DECISIONS #67–68): the cauldron's brew light no longer blows Komur out; Grandma is
not drawn while the gameplay camera is right at her; the Controls screen says WASD walks. `npm run package` →
`submission/bad-omen-web.zip` (153 files, 25.3 MB, sha256 `20905c0a…69deb9d8`), extracted under a fresh
`<scratch>/itch/html/12345/` (hash-compared with the zip: identical), served on :4180 (`test-results/s6_release_v12.log`):
| Check | Result |
|---|---|
| `npm test` (before the build) | 9/9 |
| Secrets | OK, no .env values in 153 files |
| Smoke, Edge | **16/16**, 0 console errors |
| QA probes | **20/20** (new: `granny_at_the_lens`, `achievements_unlock`, `ending_plays_through`, `achievements_persist`) |
| Real input | PASS |
| Smoke, Firefox 153 | **16/16**, 0 console errors |
| `granny_at_the_lens` after hardening its end-of-walk check (`s6_lens_probe_v12.log`) | PASS: hidden at the lens, 2 toggles, drawn again 1.83 m ahead, drawn in a cutscene |
| `granny_at_the_lens` against **v1.1-jam** (negative control) | FAIL as expected: drawn at the lens, 0 toggles |

Cauldron light (debug_eval A/B in the scene, `test-results/debug_cauldron_*.png`): Komur hangs 0.83–1.30 m; the old
light at 1.0 m / 0.25 m toward the lens blew his chest out; 3 alternative placements shot, the brew-surface one shipped
and re-shot in the normal flow (wide + close-up), ending still reaches the CAUGHT results.

## 18 Oct 2026 05:10–05:20 IST — session 6: release `v1.1-jam` re-checked, 3 new QA probes

No game code changed since the tag (`git diff --stat v1.1-jam HEAD -- src public index.html package.json` is empty).
The folder served on :4180 is byte-identical to `submission/bad-omen-web.zip` (153 files, sha256 compare, 0 missing /
different / extra). Against http://localhost:4180/html/12345/ (`test-results/s6_release_recheck.log`; its section
timestamps are UTC, labelled IST by mistake):
| Check | Result |
|---|---|
| `npm test` | 9/9 |
| Smoke, Edge | **16/16**, 0 console errors |
| QA probes | **16/16** |
| Real input | PASS (mouse look 0.78 rad, gallop 3.9 m/s, jump, swipe/taunt/pounce, pause, scratch, hide, mute) |
| New probes (`--only achievements_unlock,ending_plays_through,achievements_persist,console_clean`, `s6_new_probes.log`) | **4/4**: vase → "Bad Omen" card, saved, no double unlock; the unskipped ending reaches the results in 22.6 s with dawn (background shift 0.47), the tantrum, 3 falling beams and THE END card, results line "Achievements 7 / 16 · ★ Bad Omen · ★ Roof? What Roof? …"; after a reload the menu's Achievements screen lists the same 7 of 16, Back returns to the menu |

## 18 Oct 2026 ~05:00 IST — session 5: playtest 3 complete, achievements, new ending, KTX2 (commit 6811c4f)

Dev server (`test-results/regress_p3_dev.log`):
| Check | Command | Result |
|---|---|---|
| Unit | `npm test` | 9/9 |
| Smoke | `browser_smoke.mjs http://localhost:5173/` | **16/16** (new `caught_ending`; `catch_and_recover` now in the bait stage) |
| QA probes | `qa_probe.mjs` | **15/15** (new `granny_at_stove`, `jump_through_window`; game-time waits bail out on the results screen; props/debris probes from a fresh house) |
| Real input | `input_test.mjs` | PASS |

Handoff re-check (05:05 IST, HEAD 37803f0, no game code changed since 6811c4f): `npm test` 9/9, smoke on dev **16/16**
(`test-results/handoff_s5_smoke.log`).

**Release `v1.1-jam`** — `npm run package` from 6811c4f → `submission/bad-omen-web.zip` (153 files, 25.3 MB),
`check_secrets` OK, extracted under `<scratch>/itch/html/12345/` and served on :4180 (`test-results/release_p3.log`):
| Check | Result |
|---|---|
| Smoke, Edge | **16/16**, 0 console errors |
| Smoke, Firefox 153 (`--firefox`) | **16/16**, 0 console errors |
| QA probes | **16/16**: 15/16 in the run — the new `stun_then_catch` measured movement during the knockback flight (probe bug, fixed: it now waits for the stumble to end) — then `--only stun_then_catch,console_clean` on the same zip 2/2 (stunned, 0 m moved with W held, caught 1.05 s later, recovered) |
| Real input | `input_test` PASS |

Feature checks this session (debug_eval, screenshots in `test-results/debug_*.png`):
| Check | Result |
|---|---|
| #12 fire: SP02 lit with Grandma at the stove; dropped into the flames mid-chase | after the cutscene 1.2 m clear; out in 0.12–0.18 s, 1 singe. **Old code: 10 s in the fire, 11 flinches** (probe run against a stash of the fix) |
| #2 title screen | Komur's seat clear (nearest prop 0.25 m), three camera sweeps at 1920x1080 |
| #9 broom | none in the intro (3 shots) / menu / while holding the cat; summoned 3.1 s into play; back after the toss |
| #8 windows | 5/5 valid ground-floor windows break on a jump and Komur ends 0.3–0.5 m outside (two failed setups were furniture: cauldron, piano) |
| #10 caught | cutscene from 3 catch locations (living room, stairs, upstairs), cauldron beats, CAUGHT results |
| #11 stun | stars up, 0 m moved with W held, control back after 2 s; a pan at 3 m → caught 1.0 s later (tutorial → toss, after → cauldron) |
| #11 voices | 20 lines generated (994 characters), all load (`hasVoice`), proximity hint + quest-prompt nudge fire |
| KTX2 | in-page interleaved A/B, 3 views × 4 rounds: 41.9→42.8, 47.2→48.4, 44.5→45.4 fps; texture memory 112→28 MB; Firefox loads BC7 too |
| Achievements | unlock → card → localStorage → results line → menu list; cards wait out cutscenes |
| New ending | every beat screenshotted (dawn colours, smoke, tantrum + beams, crane, THE END), results reached |

## 18 Oct 2026 ~02:50 IST — playtest-3 part 1 (commit 1aae28e), dev server

| Check | Command | Result |
|---|---|---|
| Unit + build | `npm test`, `npm run build` | 9/9, OK |
| Smoke (dev) | `browser_smoke.mjs http://localhost:5173/` | **15/15** (`smoke_p3_a.log`) |
| QA probes (dev) | `qa_probe.mjs` | **11/11** (`qa_p3_a.log`) + new `props_stand_on_legs` PASS (no sunk props; were 16) and `debris_falls_when_support_breaks` PASS (20 pieces on the table → 0 left in the air), console clean |
| Turning (debug_eval) | S / A / D from a standstill | S: TurnR then facing the key at 0.2–0.3 s, 1.45 m/s by 0.3 s (used to creep backwards at 0.22 m/s); A/D within 0.1–0.2 s |
| Head clips (debug_eval) | max head/neck rotation per clip vs Idle | max 69° (Sniff): no clip spins the head; ChaseTail removed from the idle rotation |
| Floating debris (debug_eval) | dining-table china, then the table; then a 120-prop chain | 26 frozen on the table → all fell; chain: 284 debris, 0 unsupported, 56 fps |

## 18 Oct 2026 ~01:20 IST — RELEASE `v1.0-jam` (code of commit f5269c1), the itch.io zip itself

`npm run package` → `submission/bad-omen-web.zip` (104 files, 13.5 MB, sha256 `95f126fd…f09c057`), extracted into a
fresh folder under `/html/12345/` (the way itch.io serves HTML5 games) and served by `vite preview` on :4180.

| Check | Command (against http://localhost:4180/html/12345/) | Result |
|---|---|---|
| Secrets | `node scripts/check_secrets.mjs` | OK, no .env values in 104 files |
| Smoke, Edge | `browser_smoke.mjs` | **15/15**, 0 console errors (`release5_smoke.log`) |
| Smoke, Firefox 153 (cached Playwright build `firefox-1538`) | `browser_smoke.mjs --firefox` with `PW_FIREFOX` | **15/15**, 0 console errors (`release5_firefox.log`) |
| QA probes | `qa_probe.mjs` | **11/11** (`release5_qa.log`) |
| Real input | `input_test.mjs` | PASS (mouse-look, gallop 3.9 m/s, jump, swipe/taunt/pounce, pause/resume, scratch, hide, mute) |
| Random-input playtest | `monkey_test.mjs --minutes 6` | **PASS**: 302 samples, 0 page errors, 0 NaN, 0 falls out of the world, longest non-normal cat state 2.4 s; random play triggered SP01, SP02 and the SP04 finale → results → restart; caught 7×, Grandma 0 unstuck teleports; 72 fps avg / 40 min (headless iGPU) |
| Unit | `npm test` | 9/9 |

Earlier release passes this session found and fixed (each re-verified on a rebuilt zip): a pounce-probe flake (a
scripted click expiring in the 0.18 s press buffer after the resize probe → re-press), a prompt/subtitle overlap
and a console warning (fixed in the game), a restart-memory probe metric that depended on what the camera had drawn
(840/1139/820/1003, no leak → now counts geometry unreachable from the scene) plus a real per-throw weapon geometry
leak, and an input-test run where headless pointer lock turned 4.6 rad instead of 0.78 (the game now ignores the
first 80 ms after locking; the test aims the sprint explicitly).

Also this session on dev: `stress_test` PASS (305/370 broken + 700 debris at 54 fps bloom / 79 low; Grandma 60 s
soak: 6 rooms, 0 unstuck teleports, longest stand-still 0.1 s; SP01/02/03/10 + finale → results; 0 errors), Firefox
smoke 15/15 on dev, nav check (garden → living room 5.1 s, was 15–23 s; no stall at the dining table).

## 18 Oct 2026 00:00–01:00 IST — session 4 (start framing, tail/fill/subtitle fixes, restart leak, QA probe), commits dc9ae82, 62e748d

| Check | Command | Result |
|---|---|---|
| Re-verify the handoff build | `npm test`, `npm run build`, `check_secrets`, `browser_smoke` on the preview :4173 | 9/9 · OK (19 MB, 104 files) · OK · **15/15** |
| Smoke (dev 5173) after the fixes | `node scripts/browser_smoke.mjs http://localhost:5173/` | **15/15** twice (`smoke_s4_dev_a.log`, `smoke_s4_dev_b.log`); all four throw-driven disasters by real throws |
| Wardrobe test re-staged (Grandma 3.1 m away, rage phase 3) | `browser_smoke --only wardrobe_through_floor` ×5 | **5/5 real throws** (spear ×4, axe ×1); was 1 of 4 before (fallback trigger); the test now fails without a real throw |
| Real input | `node scripts/input_test.mjs http://localhost:5173/` | PASS — now asserts the gallop: **3.9 m/s** (from the new start the old test ran into the front wall: 0.59 m/s, still "PASS") |
| New QA probes | `node scripts/qa_probe.mjs http://localhost:5173/` | **10/10**: focus loss pauses; resize 960x540 and back; crouch → Sneak 0.75 m/s; pounce shoves a chair 0.27 m; Grandma foyer → garden 5.3 s → living room 9 s; 15 s chase around the kitchen fire: 0 s in fire; both finale cutscenes skipped → results; restart memory flat; refresh boots again; 0 console errors |
| Restart memory (found a leak) | `qa_probe --only restart_memory` | before: textures **85 → 96 → 107 → 118** over 4 restarts; after the fix: 65 → 65 → 65 → 65 (geometries 850, programs 54, JS heap 81–82 MB after forced GC) |
| Start framing | `debug_eval` at 720p and 1080p, skipped and full intro | camera 2.6 m (was 0.65 m), vase + marker centred, Grandma off-screen, prompt below the cat (top 560 px > feet 538 px at 720p) |
| Close camera | `debug_eval` at the old spawn | tail droop 0.9 → tail out of view; back to 0 in the open |
| Cutscene subtitles | `debug_eval` during SP01 | two lines at y 559–647, letterbox from y 655 (were half under it) |
| Intro skip | `debug_eval` (skip at 2 s) | 0 lines, 0 sounds after the skip, subtitles cleared, voice stopped; full intro still speaks its lines |
| Fill light A/B | `debug_eval` screenshots, 4 views | conservatory foreground no longer blown out; Komur reads the same |
| Perf upper bounds (iGPU, headless 1280x720, HQ) | `debug_eval` 4 s fps | living 54 → 56.4 (no shadow pass) / 56.5 (no props); wing 49.3 → 56.1 / 58: not draw-call bound, no prop merging |

## 17 Oct 2026 ~23:45 IST — session 3 (light rig, catwalk/gallop, idle life, dialogue fixes), commit 1638b5d

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` | 9/9 |
| Production build + secrets | `npm run build` + `node scripts/check_secrets.mjs` | OK (19 MB, 104 files), no .env values in dist |
| Browser smoke (dev 5173) | `node scripts/browser_smoke.mjs http://localhost:5173/` | **15/15**, exit 0 (`move_and_jump` now asserts the 1.45 m/s Walk; `wardrobe_through_floor` passed via its fallback trigger, see note) |
| Browser smoke (production preview 4173) | `node scripts/browser_smoke.mjs http://localhost:4173/` | **15/15**, exit 0, on the dist/ built at 23:30 (all 5 set pieces + finale → results; `wardrobe_through_floor` via a real throw; 0 console errors) |
| Real input | `node scripts/input_test.mjs http://localhost:5173/` | PASS (sprint measured 3.9 m/s, jump, swipe/taunt/pounce, scratch, hide, pause, mute) — run at 23:00 on 1fcc7fc |
| Stress / soak | `node scripts/stress_test.mjs` | PASS — 302/370 broken, 700 debris: **50 fps** bloom (was 40) / **82** low (was 63) headless; Grandma soak 0 unstuck teleports; SP01/02/03/10 + finale → results; 0 errors — run at 23:05 on a802e6f |
| Table-smash profile (debug_eval) | blast + break of the dining table set | worst frame **5190 ms → 51 ms**; shader programs 49 → 49 (were 64); break JS 60 → 16 ms |
| Frame cost (debug_eval) | headless Edge 1280x720 | 27.2 → 21.5 ms/frame; draw calls 1482 → 1023; point lights 24 → 13 |
| Idle soak (debug_eval) | 55 s untouched | fidgets, sit, smug swish, voiced asides; moving afterwards → Walk at 1.45 m/s |
| HUD layout (debug_eval) | rects at 1280 / 960 / 760 px | no overlaps (objective vs rage box, toast vs subtitles) |
| Gameplay video take | `node scripts/capture_trailer.mjs` | all 10 shots, every set piece + finale by real baited throws, 0 page errors |
| Pitch deck | skill `validate.py` + HTML render overflow check | PASSED; no overflowing text boxes |

Note: `wardrobe_through_floor` reached SP03 through its fallback trigger in 3 of 4 runs this session (Grandma now
starts inside throw range and swings/catches instead of throwing). The set piece itself works (also via real throws
in the video take); re-staging the test would restore its real-throw path.

## 17 Oct 2026 ~22:00 IST — session 2 (movement overhaul, wing, SP10), commit d1203ee

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` | 9/9 |
| Browser smoke (dev 5173) | `node scripts/browser_smoke.mjs http://localhost:5173/` | **15/15** (new: `glass_house` = real baited throw triggers SP10, roof gone, rain in) |
| Browser smoke (production preview 4173) | `node scripts/browser_smoke.mjs http://localhost:4173/` | **15/15** (after `npm run build` at handoff) |
| Real input | `node scripts/input_test.mjs http://localhost:5173/` | PASS (pointer lock, mouse look, sprint 5.1 m/s, jump, swipe/taunt/pounce, scratch, hide, pause, mute) |
| Stress / soak | `node scripts/stress_test.mjs` | PASS — 311/370 broken, 700 debris; fps 40 (bloom) / 63 (low) headless; Grandma 60 s patrol: 0 unstuck teleports, max stand-still 2 s; SP01/02/03/10 + finale → results; 0 errors |
| Production build | `npm run build` + `node scripts/check_secrets.mjs` | OK (19 MB dist), no .env values in 92 dist files |
| Movement probes (debug_eval) | trot/gallop/drift/leap/hop | trot constant 2.6 m/s (was stalling), gallop 5.1, drift → launch, leap onto counter y=0.925, hop-down off the dining table, stairs up/down at 2.6 m/s never airborne |
| Leap sweep | aimed leaps | bed (4.1), mantel via climb (1.31), kitchen table, foyer & living sideboards (through an urn), piano, tea table & study desk past their chairs, potion bench, bed→dresser across the gap |
| Quality switch | debug_eval | High→Low: 64 fps immediately (was a ~3 s freeze) |

Bugs found by these tests and fixed: tutorial vase survived a swipe off its table; Rapier KCC stalls (flat floor and
stairs) for cat and Grandma; leap planner rejecting beds (frame lip), surfaces behind chairs, landings among props,
across-gap targets hidden by the ceiling; hop-down re-triggering on the same table; Low-quality freeze; Grandma
reactions skipped in cinematics; SP10 cinematic camera blocked by Grandma.

## 17 Oct 2026 ~20:05 IST — First playable checkpoint

### Unit tests — `npm test` (vitest 5.0.5)
9/9 passed: duplicate award guard, Granny x2, combo ladder & 5x cap, combo timeout, catch penalty floor, set-piece chain bonus, ranks, rage floor/phases, finale gating.

### Browser smoke — `node scripts/browser_smoke.mjs <url>` (Playwright 1.64.1 → system Edge, 1280x720)
Dev server (5173): 14/14 · Production preview (4173): 14/14

| Test | Result | Evidence |
|---|---|---|
| boot | PASS | 105–115 fps, 229 breakables, ~657 draw calls, 71.5k triangles |
| assets | PASS | 23 Komur clips, 27 Grandma clips, both animating |
| move_and_jump | PASS | 4.6 m/s run, jump apex 1.25 m, lands |
| mantle_onto_counter | PASS | cat ends on 0.92 m counter via jump + auto-mantle |
| swipe_vase_scores | PASS | vase shattered by `cat_swipe`, score > 0, tutorial advanced to taunt |
| no_double_score | PASS | re-award of same id returns null, score unchanged |
| granny_throw_breaks_chandelier | PASS | windup → release → weak point hit → SP01 → cinematic → controls restored, dining table destroyed |
| kitchen_fire_chain | PASS | lamp knocked → ember; Grandma stove hit → SP02; 5 fire clusters burning; play resumes |
| wardrobe_through_floor | PASS | real baited throw (viaThrow=true) → SP03; weak floor broken |
| catch_and_recover | PASS | Grandma catches, holds, tosses; cat back to `normal` with invulnerability |
| nav_between_floors | PASS | Grandma hall → stairs → gallery (y 3.2) → back to kitchen |
| finale_and_results | PASS | finale unlock → enchanted axe → SP04 collapse → outro → results (rank BAD OMEN) |
| restart_resets | PASS | score 0, 0 broken, no set pieces, rage 0 after restart |
| console_clean | PASS | 0 console errors during the whole run |

Screenshots: `test-results/01_start.png … 07_results.png` (not committed).

### Build & security
- `npm run build`: success (rolldown-vite 8.3.4), 5.22 MB JS (1.91 MB gzip).
- `node scripts/check_secrets.mjs`: OK, no .env values in 82 dist files.

### Bugs found by tests and fixed
1. Grandma model 224x scale after SkeletonUtils clone (bounding box of un-posed skeleton) → fixed with measured constant.
2. Grandma couldn't see Komur on the gallery (rail blockers blocked LOS) → RAIL collision group + head ray.
3. Grandma oscillated at the foot of the stairs (re-path picked node behind her) → mid-stairs start node rule.
4. String-pulling cut through stair railings → nav line checks include RAIL.
5. Enchanted axe clipped the balcony rail → cleaves rails and homes on the brace.
6. Null-body crash when a prop broke inside the Δv loop → guard.
7. Baited throws hit the floor at the cat's feet instead of the weak point behind → bait aiming.
8. Popup flood, Indian-locale digit grouping, telegraph lingering in cinematics → fixed.
