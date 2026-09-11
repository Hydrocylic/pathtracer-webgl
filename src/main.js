import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Pane } from 'tweakpane';
import { scenes, autoGltfSceneConfig } from './scene.js';
import { loadGltfTriangles } from './scene/sponza-loader.js';
import { materializeTriangles, buildBVHTextures, MAT_TYPES } from './renderer/bvh.js';
import { addDebugInputs } from './debug/debug-modes.js';
import { addCameraInputs } from './debug/camera-panel.js';
import vertShader from './shaders/fullscreen.vert.glsl?raw';
import fragShader from './shaders/pathtrace.frag.glsl?raw';
import compositeFrag from './shaders/composite.frag.glsl?raw';

const canvas = document.querySelector('#canvas');

const renderer = (() => {
  try {
    return new THREE.WebGLRenderer({ canvas });
  } catch (err) {

    console.error('[BUG-012] WebGL context 创建被 Chrome 拒绝（页面曾 context loss 被 blocked）——关掉标签页重开或重启浏览器后再试');
    throw err;
  }
})();

renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);

canvas.addEventListener('webglcontextlost', (e) => {
  console.error(`[BUG-012] WebGL context lost（GPU TDR 驱动重置）——frame=${frameIndex} scene='${activeScene.name}'`);
  e.preventDefault();
});
canvas.addEventListener('webglcontextrestored', () => {
  console.warn('[BUG-012] WebGL context restored——刷新页面恢复完整状态（纹理需重新上传）');
  resetAccumulation();
});

const rtOptions = {
  type: THREE.FloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: false,
  stencilBuffer: false,
};
let rtA = new THREE.WebGLRenderTarget(canvas.width, canvas.height, rtOptions);
let rtB = new THREE.WebGLRenderTarget(canvas.width, canvas.height, rtOptions);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);

const controls = new OrbitControls(camera, canvas);

const MAX_OBJECTS = 8;
const MAX_LIGHT_QUADS = 4;
const sceneBundles = {};

const trisParam = new URLSearchParams(window.location.search).get('tris');
const trisCap = trisParam === null ? Infinity : Number(trisParam);
const capTris = (tris, sceneConfig) => {
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
};

function makeBundle(sceneConfig, triangles, texImages = null) {
  const t0 = performance.now();
  const bvh = buildBVHTextures(triangles, { texImages });
  const buildMs = performance.now() - t0;

  const uObjects = new Array(MAX_OBJECTS).fill(null).map(() => new THREE.Vector4());
  const uAlbedos = new Array(MAX_OBJECTS).fill(null).map(() => new THREE.Vector4());
  const uEmissions = new Array(MAX_OBJECTS).fill(null).map(() => new THREE.Vector4());
  let objectCount = 0;
  for (const obj of sceneConfig.objects) {
    if (objectCount >= MAX_OBJECTS) break;
    uObjects[objectCount].set(...obj.center, obj.radius);
    uAlbedos[objectCount].set(...(obj.material.color ?? [0, 0, 0]), MAT_TYPES[obj.material.type] ?? 0);
    uEmissions[objectCount].set(...(obj.material.emission ?? [0, 0, 0]), 0);
    objectCount += 1;
  }

  const uLightQuads = new Array(MAX_LIGHT_QUADS * 4).fill(null).map(() => new THREE.Vector4());
  const uLightQuadEmissions = new Array(MAX_LIGHT_QUADS).fill(null).map(() => new THREE.Vector4());
  let lightQuadCount = 0;
  for (const lq of sceneConfig.lightQuads ?? []) {
    if (lightQuadCount >= MAX_LIGHT_QUADS) break;
    lq.corners.forEach((corner, k) => uLightQuads[lightQuadCount * 4 + k].set(...corner, 0));
    uLightQuadEmissions[lightQuadCount].set(...(lq.emission ?? [0, 0, 0]), 0);
    lightQuadCount += 1;
  }

  return {
    sceneConfig,
    uObjects, uAlbedos, uEmissions, objectCount,
    uLightQuads, uLightQuadEmissions, lightQuadCount,
    bvh, buildMs,
  };
}

