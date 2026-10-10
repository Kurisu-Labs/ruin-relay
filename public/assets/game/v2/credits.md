# Ruin Relay — Dungeon Artwork v2

Environment and adventurer spritesheets were created for this project with the built-in **imagegen** tool, based on the [recorded prompts](prompts.md). They are generated artwork, not downloaded third-party asset packs. Project assets are distributed with the repository's MIT license; upstream engine/tool rights remain separate.

- `environment.png`: 16 modular floor, wall, decor and landmark assets.
- `adventurer.png`: 16 poses, four cardinal directions, teal hood and lantern.
- Both supplied PNGs are unmodified RGBA originals, 1254×1254. The prompt requested a square 1024 grid, but metadata uses the actual returned dimensions.
- JSON frame rectangles/pivots are authored by `scripts/game-assets-v2.py`. It inspects alpha for gutters/feet and does not edit PNG pixels. `npm run assets:game` rebuilds metadata without an API call.
- `manifest.json` records source SHA-256, byte sizes and dimensions.
- Procedural build/break effects remain in `../v1/`, with their separate original-art credits.

Art direction: weathered slate and sandstone ruins, moss, carved symbols, amber fire and turquoise portal; straight screen-aligned dungeon movement with a restrained south-facing lip in the artwork.
