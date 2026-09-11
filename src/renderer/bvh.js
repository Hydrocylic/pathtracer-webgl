
import * as THREE from 'three';
import { ATLAS_LAYOUT } from '../scene/sponza-loader.js';

const LEAF_SIZE = 4;
const MAX_DEPTH = 32;
const SAH_BINS = 16;

export const MAT_TYPES = { lambert: 0, mirror: 1, glass: 2 };

export function materializeTriangles(meshes) {
  const tris = [];
  for (const mesh of meshes) {
    const albedo = mesh.material.color;
    const matType = MAT_TYPES[mesh.material.type] ?? 0;
    if (mesh.type === 'quad') {

      const { a, b, c, d } = mesh.corners;
      const va = new THREE.Vector3(...a);
      const vb = new THREE.Vector3(...b);
      const vc = new THREE.Vector3(...c);
      const vd = new THREE.Vector3(...d);

      const ns = flatNs(va, vb, vc);
      tris.push({ v0: va, v1: vb, v2: vc, albedo, matType, ns });
      tris.push({ v0: va, v1: vc, v2: vd, albedo, matType, ns });
    } else if (mesh.type === 'sphere') {
      const geo = new THREE.SphereGeometry(mesh.radius, mesh.segments, mesh.segments);
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const idx = geo.index ? geo.index.array : null;
      const count = idx ? idx.length : pos.count;
      for (let i = 0; i < count; i += 3) {
        const i0 = idx ? idx[i] : i;
        const i1 = idx ? idx[i + 1] : i + 1;
        const i2 = idx ? idx[i + 2] : i + 2;
        const va = vertex(pos, i0, mesh.center);
        const vb = vertex(pos, i1, mesh.center);
        const vc = vertex(pos, i2, mesh.center);

        const ns = nor
          ? Float32Array.from([nor.getX(i0), nor.getY(i0), nor.getZ(i0), nor.getX(i1), nor.getY(i1), nor.getZ(i1), nor.getX(i2), nor.getY(i2), nor.getZ(i2)])
          : flatNs(va, vb, vc);
        tris.push({ v0: va, v1: vb, v2: vc, albedo, matType, ns });
      }
    }
  }
  return tris;
}

function vertex(pos, k, center) {
  return new THREE.Vector3(
    pos.getX(k) + center[0],
    pos.getY(k) + center[1],
    pos.getZ(k) + center[2],
  );
}

function flatNs(a, b, c) {
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  return Float32Array.from([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]);
}

