
import { loadSponzaTriangles, loadGltfTriangles } from './scene/sponza-loader.js';

const spheres = {
  camera: {
    position: [0.0, 2.5, 8.0],
    target: [0.0, 0.5, 0.0],
    fov: 60,
  },
  background: [0.01, 0.01, 0.03],
  meshes: [

    {
      type: 'quad',
      corners: { a: [-20, 0, -20], b: [20, 0, -20], c: [20, 0, 20], d: [-20, 0, 20] },
      material: { color: [0.7, 0.7, 0.7] },
    },

    {
      type: 'sphere',
      center: [0, 0.5, 0],
      radius: 0.5,
      segments: 24,
      material: { color: [0.9, 0.2, 0.2] },
    },
    {
      type: 'sphere',
      center: [-1.4, 0.35, -0.8],
      radius: 0.35,
      segments: 24,
      material: { color: [0.2, 0.4, 0.9] },
    },
    {
      type: 'sphere',
      center: [1.3, 0.6, 0.6],
      radius: 0.6,
      segments: 24,
      material: { color: [0.2, 0.9, 0.3] },
    },

    ...Array.from({ length: 36 }, (_, i) => ({
      type: 'sphere',
      center: [
        ((i % 6) - 2.5) * 2.0,
        0.5,
        -4.0 - Math.floor(i / 6) * 2.0,
      ],
      radius: 0.5,
      segments: 12,
      material: { color: [0.55, 0.55, 0.58] },
    })),
  ],
  objects: [

    {
      type: 'sphere',
      center: [0, 4.5, 0],
      radius: 2.2,
      material: { emission: [4.0, 3.3, 2.7] },
    },
  ],
  lightQuads: [],
  maxBounces: 8,
};

const cornell = {
  camera: {

    position: [2.78, 2.73, -8.0],
    target: [2.78, 2.73, 0.0],
    fov: 39.3,
  },
  background: [0.0, 0.0, 0.0],
  meshes: [

    { type: 'quad', corners: { a: [0, 0, 0], b: [5.55, 0, 0], c: [5.55, 0, 5.59], d: [0, 0, 5.59] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [0, 5.55, 0], b: [0, 5.55, 5.59], c: [5.55, 5.55, 5.59], d: [5.55, 5.55, 0] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [0, 0, 5.59], b: [5.55, 0, 5.59], c: [5.55, 5.55, 5.59], d: [0, 5.55, 5.59] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [0, 0, 0], b: [0, 0, 5.59], c: [0, 5.55, 5.59], d: [0, 5.55, 0] }, material: { color: [0.14, 0.45, 0.091] } },
    { type: 'quad', corners: { a: [5.55, 0, 0], b: [5.55, 5.55, 0], c: [5.55, 5.55, 5.59], d: [5.55, 0, 5.59] }, material: { color: [0.63, 0.065, 0.05] } },

    { type: 'quad', corners: { a: [2.65, 0, 2.96], b: [4.23, 0, 2.47], c: [4.23, 3.3, 2.47], d: [2.65, 3.3, 2.96] }, material: { color: [0.9, 0.9, 0.9], type: 'mirror' } },
    { type: 'quad', corners: { a: [4.72, 0, 4.06], b: [3.14, 0, 4.56], c: [3.14, 3.3, 4.56], d: [4.72, 3.3, 4.06] }, material: { color: [0.9, 0.9, 0.9], type: 'mirror' } },
    { type: 'quad', corners: { a: [4.23, 0, 2.47], b: [4.72, 0, 4.06], c: [4.72, 3.3, 4.06], d: [4.23, 3.3, 2.47] }, material: { color: [0.9, 0.9, 0.9], type: 'mirror' } },
    { type: 'quad', corners: { a: [3.14, 0, 4.56], b: [2.65, 0, 2.96], c: [2.65, 3.3, 2.96], d: [3.14, 3.3, 4.56] }, material: { color: [0.9, 0.9, 0.9], type: 'mirror' } },
    { type: 'quad', corners: { a: [2.65, 3.3, 2.96], b: [4.23, 3.3, 2.47], c: [4.72, 3.3, 4.06], d: [3.14, 3.3, 4.56] }, material: { color: [0.9, 0.9, 0.9], type: 'mirror' } },

    { type: 'quad', corners: { a: [1.30, 0, 0.65], b: [2.90, 0, 1.14], c: [2.90, 1.65, 1.14], d: [1.30, 1.65, 0.65] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [2.40, 0, 2.72], b: [0.82, 0, 2.25], c: [0.82, 1.65, 2.25], d: [2.40, 1.65, 2.72] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [2.90, 0, 1.14], b: [2.40, 0, 2.72], c: [2.40, 1.65, 2.72], d: [2.90, 1.65, 1.14] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [0.82, 0, 2.25], b: [1.30, 0, 0.65], c: [1.30, 1.65, 0.65], d: [0.82, 1.65, 2.25] }, material: { color: [0.725, 0.71, 0.68] } },
    { type: 'quad', corners: { a: [1.30, 1.65, 0.65], b: [2.90, 1.65, 1.14], c: [2.40, 1.65, 2.72], d: [0.82, 1.65, 2.25] }, material: { color: [0.725, 0.71, 0.68] } },

    {
      type: 'sphere',
      center: [0.75, 0.6, 3.6],
      radius: 0.55,
      segments: 24,
      material: { color: [0.98, 0.98, 0.98], type: 'glass' },
    },
  ],
  objects: [],
  lightQuads: [

    {
      type: 'quadLight',
      corners: [[2.13, 5.488, 2.27], [3.43, 5.488, 2.27], [3.43, 5.488, 3.32], [2.13, 5.488, 3.32]],
      emission: [17.0, 17.0, 17.0],
    },
  ],
  maxBounces: 8,
};

