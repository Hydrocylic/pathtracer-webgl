
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadGltfTriangles } from '@core/scene/sponza-loader.js';
import { autoGltfSceneConfig } from '@core/scene.js';
import { createSceneRegistry, capTris, type SceneRegistry } from './scenes';
import { makeBundle, type SceneBundle } from './bundle';
import { createUniforms, type UniformsTable } from './uniforms';
import { createPasses, type Passes } from './passes';
import { createLoop, createRenderTargets, type LoopHandle } from './loop';
import { createProbe, type Probe } from '../dev/probe';
import { installCompat } from './compat';
import { productProfile } from './product-profile';

export type EngineEvent = 'scene' | 'param' | 'camera' | 'bundle';

function maxArrayTextureLayers(gl: WebGLRenderingContext | WebGL2RenderingContext): number {
  return typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
    ? gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)
    : 0;
}

export interface CameraState {
  px: number; py: number; pz: number;
  tx: number; ty: number; tz: number;
  fov: number;
}

export interface SceneStats {
  triCount: number;
  nodeCount: number;
  maxDepth: number;
  buildMs: number;
}

export interface UiSnapshot {
  sceneName: string;

  sceneList: Array<{ name: string; ready: boolean; lazy: boolean }>;
  spp: number;
  useBvh: number;
  useNee: number;
  debugMode: number;
  background: [number, number, number];
  camera: CameraState;
  sceneStats: SceneStats | null;

  loading: boolean;
  loadingScene: string | null;

  uiHidden: boolean;
}

export class PathTracerEngine {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly uniforms: UniformsTable;
  readonly activeScene: { name: string };
  readonly registry: SceneRegistry;
  readonly dummyAtlasTex: THREE.DataTexture;
  private readonly passes: Passes;
  private readonly probe: Probe;
  private readonly loop: LoopHandle;
  private currentStats: SceneStats | null = null;

  private pendingScene: string | null = null;
  private savedSpp = 1;
  private readonly listeners = new Map<EngineEvent, Set<() => void>>();
  private readonly disposers: Array<() => void> = [];
  readonly uiHidden: boolean;

