
import * as THREE from 'three';
import vertShader from '@core/shaders/fullscreen.vert.glsl?raw';
import type { SceneBundle } from '../engine/bundle';

export interface ProbeDeps {
  renderer: THREE.WebGLRenderer;
  bundles: Record<string, SceneBundle>;
  activeScene: { name: string };
  displayCamera: THREE.OrthographicCamera;
}

export interface Probe {
  probeBvhTextures(): string[] | string;
  dispose(): void;
}

export function createProbe(deps: ProbeDeps): Probe {
  const { renderer, bundles, activeScene, displayCamera } = deps;

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
uniform int uMode; // 0 = 浮点纹理, 1 = uint 纹理
void main() {
  if (uMode == 1) {
    ivec2 uv = ivec2(uIndex % int(textureSize(uUTex, 0).x), uIndex / int(textureSize(uUTex, 0).x));
    pc_fragColor = vec4(texelFetch(uUTex, uv, 0)); // uint → float 显示（>2^24 的值会舍入——比对侧用 fround 对齐）
  } else {
    ivec2 uv = ivec2(uIndex % int(textureSize(uFTex, 0).x), uIndex / int(textureSize(uFTex, 0).x));
    pc_fragColor = texelFetch(uFTex, uv, 0);
  }
}`,
    uniforms: {
      uFTex: { value: bundles.cornell.bvh.boundsTexture },
      uUTex: { value: bundles.cornell.bvh.contentsTexture },
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

  function readTexelGpu(tex: THREE.Texture, index: number, isUint: boolean): number[] {
    const u = probeMaterial.uniforms as Record<string, THREE.IUniform>;
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

  function probeBvhTextures(): string[] | string {
    const b = bundles[activeScene.name]?.bvh;
    if (!b) return '当前场景束不存在';

    const jsTexel = (data: ArrayLike<number>, w: number, idx: number, stride: number) => {
      const o = (Math.floor(idx / w) * w + (idx % w)) * stride;
      return Array.from({ length: stride }, (_, k) => data[o + k]);
    };
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(4));
    const checks: Array<[string, THREE.Texture, number, number, number]> = [
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
      const gpu = readTexelGpu(tex, idx, isUint === 1);
      const image = tex.image as { data: ArrayLike<number>; width: number };
      const js = jsTexel(image.data, image.width, idx, stride);

      const ok = gpu.slice(0, stride).every((v, k) => v === Math.fround(js[k]));
      return `${ok ? 'OK' : '★MISMATCH'} ${name} @${idx}: gpu=[${gpu.slice(0, stride).map(fmt).join(', ')}] js=[${js.map(fmt).join(', ')}]`;
    });
  }

  return {
    probeBvhTextures,
    dispose() {
      probeMaterial.dispose();
      probeQuad.geometry.dispose();
      probeRT.dispose();
    },
  };
}
