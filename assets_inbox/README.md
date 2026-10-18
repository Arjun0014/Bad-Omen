# ASSET INBOX — USER DROP ZONE

Do not put secrets or paid assets in source control. The game agent should detect file names and paths instead of assuming them.

- `komur/` — one original **rigged `.blend`** cat model with textures and initial action clips; retain original structure and a backup. Cat must read visually as Komur (black, white paws/chest/tail tip, amber eyes).
- `grandma/` — witchy Grandma/Goblin Mixamo full-body **FBX With Skin** (or rigged `.blend`/`.glb`).
- `mixamo_animations/` — about 10 distinct **FBX Without Skin** clips: Idle, Walk, Run/Charge, Angry, Swing/Melee, Throw, Pick Up, Stumble/React, Get Up, Victory/Threaten. Filename with plain action name helps. Search equivalents; any action can be synthesised if missing.
- `textures/` — optionally 5–7 PBR 1K texture sets: old plank floor, rough structural timber, cracked plaster/wallpaper, roof shingles, stone/brick, soil/grass, tarnished metal. Provide base color + normal + roughness when possible. Agent can source Poly Haven/ambientCG CC0.
- `audio_sources/` — optional user-supplied licensed sound/music. Agent otherwise sources/license-checks effects or synthesizes basic ones.

No assets are included in this starter pack. If files are absent, build placeholder geometry and keep a clear replacement path. Do not claim to have inspected or converted absent models.