  constructor() {

    const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
    if (!canvas) throw new Error('找不到 #canvas——index.html 必须包含 <canvas id="canvas">');
    this.canvas = canvas;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas });
    } catch (err) {

      console.error('[BUG-012] WebGL context 创建被 Chrome 拒绝（页面曾 context loss 被 blocked）——关掉标签页重开或重启浏览器后再试');
      throw err;
    }
    this.renderer = renderer;

    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const targets = createRenderTargets(canvas.width, canvas.height);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

    this.controls = new OrbitControls(this.camera, canvas);

    this.registry = createSceneRegistry(() => this.emit('bundle'));

    const { uniforms, dummyAtlasTex } = createUniforms(canvas.width, canvas.height, targets.rtB.texture);
    this.uniforms = uniforms;
    this.dummyAtlasTex = dummyAtlasTex;

    const glCaps = renderer.getContext();
    console.log(
      `[BUG-012] GPU 能力: maxTextureSize=${renderer.capabilities.maxTextureSize} | maxTextures=${renderer.capabilities.maxTextures} | maxArrayTextureLayers=${maxArrayTextureLayers(glCaps)}`,
    );

    this.activeScene = { name: 'cornell' };

    this.passes = createPasses(this.scene, uniforms, targets.rtA.texture);

    this.probe = createProbe({ renderer, bundles: this.registry.bundles, activeScene: this.activeScene, displayCamera: this.passes.displayCamera });

    this.controls.addEventListener('change', () => {
      this.loop.resetAccumulation();
      this.emit('camera');
    });

    const onContextLost = (e: Event) => {
      console.error(`[BUG-012] WebGL context lost（GPU TDR 驱动重置）——frame=${this.loop.frameIndex} scene='${this.activeScene.name}'`);
      e.preventDefault();
    };
    const onContextRestored = () => {
      console.warn('[BUG-012] WebGL context restored——刷新页面恢复完整状态（纹理需重新上传）');
      this.loop.resetAccumulation();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    this.disposers.push(
      () => canvas.removeEventListener('webglcontextlost', onContextLost),
      () => canvas.removeEventListener('webglcontextrestored', onContextRestored),
    );

    const onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.uniforms.uResolution.value.set(this.canvas.width, this.canvas.height);
      this.loop.resizeRenderTargets(this.canvas.width, this.canvas.height);
      this.loop.resetAccumulation();
    };
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));

    this.uiHidden = installCompat(this);

    this.loop = createLoop({
      renderer, canvas: this.canvas, scene: this.scene, camera: this.camera, controls: this.controls,
      uniforms: this.uniforms, activeScene: this.activeScene,
      displayScene: this.passes.displayScene, displayCamera: this.passes.displayCamera, displayQuad: this.passes.displayQuad,
      rtA: targets.rtA, rtB: targets.rtB,
    });
  }

  applyScene(bundle: SceneBundle): void {
    const { sceneConfig } = bundle;
    this.camera.fov = sceneConfig.camera.fov;
    this.camera.near = sceneConfig.camera.near ?? 0.1;
    this.camera.position.set(...sceneConfig.camera.position);
    this.camera.lookAt(...sceneConfig.camera.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.controls.target.set(...sceneConfig.camera.target);
    this.uniforms.uCameraWorldMatrix.value.copy(this.camera.matrixWorld);
    this.uniforms.uInvProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
    this.uniforms.uBackground.value.setRGB(...sceneConfig.background);
    this.uniforms.uMaxBounces.value = sceneConfig.maxBounces;
    this.uniforms.uObjects.value = bundle.uObjects;
    this.uniforms.uAlbedos.value = bundle.uAlbedos;
    this.uniforms.uEmissions.value = bundle.uEmissions;
    this.uniforms.uObjectCount.value = bundle.objectCount;
    this.uniforms.uLightQuads.value = bundle.uLightQuads;
    this.uniforms.uLightQuadEmissions.value = bundle.uLightQuadEmissions;
    this.uniforms.uLightQuadCount.value = bundle.lightQuadCount;
    this.uniforms.uBvhBoundsTex.value = bundle.bvh.boundsTexture;
    this.uniforms.uBvhContentsTex.value = bundle.bvh.contentsTexture;
    this.uniforms.uBvhPositionTex.value = bundle.bvh.positionTexture;
    this.uniforms.uBvhNormalTex.value = bundle.bvh.normalTexture;
    this.uniforms.uBvhUvTex.value = bundle.bvh.uvTexture;
    this.uniforms.uBvhIndexTex.value = bundle.bvh.indexTexture;
    this.uniforms.uBvhTriInfoTex.value = bundle.bvh.triInfoTexture;
    this.uniforms.uAtlasTex0.value = bundle.bvh.atlasTextures[0] ?? this.dummyAtlasTex;
    this.uniforms.uAtlasTex1.value = bundle.bvh.atlasTextures[1] ?? this.dummyAtlasTex;
    this.uniforms.uTriCount.value = bundle.bvh.triCount;
    this.currentStats = {
      triCount: bundle.bvh.triCount,
      nodeCount: bundle.bvh.nodeCount,
      maxDepth: bundle.bvh.maxDepth,
      buildMs: bundle.buildMs,
    };
    this.pendingScene = null;
    this.loop.start();
    this.schedulePrefetch();
    this.emit('camera');
  }

  private schedulePrefetch(): void {
    const target = productProfile.prefetchOnIdle;
    if (!target || this.registry.bundles[target]) return;
    const run = () => { void this.registry.ensureLoaded(target); };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      window.setTimeout(run, 1500);
    }
  }

  setScene(name: string): void {
    const bundle = this.registry.bundles[name];
    if (!bundle) {
      if (this.registry.isLazy(name)) {
        void this.applyDeferredScene(name, null);
        return;
      }

      console.log(`[r15] 场景 '${name}' 尚未就绪，回退 cornell`);
      this.activeScene.name = 'cornell';
      this.emit('scene');
      return;
    }
    this.activeScene.name = name;
    this.applyScene(bundle);
    this.loop.resetAccumulation();
    this.emit('scene');
  }

  async applyDeferredScene(name: string, debugParam: number | null): Promise<void> {
    this.pendingScene = name;
    await this.registry.ensureLoaded(name);
    const bundle = this.registry.bundles[name];
    if (!bundle) return;
    this.activeScene.name = name;
    this.applyScene(bundle);
    this.loop.resetAccumulation();
    if (debugParam !== null) this.uniforms.uDebugMode.value = debugParam;
    console.log(`[diag] auto-applied scene '${name}' debug=${this.uniforms.uDebugMode.value}`);
    this.emit('scene');
  }

  async loadGltfScene(wantsGltf: string): Promise<void> {
    this.pendingScene = 'gltf';

    const { tris, texImages } = await loadGltfTriangles(`/${wantsGltf}`);
    const sceneConfig = autoGltfSceneConfig(tris);
    const bundle = makeBundle(sceneConfig, capTris(tris, sceneConfig), texImages);
    this.registry.bundles.gltf = bundle;
    this.activeScene.name = 'gltf';
    this.applyScene(bundle);
    this.loop.resetAccumulation();
    console.log(
      `[r15] gltf '${wantsGltf}': ${bundle.bvh.triCount} triangles, ${bundle.bvh.nodeCount} nodes, camera [${sceneConfig.camera.position.map((v) => v.toFixed(2))}]`,
    );
    this.emit('bundle');
    this.emit('scene');
  }

  setParam(key: 'spp' | 'useBvh' | 'useNee' | 'debugMode' | 'bgR' | 'bgG' | 'bgB', value: number): void {
    const u = this.uniforms;
    if (key === 'spp') {
      u.uSpp.value = value;
      this.loop.resetAccumulation();
    } else if (key === 'useBvh') {

      if (value === 0) {
        this.savedSpp = u.uSpp.value;
        u.uSpp.value = 1;
        this.renderer.setPixelRatio(1);
        u.uResolution.value.set(this.canvas.width, this.canvas.height);
      } else {
        if (this.savedSpp > 1) u.uSpp.value = this.savedSpp;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        u.uResolution.value.set(this.canvas.width, this.canvas.height);
      }
      this.loop.resizeRenderTargets(this.canvas.width, this.canvas.height);
      this.loop.resetAccumulation();
    } else if (key === 'useNee') {
      u.uUseNee.value = value;
      this.loop.resetAccumulation();
    } else if (key === 'debugMode') {
      u.uDebugMode.value = value;
      this.loop.resetAccumulation();
    } else {

      u.uBackground.value[key === 'bgR' ? 'r' : key === 'bgG' ? 'g' : 'b'] = value;
      this.loop.resetAccumulation();
    }
    this.emit('param');
  }

  setCameraAxis(key: 'px' | 'py' | 'pz' | 'tx' | 'ty' | 'tz', value: number): void {
    if (!Number.isFinite(value)) return;
    const axis = key[1] as 'x' | 'y' | 'z';
    (key[0] === 'p' ? this.camera.position : this.controls.target)[axis] = value;
    this.loop.resetAccumulation();
    this.emit('camera');
  }

  accumSamples(): number {
    return this.uniforms.uAccumCount.value * this.uniforms.uSpp.value;
  }

  frameMs(): number {
    return this.loop.perf.frameMs;
  }

  getUiSnapshot(): UiSnapshot {
    const names = Array.from(new Set([...this.registry.sceneNames, ...Object.keys(this.registry.bundles)]));
    return {
      sceneName: this.activeScene.name,
      sceneList: names.map((name) => ({
        name,
        ready: this.registry.bundles[name] !== undefined,
        lazy: this.registry.isLazy(name),
      })),
      spp: this.uniforms.uSpp.value,
      useBvh: this.uniforms.uUseBvh.value,
      useNee: this.uniforms.uUseNee.value,
      debugMode: this.uniforms.uDebugMode.value,
      background: [this.uniforms.uBackground.value.r, this.uniforms.uBackground.value.g, this.uniforms.uBackground.value.b],
      camera: {
        px: this.camera.position.x, py: this.camera.position.y, pz: this.camera.position.z,
        tx: this.controls.target.x, ty: this.controls.target.y, tz: this.controls.target.z,
        fov: this.camera.fov,
      },
      sceneStats: this.currentStats,
      loading: this.loop.paused || this.pendingScene !== null,
      loadingScene: this.pendingScene,
      uiHidden: this.uiHidden,
    };
  }

  get pendingSceneName(): string | null {
    return this.pendingScene;
  }

  collectEnvInfo(): string {
    const gl = this.renderer.getContext();
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return JSON.stringify({
      gpuUnmaskedRenderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null,
      gpuUnmaskedVendor: d ? gl.getParameter(d.UNMASKED_VENDOR_WEBGL) : null,
      backend: {
        version: gl.getParameter(gl.VERSION),
        renderer: gl.getParameter(gl.RENDERER),
        glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      },
      capabilities: {
        maxTextureSize: this.renderer.capabilities.maxTextureSize,
        maxTextures: this.renderer.capabilities.maxTextures,
        maxArrayTextureLayers: maxArrayTextureLayers(gl),
      },
      contextAttributes: gl.getContextAttributes(),
      devicePixelRatio: window.devicePixelRatio,
      size: {
        viewport: [window.innerWidth, window.innerHeight],
        canvas: [this.canvas.width, this.canvas.height],
        uResolution: [this.uniforms.uResolution.value.x, this.uniforms.uResolution.value.y],
      },
      userAgent: navigator.userAgent,
    }, null, 2);
  }

  probeBvhTextures(): string[] | string {
    return this.probe.probeBvhTextures();
  }

  get rtA(): THREE.WebGLRenderTarget { return this.loop.rtA; }
  get rtB(): THREE.WebGLRenderTarget { return this.loop.rtB; }
  get quadMaterial(): THREE.ShaderMaterial { return this.passes.quad.material; }
  get displayMaterial(): THREE.ShaderMaterial { return this.passes.displayQuad.material; }
  resetAccumulation(): void { this.loop.resetAccumulation(); }

  on(event: EngineEvent, cb: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) { set = new Set(); this.listeners.set(event, set); }
    set.add(cb);
    return () => set!.delete(cb);
  }

  private emit(event: EngineEvent): void {
    this.listeners.get(event)?.forEach((cb) => cb());
  }

  dispose(): void {
    this.loop.dispose();
    this.probe.dispose();
    this.controls.dispose();
    this.disposers.forEach((d) => d());
    this.disposers.length = 0;
    this.passes.quad.geometry.dispose();
    this.passes.quad.material.dispose();
    this.passes.displayQuad.geometry.dispose();
    this.passes.displayQuad.material.dispose();
    this.dummyAtlasTex.dispose();
    this.renderer.dispose();
  }
}