const sponza = {
  camera: {

    position: [6.0, 1.0, 0.0],
    target: [-10.0, 5.0, 0.0],
    fov: 60,
  },
  background: [0.0, 0.0, 0.0],
  meshes: [],
  objects: [],
  lightQuads: [

    { type: 'quadLight', corners: [[-6.0, 11.6, -1.0], [6.0, 11.6, -1.0], [6.0, 11.6, 1.0], [-6.0, 11.6, 1.0]], emission: [4.0, 3.6, 3.2] },
  ],
  maxBounces: 8,

  load: () => loadSponzaTriangles('/sponza/Sponza.gltf'),
};

export function autoGltfSceneConfig(tris) {

  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) {
    for (const v of [t.v0, t.v1, t.v2]) {
      for (let k = 0; k < 3; k++) {
        const c = v.getComponent(k);
        if (c < mn[k]) mn[k] = c;
        if (c > mx[k]) mx[k] = c;
      }
    }
  }
  const center = mn.map((m, k) => (m + mx[k]) / 2);
  const extent = mx.map((m, k) => m - mn[k]);
  const radius = Math.hypot(...extent) / 2;

  const camDist = radius * 3.5;

  const maxExtent = Math.max(...extent);
  const lightY = mx[1] + maxExtent * 0.25;
  return {
    camera: {
      position: [center[0], center[1] + radius * 0.4, center[2] + camDist],
      target: center,
      fov: 60,

      near: camDist * 0.1,
    },
    background: [0.01, 0.01, 0.03],
    meshes: [],
    objects: [],
    lightQuads: [{
      type: 'quadLight',

      corners: [
        [mn[0], lightY, mn[2]],
        [mx[0], lightY, mn[2]],
        [mx[0], lightY, mx[2]],
        [mn[0], lightY, mx[2]],
      ],
      emission: [4.0, 3.6, 3.2],
    }],
    maxBounces: 8,
  };
}

const GLTF_SCENES = [
  { name: 'box', file: 'gltf/Box/glTF/Box.gltf' },
  { name: 'duck', file: 'gltf/Duck/glTF/Duck.gltf' },
  { name: 'avocado', file: 'gltf/Avocado/glTF/Avocado.gltf' },
  { name: 'lantern', file: 'gltf/Lantern/glTF/Lantern.gltf' },
  { name: 'boombox', file: 'gltf/BoomBox/glTF/BoomBox.gltf' },
];

const gltfSceneEntries = Object.fromEntries(GLTF_SCENES.map(({ name, file }) => [name, {
  camera: { position: [0, 0, 5], target: [0, 0, 0], fov: 60 },
  background: [0.01, 0.01, 0.03],
  meshes: [],
  objects: [],
  lightQuads: [],
  maxBounces: 8,
  load: async () => {
    const { tris, texImages } = await loadGltfTriangles(`/${file}`);
    return { tris, texImages, scene: autoGltfSceneConfig(tris) };
  },
}]));

export const scenes = { cornell, spheres, sponza, ...gltfSceneEntries };