for (const [name, sceneConfig] of Object.entries(scenes)) {
  if (sceneConfig.load) continue;
  const triangles = capTris(materializeTriangles(sceneConfig.meshes), sceneConfig);
  const bundle = makeBundle(sceneConfig, triangles);
  sceneBundles[name] = bundle;
  console.log(
    `[r12] scene '${name}': ${bundle.bvh.triCount} triangles, ${bundle.bvh.nodeCount} nodes, max depth ${bundle.bvh.maxDepth}`,
  );
}

async function loadAsyncBundle(name) {
  const sceneConfig = scenes[name];
  const result = await sceneConfig.load();
  const merged = { ...sceneConfig, ...(result.scene ?? {}) };
  const tris = capTris(result.tris, merged);

  const texImages = new URLSearchParams(window.location.search).get('noatlas') === '1'
    ? null : (result.texImages ?? null);
  const bundle = makeBundle(merged, tris, texImages);
  sceneBundles[name] = bundle;
  console.log(
    `[r15] scene '${name}': ${bundle.bvh.triCount} triangles, ${bundle.bvh.nodeCount} nodes, max depth ${bundle.bvh.maxDepth}, BVH build ${bundle.buildMs.toFixed(0)} ms`,
  );
}
for (const [name, sceneConfig] of Object.entries(scenes)) {
  if (!sceneConfig.load) continue;
  loadAsyncBundle(name).catch((err) => console.error(`[r15] 场景 '${name}' 加载失败:`, err));
}

const uniforms = {
  uResolution: { value: new THREE.Vector2(canvas.width, canvas.height) },

  uCameraWorldMatrix: { value: new THREE.Matrix4() },
  uInvProjectionMatrix: { value: new THREE.Matrix4() },
  uBackground: { value: new THREE.Color() },

  uObjects: { value: null },
  uAlbedos: { value: null },
  uEmissions: { value: null },
  uObjectCount: { value: 0 },

  uLightQuads: { value: null },
  uLightQuadEmissions: { value: null },
  uLightQuadCount: { value: 0 },

  uBvhBoundsTex: { value: null },
  uBvhContentsTex: { value: null },
  uBvhPositionTex: { value: null },
  uBvhNormalTex: { value: null },
  uBvhUvTex: { value: null },
  uBvhIndexTex: { value: null },
  uBvhTriInfoTex: { value: null },
  uAtlasTex0: { value: null },
  uAtlasTex1: { value: null },
  uTriCount: { value: 0 },
  uTexEnabled: { value: 1 },
  uUseBvh: { value: 1 },
  uDebugMode: { value: 1 },
  uUseNee: { value: 1 },
  uAccumTex: { value: rtB.texture },
  uAccumCount: { value: 0 },
  uSpp: { value: 1 },
  uMaxBounces: { value: 8 },
  uFrame: { value: 0 },
};

const dummyAtlasTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
dummyAtlasTex.type = THREE.UnsignedByteType;
dummyAtlasTex.minFilter = THREE.NearestFilter;
dummyAtlasTex.magFilter = THREE.NearestFilter;
dummyAtlasTex.needsUpdate = true;

const glCaps = renderer.getContext();
console.log(
  `[BUG-012] GPU 能力: maxTextureSize=${renderer.capabilities.maxTextureSize} | maxTextures=${renderer.capabilities.maxTextures} | maxArrayTextureLayers=${glCaps.getParameter(glCaps.MAX_ARRAY_TEXTURE_LAYERS)}`,
);

let cameraPanelSync = null;

