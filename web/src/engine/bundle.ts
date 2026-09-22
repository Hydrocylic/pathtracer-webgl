
import * as THREE from 'three';
import { buildBVHTextures, MAT_TYPES } from '@core/renderer/bvh.js';
import type { BvhTextures, TexImage, Triangle } from '@core/renderer/bvh.js';
import type { SceneConfig } from '@core/scene.js';

export const MAX_OBJECTS = 8;
export const MAX_LIGHT_QUADS = 8;

const BLACK3: [number, number, number] = [0, 0, 0];

export interface SceneBundle {
  sceneConfig: SceneConfig;
  uObjects: THREE.Vector4[];
  uAlbedos: THREE.Vector4[];
  uEmissions: THREE.Vector4[];
  objectCount: number;
  uLightQuads: THREE.Vector4[];
  uLightQuadEmissions: THREE.Vector4[];
  lightQuadCount: number;
  bvh: BvhTextures;
  buildMs: number;
}

export function makeBundle(sceneConfig: SceneConfig, triangles: Triangle[], texImages: TexImage[] | null = null): SceneBundle {
  const t0 = performance.now();
  const bvh = buildBVHTextures(triangles, { texImages });
  const buildMs = performance.now() - t0;

  const uObjects = Array.from({ length: MAX_OBJECTS }, () => new THREE.Vector4());
  const uAlbedos = Array.from({ length: MAX_OBJECTS }, () => new THREE.Vector4());
  const uEmissions = Array.from({ length: MAX_OBJECTS }, () => new THREE.Vector4());
  let objectCount = 0;
  for (const obj of sceneConfig.objects) {
    if (objectCount >= MAX_OBJECTS) break;
    uObjects[objectCount].set(...obj.center, obj.radius);
    uAlbedos[objectCount].set(...(obj.material.color ?? BLACK3), MAT_TYPES[obj.material.type ?? ''] ?? 0);
    uEmissions[objectCount].set(...(obj.material.emission ?? BLACK3), 0);
    objectCount += 1;
  }

  const uLightQuads = Array.from({ length: MAX_LIGHT_QUADS * 4 }, () => new THREE.Vector4());
  const uLightQuadEmissions = Array.from({ length: MAX_LIGHT_QUADS }, () => new THREE.Vector4());
  let lightQuadCount = 0;
  for (const lq of sceneConfig.lightQuads ?? []) {
    if (lightQuadCount >= MAX_LIGHT_QUADS) break;
    lq.corners.forEach((corner, k) => uLightQuads[lightQuadCount * 4 + k].set(...corner, 0));
    uLightQuadEmissions[lightQuadCount].set(...(lq.emission ?? BLACK3), 0);
    lightQuadCount += 1;
  }

  return {
    sceneConfig,
    uObjects, uAlbedos, uEmissions, objectCount,
    uLightQuads, uLightQuadEmissions, lightQuadCount,
    bvh, buildMs,
  };
}
