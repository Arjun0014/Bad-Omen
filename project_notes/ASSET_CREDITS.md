# BAD OMEN — Asset Origins & Licences

| Asset | Creator / source | URL | Licence | Use / modification |
|---|---|---|---|---|
| Somali Cat Animated ver 1.2 (Komur base) | DreamNoms (Sketchfab) | https://sketchfab.com/3d-models/somali-cat-animated-ver-12-e185c3fd92b64c32b4515a32b29252fc | CC BY 4.0 | User-supplied. Recoloured (new texture), eye cornea shells removed, 38 new procedural animations (42 clips; the original Idle/SitDown/SittingIdle/StandUp are kept, the original walk was replaced by a long-stride procedural catwalk), exported as komur.glb. Attribution required — in CREDITS.md and in-game credits. |
| Goblin D Shareyko (Grandma) | Adobe Mixamo | https://www.mixamo.com | Adobe Mixamo terms (royalty-free use in games; raw files not redistributed) | User-supplied FBX; combined with clips into grandma.glb; textures downscaled to 1K; hat/spectacles/broom added in-engine. |
| Mixamo animation clips (27 used) | Adobe Mixamo (Locomotion, Magic Locomotion, Pro Magic, Action Adventure, Gestures packs; Throw Object, Throwing, Pick Up Item) | https://www.mixamo.com | Adobe Mixamo terms | Root motion stripped, renamed, baked into grandma.glb. |
| Wood PBR textures: wooden_floor_02, brown_planks_09, rough_wood, wood_table, wood_trunk_wall, moss_wood, bark_brown_02, bamboo_wall_03 | Poly Haven | https://polyhaven.com/textures (licence: https://polyhaven.com/license) | CC0 | User-supplied 1K zips; re-encoded to JPG (diffuse/normal/ARM), and from those to KTX2 (`public/assets/textures/ktx2/`, `tools/ktx2/`: diffuse + ARM ETC1S, normals UASTC+RDO+zstd) — the JPGs stay as the fallback. |
| Creepster font | Font Diner (Google Fonts) | https://github.com/google/fonts/tree/main/ofl/creepster | SIL OFL 1.1 (public/licenses/OFL-creepster.txt) | Title/banners. |
| IM FELL English font | Igino Marini (Google Fonts) | https://github.com/google/fonts/tree/main/ofl/imfellenglish | SIL OFL 1.1 (public/licenses/OFL-imfellenglish.txt) | UI text. |
| 57 voice lines | Generated with ElevenLabs (eleven_v4), voices: account voice "Cthulu female - v4 narrator" (Grandma), premade "George" (Komur) | https://elevenlabs.io | ElevenLabs account terms (paid starter plan) | Generated at build time by scripts/generate_voiceover.mjs; text written for the jam. |
| 11 sound effects (meows, glass crash, wood crash, chandelier, collapse, fire whoosh, thunder, witch cackle) | Generated with ElevenLabs sound generation | https://elevenlabs.io | ElevenLabs account terms | scripts/generate_sfx.mjs. |
| All other SFX + music | Procedural (WebAudio synthesis, written during the jam) | — | Original | src/audio/Synth.js, src/audio/Music.js. |
| All props, house, set pieces | Procedural three.js geometry (written during the jam) | — | Original | src/world/*. |
| three.js, Rapier, Vite, Playwright, Vitest | Respective authors | npm | MIT / Apache-2.0 | Engine/tooling. |