function applyScene(bundle) {
  const { sceneConfig } = bundle;
  camera.fov = sceneConfig.camera.fov;
  camera.near = sceneConfig.camera.near ?? 0.1;
  camera.position.set(...sceneConfig.camera.position);
  camera.lookAt(...sceneConfig.camera.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  controls.target.set(...sceneConfig.camera.target);
  uniforms.uCameraWorldMatrix.value.copy(camera.matrixWorld);
  uniforms.uInvProjectionMatrix.value.copy(camera.projectionMatrixInverse);
  uniforms.uBackground.value.setRGB(...sceneConfig.background);
  uniforms.uMaxBounces.value = sceneConfig.maxBounces;
  uniforms.uObjects.value = bundle.uObjects;
  uniforms.uAlbedos.value = bundle.uAlbedos;
  uniforms.uEmissions.value = bundle.uEmissions;
  uniforms.uObjectCount.value = bundle.objectCount;
  uniforms.uLightQuads.value = bundle.uLightQuads;
  uniforms.uLightQuadEmissions.value = bundle.uLightQuadEmissions;
  uniforms.uLightQuadCount.value = bundle.lightQuadCount;
  uniforms.uBvhBoundsTex.value = bundle.bvh.boundsTexture;
  uniforms.uBvhContentsTex.value = bundle.bvh.contentsTexture;
  uniforms.uBvhPositionTex.value = bundle.bvh.positionTexture;
  uniforms.uBvhNormalTex.value = bundle.bvh.normalTexture;
  uniforms.uBvhUvTex.value = bundle.bvh.uvTexture;
  uniforms.uBvhIndexTex.value = bundle.bvh.indexTexture;
  uniforms.uBvhTriInfoTex.value = bundle.bvh.triInfoTexture;
  uniforms.uAtlasTex0.value = bundle.bvh.atlasTextures[0] ?? dummyAtlasTex;
  uniforms.uAtlasTex1.value = bundle.bvh.atlasTextures[1] ?? dummyAtlasTex;
  uniforms.uTriCount.value = bundle.bvh.triCount;
  if (cameraPanelSync) cameraPanelSync();
}

const activeScene = { name: 'cornell' };
applyScene(sceneBundles[activeScene.name]);

const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: vertShader,
    fragmentShader: fragShader,
    uniforms,
    glslVersion: THREE.GLSL3,
  }),
);
scene.add(quad);

const displayScene = new THREE.Scene();
const displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const displayQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: vertShader,
    fragmentShader: compositeFrag,
    uniforms: {
      uSrcTex: { value: rtA.texture },
      uDebugMode: uniforms.uDebugMode,
    },
    glslVersion: THREE.GLSL3,
  }),
);
displayScene.add(displayQuad);