export function buildBVH(triangles, strategy = 'median') {
  const n = triangles.length;
  const centroids = new Float32Array(n * 3);
  const bounds = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const { v0, v1, v2 } = triangles[i];
    centroids[i * 3] = (v0.x + v1.x + v2.x) / 3;
    centroids[i * 3 + 1] = (v0.y + v1.y + v2.y) / 3;
    centroids[i * 3 + 2] = (v0.z + v1.z + v2.z) / 3;
    const mn = v0.clone().min(v1).min(v2);
    const mx = v0.clone().max(v1).max(v2);
    bounds[i * 6] = mn.x;
    bounds[i * 6 + 1] = mn.y;
    bounds[i * 6 + 2] = mn.z;
    bounds[i * 6 + 3] = mx.x;
    bounds[i * 6 + 4] = mx.y;
    bounds[i * 6 + 5] = mx.z;
  }

  const order = Array.from({ length: n }, (_, i) => i);
  const nodes = [];
  let maxDepth = 0;
  let costSum = 0;
  const leafHistogram = [0, 0, 0, 0, 0, 0];

  function boxArea(mn, mx) {
    const dx = mx[0] - mn[0];
    const dy = mx[1] - mn[1];
    const dz = mx[2] - mn[2];
    return 2 * (dx * dy + dy * dz + dz * dx);

  }

  function medianSplit(rangeStart, rangeEnd, mn, mx) {
    const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    let axis = ext[0] > ext[1] ? 0 : 1;
    axis = ext[axis] > ext[2] ? axis : 2;
    const sub = order.slice(rangeStart, rangeEnd);

    sub.sort((a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis]);
    for (let i = 0; i < sub.length; i++) order[rangeStart + i] = sub[i];
    const mid = rangeStart + ((rangeEnd - rangeStart) >> 1);

    return { mid, axis };
  }

  function sahSplit(rangeStart, rangeEnd) {
    const count = rangeEnd - rangeStart;
    const binCount = new Int32Array(SAH_BINS);
    const binMin = new Float32Array(SAH_BINS * 3);
    const binMax = new Float32Array(SAH_BINS * 3);
    let bestAxis = -1;
    let bestCost = Infinity;
    let bestSplitPos = 0;
    for (let ax = 0; ax < 3; ax++) {

      let cmin = Infinity;
      let cmax = -Infinity;
      for (let i = rangeStart; i < rangeEnd; i++) {
        const c = centroids[order[i] * 3 + ax];
        if (c < cmin) cmin = c;
        if (c > cmax) cmax = c;
      }
      if (cmin === cmax) continue;

      binCount.fill(0);
      binMin.fill(Infinity);
      binMax.fill(-Infinity);
      const scale = SAH_BINS / (cmax - cmin);
      for (let i = rangeStart; i < rangeEnd; i++) {
        const t = order[i];
        const c = centroids[t * 3 + ax];
        const b = Math.min(SAH_BINS - 1, Math.floor((c - cmin) * scale));

        binCount[b]++;
        const bo = t * 6;
        for (let k = 0; k < 3; k++) {
          binMin[b * 3 + k] = Math.min(binMin[b * 3 + k], bounds[bo + k]);
          binMax[b * 3 + k] = Math.max(binMax[b * 3 + k], bounds[bo + 3 + k]);
        }
      }

      const rightCount = new Float32Array(SAH_BINS);
      const rightArea = new Float32Array(SAH_BINS);
      let rc = 0;
      const rmn = [Infinity, Infinity, Infinity];
      const rmx = [-Infinity, -Infinity, -Infinity];
      for (let b = SAH_BINS - 1; b >= 0; b--) {
        rc += binCount[b];
        for (let k = 0; k < 3; k++) {
          rmn[k] = Math.min(rmn[k], binMin[b * 3 + k]);
          rmx[k] = Math.max(rmx[k], binMax[b * 3 + k]);
        }
        rightCount[b] = rc;
        rightArea[b] = boxArea(rmn, rmx);
      }

      let lc = 0;
      const lmn = [Infinity, Infinity, Infinity];
      const lmx = [-Infinity, -Infinity, -Infinity];
      for (let b = 0; b < SAH_BINS - 1; b++) {
        lc += binCount[b];
        for (let k = 0; k < 3; k++) {
          lmn[k] = Math.min(lmn[k], binMin[b * 3 + k]);
          lmx[k] = Math.max(lmx[k], binMax[b * 3 + k]);
        }

        const cost = lc * boxArea(lmn, lmx) + rightCount[b + 1] * rightArea[b + 1];
        if (cost < bestCost) {
          bestCost = cost;
          bestAxis = ax;

          bestSplitPos = cmin + ((cmax - cmin) * (b + 1)) / SAH_BINS;
        }
      }
    }
    if (bestAxis < 0) return null;

    let i = rangeStart;
    let j = rangeEnd - 1;
    while (i <= j) {
      if (centroids[order[i] * 3 + bestAxis] < bestSplitPos) i++;
      else {
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
        j--;
      }
    }
    const leftCount = i - rangeStart;
    if (leftCount === 0 || leftCount === count) return null;
    return { mid: i, axis: bestAxis };
  }

  function build(rangeStart, rangeEnd, depth) {
    maxDepth = Math.max(maxDepth, depth);

    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = rangeStart; i < rangeEnd; i++) {
      const b = order[i] * 6;
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], bounds[b + k]);
        mx[k] = Math.max(mx[k], bounds[b + 3 + k]);
      }
    }
    costSum += boxArea(mn, mx) * (rangeEnd - rangeStart);
    const nodeIdx = nodes.length;

    nodes.push({ min: mn, max: mx, leftFirst: rangeStart, rightFirst: 0, triCount: rangeEnd - rangeStart, splitAxis: 0 });

    const count = rangeEnd - rangeStart;
    if (count > LEAF_SIZE && depth < MAX_DEPTH) {

      let split = null;
      if (strategy === 'sah') split = sahSplit(rangeStart, rangeEnd);
      if (split === null) split = medianSplit(rangeStart, rangeEnd, mn, mx);

      const leftIdx = build(rangeStart, split.mid, depth + 1);
      const rightIdx = build(split.mid, rangeEnd, depth + 1);
      nodes[nodeIdx].leftFirst = leftIdx;
      nodes[nodeIdx].rightFirst = rightIdx;
      nodes[nodeIdx].triCount = 0;
      nodes[nodeIdx].splitAxis = split.axis;
    }
    if (nodes[nodeIdx].triCount > 0) leafHistogram[Math.min(nodes[nodeIdx].triCount, 5)]++;
    return nodeIdx;
  }

  build(0, n, 0);
  return { nodes, order, maxDepth, costSum, leafHistogram };
}

