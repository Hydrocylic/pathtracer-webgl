
import * as THREE from 'three';
import { scenes as kernelScenes } from '@core/scene.js';
import type { SceneConfig } from '@core/scene.js';
import { materializeTriangles } from '@core/renderer/bvh.js';
import type { Triangle } from '@core/renderer/bvh.js';
import { makeBundle, type SceneBundle } from './bundle';
import { productProfile, type ProductProfile } from './product-profile';

const trisParam = new URLSearchParams(window.location.search).get('tris');
const trisCap = trisParam === null ? Infinity : Number(trisParam);

export function capTris(tris: Triangle[], sceneConfig: SceneConfig): Triangle[] {
  if (!Number.isFinite(trisCap)) return tris;
  const target = new THREE.Vector3(...sceneConfig.camera.target);
  return tris
    .map((t, i) => ({
      i,
      d: new THREE.Vector3(
        (t.v0.x + t.v1.x + t.v2.x) / 3,
        (t.v0.y + t.v1.y + t.v2.y) / 3,
        (t.v0.z + t.v1.z + t.v2.z) / 3,
      ).distanceToSquared(target),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, trisCap)
    .map((e) => tris[e.i]);
}

export interface SceneRegistry {

  bundles: Record<string, SceneBundle>;

  ready: Record<string, Promise<void>>;

  sceneNames: string[];

  isLazy(name: string): boolean;

  ensureLoaded(name: string): Promise<void>;
}

const neverResolve = (): Promise<void> => new Promise<void>(() => {   });

export function createSceneRegistry(
  onBundleReady: (name: string) => void,
  profile: ProductProfile = productProfile,
): SceneRegistry {
  const bundles: Record<string, SceneBundle> = {};
  const ready: Record<string, Promise<void>> = {};
  const resolvers: Record<string, () => void> = {};
  const started = new Set<string>();

  const sceneNames = Object.keys(kernelScenes)
    .filter((name) => profile.sceneWhitelist === null || profile.sceneWhitelist.includes(name));
  const lazyScenes = new Set(sceneNames.filter((name) => profile.lazyScenes.includes(name)));

  async function loadAsyncBundle(name: string): Promise<void> {
    const sceneConfig = kernelScenes[name];
    if (!sceneConfig.load) return;
    const result = await sceneConfig.load();
    const merged = { ...sceneConfig, ...(result.scene ?? {}) };
    const tris = capTris(result.tris, merged);

    const texImages = new URLSearchParams(window.location.search).get('noatlas') === '1'
      ? null : (result.texImages ?? null);
    const bundle = makeBundle(merged, tris, texImages);
    bundles[name] = bundle;
    console.log(
      `[r15] scene '${name}': ${bundle.bvh.triCount} triangles, ${bundle.bvh.nodeCount} nodes, max depth ${bundle.bvh.maxDepth}, BVH build ${bundle.buildMs.toFixed(0)} ms`,
    );
  }

  function buildSync(name: string): void {
    const sceneConfig = kernelScenes[name];
    const triangles = capTris(materializeTriangles(sceneConfig.meshes), sceneConfig);
    const bundle = makeBundle(sceneConfig, triangles);
    bundles[name] = bundle;
    console.log(
      `[r12] scene '${name}': ${bundle.bvh.triCount} triangles, ${bundle.bvh.nodeCount} nodes, max depth ${bundle.bvh.maxDepth}`,
    );
  }

  function start(name: string): void {
    const sceneConfig = kernelScenes[name];
    if (!sceneConfig) return;
    if (sceneConfig.load) {
      loadAsyncBundle(name).then(() => {
        resolvers[name]?.();
        onBundleReady(name);
      }).catch((err) => {

        console.error(`[r15] 场景 '${name}' 加载失败:`, err);
      });
    } else {
      buildSync(name);
      resolvers[name]?.();
    }
  }

  for (const name of sceneNames) {
    let resolveReady!: () => void;
    ready[name] = new Promise<void>((res) => { resolveReady = res; });
    resolvers[name] = resolveReady;
  }
  for (const name of sceneNames) {
    if (!lazyScenes.has(name)) ensureLoaded(name);
  }

  function ensureLoaded(name: string): Promise<void> {
    if (!ready[name]) return neverResolve();
    if (!started.has(name)) {
      started.add(name);
      start(name);
    }
    return ready[name];
  }

  return {
    bundles,
    ready,
    sceneNames,
    isLazy: (name) => lazyScenes.has(name),
    ensureLoaded,
  };
}