const probeMaterial = new THREE.ShaderMaterial({
  vertexShader: vertShader,
  fragmentShader: `precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;
layout(location = 0) out highp vec4 pc_fragColor;
uniform sampler2D uFTex;
uniform usampler2D uUTex;
uniform int uIndex;
uniform int uMode;
void main() {
  if (uMode == 1) {
    ivec2 uv = ivec2(uIndex % int(textureSize(uUTex, 0).x), uIndex / int(textureSize(uUTex, 0).x));
    pc_fragColor = vec4(texelFetch(uUTex, uv, 0));
  } else {
    ivec2 uv = ivec2(uIndex % int(textureSize(uFTex, 0).x), uIndex / int(textureSize(uFTex, 0).x));
    pc_fragColor = texelFetch(uFTex, uv, 0);
  }
}`,
  uniforms: {
    uFTex: { value: sceneBundles.cornell.bvh.boundsTexture },
    uUTex: { value: sceneBundles.cornell.bvh.contentsTexture },
    uIndex: { value: 0 },
    uMode: { value: 0 },
  },
  glslVersion: THREE.GLSL3,
});
const probeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), probeMaterial);
const probeScene = new THREE.Scene();
probeScene.add(probeQuad);
const probeRT = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
});
function readTexelGpu(tex, index, isUint) {
  const u = probeMaterial.uniforms;
  u.uMode.value = isUint ? 1 : 0;
  if (isUint) u.uUTex.value = tex; else u.uFTex.value = tex;
  u.uIndex.value = index;
  renderer.setRenderTarget(probeRT);
  renderer.render(probeScene, displayCamera);
  renderer.setRenderTarget(null);
  const buf = new Float32Array(4);
  renderer.readRenderTargetPixels(probeRT, 0, 0, 1, 1, buf);
  return Array.from(buf);
}
function probeBvhTextures() {
  const b = sceneBundles[activeScene.name]?.bvh;
  if (!b) return '当前场景束不存在';

  const jsTexel = (data, w, idx, stride) => {
    const o = (Math.floor(idx / w) * w + (idx % w)) * stride;
    return Array.from({ length: stride }, (_, k) => data[o + k]);
  };
  const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(4));
  const checks = [
    ['bounds 根min(节点0)', b.boundsTexture, 0, 4, 0],
    ['bounds 根max(节点0)', b.boundsTexture, 0, 4, 1],
    ['bounds 末节点min', b.boundsTexture, 0, 4, (b.nodeCount - 1) * 2],
    ['contents 根(节点0)', b.contentsTexture, 1, 2, 0],
    ['contents 末节点', b.contentsTexture, 1, 2, b.nodeCount - 1],
    ['position 顶点0', b.positionTexture, 0, 4, 0],
    ['position 末顶点', b.positionTexture, 0, 4, b.vertexCount - 1],
    ['index 三角形0', b.indexTexture, 1, 4, 0],
    ['index 末三角形', b.indexTexture, 1, 4, b.triCount - 1],
    ['info 三角形0(albedo)', b.triInfoTexture, 0, 4, 0],
    ['info 末三角形(albedo)', b.triInfoTexture, 0, 4, b.triCount - 1],
  ];
  return checks.map(([name, tex, isUint, stride, idx]) => {
    const gpu = readTexelGpu(tex, idx, isUint);
    const js = jsTexel(tex.image.data, tex.image.width, idx, stride);

    const ok = gpu.slice(0, stride).every((v, k) => v === Math.fround(js[k]));
    return `${ok ? 'OK' : '★MISMATCH'} ${name} @${idx}: gpu=[${gpu.slice(0, stride).map(fmt).join(', ')}] js=[${js.map(fmt).join(', ')}]`;
  });
}

function resetAccumulation() {
  uniforms.uAccumCount.value = 0;

  renderer.setRenderTarget(rtA);
  renderer.clear();
  renderer.setRenderTarget(rtB);
  renderer.clear();
  renderer.setRenderTarget(null);
}
controls.addEventListener('change', () => {
  resetAccumulation();
  if (cameraPanelSync) cameraPanelSync();
});

const paneContainer = document.createElement('div');
paneContainer.id = 'pane-container';
document.body.appendChild(paneContainer);

const perf = { frameMs: 0 };
const pane = new Pane({ title: 'webgl-path-tracer', container: paneContainer });
pane.addInput(activeScene, 'name', {
  options: Object.fromEntries(Object.keys(scenes).map((n) => [n, n])),
  label: '场景',
}).on('change', () => {
  const bundle = sceneBundles[activeScene.name];
  if (!bundle) {

    console.log(`[r15] 场景 '${activeScene.name}' 尚未就绪，回退 cornell`);
    activeScene.name = 'cornell';
    pane.refresh();
    return;
  }
  applyScene(bundle);
  resetAccumulation();
});
pane.addInput(uniforms.uSpp, 'value', { min: 1, max: 64, step: 1, label: 'spp' }).on('change', resetAccumulation);