function makeFloatTexture(data, dimension, internalFormat) {
  const texture = new THREE.DataTexture(data, dimension, dimension, THREE.RGBAFormat, THREE.FloatType);
  texture.internalFormat = internalFormat;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function makeUintTexture(data, dimension, internalFormat, format) {
  const texture = new THREE.DataTexture(data, dimension, dimension, format, THREE.UnsignedIntType);
  texture.internalFormat = internalFormat;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function buildBVHTextures(triangles, options = {}) {

  const { nodes, order, maxDepth, costSum, leafHistogram } = buildBVH(
    triangles,
    options.strategy ?? 'sah',
  );

  const n = triangles.length;

  const vMap = new Map();
  const posFloats = [];
  const normFloats = [];
  const uvFloats = [];
  const triIndices = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = triangles[order[i]];
    const vs = [t.v0, t.v1, t.v2];
    const ns = t.ns;
    const uvs = t.uvs;
    for (let k = 0; k < 3; k++) {
      const key = `${vs[k].x},${vs[k].y},${vs[k].z}`
        + (ns ? `|${ns[k * 3]},${ns[k * 3 + 1]},${ns[k * 3 + 2]}` : '')
        + (uvs ? `|${uvs[k * 2]},${uvs[k * 2 + 1]}` : '');
      let vi = vMap.get(key);
      if (vi === undefined) {
        vi = vMap.size;
        vMap.set(key, vi);
        posFloats.push(vs[k].x, vs[k].y, vs[k].z, 1.0);
        normFloats.push(ns ? ns[k * 3] : 0.0, ns ? ns[k * 3 + 1] : 0.0, ns ? ns[k * 3 + 2] : 0.0, 0.0);
        uvFloats.push(uvs ? uvs[k * 2] : 0.0, uvs ? uvs[k * 2 + 1] : 0.0, 0.0, 0.0);
      }
      triIndices[i * 3 + k] = vi;
    }
  }
  const vertexCount = vMap.size;

  const boundsDim = 2 * Math.ceil(Math.sqrt(nodes.length / 2));
  const boundsFloats = new Float32Array(4 * boundsDim * boundsDim);

  const contentsDim = Math.ceil(Math.sqrt(nodes.length));
  const contentsUints = new Uint32Array(2 * contentsDim * contentsDim);
  const LEAF_FLAG = 0xffff0000;
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i];
    const bo = i * 8;
    boundsFloats[bo] = nd.min[0];
    boundsFloats[bo + 1] = nd.min[1];
    boundsFloats[bo + 2] = nd.min[2];
    boundsFloats[bo + 4] = nd.max[0];
    boundsFloats[bo + 5] = nd.max[1];
    boundsFloats[bo + 6] = nd.max[2];
    const co = i * 2;
    if (nd.triCount > 0) {

      contentsUints[co] = (LEAF_FLAG | Math.min(nd.triCount, 0xffff)) >>> 0;
      contentsUints[co + 1] = nd.leftFirst >>> 0;
    } else {
      contentsUints[co] = nd.splitAxis >>> 0;
      contentsUints[co + 1] = (nd.rightFirst - i) >>> 0;
    }
  }

  const posDim = Math.ceil(Math.sqrt(vertexCount)) || 1;
  const posData = new Float32Array(4 * posDim * posDim);
  posData.set(posFloats);

  const normData = new Float32Array(4 * posDim * posDim);
  normData.set(normFloats);

  const uvData = new Float32Array(4 * posDim * posDim);
  uvData.set(uvFloats);

  const indexDim = Math.ceil(Math.sqrt(n)) || 1;
  const indexData = new Uint32Array(4 * indexDim * indexDim);
  for (let i = 0; i < n; i++) {
    indexData[i * 4] = triIndices[i * 3];
    indexData[i * 4 + 1] = triIndices[i * 3 + 1];
    indexData[i * 4 + 2] = triIndices[i * 3 + 2];
    indexData[i * 4 + 3] = 1;
  }

  const infoDim = Math.ceil(Math.sqrt(n * 2)) || 1;
  const infoFloats = new Float32Array(4 * infoDim * infoDim);
  for (let i = 0; i < n; i++) {
    const t = triangles[order[i]];
    const o = i * 8;
    infoFloats[o] = t.albedo[0];
    infoFloats[o + 1] = t.albedo[1];
    infoFloats[o + 2] = t.albedo[2];
    infoFloats[o + 3] = t.matType;
    infoFloats[o + 4] = t.texLayer ?? -1.0;
  }

  const atlasTextures = [];
  const texImages = options.texImages;
  if (texImages?.length) {
    const { GRID, CELL, PAD, ATLAS, CELLS_PER_ATLAS, COUNT } = ATLAS_LAYOUT;
    for (let a = 0; a < COUNT; a++) {
      const canvas = document.createElement('canvas');
      canvas.width = ATLAS;
      canvas.height = ATLAS;
      const ctx = canvas.getContext('2d');
      texImages.forEach((img, k) => {

        if (!img || Math.floor(k / CELLS_PER_ATLAS) !== a) return;
        const cell = k % CELLS_PER_ATLAS;
        const ox = (cell % GRID) * CELL;
        const oy = Math.floor(cell / GRID) * CELL;
        const inner = CELL - 2 * PAD;
        ctx.drawImage(img, ox + PAD, oy + PAD, inner, inner);

        ctx.drawImage(img, 0, 0, img.width, 1, ox + PAD, oy, inner, PAD);
        ctx.drawImage(img, 0, img.height - 1, img.width, 1, ox + PAD, oy + CELL - PAD, inner, PAD);
        ctx.drawImage(img, 0, 0, 1, img.height, ox, oy + PAD, PAD, inner);
        ctx.drawImage(img, img.width - 1, 0, 1, img.height, ox + CELL - PAD, oy + PAD, PAD, inner);
      });

      const px = ctx.getImageData(0, 0, ATLAS, ATLAS).data;
      const data = new Uint8Array(ATLAS * ATLAS * 4);
      data.set(px.length >= data.length ? px.subarray(0, data.length) : px);
      const tex = new THREE.DataTexture(data, ATLAS, ATLAS, THREE.RGBAFormat);
      tex.type = THREE.UnsignedByteType;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.flipY = false;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      atlasTextures.push(tex);
    }
  }

  return {

    boundsTexture: makeFloatTexture(boundsFloats, boundsDim, 'RGBA32F'),
    contentsTexture: makeUintTexture(contentsUints, contentsDim, 'RG32UI', THREE.RGIntegerFormat),
    positionTexture: makeFloatTexture(posData, posDim, 'RGBA32F'),
    normalTexture: makeFloatTexture(normData, posDim, 'RGBA32F'),
    uvTexture: makeFloatTexture(uvData, posDim, 'RGBA32F'),
    indexTexture: makeUintTexture(indexData, indexDim, 'RGBA32UI', THREE.RGBAIntegerFormat),
    triInfoTexture: makeFloatTexture(infoFloats, infoDim, 'RGBA32F'),
    atlasTextures,
    nodeCount: nodes.length,
    vertexCount,
    triCount: n,
    maxDepth,
    costSum,
    leafHistogram,
  };
}
