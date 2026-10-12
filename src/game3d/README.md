# Procedural dungeon artwork

`world.ts` builds original three-dimensional dungeon artwork directly from geometry:
beveled stone courses, recessed compass reliefs, vaulted ceiling ribs, weathered
hanging banners, roots and sparse ivy, low stone chips and shallow damp patches.
Iron sconces have curved brackets, hollow bowls, brass rims and shaped flames. A
brass START inlay and a stone EXIT arch with inset teal glyphs mark the endpoints.
It uses no downloaded models, photographs, pasted sprites, or external art packs.
Three.js is the separately licensed rendering dependency.

Two small, deterministic 256×256 RGBA DataTextures are generated directly from code:
one albedo map and one shared bump/roughness map. They add mineral grain, small pits,
fine branching fissures, and restrained damp moss. They require no DOM, image files,
network requests, or external art. Their combined base data is 512 KiB; mip levels
add approximately one third. No textures are allocated during frame updates.

`createWorld(walls, editableMask)` accepts the frozen run's canonical wall mask and
immutable editable mask, and returns one owned scene group. Every canonical tile
has a local wall group in `world.walls`;
floor groups initially remain invisible. A caller may reveal a draft wall or reduce
a wall's `scale.y` for an overview without rebuilding the underlying run. Wall
architecture stays within its tile footprint. Recesses and banners decorate only
fixed walls and the perimeter; editable walls retain ordinary stone courses so a
draft does not leave ornaments floating in a newly opened tile. Recesses have solid
backs. Roots, chips and damp patches sit along fixed corridor edges. These details
add no collision or gameplay object.

Sconces, banners and reliefs reserve separate wall faces, with sconces placed first.
Their mounts and the floor immediately in front must both be immutable, so legal
player edits do not relocate these ornaments or bury them in new walls. Roots only
use unreserved faces and are limited to six placements. The first banner is beside
START; the first sconce has its own wall beside tile 7. No random ornament is spawned
when a player adds a wall.

Banner folds, a frayed hem and faded geometric motifs are generated from mesh
positions and vertex colors, without another texture. Vault ribs span supported
corridor cells above head height. The EXIT arch faces diagonally toward both possible
approaches. Ceiling ribs and corridor dressing are hidden in overview so the edit
map stays readable; the existing torch and ceiling visibility rules still apply.

Add `world.root` to the scene, call `world.update(seconds, reducedMotion,
camera.position)` before rendering, switch the ceiling and local lights with
`world.setOverview(boolean)`, and call `world.dispose()` when replacing the world.
The caller owns the renderer, camera, input, floor/collision rules, and edit overlays.

Stone and slab geometry is shared and instanced. Masonry faces against immutable
walls and outside the perimeter are omitted; faces beside editable cells are kept
so removing a wall does not expose missing stonework. The seed scene contains about
119,000 triangles before frustum culling, down from about 253,000 before this change.
There are at most five point lights (three sconces, the EXIT, and a camera-follow
fill), with no point-light shadow maps. These counts are not a device FPS measurement.
The bounded material palette, ambient light, and small camera fill prioritize readable
corridors. Flicker stops under reduced motion. Per-frame updates allocate no meshes,
materials, textures, or vectors. Disposal releases owned instance buffers, shared
geometries, materials, and the two owned textures. The first torch is mounted beside
tile 7, ahead of the starting south-facing camera, so the initial corridor shows warm
firelight. Lower neutral ambient illumination lets warm sconces and cool stone grain
remain distinct while retaining the camera fill for readability.

Verification covers the 49 canonical wall footprints, plain editable walls,
clearance between sconces and featured ornaments, stable ornament placement across
legal single-tile edits and fixture revisions, the seed geometry budget,
overview visibility, the light cap, and both textures being shared, deterministic
across rebuilds, and disposed once. Browser screenshots cover the relief, banner
and sconce, vaulted corridor, EXIT approach and mobile play/edit views. Geometry
changes do not change the canonical collision mask.

This is the sole game renderer at `/play`, following ADR-042. The former `/play/3d`
URL remains an alias. It preserves the canonical 7×7 dungeon, one-edit rule, movement codec, wallet flow,
or transaction authority.