let savedSpp = uniforms.uSpp.value;
pane.addInput(uniforms.uUseBvh, 'value', { min: 0, max: 1, step: 1, label: 'BVH(1)/线性(0)' }).on('change', (ev) => {
  if (ev.value === 0) {
    savedSpp = uniforms.uSpp.value;
    uniforms.uSpp.value = 1;
    renderer.setPixelRatio(1);
    uniforms.uResolution.value.set(canvas.width, canvas.height);
  } else {
    if (savedSpp > 1) uniforms.uSpp.value = savedSpp;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    uniforms.uResolution.value.set(canvas.width, canvas.height);
  }
  rtA.setSize(canvas.width, canvas.height);
  rtB.setSize(canvas.width, canvas.height);
  resetAccumulation();
});
addDebugInputs(pane, uniforms.uDebugMode, resetAccumulation);
const cameraPanel = addCameraInputs(pane, camera, controls, resetAccumulation);
cameraPanelSync = cameraPanel.syncFromCamera;
pane.addInput(uniforms.uUseNee, 'value', { min: 0, max: 1, step: 1, label: 'NEE(1)/随机(0)' }).on('change', resetAccumulation);
pane.addMonitor(perf, 'frameMs', { readonly: true, interval: 200, label: 'frame ms (1s 平滑)' });
pane.addInput(uniforms.uBackground.value, 'r', { min: 0, max: 1, label: 'bg.r' }).on('change', resetAccumulation);
pane.addInput(uniforms.uBackground.value, 'g', { min: 0, max: 1, label: 'bg.g' }).on('change', resetAccumulation);
pane.addInput(uniforms.uBackground.value, 'b', { min: 0, max: 1, label: 'bg.b' }).on('change', resetAccumulation);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uResolution.value.set(canvas.width, canvas.height);
  rtA.setSize(canvas.width, canvas.height);
  rtB.setSize(canvas.width, canvas.height);
  resetAccumulation();
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('tex') === '0') {
  uniforms.uTexEnabled.value = 0;
  console.log('[BUG-012] ?tex=0——贴图采样已关闭（材质色路径）');
}
const wantsScene = urlParams.get('scene');
if (wantsScene && scenes[wantsScene]) {
  (function pollApplyScene() {
    const bundle = sceneBundles[wantsScene];
    if (bundle) {
      activeScene.name = wantsScene;
      applyScene(bundle);
      resetAccumulation();
      if (urlParams.has('debug')) uniforms.uDebugMode.value = Number(urlParams.get('debug'));
      pane.refresh();
      console.log(`[diag] auto-applied scene '${wantsScene}' debug=${uniforms.uDebugMode.value}`);
    } else {
      setTimeout(pollApplyScene, 100);
    }
  })();
}

const wantsGltf = new URLSearchParams(window.location.search).get('gltf');
if (wantsGltf) {
  (async () => {
    const tris = await loadGltfTriangles(`/${wantsGltf}`);
    const sceneConfig = autoGltfSceneConfig(tris);
    const bundle = makeBundle(sceneConfig, capTris(tris, sceneConfig));
    sceneBundles.gltf = bundle;
    activeScene.name = 'gltf';
    applyScene(bundle);
    resetAccumulation();
    console.log(
      `[r15] gltf '${wantsGltf}': ${bundle.bvh.triCount} triangles, ${bundle.bvh.nodeCount} nodes, camera [${sceneConfig.camera.position.map((v) => v.toFixed(2))}]`,
    );
  })().catch((err) => console.error('[r15] gltf 加载失败:', err));
}

window.__pt = {
  get rtA() { return rtA; },
  get rtB() { return rtB; },
  uniforms, applyScene, sceneBundles, activeScene, renderer, resetAccumulation,
  quadMaterial: quad.material, displayMaterial: displayQuad.material,
  probeBvhTextures,
};

let frameIndex = 0;
let lastTime = performance.now();

let lastRenderTime = 0;
const TARGET_FRAME_MS = { sponza: 66, default: 33 };

const TILE_GRID = 2;
let tileIndex = 0;
renderer.setAnimationLoop(() => {
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
