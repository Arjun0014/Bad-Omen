# 07 — Story, Comedy, Voice Direction, Music and Audio Implementation

## Core acting rule
Grandma sounds part classic witch, part furious homeowner, utterly sure she is the innocent party. She escalates from grudging warnings to absurd, frighteningly loud theatrical tantrums. Komur does **not** visibly speak like a human: his lines are clever internal-monologue **voiceover/quips** played to player with subtitles while cat model meows and reacts physically. Keep cat voice sardonic, calm, and softly delighted in destruction, to contrast Grandma's fury.

**No gore, no animal injury.** Grandma can menace and scream, but all harm is cartoon environmental slapstick. Emotional rhythm is more important than the sheer number of clips.

## Script / event ledger
Generate each clip as separate stable ID, not as an entire film. Strip audio tags in subtitles; preserve original lines in source catalog. Use event cooldowns/random pools to avoid constant talking during gameplay. Proposed text and performance direction below; agent may rewrite for improved joke timing.

### Intro and tutorial (must have)
| ID | Character + expressive prompt | Spoken dialogue | Gameplay trigger |
|---|---|---|---|
| G_INTRO_01 | Grandma `[suspicious, low and gravelly]` | 'Black cats. Seven years of bad luck, they say.' | 2s opening shot |
| G_INTRO_02 | Grandma `[suddenly shouting]` | 'AH! THERE YOU ARE! You're not leaving my house alive... with a single biscuit!' | Komur crosses threshold; comedic reversal |
| K_INTRO_01 | Komur `[dry, amused]` | 'She seems nice.' | controls unlock |
| K_FIRST_BREAK | Komur `[mischievously]` | 'Oh. That was expensive.' | tutorial vase breaks |
| G_FIRST_BREAK | Grandma `[outraged]` | 'MY GOOD VASE! It survived three wars!' | detects first break |
| G_MEOW | Grandma `[mocking, angry]` | 'Don't you MEOW at me!' | first taunt heard |
| K_DISCOVERY | Komur `[realizing, delighted]` | 'She breaks bigger things than I do.' | first Grandma collateral |

### Chase and anger barks (short; randomized)
| ID | Speaker/tags | Spoken text | Trigger |
|---|---|---|---|
| G_PATROL_01 | G `[grumbling]` | 'Not a scratch on these floors. Not one.' | patrol quiet |
| G_PATROL_02 | G `[whispers, suspicious]` | 'I know you're in here, coal-dust devil.' | searching |
| G_FIND_01 | G `[sharp shout]` | 'THERE! YOU! ARE!' | reacquires cat |
| G_CHASE_01 | G `[shouting]` | 'GET OFF MY TABLE!' | cat high perch |
| G_CHASE_02 | G `[furious]` | 'I WILL TURN YOU INTO A TEA COZY!' | chase 25–70 rage |
| G_CHASE_03 | G `[out of breath, ranting]` | 'I AM TOO OLD FOR THIS. AND TOO ANGRY TO STOP!' | sprint prolonged |
| G_THROW_PAN | G `[shouts]` | 'CATCH THIS, YOU FLEA-BAG!' | pan windup |
| G_THROW_AXE | G `[scary, furious shout]` | 'STAY. VERY. STILL!' | axe windup |
| G_THROW_SPEAR | G `[threatening]` | 'I'VE GOT PERFECT AIM!' | spear windup; miss punchline |
| G_MISS_01 | G `[surprised, defensive]` | 'THAT WALL JUMPED IN MY WAY!' | heavy throw hits wall |
| G_MISS_02 | G `[indignant]` | 'That was... already broken.' | self-collateral |
| G_COLLATERAL_01 | G `[horrified]` | 'MY MOTHER'S CABINET! THAT'S COMING OUT OF YOUR ALLOWANCE!' | cabinet breaks |
| G_LOST_01 | G `[whispering, enraged]` | 'Come out, come out... I only want to scream.' | search |
| G_CAT_CAUGHT | G `[triumphant]` | 'AHA! Finally. You slippery little sofa stain.' | cat caught |
| G_LOW_RAGE | G `[grumpy, muttering]` | 'The broom was for sweeping. Once.' | returns calm |
| G_MAX_RAGE | G `[wild, shouting]` | 'I HAVE HAD ENOUGH OF THIS ENTIRE HOUSE!' | 90 Rage threshold |

### Cat voiceover quips (low frequency, event-reactive)
| ID | Delivery | Dialogue | Trigger |
|---|---|---|---|
| K_SWAT_01 | `[mischievously, quiet]` | 'Gravity. Reliable as ever.' | 4+ fragile smashes |
| K_POUNCE_01 | `[excited]` | 'Incoming!' | first big pounce |
| K_CHASE_01 | `[deadpan]` | 'She's getting her steps in.' | Grandma behind cat |
| K_HIDE_01 | `[whispering, amused]` | 'Stealth mode: furniture edition.' | hide succeeds |
| K_DODGE_01 | `[playfully smug]` | 'Bit to the left, Grandma.' | Granny miss to wall |
| K_DODGE_02 | `[dry]` | 'That's going on the damage report.' | granny breaks fixture |
| K_BIG_BREAK | `[delighted]` | 'Okay. That one was impressive.' | big structural break |
| K_FIRE | `[curious, lightly alarmed]` | 'Well. That escalated.' | first fire |
| K_FALL | `[surprised]` | 'Nine lives. Still counting.' | safe tumble |
| K_CAT_CAUGHT | `[annoyed, dry]` | 'Personal space, please.' | cat caught |
| K_HIGH_COMBO | `[quietly thrilled]` | 'Keep going. I think she's helping.' | combo x4 |
| K_BEFORE_FINAL | `[mock-innocent]` | 'Surely this is still my fault.' | final windup |

