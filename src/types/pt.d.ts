// window.__pt 全局类型（兼容契约 C3/C4；实现见 engine/compat.ts，句柄面 = main.js:481-487 等价）
import type * as THREE from 'three';
import type { UniformsTable } from '../engine/uniforms';
import type { SceneBundle } from '../engine/bundle';

declare global {
  interface Window {
    __pt: {
      readonly rtA: THREE.WebGLRenderTarget;
      readonly rtB: THREE.WebGLRenderTarget;
      readonly uniforms: UniformsTable;
      applyScene(bundle: SceneBundle): void;
      readonly sceneBundles: Record<string, SceneBundle>;
      readonly activeScene: { name: string };
      readonly renderer: THREE.WebGLRenderer;
      resetAccumulation(): void;
      readonly quadMaterial: THREE.ShaderMaterial;
      readonly displayMaterial: THREE.ShaderMaterial;
      probeBvhTextures(): string[] | string;
      envInfo(): string;
    };
  }
}
