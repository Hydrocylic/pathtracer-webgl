// 内核 JS 模块的 TS 类型声明（plan D1/P2: 内核保持 JS，以 .d.ts 提类型）
// 覆盖 web/ 实际用到的导出（plan §3 E3.4）：scenes / autoGltfSceneConfig / materializeTriangles /
// buildBVHTextures / MAT_TYPES / loadGltfTriangles（+ 本轮用到的 DEBUG_MODES / ATLAS_LAYOUT / loadSponzaTriangles）
// 说明符与 vite alias 一致（@core → ../app/src）；实现见 app/src/**（只读，零改动）。
// r20 F-C: 本文件必须保持**全局脚本**——不得出现顶层 import/export（顶层 import 会把 .d.ts 变成模块文件，
//   下面的 declare module 降级为"模块增强"而全部失效，@core/* 报 TS2307）。THREE 类型在需要的 declare 块内局部导入；
//   块间互引（'@core/renderer/bvh.js' 等）走 ambient 回退解析（说明符解析失败时查本文件的 declare module）。

declare module '@core/renderer/bvh.js' {
  import type * as THREE from 'three';
  import type { MeshDecl } from '@core/scene.js';

  // 物化三角形（materializeTriangles 与 sponza-loader 双路径的公共形态）
  export interface Triangle {
    v0: THREE.Vector3;
    v1: THREE.Vector3;
    v2: THREE.Vector3;
    albedo: number[] | null; // loader 路径异步回填前为 null（回填后由 makeBundle 消费）
    matType: number; // MAT_TYPES 码（0 lambert / 1 mirror / 2 glass）
    ns?: Float32Array; // 9 float 顶点法线（n0.xyz n1.xyz n2.xyz）
    uvs?: Float32Array; // 6 float 图集坐标 UV（loader 侧已重映射）
    texLayer?: number; // 贴图层号（-1 = 无贴图）
  }

  // 材质贴图 image（ImageBitmapLoader 或 Image 均可能——canvas drawImage 通吃）
  export type TexImage = ImageBitmap | HTMLImageElement;

  export interface BvhTextures {
    boundsTexture: THREE.DataTexture;
    contentsTexture: THREE.DataTexture;
    positionTexture: THREE.DataTexture;
    normalTexture: THREE.DataTexture;
    uvTexture: THREE.DataTexture;
    indexTexture: THREE.DataTexture;
    triInfoTexture: THREE.DataTexture;
    atlasTextures: THREE.DataTexture[]; // 空 = 无贴图场景（绑 1×1 白占位）
    nodeCount: number;
    vertexCount: number;
    triCount: number;
    maxDepth: number;
    costSum: number;
    leafHistogram: number[];
  }

  export interface BuildBvhTexturesOptions {
    texImages?: TexImage[] | null;
    strategy?: 'median' | 'sah';
  }

  export function materializeTriangles(meshes: MeshDecl[]): Triangle[];
  export function buildBVHTextures(triangles: Triangle[], options?: BuildBvhTexturesOptions): BvhTextures;
  export const MAT_TYPES: Record<string, number>;
}

declare module '@core/scene.js' {
  import type { Triangle, TexImage } from '@core/renderer/bvh.js';

  export interface SceneMaterial {
    color?: [number, number, number]; // 反照率（贴图是乘法因子）——元组: 会被 spread 进 Vector4.set()
    emission?: [number, number, number]; // 自发光（HDR 可 >1）
    type?: string; // 'lambert' | 'mirror' | 'glass'（MAT_TYPES 键）
  }

  export interface QuadMeshDecl {
    type: 'quad';
    corners: { a: [number, number, number]; b: [number, number, number]; c: [number, number, number]; d: [number, number, number] };
    material: SceneMaterial;
  }

  export interface SphereMeshDecl {
    type: 'sphere';
    center: [number, number, number];
    radius: number;
    segments: number;
    material: SceneMaterial;
  }

  export type MeshDecl = QuadMeshDecl | SphereMeshDecl;

  export interface AnalyticSphere {
    type: 'sphere';
    center: [number, number, number];
    radius: number;
    material: SceneMaterial;
  }

  export interface LightQuad {
    type: 'quadLight';
    corners: [number, number, number][]; // [v0, v1, v2, v3]；v0→v1 与 v0→v3 是两条边（shader 的 e0/e1）
    emission?: [number, number, number];
  }

  export interface SceneCamera {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    near?: number; // 缺省 0.1（applyScene 的 ?? 语义）
  }

  // load 契约（r16 S2b 统一）: { tris, texImages?, scene? }——scene = 机位/光源等覆盖
  export interface SceneConfig {
    camera: SceneCamera;
    background: [number, number, number];
    meshes: MeshDecl[];
    objects: AnalyticSphere[];
    lightQuads?: LightQuad[];
    maxBounces: number;
    load?: () => Promise<{ tris: Triangle[]; texImages?: TexImage[]; scene?: Partial<SceneConfig> }>;
  }

  export const scenes: Record<string, SceneConfig>;
  export function autoGltfSceneConfig(tris: Triangle[]): SceneConfig;
}

declare module '@core/scene/sponza-loader.js' {
  import type { Triangle, TexImage } from '@core/renderer/bvh.js';
  export const ATLAS_LAYOUT: {
    GRID: number; CELL: number; PAD: number; ATLAS: number; CELLS_PER_ATLAS: number; COUNT: number;
  };
  export function loadGltfTriangles(url: string): Promise<{ tris: Triangle[]; texImages: TexImage[] }>;
  export function loadSponzaTriangles(url: string): Promise<{ tris: Triangle[]; texImages: TexImage[] }>;
}

declare module '@core/debug/debug-modes.js' {
  // 模式表与 pathtrace.frag 出口 switch 的 0–5 常量同步（改动两边同步——内核注释约定）
  export interface DebugMode {
    value: number;
    label: string;
  }
  export const DEBUG_MODES: DebugMode[];
}
