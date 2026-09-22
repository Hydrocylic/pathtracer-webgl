
import * as THREE from 'three';

export type UniformsTable = {
  uResolution: THREE.IUniform<THREE.Vector2>;
  uCameraWorldMatrix: THREE.IUniform<THREE.Matrix4>;
  uInvProjectionMatrix: THREE.IUniform<THREE.Matrix4>;
  uBackground: THREE.IUniform<THREE.Color>;
  uObjects: THREE.IUniform<THREE.Vector4[] | null>;
  uAlbedos: THREE.IUniform<THREE.Vector4[] | null>;
  uEmissions: THREE.IUniform<THREE.Vector4[] | null>;
  uObjectCount: THREE.IUniform<number>;
  uLightQuads: THREE.IUniform<THREE.Vector4[] | null>;
  uLightQuadEmissions: THREE.IUniform<THREE.Vector4[] | null>;
  uLightQuadCount: THREE.IUniform<number>;
  uBvhBoundsTex: THREE.IUniform<THREE.Texture | null>;
  uBvhContentsTex: THREE.IUniform<THREE.Texture | null>;
  uBvhPositionTex: THREE.IUniform<THREE.Texture | null>;
  uBvhNormalTex: THREE.IUniform<THREE.Texture | null>;
  uBvhUvTex: THREE.IUniform<THREE.Texture | null>;
  uBvhIndexTex: THREE.IUniform<THREE.Texture | null>;
  uBvhTriInfoTex: THREE.IUniform<THREE.Texture | null>;
  uAtlasTex0: THREE.IUniform<THREE.Texture | null>;
  uAtlasTex1: THREE.IUniform<THREE.Texture | null>;
  uTriCount: THREE.IUniform<number>;
  uTexEnabled: THREE.IUniform<number>;
  uUseBvh: THREE.IUniform<number>;
  uDebugMode: THREE.IUniform<number>;
  uUseNee: THREE.IUniform<number>;
  uAccumTex: THREE.IUniform<THREE.Texture | null>;
  uAccumCount: THREE.IUniform<number>;
  uSpp: THREE.IUniform<number>;
  uMaxBounces: THREE.IUniform<number>;
  uFrame: THREE.IUniform<number>;
}

export interface UniformsBundle {
  uniforms: UniformsTable;

  dummyAtlasTex: THREE.DataTexture;
}

export function createUniforms(width: number, height: number, accumTex: THREE.Texture): UniformsBundle {
  const uniforms: UniformsTable = {
    uResolution: { value: new THREE.Vector2(width, height) },

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

    uDebugMode: { value: 0 },
    uUseNee: { value: 1 },
    uAccumTex: { value: accumTex },
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

  return { uniforms, dummyAtlasTex };
}