### Setpiece and finale lines (must have)
| ID | Actor/tags | Spoken | Event |
|---|---|---|---|
| G_CHANDELIER | G `[horrified, shrieks]` | 'THE CHANDELIER! THAT WAS AN HEIRLOOM!' | SP01 |
| K_CHANDELIER | K `[softly impressed]` | 'And what a lovely entrance it made.' | SP01 after |
| G_KITCHEN | G `[coughing, alarmed]` | 'MY KITCHEN IS ON FIRE! WHY IS MY KITCHEN ON FIRE?!' | SP02 |
| K_KITCHEN | K `[dry, lightly apologetic]` | 'The atmosphere is warmer now.' | SP02 after |
| G_FLOOR | G `[shouting over crash]` | 'THE FLOOR! THAT FLOOR WAS LOAD-BEARING!' | SP03 |
| K_FLOOR | K `[mischievously]` | 'Not anymore.' | SP03 after |
| G_FINAL_ATTACK | G `[furious, roaring]` | 'THIS HOUSE IS BIG ENOUGH FOR ONE OF US!' | final throw |
| G_OUTRO | G `[breathing hard, accusatory]` | 'I KNEW THAT CAT WAS BAD LUCK!' | garden finale |
| K_OUTRO | K `[satisfied, matter-of-fact]` | 'I barely lifted a paw.' | freeze frame end |

### Optional extra barks
Grandma stumbling: 'WHO PUT A TABLE THERE?!'; on greenhouse: 'Those roses had names!'; on broom break: 'MY GOOD BROOM!'; on score frenzy: 'THIS IS A HOME, NOT A CIRCUS!'; cat: 'She definitely skipped anger management.' / 'Five-star service. Very hands-on.' / 'Every house needs ventilation.' / 'Maybe she'll renovate.'

## Speech synthesis: current ElevenLabs API contract
- Preferred **offline** build-time TTS: model ID **`eleven_v4`**. ElevenLabs v4 supports `[shouts]`, `[whispers]`, `[mischievously]`, `[laughs]`, etc.; tags are natural instructions, not rigid enums. Use punctuation/spacing, **not SSML break tags** with v4.
- API options documented as of 17 Oct 2026: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` (single-speaker clip) or `POST https://api.elevenlabs.io/v1/text-to-dialogue` (paired lines/multi-speaker). Model ID is included in body; use `eleven_v4` explicitly. Refer to official documentation linked below. For individually triggered game barks, **generate one line/file** via TTS for easy runtime addressing; short intros may use dialogue API.
- Local `.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_GRANDMA_VOICE_ID`, `ELEVENLABS_KOMUR_VOICE_ID`, `ELEVENLABS_MODEL_ID=eleven_v4`. Do not log key or put it in JS client.
- Agent picks voices with available voice IDs. If IDs aren't supplied but API key supports list voices, select licensed accessible voices with contrasting timbres and log chosen IDs to local/nonsecret config. If no usable voice, always generate subtitles and optional synth/meow cues; don't stop building.
- A batch script checks output file existence, caches based on `model+voice+text+tags` content hash, estimates total character count, obeys default cap **8,000 characters** per batch, retries transient 429/5xx with bounded exponential backoff, and creates a JSON manifest of `eventID -> file, speaker, cleanSubtitle, duration`. Failing lines should never crash the app.
- Default MP3 suitable browser codec. Preload intro/outro lines; lazy-load remaining cues by group. Limit speech concurrency to 1–2, allow Grandma critical story line priority over incidental barks. Subtitle visible even if audio muted.
- Do not assert ElevenLabs v4 has been used if no key or if model request failed. Log actual model and generated count; v4 can be unavailable on some account entitlements. No client runtime API calls.

Official references:
- `https://elevenlabs.io/docs/overview/models`
- `https://elevenlabs.io/docs/api-reference/text-to-speech/convert`
- `https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert`
- `https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices`

## Sound palette
- Komur paws: light wood taps, tiny sprint skitters, scratch, cloth rustle, meow (natural SFX audible to Grandma).
- Granny: heavy floor stomp, broom whoosh, breath, strained grunt, pan clank, axe windup metallic whistle, exaggerated miss thump.
- House: wood stress creak tied to Doom thresholds, clocks, ceramic/glass tinkling, heavy support fracture, ceiling crack, room rumble, fire crackle, wet splash (if flood).
- World: 1 looping rainstorm exterior, distant thunder, oppressive ticking, thin bass pulses rising with Rage; music dynamic layers instead of lengthy custom score.
- UI: combo bell, high combo bass hit, destruction-level stinger, Grandma Rage threshold alarm, final comedic sting.
- Keep licensed source URLs/creators/terms in `CREDITS.md`. Prefer CC0 audio libraries (Kenney, properly verified OpenGameArt entries) or simple procedural synthesized cues. Avoid ambiguous/no-license YouTube and meme clips.

## Runtime speech rules
- Dialogue never blocks controls. Barks rarely overlap; Grandma barks priority when attacking, Komur quip after enough gap. Use 5–9s cooldown per speaker and no same ID within 90s.
- Duck music to ~45% during key voice and big setpieces; ambient remains audible; clamp peak volume to avoid distortion.
- Include `SFX`/`MUSIC`/`VOICE` volume and `SUBTITLES` in settings if time. Minimum is mute toggle and always-on subtitles.
