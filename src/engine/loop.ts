
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { UniformsTable } from './uniforms';

const rtOptions = {
  type: THREE.FloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: false,
  stencilBuffer: false,
};

const TARGET_FRAME_MS: { default: number } & Partial<Record<string, number>> = { sponza: 66, default: 33 };

const TILE_GRID = 2;

export interface LoopDeps {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  uniforms: UniformsTable;
  activeScene: { name: string };
  displayScene: THREE.Scene;
  displayCamera: THREE.OrthographicCamera;
  displayQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  rtA: THREE.WebGLRenderTarget;
  rtB: THREE.WebGLRenderTarget;
}

export interface LoopHandle {

  readonly paused: boolean;

  start(): void;

  readonly rtA: THREE.WebGLRenderTarget;
  readonly rtB: THREE.WebGLRenderTarget;

  readonly perf: { frameMs: number };

  readonly frameIndex: number;
  resetAccumulation(): void;

  resizeRenderTargets(width: number, height: number): void;
  dispose(): void;
}

export function createLoop(deps: LoopDeps): LoopHandle {
  const { renderer, canvas, scene, camera, controls, uniforms, activeScene, displayScene, displayCamera, displayQuad } = deps;
  let rtA = deps.rtA;
  let rtB = deps.rtB;

  function resetAccumulation(): void {
    uniforms.uAccumCount.value = 0;

    renderer.setRenderTarget(rtA);
    renderer.clear();
    renderer.setRenderTarget(rtB);
    renderer.clear();
    renderer.setRenderTarget(null);
  }

  function resizeRenderTargets(width: number, height: number): void {
    rtA.setSize(width, height);
    rtB.setSize(width, height);
  }

  let paused = true;
  let frameIndex = 0;
  let lastTime = performance.now();
  let lastRenderTime = 0;
  let tileIndex = 0;
  const perf = { frameMs: 0 };
  function start(): void {
    if (!paused) return;
    paused = false;

    lastTime = performance.now();
    lastRenderTime = 0;
  }
  renderer.setAnimationLoop(() => {
    if (paused) return;
    const now = performance.now();
    const frameCapMs = TARGET_FRAME_MS[activeScene.name] ?? TARGET_FRAME_MS.default;
    if (now - lastRenderTime < frameCapMs) return;
    lastRenderTime = now;
    const dt = now - lastTime;
    lastTime = now;

    perf.frameMs += (dt - perf.frameMs) * Math.min(1.0, dt / 1000.0);

    controls.update();

    camera.updateMatrixWorld();
    uniforms.uCameraWorldMatrix.value.copy(camera.matrixWorld);
    uniforms.uInvProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    uniforms.uFrame.value = frameIndex++;

    const tileCount = uniforms.uDebugMode.value > 0 ? 1 : TILE_GRID * TILE_GRID;
    const t = tileIndex++ % tileCount;
    const tw = Math.ceil(canvas.width / TILE_GRID);
    const th = Math.ceil(canvas.height / TILE_GRID);
    const tx = (t % TILE_GRID) * tw;
    const ty = Math.floor(t / TILE_GRID) * th;
    renderer.setScissorTest(true);
    renderer.setScissor(tx, ty, Math.min(tw, canvas.width - tx), Math.min(th, canvas.height - ty));
    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    renderer.setRenderTarget(null);
    renderer.render(displayScene, displayCamera);

    const tmp = rtA;
    rtA = rtB;
    rtB = tmp;
    uniforms.uAccumTex.value = rtB.texture;
    displayQuad.material.uniforms.uSrcTex.value = rtA.texture;
    if (t === tileCount - 1) uniforms.uAccumCount.value += 1;
  });

  return {
    get paused() { return paused; },
    start,
    get rtA() { return rtA; },
    get rtB() { return rtB; },
    get perf() { return perf; },
    get frameIndex() { return frameIndex; },
    resetAccumulation,
    resizeRenderTargets,
    dispose() {
      renderer.setAnimationLoop(null);
      rtA.dispose();
      rtB.dispose();
    },
  };
}

export function createRenderTargets(width: number, height: number): { rtA: THREE.WebGLRenderTarget; rtB: THREE.WebGLRenderTarget } {
  return {
    rtA: new THREE.WebGLRenderTarget(width, height, rtOptions),
    rtB: new THREE.WebGLRenderTarget(width, height, rtOptions),
  };
}
