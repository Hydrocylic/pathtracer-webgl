# Third-party notices

This repository contains third-party assets and depends on third-party packages. Their licenses are listed below;
they are **not** covered by this repository's MIT license.

## Bundled assets (`public/`)

### Sponza Atrium — `public/sponza/`

- Author / origin: Frank Meinl (Crytek) — "Crytek Sponza" scene
- Distribution source: Khronos glTF-Sample-Models, `2.0/Sponza`
  (https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Sponza)
- License: **CC BY 3.0** (https://creativecommons.org/licenses/by/3.0/) — attribution required
- Unmodified in this repository (used as a rendering test scene)

### Sample models — `public/gltf/`

| Model | Source / author | License |
|---|---|---|
| Box | Cesium, donated for glTF testing | CC BY 4.0 — attribution required |
| Duck | © 2006 Sony Computer Entertainment Inc. | SCEA Shared Source License, v1.0 |
| Avocado | Microsoft | CC0 1.0 (public domain dedication) |
| BoomBox | Microsoft | CC0 1.0 (public domain dedication) |
| Lantern | Microsoft | CC0 1.0 (public domain dedication) |

Each model directory keeps its original `README.md` with the full license statement. The upstream catalogue README is at
`public/gltf/README.md`.

Not bundled: `DamagedHelmet` (by theblueturtle_, on Sketchfab) is licensed
**CC BY-NC** (non-commercial) and is therefore deliberately excluded from this repository.

## Runtime dependencies

| Package | Version | License |
|---|---|---|
| three.js | ^0.185.1 | MIT |
| tweakpane | ^3.1.10 | MIT |
| vite (dev) | ^8.2.2 | MIT |

Installed via npm; no source is vendored into this repository.

## Acknowledgements

- The renderer was written while studying [THREE.js-PathTracing-Renderer](https://github.com/erichlof/THREE.js-PathTracing-Renderer)
  by erichlof (released under **CC0 1.0**) and [graphics-workshop](https://github.com/ekzhang/graphics-workshop) by Eric Zhang
  (MIT). No source code from those projects is copied into this repository; they served as study references.
- The Cornell box scene is reconstructed procedurally from the classic Cornell box geometry; its box corner coordinates
  were cross-checked against Mitsuba's `cbox` scene data.
