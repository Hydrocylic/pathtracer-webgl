
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const ATLAS_LAYOUT = { GRID: 8, CELL: 256, PAD: 1, ATLAS: 8 * 256, CELLS_PER_ATLAS: 64, COUNT: 2 };

export async function loadGltfTriangles(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return extractSponzaTriangles(gltf);
}

export async function loadSponzaTriangles(url) {
  return loadGltfTriangles(url);
}

export async function extractSponzaTriangles(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const tris = [];
  const texLayerMap = new Map();
  const texImages = [];
  const albedoPromises = [];
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const geo = node.geometry;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const idx = geo.index ? geo.index.array : null;
    const count = idx ? idx.length : pos.count;
    const mat = node.material;
    const m = node.matrixWorld;

    const normalMat = new THREE.Matrix3().getNormalMatrix(m);

    const v = (k) =>
      new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(m);

    const n = nor
      ? (k) => new THREE.Vector3(nor.getX(k), nor.getY(k), nor.getZ(k)).applyMatrix3(normalMat).normalize()
      : null;

    let texLayer = -1;
    if (mat.map && mat.map.image) {
      if (!texLayerMap.has(mat.map)) {
        texLayerMap.set(mat.map, texImages.length);
        texImages.push(mat.map.image);
      }
      texLayer = texLayerMap.get(mat.map);
    }

    const cellIdx = texLayer % ATLAS_LAYOUT.CELLS_PER_ATLAS;
    const cellCol = cellIdx % ATLAS_LAYOUT.GRID;
    const cellRow = Math.floor(cellIdx / ATLAS_LAYOUT.GRID);
    const inner = ATLAS_LAYOUT.CELL - 2 * ATLAS_LAYOUT.PAD;
    const wrapU = mat.map?.wrapS === THREE.ClampToEdgeWrapping;
    const wrapV = mat.map?.wrapT === THREE.ClampToEdgeWrapping;
    const toAtlasU = (u) => (cellCol * ATLAS_LAYOUT.CELL + ATLAS_LAYOUT.PAD + (wrapU ? Math.min(Math.max(u, 0.0), 1.0) : u - Math.floor(u)) * inner) / ATLAS_LAYOUT.ATLAS;
    const toAtlasV = (v) => (cellRow * ATLAS_LAYOUT.CELL + ATLAS_LAYOUT.PAD + (wrapV ? Math.min(Math.max(v, 0.0), 1.0) : v - Math.floor(v)) * inner) / ATLAS_LAYOUT.ATLAS;
    for (let i = 0; i < count; i += 3) {
      const i0 = idx ? idx[i] : i;
      const i1 = idx ? idx[i + 1] : i + 1;
      const i2 = idx ? idx[i + 2] : i + 2;
      const tri = { v0: v(i0), v1: v(i1), v2: v(i2), albedo: null, matType: 0, texLayer };

      if (n) {
        const n0 = n(i0);
        const n1 = n(i1);
        const n2 = n(i2);
        tri.ns = Float32Array.from([n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z]);
      } else {

        const flat = tri.v1.clone().sub(tri.v0).cross(tri.v2.clone().sub(tri.v0)).normalize();
        tri.ns = Float32Array.from([flat.x, flat.y, flat.z, flat.x, flat.y, flat.z, flat.x, flat.y, flat.z]);
      }

      if (uv && texLayer >= 0) {
        tri.uvs = Float32Array.from([
          toAtlasU(uv.getX(i0)), toAtlasV(uv.getY(i0)),
          toAtlasU(uv.getX(i1)), toAtlasV(uv.getY(i1)),
          toAtlasU(uv.getX(i2)), toAtlasV(uv.getY(i2)),
        ]);
      }
      tris.push(tri);
    }

    const albedoPromise = (async () => {
      const c = mat.color ?? new THREE.Color(0.8, 0.8, 0.8);
      return [c.r, c.g, c.b];
    })();

    const start = tris.length - count / 3;
    albedoPromises.push({ start, end: tris.length, promise: albedoPromise });
  });

  await Promise.all(albedoPromises.map(async ({ start, end, promise }) => {
    const albedo = await promise;
    for (let i = start; i < end; i++) tris[i].albedo = albedo;
  }));
  return { tris, texImages };
}
