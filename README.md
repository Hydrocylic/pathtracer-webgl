# pathtracer-webgl

A GPU path tracer that runs in the browser. The scene layer is built on three.js; the path tracing core — BVH build and
GPU traversal, direct light sampling, materials, progressive accumulation — is written from scratch in GLSL and JavaScript.

> 中文摘要：浏览器内的 **WebGL2 路径追踪渲染器**。场景管理层用 three.js，路径追踪核心（BVH 构建与 GPU 遍历、
> NEE 直接光采样、材质模型、渐进累积）为自研实现。本仓是学习项目 `renderer-lab` 的**发布快照**，
> 源码真相源仍在学习仓。

## Features

- **BVH on the GPU** — median / SAH built binary BVH packed into float textures, traversed iteratively in the fragment
  shader; a brute-force linear-intersection path is kept as a toggleable comparison
- **Direct light sampling (NEE)** — area lights sampled directly, with a random-hit-only path as a comparison toggle
- **Progressive accumulation** — running average across frames for noise convergence, reset on parameter change
- **Materials** — Lambertian diffuse + metal specular, emissive area lights
- **glTF loading** — self-contained glTF → triangle soup → BVH pipeline, up to Sponza scale (~260k triangles)
- **Debug visualization** — normals / albedo / hit distance / escape / traversal-step heatmap
- **Live panel** — scene, samples per pixel, BVH & NEE toggles, background colour, camera position and target

## Quick start

```bash
npm install
npm run dev      # Vite dev server — opens the renderer
npm run build    # production build → dist/
```

Requires a browser with **WebGL2** (hardware acceleration enabled).

## Controls

The panel in the top-right corner (Tweakpane):

| Control | Meaning |
|---|---|
| 场景 / scene | `cornell`, `spheres`, `sponza`, plus sample glTF models (`box`, `duck`, `avocado`, `lantern`, `boombox`) |
| spp | samples per pixel per frame (1–64) |
| BVH(1) / 线性(0) | GPU BVH traversal vs. brute-force linear intersection |
| NEE(1) / 随机(0) | direct light sampling vs. random-hit only |
| bg.r / g / b | background colour |
| 调试模式 | normal render / normals / albedo / hit distance / escape / traversal-step heatmap |
| 相机机位 | camera position and target |
| frame ms | smoothed frame time |

Drag to orbit, scroll to zoom (three.js `OrbitControls`).

## Project structure

```
src/
├── main.js                    # bootstrap: render loop, uniforms, panel, scene switching
├── scene.js                   # scene definitions: cornell, spheres, sponza, glTF entries
├── renderer/bvh.js            # BVH build (median / SAH) + materialization into GPU textures
├── scene/sponza-loader.js     # glTF → triangle list (world transforms applied, materials resolved)
├── debug/                     # debug modes + camera panel
└── shaders/
    ├── pathtrace.frag.glsl    # path tracing core: traversal, shading, NEE, accumulation
    ├── composite.frag.glsl    # accumulation / presentation
    └── fullscreen.vert.glsl
```

## Assets

| Asset | Source | License |
|---|---|---|
| Sponza Atrium | [Khronos glTF-Sample-Models](https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Sponza) | CC BY 3.0 — attribution required |
| Box, Duck, Avocado, Lantern, BoomBox | [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | CC0 / CC BY 4.0 / SCEA Shared Source — see [THIRD-PARTY.md](THIRD-PARTY.md) |

Attribution and licence texts: [THIRD-PARTY.md](THIRD-PARTY.md).
One sample model (`DamagedHelmet`) is deliberately **not** bundled — it is licensed CC BY-NC.

## Status

An early snapshot published as a work sample: the rendering core works end-to-end, the surrounding structure is still
evolving. Source comments are intentionally stripped in this snapshot and will be restored later.

## License

The source code is [MIT](LICENSE). Bundled assets keep their own licences — see [THIRD-PARTY.md](THIRD-PARTY.md).
