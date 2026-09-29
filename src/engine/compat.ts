
import type { PathTracerEngine } from './PathTracerEngine';
import { productProfile } from './product-profile';

export function installCompat(engine: PathTracerEngine): boolean {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('tex') === '0') {
    engine.uniforms.uTexEnabled.value = 0;
    console.log('[BUG-012] ?tex=0——贴图采样已关闭（材质色路径）');
  }

  const available = engine.registry.sceneNames;
  const fallback = available.includes('cornell') ? 'cornell' : productProfile.defaultScene;
  const wantsScene = urlParams.get('scene');
  const wantsGltf = productProfile.allowGltf ? urlParams.get('gltf') : null;
  let target: string | null;
  if (wantsScene !== null) {
    target = available.includes(wantsScene) ? wantsScene : fallback;
    if (target !== wantsScene) {
      console.log(`[r20] ?scene='${wantsScene}' 不在当前产品档案的可用场景里，回退 ${target}`);
    }
  } else {
    target = wantsGltf ? null : productProfile.defaultScene;
  }
  if (target !== null) {
    void engine.applyDeferredScene(target, urlParams.has('debug') ? Number(urlParams.get('debug')) : null);
  }

  if (wantsGltf) {
    engine.loadGltfScene(wantsGltf).catch((err) => {
      console.error('[r15] gltf 加载失败:', err);

      if (engine.pendingSceneName === 'gltf') void engine.applyDeferredScene('cornell', null);
    });
  } else if (urlParams.get('gltf')) {
    console.log('[r20] ?gltf= 在当前产品档案里已禁用（allowGltf=false）');
  }

  window.__pt = {
    get rtA() { return engine.rtA; },
    get rtB() { return engine.rtB; },
    uniforms: engine.uniforms,
    applyScene: (bundle) => engine.applyScene(bundle),
    sceneBundles: engine.registry.bundles,
    activeScene: engine.activeScene,
    renderer: engine.renderer,
    resetAccumulation: () => engine.resetAccumulation(),
    quadMaterial: engine.quadMaterial,
    displayMaterial: engine.displayMaterial,
    probeBvhTextures: () => engine.probeBvhTextures(),
    envInfo: () => engine.collectEnvInfo(),
  };

  return urlParams.get('ui') === '0';
}
